const prisma = require("../config/prisma");

/* ==================== CREATE MANDAL ==================== */
exports.createMandal = async (req, res, next) => {
  try {
    const { name, category, size, formationYear, isPrivate } = req.body;
    if (!name || !category)
      throw { status: 400, message: "Name and category required" };

    const mandal = await prisma.mandal.create({
      data: {
        name,
        category,
        size: size || "Medium",
        formationYear: formationYear || new Date().getFullYear(),
        isPrivate: isPrivate || false,
        status: "DRAFT",
        createdById: req.user.userId,
      },
    });

    res.status(201).json({ success: true, data: mandal });
  } catch (e) {
    next(e);
  }
};

/* ==================== GET MANDAL ==================== */
exports.getMandal = async (req, res, next) => {
  try {
    const mandalId = Number(req.params.id);
    const mandal = await prisma.mandal.findUnique({
      where: { id: mandalId },
      include: {
        createdBy: { select: { id: true, mobile: true } },
        members: { include: { user: { select: { id: true, mobile: true } } } },
        invites: true,
        address: true,
        registration: true,
        bank: true,
        documents: true,
      },
    });

    if (!mandal) throw { status: 404, message: "Mandal not found" };

    const canView = mandal.createdById === req.user.userId || mandal.members.some((member) => member.userId === req.user.userId);
    if (!canView) throw { status: 403, code: "FORBIDDEN", message: "Not authorized to view this mandal" };

    // Count accepted invitations
    const acceptedCount = mandal.invites.filter(
      (inv) => inv.status === "ACCEPTED",
    ).length;

    res.json({
      success: true,
      data: {
        ...mandal,
        acceptedInvitationsCount: acceptedCount,
        invitationTargetCount: 5,
        isActive: mandal.status === "ACTIVE",
      },
    });
  } catch (e) {
    next(e);
  }
};

/* ==================== GET ALL MANDALS (USER'S MANDALS) ==================== */
exports.getUserMandals = async (req, res, next) => {
  try {
    const mandals = await prisma.mandal.findMany({
      where: { createdById: req.user.userId },
      include: {
        members: true,
        invites: true,
        _count: { select: { members: true, invites: true } },
      },
      orderBy: { createdAt: "desc" },
    });

    const mandalsWithStatus = mandals.map((mandal) => ({
      ...mandal,
      acceptedInvitationsCount: mandal.invites.filter(
        (inv) => inv.status === "ACCEPTED",
      ).length,
      invitationTargetCount: 5,
      isActive: mandal.status === "ACTIVE",
    }));

    res.json({
      success: true,
      count: mandalsWithStatus.length,
      data: mandalsWithStatus,
    });
  } catch (e) {
    next(e);
  }
};

/* ==================== GET MANDALS WHERE USER IS MEMBER ==================== */
exports.getMemberMandals = async (req, res, next) => {
  try {
    const memberships = await prisma.mandalMember.findMany({
      where: { userId: req.user.userId },
      include: {
        mandal: {
          include: {
            createdBy: { select: { id: true, mobile: true } },
            members: {
              include: { user: { select: { id: true, mobile: true } } },
            },
            invites: true,
          },
        },
      },
    });

    const mandals = memberships.map((membership) => ({
      ...membership.mandal,
      acceptedInvitationsCount: membership.mandal.invites.filter(
        (inv) => inv.status === "ACCEPTED",
      ).length,
      invitationTargetCount: 5,
      isActive: membership.mandal.status === "ACTIVE",
      userRole: membership.role,
    }));

    res.json({ success: true, count: mandals.length, data: mandals });
  } catch (e) {
    next(e);
  }
};

/* ==================== UPDATE MANDAL ==================== */
exports.updateMandal = async (req, res, next) => {
  try {
    const mandalId = Number(req.params.id);
    const { name, category, size, formationYear, isPrivate } = req.body;

    const mandal = await prisma.mandal.findUnique({ where: { id: mandalId } });
    if (!mandal) throw { status: 404, message: "Mandal not found" };

    if (mandal.createdById !== req.user.userId) {
      throw { status: 403, message: "Not authorized" };
    }

    const updated = await prisma.mandal.update({
      where: { id: mandalId },
      data: {
        ...(name && { name }),
        ...(category && { category }),
        ...(size && { size }),
        ...(formationYear && { formationYear }),
        ...(isPrivate !== undefined && { isPrivate }),
      },
      include: { members: true, invites: true },
    });

    res.json({ success: true, data: updated });
  } catch (e) {
    next(e);
  }
};

/* ==================== DELETE MANDAL ==================== */
exports.deleteMandal = async (req, res, next) => {
  try {
    const mandalId = Number(req.params.id);

    const mandal = await prisma.mandal.findUnique({ where: { id: mandalId } });
    if (!mandal) throw { status: 404, message: "Mandal not found" };

    if (mandal.createdById !== req.user.userId) {
      throw { status: 403, message: "Not authorized" };
    }

    await prisma.mandal.delete({ where: { id: mandalId } });

    res.json({ success: true, message: "Mandal deleted successfully" });
  } catch (e) {
    next(e);
  }
};

/* ==================== ADD MANDAL ADDRESS ==================== */
exports.addAddress = async (req, res, next) => {
  try {
    const mandalId = Number(req.params.id);
    const {
      addressLine1,
      addressLine2,
      city,
      state,
      pincode,
      latitude,
      longitude,
    } = req.body;

    if (!addressLine1 || !city || !state || !pincode) {
      throw { status: 400, message: "Required fields missing" };
    }

    const mandal = await prisma.mandal.findUnique({ where: { id: mandalId } });
    if (!mandal) throw { status: 404, message: "Mandal not found" };

    if (mandal.createdById !== req.user.userId) {
      throw { status: 403, message: "Not authorized" };
    }

    let address = await prisma.mandalAddress.findUnique({
      where: { mandalId },
    });

    if (address) {
      address = await prisma.mandalAddress.update({
        where: { mandalId },
        data: {
          addressLine1,
          addressLine2,
          city,
          state,
          pincode,
          latitude,
          longitude,
        },
      });
    } else {
      address = await prisma.mandalAddress.create({
        data: {
          mandalId,
          addressLine1,
          addressLine2,
          city,
          state,
          pincode,
          latitude,
          longitude,
        },
      });
    }

    res.json({ success: true, data: address });
  } catch (e) {
    next(e);
  }
};

/* ==================== ADD BANK DETAILS ==================== */
exports.addBankDetails = async (req, res, next) => {
  try {
    const mandalId = Number(req.params.id);
    const { bankName, accountName, accountNumber, ifscCode } = req.body;

    if (!bankName || !accountName || !accountNumber || !ifscCode) {
      throw { status: 400, message: "All bank details required" };
    }

    const mandal = await prisma.mandal.findUnique({ where: { id: mandalId } });
    if (!mandal) throw { status: 404, message: "Mandal not found" };

    if (mandal.createdById !== req.user.userId) {
      throw { status: 403, message: "Not authorized" };
    }

    let bank = await prisma.mandalBank.findUnique({ where: { mandalId } });

    if (bank) {
      bank = await prisma.mandalBank.update({
        where: { mandalId },
        data: { bankName, accountName, accountNumber, ifscCode },
      });
    } else {
      bank = await prisma.mandalBank.create({
        data: { mandalId, bankName, accountName, accountNumber, ifscCode },
      });
    }

    res.json({ success: true, data: bank });
  } catch (e) {
    next(e);
  }
};

/* ==================== ADD REGISTRATION DETAILS ==================== */
exports.addRegistration = async (req, res, next) => {
  try {
    const mandalId = Number(req.params.id);
    const { panNumber, registrationDate, organizationAddress } = req.body;

    if (!panNumber || !registrationDate || !organizationAddress) {
      throw {
        status: 400,
        message:
          "PAN number, registration date, and organization address are required",
      };
    }

    const mandal = await prisma.mandal.findUnique({ where: { id: mandalId } });
    if (!mandal) throw { status: 404, message: "Mandal not found" };

    if (mandal.createdById !== req.user.userId) {
      throw { status: 403, message: "Not authorized" };
    }

    let registration = await prisma.mandalRegistration.findUnique({
      where: { mandalId },
    });

    if (registration) {
      registration = await prisma.mandalRegistration.update({
        where: { mandalId },
        data: {
          panNumber,
          registrationDate: new Date(registrationDate),
          organizationAddress,
        },
      });
    } else {
      registration = await prisma.mandalRegistration.create({
        data: {
          mandalId,
          panNumber,
          registrationDate: new Date(registrationDate),
          organizationAddress,
        },
      });
    }

    res.json({ success: true, data: registration });
  } catch (e) {
    next(e);
  }
};
