const {test}=require("node:test");
const assert=require("node:assert/strict");
test("OpenAPI validates and covers every v1 route",async()=>{
  const parser=require("@apidevtools/swagger-parser");
  const spec=await parser.validate("docs/home/openapi.json");
  const router=require("../../src/home/routes");
  for(const layer of router.stack) {
    if(!layer.route) continue;
    const path=layer.route.path.replace(/:([A-Za-z]+)/g,"{$1}");
    for(const method of Object.keys(layer.route.methods)) assert.ok(spec.paths[path]?.[method],method+" "+path+" missing from OpenAPI");
  }
});
