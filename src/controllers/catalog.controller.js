const prisma = require("../config/prisma");
const { INDIAN_STATES } = require("../config/mandal-options");
const { lookupPincode, lookupIfsc, searchBankBranches } = require("../services/external-lookup.service");

exports.getMandalOptions = async (req, res, next) => {
  try {
    const options = await prisma.masterOption.findMany({ where: { isActive: true }, orderBy: [{ sortOrder: "asc" }, { label: "asc" }] });
    const byType = (type) => options.filter((option) => option.type === type);
    const categories = byType("MANDAL_CATEGORY");
    const currentYear = new Date().getFullYear();
    res.json({ success: true, data: { sizes: byType("MANDAL_SIZE"), categories, popularCategories: categories.filter((option) => !option.isOther).slice(0, 6), banks: byType("BANK"), formationYears: Array.from({ length: 126 }, (_, index) => currentYear - index), states: INDIAN_STATES } });
  } catch (error) { next(error); }
};

exports.pincodeLookup = async (req, res, next) => {
  try {
    if (!/^\d{6}$/.test(req.params.pincode)) throw { status: 400, code: "INVALID_PINCODE", message: "Enter a valid 6-digit PIN code" };
    res.json({ success: true, data: await lookupPincode(req.params.pincode) });
  } catch (error) { if (error.name === "TimeoutError") next({ status: 504, code: "PINCODE_SERVICE_TIMEOUT", message: "PIN code service timed out" }); else if (!error.code && error.status !== 404) next({ status: 502, code: "PINCODE_SERVICE_UNAVAILABLE", message: "PIN code service is temporarily unavailable" }); else next(error); }
};

exports.ifscLookup = async (req, res, next) => {
  try {
    const ifsc = String(req.params.ifsc || "").toUpperCase();
    if (!/^[A-Z]{4}0[A-Z0-9]{6}$/.test(ifsc)) throw { status: 400, code: "INVALID_IFSC", message: "Enter a valid IFSC code" };
    res.json({ success: true, data: await lookupIfsc(ifsc) });
  } catch (error) { next(error); }
};

exports.bankBranchSearch = async (req, res, next) => {
  try { res.json({ success: true, ...(await searchBankBranches(req.query)) }); }
  catch (error) { next(error); }
};
