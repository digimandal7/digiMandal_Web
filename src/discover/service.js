const prisma = require("../config/prisma");
const home = require("../home/service");
const { fail } = require("../home/errors");

const TYPES = ["ALL", "MANDALS", "PEOPLE", "POSTS", "ACADEMIES", "VENDORS"];
const SORTS = ["RELEVANCE", "A_Z", "Z_A", "NEAREST", "LATEST"];
const academyTerms = ["academy", "education", "school", "training", "class"];
const vendorTerms = ["vendor", "business", "service", "supplier", "shop"];

function text(value, name, max = 200, required = false) {
  if (value === undefined || value === null || value === "") {
    if (required) throw fail(400, "VALIDATION_ERROR", `${name} is required`);
    return undefined;
  }
  if (typeof value !== "string" || !value.trim() || value.trim().length > max)
    throw fail(400, "VALIDATION_ERROR", `${name} must be 1-${max} characters`);
  return value.trim();
}
function choice(value, values, name, fallback) {
  const normalized = String(value || fallback).toUpperCase();
  if (!values.includes(normalized))
    throw fail(
      400,
      "VALIDATION_ERROR",
      `${name} must be one of ${values.join(", ")}`,
    );
  return normalized;
}
function page(query) {
  const pageNumber = Number(query.page || 1),
    limit = Number(query.limit || 20);
  if (!Number.isSafeInteger(pageNumber) || pageNumber < 1)
    throw fail(400, "VALIDATION_ERROR", "page must be a positive integer");
  if (!Number.isSafeInteger(limit) || limit < 1 || limit > 50)
    throw fail(400, "VALIDATION_ERROR", "limit must be between 1 and 50");
  return { page: pageNumber, limit, skip: (pageNumber - 1) * limit };
}
function typeFor(category = "") {
  const value = category.toLowerCase();
  if (academyTerms.some((term) => value.includes(term))) return "ACADEMIES";
  if (vendorTerms.some((term) => value.includes(term))) return "VENDORS";
  return "MANDALS";
}
function categoryWhere(type) {
  const academy = academyTerms.map((contains) => ({ category: { contains } }));
  const vendor = vendorTerms.map((contains) => ({ category: { contains } }));
  if (type === "ACADEMIES") return { OR: academy };
  if (type === "VENDORS") return { OR: vendor };
  if (type === "MANDALS") return { NOT: { OR: [...academy, ...vendor] } };
  return {};
}
function location(query, ctx) {
  if (query.useCurrentLocation === "true") return ctx.location;
  const selected = text(query.location, "location", 200);
  if (!selected) return null;
  const [city, state] = selected.split(",").map((part) => part.trim());
  return { city, state: state || undefined, area: undefined };
}
function locationWhere(selected, relation = "address") {
  if (!selected?.city) return {};
  return {
    [relation]: {
      city: selected.city,
      ...(selected.state ? { state: selected.state } : {}),
    },
  };
}
function organizationView(row, ctx) {
  return {
    type: typeFor(row.category),
    id: row.id,
    name: row.name,
    category: row.category,
    description: row.description,
    avatarUrl: row.avatarUrl,
    location: row.address
      ? {
          city: row.address.city,
          state: row.address.state,
          pincode: row.address.pincode,
          formattedAddress: row.address.formattedAddress,
          latitude: row.address.latitude,
          longitude: row.address.longitude,
        }
      : null,
    memberCount: row._count.members,
    isJoined: ctx.joined.has(row.id) || row.createdById === ctx.userId,
    deepLink: home.link("mandals", row.id),
  };
}
function personView(row) {
  return {
    type: "PEOPLE",
    id: row.id,
    name: row.name,
    avatar: row.profileImage,
    location: { city: row.city, state: row.state },
    deepLink: home.link("profiles", row.id),
  };
}
const postView = (row) => ({ type: "POSTS", ...row });
function pageResult(items, total, paging) {
  return {
    items,
    total,
    page: paging.page,
    limit: paging.limit,
    hasNext: paging.skip + items.length < total,
  };
}
function organizationOrder(sort, selected) {
  if (sort === "A_Z") return [{ name: "asc" }, { id: "asc" }];
  if (sort === "Z_A") return [{ name: "desc" }, { id: "desc" }];
  if (sort === "NEAREST" && selected?.city)
    return [{ address: { city: "asc" } }, { name: "asc" }, { id: "asc" }];
  return [{ createdAt: "desc" }, { id: "desc" }];
}
async function organizations(ctx, query, type, paging, db = prisma) {
  const q = text(query.q, "q", 200);
  const selected = location(query, ctx);
  const categories = String(query.categories || "")
    .split(",")
    .map((value) => value.trim())
    .filter(Boolean);
  const where = {
    AND: [
      home.mandalWhere(ctx),
      categoryWhere(type),
      locationWhere(selected),
      ...(q
        ? [
            {
              OR: [
                { name: { contains: q } },
                { category: { contains: q } },
                { description: { contains: q } },
                { address: { city: { contains: q } } },
              ],
            },
          ]
        : []),
      ...(categories.length ? [{ category: { in: categories } }] : []),
    ],
  };
  const [rows, total] = await Promise.all([
    db.mandal.findMany({
      where,
      include: { address: true, _count: { select: { members: true } } },
      orderBy: organizationOrder(
        choice(query.sort, SORTS, "sort", "RELEVANCE"),
        selected,
      ),
      skip: paging.skip,
      take: paging.limit,
    }),
    db.mandal.count({ where }),
  ]);
  return pageResult(
    rows.map((row) => organizationView(row, ctx)),
    total,
    paging,
  );
}
async function people(ctx, query, paging, db = prisma) {
  const q = text(query.q, "q", 200, true);
  const selected = location(query, ctx);
  const where = {
    id: { notIn: ctx.excluded },
    profileComplete: true,
    name: { contains: q },
    ...(selected?.city ? { city: selected.city } : {}),
    ...(selected?.state ? { state: selected.state } : {}),
  };
  const sort = choice(query.sort, SORTS, "sort", "RELEVANCE");
  const orderBy =
    sort === "Z_A"
      ? [{ name: "desc" }, { id: "desc" }]
      : sort === "LATEST"
        ? [{ createdAt: "desc" }, { id: "desc" }]
        : [{ name: "asc" }, { id: "asc" }];
  const [rows, total] = await Promise.all([
    db.user.findMany({
      where,
      select: {
        id: true,
        name: true,
        profileImage: true,
        city: true,
        state: true,
      },
      orderBy,
      skip: paging.skip,
      take: paging.limit,
    }),
    db.user.count({ where }),
  ]);
  return pageResult(rows.map(personView), total, paging);
}
async function posts(ctx, query, paging, db = prisma) {
  const q = text(query.q, "q", 200, true);
  const selected = location(query, ctx);
  const where = {
    AND: [
      home.postWhere(ctx),
      {
        OR: [
          { text: { contains: q } },
          { topic: { contains: q } },
          { mandal: { name: { contains: q } } },
          { author: { name: { contains: q } } },
        ],
      },
      ...(selected?.city ? [{ city: selected.city }] : []),
      ...(selected?.state ? [{ state: selected.state }] : []),
    ],
  };
  const [rows, total] = await Promise.all([
    db.homePost.findMany({
      where,
      select: { id: true },
      orderBy: [{ publishedAt: "desc" }, { id: "desc" }],
      skip: paging.skip,
      take: paging.limit,
    }),
    db.homePost.count({ where }),
  ]);
  const hydrated = await home.hydrate(
    ctx,
    rows.map((row) => row.id),
    db,
  );
  return pageResult(hydrated.map(postView), total, paging);
}
async function search(userId, query, db = prisma) {
  const ctx = await home.context(userId, db);
  const type = choice(query.type, TYPES, "type", "ALL");
  const paging = page(query);
  if (type === "PEOPLE")
    return { type, ...(await people(ctx, query, paging, db)) };
  if (type === "POSTS")
    return { type, ...(await posts(ctx, query, paging, db)) };
  if (["MANDALS", "ACADEMIES", "VENDORS"].includes(type))
    return { type, ...(await organizations(ctx, query, type, paging, db)) };
  text(query.q, "q", 200, true);
  const preview = { page: 1, limit: Math.min(paging.limit, 3), skip: 0 };
  const [mandals, academies, vendors, peopleResult, postResult] =
    await Promise.all([
      organizations(ctx, query, "MANDALS", preview, db),
      organizations(ctx, query, "ACADEMIES", preview, db),
      organizations(ctx, query, "VENDORS", preview, db),
      people(ctx, query, preview, db),
      posts(ctx, query, preview, db),
    ]);
  return {
    type,
    groups: {
      mandals,
      academies,
      vendors,
      people: peopleResult,
      posts: postResult,
    },
  };
}
async function discover(userId, query, db = prisma) {
  const ctx = await home.context(userId, db);
  const type = choice(
    query.type,
    ["MANDALS", "ACADEMIES", "VENDORS"],
    "type",
    "MANDALS",
  );
  const paging = page(query);
  const selected = location(query, ctx) || ctx.location;
  const postWhere = {
    AND: [
      home.postWhere(ctx),
      {
        mandal: {
          AND: [
            home.mandalWhere(ctx),
            categoryWhere(type),
            locationWhere(selected),
          ],
        },
      },
    ],
  };
  const [postRows, total, heroRows] = await Promise.all([
    db.homePost.findMany({
      where: postWhere,
      select: { id: true },
      orderBy: [{ publishedAt: "desc" }, { id: "desc" }],
      skip: paging.skip,
      take: paging.limit,
    }),
    db.homePost.count({ where: postWhere }),
    db.homeEvent.findMany({
      where: {
        ...home.eventWhere(ctx),
        endsAt: { gt: new Date() },
        ...(selected?.city ? { city: selected.city } : {}),
        ...(selected?.state ? { state: selected.state } : {}),
        mandal: { AND: [home.mandalWhere(ctx), categoryWhere(type)] },
      },
      orderBy: [{ priority: "desc" }, { startsAt: "asc" }, { id: "asc" }],
      take: 1,
      select: { id: true },
    }),
  ]);
  const [items, heroes] = await Promise.all([
    home.hydrate(
      ctx,
      postRows.map((row) => row.id),
      db,
    ),
    home.events(
      ctx,
      heroRows.map((row) => row.id),
      db,
    ),
  ]);
  return {
    tabs: ["MANDALS", "ACADEMIES", "VENDORS"],
    selectedType: type,
    location: selected,
    hero: heroes[0] ? { ...heroes[0], badge: "LIVE_EVENT" } : null,
    ...pageResult(items.map(postView), total, paging),
  };
}
async function filters(userId, db = prisma) {
  const ctx = await home.context(userId, db);
  const [mandals, events, topics] = await Promise.all([
    db.mandal.findMany({
      where: home.mandalWhere(ctx),
      distinct: ["category"],
      select: { category: true },
      orderBy: { category: "asc" },
    }),
    db.homeEvent.findMany({
      where: home.eventWhere(ctx),
      distinct: ["category"],
      select: { category: true },
      orderBy: { category: "asc" },
    }),
    db.homePost.findMany({
      where: { ...home.postWhere(ctx), topic: { not: null } },
      distinct: ["topic"],
      select: { topic: true },
      orderBy: { topic: "asc" },
    }),
  ]);
  return {
    sorts: ["A_Z", "Z_A", "NEAREST"],
    categories: [
      ...new Set(
        [
          ...mandals.map((x) => x.category),
          ...events.map((x) => x.category),
          ...topics.map((x) => x.topic),
        ].filter(Boolean),
      ),
    ],
    currentLocation: ctx.location,
  };
}
async function locations(userId, query, db = prisma) {
  const ctx = await home.context(userId, db);
  const q = text(query.q, "q", 100, true);
  const rows = await db.mandalAddress.findMany({
    where: {
      AND: [
        { mandal: home.mandalWhere(ctx) },
        {
          OR: [
            { city: { contains: q } },
            { state: { contains: q } },
            { addressLine2: { contains: q } },
          ],
        },
      ],
    },
    distinct: ["city", "state"],
    select: { city: true, state: true, pincode: true },
    orderBy: [{ city: "asc" }, { state: "asc" }],
    take: 10,
  });
  return {
    currentLocation: ctx.location,
    items: rows.map((row) => ({ label: `${row.city}, ${row.state}`, ...row })),
  };
}

module.exports = {
  TYPES,
  SORTS,
  text,
  choice,
  page,
  typeFor,
  categoryWhere,
  discover,
  search,
  filters,
  locations,
};
