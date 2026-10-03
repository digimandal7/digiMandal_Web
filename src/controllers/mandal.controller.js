const prisma = require("../config/prisma");
const { MANDAL_SIZES, MANDAL_CATEGORIES, DOCUMENT_TYPES } = require("../config/mandal-options");
const { DEFAULT_ROLES } = require("../config/mandal-permissions");
const { requireMandalPermission } = require("../services/mandal-access.service");

const apiError = (status, code, message, details) => ({ status, code, message, details });
const validPincode = (value) => /^\d{6}$/.test(value);
const validPan = (value) => /^[A-Z]{5}[0-9]{4}[A-Z]$/.test(value);
const validIfsc = (value) => /^[A-Z]{4}0[A-Z0-9]{6}$/.test(value);

async function ownedMandal(id, userId, include, permission = "EDIT_MANDAL") {
  const mandal = await prisma.mandal.findUnique({ where: { id }, include });
  if (!mandal) throw apiError(404, "MANDAL_NOT_FOUND", "Mandal not found");
  await requireMandalPermission(id, userId, permission);
  return mandal;
}

/* ==================== CREATE MANDAL ==================== */
exports.createMandal = async (req, res, next) => {
  try {
    const { name, category, size, formationYear, isPrivate, isRegistered } = req.body;
    const year = Number(formationYear);
    if (!name?.trim()) throw apiError(400, "MANDAL_NAME_REQUIRED", "Mandal name is required");
    if (!MANDAL_CATEGORIES.includes(category)) throw apiError(400, "INVALID_CATEGORY", "Select a valid Mandal category");
    if (!MANDAL_SIZES.includes(size)) throw apiError(400, "INVALID_SIZE", "Select a valid Mandal size");
    if (!Number.isInteger(year) || year < 1900 || year > new Date().getFullYear()) throw apiError(400, "INVALID_FORMATION_YEAR", "Select a valid formation year");
    if (typeof isPrivate !== "boolean" || typeof isRegistered !== "boolean") throw apiError(400, "MANDAL_TYPE_REQUIRED", "Mandal type and registration status are required");

    const duplicate = await prisma.mandal.findFirst({ where: { createdById: req.user.userId, name: name.trim() } });
    if (duplicate) throw apiError(409, "MANDAL_ALREADY_EXISTS", "You already have a Mandal with this name");

    const mandal = await prisma.$transaction(async (tx) => {
      const created = await tx.mandal.create({
        data: { name: name.trim(), category, size, formationYear: year, isPrivate, isRegistered, onboardingStep: 2, status: "DRAFT", createdById: req.user.userId },
      });
      const roles = {};
      for (const [roleName, permissions] of Object.entries(DEFAULT_ROLES)) {
        roles[roleName] = await tx.mandalRole.create({
          data: { mandalId: created.id, name: roleName, description: roleName === "Admin" ? "Full Mandal access" : `${roleName} role`, permissions, isSystem: true },
        });
      }
      await tx.mandalMember.create({
        data: { mandalId: created.id, userId: req.user.userId, mobile: req.user.mobile, role: "Admin", roleId: roles.Admin.id },
      });
      return tx.mandal.findUnique({ where: { id: created.id }, include: { roles: true, members: { include: { roleRef: true } } } });
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
        roles: true,
      },
    });

    if (!mandal) throw { status: 404, message: "Mandal not found" };

    await requireMandalPermission(mandalId, req.user.userId, "VIEW_MANDAL");

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
    const { name, category, size, formationYear, isPrivate, isRegistered } = req.body;

    const mandal = await prisma.mandal.findUnique({ where: { id: mandalId } });
    if (!mandal) throw { status: 404, message: "Mandal not found" };

    await requireMandalPermission(mandalId, req.user.userId, "EDIT_MANDAL");

    if (name !== undefined && !name.trim()) throw apiError(400, "INVALID_NAME", "Mandal name cannot be empty");
    if (category !== undefined && !MANDAL_CATEGORIES.includes(category)) throw apiError(400, "INVALID_CATEGORY", "Select a valid Mandal category");
    if (size !== undefined && !MANDAL_SIZES.includes(size)) throw apiError(400, "INVALID_SIZE", "Select a valid Mandal size");
    if (formationYear !== undefined && (!Number.isInteger(Number(formationYear)) || Number(formationYear) < 1900 || Number(formationYear) > new Date().getFullYear())) throw apiError(400, "INVALID_FORMATION_YEAR", "Select a valid formation year");
    const updated = await prisma.mandal.update({
      where: { id: mandalId },
      data: {
        ...(name !== undefined && { name: name.trim() }),
        ...(category !== undefined && { category }),
        ...(size !== undefined && { size }),
        ...(formationYear !== undefined && { formationYear: Number(formationYear) }),
        ...(isPrivate !== undefined && { isPrivate }),
        ...(isRegistered !== undefined && { isRegistered }),
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

    await requireMandalPermission(mandalId, req.user.userId, "DELETE_MANDAL");

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

    if (!addressLine1?.trim() || !addressLine2?.trim() || !city?.trim() || !state?.trim() || !validPincode(pincode)) throw apiError(400, "INVALID_ADDRESS", "Street address, landmark, city, state and a valid 6-digit PIN code are required");
    if (latitude !== undefined && (Number(latitude) < -90 || Number(latitude) > 90)) throw apiError(400, "INVALID_LATITUDE", "Latitude must be between -90 and 90");
    if (longitude !== undefined && (Number(longitude) < -180 || Number(longitude) > 180)) throw apiError(400, "INVALID_LONGITUDE", "Longitude must be between -180 and 180");

    const mandal = await prisma.mandal.findUnique({ where: { id: mandalId } });
    if (!mandal) throw { status: 404, message: "Mandal not found" };

    await requireMandalPermission(mandalId, req.user.userId, "EDIT_MANDAL");

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
          placeId,
          formattedAddress,
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
          placeId,
          formattedAddress,
        },
      });
    }

    await prisma.mandal.update({ where: { id: mandalId }, data: { onboardingStep: { set: Math.max(mandal.onboardingStep, 3) } } });
    res.json({ success: true, data: address, onboardingStep: Math.max(mandal.onboardingStep, 3) });
  } catch (e) {
    next(e);
  }
};

/* ==================== ADD BANK DETAILS ==================== */
exports.addBankDetails = async (req, res, next) => {
  try {
    const mandalId = Number(req.params.id);
    const { bankName, accountName, accountNumber, confirmAccountNumber, ifscCode } = req.body;

    if (!bankName?.trim() || !accountName?.trim() || !/^\d{6,20}$/.test(accountNumber || "") || !validIfsc((ifscCode || "").toUpperCase())) throw apiError(400, "INVALID_BANK_DETAILS", "Valid bank name, account name, account number and IFSC code are required");
    if (confirmAccountNumber !== accountNumber) throw apiError(400, "ACCOUNT_NUMBERS_DO_NOT_MATCH", "Account numbers do not match");

    const mandal = await prisma.mandal.findUnique({ where: { id: mandalId } });
    if (!mandal) throw { status: 404, message: "Mandal not found" };

    await requireMandalPermission(mandalId, req.user.userId, "MANAGE_BANK");

    let bank = await prisma.mandalBank.findUnique({ where: { mandalId } });

    if (bank) {
      bank = await prisma.mandalBank.update({
        where: { mandalId },
        data: { bankName: bankName.trim(), accountName: accountName.trim(), accountNumber, ifscCode: ifscCode.toUpperCase() },
      });
    } else {
      bank = await prisma.mandalBank.create({
        data: { mandalId, bankName: bankName.trim(), accountName: accountName.trim(), accountNumber, ifscCode: ifscCode.toUpperCase() },
      });
    }

    await prisma.mandal.update({ where: { id: mandalId }, data: { bankDetailsSkipped: false } });
    res.json({ success: true, data: { ...bank, accountNumber: `****${bank.accountNumber.slice(-4)}` } });
  } catch (e) {
    next(e);
  }
};

/* ==================== ADD REGISTRATION DETAILS ==================== */
exports.addRegistration = async (req, res, next) => {
  try {
    const mandalId = Number(req.params.id);
    const { panNumber, registrationDate, organizationAddress } = req.body;

    const parsedDate = new Date(registrationDate);
    if (!validPan((panNumber || "").toUpperCase()) || Number.isNaN(parsedDate.getTime()) || parsedDate > new Date() || !organizationAddress?.trim()) {
      throw {
        status: 400,
        code: "INVALID_REGISTRATION_DETAILS",
        message: "Valid PAN, non-future registration date and organization address are required",
      };
    }

    const mandal = await prisma.mandal.findUnique({ where: { id: mandalId } });
    if (!mandal) throw { status: 404, message: "Mandal not found" };

    await requireMandalPermission(mandalId, req.user.userId, "EDIT_MANDAL");

    let registration = await prisma.mandalRegistration.findUnique({
      where: { mandalId },
    });

    if (registration) {
      registration = await prisma.mandalRegistration.update({
        where: { mandalId },
        data: {
          panNumber: panNumber.toUpperCase(),
          registrationDate: parsedDate,
          organizationAddress: organizationAddress.trim(),
        },
      });
    } else {
      registration = await prisma.mandalRegistration.create({
        data: {
          mandalId,
          panNumber: panNumber.toUpperCase(),
          registrationDate: parsedDate,
          organizationAddress: organizationAddress.trim(),
        },
      });
    }

    res.json({ success: true, data: registration });
  } catch (e) {
    next(e);
  }
};

exports.skipBankDetails = async (req, res, next) => {
  try {
    const mandalId = Number(req.params.id);
    await ownedMandal(mandalId, req.user.userId, undefined, "MANAGE_BANK");
    await prisma.mandal.update({ where: { id: mandalId }, data: { bankDetailsSkipped: true } });
    res.json({ success: true, message: "Bank details skipped" });
  } catch (error) { next(error); }
};

exports.getOnboardingStatus = async (req, res, next) => {
  try {
    const mandalId = Number(req.params.id);
    const mandal = await ownedMandal(mandalId, req.user.userId, { address: true, registration: true, bank: true, invites: true, documents: true }, "VIEW_MANDAL");
    const documentTypes = new Set(mandal.documents.map((document) => document.type));
    const invitationCount = mandal.invites.filter((invite) => invite.status !== "REJECTED").length;
    const requirements = {
      details: true,
      address: !!mandal.address,
      minimumInvitations: invitationCount >= 5,
      registration: !mandal.isRegistered || !!mandal.registration,
      registrationCertificate: !mandal.isRegistered || documentTypes.has("REGISTRATION_CERTIFICATE"),
      certificate80G: !mandal.isRegistered || documentTypes.has("80G_CERTIFICATE"),
      bank: mandal.bankDetailsSkipped || (!!mandal.bank && documentTypes.has("CANCELLED_CHEQUE")),
    };
    res.json({ success: true, data: { mandalId, status: mandal.status, onboardingStep: mandal.onboardingStep, invitationCount, requirements, canFinalize: Object.values(requirements).every(Boolean) } });
  } catch (error) { next(error); }
};

exports.finalizeMandal = async (req, res, next) => {
  try {
    const mandalId = Number(req.params.id);
    const mandal = await ownedMandal(mandalId, req.user.userId, { address: true, registration: true, bank: true, invites: true, documents: true }, "SUBMIT_MANDAL");
    const missing = [];
    const types = new Set(mandal.documents.map((document) => document.type));
    if (!mandal.address) missing.push("address");
    if (mandal.invites.filter((invite) => invite.status !== "REJECTED").length < 5) missing.push("minimumFiveInvitations");
    if (mandal.isRegistered && !mandal.registration) missing.push("registrationDetails");
    if (mandal.isRegistered && !types.has("REGISTRATION_CERTIFICATE")) missing.push("registrationCertificate");
    if (mandal.isRegistered && !types.has("80G_CERTIFICATE")) missing.push("80GCertificate");
    if (!mandal.bankDetailsSkipped && !mandal.bank) missing.push("bankDetailsOrSkip");
    if (mandal.bank && !types.has("CANCELLED_CHEQUE")) missing.push("cancelledCheque");
    if (missing.length) throw apiError(400, "MANDAL_ONBOARDING_INCOMPLETE", "Complete all required Mandal steps", { missing });
    const updated = await prisma.mandal.update({ where: { id: mandalId }, data: { onboardingStep: 4, status: "ACTIVE", finalizedAt: new Date(), rejectionReason: null } });
    res.json({ success: true, message: "Mandal created successfully", data: updated });
  } catch (error) { next(error); }
};
