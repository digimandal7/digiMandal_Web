const fs=require("node:fs");
const path=require("node:path");
const out=path.resolve(__dirname,"../docs/home");
const string=(maxLength)=>({type:"string",...(maxLength?{maxLength}:{})});
const int={type:"integer",minimum:1};
const timestamp={type:"string",format:"date-time"};
const nullable=schema=>({...schema,nullable:true});
const object=(properties,required=Object.keys(properties))=>({type:"object",properties,required});
const ref=name=>({$ref:"#/components/schemas/"+name});
const array=items=>({type:"array",items});
const schemas={
  Error:object({success:{type:"boolean",enum:[false]},code:string(),message:string(),retryable:{type:"boolean"},requestId:{type:"string",format:"uuid"},retryAfter:{type:"integer"}},["success","code","message","retryable","requestId"]),
  User:object({id:int,name:nullable(string()),profileImage:nullable(string())}),
  Location:object({city:nullable(string(100)),state:nullable(string(100)),area:nullable(string(100))}),
  Mandal:object({id:int,name:string(),avatarUrl:nullable(string()),isJoined:{type:"boolean"},deepLink:string()}),
  Variant:object({url:{type:"string",format:"uri"},width:int,height:int}),
  Media:object({id:string(),status:{type:"string",enum:["PENDING","READY","FAILED"]},mimeType:string(),width:nullable(int),height:nullable(int),
    aspectRatio:nullable({type:"number"}),bytes:nullable({type:"integer"}),variants:nullable(object({thumbnail:ref("Variant"),feed:ref("Variant"),full:ref("Variant")}))}),
  Event:object({id:int,title:string(),description:string(),venue:string(),city:string(),state:string(),category:string(),startsAt:timestamp,endsAt:timestamp,
    priority:{type:"integer"},media:nullable(ref("Media")),mandal:ref("Mandal"),isJoined:{type:"boolean"},participantCount:{type:"integer"},deepLink:string()}),
  Post:object({id:int,text:string(),topic:nullable(string()),voice:nullable(string()),publishedAt:timestamp,author:ref("User"),mandal:ref("Mandal"),media:array(ref("Media")),
    event:nullable(ref("Event")),counts:object({likes:{type:"integer"},comments:{type:"integer"}}),
    viewer:object({liked:{type:"boolean"},saved:{type:"boolean"},joined:{type:"boolean"}}),visibility:{type:"string",enum:["PUBLIC","MEMBERS"]},sponsored:{type:"boolean"},deepLink:string()}),
  Feed:object({items:array(ref("Post")),nextCursor:nullable(string()),snapshotExpiresAt:timestamp}),
  Section:object({status:{type:"string",enum:["ok","unavailable"]},freshness:{type:"string",enum:["fresh","stale","missing"]},data:{nullable:true},
    error:object({code:string(),retryable:{type:"boolean"}}),asOf:timestamp,durationMs:{type:"number"}},["status","freshness","data"]),
  Home:object({schemaVersion:{type:"string",enum:["1.0"]},serverTime:timestamp,viewer:ref("User"),location:ref("Location"),mandals:ref("Section"),hero:ref("Section"),trending:ref("Section"),
    feed:{allOf:[ref("Feed"),object({status:string(),freshness:string()})]},quickActions:array(object({id:string(),label:string(),deepLink:string()}))}),
};
const paths={},items=[];
function add(method,route,summary,{body,response,example,description="",query=[],multipart=false,admin=false}={}) {
  const status=method==="post" && ["/posts","/events","/stories","/posts/{id}/comments"].includes(route)?"201":route==="/media"&&method==="post"?"202":"200";
  const envelope=object({success:{type:"boolean",enum:[true]},data:response||{type:"object"},requestId:string()});
  const operation={summary,description:(admin?"Requires platform SUPER_ADMIN. ":"")+description,operationId:method+"_"+route.replace(/[^a-zA-Z]/g,"_"),
    security:[{bearerAuth:[]}],parameters:[...([...route.matchAll(/\{([^}]+)\}/g)].map(m=>({name:m[1],in:"path",required:true,schema:m[1]==="id" && route!=="/media/{id}"?int:string()}))),...query],
    responses:{[status]:{description:"Successful response",content:{"application/json":{schema:envelope,...(example?{example:{success:true,data:example,requestId:"01234567-89ab-4cde-8f01-234567890abc"}}:{})}}},
      ...Object.fromEntries([400,401,403,404,409,410,413,429,500,503].map(code=>[String(code),{description:"Safe error envelope",content:{"application/json":{schema:ref("Error")}}}]))}};
  if(body) operation.requestBody={required:true,content:{[multipart?"multipart/form-data":"application/json"]:{schema:body}}};
  (paths[route] ||= {})[method]=operation;
  let sample=body?Object.fromEntries(Object.entries(body.properties||{}).filter(([k])=>body.required?.includes(k))
    .map(([k,v])=>[k,v.example??(k==="mediaId"?"{{media_id}}":v.type==="integer"?1:v.type==="array"?[]:v.type==="boolean"?false:v.format==="date-time"?(k==="endsAt"?"2027-01-01T18:00:00Z":"2027-01-01T10:00:00Z"):"example")])):undefined;
  const request={method:method.toUpperCase(),url:"{{home_base_url}}"+route.replace("{id}",route.startsWith("/media")?"{{media_id}}":route.startsWith("/events")?"{{event_id}}":route.startsWith("/mandals")?"{{mandal_id}}":route.startsWith("/stories")?"{{story_id}}":route.startsWith("/profiles")?"{{user_id}}":"{{post_id}}").replace("{kind}","posts"),description:operation.description};
  if(body) {
    if(multipart) request.body={mode:"formdata",formdata:[{key:"file",type:"file",src:""}]};
    else {request.header=[{key:"Content-Type",value:"application/json"}];request.body={mode:"raw",raw:JSON.stringify(sample,null,2)};}
  }
  if(route.includes("/events/")) request.url=request.url.replace("{{post_id}}","{{event_id}}");
  if(route==="/home/feed") request.url+="?cursor={{cursor}}&limit=10";
  if(request.body?.mode==="raw") request.body.raw=request.body.raw.replace('"mandalId": 1','"mandalId": {{mandal_id}}');
  const item={name:summary,request};
  if(method==="get" && ["/home","/home/feed"].includes(route)) item.event=[{listen:"test",script:{type:"text/javascript",exec:[
    "const data=pm.response.json().data;",
    "const feed=data?.feed || data;",
    "if(feed?.nextCursor) pm.collectionVariables.set('cursor',feed.nextCursor);",
    "if(feed?.items?.length) pm.collectionVariables.set('post_id',feed.items[0].id);"
  ]}}];
  if(method==="post" && ["/posts","/events","/stories","/media"].includes(route)) {
    const variable={"/posts":"post_id","/events":"event_id","/stories":"story_id","/media":"media_id"}[route];
    item.event=[{listen:"test",script:{type:"text/javascript",exec:["const data=pm.response.json().data;","if(data?.id) pm.collectionVariables.set('"+variable+"',data.id);"]}}];
  }
  items.push(item);
}
const paging=[{name:"limit",in:"query",schema:{type:"integer",minimum:1,maximum:30,default:10}},{name:"cursor",in:"query",schema:string()}];
add("get","/home","Home bootstrap",{response:ref("Home"),query:paging,description:"Optional sections may return status=unavailable. Core feed/authentication failure fails the request. Keep serverTime for countdowns."});
add("get","/home/feed","Next feed page",{response:ref("Feed"),query:paging,description:"30-minute HMAC-signed cursor bound to viewer and selected location. Up to 300 snapshot candidates. Short/empty pages can occur after moderation; follow nextCursor."});
for(const name of ["mandals","hero","trending"]) add("get","/home/"+name,"Home "+name,{description:"Independently loadable section. Hero/trending support private ETag revalidation."});
add("put","/home/location","Select Home location",{body:object({city:{...string(100),example:"Pune"},state:{...string(100),example:"Maharashtra"},area:nullable(string(100))},["city","state"]),response:ref("Location")});
for(const [resource,schema] of [["posts","Post"],["events","Event"],["mandals","Mandal"],["profiles","User"]]) add("get","/"+resource+"/{id}","View "+resource,{response:ref(schema)});
for(const action of ["like","save"]) for(const method of ["put","delete"]) add(method,"/posts/{id}/"+action,method+" "+action,{description:"Idempotent, returns authoritative state and count. Retried transaction conflicts are bounded."});
for(const [resource,action] of [["mandals","membership"],["events","participation"]]) for(const method of ["put","delete"]) add(method,"/"+resource+"/{id}/"+action,method+" "+action,{description:"Idempotent. Private Mandals require invitation through existing onboarding APIs."});
add("put","/posts/{id}/impression","Record impression",{description:"Deduplicated per user/post/UTC day. Retained for 30 days by worker."});
add("put","/posts/{id}/report","Report post",{body:object({reason:{...string(500),example:"Spam"}})});
for(const kind of ["block","mute"]) for(const method of ["put","delete"]) add(method,"/profiles/{id}/"+kind,method+" "+kind);
add("get","/posts/{id}/comments","List comments",{query:paging,description:"Descending ID cursor pagination. Hidden/deleted comments and filtered authors omitted."});
add("post","/posts/{id}/comments","Create comment",{body:object({text:{...string(2000),example:"Thank you for organizing this."}})});
add("post","/posts","Create community post",{body:object({mandalId:int,text:{...string(5000),example:"Join us for the community celebration."},topic:nullable(string(100)),visibility:{type:"string",enum:["PUBLIC","MEMBERS"],example:"PUBLIC"},eventId:nullable(int),mediaIds:{type:"array",maxItems:4,items:string()}},["mandalId","text"]),description:"Requires MANAGE_POSTS or creator/Admin. Media must be owned and READY. Locality is taken from the Mandal address; voice badges cannot be self-assigned."});
add("delete","/posts/{id}","Delete post",{description:"Soft delete by author or MANAGE_POSTS role."});
add("post","/events","Create event",{body:object({mandalId:int,title:{...string(200),example:"Ganesh Utsav"},description:{...string(5000),example:"Community celebration"},venue:{...string(255),example:"Community hall"},category:{...string(100),example:"Festival"},startsAt:{...timestamp,example:"2027-01-01T10:00:00Z"},endsAt:{...timestamp,example:"2027-01-01T18:00:00Z"},mediaId:nullable(string())},["mandalId","title","description","venue","category","startsAt","endsAt"]),description:"Requires MANAGE_EVENTS. Mandal must be active with an address."});
add("put","/admin/events/{id}/promotion","Schedule hero promotion",{admin:true,body:object({startsAt:timestamp,endsAt:timestamp,priority:{type:"integer",minimum:1,maximum:100}})});
add("put","/admin/{kind}/{id}/moderation","Moderate content",{admin:true,body:object({status:{type:"string",enum:["PUBLISHED","HIDDEN","DELETED"],example:"HIDDEN"}}),description:"kind: posts, events, stories, comments."});
add("post","/stories","Create 24-hour story",{body:object({mandalId:int,mediaId:string()}),description:"Requires MANAGE_POSTS and READY owned media."});
add("get","/stories/{id}","View story");
add("put","/stories/{id}/seen","Record story seen",{description:"Idempotent and privacy checked."});
add("post","/media","Upload media",{multipart:true,body:object({file:{type:"string",format:"binary"}}),description:"JPEG/PNG/WebP, max 10 MiB/40MP, no animation. Returns 202 PENDING; poll media endpoint. Worker must run."});
add("get","/media/{id}","Poll own media",{response:ref("Media")});
add("get","/admin/home/metrics","Inspect Home metrics",{admin:true});
add("get","/admin/home/metrics/prometheus","Scrape Home Prometheus metrics",{admin:true});
paths["/admin/home/metrics/prometheus"].get.responses["200"]={description:"Prometheus text exposition",content:{"text/plain":{schema:{type:"string"}}}};
const spec={openapi:"3.0.3",info:{title:"DigiMandal Home API",version:"1.0.0",description:"Additive v1 API. Bearer token from existing /api/auth flow. No UI changes."},
  servers:[{url:"http://localhost:3000/api/v1"}],paths,components:{securitySchemes:{bearerAuth:{type:"http",scheme:"bearer",bearerFormat:"JWT"}},schemas}};
const exampleMandal={id:7,name:"Ekta Mandal",avatarUrl:null,isJoined:true,deepLink:"digimandal://mandals/7"};
const examplePost={id:101,text:"Join our community celebration this weekend.",topic:"Festival",voice:null,publishedAt:"2026-10-15T10:00:00.000Z",
  author:{id:42,name:"Asha",profileImage:null},mandal:exampleMandal,media:[],event:null,counts:{likes:12,comments:3},
  viewer:{liked:false,saved:false,joined:true},visibility:"PUBLIC",sponsored:false,deepLink:"digimandal://posts/101"};
paths["/posts/{id}"].get.responses["200"].content["application/json"].example={success:true,data:examplePost,requestId:"01234567-89ab-4cde-8f01-234567890abc"};
paths["/home/feed"].get.responses["200"].content["application/json"].example={success:true,data:{items:[examplePost],nextCursor:null,snapshotExpiresAt:"2026-10-15T10:30:00.000Z"},requestId:"01234567-89ab-4cde-8f01-234567890abc"};
fs.mkdirSync(out,{recursive:true});
fs.writeFileSync(path.join(out,"openapi.json"),JSON.stringify(spec,null,2));
const collection={info:{name:"DigiMandal Home v1",schema:"https://schema.getpostman.com/json/collection/v2.1.0/collection.json"},
  auth:{type:"bearer",bearer:[{key:"token",value:"{{token}}",type:"string"}]},item:items,
  variable:[{key:"home_base_url",value:"http://localhost:3000/api/v1"},...["token","cursor","post_id","mandal_id","event_id","story_id","media_id","user_id"].map(key=>({key,value:""}))]};
fs.writeFileSync(path.join(out,"DigiMandal_Home.postman_collection.json"),JSON.stringify(collection,null,2));
console.log("Generated OpenAPI and Postman contracts for "+items.length+" operations.");
