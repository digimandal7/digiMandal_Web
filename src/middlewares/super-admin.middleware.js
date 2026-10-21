const prisma = require("../config/prisma");

exports.superAdmin = async (req, res, next) => {
  try {
    const user = await prisma.user.findUnique({ where: { id: req.user.userId }, select: { platformRole: true } });
    if (!user || user.platformRole !== "SUPER_ADMIN") return next({ status: 403, code: "SUPER_ADMIN_REQUIRED", message: "Super Admin access required" });
    next();
  } catch (error) { next(error); }
};
