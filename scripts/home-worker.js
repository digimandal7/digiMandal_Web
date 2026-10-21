require("dotenv").config();
const prisma=require("../src/config/prisma");
const { processOne,spool }=require("../src/home/media");
const fs=require("node:fs/promises");
const path=require("node:path");
let stopping=false;
process.on("SIGTERM",()=>{ stopping=true; });
process.on("SIGINT",()=>{ stopping=true; });
async function cleanup() {
  const now=new Date(),cutoff=new Date(Date.now()-30*86400000);
  // Each pass is bounded; subsequent ticks drain old rows.
  const snapshots=await prisma.homeSnapshot.findMany({ where:{ expiresAt:{ lt:now } },take:500,select:{ id:true } });
  await prisma.homeSnapshot.deleteMany({ where:{ id:{ in:snapshots.map(x=>x.id) } } });
  const impressions=await prisma.homeImpression.findMany({ where:{ createdAt:{ lt:cutoff } },take:500 });
  if(impressions.length) await prisma.homeImpression.deleteMany({ where:{ OR:impressions.map(x=>({ postId:x.postId,userId:x.userId,day:x.day })) } });
  const failed=await prisma.homeMedia.findMany({ where:{ status:"FAILED",createdAt:{ lt:new Date(Date.now()-86400000) },sourcePath:{ not:null } },take:50 });
  for(const row of failed) {
    if(row.sourcePath===path.join(spool,row.id+".webp")) await fs.unlink(row.sourcePath).catch(()=>{});
    await prisma.homeMedia.update({ where:{ id:row.id },data:{ sourcePath:null } });
  }
}
async function main() {
  let lastCleanup=0;
  do {
    if(Date.now()-lastCleanup>60000) { await cleanup(); lastCleanup=Date.now(); }
    const worked=await processOne();
    if(process.argv.includes("--once")) break;
    if(!worked) await new Promise(resolve=>setTimeout(resolve,1000));
  } while(!stopping);
}
main().catch(()=>{ console.error(JSON.stringify({ event:"home_worker_failed" })); process.exitCode=1; }).finally(()=>prisma.$disconnect());
