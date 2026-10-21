const crypto = require("node:crypto");
const { fail } = require("./errors");

function integer(value, fallback, max = 30) {
  if (value === undefined) return fallback;
  if (!/^\d+$/.test(String(value)) || !Number.isSafeInteger(Number(value)) || Number(value) < 1 || Number(value) > max)
    throw fail(400, "INVALID_INPUT", "Expected a positive integer within the supported range");
  return Number(value);
}
function text(value, max, required = true) {
  if (typeof value !== "string" || !value.trim() || value.trim().length > max) {
    if (!required && (value === undefined || value === null)) return null;
    throw fail(400, "INVALID_INPUT", "Invalid text field");
  }
  return value.trim();
}
function date(value) {
  if (typeof value !== "string" || !/Z$|[+-]\d\d:\d\d$/.test(value) || !Number.isFinite(Date.parse(value)))
    throw fail(400, "INVALID_DATE", "Use an ISO-8601 timestamp with a timezone");
  return new Date(value);
}
function secret() {
  const key = process.env.HOME_CURSOR_SECRET || process.env.JWT_SECRET;
  if (!key) throw new Error("Cursor signing secret is required");
  return key;
}
function encodeCursor(data) {
  const body = Buffer.from(JSON.stringify({ v: 1, ...data })).toString("base64url");
  return body + "." + crypto.createHmac("sha256", secret()).update(body).digest("base64url");
}
function decodeCursor(value, userId, now = Date.now()) {
  try {
    if (typeof value !== "string" || value.length > 2048) throw Error();
    const parts = value.split(".");
    if (parts.length !== 2) throw Error();
    const expected = crypto.createHmac("sha256", secret()).update(parts[0]).digest();
    const actual = Buffer.from(parts[1], "base64url");
    if (actual.length !== expected.length || !crypto.timingSafeEqual(actual, expected)) throw Error();
    const data = JSON.parse(Buffer.from(parts[0], "base64url"));
    if (data.v !== 1 || data.u !== userId || !Number.isSafeInteger(data.i) || data.i < 0 || !Number.isSafeInteger(data.exp) || typeof data.s !== "string") throw Error();
    if (data.exp <= now) throw fail(410, "CURSOR_EXPIRED", "Refresh the feed");
    return data;
  } catch (error) {
    if (error.code === "CURSOR_EXPIRED") throw error;
    throw fail(400, "INVALID_CURSOR", "Invalid feed cursor");
  }
}
function config() {
  const defaults = { recency: 10, local: 6, relationship: 8, engagement: 2, urgency: 3, diversity: 2 };
  for (const key of Object.keys(defaults)) {
    const value = process.env["HOME_RANK_" + key.toUpperCase()];
    if (value !== undefined) {
      const n = Number(value);
      if (!Number.isFinite(n) || n < 0 || n > 100 || (key === "diversity" && (!Number.isInteger(n) || n < 1)))
        throw new Error("Invalid Home ranking configuration: " + key);
      defaults[key] = n;
    }
  }
  return defaults;
}
function rank(posts, context, now = Date.now(), weights = config()) {
  const sorted = posts.map(p => {
    const hours = Math.max(0, (now - new Date(p.publishedAt).getTime()) / 3600000);
    const quality = Math.log1p(Math.min(p._count?.likes || 0, 100));
    const eventHours = p.event ? (new Date(p.event.startsAt).getTime() - now) / 3600000 : -1;
    return { ...p, score: weights.recency / (1 + hours / 24)
      + (p.city === context.location.city && p.state === context.location.state ? weights.local : 0)
      + (context.joined.has(p.mandalId) ? weights.relationship : 0)
      + weights.engagement * quality
      + (eventHours >= 0 && eventHours < 168 ? weights.urgency / (1 + eventHours / 24) : 0) };
  }).sort((a,b) => b.score - a.score || new Date(b.publishedAt) - new Date(a.publishedAt) || b.id - a.id);
  const result = [];
  while (sorted.length) {
    const recent = result.slice(-weights.diversity);
    const avoid = recent.length === weights.diversity && recent.every(p => p.mandalId === recent[0].mandalId) ? recent[0].mandalId : null;
    const typeOf = p => p.event ? "event" : "community";
    const avoidType = recent.length === weights.diversity && recent.every(p => typeOf(p) === typeOf(recent[0])) ? typeOf(recent[0]) : null;
    let index = sorted.findIndex(p => p.mandalId !== avoid && typeOf(p) !== avoidType);
    if (index < 0) index = avoid === null ? 0 : sorted.findIndex(p => p.mandalId !== avoid);
    if (index < 0) index = 0;
    result.push(sorted.splice(index, 1)[0]);
  }
  return result.map(p => p.id);
}
class SectionCache {
  constructor(max = 100) { this.max = max; this.entries = new Map(); this.pending = new Map(); this.hits = 0; this.misses = 0; this.stale = 0; }
  async get(key, loader, ttl = 30000, staleMs = 120000) {
    const old = this.entries.get(key);
    const now = Date.now();
    if (old && now < old.freshUntil) { this.hits++; return { ...old, freshness: "fresh" }; }
    const refresh = () => {
      if (this.pending.has(key)) return this.pending.get(key);
      if (this.pending.size >= this.max) return Promise.reject(fail(503, "CACHE_BUSY", "Please retry"));
      const promise = Promise.resolve().then(loader).then(data => {
        const at = Date.now();
        const entry = { data, asOf: new Date(at).toISOString(), freshUntil: at + ttl * (0.9 + Math.random() * 0.2), staleUntil: at + ttl + staleMs };
        if (this.entries.size >= this.max) this.entries.delete(this.entries.keys().next().value);
        this.entries.set(key, entry);
        return { ...entry, freshness: "fresh" };
      }).finally(() => this.pending.delete(key));
      this.pending.set(key, promise);
      return promise;
    };
    if (old && now < old.staleUntil) { this.stale++; refresh().catch(() => {}); return { ...old, freshness: "stale" }; }
    this.misses++;
    return refresh();
  }
  clear() { this.entries.clear(); }
}
module.exports = { integer, text, date, encodeCursor, decodeCursor, rank, config, SectionCache };
