const { test } = require("node:test");
const assert = require("node:assert/strict");
const discover = require("../../src/discover/service");

test("Discover validates tabs, sorting and pagination", () => {
  assert.equal(
    discover.choice("mandals", discover.TYPES, "type", "ALL"),
    "MANDALS",
  );
  assert.throws(() =>
    discover.choice("unknown", discover.TYPES, "type", "ALL"),
  );
  assert.deepEqual(discover.page({ page: "2", limit: "10" }), {
    page: 2,
    limit: 10,
    skip: 10,
  });
  assert.throws(() => discover.page({ limit: "51" }));
  assert.throws(() => discover.text(" ", "q", 200, true));
});

test("Discover organization type mapping is centralized and deterministic", () => {
  assert.equal(discover.typeFor("Music Academy"), "ACADEMIES");
  assert.equal(discover.typeFor("Event Vendor Services"), "VENDORS");
  assert.equal(discover.typeFor("Cultural"), "MANDALS");
});
