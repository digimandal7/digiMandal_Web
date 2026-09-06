const router = require("express").Router();
const controller = require("../controllers/member.controller");
const { auth } = require("../middlewares/auth.middleware");

// Add member manually (owner)
router.post("/", auth, controller.addMember);

// Get all members of a mandal
router.get("/:mandalId/list", auth, controller.getMembers);

// Get member details
router.get("/:id/details", auth, controller.getMemberDetails);

// Update member role
router.put("/:id/role", auth, controller.updateMemberRole);

// Check if current user is member
router.get("/:mandalId/status", auth, controller.checkMemberStatus);

// Delete member (owner)
router.delete("/:id", auth, controller.deleteMember);

// Leave mandal
router.post("/:mandalId/leave", auth, controller.leaveMandal);

module.exports = router;
