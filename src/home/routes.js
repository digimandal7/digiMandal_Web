const router = require("express").Router();
const rateLimit = require("express-rate-limit");
const multer = require("multer");
const crypto = require("node:crypto");
const prisma = require("../config/prisma");
const { auth } = require("../middlewares/auth.middleware");
const { superAdmin } = require("../middlewares/super-admin.middleware");
const { requireMandalPermission } = require("../services/mandal-access.service");
const { fail } = require("./errors");
const { integer, text, date, encodeCursor, decodeCursor } = require("./core");
const service = require("./service");
const telemetry = require("./telemetry");
const wrap = handler => (req, res, next) => Promise.resolve(handler(req, res)).catch(next);
const id = value => integer(value, undefined, 2147483647);
const send = (req, res, data, status = 200) => {
  if (res.headersSent || req.homeAbort.signal.aborted) return;
  res.status(status).json({ success: true, data, requestId: req.requestId });
};
const limiter = (limit) => rateLimit({ windowMs: 60000, limit, standardHeaders: true, legacyHeaders: false,
  keyGenerator: req => String(req.user.userId),
  handler: (req, res) => res.status(429).json({ success: false, code: "RATE_LIMITED", message: "Please retry later",
    retryable: true, retryAfter: 60, requestId: req.requestId }) });

router.use(telemetry.middleware);
router.use(rateLimit({windowMs:60000,limit:1800,standardHeaders:true,legacyHeaders:false,
  handler:(req,res)=>res.status(429).json({success:false,code:"RATE_LIMITED",message:"Please retry later",retryable:true,retryAfter:60,requestId:req.requestId})}));
let inFlight=0;
router.use((req,res,next) => {
  if(inFlight>=64) return next(fail(503,"SERVER_BUSY","Please retry"));
  inFlight++;
  let released=false;
  const release=()=>{ if(!released) { released=true; inFlight--; } };
  res.once("finish",release); res.once("close",release);
  next();
});
router.use(auth);
router.use(require("express").json({ limit: "64kb" }));
router.use((req, res, next) => Promise.resolve().then(async () => {
  if (!Number.isSafeInteger(req.user.userId) || req.user.userId < 1) throw fail(401, "UNAUTHORIZED", "Please sign in");
  const user = await prisma.user.findUnique({ where: { id: req.user.userId }, select: { id: true } });
  if (!user) throw fail(401, "UNAUTHORIZED", "Please sign in");
  req.homeUser = user;
  next();
}).catch(next));
router.use(limiter(180));
const mutationLimit = limiter(40);
const passiveLimit = limiter(80);
const { isPassiveWrite } = require("./traffic");
router.use((req, res, next) => req.method === "GET" ? next() :
  (isPassiveWrite(req) ? passiveLimit : mutationLimit)(req, res, next));

router.get("/home", wrap(async (req,res) => send(req,res,await service.bootstrap(await service.context(req.user.userId), req.query))));
router.get("/home/feed", wrap(async (req,res) => send(req,res,await service.feed(await service.context(req.user.userId), req.query))));
router.get("/home/mandals", wrap(async (req,res) => send(req,res,await service.rail(await service.context(req.user.userId)))));
for (const [path, hero] of [["hero", true], ["trending", false]]) {
  router.get("/home/" + path, wrap(async (req,res) => {
    const result = await service.eventSection(await service.context(req.user.userId), hero);
    const etag = '"' + crypto.createHash("sha256").update(JSON.stringify([req.user.userId, result.data])).digest("hex") + '"';
    res.setHeader("ETag", etag);
    res.setHeader("Cache-Control", "private, no-cache");
    res.setHeader("Vary", "Authorization");
    if (req.headers["if-none-match"] === etag) return res.status(304).end();
    send(req,res,result);
  }));
}
router.put("/home/location", wrap(async (req,res) => {
  const data = { city: text(req.body.city,100), state: text(req.body.state,100), area: text(req.body.area,100,false) };
  await prisma.homeLocation.upsert({ where: { userId: req.user.userId }, create: { userId: req.user.userId, ...data }, update: data });
  send(req,res,data);
}));
router.get("/posts/:id", wrap(async (req,res) => {
  const items = await service.hydrate(await service.context(req.user.userId), [id(req.params.id)]);
  if (!items.length) throw fail(404,"NOT_FOUND","Post not found");
  send(req,res,items[0]);
}));
router.get("/events/:id", wrap(async (req,res) => {
  const items = await service.events(await service.context(req.user.userId), [id(req.params.id)]);
  if (!items.length) throw fail(404,"NOT_FOUND","Event not found");
  send(req,res,items[0]);
}));
router.get("/mandals/:id", wrap(async (req,res) => {
  const ctx = await service.context(req.user.userId);
  const m = await prisma.mandal.findFirst({ where: { ...service.mandalWhere(ctx), id: id(req.params.id) },
    include: { _count: { select: { members: true } } } });
  if (!m) throw fail(404,"NOT_FOUND","Mandal not found");
  send(req,res,{ ...service.mandalView(m,ctx), description: m.description, category: m.category, memberCount: m._count.members });
}));
router.get("/profiles/:id", wrap(async (req,res) => {
  const ctx = await service.context(req.user.userId);
  const targetId = id(req.params.id);
  const user = ctx.excluded.includes(targetId) ? null : await prisma.user.findUnique({ where: { id: targetId }, select: service.userSelect });
  if (!user) throw fail(404,"NOT_FOUND","Profile not found");
  send(req,res,{ ...user, deepLink: service.link("profiles",user.id) });
}));

// Database uniqueness and serializable transactions protect retries and concurrent toggles.
async function transaction(task) {
  for (let attempt = 0; ; attempt++) {
    try { return await prisma.$transaction(task, { isolationLevel: "Serializable", maxWait: 1500, timeout: 5000 }); }
    catch (error) {
      if (!["P2034", "P2002"].includes(error.code) || attempt >= 2) throw error;
      await new Promise(resolve => setTimeout(resolve, 15 + Math.random() * 40));
    }
  }
}
async function visiblePost(tx, userId, postId) {
  const ctx = await service.context(userId, tx);
  const post = await tx.homePost.findFirst({ where: { ...service.postWhere(ctx), id: postId } });
  if (!post) throw fail(404,"NOT_FOUND","Post not found");
  return post;
}
for (const [kind, model] of [["like","homeLike"],["save","homeSave"]]) {
  for (const method of ["put","delete"]) router[method]("/posts/:id/" + kind, wrap(async (req,res) => {
    const postId = id(req.params.id), userId = req.user.userId, active = method === "put";
    const result = await transaction(async tx => {
      await visiblePost(tx,userId,postId);
      if (active) await tx[model].upsert({ where: { postId_userId: { postId,userId } }, create: { postId,userId }, update: {} });
      else await tx[model].deleteMany({ where: { postId,userId } });
      return { postId, [kind === "like" ? "liked" : "saved"]: active, count: await tx[model].count({ where: { postId } }) };
    });
    send(req,res,result);
  }));
}
for (const method of ["put","delete"]) router[method]("/mandals/:id/membership", wrap(async (req,res) => {
  const mandalId = id(req.params.id), userId = req.user.userId, active = method === "put";
  send(req,res,await transaction(async tx => {
    const ctx = await service.context(userId,tx);
    const mandal = await tx.mandal.findFirst({ where: { ...service.mandalWhere(ctx), id: mandalId } });
    if (!mandal) throw fail(404,"NOT_FOUND","Mandal not found");
    const existing = await tx.mandalMember.findUnique({ where: { mandalId_userId: { mandalId,userId } } });
    if (!active && mandal.createdById === userId) throw fail(409,"CREATOR_MUST_REMAIN","The creator must remain an Admin");
    if (active && !existing) {
      if (mandal.isPrivate) throw fail(403,"INVITATION_REQUIRED","An invitation is required");
      const role = await tx.mandalRole.findUnique({ where: { mandalId_name: { mandalId,name:"Member" } } });
      // Self-join must never adopt a modified privileged role.
      if (role && role.permissions.some(p => !["VIEW_MANDAL","VIEW_MEMBERS","VIEW_DOCUMENTS"].includes(p)))
        throw fail(409,"ROLE_REQUIRES_INVITATION","An invitation is required for this role");
      const user = await tx.user.findUnique({ where: { id:userId }, select: { mobile:true } });
      await tx.mandalMember.create({ data: { mandalId,userId,mobile:user.mobile,role:"Member",roleId:role?.id || null } });
    } else if (!active) await tx.mandalMember.deleteMany({ where: { mandalId,userId } });
    return { mandalId,joined:active,count:await tx.mandalMember.count({ where:{ mandalId } }) };
  }));
}));
for (const method of ["put","delete"]) router[method]("/events/:id/participation", wrap(async (req,res) => {
  const eventId=id(req.params.id),userId=req.user.userId,active=method==="put";
  send(req,res,await transaction(async tx => {
    const ctx=await service.context(userId,tx);
    const event=await tx.homeEvent.findFirst({ where:{ ...service.eventWhere(ctx),id:eventId } });
    if (!event) throw fail(404,"NOT_FOUND","Event not found");
    if (active && event.endsAt <= new Date()) throw fail(409,"EVENT_ENDED","Event has ended");
    if (active) await tx.homeParticipant.upsert({ where:{ eventId_userId:{ eventId,userId } }, create:{ eventId,userId },update:{} });
    else await tx.homeParticipant.deleteMany({ where:{ eventId,userId } });
    return { eventId,joined:active,count:await tx.homeParticipant.count({ where:{ eventId } }) };
  }));
}));
router.put("/posts/:id/impression", wrap(async (req,res) => {
  const postId=id(req.params.id),userId=req.user.userId,day=new Date().toISOString().slice(0,10);
  await transaction(async tx => {
    await visiblePost(tx,userId,postId);
    await tx.homeImpression.upsert({ where:{ postId_userId_day:{ postId,userId,day } },create:{ postId,userId,day },update:{} });
  });
  send(req,res,{ recorded:true });
}));
router.put("/posts/:id/report", wrap(async (req,res) => {
  const postId=id(req.params.id),userId=req.user.userId,reason=text(req.body.reason,500);
  await transaction(async tx => {
    await visiblePost(tx,userId,postId);
    await tx.homeReport.upsert({ where:{ postId_userId:{ postId,userId } },create:{ postId,userId,reason },update:{ reason } });
  });
  send(req,res,{ reported:true });
}));
for (const kind of ["block","mute"]) for (const method of ["put","delete"]) {
  router[method]("/profiles/:id/" + kind, wrap(async (req,res) => {
    const targetId=id(req.params.id),userId=req.user.userId,active=method==="put";
    if (targetId===userId) throw fail(400,"INVALID_TARGET","Cannot filter yourself");
    if (!await prisma.user.findUnique({ where:{ id:targetId },select:{ id:true } })) throw fail(404,"NOT_FOUND","Profile not found");
    const key={ userId,targetId,kind:kind.toUpperCase() };
    if(active) await prisma.homeFilter.upsert({ where:{ userId_targetId_kind:key },create:key,update:{} });
    else await prisma.homeFilter.deleteMany({ where:key });
    send(req,res,{ targetId,[kind==="mute" ? "muted" : "blocked"]:active });
  }));
}
router.get("/posts/:id/comments", wrap(async (req,res) => {
  const postId=id(req.params.id),ctx=await service.context(req.user.userId),limit=integer(req.query.limit,20);
  await visiblePost(prisma,ctx.userId,postId);
  let before=2147483647;
  if(req.query.cursor) {
    const cursor=decodeCursor(req.query.cursor,ctx.userId);
    if(cursor.s!=="comments:"+postId) throw fail(400,"INVALID_CURSOR","Invalid comment cursor");
    before=cursor.i;
  }
  const rows=await prisma.homeComment.findMany({ where:{ postId,status:"PUBLISHED",authorId:{ notIn:ctx.excluded },id:{ lt:before } },
    orderBy:{ id:"desc" },take:limit+1,select:{ id:true,text:true,createdAt:true,author:{ select:service.userSelect } } });
  const items=rows.slice(0,limit);
  send(req,res,{ items,nextCursor:rows.length>limit ? encodeCursor({ s:"comments:"+postId,u:ctx.userId,i:items.at(-1).id,exp:Date.now()+1800000 }) : null });
}));
router.post("/posts/:id/comments", wrap(async (req,res) => {
  const postId=id(req.params.id),content=text(req.body.text,2000);
  const comment=await transaction(async tx => {
    await visiblePost(tx,req.user.userId,postId);
    return tx.homeComment.create({ data:{ postId,authorId:req.user.userId,text:content },select:{ id:true,text:true,createdAt:true } });
  });
  send(req,res,comment,201);
}));

async function ownMedia(mediaId,userId,tx=prisma) {
  const media=await tx.homeMedia.findFirst({ where:{ id:text(mediaId,40),ownerId:userId,status:"READY" } });
  if(!media) throw fail(400,"MEDIA_NOT_READY","Select your processed media");
  return media;
}
router.post("/posts", wrap(async (req,res) => {
  const mandalId=id(req.body.mandalId);
  await requireMandalPermission(mandalId,req.user.userId,"MANAGE_POSTS");
  const body=text(req.body.text,5000),topic=text(req.body.topic,100,false);
  const visibility=req.body.visibility || "PUBLIC";
  if(!["PUBLIC","MEMBERS"].includes(visibility)) throw fail(400,"INVALID_VISIBILITY","Invalid visibility");
  const mediaIds=req.body.mediaIds || [];
  if(!Array.isArray(mediaIds) || mediaIds.length>4 || new Set(mediaIds).size!==mediaIds.length) throw fail(400,"INVALID_MEDIA","Choose at most four media items");
  const post=await transaction(async tx => {
    const ctx=await service.context(req.user.userId,tx);
    const mandal=await tx.mandal.findFirst({ where:{ ...service.mandalWhere(ctx),id:mandalId },include:{ address:true } });
    if(!mandal?.address) throw fail(409,"MANDAL_NOT_READY","Mandal needs an active profile and address");
    const eventId=req.body.eventId ? id(req.body.eventId) : null;
    if(eventId && !await tx.homeEvent.findFirst({ where:{ ...service.eventWhere(ctx),id:eventId,mandalId } })) throw fail(400,"INVALID_EVENT","Select an event from this Mandal");
    for(const mediaId of mediaIds) {
      const media=await ownMedia(mediaId,req.user.userId,tx);
      if(media.postId) throw fail(409,"MEDIA_IN_USE","Media is already attached");
    }
    const created=await tx.homePost.create({ data:{ mandalId,authorId:req.user.userId,text:body,topic,eventId,
      visibility,city:mandal.address.city,state:mandal.address.state } });
    await tx.homeMedia.updateMany({ where:{ id:{ in:mediaIds },ownerId:req.user.userId,postId:null },data:{ postId:created.id } });
    return created;
  });
  send(req,res,{ id:post.id,deepLink:service.link("posts",post.id) },201);
}));
router.delete("/posts/:id", wrap(async (req,res) => {
  const postId=id(req.params.id);
  const post=await prisma.homePost.findUnique({ where:{ id:postId } });
  if(!post) throw fail(404,"NOT_FOUND","Post not found");
  if(post.authorId!==req.user.userId) await requireMandalPermission(post.mandalId,req.user.userId,"MANAGE_POSTS");
  await prisma.homePost.update({ where:{ id:postId },data:{ status:"DELETED" } });
  send(req,res,{ deleted:true });
}));
router.post("/events", wrap(async (req,res) => {
  const mandalId=id(req.body.mandalId);
  await requireMandalPermission(mandalId,req.user.userId,"MANAGE_EVENTS");
  const startsAt=date(req.body.startsAt),endsAt=date(req.body.endsAt);
  if(endsAt<=startsAt || endsAt<=new Date()) throw fail(400,"INVALID_SCHEDULE","Invalid event schedule");
  const mandal=await prisma.mandal.findUnique({ where:{ id:mandalId },include:{ address:true } });
  if(mandal.status!=="ACTIVE" || !mandal.address) throw fail(409,"MANDAL_NOT_READY","Mandal needs an active profile and address");
  const mediaId=req.body.mediaId ? (await ownMedia(req.body.mediaId,req.user.userId)).id : null;
  const event=await prisma.homeEvent.create({ data:{ mandalId,title:text(req.body.title,200),description:text(req.body.description,5000),
    venue:text(req.body.venue,255),category:text(req.body.category,100),city:mandal.address.city,state:mandal.address.state,startsAt,endsAt,mediaId } });
  service.cache.clear();
  send(req,res,{ id:event.id,deepLink:service.link("events",event.id) },201);
}));
router.put("/admin/events/:id/promotion", superAdmin, wrap(async (req,res) => {
  const promotionStart=date(req.body.startsAt),promotionEnd=date(req.body.endsAt);
  if(promotionEnd<=promotionStart) throw fail(400,"INVALID_SCHEDULE","Invalid promotion schedule");
  await prisma.homeEvent.update({ where:{ id:id(req.params.id) },data:{ promotionStart,promotionEnd,priority:integer(req.body.priority,1,100) } });
  service.cache.clear();
  send(req,res,{ promoted:true });
}));
router.put("/admin/:kind/:id/moderation", superAdmin, wrap(async (req,res) => {
  const models={ posts:"homePost",events:"homeEvent",stories:"homeStory",comments:"homeComment" };
  const model=models[req.params.kind],status=req.body.status;
  if(!model || !["PUBLISHED","HIDDEN","DELETED"].includes(status)) throw fail(400,"INVALID_INPUT","Invalid moderation state");
  await prisma[model].update({ where:{ id:id(req.params.id) },data:{ status } });
  service.cache.clear();
  send(req,res,{ status });
}));
router.post("/stories", wrap(async (req,res) => {
  const mandalId=id(req.body.mandalId);
  await requireMandalPermission(mandalId,req.user.userId,"MANAGE_POSTS");
  const media=await ownMedia(req.body.mediaId,req.user.userId);
  const mandal=await prisma.mandal.findUnique({ where:{ id:mandalId } });
  if(mandal.status!=="ACTIVE") throw fail(409,"MANDAL_NOT_READY","Mandal must be active");
  const story=await prisma.homeStory.create({ data:{ mandalId,mediaId:media.id,expiresAt:new Date(Date.now()+86400000) } });
  send(req,res,{ id:story.id,expiresAt:story.expiresAt },201);
}));
async function storyFor(ctx,storyId,db=prisma) {
  const story=await db.homeStory.findFirst({ where:{ id:storyId,status:"PUBLISHED",expiresAt:{ gt:new Date() },mandal:service.mandalWhere(ctx) } });
  if(!story) throw fail(404,"NOT_FOUND","Story not found");
  return story;
}
router.get("/stories/:id", wrap(async (req,res) => {
  const story=await storyFor(await service.context(req.user.userId),id(req.params.id));
  const media=await prisma.homeMedia.findUnique({ where:{ id:story.mediaId } });
  send(req,res,{ id:story.id,mandalId:story.mandalId,expiresAt:story.expiresAt,media:service.mediaView(media) });
}));
router.put("/stories/:id/seen", wrap(async (req,res) => {
  const storyId=id(req.params.id),userId=req.user.userId;
  await transaction(async tx => {
    await storyFor(await service.context(userId,tx),storyId,tx);
    await tx.homeStorySeen.upsert({ where:{ storyId_userId:{ storyId,userId } },create:{ storyId,userId },update:{} });
  });
  send(req,res,{ storyId,seen:true });
}));
const upload=multer({ storage:multer.memoryStorage(),limits:{ fileSize:10*1024*1024,files:1,fields:0 } });
let activeUploads=0;
function uploadCapacity(req,res,next) {
  if(activeUploads>=2) return next(fail(503,"MEDIA_BUSY","Media processing is busy"));
  activeUploads++;
  let released=false;
  const release=()=>{if(!released){released=true;activeUploads--;}};
  res.once("finish",release);res.once("close",release);next();
}
router.post("/media", uploadCapacity, upload.single("file"), wrap(async (req,res) => {
  const result=await require("./media").accept(req.user.userId,req.file);
  send(req,res,result,202);
}));
router.get("/media/:id", wrap(async (req,res) => {
  const media=await prisma.homeMedia.findFirst({ where:{ id:text(req.params.id,40),ownerId:req.user.userId } });
  if(!media) throw fail(404,"NOT_FOUND","Media not found");
  send(req,res,service.mediaView(media));
}));
router.get("/admin/home/metrics", superAdmin, wrap(async (req,res) => send(req,res,{
  ...telemetry.metrics(),cache:{ hits:service.cache.hits,misses:service.cache.misses,stale:service.cache.stale,entries:service.cache.entries.size },
  pendingMedia:await prisma.homeMedia.count({ where:{ status:"PENDING" } }),
  failedMedia:await prisma.homeMedia.count({ where:{ status:"FAILED" } }),
})));
router.get("/admin/home/metrics/prometheus", superAdmin, wrap(async (req,res) => {
  const pending=await prisma.homeMedia.count({where:{status:"PENDING"}});
  const failed=await prisma.homeMedia.count({where:{status:"FAILED"}});
  res.type("text/plain").send(telemetry.prometheus()
    +"digimandal_home_media_pending "+pending+"\n"+"digimandal_home_media_failed "+failed+"\n"
    +"digimandal_home_cache_hits_total "+service.cache.hits+"\n"
    +"digimandal_home_cache_misses_total "+service.cache.misses+"\n");
}));
router.use((req,res,next) => next(fail(404,"NOT_FOUND","Endpoint not found")));
router.use((error,req,res,next) => {
  if(res.headersSent) return;
  const known={ P2025:[404,"NOT_FOUND"],P2002:[409,"CONFLICT"],P2034:[409,"RETRY_WRITE"],P2024:[503,"DATABASE_BUSY"],LIMIT_FILE_SIZE:[413,"FILE_TOO_LARGE"] };
  const mapped=known[error.code];
  const status=mapped?.[0] || error.status || 500;
  const code=mapped?.[1] || (status<500 ? error.code : null) || "INTERNAL_ERROR";
  telemetry.count("error_"+code);
  res.status(status).json({ success:false,code,message:status>=500 ? "Service temporarily unavailable" : (error.status ? error.message : "Request could not be completed"),
    retryable:status>=500 || code==="RETRY_WRITE",requestId:req.requestId });
});
module.exports=router;
