const express = require("express");
const multer = require("multer");
const { auth } = require("../middlewares/auth.middleware");
const service = require("./service");
const storage = require("./storage");
const v = require("./validation");
const router = express.Router();
// Do not intercept unrelated legacy /api routes or their error responses.
router.use((req, res, next) => {
  if (
    !/^\/(issues(?:\/|$)|issue-uploads(?:\/|$)|mandals\/[^/]+\/(issues|members|issue-uploads)(?:\/|$))/.test(
      req.path,
    )
  )
    return next("router");
  res.set("Cache-Control", "private, no-store");
  auth(req, res, (error) => {
    if (error) return next(error);
    if (!Number.isSafeInteger(req.user?.userId) || req.user.userId <= 0)
      return next({
        status: 401,
        code: "UNAUTHORIZED",
        message: "Unauthorized",
      });
    next();
  });
});
const run =
  (handler, status = 200) =>
  async (req, res, next) => {
    try {
      const serverTime = new Date().toISOString();
      res.status(status).json({
        success: true,
        data: await handler(req),
        serverTime,
      });
    } catch (error) {
      next(error);
    }
  };
const uid = (req) => req.user.userId;
const iid = (req) => v.id(req.params.issueId, "issueId");
const mid = (req) => v.id(req.params.mandalId, "mandalId");
router.post(
  "/mandals/:mandalId/issues/preview",
  run((r) => service.preview(uid(r), mid(r), r.body)),
);
router.get(
  "/issues/mandals",
  run((r) => service.mandals(uid(r), r.query)),
);
router.post(
  "/mandals/:mandalId/issues",
  run(
    (r) => service.create(uid(r), mid(r), r.body, r.get("Idempotency-Key")),
    201,
  ),
);
router.get(
  "/mandals/:mandalId/members",
  run((r) => service.members(uid(r), mid(r), r.query)),
);
router.get(
  "/issues",
  run((r) => service.list(uid(r), r.query)),
);
router.get(
  "/issues/:issueId",
  run((r) => service.detail(uid(r), iid(r))),
);
router.patch(
  "/issues/:issueId",
  run((r) => service.update(uid(r), iid(r), r.body)),
);
router.delete(
  "/issues/:issueId",
  run((r) => service.archive(uid(r), iid(r))),
);
router.post(
  "/issues/:issueId/support",
  run((r) => service.support(uid(r), iid(r), true)),
);
router.delete(
  "/issues/:issueId/support",
  run((r) => service.support(uid(r), iid(r), false)),
);
router.get(
  "/issues/:issueId/supporters",
  run((r) => service.supporters(uid(r), iid(r), r.query)),
);
router.put(
  "/issues/:issueId/participants",
  run((r) => {
    v.only(r.body, ["participants"]);
    if (!("participants" in r.body)) v.invalid("participants", "Required");
    return service.update(uid(r), iid(r), r.body);
  }),
);
router.get(
  "/issues/:issueId/comments",
  run((r) => service.comments(uid(r), iid(r), r.query)),
);
router.post(
  "/issues/:issueId/comments",
  run((r) => service.writeComment(uid(r), iid(r), r.body), 201),
);
router.patch(
  "/issues/:issueId/comments/:commentId",
  run((r) =>
    service.writeComment(
      uid(r),
      iid(r),
      r.body,
      v.id(r.params.commentId, "commentId"),
    ),
  ),
);
router.delete(
  "/issues/:issueId/comments/:commentId",
  run((r) =>
    service.writeComment(
      uid(r),
      iid(r),
      null,
      v.id(r.params.commentId, "commentId"),
      true,
    ),
  ),
);
router.put(
  "/issues/:issueId/comments/read",
  run((r) => service.markRead(uid(r), iid(r), r.body)),
);
router.post(
  "/issues/:issueId/resolve",
  run((r) => service.resolve(uid(r), iid(r), r.body, r.get("Idempotency-Key"))),
);
router.get(
  "/issues/:issueId/resolution",
  run(async (r) => {
    const row = await service.detail(uid(r), iid(r));
    if (!row.resolution) v.fail(404, "NOT_FOUND", "Resolution not found");
    return row.resolution;
  }),
);
const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 5 * 1024 * 1024, files: 1, fields: 1, parts: 3 },
});
router.post(
  "/mandals/:mandalId/issue-uploads",
  (req, res, next) => {
    // Authorize before buffering multipart data.
    require("./policy")
      .membership(require("./repository").prisma, mid(req), uid(req))
      .then(() => next(), next);
  },
  upload.single("file"),
  run((r) => storage.upload(uid(r), mid(r), r.body.purpose, r.file), 201),
);
router.get("/issue-uploads/:uploadId/content", async (req, res, next) => {
  try {
    const result = await storage.content(
      uid(req),
      req.params.uploadId,
      req.query.thumbnail === "true",
    );
    res
      .set("X-Content-Type-Options", "nosniff")
      .type(result.mimeType)
      .send(result.buffer);
  } catch (error) {
    next(error);
  }
});
router.delete(
  "/issue-uploads/:uploadId",
  run((r) => storage.abandon(uid(r), r.params.uploadId)),
);
router.use((error, req, res, next) => {
  if (res.headersSent) return next(error);
  let status = error.status || 500,
    code = error.status
      ? error.code || "REQUEST_ERROR"
      : "INTERNAL_SERVER_ERROR",
    message = error.status ? error.message : "Unable to complete request";
  if (error instanceof multer.MulterError) {
    status = 400;
    code = "VALIDATION_ERROR";
    message = "Upload requires one JPEG/PNG image, maximum 5 MB";
  }
  if (
    ["P2034", "P2002"].includes(error.code) ||
    (error.code === "P2010" &&
      ["1213", "1205"].includes(String(error.meta?.code)))
  ) {
    status = 409;
    code = "CONCURRENT_CHANGE";
    message =
      "Concurrent change; retry the request with the same idempotency key";
  }
  if (["P2024", "P1001"].includes(error.code)) {
    status = 503;
    code = "SERVICE_UNAVAILABLE";
    message = "Service temporarily unavailable";
  }
  res.status(status).json({
    success: false,
    code,
    message,
    ...(error.details ? { details: error.details } : {}),
  });
});
module.exports = router;
