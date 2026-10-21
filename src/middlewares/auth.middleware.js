
const jwt = require("jsonwebtoken");

module.exports.auth = (req, res, next) => {
  const token = req.headers.authorization?.split(" ")[1];
  if (!token) return next({ status: 401, code: "UNAUTHORIZED", message: "Unauthorized" });
  try {
    req.user = jwt.verify(token, process.env.JWT_SECRET);
    next();
  } catch {
    next({ status: 401, code: "INVALID_TOKEN", message: "Invalid token" });
  }
};
