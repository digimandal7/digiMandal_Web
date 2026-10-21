require("dotenv").config();
const fs=require("node:fs/promises");
const os=require("node:os");
const {performance}=require("node:perf_hooks");
const jwt=require("jsonwebtoken");
const prisma=require("../src/config/prisma");
const app=require("../src/server");
const telemetry=require("../src/home/telemetry");
const service=require("../src/home/service");
const {fixture}=require("../tests/home/factory");
async function main() {
  const data=await fixture(),server=app.listen(0,"127.0.0.1");
  await new Promise(r=>server.once("listening",r));
  const base="http://127.0.0.1:"+server.address().port+"/api/v1";
  const tokens=data.users.map(u=>jwt.sign({userId:u.id},process.env.JWT_SECRET));
  const results=[];
  try {
    const cursors=[];
    for(const token of tokens) {
      const response=await fetch(base+"/home/feed?limit=10",{headers:{Authorization:"Bearer "+token}});
      cursors.push((await response.json()).data.nextCursor);
    }
    const post=await prisma.homePost.findFirst({where:{mandalId:{in:data.mandals}},select:{id:true}});
    for(const [name,concurrency,requests,cold] of [["cold",1,8,true],["warm",4,80,false],["spike",16,80,false],["feed-next",4,80,false],["mutation",4,40,false],["sustained",4,240,false]]) {
      let next=0;
      const rows=[],start=performance.now(),before=telemetry.metrics().counters.sql_queries || 0;
      const cacheBefore={hits:service.cache.hits,misses:service.cache.misses};
      await Promise.all(Array.from({length:concurrency},async()=>{
        while(next<requests) {
          const index=next++;
          if(name==="sustained") await new Promise(r=>setTimeout(r,500));
          if(cold) service.cache.clear();
          const at=performance.now();
          const user=index%tokens.length;
          const route=name==="feed-next" ? "/home/feed?limit=10&cursor="+encodeURIComponent(cursors[user])
            : name==="mutation" ? "/posts/"+post.id+"/like" : "/home?limit=10";
          const response=await fetch(base+route,{method:name==="mutation"?"PUT":"GET",headers:{Authorization:"Bearer "+tokens[user]}});
          const body=await response.text();
          rows.push({ms:performance.now()-at,status:response.status,bytes:Buffer.byteLength(body)});
        }
      }));
      const elapsed=performance.now()-start,latency=rows.map(r=>r.ms).sort((a,b)=>a-b),pct=p=>+latency[Math.min(latency.length-1,Math.floor(latency.length*p))].toFixed(2);
      const hits=service.cache.hits-cacheBefore.hits,misses=service.cache.misses-cacheBefore.misses;
      results.push({name,concurrency,requests,seconds:+(elapsed/1000).toFixed(3),requestsPerSecond:+(requests*1000/elapsed).toFixed(2),
        p50:pct(.5),p95:pct(.95),p99:pct(.99),errorRate:rows.filter(r=>r.status!==200).length/requests,
        meanPayloadBytes:Math.round(rows.reduce((s,r)=>s+r.bytes,0)/requests),
        meanSqlQueries:(telemetry.metrics().counters.sql_queries-before)/requests,
        cacheHitRate:hits/(hits+misses || 1)});
    }
    const report={at:new Date().toISOString(),environment:{os:os.platform(),node:process.version,cpus:os.cpus().length,database:"local MySQL",fixture:"8 users, 4 Mandals, 120 text posts, 4 events, 2 localities"},
      limitations:"Short loopback smoke load; no representative production/CDN/video traffic. Does not establish SLO compliance.",results};
    await fs.writeFile("docs/home/load-results.json",JSON.stringify(report,null,2));
    console.log(JSON.stringify(report,null,2));
  } finally {
    server.closeAllConnections(); await new Promise(r=>server.close(r)); await data.cleanup(); await prisma.$disconnect();
  }
}
main().catch(error=>{ console.error(error.message); process.exitCode=1; });
