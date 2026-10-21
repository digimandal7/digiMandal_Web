const fs = require("node:fs/promises");
const path = require("node:path");
const crypto = require("node:crypto");
const sharp = require("sharp");
const prisma = require("../config/prisma");
const { fail } = require("./errors");
const telemetry = require("./telemetry");
const spool = path.resolve(__dirname, "../../var/home-media");
async function accept(ownerId, file) {
  if (!file) throw fail(400,"FILE_REQUIRED","Upload an image");
  if (await prisma.homeMedia.count({ where:{ status:"PENDING" } }) >= 100) throw fail(503,"MEDIA_BUSY","Media processing is busy");
  let meta;
  try { meta = await sharp(file.buffer, { limitInputPixels:40000000, animated:false }).metadata(); }
  catch { throw fail(400,"INVALID_IMAGE","Invalid image file"); }
  if (!["jpeg","png","webp"].includes(meta.format) || (meta.pages || 1)>1) throw fail(400,"INVALID_IMAGE","Use a JPEG, PNG or WebP image");
  const mediaId=crypto.randomUUID();
  await fs.mkdir(spool,{ recursive:true });
  const sourcePath=path.join(spool,mediaId+".webp");
  // Re-encoding removes EXIF/GPS and validates the complete image, not just client MIME.
  await sharp(file.buffer,{ limitInputPixels:40000000 }).rotate().webp({ quality:90 }).toFile(sourcePath);
  try {
    return await prisma.homeMedia.create({ data:{ id:mediaId,ownerId,mimeType:"image/webp",sourcePath },
      select:{ id:true,status:true } });
  } catch(error) { await fs.unlink(sourcePath).catch(()=>{}); throw error; }
}
function deadline(promise,ms) {
  let timer;
  return Promise.race([promise,new Promise((_,reject)=>{ timer=setTimeout(()=>reject(new Error("Media upload timeout")),ms); })]).finally(()=>clearTimeout(timer));
}
async function processOne(jobId) {
  const now=new Date();
  const job=await prisma.homeMedia.findFirst({ where:{ ...(jobId?{id:jobId}:{}),status:"PENDING",OR:[{ leaseUntil:null },{ leaseUntil:{ lt:now } }] },orderBy:{ createdAt:"asc" } });
  if(!job) return false;
  const token=crypto.randomUUID();
  const claimed=await prisma.homeMedia.updateMany({ where:{ id:job.id,status:"PENDING",OR:[{ leaseUntil:null },{ leaseUntil:{ lt:now } }] },
    data:{ leaseToken:token,leaseUntil:new Date(Date.now()+300000),attempts:{ increment:1 } } });
  if(!claimed.count) return true;
  try {
    if(!job.sourcePath || path.resolve(job.sourcePath)!==path.join(spool,job.id+".webp")) throw new Error("Invalid spool path");
    const imagekit=require("../config/imagekit"),variants={};
    for(const [name,width] of [["thumbnail",240],["feed",1080],["full",2048]]) {
      const { data,info }=await sharp(job.sourcePath).resize({ width,withoutEnlargement:true }).webp({ quality:80 }).toBuffer({ resolveWithObject:true });
      const upload=await deadline(imagekit.upload({ file:data,fileName:job.id+"-"+name+".webp",
        folder:"/digimandal/home",useUniqueFileName:false,isPrivateFile:true }),25000);
      variants[name]={ path:upload.filePath,width:info.width,height:info.height,bytes:data.length };
    }
    const completed=await prisma.homeMedia.updateMany({ where:{ id:job.id,leaseToken:token },data:{ status:"READY",variants,
      width:variants.full.width,height:variants.full.height,bytes:variants.full.bytes,sourcePath:null,leaseUntil:null,leaseToken:null } });
    if(completed.count) await fs.unlink(job.sourcePath).catch(()=>{});
    telemetry.count("media_completed");
  } catch {
    await prisma.homeMedia.updateMany({ where:{ id:job.id,leaseToken:token },data:{
      status:job.attempts>=2 ? "FAILED" : "PENDING",leaseToken:null,
      leaseUntil:new Date(Date.now()+Math.min(60000,1000*2**job.attempts+Math.random()*1000)) } });
    telemetry.count("media_failed");
  }
  return true;
}
module.exports={ accept,processOne,spool };
