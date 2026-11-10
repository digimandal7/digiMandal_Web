const { randomUUID } = require("node:crypto");
const sharp = require("sharp");
const { fail, invalid } = require("./validation");
const policy = require("./policy");
const repo = require("./repository");
const provider = () => require("../config/imagekit");
function metadata(upload) {
  return {
    id: upload.id,
    mimeType: upload.mimeType,
    bytes: upload.bytes,
    width: upload.width,
    height: upload.height,
    url: `/api/issue-uploads/${upload.id}/content`,
    thumbnailUrl: `/api/issue-uploads/${upload.id}/content?thumbnail=true`,
  };
}
async function upload(userId, mandalId, purpose, file) {
  await policy.membership(repo.prisma, mandalId, userId);
  if (!["ISSUE", "COMMENT", "RESOLUTION"].includes(purpose))
    invalid("purpose", "Use ISSUE, COMMENT or RESOLUTION");
  if (!file || file.size > 5 * 1024 * 1024)
    invalid("file", "An image up to 5 MB is required");
  let info, buffer;
  try {
    info = await sharp(file.buffer, { limitInputPixels: 40000000 }).metadata();
    if (
      !["jpeg", "png"].includes(info.format) ||
      file.mimetype !== `image/${info.format}` ||
      (info.pages || 1) !== 1
    )
      invalid("file", "Only non-animated JPEG and PNG images are supported");
    buffer = await sharp(file.buffer, { limitInputPixels: 40000000 })
      .rotate()
      .toFormat(info.format)
      .toBuffer();
    info = await sharp(buffer).metadata();
  } catch (error) {
    if (error.status) throw error;
    invalid("file", "Invalid or oversized image");
  }
  if (buffer.length > 5 * 1024 * 1024)
    invalid("file", "Decoded image exceeds 5 MB");
  const id = randomUUID();
  const saved = await provider().upload({
    file: buffer,
    fileName: `${id}.${info.format}`,
    folder: "/digimandal/issues",
    isPrivateFile: true,
    useUniqueFileName: false,
  });
  try {
    return await repo.transaction(async (db) => {
      await policy.membership(db, mandalId, userId);
      const row = await db.issueUpload.create({
        data: {
          id,
          mandalId,
          ownerId: userId,
          purpose,
          mimeType: `image/${info.format}`,
          bytes: buffer.length,
          width: info.width,
          height: info.height,
          fileId: saved.fileId,
          filePath: saved.filePath,
          expiresAt: new Date(Date.now() + 86400000),
        },
      });
      return metadata(row);
    });
  } catch (error) {
    await provider()
      .deleteFile(saved.fileId)
      .catch(() => {});
    throw error;
  }
}
async function attach(
  db,
  { userId, mandalId, purpose, uploadIds, model, foreignKey, parentId },
) {
  const current = await db[model].findMany({
    where: { [foreignKey]: parentId },
  });
  const retained = new Set(current.map((a) => a.uploadId));
  for (const uploadId of uploadIds) {
    const row = await db.issueUpload.findFirst({
      where: {
        id: uploadId,
        mandalId,
        purpose,
        ...(retained.has(uploadId)
          ? { state: "ATTACHED" }
          : { ownerId: userId, state: "READY", expiresAt: { gt: new Date() } }),
      },
    });
    if (!row)
      invalid(
        "uploadIds",
        "Upload unavailable, expired, already used, wrong purpose or not owned by you",
      );
    if (!retained.has(uploadId)) {
      const claimed = await db.issueUpload.updateMany({
        where: { id: uploadId, state: "READY", expiresAt: { gt: new Date() } },
        data: { state: "ATTACHED" },
      });
      if (claimed.count !== 1)
        invalid("uploadIds", "Upload is already attached");
      await db[model].create({ data: { [foreignKey]: parentId, uploadId } });
    }
  }
  const removed = current.filter((a) => !uploadIds.includes(a.uploadId));
  await db[model].deleteMany({
    where: {
      [foreignKey]: parentId,
      uploadId: { in: removed.map((a) => a.uploadId) },
    },
  });
  await db.issueUpload.updateMany({
    where: { id: { in: removed.map((a) => a.uploadId) } },
    data: { state: "ABANDONED", expiresAt: new Date() },
  });
}
async function accessible(db, userId, id) {
  const row = await db.issueUpload.findUnique({
    where: { id },
    include: {
      issueAttachment: true,
      commentAttachment: { include: { comment: true } },
      resolutionAttachment: { include: { resolution: true } },
    },
  });
  if (!row) fail(404, "NOT_FOUND", "Resource not found");
  await policy.membership(db, row.mandalId, userId);
  const issueId =
    row.issueAttachment?.issueId ||
    row.commentAttachment?.comment.issueId ||
    row.resolutionAttachment?.resolution.issueId;
  if (row.state === "ATTACHED" && issueId)
    await policy.issueAccess(db, issueId, userId);
  else if (
    row.state !== "READY" ||
    row.ownerId !== userId ||
    row.expiresAt <= new Date()
  )
    fail(404, "NOT_FOUND", "Resource not found");
  return row;
}
async function content(userId, id, thumbnail) {
  // Never expose provider URLs. Proxy private content after a fresh membership check.
  const row = await repo.transaction((db) => accessible(db, userId, id));
  const url = provider().url({
    path: row.filePath,
    signed: true,
    expireSeconds: 30,
    ...(thumbnail
      ? { transformation: [{ width: 240, height: 240, cropMode: "at_max" }] }
      : {}),
  });
  const response = await fetch(url, { signal: AbortSignal.timeout(15000) });
  if (!response.ok)
    fail(502, "MEDIA_UNAVAILABLE", "Image temporarily unavailable");
  return {
    mimeType: row.mimeType,
    buffer: Buffer.from(await response.arrayBuffer()),
  };
}
async function abandon(userId, id) {
  return repo.transaction(async (db) => {
    const row = await accessible(db, userId, id);
    if (row.ownerId !== userId || row.state !== "READY")
      fail(409, "UPLOAD_IN_USE", "Only your unattached uploads may be deleted");
    await db.issueUpload.update({
      where: { id },
      data: { state: "ABANDONED", expiresAt: new Date() },
    });
    return { deleted: true };
  });
}
async function cleanup() {
  const rows = await repo.prisma.issueUpload.findMany({
    where: {
      state: { in: ["READY", "ABANDONED", "DELETING"] },
      expiresAt: { lte: new Date() },
    },
    take: 100,
  });
  let deleted = 0;
  for (const row of rows) {
    const claim = await repo.prisma.issueUpload.updateMany({
      where: {
        id: row.id,
        state: { in: ["READY", "ABANDONED", "DELETING"] },
        expiresAt: { lte: new Date() },
      },
      data: { state: "DELETING", expiresAt: new Date(Date.now() + 300000) },
    });
    if (!claim.count) continue;
    try {
      await provider()
        .deleteFile(row.fileId)
        .catch((error) => {
          if (error.statusCode !== 404) throw error;
        });
      await repo.prisma.issueUpload.delete({ where: { id: row.id } });
      deleted++;
    } catch {
      /* Expiring lease permits a later retry, including after process failure. */
    }
  }
  return { deleted };
}
module.exports = { metadata, upload, attach, content, abandon, cleanup };
