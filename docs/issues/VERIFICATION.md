# Verification

Verified on 2026-11-10 using Node 22, Prisma 5.22 and the existing local MySQL 8 server.

| Check                                                               | Result                                        |
| ------------------------------------------------------------------- | --------------------------------------------- |
| Prisma schema format and validation                                 | Passed                                        |
| Prisma client generation                                            | Passed                                        |
| Additive issue migrations deployed in isolated MySQL database       | Passed                                        |
| Existing Home core tests plus issue unit and OpenAPI contract tests | 12 passed, 0 failed                           |
| Issue HTTP/MySQL integration suite                                  | 9 passed, 0 failed (parent and 8 flow groups) |
| Prettier issue files                                                | Passed                                        |
| ESLint issue files                                                  | Passed                                        |
| TypeScript checkJs issue module and DTO declarations                | Passed                                        |
| Swagger/OpenAPI schema validation and route coverage                | Passed                                        |
| OpenAPI request/response example validation                         | Passed                                        |

Integration coverage includes every issue route, preview, permitted-Mandal selector, active membership, creator/admin/approver permissions, ownership-only denial, unauthenticated and cross-Mandal requests, nested comment isolation, same-owner cross-Mandal upload rejection, unowned/reused/expired/wrong-purpose media, invalid images and oversized multipart uploads, selected inactive/foreign members, publication retries and rollback, six concurrent support requests, supporter pagination, comment ownership/moderation/read watermark, proof-upload rollback, competing resolutions/replay, SQL reopening guard, status tabs, both sorting modes, literal search, pagination, bounded query count, archive and archived-image denial.

No application data was migrated or seeded. The test runner uses `digimandal_issues_test_v2` on the same server. An initial attempt to replay all historical migrations in `digimandal_issues_test` exposed a pre-existing duplicate `isRegistered` column migration; historical migration files were left unchanged. The current runner uses a pre-issue schema baseline in its isolated test database, then applies the new migrations. See README for deployment commands and the baseline caveat.

The ImageKit provider is stubbed in automated integration tests. Image decoding, sanitization, authorization, ownership, attachment claiming, image proxy routing and cleanup execute normally. Live ImageKit network delivery was not tested. No frontend project is present in this repository; this change supplies the dynamic API contracts and flows for the screens.

`npm install` also reported dependency audit findings (including existing runtime dependencies); this change does not perform unrelated breaking dependency upgrades.
