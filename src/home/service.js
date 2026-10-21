const prisma = require("../config/prisma");
const { fail } = require("./errors");
const { integer, encodeCursor, decodeCursor, rank, SectionCache } = require("./core");
const telemetry = require("./telemetry");
const cache = new SectionCache(100);
const userSelect = { id: true, name: true, profileImage: true };
const link = (type, id) => "digimandal://" + type + "/" + id;

async function context(userId, db = prisma) {
  const [user, filters, memberships] = await Promise.all([
    db.user.findUnique({ where: { id: userId }, select: { ...userSelect, city: true, state: true, homeLocation: true, preferredLanguage: true, mandalsOwned:{select:{id:true}} } }),
    db.homeFilter.findMany({ where: { OR: [{ userId }, { targetId: userId, kind: "BLOCK" }] } }),
    db.mandalMember.findMany({ where: { userId }, select: { mandalId: true } }),
  ]);
  if (!user) throw fail(401, "UNAUTHORIZED", "Please sign in");
  const location = user.homeLocation ? { city: user.homeLocation.city, state: user.homeLocation.state, area: user.homeLocation.area }
    : { city: user.city || null, state: user.state || null, area: null };
  const excluded = [...new Set(filters.map(f => f.userId === userId ? f.targetId : f.userId))];
  return { userId, viewer: { id: user.id, name: user.name, profileImage: user.profileImage, locale: user.preferredLanguage },
    location, locationKey: JSON.stringify(location), excluded, owned:user.mandalsOwned.map(m=>m.id), joined: new Set(memberships.map(m => m.mandalId)) };
}
function mandalWhere(ctx) {
  return { status: "ACTIVE", createdById: { notIn: ctx.excluded },
    OR: [{ isPrivate: false }, { createdById: ctx.userId }, { members: { some: { userId: ctx.userId } } }] };
}
function postWhere(ctx) {
  return { status: "PUBLISHED", publishedAt: { lte: new Date() }, authorId: { notIn: ctx.excluded },
    mandal: mandalWhere(ctx),
    OR: [{ visibility: "PUBLIC" }, { mandal: { members: { some: { userId: ctx.userId } } } }, { mandal: { createdById: ctx.userId } }] };
}
function eventWhere(ctx) { return { status: "PUBLISHED", mandal: mandalWhere(ctx) }; }
function mediaView(media) {
  if (!media) return null;
  const result = { id: media.id, status: media.status, mimeType: media.mimeType, width: media.width, height: media.height,
    aspectRatio: media.width && media.height ? media.width / media.height : null, bytes: media.bytes, variants: null };
  if (media.status === "READY" && media.variants) {
    const imagekit = require("../config/imagekit");
    result.variants = Object.fromEntries(Object.entries(media.variants).map(([name, v]) => [name, {
      width: v.width, height: v.height, url: imagekit.url({ path: v.path, signed: true, expireSeconds: 300 }) }]));
  }
  return result;
}
function mandalView(m, ctx) {
  return { id: m.id, name: m.name, avatarUrl: m.avatarUrl || null, isJoined: ctx.joined.has(m.id) || m.createdById === ctx.userId, deepLink: link("mandals", m.id) };
}
async function events(ctx, ids, db = prisma) {
  if (!ids.length) return [];
  const rows = await db.homeEvent.findMany({ where: { ...eventWhere(ctx), id: { in: ids } },
    include: { mandal: true, participants: { where: { userId: ctx.userId }, select: { userId: true } } } });
  const counts=await db.homeParticipant.groupBy({by:["eventId"],where:{eventId:{in:rows.map(e=>e.id)}},_count:{_all:true}});
  const countMap=new Map(counts.map(c=>[c.eventId,c._count._all]));
  const mediaIds = rows.map(e => e.mediaId).filter(Boolean);
  const media = mediaIds.length ? await db.homeMedia.findMany({ where: { id: { in: mediaIds } } }) : [];
  const lookup = new Map(media.map(m => [m.id, m]));
  return rows.map(e => ({ id: e.id, title: e.title, description: e.description, venue: e.venue, city: e.city, state: e.state,
    category: e.category, startsAt: e.startsAt, endsAt: e.endsAt, priority: e.priority,
    media: mediaView(lookup.get(e.mediaId)), mandal: mandalView(e.mandal, ctx),
    isJoined: e.participants.length > 0, participantCount: countMap.get(e.id)||0, deepLink: link("events", e.id) }));
}
async function hydrate(ctx, ids, db = prisma) {
  if (!ids.length) return [];
  const rows = await db.homePost.findMany({ where: { ...postWhere(ctx), id: { in: ids } },
    include: { author: { select: userSelect }, mandal: true, media: { take: 4, orderBy: { id: "asc" } },
      likes: { where: { userId: ctx.userId }, select: { userId: true } }, saves: { where: { userId: ctx.userId }, select: { userId: true } } } });
  const visibleIds=rows.map(p=>p.id);
  const [likes,comments]=await Promise.all([
    db.homeLike.groupBy({by:["postId"],where:{postId:{in:visibleIds}},_count:{_all:true}}),
    db.homeComment.groupBy({by:["postId"],where:{postId:{in:visibleIds},status:"PUBLISHED",authorId:{notIn:ctx.excluded}},_count:{_all:true}}),
  ]);
  const likeCounts=new Map(likes.map(c=>[c.postId,c._count._all])),commentCounts=new Map(comments.map(c=>[c.postId,c._count._all]));
  const attached = await events(ctx, [...new Set(rows.map(p => p.eventId).filter(Boolean))], db);
  const eventMap = new Map(attached.map(e => [e.id, e]));
  const map = new Map(rows.map(p => [p.id, { id: p.id, text: p.text, topic: p.topic, voice: p.voice,
    publishedAt: p.publishedAt, author: p.author, mandal: mandalView(p.mandal, ctx), media: p.media.map(mediaView),
    event: eventMap.get(p.eventId) || null, counts: { likes: likeCounts.get(p.id)||0, comments: commentCounts.get(p.id)||0 },
    viewer: { liked: p.likes.length > 0, saved: p.saves.length > 0, joined: ctx.joined.has(p.mandalId) || p.mandal.createdById === ctx.userId },
    visibility: p.visibility, sponsored: false, deepLink: link("posts", p.id) }]));
  return ids.map(id => map.get(id)).filter(Boolean);
}
async function feed(ctx, query, db = prisma) {
  const limit = integer(query.limit, 10);
  let snapshot, offset = 0;
  if (query.cursor !== undefined) {
    const cursor = decodeCursor(query.cursor, ctx.userId);
    snapshot = await db.homeSnapshot.findUnique({ where: { id: cursor.s } });
    if (!snapshot || snapshot.userId !== ctx.userId || snapshot.expiresAt <= new Date()) throw fail(410, "CURSOR_EXPIRED", "Refresh the feed");
    if (snapshot.locationKey !== ctx.locationKey) throw fail(409, "LOCATION_CHANGED", "Refresh the feed after changing location");
    offset = cursor.i;
    if (offset > snapshot.postIds.length) throw fail(400, "INVALID_CURSOR", "Invalid feed cursor");
  } else {
    const affiliated=[...new Set([...ctx.joined,...ctx.owned])];
    const sources=[];
    if(affiliated.length) sources.push({mandalId:{in:affiliated}});
    if(ctx.location.city && ctx.location.state) sources.push({city:ctx.location.city,state:ctx.location.state,visibility:"PUBLIC"});
    // Separate bounded locality/relationship scans let the compound indexes serve each access path.
    const batches=await Promise.all(sources.map(source=>db.homePost.findMany({where:{AND:[postWhere(ctx),source]},
      take:150,orderBy:[{publishedAt:"desc"},{id:"desc"}],
      select:{id:true,mandalId:true,city:true,state:true,publishedAt:true,event:{select:{startsAt:true}}}})));
    const candidates=[...new Map(batches.flat().map(p=>[p.id,p])).values()];
    const quality=await db.homeLike.groupBy({by:["postId"],where:{postId:{in:candidates.map(p=>p.id)}},_count:{_all:true}});
    const qualityMap=new Map(quality.map(c=>[c.postId,c._count._all]));
    for(const p of candidates) p._count={likes:qualityMap.get(p.id)||0};
    snapshot = await db.homeSnapshot.create({ data: { userId: ctx.userId, locationKey: ctx.locationKey,
      postIds: rank(candidates, ctx), expiresAt: new Date(Date.now() + 30 * 60000) } });
  }
  // Advance over snapshot positions, including removed/ineligible items: never refill with new posts.
  const ids = snapshot.postIds.slice(offset, offset + limit);
  const items = await hydrate(ctx, ids, db);
  const next = offset + ids.length;
  return { items, nextCursor: next < snapshot.postIds.length ? encodeCursor({ s: snapshot.id, u: ctx.userId, i: next, exp: snapshot.expiresAt.getTime() }) : null,
    snapshotExpiresAt: snapshot.expiresAt };
}
async function rail(ctx, db = prisma) {
  const sources = [{ members: { some: { userId: ctx.userId } } }, { createdById: ctx.userId }];
  if (ctx.location.city && ctx.location.state) sources.push({ isPrivate: false, address: { city: ctx.location.city, state: ctx.location.state } });
  const rows = await db.mandal.findMany({ where: { AND: [mandalWhere(ctx), { OR: sources }] }, orderBy: { id: "asc" }, take: 20,
    include: { homeStories: { where: { status: "PUBLISHED", expiresAt: { gt: new Date() } }, orderBy: { id: "desc" }, take: 20,
      include: { seen: { where: { userId: ctx.userId }, select: { userId: true } } } } } });
  return rows.map(m => ({ ...mandalView(m, ctx), activeStoryCount: m.homeStories.length,
    unseen: m.homeStories.some(s => !s.seen.length), storyIds: m.homeStories.map(s => s.id) }))
    .sort((a,b) => Number(b.unseen) - Number(a.unseen) || Number(b.isJoined) - Number(a.isJoined) || a.id - b.id)
    .map((m, sortRank) => ({ ...m, sortRank }));
}
async function eventSection(ctx, hero, db = prisma) {
  if (!ctx.location.city || !ctx.location.state) return { data: hero ? null : [], freshness: "fresh", asOf: new Date().toISOString() };
  // Only public candidate IDs are shared. Every read rechecks authorization and hydrates live viewer state.
  const cached = await cache.get(JSON.stringify(["v1", hero ? "hero" : "trending", ctx.location.city, ctx.location.state]), async () => {
    const now = new Date();
    const rows = await db.homeEvent.findMany({ where: { city: ctx.location.city, state: ctx.location.state, status: "PUBLISHED",
      endsAt: { gt: now }, mandal: { isPrivate: false, status: "ACTIVE" },
      ...(hero ? { promotionStart: { lte: now }, promotionEnd: { gt: now } } : {}) },
      orderBy: [{ priority: "desc" }, { startsAt: "asc" }, { id: "asc" }], take: hero ? 5 : 12, select: { id: true } });
    return rows.map(e => e.id);
  });
  const now = new Date();
  const valid = await db.homeEvent.findMany({ where: { id: { in: cached.data }, ...eventWhere(ctx), endsAt: { gt: now },
    ...(hero ? { promotionStart: { lte: now }, promotionEnd: { gt: now } } : {}) }, select: { id: true } });
  const allowed = new Set(valid.map(e => e.id));
  const hydrated = await events(ctx, cached.data.filter(id => allowed.has(id)), db);
  hydrated.sort((a,b) => cached.data.indexOf(a.id) - cached.data.indexOf(b.id));
  return { data: hero ? (hydrated[0] ? { ...hydrated[0], cta: { label: "View details", deepLink: hydrated[0].deepLink } } : null) : hydrated,
    freshness: cached.freshness, asOf: cached.asOf };
}
async function optional(name, task, fallback) {
  let timer;
  const start = Date.now();
  try {
    const result = await Promise.race([task(), new Promise((_, reject) => { timer = setTimeout(() => reject(fail(503, "SECTION_TIMEOUT", "Section unavailable")), 2000); })]);
    return { data: result.data === undefined ? result : result.data, status: "ok", freshness: result.freshness || "fresh", asOf: result.asOf || new Date().toISOString(), durationMs: Date.now() - start };
  } catch {
    telemetry.count("partial_" + name);
    return { data: fallback, status: "unavailable", freshness: "missing", error: { code: "SECTION_UNAVAILABLE", retryable: true } };
  } finally { clearTimeout(timer); }
}
async function bootstrap(ctx, query) {
  const [community, mandals, hero, trending] = await Promise.all([
    feed(ctx, query), optional("mandals", () => rail(ctx), []),
    optional("hero", () => eventSection(ctx, true), null), optional("trending", () => eventSection(ctx, false), []),
  ]);
  return { schemaVersion: "1.0", serverTime: new Date().toISOString(), viewer: ctx.viewer, location: ctx.location,
    mandals, hero, trending, feed: { status: "ok", freshness: "fresh", ...community },
    quickActions: [{ id: "mandals", label: "Mandals", deepLink: "digimandal://mandals" }, { id: "events", label: "Events", deepLink: "digimandal://events" }] };
}
module.exports = { context, mandalWhere, postWhere, eventWhere, mediaView, mandalView, hydrate, feed, rail, events, eventSection, bootstrap, optional, cache, userSelect, link };
