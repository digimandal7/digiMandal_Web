const prisma = require("../config/prisma");

/* ==================== GET ALL INTERESTS ==================== */
exports.getAllInterests = async (req, res, next) => {
  try {
    const interests = await prisma.interest.findMany({
      orderBy: { name: "asc" },
    });

    res.json({
      success: true,
      data: interests,
    });
  } catch (e) {
    next(e);
  }
};

/* ==================== CREATE INTEREST (ADMIN) ==================== */
exports.createInterest = async (req, res, next) => {
  try {
    const { name, description, icon } = req.body;

    if (!name) {
      throw { status: 400, message: "Interest name is required" };
    }

    const interest = await prisma.interest.create({
      data: {
        name,
        description: description || null,
        icon: icon || null,
      },
    });

    res.json({
      success: true,
      message: "Interest created successfully",
      data: interest,
    });
  } catch (e) {
    next(e);
  }
};
