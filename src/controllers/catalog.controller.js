const { MANDAL_SIZES, MANDAL_CATEGORIES, MEMBER_DESIGNATIONS, BANKS, INDIAN_STATES } = require("../config/mandal-options");

exports.getMandalOptions = (req, res) => {
  const currentYear = new Date().getFullYear();
  res.json({
    success: true,
    data: {
      sizes: MANDAL_SIZES,
      categories: MANDAL_CATEGORIES,
      popularCategories: MANDAL_CATEGORIES.slice(0, 6),
      formationYears: Array.from({ length: 126 }, (_, index) => currentYear - index),
      designations: MEMBER_DESIGNATIONS,
      banks: BANKS,
      states: INDIAN_STATES,
    },
  });
};
