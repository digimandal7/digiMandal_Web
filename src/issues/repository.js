const prisma = require("../config/prisma");
const { Prisma } = require("@prisma/client");
const { scope } = require("./policy");
const user = { id: true, name: true, profileImage: true };
const attachment = { include: { upload: true }, orderBy: { id: "asc" } };
function include(userId, detail = false) {
  return {
    creator: { select: user },
    mandal: { select: { id: true, name: true } },
    attachments: { ...attachment, ...(detail ? {} : { take: 5 }) },
    participants: {
      include: {
        member: {
          select: {
            id: true,
            userId: true,
            isActive: true,
            user: { select: user },
          },
        },
      },
      orderBy: [{ createdAt: "asc" }, { memberId: "asc" }],
      ...(detail ? {} : { take: 10 }),
    },
    supporters: { where: { userId }, select: { userId: true } },
    _count: {
      select: {
        supporters: true,
        comments: true,
        attachments: true,
        participants: true,
      },
    },
    ...(detail
      ? {
          resolution: {
            include: { resolver: { select: user }, attachments: attachment },
          },
        }
      : {}),
  };
}
async function transaction(work) {
  for (let attempt = 0; ; attempt++) {
    try {
      return await prisma.$transaction(work, {
        isolationLevel: "Serializable",
        maxWait: 10000,
        timeout: 20000,
      });
    } catch (error) {
      const retryable =
        ["P2034", "P2002"].includes(error.code) ||
        (error.code === "P2010" &&
          ["1213", "1205"].includes(String(error.meta?.code)));
      if (!retryable || attempt >= 5) throw error;
      await new Promise((resolve) => setTimeout(resolve, 10 * (attempt + 1)));
    }
  }
}
async function list(db, userId, pincode, query, page) {
  const search = query.search?.replace(/[\\%_]/g, "\\$&");
  const where = {
    ...scope(pincode),
    ...(query.mandalId ? { mandalId: query.mandalId } : {}),
    ...(query.status !== "ALL" ? { status: query.status } : {}),
    ...(query.search
      ? {
          OR: [
            { title: { contains: search } },
            { description: { contains: search } },
          ],
        }
      : {}),
  };
  let rows;
  if (query.sort === "COLLABORATED") {
    // Correlated aggregate uses (userId, issueId, createdAt); ordering is applied before pagination.
    const ids = await db.$queryRaw(Prisma.sql`
      SELECT i.id FROM Issue i
      LEFT JOIN (SELECT issueId, MAX(createdAt) lastActivity FROM IssueActivity WHERE userId = ${userId} GROUP BY issueId) a ON a.issueId = i.id
      WHERE i.archivedAt IS NULL AND i.pincode = ${pincode}
      ${query.mandalId ? Prisma.sql`AND i.mandalId = ${query.mandalId}` : Prisma.empty}
      ${query.status !== "ALL" ? Prisma.sql`AND i.status = ${query.status}` : Prisma.empty}
      ${query.search ? Prisma.sql`AND (i.title LIKE ${`%${search}%`} OR i.description LIKE ${`%${search}%`})` : Prisma.empty}
      ORDER BY (a.lastActivity IS NOT NULL) DESC, a.lastActivity DESC, i.publishedAt DESC, i.id DESC LIMIT ${page.limit} OFFSET ${page.skip}`);
    const found = await db.issue.findMany({
      where: { ...where, id: { in: ids.map((r) => r.id) } },
      include: include(userId),
    });
    const byId = new Map(found.map((r) => [r.id, r]));
    rows = ids.map((r) => byId.get(r.id)).filter(Boolean);
  } else
    rows = await db.issue.findMany({
      where,
      include: include(userId),
      orderBy: [{ publishedAt: "desc" }, { id: "desc" }],
      skip: page.skip,
      take: page.limit,
    });
  return { rows, total: await db.issue.count({ where }) };
}
const activity = (db, issueId, userId, action) =>
  db.issueActivity.create({ data: { issueId, userId, action } });
module.exports = {
  prisma,
  transaction,
  list,
  include,
  user,
  attachment,
  activity,
};
