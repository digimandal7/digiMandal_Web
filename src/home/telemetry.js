const { AsyncLocalStorage } = require("node:async_hooks");
const { randomUUID } = require("node:crypto");
const { performance } = require("node:perf_hooks");
const context = new AsyncLocalStorage();
const samples = [];
const counters = {};
const routeMetrics=new Map();
const buckets=[.025,.05,.1,.15,.25,.4,.75,1,2,5,10];
function count(name) { counters[name] = (counters[name] || 0) + 1; }
function instrument(prisma) {
  prisma.$on("query", event => {
    count("sql_queries");
    if(event.duration > 200) count("slow_sql_queries");
  });
  prisma.$use(async (params, next) => {
    const state = context.getStore();
    const start = performance.now();
    try { return await next(params); }
    finally { if (state) { state.queryCount++; state.databaseMs += performance.now() - start; } }
  });
}
function middleware(req, res, next) {
  const state = { requestId: randomUUID(), queryCount: 0, databaseMs: 0, start: performance.now() };
  req.requestId = state.requestId;
  res.setHeader("X-Request-ID", state.requestId);
  res.setHeader("Cache-Control", "private, no-store");
  const originalJson=res.json.bind(res);
  res.json=body=>{
    state.payloadBytes=Buffer.byteLength(JSON.stringify(body));
    return originalJson(body);
  };
  req.homeAbort = new AbortController();
  req.on("aborted", () => req.homeAbort.abort());
  const timer = setTimeout(() => {
    req.homeAbort.abort();
    if (!res.headersSent) res.status(503).json({ success: false, code: "DEADLINE_EXCEEDED", message: "Please retry", retryable: true, requestId: state.requestId });
  }, 8000);
  res.on("finish", () => {
    clearTimeout(timer);
    const record = { requestId: state.requestId, route: req.route?.path || "unknown", method: req.method,
      status: res.statusCode, ms: +(performance.now() - state.start).toFixed(2), queryCount: state.queryCount,
      databaseMs: +state.databaseMs.toFixed(2), bytes: state.payloadBytes || 0 };
    samples.push(record);
    const key=JSON.stringify([record.route,record.method,String(record.status)]);
    const metric=routeMetrics.get(key)||{count:0,sum:0,buckets:buckets.map(()=>0)};
    metric.count++; metric.sum+=record.ms/1000;
    buckets.forEach((b,i)=>{if(record.ms/1000<=b) metric.buckets[i]++;});
    routeMetrics.set(key,metric);
    if (samples.length > 2000) samples.shift();
    console.log(JSON.stringify({ event: "home_request", ...record }));
  });
  context.run(state, next);
}
function metrics() {
  const values = samples.map(s => s.ms).sort((a,b) => a-b);
  const percentile = p => values[Math.min(values.length - 1, Math.floor(values.length*p))] || 0;
  return { samples: samples.length, p50: percentile(.5), p95: percentile(.95), p99: percentile(.99), counters,
    errors: samples.filter(s => s.status >= 500).length,
    maxQueries: Math.max(0, ...samples.map(s => s.queryCount)) };
}
function prometheus() {
  const lines=[];
  for(const [key,m] of routeMetrics) {
    const [route,method,status]=JSON.parse(key);
    const labels='route='+JSON.stringify(route)+',method='+JSON.stringify(method)+',status='+JSON.stringify(status);
    lines.push('digimandal_home_requests_total{'+labels+'} '+m.count);
    buckets.forEach((b,i)=>lines.push('digimandal_home_duration_seconds_bucket{'+labels+',le="'+b+'"} '+m.buckets[i]));
    lines.push('digimandal_home_duration_seconds_bucket{'+labels+',le="+Inf"} '+m.count);
    lines.push('digimandal_home_duration_seconds_count{'+labels+'} '+m.count);
    lines.push('digimandal_home_duration_seconds_sum{'+labels+'} '+m.sum);
  }
  for(const [key,value] of Object.entries(counters))
    lines.push('digimandal_home_events_total{event='+JSON.stringify(key)+'} '+value);
  return lines.join("\n")+"\n";
}
module.exports = { middleware, instrument, metrics, count, prometheus };
