const router = require("express").Router();
const controller = require("../controllers/catalog.controller");
const master = require("../controllers/master-option.controller");
const { auth } = require("../middlewares/auth.middleware");
const { superAdmin } = require("../middlewares/super-admin.middleware");

router.get("/mandal-options", controller.getMandalOptions);
router.get("/options/:type", master.list);
router.get("/pincode/:pincode", controller.pincodeLookup);
router.get("/ifsc/:ifsc", controller.ifscLookup);
router.get("/bank-branches", controller.bankBranchSearch);
router.post("/admin/banks/sync", auth, superAdmin, master.syncBanks);
router.post("/admin/options/:type", auth, superAdmin, master.create);
router.put("/admin/options/:type/:id", auth, superAdmin, master.update);
router.delete("/admin/options/:type/:id", auth, superAdmin, master.remove);

module.exports = router;
