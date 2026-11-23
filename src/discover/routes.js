const router = require("express").Router();
const rateLimit = require("express-rate-limit");
const { randomUUID } = require("node:crypto");
const { auth } = require("../middlewares/auth.middleware");
const service = require("./service");

router.use((req, res, next) => {
  if (!/^\/discover(?:\/|$)/.test(req.path)) return next("router");
  res.set("Cache-Control", "private, no-store");
  req.requestId = req.get("X-Request-Id") || randomUUID();
  auth(req, res, next);
});
router.use(
  rateLimit({
    windowMs: 60_000,
    limit: 180,
    standardHeaders: true,
    legacyHeaders: false,
    keyGenerator: (req) => String(req.user.userId),
  }),
);
const run = (handler) => async (req, res, next) => {
  try {
    if (!Number.isSafeInteger(req.user?.userId) || req.user.userId < 1)
      throw { status: 401, code: "UNAUTHORIZED", message: "Please sign in" };
    res.json({
      success: true,
      data: await handler(req),
      requestId: req.requestId,
      serverTime: new Date().toISOString(),
    });
  } catch (error) {
    next(error);
  }
};

router.get(
  "/discover",
  run((req) => service.discover(req.user.userId, req.query)),
);
router.get(
  "/discover/search",
  run((req) => service.search(req.user.userId, req.query)),
);
router.get(
  "/discover/filters",
  run((req) => service.filters(req.user.userId)),
);
router.get(
  "/discover/locations",
  run((req) => service.locations(req.user.userId, req.query)),
);

module.exports = router;
