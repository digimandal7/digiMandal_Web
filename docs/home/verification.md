# Verification: 15 October 2026

Baseline: repository had no build/test command. Prisma validation passed. Backend is plain CommonJS JavaScript; no compilation step is required.

Final checks actually run:

- npm test: 5 unit tests passed (cursor integrity/expiry/viewer binding, ranking/diversity, cache coalescing/stale/eviction, validation/configuration, section timeout).
- npm run test:home:contract: OpenAPI 3.0 validation and coverage of all 38 v1 route operations passed.
- npm run test:home:integration: MySQL integration scenario passed, including stable pagination after inserts, replay, privacy before/after membership, hidden/deleted content, reciprocal block/mute, viewer isolation, repeated/concurrent engagement, creator protection, events, promotion/ETag 304, comments, image queue/processing, signed delivery, story seen, query bounds, partial optional failures, DB timeout mapping and protected metrics.
- Real Sharp transformations were tested; ImageKit transport was mocked. No actual CDN upload was performed.
- npx prisma validate and migrate status: valid, all 10 checkout migrations applied.
- git diff --check: no whitespace errors (Windows line-ending conversion notice only).
- npm run home:explain: captured six actual Prisma query plans in query-plans.json. Improved candidate scans use compound Mandal/time indexes; detail hydration uses primary-key ranges. Optimizer behavior on the tiny fixture is not proof of production plans.
- npm run home:load: 528 measured requests across six phases, plus setup calls, no failed measured requests. Fixture cleanup completed.

Environment: Windows, Node v22.12.0, 8 logical CPUs, local MySQL, loopback HTTP, 8 synthetic users, 4 Mandals, 120 text posts, 4 events, 2 localities. Measurements include HTTP/JSON overhead. Media/CDN latency is excluded.

| Scenario | Requests / concurrency | p50 ms | p95 ms | p99 ms | req/s | Mean JSON bytes | Mean SQL statements | Cache hit rate |
| --- | --- | --- | --- | --- | --- | --- | --- | --- |
| Cold bootstrap | 8 / 1 | 20.85 | 38.48 | 38.48 | 39.64 | 13,416 | 34.125 | 0% |
| Warm bootstrap | 80 / 4 | 36.69 | 59.43 | 70.42 | 101.46 | 13,417 | 32.15 | 98.75% |
| Burst bootstrap | 80 / 16 | 124.35 | 139.56 | 150.10 | 128.83 | 13,419 | 32.125 | 100% |
| Next page | 80 / 4 | 18.19 | 27.27 | 30.57 | 205.05 | 10,854 | 15 | N/A |
| Like mutation | 40 / 4 | 18.04 | 85.85 | 90.68 | 166.88 | 112 | 14.025 | N/A |
| Steady bootstrap | 240 / 4 | 70.21 | 82.36 | 137.67 | 6.92 | 13,418 | 32.217 | 100% |

The steady phase ran 34.681 seconds with 500ms pacing per client. SQL figures include transaction statements and background cache refreshes, so they can be fractional averages. Per-request queryCount in logs counts ORM operations instead. The integration test enforces a bounded SQL count as the feed limit grows.

These measurements are development smoke/load results, not representative production capacity or proof of availability/SLO targets. Repeat with production-size tables, real relationships, representative media payloads and deployment infrastructure.

Remaining rollout verification: real ImageKit upload/delivery, supervised worker on persistent storage, production connection limits, distributed deployment behavior, monitoring provisioning, dependency advisory remediation and representative sustained failure/load testing.
