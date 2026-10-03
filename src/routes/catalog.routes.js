const router = require("express").Router();
const controller = require("../controllers/catalog.controller");

router.get("/mandal-options", controller.getMandalOptions);

module.exports = router;
