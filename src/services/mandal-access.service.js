const prisma = require("../config/prisma");

async function getMandalAccess(mandalId, userId) {
  const id = Number(mandalId);
  const mandal = await prisma.mandal.findUnique({ where: { id } });
  if (!mandal) throw { status: 404, code: "MANDAL_NOT_FOUND", message: "Mandal not found" };
  if (mandal.createdById === userId) return { mandal, isCreator: true, role: "Admin", permissions: ["*"] };
  const membership = await prisma.mandalMember.findUnique({
    where: { mandalId_userId: { mandalId: id, userId } },
    include: { roleRef: true },
  });
  if (!membership) return { mandal, isCreator: false, role: null, permissions: [] };
  return { mandal, isCreator: false, membership, role: membership.roleRef?.name || membership.role, permissions: membership.roleRef?.permissions || [] };
}

async function requireMandalPermission(mandalId, userId, permission) {
  const access = await getMandalAccess(mandalId, userId);
  if (!access.permissions.includes("*") && !access.permissions.includes(permission)) {
    throw { status: 403, code: "MANDAL_PERMISSION_DENIED", message: `Missing Mandal permission: ${permission}` };
  }
  return access;
}

function hasMandalPermission(access, permission) {
  return access.permissions.includes("*") || access.permissions.includes(permission);
}

module.exports = { getMandalAccess, requireMandalPermission, hasMandalPermission };
