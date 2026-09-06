const router = require("express").Router();
const controller = require("../controllers/location.controller");
const { auth } = require("../middlewares/auth.middleware");

router.get("/", auth, controller.listLocations);
router.post("/", auth, controller.addLocation);
router.put("/reorder", auth, controller.reorderLocations);
router.delete("/:id", auth, controller.deleteLocation);

module.exports = router;
