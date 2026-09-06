const router = require("express").Router();
const controller = require("../controllers/document.controller");
const upload = require("../middlewares/upload.middleware");
const { auth } = require("../middlewares/auth.middleware");

// Upload document
router.post("/upload", auth, upload.single("file"), controller.uploadDocument);

// Get all documents for a mandal
router.get("/:mandalId/list", auth, controller.getDocuments);

// Get document details
router.get("/:id/details", auth, controller.getDocumentDetails);

// Delete document
router.delete("/:id", auth, controller.deleteDocument);

module.exports = router;
