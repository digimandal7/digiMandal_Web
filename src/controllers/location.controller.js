const prisma = require("../config/prisma");

const invalid = (message) => ({ status: 400, code: "INVALID_LOCATION", message });

exports.listLocations = async (req, res, next) => {
  try {
    const data = await prisma.userPreferredLocation.findMany({
      where: { userId: req.user.userId },
      orderBy: [{ position: "asc" }, { createdAt: "asc" }],
    });
    res.json({ success: true, count: data.length, data });
  } catch (error) { next(error); }
};

exports.addLocation = async (req, res, next) => {
  try {
    const { label, formattedAddress, placeId, latitude, longitude } = req.body;
    if (!label?.trim() || !formattedAddress?.trim()) throw invalid("Label and formattedAddress are required");
    if (latitude !== undefined && (Number(latitude) < -90 || Number(latitude) > 90)) throw invalid("Latitude must be between -90 and 90");
    if (longitude !== undefined && (Number(longitude) < -180 || Number(longitude) > 180)) throw invalid("Longitude must be between -180 and 180");
    const count = await prisma.userPreferredLocation.count({ where: { userId: req.user.userId } });
    const data = await prisma.userPreferredLocation.create({
      data: { userId: req.user.userId, label: label.trim(), formattedAddress: formattedAddress.trim(), placeId: placeId || null, latitude: latitude ?? null, longitude: longitude ?? null, position: count },
    });
    res.status(201).json({ success: true, message: "Preferred location added", data });
  } catch (error) { next(error); }
};

exports.deleteLocation = async (req, res, next) => {
  try {
    const id = Number(req.params.id);
    const location = await prisma.userPreferredLocation.findUnique({ where: { id } });
    if (!location) throw { status: 404, code: "LOCATION_NOT_FOUND", message: "Location not found" };
    if (location.userId !== req.user.userId) throw { status: 403, code: "FORBIDDEN", message: "Not authorized" };
    await prisma.userPreferredLocation.delete({ where: { id } });
    res.json({ success: true, message: "Preferred location removed" });
  } catch (error) { next(error); }
};

exports.reorderLocations = async (req, res, next) => {
  try {
    const { locationIds } = req.body;
    if (!Array.isArray(locationIds) || !locationIds.length) throw invalid("locationIds must be a non-empty array");
    const ids = locationIds.map(Number);
    const owned = await prisma.userPreferredLocation.count({ where: { userId: req.user.userId, id: { in: ids } } });
    if (owned !== ids.length || new Set(ids).size !== ids.length) throw invalid("Every location ID must be unique and owned by the current user");
    await prisma.$transaction(ids.map((id, position) => prisma.userPreferredLocation.update({ where: { id }, data: { position } })));
    res.json({ success: true, message: "Preferred locations reordered" });
  } catch (error) { next(error); }
};
