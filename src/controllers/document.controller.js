const prisma = require("../config/prisma");
const imagekit = require("../config/imagekit");
const { DOCUMENT_TYPES } = require("../config/mandal-options");
const { requireMandalPermission } = require("../services/mandal-access.service");

/* ==================== UPLOAD DOCUMENT ==================== */
exports.uploadDocument = async (req, res, next) => {
  try {
    const { mandalId, type } = req.body;
    const file = req.file;

    if (!mandalId || !type || !file) {
      throw { status: 400, code: "DOCUMENT_FIELDS_REQUIRED", message: "mandalId, type and file are required" };
    }
    if (!DOCUMENT_TYPES.includes(type)) throw { status: 400, code: "INVALID_DOCUMENT_TYPE", message: `Document type must be one of: ${DOCUMENT_TYPES.join(", ")}` };

    const mandalId_num = Number(mandalId);
    const mandal = await prisma.mandal.findUnique({
      where: { id: mandalId_num },
    });

    if (!mandal) throw { status: 404, message: "Mandal not found" };

    await requireMandalPermission(mandalId_num, req.user.userId, "MANAGE_DOCUMENTS");
    if (["REGISTRATION_CERTIFICATE", "80G_CERTIFICATE"].includes(type) && !mandal.isRegistered) throw { status: 400, code: "REGISTRATION_DOCUMENT_NOT_APPLICABLE", message: "Registration documents apply only to registered Mandals" };
    if (type === "CANCELLED_CHEQUE") {
      const bank = await prisma.mandalBank.findUnique({ where: { mandalId: mandalId_num } });
      if (!bank) throw { status: 400, code: "BANK_DETAILS_REQUIRED", message: "Add bank details before uploading a cancelled cheque" };
    }

    const existing = await prisma.mandalDocument.findFirst({ where: { mandalId: mandalId_num, type } });
    const safeName = file.originalname.replace(/[^a-zA-Z0-9._-]/g, "_");

    const uploadResponse = await imagekit.upload({
      file: file.buffer,
      fileName: `${Date.now()}-${safeName}`,
      folder: `/digimandal/${mandalId_num}`,
      useUniqueFileName: true,
    });

    const document = existing
      ? await prisma.mandalDocument.update({ where: { id: existing.id }, data: { fileUrl: uploadResponse.url, fileId: uploadResponse.fileId } })
      : await prisma.mandalDocument.create({ data: { mandalId: mandalId_num, type, fileUrl: uploadResponse.url, fileId: uploadResponse.fileId } });
    if (existing) {
      try { await imagekit.deleteFile(existing.fileId); } catch (error) { console.error("Old ImageKit document cleanup failed:", error.message); }
    }

    res.status(201).json({
      success: true,
      message: existing ? "Document replaced successfully" : "Document uploaded successfully",
      data: document,
    });
  } catch (error) {
    next(error);
  }
};

/* ==================== GET DOCUMENTS ==================== */
exports.getDocuments = async (req, res, next) => {
  try {
    const mandalId = Number(req.params.mandalId);

    if (!mandalId) {
      throw { status: 400, message: "mandalId is required" };
    }

    const mandal = await prisma.mandal.findUnique({
      where: { id: mandalId },
    });

    if (!mandal) throw { status: 404, message: "Mandal not found" };

    await requireMandalPermission(mandalId, req.user.userId, "VIEW_DOCUMENTS");

    const documents = await prisma.mandalDocument.findMany({
      where: { mandalId },
      orderBy: { id: "desc" },
    });

    res.json({
      success: true,
      count: documents.length,
      data: documents,
    });
  } catch (error) {
    next(error);
  }
};

/* ==================== GET DOCUMENT DETAILS ==================== */
exports.getDocumentDetails = async (req, res, next) => {
  try {
    const documentId = Number(req.params.id);

    const document = await prisma.mandalDocument.findUnique({
      where: { id: documentId },
      include: { mandal: true },
    });

    if (!document) throw { status: 404, message: "Document not found" };

    await requireMandalPermission(document.mandalId, req.user.userId, "VIEW_DOCUMENTS");

    res.json({ success: true, data: document });
  } catch (error) {
    next(error);
  }
};

/* ==================== DELETE DOCUMENT ==================== */
exports.deleteDocument = async (req, res, next) => {
  try {
    const documentId = Number(req.params.id);

    if (!documentId) throw { status: 400, message: "Document id required" };

    const document = await prisma.mandalDocument.findUnique({
      where: { id: documentId },
      include: { mandal: true },
    });

    if (!document) throw { status: 404, message: "Document not found" };

    await requireMandalPermission(document.mandalId, req.user.userId, "MANAGE_DOCUMENTS");

    // Delete from ImageKit
    try {
      await imagekit.deleteFile(document.fileId);
    } catch (error) {
      console.error("Error deleting from ImageKit:", error);
    }

    await prisma.mandalDocument.delete({
      where: { id: documentId },
    });

    res.json({
      success: true,
      message: "Document deleted successfully",
    });
  } catch (error) {
    next(error);
  }
};
