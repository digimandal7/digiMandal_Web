const { test } = require("node:test");
const assert = require("node:assert/strict");
const parser = require("@apidevtools/swagger-parser");
const routes = require("../../src/issues/routes");
const Ajv = require("ajv");
test("OpenAPI covers every routed operation and its examples conform to response DTOs", async () => {
  const spec = await parser.validate("docs/issues/openapi.json");
  const source = require("../../docs/issues/openapi.json");
  for (const layer of routes.stack.filter((layer) => layer.route)) {
    const path = layer.route.path.replace(/:(\w+)/g, "{$1}");
    for (const method of Object.keys(layer.route.methods))
      assert.ok(
        spec.paths[path]?.[method],
        `${method} ${path} missing contract`,
      );
  }
  const ajv = new Ajv({ strict: false });
  ajv.addFormat(
    "date-time",
    (value) =>
      Number.isFinite(Date.parse(value)) &&
      /T.*(Z|[+-]\d{2}:\d{2})$/.test(value),
  );
  ajv.addFormat(
    "uuid",
    /^[a-f0-9]{8}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{12}$/i,
  );
  for (const [path, operations] of Object.entries(spec.paths)) {
    for (const [method, op] of Object.entries(operations)) {
      assert.ok(
        op.responses[401] && op.responses[404],
        `${method} ${path} authorization responses`,
      );
      for (const response of Object.values(op.responses)) {
        const media = response.content?.["application/json"];
        if (!media?.example) continue;
        const validate = ajv.compile(media.schema);
        assert.ok(
          validate(media.example),
          `${method} ${path}: ${JSON.stringify(validate.errors)}`,
        );
      }
      const request = op.requestBody?.content?.["application/json"];
      if (request?.example) {
        const validate = ajv.compile(request.schema);
        assert.ok(
          validate(request.example),
          `${method} ${path} request: ${JSON.stringify(validate.errors)}`,
        );
      }
    }
  }
  assert.equal(source.security[0].bearerAuth.length, 0);
});
