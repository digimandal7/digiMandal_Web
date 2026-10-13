const router = require("express").Router();
const controller = require("../controllers/mandal.controller");
const { auth } = require("../middlewares/auth.middleware");

// Mandal CRUD
router.post("/", auth, controller.createMandal);
router.get("/my-mandals/list", auth, controller.getUserMandals);
router.get("/my-memberships/list", auth, controller.getMemberMandals);
router.get("/:id", auth, controller.getMandal);
router.put("/:id", auth, controller.updateMandal);
router.delete("/:id", auth, controller.deleteMandal);

// Mandal Details
router.post("/:id/address", auth, controller.addAddress);
router.post("/:id/bank-details/skip", auth, controller.skipBankDetails);
router.post("/:id/bank-details", auth, controller.addBankDetails);
router.post("/:id/registration", auth, controller.addRegistration);
router.get("/:id/onboarding-status", auth, controller.getOnboardingStatus);

module.exports = router;
