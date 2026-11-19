const { createHash } = require("node:crypto");
const repo = require("./repository");
const policy = require("./policy");
const v = require("./validation");
const storage = require("./storage");
const hash = (value) =>
  createHash("sha256").update(JSON.stringify(value)).digest("hex");
const pageResult = (items, total, p) => ({
  items,
  total,
  page: p.page,
  limit: p.limit,
  hasNext: p.skip + items.length < total,
});
const person = (row) => ({
  id: row.id,
  name: row.name,
  avatar: row.profileImage,
});
const files = (rows) => rows.map((a) => storage.metadata(a.upload));
function resolutionDto(row, participants) {
  return row
    ? {
        id: row.id,
        resolutionDate: row.resolutionDate,
        description: row.description,
        resolver: person(row.resolver),
        solutionProviders: participants.filter((p) => p.role === "RESOLVER"),
        attachments: files(row.attachments),
        createdAt: row.createdAt,
        updatedAt: row.updatedAt,
      }
    : null;
}
function dto(row, member, approver = false) {
  const participants = row.participants.map((p) => ({
    memberId: p.memberId,
    role: p.role,
    active: p.member.isActive,
    user: p.member.user ? person(p.member.user) : null,
  }));
  return {
    id: row.id,
    mandalId: row.mandalId,
    title: row.title,
    description: row.description,
    shortDescription: row.description.slice(0, 240),
    locationOrMandalName: row.locationOrMandalName,
    pincode: row.pincode,
    status: row.status,
    occurrenceDate: row.occurrenceDate,
    publishedAt: row.publishedAt,
    resolvedAt: row.resolvedAt,
    createdAt: row.createdAt,
    updatedAt: row.updatedAt,
    archivedAt: row.archivedAt,
    creator: person(row.creator),
    mandal: row.mandal,
    supporterCount: row._count.supporters,
    commentCount: row._count.comments,
    participants,
    participantCount: row._count.participants,
    attachments: files(row.attachments),
    totalAttachmentCount: row._count.attachments,
    isSupported: row.supporters.length > 0,
    permissions: policy.permissions(row, member, approver),
    ...(row.resolution !== undefined
      ? { resolution: resolutionDto(row.resolution, participants) }
      : {}),
  };
}
async function isApprover(db, issueId, memberId) {
  return Boolean(
    await db.issueParticipant.findUnique({
      where: { issueId_memberId_role: { issueId, memberId, role: "APPROVER" } },
    }),
  );
}
async function detail(db, userId, issueId) {
  const { member } = await policy.issueAccess(db, issueId, userId);
  const row = await db.issue.findUnique({
    where: { id: issueId },
    include: repo.include(userId, true),
  });
  const result = dto(
    row,
    member,
    member ? await isApprover(db, issueId, member.id) : false,
  );
  const preview = await db.issueSupporter.findMany({
    where: { issueId },
    include: { user: { select: repo.user } },
    orderBy: [{ createdAt: "desc" }, { userId: "desc" }],
    take: 5,
  });
  const read = await db.issueRead.findUnique({
    where: { issueId_userId: { issueId, userId } },
  });
  const supporterPreview = preview.map((s) => person(s.user));
  const newCommentCount = await db.issueComment.count({
    where: {
      issueId,
      userId: { not: userId },
      ...(read ? { createdAt: { gt: read.commentsReadAt } } : {}),
    },
  });
  return { ...result, supporterPreview, newCommentCount };
}
async function replaceParticipants(db, issue, member, values) {
  const selected = await policy.selected(db, issue.mandalId, values, member);
  // A creator may change ordinary participants, but cannot revoke or grant approver authority.
  if (!policy.isAdmin(member)) {
    const approvers = await db.issueParticipant.findMany({
      where: { issueId: issue.id, role: "APPROVER" },
    });
    if (approvers.length)
      v.fail(
        403,
        "FORBIDDEN",
        "Only administrators may replace participants after approvers are designated",
      );
  }
  await db.issueParticipant.deleteMany({
    where: { issueId: issue.id, role: { not: "RESOLVER" } },
  });
  if (values.length)
    await db.issueParticipant.createMany({
      data: values.map((p) => ({ issueId: issue.id, ...p })),
    });
  for (const row of selected)
    await repo.activity(db, issue.id, row.userId, "SELECTED");
}
const attach = (
  db,
  userId,
  issue,
  purpose,
  uploadIds,
  model,
  foreignKey,
  parentId,
) =>
  storage.attach(db, {
    userId,
    mandalId: issue.mandalId,
    purpose,
    uploadIds,
    model,
    foreignKey,
    parentId,
  });
async function create(userId, mandalId, body, key) {
  const input = v.issue(body),
    publicationKey = v.key(key),
    publicationHash = hash(input);
  return repo.transaction(async (db) => {
    const member = await policy.membership(db, mandalId, userId);
    const creator = await policy.viewer(db, userId);
    const old = await db.issue.findUnique({
      where: {
        mandalId_createdByUserId_publicationKey: {
          mandalId,
          createdByUserId: userId,
          publicationKey,
        },
      },
    });
    if (old) {
      if (old.publicationHash !== publicationHash)
        v.fail(
          409,
          "IDEMPOTENCY_CONFLICT",
          "Key already used with different content",
        );
      return detail(db, userId, old.id);
    }
    await policy.selected(db, mandalId, input.participants, member);
    const { participants, uploadIds, ...data } = input;
    const row = await db.issue.create({
      data: {
        ...data,
        mandalId: member.mandalId,
        createdByUserId: userId,
        pincode: creator.pincode,
        publicationKey,
        publicationHash,
      },
    });
    await replaceParticipants(db, row, member, participants);
    await attach(
      db,
      userId,
      row,
      "ISSUE",
      uploadIds,
      "issueAttachment",
      "issueId",
      row.id,
    );
    await repo.activity(db, row.id, userId, "CREATED");
    return detail(db, userId, row.id);
  });
}
async function list(userId, query) {
  const p = v.paging(query),
    status = query.status || "ALL",
    sort = query.sort || "LATEST";
  if (!["ALL", "PENDING", "RESOLVED"].includes(status))
    v.invalid("status", "Use ALL, PENDING or RESOLVED");
  if (!["LATEST", "COLLABORATED"].includes(sort))
    v.invalid("sort", "Use LATEST or COLLABORATED");
  const mandalId =
    query.mandalId === undefined ? undefined : v.id(query.mandalId, "mandalId");
  const search = query.search ? v.text(query.search, "search", 200) : undefined;
  return repo.transaction(async (db) => {
    const currentUser = await policy.viewer(db, userId);
    const { rows, total } = await repo.list(
      db,
      userId,
      currentUser.pincode,
      { mandalId, status, sort, search },
      p,
    );
    const memberships = await db.mandalMember.findMany({
      where: {
        userId,
        isActive: true,
        mandalId: { in: [...new Set(rows.map((r) => r.mandalId))] },
      },
      include: { roleRef: true, mandal: true },
    });
    const byMandal = new Map(memberships.map((m) => [m.mandalId, m]));
    const approvers = await db.issueParticipant.findMany({
      where: {
        issueId: { in: rows.map((r) => r.id) },
        memberId: { in: memberships.map((m) => m.id) },
        role: "APPROVER",
      },
    });
    const approved = new Set(approvers.map((p) => p.issueId));
    return pageResult(
      rows.map((r) => dto(r, byMandal.get(r.mandalId), approved.has(r.id))),
      total,
      p,
    );
  });
}
async function update(userId, issueId, body) {
  const input = v.issue(body, true);
  return repo.transaction(async (db) => {
    const { issue, member } = await policy.issueAccess(
      db,
      issueId,
      userId,
      true,
    );
    if (!policy.permissions(issue, member).canEdit)
      v.fail(
        403,
        "FORBIDDEN",
        "Only the creator or a Mandal admin may edit a pending issue",
      );
    const { participants, uploadIds, ...data } = input;
    if (participants)
      await replaceParticipants(db, issue, member, participants);
    if (uploadIds)
      await attach(
        db,
        userId,
        issue,
        "ISSUE",
        uploadIds,
        "issueAttachment",
        "issueId",
        issueId,
      );
    await db.issue.update({ where: { id: issueId }, data });
    await repo.activity(db, issueId, userId, "EDITED");
    return detail(db, userId, issueId);
  });
}
async function archive(userId, issueId) {
  return repo.transaction(async (db) => {
    const { member } = await policy.issueAccess(db, issueId, userId, true);
    if (!policy.isAdmin(member))
      v.fail(403, "FORBIDDEN", "Only Mandal administrators may archive issues");
    await db.issue.update({
      where: { id: issueId },
      data: { archivedAt: new Date() },
    });
    await repo.activity(db, issueId, userId, "ARCHIVED");
    return { archived: true };
  });
}
async function support(userId, issueId, enabled) {
  return repo.transaction(async (db) => {
    await policy.issueAccess(db, issueId, userId, true);
    const where = { issueId_userId: { issueId, userId } };
    const existing = await db.issueSupporter.findUnique({ where });
    if (enabled && !existing) {
      await db.issueSupporter.create({ data: { issueId, userId } });
      await repo.activity(db, issueId, userId, "SUPPORTED");
    } else if (!enabled && existing) {
      await db.issueSupporter.delete({ where });
      await repo.activity(db, issueId, userId, "UNSUPPORTED");
    }
    return {
      isSupported: enabled,
      supporterCount: await db.issueSupporter.count({ where: { issueId } }),
    };
  });
}
async function supporters(userId, issueId, query) {
  const p = v.paging(query);
  return repo.transaction(async (db) => {
    await policy.issueAccess(db, issueId, userId);
    const rows = await db.issueSupporter.findMany({
      where: { issueId },
      include: { user: { select: repo.user } },
      orderBy: [{ createdAt: "desc" }, { userId: "desc" }],
      skip: p.skip,
      take: p.limit,
    });
    return pageResult(
      rows.map((r) => ({ ...person(r.user), supportedAt: r.createdAt })),
      await db.issueSupporter.count({ where: { issueId } }),
      p,
    );
  });
}
async function members(userId, mandalId, query) {
  const p = v.paging(query),
    search = query.search ? v.text(query.search, "search", 200) : undefined,
    role = query.role ? v.text(query.role, "role", 100) : undefined;
  return repo.transaction(async (db) => {
    await policy.membership(db, mandalId, userId);
    const where = {
      mandalId,
      isActive: true,
      userId: { not: null },
      ...(search ? { user: { name: { contains: search } } } : {}),
      ...(role ? { role } : {}),
    };
    const rows = await db.mandalMember.findMany({
      where,
      include: { user: { select: repo.user } },
      orderBy: { id: "asc" },
      skip: p.skip,
      take: p.limit,
    });
    return pageResult(
      rows.map((r) => ({ memberId: r.id, role: r.role, user: person(r.user) })),
      await db.mandalMember.count({ where }),
      p,
    );
  });
}
function commentDto(row, userId, member) {
  return {
    id: row.id,
    issueId: row.issueId,
    text: row.text,
    author: person(row.author),
    createdAt: row.createdAt,
    updatedAt: row.updatedAt,
    attachments: files(row.attachments),
    permissions: {
      canEdit: row.userId === userId,
      canDelete: row.userId === userId || policy.isAdmin(member),
    },
  };
}
async function comments(userId, issueId, query) {
  const p = v.paging(query);
  return repo.transaction(async (db) => {
    const { member } = await policy.issueAccess(db, issueId, userId);
    const rows = await db.issueComment.findMany({
      where: { issueId },
      include: { author: { select: repo.user }, attachments: repo.attachment },
      orderBy: [{ createdAt: "desc" }, { id: "desc" }],
      skip: p.skip,
      take: p.limit,
    });
    return pageResult(
      rows.map((r) => commentDto(r, userId, member)),
      await db.issueComment.count({ where: { issueId } }),
      p,
    );
  });
}
async function writeComment(
  userId,
  issueId,
  body,
  commentId,
  deleting = false,
) {
  const input = deleting ? {} : v.comment(body, Boolean(commentId));
  return repo.transaction(async (db) => {
    const { issue, member } = await policy.issueAccess(
      db,
      issueId,
      userId,
      true,
    );
    let row;
    if (commentId) {
      row = await db.issueComment.findFirst({
        where: { id: commentId, issueId },
      });
      if (!row) v.fail(404, "NOT_FOUND", "Resource not found");
      if (row.userId !== userId && !(deleting && policy.isAdmin(member)))
        v.fail(
          403,
          "FORBIDDEN",
          "You may only edit your own comments; admins may remove comments",
        );
    }
    if (deleting) {
      const attachments = await db.issueCommentAttachment.findMany({
        where: { commentId },
      });
      await db.issueComment.delete({ where: { id: commentId } });
      await db.issueUpload.updateMany({
        where: { id: { in: attachments.map((a) => a.uploadId) } },
        data: { state: "ABANDONED", expiresAt: new Date() },
      });
      await repo.activity(db, issueId, userId, "COMMENT_DELETED");
      return { deleted: true };
    }
    row = row
      ? await db.issueComment.update({
          where: { id: commentId },
          data: { text: input.text },
        })
      : await db.issueComment.create({
          data: { issueId, userId, text: input.text },
        });
    if (input.uploadIds)
      await attach(
        db,
        userId,
        issue,
        "COMMENT",
        input.uploadIds,
        "issueCommentAttachment",
        "commentId",
        row.id,
      );
    await repo.activity(
      db,
      issueId,
      userId,
      commentId ? "COMMENT_EDITED" : "COMMENTED",
    );
    return commentDto(
      await db.issueComment.findUnique({
        where: { id: row.id },
        include: {
          author: { select: repo.user },
          attachments: repo.attachment,
        },
      }),
      userId,
      member,
    );
  });
}
async function resolve(userId, issueId, body, key) {
  const input = v.resolution(body),
    submissionKey = v.key(key),
    submissionHash = hash(input);
  return repo.transaction(async (db) => {
    const { issue, member } = await policy.issueAccess(
      db,
      issueId,
      userId,
      true,
    );
    const allowed =
      policy.isAdmin(member) ||
      Boolean(member && (await isApprover(db, issueId, member.id)));
    if (!allowed)
      v.fail(
        403,
        "FORBIDDEN",
        "Only Mandal administrators or designated approvers may resolve",
      );
    const old = await db.issueResolution.findUnique({ where: { issueId } });
    if (old) {
      if (
        old.resolvedByUserId === userId &&
        old.submissionKey === submissionKey &&
        old.submissionHash === submissionHash
      )
        return (await detail(db, userId, issueId)).resolution;
      v.fail(409, "ALREADY_RESOLVED", "Issue already resolved");
    }
    if (issue.status !== "PENDING")
      v.fail(409, "INVALID_TRANSITION", "Only pending issues may be resolved");
    if (
      input.resolutionDate < issue.occurrenceDate ||
      input.resolutionDate > new Date()
    )
      v.invalid(
        "resolutionDate",
        "Must be on or after occurrence and not in the future",
      );
    const values = input.memberIds.map((memberId) => ({
      memberId,
      role: "RESOLVER",
    }));
    const selected = await policy.selected(
      db,
      issue.mandalId,
      values,
      member,
      true,
    );
    const row = await db.issueResolution.create({
      data: {
        issueId,
        resolvedByUserId: userId,
        resolutionDate: input.resolutionDate,
        description: input.description,
        submissionKey,
        submissionHash,
      },
    });
    await db.issueParticipant.createMany({
      data: values.map((p) => ({ issueId, ...p })),
    });
    await attach(
      db,
      userId,
      issue,
      "RESOLUTION",
      input.uploadIds,
      "issueResolutionAttachment",
      "resolutionId",
      row.id,
    );
    const changed = await db.issue.updateMany({
      where: { id: issueId, status: "PENDING" },
      data: { status: "RESOLVED", resolvedAt: input.resolutionDate },
    });
    if (changed.count !== 1)
      v.fail(409, "ALREADY_RESOLVED", "Issue already resolved");
    await repo.activity(db, issueId, userId, "RESOLVED");
    for (const selectedMember of selected)
      await repo.activity(
        db,
        issueId,
        selectedMember.userId,
        "SOLUTION_PROVIDER",
      );
    return (await detail(db, userId, issueId)).resolution;
  });
}
async function markRead(userId, issueId, body) {
  v.only(body, ["through"]);
  const through = v.date(body.through, "through");
  if (through > new Date())
    v.invalid("through", "Read timestamp cannot be in the future");
  return repo.transaction(async (db) => {
    await policy.issueAccess(db, issueId, userId, true);
    const where = { issueId_userId: { issueId, userId } };
    const old = await db.issueRead.findUnique({ where });
    const commentsReadAt =
      old && old.commentsReadAt > through ? old.commentsReadAt : through;
    await db.issueRead.upsert({
      where,
      create: { issueId, userId, commentsReadAt },
      update: { commentsReadAt },
    });
    return { commentsReadAt };
  });
}
async function preview(userId, mandalId, body) {
  const input = v.issue(body);
  return repo.transaction(async (db) => {
    const member = await policy.membership(db, mandalId, userId);
    const currentUser = await policy.viewer(db, userId);
    const selected = await policy.selected(
      db,
      mandalId,
      input.participants,
      member,
    );
    const uploads = await db.issueUpload.findMany({
      where: {
        id: { in: input.uploadIds },
        mandalId,
        ownerId: userId,
        purpose: "ISSUE",
        state: "READY",
        expiresAt: { gt: new Date() },
      },
    });
    if (uploads.length !== input.uploadIds.length)
      v.invalid(
        "uploadIds",
        "All uploads must be owned, available and belong to this Mandal",
      );
    const creator = await db.user.findUnique({
      where: { id: userId },
      select: repo.user,
    });
    return {
      title: input.title,
      description: input.description,
      locationOrMandalName: input.locationOrMandalName,
      occurrenceDate: input.occurrenceDate,
      pincode: currentUser.pincode,
      creator: person(creator),
      mandal: { id: member.mandal.id, name: member.mandal.name },
      participants: input.participants.map((p) => ({
        ...p,
        user: person(selected.find((m) => m.id === p.memberId).user),
      })),
      attachments: input.uploadIds.map((id) =>
        storage.metadata(uploads.find((u) => u.id === id)),
      ),
    };
  });
}
async function mandals(userId, query) {
  const p = v.paging(query);
  return repo.transaction(async (db) => {
    const currentUser = await policy.viewer(db, userId);
    const rows = await db.mandal.findMany({
      where: {
        OR: [
          { members: { some: { userId, isActive: true } } },
          {
            issues: {
              some: { pincode: currentUser.pincode, archivedAt: null },
            },
          },
        ],
      },
      select: {
        id: true,
        name: true,
        members: {
          where: { userId, isActive: true },
          select: { id: true },
          take: 1,
        },
      },
      orderBy: { id: "asc" },
      skip: p.skip,
      take: p.limit,
    });
    const where = {
      OR: [
        { members: { some: { userId, isActive: true } } },
        {
          issues: { some: { pincode: currentUser.pincode, archivedAt: null } },
        },
      ],
    };
    return pageResult(
      rows.map(({ members, ...mandal }) => ({
        ...mandal,
        canCreateIssue: members.length > 0,
      })),
      await db.mandal.count({ where }),
      p,
    );
  });
}
module.exports = {
  preview,
  mandals,
  create,
  list,
  detail: (userId, issueId) =>
    repo.transaction((db) => detail(db, userId, issueId)),
  update,
  archive,
  support,
  supporters,
  members,
  comments,
  writeComment,
  resolve,
  markRead,
  dto,
  hash,
};
