const prisma = require("../config/prisma");
const { MANDAL_PERMISSIONS } = require("../config/mandal-permissions");
const { requireMandalPermission, hasMandalPermission } = require("../services/mandal-access.service");

function validatePermissions(permissions) {
  if (!Array.isArray(permissions)) throw { status: 400, code: "INVALID_PERMISSIONS", message: "permissions must be an array" };
  const normalized = [...new Set(permissions)];
  const invalid = normalized.filter((permission) => !MANDAL_PERMISSIONS.includes(permission));
  if (invalid.length) throw { status: 400, code: "INVALID_PERMISSIONS", message: "One or more permissions are invalid", details: { invalid } };
  return normalized;
}

exports.listPermissions = (req, res) => res.json({ success: true, data: MANDAL_PERMISSIONS });

exports.listRoles = async (req, res, next) => {
  try {
    const mandalId = Number(req.params.mandalId);
    await requireMandalPermission(mandalId, req.user.userId, "VIEW_MEMBERS");
    const data = await prisma.mandalRole.findMany({ where: { mandalId }, include: { _count: { select: { members: true, invitations: true } } }, orderBy: [{ isSystem: "desc" }, { name: "asc" }] });
    res.json({ success: true, data });
  } catch (error) { next(error); }
};

exports.createRole = async (req, res, next) => {
  try {
    const mandalId = Number(req.params.mandalId);
    await requireMandalPermission(mandalId, req.user.userId, "MANAGE_ROLES");
    const { name, description, permissions } = req.body;
    if (!name?.trim() || name.trim().length > 100) throw { status: 400, code: "INVALID_ROLE_NAME", message: "A role name up to 100 characters is required" };
    const data = await prisma.mandalRole.create({ data: { mandalId, name: name.trim(), description: description?.trim() || null, permissions: validatePermissions(permissions), isSystem: false } });
    res.status(201).json({ success: true, message: "Custom role created", data });
  } catch (error) {
    if (error.code === "P2002") next({ status: 409, code: "ROLE_ALREADY_EXISTS", message: "A role with this name already exists" });
    else next(error);
  }
};

exports.updateRole = async (req, res, next) => {
  try {
    const mandalId = Number(req.params.mandalId);
    const roleId = Number(req.params.roleId);
    await requireMandalPermission(mandalId, req.user.userId, "MANAGE_ROLES");
    const role = await prisma.mandalRole.findUnique({ where: { id: roleId } });
    if (!role || role.mandalId !== mandalId) throw { status: 404, code: "ROLE_NOT_FOUND", message: "Role not found" };
    const data = {};
    if (req.body.name !== undefined) {
      if (role.isSystem) throw { status: 400, code: "SYSTEM_ROLE_NAME_LOCKED", message: "Default role names cannot be changed" };
      if (!req.body.name?.trim()) throw { status: 400, code: "INVALID_ROLE_NAME", message: "Role name cannot be empty" };
      data.name = req.body.name.trim();
    }
    if (req.body.description !== undefined) data.description = req.body.description?.trim() || null;
    if (req.body.permissions !== undefined) {
      if (role.name === "Admin") throw { status: 400, code: "ADMIN_PERMISSIONS_LOCKED", message: "Admin always has full access" };
      data.permissions = validatePermissions(req.body.permissions);
    }
    const updated = await prisma.mandalRole.update({ where: { id: roleId }, data });
    res.json({ success: true, message: "Role updated", data: updated });
  } catch (error) { next(error); }
};

exports.deleteRole = async (req, res, next) => {
  try {
    const mandalId = Number(req.params.mandalId);
    const roleId = Number(req.params.roleId);
    await requireMandalPermission(mandalId, req.user.userId, "MANAGE_ROLES");
    const role = await prisma.mandalRole.findUnique({ where: { id: roleId }, include: { _count: { select: { members: true, invitations: true } } } });
    if (!role || role.mandalId !== mandalId) throw { status: 404, code: "ROLE_NOT_FOUND", message: "Role not found" };
    if (role.isSystem) throw { status: 400, code: "SYSTEM_ROLE_LOCKED", message: "Default roles cannot be deleted" };
    if (role._count.members || role._count.invitations) throw { status: 409, code: "ROLE_IN_USE", message: "Reassign members and invitations before deleting this role" };
    await prisma.mandalRole.delete({ where: { id: roleId } });
    res.json({ success: true, message: "Role deleted" });
  } catch (error) { next(error); }
};

exports.assignMemberRole = async (req, res, next) => {
  try {
    const mandalId = Number(req.params.mandalId);
    const memberId = Number(req.params.memberId);
    const roleId = Number(req.body.roleId);
    const access = await requireMandalPermission(mandalId, req.user.userId, "MANAGE_MEMBERS");
    const [member, role, mandal] = await Promise.all([
      prisma.mandalMember.findUnique({ where: { id: memberId } }),
      prisma.mandalRole.findUnique({ where: { id: roleId } }),
      prisma.mandal.findUnique({ where: { id: mandalId } }),
    ]);
    if (!member || member.mandalId !== mandalId) throw { status: 404, code: "MEMBER_NOT_FOUND", message: "Member not found" };
    if (!role || role.mandalId !== mandalId) throw { status: 404, code: "ROLE_NOT_FOUND", message: "Role not found" };
    if ((role.permissions.includes("*") || role.permissions.includes("MANAGE_ROLES")) && !hasMandalPermission(access, "MANAGE_ROLES")) throw { status: 403, code: "CANNOT_GRANT_PRIVILEGED_ROLE", message: "Only a Mandal Admin can grant this role" };
    if (member.userId === mandal.createdById && role.name !== "Admin") throw { status: 400, code: "CREATOR_MUST_BE_ADMIN", message: "The Mandal creator must remain an Admin" };
    const data = await prisma.mandalMember.update({ where: { id: memberId }, data: { roleId, role: role.name }, include: { roleRef: true } });
    res.json({ success: true, message: "Member role updated", data });
  } catch (error) { next(error); }
};
