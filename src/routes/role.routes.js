const router = require("express").Router();
const controller = require("../controllers/role.controller");
const { auth } = require("../middlewares/auth.middleware");

router.get("/permissions", auth, controller.listPermissions);
router.get("/:mandalId", auth, controller.listRoles);
router.post("/:mandalId", auth, controller.createRole);
router.put("/:mandalId/:roleId", auth, controller.updateRole);
router.delete("/:mandalId/:roleId", auth, controller.deleteRole);
router.put("/:mandalId/members/:memberId", auth, controller.assignMemberRole);

module.exports = router;
