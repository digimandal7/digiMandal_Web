const prisma = require("../config/prisma");
const imagekit = require("../config/imagekit");

/* ==================== UPLOAD DOCUMENT ==================== */
exports.uploadDocument = async (req, res, next) => {
  try {
    const { mandalId, type } = req.body;
    const file = req.file;

    if (!mandalId || !type || !file) {
      throw { status: 400, message: "mandalId, type and file are required" };
    }

    const mandalId_num = Number(mandalId);
    const mandal = await prisma.mandal.findUnique({
      where: { id: mandalId_num },
    });

    if (!mandal) throw { status: 404, message: "Mandal not found" };

    if (mandal.createdById !== req.user.userId) {
      throw { status: 403, message: "Not authorized" };
    }

    const uploadResponse = await imagekit.upload({
      file: file.buffer,
      fileName: `${Date.now()}-${file.originalname}`,
      folder: `/digimandal/${mandalId_num}`,
      useUniqueFileName: true,
    });

    const document = await prisma.mandalDocument.create({
      data: {
        mandalId: mandalId_num,
        type,
        fileUrl: uploadResponse.url,
        fileId: uploadResponse.fileId,
      },
    });

    res.status(201).json({
      success: true,
      message: "Document uploaded successfully",
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

    // Allow mandal owner and members to view documents
    const isMember = await prisma.mandalMember.findFirst({
      where: { mandalId, userId: req.user.userId },
    });

    if (mandal.createdById !== req.user.userId && !isMember) {
      throw { status: 403, message: "Not authorized" };
    }

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

    const isMember = await prisma.mandalMember.findFirst({
      where: { mandalId: document.mandalId, userId: req.user.userId },
    });

    if (document.mandal.createdById !== req.user.userId && !isMember) {
      throw { status: 403, message: "Not authorized" };
    }

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

    if (document.mandal.createdById !== req.user.userId) {
      throw { status: 403, message: "Not authorized" };
    }

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
