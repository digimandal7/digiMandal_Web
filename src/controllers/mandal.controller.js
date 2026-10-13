const prisma = require("../config/prisma");

/* ==================== CREATE MANDAL ==================== */
exports.createMandal = async (req, res, next) => {
  try {
    const {
      name,
      category,
      categoryCode,
      size,
      sizeCode,
      formationYear,
      isPrivate,
      isRegistered,
    } = req.body;

    const resolvedCategory = categoryCode || category;
    const resolvedSize = sizeCode || size;

    if (!name || !resolvedCategory) {
      throw { status: 400, message: "Name and category required" };
    }

    const year = Number(formationYear);
    if (!formationYear || Number.isNaN(year)) {
      throw { status: 400, message: "Formation year required" };
    }

    const mandal = await prisma.mandal.create({
      data: {
        name: String(name).trim(),
        category: resolvedCategory,
        size: resolvedSize || "Medium",
        formationYear: year,
        isPrivate: Boolean(isPrivate),
        isRegistered: Boolean(isRegistered),
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
      placeId,
      formattedAddress,
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
          latitude: latitude ?? null,
          longitude: longitude ?? null,
          placeId: placeId ?? null,
          formattedAddress: formattedAddress ?? null,
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
          latitude: latitude ?? null,
          longitude: longitude ?? null,
          placeId: placeId ?? null,
          formattedAddress: formattedAddress ?? null,
        },
      });
    }

    res.json({ success: true, data: address });
  } catch (e) {
    next(e);
  }
};

/* ==================== ADD BANK DETAILS ==================== */
const BANK_CODE_NAMES = {
  SBI: "State Bank of India",
  HDFC: "HDFC Bank",
  ICICI: "ICICI Bank",
  AXIS: "Axis Bank",
  BOB: "Bank of Baroda",
  PNB: "Punjab National Bank",
};

exports.addBankDetails = async (req, res, next) => {
  try {
    const mandalId = Number(req.params.id);
    const {
      bankName,
      bankCode,
      accountName,
      accountNumber,
      confirmAccountNumber,
      ifscCode,
    } = req.body;

    const resolvedBankName = bankCode
      ? BANK_CODE_NAMES[bankCode] || bankCode
      : bankName;

    if (!resolvedBankName || !accountName || !accountNumber || !ifscCode) {
      throw { status: 400, message: "All bank details required" };
    }

    if (
      confirmAccountNumber != null &&
      String(confirmAccountNumber) !== String(accountNumber)
    ) {
      throw { status: 400, message: "Account numbers do not match" };
    }

    const mandal = await prisma.mandal.findUnique({ where: { id: mandalId } });
    if (!mandal) throw { status: 404, message: "Mandal not found" };

    if (mandal.createdById !== req.user.userId) {
      throw { status: 403, message: "Not authorized" };
    }

    let bank = await prisma.mandalBank.findUnique({ where: { mandalId } });
    const data = {
      bankName: resolvedBankName,
      accountName: String(accountName).trim(),
      accountNumber: String(accountNumber).trim(),
      ifscCode: String(ifscCode).trim().toUpperCase(),
    };

    if (bank) {
      bank = await prisma.mandalBank.update({
        where: { mandalId },
        data,
      });
    } else {
      bank = await prisma.mandalBank.create({
        data: { mandalId, ...data },
      });
    }

    res.json({
      success: true,
      data: {
        ...bank,
        bankCode: bankCode || null,
      },
    });
  } catch (e) {
    next(e);
  }
};

exports.skipBankDetails = async (req, res, next) => {
  try {
    const mandalId = Number(req.params.id);
    const mandal = await prisma.mandal.findUnique({ where: { id: mandalId } });

    if (!mandal) throw { status: 404, message: "Mandal not found" };

    if (mandal.createdById !== req.user.userId) {
      throw { status: 403, message: "Not authorized" };
    }

    res.json({ success: true, message: "Bank details skipped" });
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

const onboardingLocation = (address) => {
  if (!address) return "";
  if (address.addressLine2 && address.city) {
    return `${address.addressLine2}, ${address.city}`;
  }
  return [address.city, address.state].filter(Boolean).join(", ");
};

exports.getOnboardingStatus = async (req, res, next) => {
  try {
    const mandalId = Number(req.params.id);
    const mandal = await prisma.mandal.findUnique({
      where: { id: mandalId },
      include: {
        address: true,
        registration: true,
        bank: true,
        _count: { select: { invites: true, documents: true } },
      },
    });

    if (!mandal) throw { status: 404, message: "Mandal not found" };
    if (mandal.createdById !== req.user.userId) {
      throw { status: 403, message: "Not authorized" };
    }

    const steps = {
      details: Boolean(mandal.name),
      address: Boolean(mandal.address),
      invitations: mandal._count.invites >= 5,
      registration: !mandal.isRegistered || Boolean(mandal.registration),
      documents: !mandal.isRegistered || mandal._count.documents >= 2,
      bankDetails: Boolean(mandal.bank),
    };

    res.json({
      success: true,
      data: {
        id: mandal.id,
        name: mandal.name,
        location: onboardingLocation(mandal.address),
        status: mandal.status,
        steps,
        isComplete: Object.values(steps).every(Boolean),
      },
    });
  } catch (e) {
    next(e);
  }
};
