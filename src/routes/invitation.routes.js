const router = require("express").Router();
const controller = require("../controllers/invitation.controller");
const { auth } = require("../middlewares/auth.middleware");

// Send invitation to users
router.post("/:mandalId/send", auth, controller.sendInvitation);

// Get invitations for a mandal (owner only)
router.get("/:mandalId/list", auth, controller.getInvitationsForMandal);

// Get pending invitations for current user
router.get("/my/pending", auth, controller.getPendingInvitations);

// Accept/Reject invitations
router.post("/:invitationId/accept", auth, controller.acceptInvitation);
router.post("/:invitationId/reject", auth, controller.rejectInvitation);

// Cancel invitation (owner only)
router.delete("/:invitationId/cancel", auth, controller.cancelInvitation);

// Resend invitation (owner only)
router.post("/:invitationId/resend", auth, controller.resendInvitation);

module.exports = router;
