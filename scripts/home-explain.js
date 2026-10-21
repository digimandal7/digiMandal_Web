require("dotenv").config();
const fs=require("node:fs/promises");
const prisma=require("../src/config/prisma");
const service=require("../src/home/service");
const {fixture}=require("../tests/home/factory");
async function main() {
  const data=await fixture();
  try {
    const queries=[];
    prisma.$on("query",event=>{if(event.query.startsWith("SELECT") && /HomePost|HomeEvent|MandalMember/.test(event.query)) queries.push(event);});
    const ctx=await service.context(data.users[1].id);
    await service.feed(ctx,{limit:"10"});
    await service.eventSection(ctx,false);
    const plans=[];
    for(const query of queries.slice()) {
      const plan=await prisma.$queryRawUnsafe("EXPLAIN "+query.query,...JSON.parse(query.params));
      plans.push({query:query.query,plan});
    }
    await fs.writeFile("docs/home/query-plans.json",JSON.stringify(plans,(_,v)=>typeof v==="bigint"?v.toString():v,2));
    console.log("Captured "+plans.length+" query plans from actual Prisma reads.");
  } finally {await data.cleanup();await prisma.$disconnect();}
}
main().catch(error=>{console.error(error.message);process.exitCode=1;});
