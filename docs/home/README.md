# Home backend delivery

This is an additive Express 4 / Prisma 5 / MySQL module under /api/v1. Existing onboarding, bank lookup, roles and authentication contracts remain available. No Android/frontend files were changed. The PDF design informed the Mandal rail, festival hero, trending cards, community posts and attached-event flow.

## Run and verify

From the repository root:

    npm ci
    npm run prisma:migrate
    npm run prisma:generate
    npm start

Run the durable media/retention worker as a separately supervised process:

    npm run home:worker

Both processes need DATABASE_URL and the existing ImageKit settings. The upload server and worker must share the persistent var/home-media directory. Do not expose that directory as static content. Keep a single host/shared persistent volume for this deployment; arbitrary multi-host ephemeral disks are not supported.

Checks:

    npm test
    npm run test:home:integration
    npm run home:contracts
    npm run test:home:contract
    npm run home:explain
    npm run home:load

Tests and load fixtures create randomized synthetic users/Mandals and remove only their own records in finally blocks. Run integration/load checks on a development or staging database. The worker can run one bounded pass using node scripts/home-worker.js --once.

## Contracts and request flow

Import DigiMandal_Home.postman_collection.json. Set home_base_url and token from existing authentication. openapi.json describes all routes. Run home:contracts to regenerate both artifacts from scripts/home-contracts.js.

GET /api/v1/home authenticates the bearer token, confirms the user still exists, loads last-selected city/state/area (falling back to profile city/state), then loads feed, rail, hero and trending concurrently. Optional sections fail independently. Location permission and precise coordinates are never required.

The following routes are supported:

| Group | Routes |
| --- | --- |
| Bootstrap/sections | GET /home, /home/feed, /home/mandals, /home/hero, /home/trending |
| Location | PUT /home/location |
| Detail targets | GET /posts/:id, /events/:id, /mandals/:id, /profiles/:id, /stories/:id |
| Engagement | PUT/DELETE /posts/:id/like and /save |
| Relationships | PUT/DELETE /mandals/:id/membership and /events/:id/participation |
| Safety | PUT /posts/:id/report; PUT/DELETE /profiles/:id/block and /mute |
| Analytics/seen | PUT /posts/:id/impression and /stories/:id/seen |
| Comments | GET/POST /posts/:id/comments |
| Publishing | POST /posts, /events, /stories; DELETE /posts/:id |
| Media | POST /media (multipart file), GET /media/:id |
| Platform admin | PUT /admin/events/:id/promotion, /admin/:kind/:id/moderation; GET /admin/home/metrics and /prometheus |

All paths above use /api/v1. Every JSON response has success, data (on success), and requestId. Errors have code, safe message, retryable, requestId, and retryAfter for throttling. Resource-not-found is also used for inaccessible content.

Example first response (abbreviated):

    {
      "success": true,
      "data": {
        "schemaVersion": "1.0",
        "serverTime": "2026-10-15T10:00:00.000Z",
        "viewer": {"id": 42, "name": "Asha", "profileImage": null, "locale": "en"},
        "location": {"city": "Pune", "state": "Maharashtra", "area": null},
        "mandals": {"status": "ok", "freshness": "fresh", "data": []},
        "hero": {"status": "ok", "freshness": "fresh", "data": null},
        "trending": {"status": "unavailable", "freshness": "missing", "data": [], "error": {"code": "SECTION_UNAVAILABLE", "retryable": true}},
        "feed": {"status": "ok", "freshness": "fresh", "items": [], "nextCursor": null, "snapshotExpiresAt": "2026-10-15T10:30:00.000Z"},
        "quickActions": [{"id":"mandals","label":"Mandals","deepLink":"digimandal://mandals"},{"id":"events","label":"Events","deepLink":"digimandal://events"}]
      },
      "requestId": "01234567-89ab-4cde-8f01-234567890abc"
    }

Use publishedAt for relative time and serverTime/startsAt for countdowns. Never parse display labels as IDs. Deep links use digimandal://posts/{id}, events/{id}, mandals/{id}, profiles/{id}. No banking details, mobile numbers, permissions, moderation notes, source paths or precise coordinates are exposed by Home.

## Ranking and pagination

Candidate selection uses two independent bounded queries: newest 150 eligible local posts and newest 150 eligible joined/owned Mandal posts. Duplicates are removed before ranking. Eligibility requires active visible Mandals, PUBLISHED posts, non-future publish dates, allowed post visibility and current block/mute state.

Score: recency/(1 + ageHours/24) + local weight + membership weight + engagement weight * log(1 + min(likes,100)) + event urgency/(1 + hoursToStart/24) for events starting within seven days. Defaults are 10,6,8,2,3. Ties use publishedAt descending, then ID descending. Diversity interleaves Mandals and event/community content where alternatives exist, targeting at most two consecutive items of one source/type. Ranking env values are validated on startup.

The ordered IDs are saved in HomeSnapshot for 30 minutes. HMAC cursors contain snapshot ID, viewer ID, position and expiry. API consumers treat them as opaque. Same cursor = same positions; inserted posts do not shift the snapshot. Privacy/deletion/moderation is rechecked every page, so withdrawn items can produce short or empty pages. Follow nextCursor until null; refresh for new content or older content beyond the bounded session window. Invalid/tampered/cross-user cursors return 400; expired cursors 410; changed location 409.

This first version deliberately provides a bounded recent feed, not unlimited history. Relevance uses exact city/state and membership; no distance/geospatial or demographic targeting is enabled without product/location policy.

## Cache and consistency

Only public hero/trending candidate IDs are shared in a bounded in-process cache. Key = JSON([v1, section, city, state]); these IDs have no locale, entitlement or viewer state. Every response rechecks current privacy/schedule/moderation and hydrates viewer state from MySQL. No personalized response is shared.

TTL is 30 seconds with 10% jitter; stale ID candidates can be reused for up to 150 seconds from insertion while a single background refresh runs. Empty arrays are safely cached. Maximum 100 entries and 100 concurrent loader keys prevent unbounded growth. Admin event/promotion/moderation writes clear local cache; other replicas remain safe because eligibility is always rechecked. Newly published content may take a TTL to appear on other replicas.

Hero/trending support private ETag revalidation. Personalized bootstrap/feed responses use private,no-store. Compression is enabled. A database outage cannot safely serve personalized/stale content; feed fails with a retryable safe error. Optional-section errors/timeouts omit that section only. Optional timeout is 2s; overall response deadline is 8s. An HTTP timeout/client disconnect suppresses further writes to the response; Prisma cannot cancel an already-running SQL statement. Configure short MySQL pool/connect/query timeouts at deployment.

Like/save/seen/participation uniqueness prevents duplicates. Serializable transactions retry database conflicts at most twice with jitter. Counts are computed from authoritative relationship tables with IDs bounded to the current page. There are no denormalized counters to go negative or require drift reconciliation. Joined private Mandals use existing invitation acceptance; self-join cannot grant privileged roles. The creator cannot leave through either Home or the older leave API.

## Media and worker

Uploads accept JPEG/PNG/WebP only, <=10 MiB and <=40 megapixels, nonanimated. Sharp decodes and re-encodes images, stripping metadata including GPS. No URL fetching, client-supplied filesystem paths, or unsanitized originals are accepted. At most two uploads run concurrently; pending jobs are admission-limited to 100.

Durable HomeMedia jobs use lease tokens, conditional claiming, retry backoff, maximum three attempts, and a five-minute lease. A separate worker generates 240px, 1080px and 2048px WebP assets (never upscales), uploads private version-named ImageKit files, and stores dimensions/size/MIME/status. UI reads never trigger media processing. PENDING/FAILED media has null variants.

Delivery URLs are signed for five minutes and reissued after authorization. Already-issued URLs can remain valid until expiry after a block or deletion. Integration tests exercise real Sharp processing and mock ImageKit upload; an actual external upload/CDN round-trip was NOT verified.

The worker removes expired snapshots and impressions older than 30 days in bounded batches; failed spool files are removed after 24h. It does not physically purge soft-deleted posts/reports or unused remote assets. A production deletion/remote orphan retention policy is still required. No analytics/notification broker exists: impressions are durable MySQL records and engagement writes do not depend on external analytics.

## Schema and indexes

Migration 20261015120000_home_feed is additive: nullable Mandal.avatarUrl plus HomeLocation, HomePost, HomeMedia, HomeLike, HomeSave, HomeComment, HomeEvent, HomeParticipant, HomeStory, HomeStorySeen, HomeFilter, HomeReport, HomeImpression and HomeSnapshot.

Explicit foreign keys cascade relationship records; optional event/media references use SetNull. Compound primary keys enforce idempotent relations. Post indexes cover locality/status/time/ID and Mandal/status/time/ID; event index covers locality/status/end-time; worker index covers status/lease/created; retention indexes cover expiry/created; comments cover post/status/ID. Membership and filter indexes support eligibility reads. See query-plans.json for EXPLAIN of actual Prisma SQL. Tiny fixtures are not representative optimizer statistics; inspect production-scale plans before rollout.

## Security and operations

Publishing requires MANAGE_POSTS or MANAGE_EVENTS (or creator/Admin wildcard). Existing custom role administration can grant the new permissions; no existing Manager role is silently upgraded. Only platform SUPER_ADMIN can promote/moderate and access metrics. No age or restricted-region publishing is supported: all published content must be general-audience within existing product policy.

Limits are 30 posts/page (default 10), 64 KiB JSON, 180 authenticated requests/minute, 40 explicit mutations/minute/user, 80 passive impression/story-seen writes/minute/user, 1800 requests/minute/IP and 64 in-flight requests/process. Passive writes have a separate budget so scrolling cannot exhaust likes, joins, or comments. The 180-request overall cap still applies. Bearer headers, not ambient cookies, are used; CSRF cookie flows are not introduced. Configure trusted proxy handling deliberately before deploying behind a proxy; do not blindly trust forwarded IP headers.

Structured logs include random request IDs, route templates, status, elapsed time, ORM operation count, database-operation time and uncompressed JSON bytes. No bodies/tokens/coordinates/raw URLs are logged by the Home middleware. SQL events are counted without logging query text or parameters. queryCount is ORM operations; load-results meanSqlQueries uses actual engine SQL events including transaction statements.

Metrics are per process. /admin/home/metrics/prometheus supplies cumulative route histograms/counters and queue/cache gauges. Import dashboard.json into Grafana and alerts.yml into Prometheus, with a protected scraper identity/token. These configurations were supplied but NOT deployed to an external monitoring service. No existing tracing collector, distributed cache, database saturation exporter or notification/analytics stack was present; provision these for multi-instance operations. Readiness/liveness are /health/ready and /health/live. Shutdown drains HTTP for up to 10s.

Provisional objectives: bootstrap p50<=150ms/p95<=400ms; next page p95<=300ms; accepted mutations p95<=250ms; useful Home availability >=99.9%. load-results.json records actual local results and environment. These tests do not establish production SLO compliance.

## Rollout and known gaps

1. Back up and test the additive migration in staging; deploy schema before server/client generation.
2. Configure connection_limit=10, pool_timeout=3, connect_timeout=3 in DATABASE_URL as appropriate to database capacity; use a strong shared HOME_CURSOR_SECRET/JWT_SECRET across replicas.
3. Start API and supervised worker with persistent shared spool storage and verified ImageKit credentials. Confirm READY media and signed delivery from the actual deployment.
4. Grant publishing permissions through existing Mandal roles, publish test events/posts, select locality, and enable Android usage of v1 endpoints.
5. Import monitoring configuration, perform representative sustained/load/fault tests, audit dependencies, then roll out gradually. Roll back app routing first; retain additive tables until no consumers remain.

The local database had a pre-existing failed migration named 20261013100000_add_mandal_is_registered, absent from this checkout. Its first statement failed because isRegistered already existed. After checking schema/logs it was marked rolled back; no application records were removed. The Home migration then applied successfully.

Not implemented here: video/audio transcoding, dislike/share-count product semantics, separate follow-vs-membership, Issues/Donations backend, push notifications, moderation review UI, age/region-restricted feeds, remote media deletion automation, distributed rate limits/cache, or a full OpenTelemetry tracing deployment. These require additional product/infrastructure decisions. The available quick actions point to Mandals/Events. Voice metadata is nullable and cannot be self-awarded.

Dependency installation reports 19 advisories (7 moderate, 11 high, 1 critical) in the current dependency tree. No forced major-version audit upgrade was performed. Review npm audit before internet-facing production rollout.

## Files

- src/home/: v1 routing, validation/cursors/ranking/cache, privacy-aware reads, image processing and telemetry.
- prisma/schema.prisma and prisma/migrations/20261015120000_home_feed/: data model and SQL.
- src/server.js, src/config/prisma.js: integration, compression, health, graceful shutdown and query events.
- src/config/mandal-permissions.js and src/controllers/member.controller.js: publishing permissions and creator-leave protection.
- scripts/home-*.js: contracts, worker, load testing and query plans.
- tests/home/: unit, contract, MySQL integration and reusable factories.
- docs/home/: OpenAPI/Postman, operational guide, dashboard/alerts and actual verification outputs.
- package.json/package-lock.json/.env.example/var/.gitignore: dependencies, commands, configuration and spool exclusion.
