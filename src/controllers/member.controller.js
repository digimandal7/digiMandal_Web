const prisma = require("../config/prisma");
const { requireMandalPermission, hasMandalPermission } = require("../services/mandal-access.service");

/* ==================== ADD MEMBER (via invitation acceptance) ==================== */
exports.addMember = async (req, res, next) => {
  try {
    const { mandalId, userId, role = "Member", roleId } = req.body;

    if (!mandalId || !userId) {
      throw { status: 400, message: "mandalId and userId are required" };
    }

    const mandal = await prisma.mandal.findUnique({
      where: { id: Number(mandalId) },
    });

    if (!mandal) throw { status: 404, message: "Mandal not found" };

    const access = await requireMandalPermission(Number(mandalId), req.user.userId, "MANAGE_MEMBERS");
    const selectedRole = roleId
      ? await prisma.mandalRole.findUnique({ where: { id: Number(roleId) } })
      : await prisma.mandalRole.findUnique({ where: { mandalId_name: { mandalId: Number(mandalId), name: role } } });
    if (!selectedRole || selectedRole.mandalId !== Number(mandalId)) throw { status: 400, code: "INVALID_MANDAL_ROLE", message: "Select a valid Mandal role" };
    if ((selectedRole.permissions.includes("*") || selectedRole.permissions.includes("MANAGE_ROLES")) && !hasMandalPermission(access, "MANAGE_ROLES")) throw { status: 403, code: "CANNOT_GRANT_PRIVILEGED_ROLE", message: "Only a Mandal Admin can grant this role" };

    // Validate user exists
    const user = await prisma.user.findUnique({
      where: { id: Number(userId) },
    });

    if (!user) throw { status: 404, message: "User not found" };

    // Check if already a member
    const existingMember = await prisma.mandalMember.findFirst({
      where: { mandalId: Number(mandalId), userId: Number(userId) },
    });

    if (existingMember) {
      throw { status: 400, message: "User is already a member of this mandal" };
    }

    const member = await prisma.mandalMember.create({
      data: {
        mandalId: Number(mandalId),
        userId: Number(userId),
        role: selectedRole.name,
        roleId: selectedRole.id,
        mobile: user.mobile,
      },
      include: { user: { select: { id: true, mobile: true } } },
    });

    res.status(201).json({
      success: true,
      message: "Member added successfully",
      data: member,
    });
  } catch (error) {
    next(error);
  }
};

/* ==================== GET MEMBERS ==================== */
exports.getMembers = async (req, res, next) => {
  try {
    const mandalId = Number(req.params.mandalId);

    const mandal = await prisma.mandal.findUnique({
      where: { id: mandalId },
    });

    if (!mandal) throw { status: 404, message: "Mandal not found" };

    await requireMandalPermission(mandalId, req.user.userId, "VIEW_MEMBERS");

    const members = await prisma.mandalMember.findMany({
      where: { mandalId },
      include: { user: { select: { id: true, mobile: true, name: true } }, roleRef: true },
      orderBy: { joinedAt: "asc" },
    });

    res.json({
      success: true,
      count: members.length,
      data: members,
    });
  } catch (error) {
    next(error);
  }
};

/* ==================== GET MEMBER DETAILS ==================== */
exports.getMemberDetails = async (req, res, next) => {
  try {
    const memberId = Number(req.params.id);

    const member = await prisma.mandalMember.findUnique({
      where: { id: memberId },
      include: {
        user: { select: { id: true, mobile: true } },
        mandal: { select: { id: true, name: true, createdById: true } },
      },
    });

    if (!member) throw { status: 404, message: "Member not found" };

    await requireMandalPermission(member.mandalId, req.user.userId, "VIEW_MEMBERS");

    res.json({ success: true, data: member });
  } catch (error) {
    next(error);
  }
};

/* ==================== UPDATE MEMBER ROLE ==================== */
exports.updateMemberRole = async (req, res, next) => {
  try {
    const memberId = Number(req.params.id);
    const { role, roleId } = req.body;

    if (!role && !roleId) throw { status: 400, message: "roleId or role is required" };

    const member = await prisma.mandalMember.findUnique({
      where: { id: memberId },
      include: { mandal: true },
    });

    if (!member) throw { status: 404, message: "Member not found" };

    const access = await requireMandalPermission(member.mandalId, req.user.userId, "MANAGE_MEMBERS");
    const selectedRole = roleId
      ? await prisma.mandalRole.findUnique({ where: { id: Number(roleId) } })
      : await prisma.mandalRole.findUnique({ where: { mandalId_name: { mandalId: member.mandalId, name: role } } });
    if (!selectedRole || selectedRole.mandalId !== member.mandalId) throw { status: 400, code: "INVALID_MANDAL_ROLE", message: "Select a valid Mandal role" };
    if ((selectedRole.permissions.includes("*") || selectedRole.permissions.includes("MANAGE_ROLES")) && !hasMandalPermission(access, "MANAGE_ROLES")) throw { status: 403, code: "CANNOT_GRANT_PRIVILEGED_ROLE", message: "Only a Mandal Admin can grant this role" };
    if (member.userId === member.mandal.createdById && selectedRole.name !== "Admin") throw { status: 400, code: "CREATOR_MUST_BE_ADMIN", message: "The Mandal creator must remain an Admin" };

    const updated = await prisma.mandalMember.update({
      where: { id: memberId },
      data: { role: selectedRole.name, roleId: selectedRole.id },
      include: { user: { select: { id: true, mobile: true } }, roleRef: true },
    });

    res.json({ success: true, data: updated });
  } catch (error) {
    next(error);
  }
};

/* ==================== DELETE MEMBER ==================== */
exports.deleteMember = async (req, res, next) => {
  try {
    const memberId = Number(req.params.id);

    const member = await prisma.mandalMember.findUnique({
      where: { id: memberId },
      include: { mandal: true },
    });

    if (!member) throw { status: 404, message: "Member not found" };

    await requireMandalPermission(member.mandalId, req.user.userId, "MANAGE_MEMBERS");
    if (member.userId === member.mandal.createdById) throw { status: 400, code: "CANNOT_REMOVE_CREATOR", message: "The Mandal creator cannot be removed" };

    await prisma.mandalMember.delete({ where: { id: memberId } });

    res.json({
      success: true,
      message: "Member removed successfully",
    });
  } catch (error) {
    next(error);
  }
};

/* ==================== CHECK MEMBER STATUS ==================== */
exports.checkMemberStatus = async (req, res, next) => {
  try {
    const mandalId = Number(req.params.mandalId);

    const member = await prisma.mandalMember.findFirst({
      where: { mandalId, userId: req.user.userId },
    });

    res.json({
      success: true,
      isMember: !!member,
      data: member || null,
    });
  } catch (error) {
    next(error);
  }
};

/* ==================== LEAVE MANDAL ==================== */
exports.leaveMandal = async (req, res, next) => {
  try {
    const mandalId = Number(req.params.mandalId);

    const member = await prisma.mandalMember.findFirst({
      where: { mandalId, userId: req.user.userId },
    });

    if (!member)
      throw { status: 404, message: "You are not a member of this mandal" };

    await prisma.mandalMember.delete({ where: { id: member.id } });

    res.json({
      success: true,
      message: "You have left the mandal successfully",
    });
  } catch (error) {
    next(error);
  }
};
