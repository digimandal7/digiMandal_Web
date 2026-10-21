const prisma = require("../config/prisma");
const { runBankSync } = require("../services/bank-sync.service");

const TYPES = new Set(["MANDAL_SIZE", "MANDAL_CATEGORY", "BANK"]);
const requireType = (value) => {
  const type = String(value || "").toUpperCase();
  if (!TYPES.has(type)) throw { status: 400, code: "INVALID_OPTION_TYPE", message: "Type must be MANDAL_SIZE, MANDAL_CATEGORY or BANK" };
  return type;
};

exports.list = async (req, res, next) => {
  try {
    const type = requireType(req.params.type);
    const data = await prisma.masterOption.findMany({ where: { type, isActive: true }, orderBy: [{ sortOrder: "asc" }, { label: "asc" }] });
    res.json({ success: true, data });
  } catch (error) { next(error); }
};

exports.create = async (req, res, next) => {
  try {
    const type = requireType(req.params.type);
    const { code, label, metadata, isOther = false, sortOrder = 0 } = req.body;
    if (!code?.trim() || !label?.trim()) throw { status: 400, code: "OPTION_FIELDS_REQUIRED", message: "code and label are required" };
    const data = await prisma.masterOption.create({ data: { type, code: code.trim().toUpperCase().replace(/\s+/g, "_"), label: label.trim(), metadata: metadata || undefined, isOther: Boolean(isOther), sortOrder: Number(sortOrder) || 0 } });
    res.status(201).json({ success: true, message: "Option created", data });
  } catch (error) { if (error.code === "P2002") next({ status: 409, code: "OPTION_ALREADY_EXISTS", message: "This option code already exists" }); else next(error); }
};

exports.update = async (req, res, next) => {
  try {
    const type = requireType(req.params.type);
    const id = Number(req.params.id);
    const existing = await prisma.masterOption.findUnique({ where: { id } });
    if (!existing || existing.type !== type) throw { status: 404, code: "OPTION_NOT_FOUND", message: "Option not found" };
    const allowed = ["label", "metadata", "isOther", "isActive", "sortOrder"];
    const data = {};
    for (const key of allowed) if (req.body[key] !== undefined) data[key] = req.body[key];
    if (data.label !== undefined && !data.label?.trim()) throw { status: 400, code: "INVALID_OPTION_LABEL", message: "label cannot be empty" };
    if (data.label) data.label = data.label.trim();
    const updated = await prisma.masterOption.update({ where: { id }, data });
    res.json({ success: true, message: "Option updated", data: updated });
  } catch (error) { next(error); }
};

exports.remove = async (req, res, next) => {
  try {
    const type = requireType(req.params.type);
    const id = Number(req.params.id);
    const existing = await prisma.masterOption.findUnique({ where: { id } });
    if (!existing || existing.type !== type) throw { status: 404, code: "OPTION_NOT_FOUND", message: "Option not found" };
    const data = await prisma.masterOption.update({ where: { id }, data: { isActive: false } });
    res.json({ success: true, message: "Option disabled", data });
  } catch (error) { next(error); }
};

exports.syncBanks = async (req, res, next) => {
  try {
    const data = await runBankSync();
    res.json({ success: true, message: "Bank options synchronized", data });
  } catch (error) {
    next({
      status: 502,
      code: "BANK_SYNC_FAILED",
      message: "Unable to synchronize bank options",
      details: error.message,
    });
  }
};
