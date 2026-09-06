const prisma = require("../config/prisma");
const jwt = require("jsonwebtoken");
const bcrypt = require("bcryptjs");

const OTP_EXPIRY_MINUTES = Number(process.env.OTP_EXPIRY_MINUTES || 5);
const OTP_RESEND_SECONDS = Number(process.env.OTP_RESEND_SECONDS || 60);
const OTP_MAX_ATTEMPTS = Number(process.env.OTP_MAX_ATTEMPTS || 3);
const OTP_MAX_RESENDS = Number(process.env.OTP_MAX_RESENDS || 3);
const OTP_BLOCK_MINUTES = Number(process.env.OTP_BLOCK_MINUTES || 30);
const SUPPORTED_LANGUAGES = new Set(["en", "hi", "mr", "gu"]);

const apiError = (status, code, message, details) => ({ status, code, message, details });
const validateMobile = (mobile) => {
  if (!mobile || !/^\d{10}$/.test(mobile)) {
    throw apiError(400, "INVALID_MOBILE", "Enter a valid 10-digit mobile number");
  }
};
const signToken = (user) => jwt.sign(
  { userId: user.id, mobile: user.mobile },
  process.env.JWT_SECRET,
  { expiresIn: "7d" },
);

async function issueOtp(mobile, isResend = false) {
  validateMobile(mobile);
  const now = new Date();
  const user = await prisma.user.findUnique({ where: { mobile } });
  if (user?.blockedUntil && user.blockedUntil > now) {
    throw apiError(423, "ACCOUNT_BLOCKED", "Account is temporarily blocked", {
      blockedUntil: user.blockedUntil,
    });
  }

  const previous = await prisma.oTP.findFirst({
    where: { mobile, verified: false },
    orderBy: { createdAt: "desc" },
  });
  if (previous) {
    const resendAvailableAt = new Date(previous.lastSentAt.getTime() + OTP_RESEND_SECONDS * 1000);
    if (resendAvailableAt > now) {
      throw apiError(429, "OTP_COOLDOWN", "Please wait before requesting another OTP", {
        resendAvailableAt,
      });
    }
    if (isResend && previous.resendCount >= OTP_MAX_RESENDS) {
      throw apiError(429, "OTP_RESEND_LIMIT", "OTP resend limit reached");
    }
  }

  const code = Math.floor(100000 + Math.random() * 900000).toString();
  const resendCount = isResend ? (previous?.resendCount || 0) + 1 : 0;
  await prisma.oTP.deleteMany({ where: { mobile } });
  const record = await prisma.oTP.create({
    data: {
      mobile,
      code,
      expiresAt: new Date(now.getTime() + OTP_EXPIRY_MINUTES * 60000),
      resendCount,
      lastSentAt: now,
    },
  });

  // Integrate an SMS provider here. OTP is returned only when explicitly enabled locally.
  const payload = {
    success: true,
    message: "OTP sent successfully",
    flowType: user ? "LOGIN" : "REGISTRATION",
    expiresAt: record.expiresAt,
    resendAvailableAt: new Date(now.getTime() + OTP_RESEND_SECONDS * 1000),
    resendsRemaining: Math.max(0, OTP_MAX_RESENDS - resendCount),
  };
  if (process.env.EXPOSE_OTP === "true" && process.env.NODE_ENV !== "production") payload.otp = code;
  return payload;
}

exports.sendOtp = async (req, res, next) => {
  try { res.json(await issueOtp(req.body.mobile, false)); } catch (error) { next(error); }
};

exports.resendOtp = async (req, res, next) => {
  try { res.json(await issueOtp(req.body.mobile, true)); } catch (error) { next(error); }
};

exports.verifyOtp = async (req, res, next) => {
  try {
    const { mobile, otp } = req.body;
    validateMobile(mobile);
    if (!otp || !/^\d{6}$/.test(otp)) throw apiError(400, "INVALID_OTP_FORMAT", "Enter a 6-digit OTP");

    const record = await prisma.oTP.findFirst({
      where: { mobile, verified: false },
      orderBy: { createdAt: "desc" },
    });
    if (!record) throw apiError(400, "OTP_INVALID", "Invalid OTP");
    if (record.expiresAt <= new Date()) throw apiError(400, "OTP_EXPIRED", "OTP expired");

    if (record.code !== otp) {
      const attempts = record.attempts + 1;
      await prisma.oTP.update({ where: { id: record.id }, data: { attempts } });
      const attemptsRemaining = Math.max(0, OTP_MAX_ATTEMPTS - attempts);
      if (!attemptsRemaining) {
        const blockedUntil = new Date(Date.now() + OTP_BLOCK_MINUTES * 60000);
        const existing = await prisma.user.findUnique({ where: { mobile } });
        if (existing) await prisma.user.update({ where: { id: existing.id }, data: { blockedUntil } });
        throw apiError(423, "ACCOUNT_BLOCKED", "Too many invalid attempts", { blockedUntil });
      }
      throw apiError(400, "OTP_INVALID", "Invalid OTP", { attemptsRemaining });
    }

    await prisma.oTP.update({ where: { id: record.id }, data: { verified: true } });
    let user = await prisma.user.findUnique({ where: { mobile } });
    const isNewUser = !user;
    if (!user) user = await prisma.user.create({ data: { mobile, isVerified: true } });
    else user = await prisma.user.update({ where: { id: user.id }, data: { isVerified: true, blockedUntil: null } });

    res.json({
      success: true,
      message: "OTP verified successfully",
      token: signToken(user),
      flowType: isNewUser || !user.profileComplete ? "REGISTRATION" : "LOGIN",
      profileComplete: user.profileComplete,
      user: { id: user.id, mobile: user.mobile, isVerified: user.isVerified, profileComplete: user.profileComplete },
    });
  } catch (error) { next(error); }
};

exports.login = async (req, res, next) => {
  try {
    const { mobile, password } = req.body;
    validateMobile(mobile);
    if (!password) throw apiError(400, "PASSWORD_REQUIRED", "Password is required");
    const user = await prisma.user.findUnique({ where: { mobile } });
    if (!user || !user.password || !(await bcrypt.compare(password, user.password))) {
      throw apiError(401, "INVALID_CREDENTIALS", "Invalid mobile number or password");
    }
    if (user.blockedUntil && user.blockedUntil > new Date()) throw apiError(423, "ACCOUNT_BLOCKED", "Account is temporarily blocked", { blockedUntil: user.blockedUntil });
    res.json({ success: true, message: "Login successful", token: signToken(user), flowType: "LOGIN", user: { id: user.id, mobile: user.mobile, name: user.name, email: user.email, profileComplete: user.profileComplete } });
  } catch (error) { next(error); }
};

async function validateInterests(interests) {
  if (!Array.isArray(interests) || new Set(interests).size < 3) {
    throw apiError(400, "MINIMUM_INTERESTS_REQUIRED", "Choose at least 3 interests");
  }
  const ids = [...new Set(interests.map(Number))];
  if (ids.some((id) => !Number.isInteger(id) || id <= 0)) throw apiError(400, "INVALID_INTERESTS", "Interest IDs must be positive integers");
  const count = await prisma.interest.count({ where: { id: { in: ids } } });
  if (count !== ids.length) throw apiError(400, "INVALID_INTERESTS", "One or more interests do not exist");
  return ids;
}

exports.completeRegistration = async (req, res, next) => {
  try {
    const userId = req.user.userId;
    const { name, email, password, confirmPassword, profileImage, preferredLanguage = "en", interests } = req.body;
    if (!name?.trim()) throw apiError(400, "NAME_REQUIRED", "Full name is required");
    if (!password || password.length < 8) throw apiError(400, "WEAK_PASSWORD", "Password must contain at least 8 characters");
    if (confirmPassword !== undefined && password !== confirmPassword) throw apiError(400, "PASSWORDS_DO_NOT_MATCH", "Passwords do not match");
    if (email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) throw apiError(400, "INVALID_EMAIL", "Enter a valid email address");
    if (!SUPPORTED_LANGUAGES.has(preferredLanguage)) throw apiError(400, "INVALID_LANGUAGE", "Supported languages are en, hi, mr and gu");
    const interestIds = await validateInterests(interests);
    const current = await prisma.user.findUnique({ where: { id: userId } });
    if (!current) throw apiError(404, "USER_NOT_FOUND", "User not found");
    if (current.profileComplete) throw apiError(409, "PROFILE_ALREADY_COMPLETE", "Registration is already complete");
    if (email) {
      const duplicate = await prisma.user.findFirst({ where: { email, id: { not: userId } } });
      if (duplicate) throw apiError(409, "EMAIL_ALREADY_REGISTERED", "Email already registered");
    }
    const user = await prisma.user.update({
      where: { id: userId },
      data: { name: name.trim(), email: email || null, password: await bcrypt.hash(password, 12), profileImage: profileImage || null, preferredLanguage, interestIds: JSON.stringify(interestIds), profileComplete: true },
    });
    res.json({ success: true, message: "Registration completed successfully", user: { id: user.id, mobile: user.mobile, name: user.name, email: user.email, preferredLanguage: user.preferredLanguage, interests: interestIds, profileComplete: user.profileComplete } });
  } catch (error) { next(error); }
};

exports.updateProfile = async (req, res, next) => {
  try {
    const userId = req.user.userId;
    const { name, email, profileImage, address, city, state, pincode, preferredLanguage, interests } = req.body;
    if (email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) throw apiError(400, "INVALID_EMAIL", "Enter a valid email address");
    if (preferredLanguage !== undefined && !SUPPORTED_LANGUAGES.has(preferredLanguage)) throw apiError(400, "INVALID_LANGUAGE", "Supported languages are en, hi, mr and gu");
    if (email) {
      const duplicate = await prisma.user.findFirst({ where: { email, id: { not: userId } } });
      if (duplicate) throw apiError(409, "EMAIL_ALREADY_REGISTERED", "Email already in use");
    }
    const data = {};
    for (const key of ["name", "email", "profileImage", "address", "city", "state", "pincode", "preferredLanguage"]) if (req.body[key] !== undefined) data[key] = req.body[key];
    if (interests !== undefined) data.interestIds = JSON.stringify(await validateInterests(interests));
    const user = await prisma.user.update({ where: { id: userId }, data });
    res.json({ success: true, message: "Profile updated successfully", user: { id: user.id, mobile: user.mobile, name: user.name, email: user.email, profileImage: user.profileImage, address: user.address, city: user.city, state: user.state, pincode: user.pincode, preferredLanguage: user.preferredLanguage, interests: user.interestIds ? JSON.parse(user.interestIds) : [] } });
  } catch (error) { next(error); }
};

exports.checkRegistrationStatus = async (req, res, next) => {
  try {
    validateMobile(req.body.mobile);
    const user = await prisma.user.findUnique({ where: { mobile: req.body.mobile } });
    res.json({ success: true, userExists: !!user, profileComplete: user?.profileComplete || false, flowType: !user || !user.profileComplete ? "REGISTRATION" : "LOGIN" });
  } catch (error) { next(error); }
};

exports.getCurrentUser = async (req, res, next) => {
  try {
    const user = await prisma.user.findUnique({
      where: { id: req.user.userId },
      include: { preferredLocations: { orderBy: { position: "asc" } }, mandalsOwned: { select: { id: true, name: true, status: true, category: true } }, memberships: { select: { id: true, mandalId: true, role: true } }, _count: { select: { mandalsOwned: true, memberships: true, invitations: true } } },
    });
    if (!user) throw apiError(404, "USER_NOT_FOUND", "User not found");
    const interestIds = user.interestIds ? JSON.parse(user.interestIds) : [];
    const interests = interestIds.length ? await prisma.interest.findMany({ where: { id: { in: interestIds } }, select: { id: true, name: true, icon: true } }) : [];
    const { password, interestIds: ignored, blockedUntil, ...safeUser } = user;
    res.json({ success: true, data: { ...safeUser, interests } });
  } catch (error) { next(error); }
};

exports.verifyToken = async (req, res, next) => {
  try {
    const user = await prisma.user.findUnique({ where: { id: req.user.userId } });
    if (!user) throw apiError(404, "USER_NOT_FOUND", "User not found");
    res.json({ success: true, message: "Token is valid", user: { id: user.id, mobile: user.mobile, isVerified: user.isVerified, profileComplete: user.profileComplete } });
  } catch (error) { next(error); }
};
