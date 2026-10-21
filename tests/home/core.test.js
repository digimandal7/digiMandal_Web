const { test } = require("node:test");
const assert = require("node:assert/strict");
process.env.HOME_CURSOR_SECRET = "unit-test-only-secret";
const { integer, text, date, encodeCursor, decodeCursor, rank, SectionCache, config } = require("../../src/home/core");
test("only exact passive PUT routes use the separate telemetry budget", () => {
  const {isPassiveWrite} = require("../../src/home/traffic");
  for (const path of ["/posts/12/impression", "/stories/4/seen/"]) assert.equal(isPassiveWrite({method:"PUT",path}),true);
  for (const path of ["/posts/12/like", "/posts/12/impression/extra", "/posts/not-an-id/impression", "/profiles/1/block"]) assert.equal(isPassiveWrite({method:"PUT",path}),false);
  assert.equal(isPassiveWrite({method:"DELETE",path:"/posts/12/impression"}),false);
});
test("signed cursors reject tampering, another viewer, and expiry", () => {
  const payload={ s:"snapshot",u:1,i:10,exp:Date.now()+60000 };
  const token=encodeCursor(payload);
  assert.equal(decodeCursor(token,1).i,10);
  assert.throws(()=>decodeCursor(token+"x",1),{ code:"INVALID_CURSOR" });
  assert.throws(()=>decodeCursor(token,2),{ code:"INVALID_CURSOR" });
  assert.throws(()=>decodeCursor(token,1,Date.now()+120000),{ code:"CURSOR_EXPIRED" });
  assert.throws(()=>decodeCursor("x".repeat(3000),1));
});
test("ranking deterministic with affinity and diversity", () => {
  const now=Date.now(),ctx={ location:{ city:"Pune",state:"Maharashtra" },joined:new Set([1]) };
  const posts=Array.from({length:6},(_,i)=>({ id:i+1,mandalId:i<4?1:2,city:"Pune",state:"Maharashtra",publishedAt:new Date(now),_count:{ likes:0 } }));
  const first=rank(posts,ctx,now);
  assert.deepEqual(rank(posts.slice().reverse(),ctx,now),first);
  assert.equal(new Set(first).size,6);
  assert.ok(first[2]>=5);
});
test("bounded cache coalesces loads, caches empty results and serves safe stale IDs", async () => {
  const cache=new SectionCache(2);
  let calls=0;
  const loader=async()=>{ calls++; await new Promise(r=>setTimeout(r,5)); return []; };
  const results=await Promise.all(Array.from({length:10},()=>cache.get("public:Pune",loader,10000)));
  assert.equal(calls,1);
  assert.ok(results.every(x=>x.data.length===0));
  const entry=cache.entries.get("public:Pune");
  entry.freshUntil=0;
  const stale=await cache.get("public:Pune",async()=>{ throw Error("offline"); });
  assert.equal(stale.freshness,"stale");
  await new Promise(r=>setTimeout(r,10));
  await cache.get("Mumbai",async()=>[1]);
  await cache.get("Delhi",async()=>[2]);
  assert.equal(cache.entries.size,2);
});
test("validation bounds, dates and ranking configuration", () => {
  assert.equal(integer(undefined,10),10);
  for(const value of ["x",-1,0,31,"1.2",["2","3"]]) assert.throws(()=>integer(value,10));
  assert.throws(()=>text({},10));
  assert.throws(()=>date("2026-10-10"));
  assert.throws(()=>date("not-a-dateZ"));
  process.env.HOME_RANK_RECENCY="NaN";
  assert.throws(()=>config());
  delete process.env.HOME_RANK_RECENCY;
});
test("optional sections have a bounded timeout", async () => {
  const {optional}=require("../../src/home/service");
  const start=Date.now();
  const result=await optional("test",()=>new Promise(()=>{}),[]);
  assert.equal(result.status,"unavailable");
  assert.ok(Date.now()-start<3000);
});
