require("dotenv").config();
const { test }=require("node:test");
const assert=require("node:assert/strict");
const jwt=require("jsonwebtoken");
const prisma=require("../../src/config/prisma");
const app=require("../../src/server");
const service=require("../../src/home/service");
test("Home contracts, stable snapshots, privacy and retry-safe writes on MySQL", async t => {
  const users=[],mandals=[];
  let server;
  try {
    for(let i=0;i<3;i++) users.push(await prisma.user.create({ data:{ mobile:String(8000000000+Math.floor(Math.random()*999999999)),name:"Home Test "+i,isVerified:true,profileComplete:true,city:"HomeTestCity",state:"TestState",platformRole:i===0?"SUPER_ADMIN":"USER" } }));
    const owner=users[0],viewer=users[1],outsider=users[2];
    const m=await prisma.mandal.create({ data:{ name:"Home test public",category:"Cultural",size:"51-200",status:"ACTIVE",createdById:owner.id,
      address:{ create:{ addressLine1:"Test",city:"HomeTestCity",state:"TestState",pincode:"411001" } },
      roles:{ create:{ name:"Member",permissions:["VIEW_MANDAL"],isSystem:true } } } });
    mandals.push(m.id);
    const privateM=await prisma.mandal.create({ data:{ name:"Private home test",category:"Cultural",status:"ACTIVE",isPrivate:true,createdById:owner.id } });
    mandals.push(privateM.id);
    const makePost=(extra={})=>prisma.homePost.create({ data:{ authorId:owner.id,mandalId:m.id,text:"Community fixture",city:"HomeTestCity",state:"TestState",...extra } });
    const posts=[];
    for(let i=0;i<5;i++) posts.push(await makePost());
    const privatePost=await makePost({ mandalId:privateM.id });
    const hidden=await makePost({ status:"HIDDEN" });
    server=app.listen(0,"127.0.0.1");
    await new Promise(resolve=>server.once("listening",resolve));
    const base="http://127.0.0.1:"+server.address().port+"/api/v1";
    async function call(path,method="GET",body,user=viewer) {
      const response=await fetch(base+path,{ method,headers:{ Authorization:"Bearer "+jwt.sign({userId:user.id},process.env.JWT_SECRET), "Content-Type":"application/json" },
        ...(body===undefined?{}:{ body:JSON.stringify(body) }) });
      const json=await response.json();
      return { status:response.status,...json };
    }
    const first=await call("/home?limit=2");
    assert.equal(first.status,200,JSON.stringify(first));
    assert.equal(first.data.feed.items.length,2);
    assert.equal(first.data.hero.data,null);
    assert.ok(!JSON.stringify(first).includes(owner.mobile));
    assert.ok(!first.data.feed.items.some(p=>[privatePost.id,hidden.id].includes(p.id)));
    const discover=await call("/discover?type=MANDALS&limit=2");
    assert.equal(discover.status,200,JSON.stringify(discover));
    assert.equal(discover.data.selectedType,"MANDALS");
    assert.ok(discover.data.items.every(p=>p.type==="POSTS" && p.mandal.id===m.id));
    const grouped=await call("/discover/search?q=Home&type=ALL");
    assert.equal(grouped.status,200,JSON.stringify(grouped));
    assert.ok(grouped.data.groups.mandals.items.some(item=>item.id===m.id));
    assert.ok(grouped.data.groups.people.items.some(item=>item.id===owner.id));
    assert.ok(!JSON.stringify(grouped).includes(owner.mobile));
    const mandalSearch=await call("/discover/search?q=Home&type=MANDALS&location=HomeTestCity%2CTestState&sort=A_Z");
    assert.equal(mandalSearch.status,200,JSON.stringify(mandalSearch));
    assert.ok(mandalSearch.data.items.some(item=>item.id===m.id));
    assert.equal((await call("/discover/search?q=Home&type=UNKNOWN")).status,400);
    assert.ok((await call("/discover/filters")).data.categories.includes("Cultural"));
    assert.ok((await call("/discover/locations?q=HomeTest")).data.items.some(item=>item.city==="HomeTestCity"));
    const newPost=await makePost();
    const cursor=first.data.feed.nextCursor;
    const second=await call("/home/feed?limit=2&cursor="+encodeURIComponent(cursor));
    const repeated=await call("/home/feed?limit=2&cursor="+encodeURIComponent(cursor));
    assert.deepEqual(second.data.items.map(p=>p.id),repeated.data.items.map(p=>p.id));
    assert.ok(second.data.items.every(p=>p.id!==newPost.id && !first.data.feed.items.some(f=>f.id===p.id)));
    assert.equal((await call("/home/feed?cursor="+encodeURIComponent(cursor),"GET",undefined,outsider)).status,400);
    assert.equal((await call("/posts/"+privatePost.id)).status,404);
    await prisma.mandalMember.create({data:{mandalId:privateM.id,userId:viewer.id,mobile:viewer.mobile,role:"Member"}});
    assert.equal((await call("/posts/"+privatePost.id)).status,200);
    await prisma.mandalMember.deleteMany({where:{mandalId:privateM.id,userId:viewer.id}});
    assert.equal((await call("/posts/"+hidden.id)).status,404);
    const target=posts[0].id;
    const likes=await Promise.all([call("/posts/"+target+"/like","PUT"),call("/posts/"+target+"/like","PUT")]);
    assert.ok(likes.every(r=>r.status===200 && r.data.count===1),JSON.stringify(likes));
    assert.equal((await call("/posts/"+target)).data.viewer.liked,true);
    assert.equal((await call("/posts/"+target,"GET",undefined,outsider)).data.viewer.liked,false);
    assert.equal((await call("/posts/"+target+"/like","DELETE")).data.count,0);
    assert.equal((await call("/posts/"+target+"/like","DELETE")).data.count,0);
    assert.equal((await call("/mandals/"+m.id+"/membership","PUT")).data.joined,true);
    assert.equal((await call("/mandals/"+m.id+"/membership","PUT")).data.count,1);
    assert.equal((await call("/mandals/"+m.id+"/membership","DELETE",undefined,owner)).status,409);
    assert.equal((await call("/mandals/"+privateM.id+"/membership","PUT")).status,404);
    await call("/profiles/"+owner.id+"/block","PUT");
    assert.equal((await call("/posts/"+target)).status,404);
    assert.equal((await call("/home/feed?cursor="+encodeURIComponent(cursor))).data.items.length,0);
    await call("/profiles/"+owner.id+"/block","DELETE");
    await call("/profiles/"+viewer.id+"/block","PUT",undefined,owner);
    assert.equal((await call("/posts/"+target)).status,404);
    await call("/profiles/"+viewer.id+"/block","DELETE",undefined,owner);
    const original=prisma.homeEvent.findMany;
    service.cache.clear();
    try {
      prisma.homeEvent.findMany=async()=>{ throw new Error("simulated optional outage"); };
      const partial=await call("/home");
      assert.equal(partial.status,200);
      assert.equal(partial.data.hero.status,"unavailable");
      assert.ok(partial.data.feed.items.length);
    } finally { prisma.homeEvent.findMany=original; }
    await call("/home/location","PUT",{ city:"AnotherCity",state:"TestState" });
    assert.equal((await call("/home/feed?cursor="+encodeURIComponent(cursor))).status,409);
    assert.equal((await call("/home/feed?limit=999")).status,400);
    assert.equal((await call("/admin/events/1/promotion","PUT",{})).status,403);
    assert.equal((await call("/posts/"+target+"/impression","PUT")).status,200);
    assert.equal((await call("/posts/"+target+"/impression","PUT")).status,200);
    assert.equal(await prisma.homeImpression.count({where:{postId:target,userId:viewer.id}}),1);
    await call("/home/location","PUT",{ city:"HomeTestCity",state:"TestState" });
    const createdPost=await call("/posts","POST",{mandalId:m.id,text:"Created through API",topic:"Community"},owner);
    assert.equal(createdPost.status,201,JSON.stringify(createdPost));
    assert.equal((await call("/posts","POST",{mandalId:m.id,text:"Unauthorized publisher"},viewer)).status,403);
    const event=await call("/events","POST",{ mandalId:m.id,title:"Ganesh Utsav",description:"Community celebration",venue:"Town hall",category:"Festival",
      startsAt:new Date(Date.now()+86400000).toISOString(),endsAt:new Date(Date.now()+172800000).toISOString() },owner);
    assert.equal(event.status,201,JSON.stringify(event));
    assert.equal((await call("/events/"+event.data.id+"/participation","PUT")).data.count,1);
    assert.equal((await call("/events/"+event.data.id+"/participation","PUT")).data.count,1);
    const viewerEvent=await call("/events/"+event.data.id);
    const otherEvent=await call("/events/"+event.data.id,"GET",undefined,outsider);
    assert.equal(viewerEvent.data.isJoined,true);
    assert.equal(otherEvent.data.isJoined,false);
    assert.equal((await call("/admin/events/"+event.data.id+"/promotion","PUT",{
      startsAt:new Date(Date.now()-1000).toISOString(),endsAt:new Date(Date.now()+86400000).toISOString(),priority:10},owner)).status,200);
    const heroResponse=await fetch(base+"/home/hero",{headers:{Authorization:"Bearer "+jwt.sign({userId:viewer.id},process.env.JWT_SECRET)}});
    const etag=heroResponse.headers.get("etag");
    assert.equal((await heroResponse.json()).data.data.id,event.data.id);
    const unchanged=await fetch(base+"/home/hero",{headers:{Authorization:"Bearer "+jwt.sign({userId:viewer.id},process.env.JWT_SECRET),"If-None-Match":etag}});
    assert.equal(unchanged.status,304);
    const comment=await call("/posts/"+target+"/comments","POST",{text:"A useful comment"});
    assert.equal(comment.status,201);
    assert.equal((await call("/posts/"+target+"/comments")).data.items.length,1);
    await call("/profiles/"+owner.id+"/mute","PUT");
    assert.equal((await call("/posts/"+target)).status,404);
    await call("/profiles/"+owner.id+"/mute","DELETE");
    await call("/posts/"+target+"/save","PUT");
    await call("/posts/"+target+"/save","PUT");
    assert.equal((await call("/posts/"+target)).data.viewer.saved,true);
    assert.equal((await call("/posts/"+target,"GET",undefined,outsider)).data.viewer.saved,false);
    const sharp=require("sharp");
    const source=await sharp({create:{width:16,height:8,channels:3,background:"#8844cc"}}).png().toBuffer();
    const form=new FormData(); form.append("file",new Blob([source],{type:"image/png"}),"fixture.png");
    const uploadedResponse=await fetch(base+"/media",{method:"POST",headers:{Authorization:"Bearer "+jwt.sign({userId:owner.id},process.env.JWT_SECRET)},body:form});
    const uploaded=await uploadedResponse.json();
    assert.equal(uploadedResponse.status,202,JSON.stringify(uploaded));
    const imagekit=require("../../src/config/imagekit"),originalUpload=imagekit.upload;
    const calls=[];
    try {
      imagekit.upload=async options=>{calls.push(options);return {filePath:"/digimandal/home/"+options.fileName};};
      await require("../../src/home/media").processOne(uploaded.data.id);
    } finally { imagekit.upload=originalUpload; }
    assert.equal(calls.length,3);
    assert.ok(calls.every(x=>x.isPrivateFile===true));
    const media=await call("/media/"+uploaded.data.id,"GET",undefined,owner);
    assert.equal(media.data.status,"READY");
    assert.equal(media.data.aspectRatio,2);
    assert.ok(media.data.variants.feed.url.includes("ik-s="));
    assert.equal((await call("/media/"+uploaded.data.id)).status,404);
    const story=await call("/stories","POST",{mandalId:m.id,mediaId:uploaded.data.id},owner);
    assert.equal(story.status,201,JSON.stringify(story));
    assert.equal((await call("/stories/"+story.data.id+"/seen","PUT")).status,200);
    assert.equal((await call("/stories/"+story.data.id+"/seen","PUT")).status,200);
    assert.equal(await prisma.homeStorySeen.count({where:{storyId:story.data.id,userId:viewer.id}}),1);
    assert.equal((await call("/home/mandals")).data.find(x=>x.id===m.id).unseen,false);
    assert.equal((await call("/posts/"+createdPost.data.id,"DELETE",undefined,owner)).status,200);
    assert.equal((await call("/posts/"+createdPost.data.id)).status,404);
    const sqlCounts=require("../../src/home/telemetry");
    let before=sqlCounts.metrics().counters.sql_queries;
    await call("/home/feed?limit=1");
    const smallQueries=sqlCounts.metrics().counters.sql_queries-before;
    before=sqlCounts.metrics().counters.sql_queries;
    await call("/home/feed?limit=30");
    const largeQueries=sqlCounts.metrics().counters.sql_queries-before;
    assert.ok(largeQueries<=smallQueries+5 && largeQueries<40,"SQL queries must remain bounded as page size grows");
    const originalPostRead=prisma.homePost.findMany;
    try {
      prisma.homePost.findMany=async()=>{throw Object.assign(new Error("database pool timeout"),{code:"P2024"});};
      const unavailable=await call("/home/feed");
      assert.equal(unavailable.status,503);
      assert.equal(unavailable.retryable,true);
      assert.ok(!JSON.stringify(unavailable).includes("database pool timeout"));
    } finally {prisma.homePost.findMany=originalPostRead;}
    const monitoring=await call("/admin/home/metrics","GET",undefined,owner);
    assert.equal(monitoring.status,200);
    assert.ok(monitoring.data.samples>0);
    // Scrolling beyond forty posts must not prevent a deliberate like/save.
    for(let i=0;i<45;i++) assert.equal((await call("/posts/"+target+"/impression","PUT",undefined,outsider)).status,200);
    assert.equal((await call("/posts/"+target+"/like","PUT",undefined,outsider)).status,200);
    for(let i=45;i<80;i++) assert.equal((await call("/posts/"+target+"/impression","PUT",undefined,outsider)).status,200);
    assert.equal((await call("/posts/"+target+"/impression","PUT",undefined,outsider)).status,429);
    assert.equal((await call("/posts/"+target+"/save","PUT",undefined,outsider)).status,200);
    t.diagnostic("Validated real MySQL: pagination across inserts, replay, private/moderated content, user isolation, concurrent likes, joins, blocks, partial failure, location changes and impressions.");
  } finally {
    if(server) { server.closeAllConnections(); await new Promise(r=>server.close(r)); }
    await prisma.mandal.deleteMany({ where:{ id:{ in:mandals } } });
    await prisma.user.deleteMany({ where:{ id:{ in:users.map(u=>u.id) } } });
    await prisma.$disconnect();
  }
});
