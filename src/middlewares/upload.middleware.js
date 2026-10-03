const multer = require("multer");

const storage = multer.memoryStorage();

const upload = multer({
  storage,
  limits: { fileSize: 5 * 1024 * 1024 }, // 5MB
  fileFilter: (req, file, cb) => {
    const allowed = ["image/jpeg", "image/png", "application/pdf"];
    if (!allowed.includes(file.mimetype)) {
      return cb(Object.assign(new Error("Only JPG, PNG, PDF allowed"), { status: 400, code: "INVALID_FILE_TYPE" }));
    }
    cb(null, true);
  }
});

module.exports = upload;
