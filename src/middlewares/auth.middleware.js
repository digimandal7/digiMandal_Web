
const jwt = require("jsonwebtoken");

module.exports.auth = (req, res, next) => {
  try {
    const token = req.headers.authorization?.split(" ")[1];
    if (!token) throw { status: 401, message: "Unauthorized" };
    req.user = jwt.verify(token, process.env.JWT_SECRET);
    next();
  } catch {
    next({ status: 401, message: "Invalid token" });
  }
};
