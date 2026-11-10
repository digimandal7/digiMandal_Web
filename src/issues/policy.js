const { fail, invalid } = require("./validation");
const active = (userId) => ({ userId, isActive: true });
const scope = (userId) => ({
  archivedAt: null,
  mandal: { members: { some: active(userId) } },
});
function isAdmin(member) {
  const permissions =
    member.roleRef?.mandalId === member.mandalId
      ? member.roleRef.permissions
      : [];
  return (
    member.mandal?.createdById === member.userId ||
    (Array.isArray(permissions) && permissions.includes("*")) ||
    (!member.roleId && member.role === "Admin")
  );
}
async function membership(db, mandalId, userId) {
  const member = await db.mandalMember.findFirst({
    where: { mandalId, ...active(userId) },
    include: { roleRef: true, mandal: true },
  });
  if (!member) fail(404, "NOT_FOUND", "Resource not found");
  return member;
}
async function issueAccess(db, issueId, userId, lock = false) {
  const issue = await db.issue.findFirst({
    where: { id: issueId, ...scope(userId) },
  });
  if (!issue) fail(404, "NOT_FOUND", "Resource not found");
  if (lock)
    await db.$queryRaw`SELECT id FROM Issue WHERE id = ${issueId} FOR UPDATE`;
  const member = await membership(db, issue.mandalId, userId);
  // Re-read after the lock: another resolver/archive may have committed while waiting.
  const current = lock
    ? await db.issue.findFirst({ where: { id: issueId, ...scope(userId) } })
    : issue;
  if (!current) fail(404, "NOT_FOUND", "Resource not found");
  return { issue: current, member };
}
function permissions(issue, member, approver = false) {
  const admin = isAdmin(member),
    pending = issue.status === "PENDING";
  return {
    canEdit: pending && (admin || issue.createdByUserId === member.userId),
    canResolve: pending && (admin || approver),
    canDelete: admin,
    canComment: true,
    canSupport: true,
    canDesignateApprovers: admin,
  };
}
async function selected(db, mandalId, values, member, allowResolver = false) {
  const ids = values.map((p) => p.memberId);
  const rows = await db.mandalMember.findMany({
    where: { id: { in: ids }, mandalId, isActive: true, userId: { not: null } },
    include: { user: { select: { id: true, name: true, profileImage: true } } },
  });
  if (rows.length !== ids.length)
    invalid(
      "participants",
      "All selected members must be active in this Mandal",
    );
  if (
    !allowResolver &&
    values.some((p) => p.role === "APPROVER") &&
    !isAdmin(member)
  )
    fail(
      403,
      "FORBIDDEN",
      "Only Mandal administrators may designate approvers",
    );
  return rows;
}
module.exports = {
  active,
  scope,
  isAdmin,
  membership,
  issueAccess,
  permissions,
  selected,
};
