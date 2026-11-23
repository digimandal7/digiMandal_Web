const fs = require("node:fs");
const path = require("node:path");

const out = path.resolve(__dirname, "../docs/discover");
const parameter = (name, schema, description) => ({
  name,
  in: "query",
  schema,
  description,
});
const query = [
  parameter(
    "q",
    { type: "string", maxLength: 200 },
    "Required for search endpoints",
  ),
  parameter("type", {
    type: "string",
    enum: ["ALL", "MANDALS", "PEOPLE", "POSTS", "ACADEMIES", "VENDORS"],
  }),
  parameter("location", { type: "string", example: "Thane, Maharashtra" }),
  parameter("useCurrentLocation", { type: "boolean" }),
  parameter("sort", {
    type: "string",
    enum: ["RELEVANCE", "A_Z", "Z_A", "NEAREST", "LATEST"],
  }),
  parameter("categories", {
    type: "string",
    description:
      "Comma-separated exact category names returned by /discover/filters",
  }),
  parameter("page", { type: "integer", minimum: 1, default: 1 }),
  parameter("limit", { type: "integer", minimum: 1, maximum: 50, default: 20 }),
];
const success = {
  description: "Successful response",
  content: {
    "application/json": { schema: { $ref: "#/components/schemas/Success" } },
  },
};
const errors = Object.fromEntries(
  [400, 401, 404, 429, 500].map((code) => [
    code,
    {
      description: "Error",
      content: {
        "application/json": { schema: { $ref: "#/components/schemas/Error" } },
      },
    },
  ]),
);
const operation = (summary, description, parameters = query) => ({
  summary,
  description,
  security: [{ bearerAuth: [] }],
  parameters,
  responses: { 200: success, ...errors },
});
const spec = {
  openapi: "3.0.3",
  info: {
    title: "DigiMandal Discover API",
    version: "1.0.0",
    description:
      "Dynamic Discover feed and search over existing active Mandals, profiles, public posts and events. Academy and Vendor organization types are derived centrally from Mandal categories until dedicated organization types are introduced.",
  },
  servers: [{ url: "http://localhost:3000/api/v1" }],
  paths: {
    "/discover": {
      get: operation(
        "Load Discover tab",
        "Returns Mandals/Academies/Vendors tabs, selected location, optional live-event hero and paginated post cards.",
        query.filter((x) => x.name !== "q" && x.name !== "categories"),
      ),
    },
    "/discover/search": {
      get: operation(
        "Search Discover",
        "type=ALL returns grouped previews. A specific type returns one paginated result list. Blocked, private and moderated resources are excluded.",
      ),
    },
    "/discover/filters": {
      get: operation(
        "Load Discover filter values",
        "Returns current location, supported sort values and categories derived from visible database content.",
        [],
      ),
    },
    "/discover/locations": {
      get: operation(
        "Autocomplete Discover locations",
        "Returns up to 10 distinct city/state suggestions from visible Mandal address data.",
        [query[0]],
      ),
    },
  },
  components: {
    securitySchemes: {
      bearerAuth: { type: "http", scheme: "bearer", bearerFormat: "JWT" },
    },
    schemas: {
      Success: {
        type: "object",
        required: ["success", "data", "requestId", "serverTime"],
        properties: {
          success: { type: "boolean", enum: [true] },
          data: { type: "object", additionalProperties: true },
          requestId: { type: "string", format: "uuid" },
          serverTime: { type: "string", format: "date-time" },
        },
      },
      Error: {
        type: "object",
        required: ["success", "code", "message"],
        properties: {
          success: { type: "boolean", enum: [false] },
          code: { type: "string" },
          message: { type: "string" },
        },
      },
    },
  },
};
const urls = [
  ["Discover tab", "/discover?type=MANDALS&page=1&limit=20"],
  ["Grouped search", "/discover/search?q=Mitra&type=ALL&limit=3"],
  [
    "All Mandal results",
    "/discover/search?q=Mitra&type=MANDALS&sort=A_Z&page=1&limit=20",
  ],
  ["People results", "/discover/search?q=Priya&type=PEOPLE&page=1&limit=20"],
  ["Post results", "/discover/search?q=music&type=POSTS&page=1&limit=20"],
  ["Filter values", "/discover/filters"],
  ["Location suggestions", "/discover/locations?q=Vasa"],
];
const collection = {
  info: {
    name: "DigiMandal Discover API",
    schema:
      "https://schema.getpostman.com/json/collection/v2.1.0/collection.json",
  },
  auth: {
    type: "bearer",
    bearer: [{ key: "token", value: "{{token}}", type: "string" }],
  },
  variable: [
    { key: "base_url", value: "http://localhost:3000/api/v1" },
    { key: "token", value: "" },
  ],
  item: urls.map(([name, url]) => ({
    name,
    request: { method: "GET", url: "{{base_url}}" + url },
  })),
};
fs.mkdirSync(out, { recursive: true });
fs.writeFileSync(
  path.join(out, "openapi.json"),
  JSON.stringify(spec, null, 2) + "\n",
);
fs.writeFileSync(
  path.join(out, "DigiMandal-Discover.postman_collection.json"),
  JSON.stringify(collection, null, 2) + "\n",
);
console.log("Generated Discover OpenAPI and Postman files.");
