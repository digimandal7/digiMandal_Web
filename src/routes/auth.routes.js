const router = require("express").Router();
const controller = require("../controllers/auth.controller");
const { auth } = require("../middlewares/auth.middleware");

// Public routes - NEW USERS
router.post("/send-otp", controller.sendOtp);
router.post("/resend-otp", controller.resendOtp);
router.post("/verify-otp", controller.verifyOtp);

// Public routes - EXISTING USERS
router.post("/login", controller.login);

// Public route - Check user status
router.post("/check-status", controller.checkRegistrationStatus);

// Protected routes
router.post("/complete-registration", auth, controller.completeRegistration);
router.put("/profile", auth, controller.updateProfile);
router.get("/me", auth, controller.getCurrentUser);
router.get("/verify-token", auth, controller.verifyToken);

module.exports = router;
