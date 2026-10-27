const prisma = require("../config/prisma");
const { requireMandalPermission, hasMandalPermission } = require("../services/mandal-access.service");

async function resolveRole(mandalId, roleId, roleName = "Member") {
  const role = roleId
    ? await prisma.mandalRole.findUnique({ where: { id: Number(roleId) } })
    : await prisma.mandalRole.findUnique({ where: { mandalId_name: { mandalId, name: roleName } } });
  if (!role || role.mandalId !== mandalId) throw { status: 400, code: "INVALID_MANDAL_ROLE", message: "Select a valid role for this Mandal" };
  return role;
}

const normalizeMobile = (mobile) => {
  const digits = String(mobile || "").replace(/\D/g, "");

  if (digits.length === 12 && digits.startsWith("91")) {
    return digits.slice(2);
  }

  if (digits.length === 11 && digits.startsWith("0")) {
    return digits.slice(1);
  }

  if (digits.length === 10) {
    return digits;
  }

  return null;
};

/* ==================== SEND BULK INVITATIONS ==================== */
exports.sendBulkInvitations = async (req, res, next) => {
  try {
    const mandalId = Number(req.params.mandalId);
    const members = req.body.members;

    if (!Array.isArray(members) || members.length === 0) {
      throw { status: 400, message: "Members are required" };
    }

    const mandal = await prisma.mandal.findUnique({ where: { id: mandalId } });
    if (!mandal) throw { status: 404, message: "Mandal not found" };

    if (mandal.createdById !== req.user.userId) {
      throw { status: 403, message: "Not authorized to send invitations" };
    }

    const normalized = members.map((member, index) => {
      const name = String(member?.name || "").trim();
      const mobile = normalizeMobile(member?.mobile);
      const role = String(member?.role || "Member").trim() || "Member";

      if (!name || !mobile) {
        throw {
          status: 400,
          message: `Member ${index + 1} needs a name and a valid mobile number`,
        };
      }

      return { name, mobile, role };
    });

    const invitations = await prisma.$transaction(async (tx) => {
      const saved = [];

      for (const member of normalized) {
        const existing = await tx.mandalInvitation.findUnique({
          where: { mandalId_mobile: { mandalId, mobile: member.mobile } },
        });

        if (existing?.status === "PENDING") {
          saved.push(
            await tx.mandalInvitation.update({
              where: { id: existing.id },
              data: { name: member.name, role: member.role },
            }),
          );
          continue;
        }

        if (existing) {
          saved.push(existing);
          continue;
        }

        saved.push(
          await tx.mandalInvitation.create({
            data: {
              mandalId,
              name: member.name,
              mobile: member.mobile,
              role: member.role,
            },
          }),
        );
      }

      return saved;
    });

    res.status(201).json({
      success: true,
      message: "Invitations sent successfully",
      count: invitations.length,
      data: invitations,
    });
  } catch (e) {
    next(e);
  }
};

/* ==================== SEND INVITATION ==================== */
exports.sendInvitation = async (req, res, next) => {
  try {
    const mandalId = Number(req.params.mandalId);
    const { mobile: rawMobile, role: requestedRole = "Member", roleId, contactName } = req.body;
    const mobile = normalizeMobile(rawMobile);

    if (!mobile) {
      throw { status: 400, code: "INVALID_MOBILE", message: "Valid 10-digit mobile number is required" };
    }
    if (mobile === req.user.mobile) throw { status: 400, code: "CANNOT_INVITE_SELF", message: "You cannot invite yourself" };

    const mandal = await prisma.mandal.findUnique({ where: { id: mandalId } });
    if (!mandal) throw { status: 404, message: "Mandal not found" };

    const access = await requireMandalPermission(mandalId, req.user.userId, "MANAGE_INVITATIONS");
    const role = await resolveRole(mandalId, roleId, requestedRole);
    if ((role.permissions.includes("*") || role.permissions.includes("MANAGE_ROLES")) && !hasMandalPermission(access, "MANAGE_ROLES")) throw { status: 403, code: "CANNOT_GRANT_PRIVILEGED_ROLE", message: "Only a Mandal Admin can grant this role" };

    // Check if invitation already exists
    const existingInvite = await prisma.mandalInvitation.findFirst({
      where: { mandalId, mobile },
    });

    if (existingInvite && ["PENDING", "ACCEPTED"].includes(existingInvite.status)) {
      throw { status: 400, message: "Invitation already sent to this mobile" };
    }

    const expiresAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000);
    const invitation = existingInvite
      ? await prisma.mandalInvitation.update({ where: { id: existingInvite.id }, data: { status: "PENDING", role: role.name, roleId: role.id, contactName: contactName?.trim() || null, userId: null, acceptedAt: null, expiresAt } })
      : await prisma.mandalInvitation.create({ data: { mandalId, mobile, role: role.name, roleId: role.id, contactName: contactName?.trim() || null, expiresAt } });

    const invitationCount = await prisma.mandalInvitation.count({ where: { mandalId, status: { in: ["PENDING", "ACCEPTED"] } } });
    if (invitationCount >= 5) await prisma.mandal.update({ where: { id: mandalId }, data: { status: "INVITATIONS_SENT", onboardingStep: 4 } });

    res.status(201).json({
      success: true,
      message: "Invitation sent successfully",
      data: invitation,
    });
  } catch (e) {
    next(e);
  }
};

exports.sendBulkInvitations = async (req, res, next) => {
  try {
    const mandalId = Number(req.params.mandalId);
    const members = req.body.members;
    if (!Array.isArray(members) || !members.length || members.length > 50) throw { status: 400, code: "INVALID_MEMBERS", message: "Provide between 1 and 50 members" };
    const mandal = await prisma.mandal.findUnique({ where: { id: mandalId } });
    if (!mandal) throw { status: 404, code: "MANDAL_NOT_FOUND", message: "Mandal not found" };
    const access = await requireMandalPermission(mandalId, req.user.userId, "MANAGE_INVITATIONS");

    const normalized = members.map((member, index) => ({ index, contactName: member.name?.trim() || null, mobile: normalizeMobile(member.mobile), roleName: member.designation || member.role || "Member", roleId: member.roleId }));
    const invalid = normalized.filter((member) => !member.mobile || member.mobile === req.user.mobile);
    const duplicateMobiles = normalized.filter((member, index, all) => member.mobile && all.findIndex((other) => other.mobile === member.mobile) !== index).map((member) => member.mobile);
    if (invalid.length || duplicateMobiles.length) throw { status: 400, code: "INVALID_INVITATION_BATCH", message: "Correct invalid or duplicate invitation entries", details: { invalidIndexes: invalid.map((member) => member.index), duplicateMobiles: [...new Set(duplicateMobiles)] } };

    const results = [];
    for (const member of normalized) {
      const role = await resolveRole(mandalId, member.roleId, member.roleName);
      if ((role.permissions.includes("*") || role.permissions.includes("MANAGE_ROLES")) && !hasMandalPermission(access, "MANAGE_ROLES")) throw { status: 403, code: "CANNOT_GRANT_PRIVILEGED_ROLE", message: "Only a Mandal Admin can grant this role" };
      const existing = await prisma.mandalInvitation.findUnique({ where: { mandalId_mobile: { mandalId, mobile: member.mobile } } });
      if (existing && ["PENDING", "ACCEPTED"].includes(existing.status)) {
        results.push({ mobile: member.mobile, status: "DUPLICATE", invitationId: existing.id });
        continue;
      }
      const expiresAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000);
      const invitation = existing
        ? await prisma.mandalInvitation.update({ where: { id: existing.id }, data: { status: "PENDING", contactName: member.contactName, role: role.name, roleId: role.id, expiresAt, userId: null, acceptedAt: null } })
        : await prisma.mandalInvitation.create({ data: { mandalId, mobile: member.mobile, contactName: member.contactName, role: role.name, roleId: role.id, expiresAt } });
      results.push({ mobile: member.mobile, status: "CREATED", invitationId: invitation.id });
    }
    const invitationCount = await prisma.mandalInvitation.count({ where: { mandalId, status: { in: ["PENDING", "ACCEPTED"] } } });
    if (invitationCount >= 5) await prisma.mandal.update({ where: { id: mandalId }, data: { status: "INVITATIONS_SENT", onboardingStep: 4 } });
    res.status(201).json({ success: true, message: "Invitation batch processed", data: results, stats: { invitationCount, minimumRequired: 5, canProceed: invitationCount >= 5 } });
  } catch (error) { next(error); }
};

/* ==================== GET INVITATIONS FOR MANDAL ==================== */
exports.getInvitationsForMandal = async (req, res, next) => {
  try {
    const mandalId = Number(req.params.mandalId);

    const mandal = await prisma.mandal.findUnique({ where: { id: mandalId } });
    if (!mandal) throw { status: 404, message: "Mandal not found" };

    await requireMandalPermission(mandalId, req.user.userId, "MANAGE_INVITATIONS");

    const invitations = await prisma.mandalInvitation.findMany({
      where: { mandalId },
      orderBy: { createdAt: "desc" },
    });

    const acceptedCount = invitations.filter(
      (inv) => inv.status === "ACCEPTED",
    ).length;

    res.json({
      success: true,
      data: invitations,
      stats: {
        total: invitations.length,
        pending: invitations.filter((inv) => inv.status === "PENDING").length,
        accepted: acceptedCount,
        rejected: invitations.filter((inv) => inv.status === "REJECTED").length,
        targetCount: 5,
        canActivate: acceptedCount >= 5,
      },
    });
  } catch (e) {
    next(e);
  }
};

/* ==================== GET PENDING INVITATIONS FOR USER ==================== */
exports.getPendingInvitations = async (req, res, next) => {
  try {
    const mobile = req.user.mobile;
    console.log("mobile", mobile);
    
    const invitations = await prisma.mandalInvitation.findMany({
      where: { mobile, status: "PENDING" },
      include: {
        mandal: {
          include: {
            createdBy: { select: { id: true, mobile: true } },
          },
        },
      },
      orderBy: { createdAt: "desc" },
    });

    res.json({ success: true, count: invitations.length, data: invitations });
  } catch (e) {
    next(e);
  }
};

/* ==================== ACCEPT INVITATION ==================== */
exports.acceptInvitation = async (req, res, next) => {
  try {
    const invitationId = Number(req.params.invitationId);

    const invitation = await prisma.mandalInvitation.findUnique({
      where: { id: invitationId },
      include: { mandal: true },
    });

    if (!invitation) throw { status: 404, message: "Invitation not found" };

    // Verify mobile matches
    if (invitation.mobile !== req.user.mobile) {
      throw { status: 403, message: "This invitation is not for you" };
    }

    if (invitation.status !== "PENDING") {
      throw {
        status: 400,
        message: `Invitation already ${invitation.status.toLowerCase()}`,
      };
    }
    if (invitation.expiresAt && invitation.expiresAt <= new Date()) throw { status: 400, code: "INVITATION_EXPIRED", message: "Invitation expired" };

    const updated = await prisma.$transaction(async (tx) => {
      const accepted = await tx.mandalInvitation.update({
        where: { id: invitationId },
        data: { status: "ACCEPTED", userId: req.user.userId, acceptedAt: new Date() },
      });
      await tx.mandalMember.upsert({
        where: { mandalId_userId: { mandalId: invitation.mandalId, userId: req.user.userId } },
        update: { role: invitation.role, roleId: invitation.roleId, mobile: req.user.mobile },
        create: { mandalId: invitation.mandalId, userId: req.user.userId, mobile: req.user.mobile, role: invitation.role, roleId: invitation.roleId },
      });
      return accepted;
    });

    // Acceptance creates membership; Mandal activation happens through admin review.
    const allInvitations = await prisma.mandalInvitation.findMany({
      where: { mandalId: invitation.mandalId },
    });

    const acceptedCount = allInvitations.filter(
      (inv) => inv.status === "ACCEPTED",
    ).length;

    res.json({
      success: true,
      message: "Invitation accepted successfully",
      data: updated,
      acceptedCount,
      mandalActivated: false,
    });
  } catch (e) {
    next(e);
  }
};

/* ==================== REJECT INVITATION ==================== */
exports.rejectInvitation = async (req, res, next) => {
  try {
    const invitationId = Number(req.params.invitationId);

    const invitation = await prisma.mandalInvitation.findUnique({
      where: { id: invitationId },
    });

    if (!invitation) throw { status: 404, message: "Invitation not found" };

    if (invitation.mobile !== req.user.mobile) {
      throw { status: 403, message: "This invitation is not for you" };
    }

    if (invitation.status !== "PENDING") {
      throw {
        status: 400,
        message: `Invitation already ${invitation.status.toLowerCase()}`,
      };
    }

    const updated = await prisma.mandalInvitation.update({
      where: { id: invitationId },
      data: { status: "REJECTED" },
    });

    res.json({
      success: true,
      message: "Invitation rejected successfully",
      data: updated,
    });
  } catch (e) {
    next(e);
  }
};

/* ==================== CANCEL INVITATION (by mandal owner) ==================== */
exports.cancelInvitation = async (req, res, next) => {
  try {
    const invitationId = Number(req.params.invitationId);

    const invitation = await prisma.mandalInvitation.findUnique({
      where: { id: invitationId },
      include: { mandal: true },
    });

    if (!invitation) throw { status: 404, message: "Invitation not found" };

    await requireMandalPermission(invitation.mandalId, req.user.userId, "MANAGE_INVITATIONS");

    if (invitation.status === "ACCEPTED") {
      throw { status: 400, message: "Cannot cancel accepted invitations" };
    }

    const deleted = await prisma.mandalInvitation.delete({
      where: { id: invitationId },
    });

    res.json({
      success: true,
      message: "Invitation cancelled successfully",
      data: deleted,
    });
  } catch (e) {
    next(e);
  }
};

/* ==================== RESEND INVITATION ==================== */
exports.resendInvitation = async (req, res, next) => {
  try {
    const invitationId = Number(req.params.invitationId);

    const invitation = await prisma.mandalInvitation.findUnique({
      where: { id: invitationId },
      include: { mandal: true },
    });

    if (!invitation) throw { status: 404, message: "Invitation not found" };

    await requireMandalPermission(invitation.mandalId, req.user.userId, "MANAGE_INVITATIONS");

    if (invitation.status !== "PENDING") {
      throw { status: 400, message: "Can only resend pending invitations" };
    }

    res.json({
      success: true,
      message: "Invitation resent successfully (mock)",
      data: invitation,
    });
  } catch (e) {
    next(e);
  }
};
