const prisma = require("../config/prisma");

/* ==================== ADD MEMBER (via invitation acceptance) ==================== */
exports.addMember = async (req, res, next) => {
  try {
    const { mandalId, userId, role } = req.body;

    if (!mandalId || !userId || !role) {
      throw { status: 400, message: "mandalId, userId, and role required" };
    }

    const mandal = await prisma.mandal.findUnique({
      where: { id: Number(mandalId) },
    });

    if (!mandal) throw { status: 404, message: "Mandal not found" };

    if (mandal.createdById !== req.user.userId) {
      throw { status: 403, message: "Not authorized to add members" };
    }

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
        role,
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

    const requesterMembership = await prisma.mandalMember.findFirst({ where: { mandalId, userId: req.user.userId } });
    if (mandal.createdById !== req.user.userId && !requesterMembership) {
      throw { status: 403, code: "FORBIDDEN", message: "Not authorized to view members" };
    }

    const members = await prisma.mandalMember.findMany({
      where: { mandalId },
      include: { user: { select: { id: true, mobile: true } } },
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

    const requesterMembership = await prisma.mandalMember.findFirst({ where: { mandalId: member.mandalId, userId: req.user.userId } });
    if (member.mandal.createdById !== req.user.userId && !requesterMembership) {
      throw { status: 403, code: "FORBIDDEN", message: "Not authorized to view this member" };
    }

    res.json({ success: true, data: member });
  } catch (error) {
    next(error);
  }
};

/* ==================== UPDATE MEMBER ROLE ==================== */
exports.updateMemberRole = async (req, res, next) => {
  try {
    const memberId = Number(req.params.id);
    const { role } = req.body;

    if (!role) throw { status: 400, message: "Role required" };

    const member = await prisma.mandalMember.findUnique({
      where: { id: memberId },
      include: { mandal: true },
    });

    if (!member) throw { status: 404, message: "Member not found" };

    if (member.mandal.createdById !== req.user.userId) {
      throw { status: 403, message: "Not authorized" };
    }

    const updated = await prisma.mandalMember.update({
      where: { id: memberId },
      data: { role },
      include: { user: { select: { id: true, mobile: true } } },
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

    if (member.mandal.createdById !== req.user.userId) {
      throw { status: 403, message: "Not authorized" };
    }

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
