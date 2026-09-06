const router = require("express").Router();
const controller = require("../controllers/interest.controller");
const { auth } = require("../middlewares/auth.middleware");

// Public route - Get all interests
router.get("/", controller.getAllInterests);

// Admin route - Create interest
router.post("/", auth, controller.createInterest);

module.exports = router;
