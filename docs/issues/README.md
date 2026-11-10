# Mandal-scoped issues

This module uses the existing Express/JWT application, Prisma MySQL database, `Mandal`, `MandalMember`, `MandalRole`, `User`, and ImageKit account. No design sample content is seeded. The six PDFs were reviewed as visual references; the authorization rules in the request take precedence over controls pictured in those designs.

## Install, migrate and start

```sh
npm ci
npm run prisma:generate
npm run prisma:migrate
npm start
```

Use the existing `DATABASE_URL`, `JWT_SECRET`, and ImageKit environment variables. MySQL 8 is required. The migration user needs permission to create tables, indexes, foreign keys and triggers. `ISSUE_MAX_ATTACHMENTS=10` is optional (allowed range 1–50). Each image is limited to 5 MiB and 40 million decoded pixels. JPEG and PNG only; animated files are rejected and metadata is stripped.

**Database verification:** the new migrations were applied to a separate `digimandal_issues_test_v2` database on the existing local MySQL server. The configured application database was not migrated or populated. Historical fresh-install replay fails at `20261013100000_add_mandal_is_registered` because an earlier migration already adds that column. The integration runner baselines the pre-issue schema from `tests/issues/baseline.sql`, marks only historical migrations applied in its isolated database, and then deploys the new migrations normally. It never resets the application database. An existing deployment with applied historical migrations can use the normal deploy command above; do not mark migrations applied to a real deployment without verifying its schema.

```sh
npm test
npm run test:issues:integration
npm run format:issues:check
npm run lint:issues
npm run typecheck:issues
npm run issues:openapi
npm run issues:cleanup
```

The integration runner needs permission to create its named test database. It retains the empty test schema for subsequent runs and removes its fixtures. ImageKit is mocked at the provider boundary in integration tests; real HTTP routing, JWT, Prisma, authorization, SQL constraints and transactions are exercised. Existing Home tests remain in `npm test`. The new static checks target the issue module; this JavaScript repository did not previously have lint/type-check scripts.

Run `npm run issues:cleanup` hourly through the deployment's job scheduler. It processes up to 100 expired uploads per invocation; repeat until `deleted: 0` when clearing a backlog. Unattached uploads expire after 24 hours. Explicit abandonment and attachments removed from comments/issues become cleanup candidates immediately. Cleanup claims a five-minute lease, retries failed deletion, and cannot claim attached media. Archived issue media is retained for audit and denied by the download endpoint. Mandal hard deletion retains existing cascade semantics; coordinate provider-level retention/cleanup when deleting entire Mandals outside this module.

## API contract and design mapping

Import `openapi.json` into Swagger UI, Swagger Editor, or Postman. It documents every operation, request/response DTO, field, authentication requirement, error status and representative create/list/details/comment/support/resolve example. `src/issues/dto.d.ts` provides reusable TypeScript client contracts. Request handlers/controllers live in `routes.js`; business logic is in `service.js`; data access and transaction retries are in `repository.js`; membership policies are in `policy.js`; storage/provider operations are in `storage.js`.

| Design action                                          | API                                                                                   |
| ------------------------------------------------------ | ------------------------------------------------------------------------------------- |
| Mandal selector/filter options                         | `GET /api/issues/mandals`                                                             |
| All/Pending/Resolved tabs, search, Latest/Collaborated | `GET /api/issues`                                                                     |
| Member selector                                        | `GET /api/mandals/:mandalId/members`                                                  |
| Upload and preview photos                              | `POST /api/mandals/:mandalId/issue-uploads`, authenticated returned content URL       |
| Preview form before publishing                         | `POST /api/mandals/:mandalId/issues/preview`                                          |
| Publish                                                | `POST /api/mandals/:mandalId/issues`                                                  |
| Full details and completed resolution                  | `GET /api/issues/:issueId`, `GET /api/issues/:issueId/resolution`                     |
| Edit pending issue / selected members                  | `PATCH /api/issues/:issueId`, `PUT /api/issues/:issueId/participants`                 |
| Support/un-support and supporter drawer                | `POST` / `DELETE /api/issues/:issueId/support`, `GET /api/issues/:issueId/supporters` |
| Comment drawer and attachments                         | `GET` / `POST /api/issues/:issueId/comments`                                          |
| Edit/delete comment                                    | `PATCH` / `DELETE /api/issues/:issueId/comments/:commentId`                           |
| New-comments badge                                     | Details `newCommentCount`; acknowledge with `PUT /api/issues/:issueId/comments/read`  |
| Resolve with selected providers and proof              | `POST /api/issues/:issueId/resolve`                                                   |
| Admin archive                                          | `DELETE /api/issues/:issueId`                                                         |
| Abandon unused photo                                   | `DELETE /api/issue-uploads/:uploadId`                                                 |

Existing singular `/api/mandal`, `/api/members`, and `/api/v1` Home endpoints retain their routes and contracts. The plural paths above are new, stricter issue-specific APIs. There was no previous issue API or schema to migrate. `MandalMember.isActive` defaults to true, preserving existing memberships. Pending invitations and unlinked members (`userId=null`) do not qualify for issue access or selection. Membership administration remains in the existing product; deleting membership immediately removes issue access, and setting `isActive=false` revokes it without deleting history.

## Authorization and business assumptions

- Every issue has one required Mandal foreign key. Path/query Mandal IDs only narrow the authenticated user's active memberships; no body-supplied tenant, creator, resolver, counts, status or publication timestamp is accepted.
- Missing membership, foreign-Mandal nested resources and archives return 404. Unauthenticated requests return 401. No platform-role or ownership-only membership bypass exists.
- An active Mandal owner, a matching Mandal role with wildcard permissions, or legacy `Admin` membership without a role reference is an administrator. An attached role from another Mandal cannot grant permissions.
- Active members can publish, support, comment, and view. Only the creator or Mandal admin can edit a pending issue. Only Mandal admins can archive or designate approvers. A creator cannot replace an existing approver list. Ordinary selected members do not gain resolution authority.
- Only an active admin or currently designated approver can resolve. A unique `IssueResolution.issueId`, row locking, serializable transactions, conditional status update and database triggers protect resolution. Database triggers reject tenancy/creator changes, reopening, resolving without resolution data, and cross-Mandal participant insertion.
- Comment authors can edit/delete their comments; Mandal admins may delete another user's comment but cannot rewrite its text. Comments and support remain available after resolution. No reopen or hard-delete issue endpoint is introduced.
- The design marks issue and proof photos required: publication/resolution require at least one photo. Resolution requires at least one active solution provider. General issue participants are optional, maximum 100. `memberId` means `MandalMember.id`, not `User.id`; resolver identity always comes from the JWT.
- Dates accept `YYYY-MM-DD` (stored as midnight UTC) or ISO-8601 with explicit offset. Output is always ISO-8601 UTC; clients format local display. Occurrence may be future-dated because the designs do not forbid it. Resolution must be on/after occurrence and no later than now. `resolvedAt` is the entered effective date; resolution `createdAt` records submission time.
- Preview is validated but not persisted. Uploads stay unclaimed until publication. The mobile UI can return to edit its form and resubmit preview. Publishing/resolving require an `Idempotency-Key` of 8–100 word characters, dots or hyphens. Repeating the same normalized payload/key returns the existing result; changed payload/key conflicts return 409. Support/un-support are naturally idempotent. Comments are not retry-idempotent.
- Counts are derived through indexed aggregates, avoiding counter drift. List queries batch related rows instead of querying per issue. Cards include up to five attachments and ten participants, with totals; details include all. Users' phone numbers, emails, file-provider IDs and source paths are never returned.
- Private image URLs point to the authenticated API, not ImageKit. Use an authenticated image fetch and object URL in a browser/mobile image loader. The server proxies signed private provider content with `Cache-Control: private, no-store`, so possession of an API URL does not bypass membership.
- New comments are those from other users after their read watermark. GET has no read side effect. Send the comments response's `serverTime` to `comments/read` after displaying them. The watermark only advances. `serverTime` is captured before the read so concurrent comments are not silently acknowledged.

## Sorting and pagination

`page=1`, `limit=20`, maximum 100. Every page returns `items`, `total`, `page`, `limit`, `hasNext`. Latest sorts by `publishedAt DESC, id DESC`. Collaborated sorts issues with the current user's recorded activity first, then most recent personal activity, then publication time and ID descending. Qualifying activity includes creation, being selected, support/un-support, commenting/editing/deleting comments, editing the issue, resolving, and being selected as a solution provider. Historical collaboration remains relevant after removal of a support or comment. Mere viewing does not change ranking. The SQL ordering happens before pagination. Ties are deterministic, but page-based results can shift with concurrent publication/activity; refresh from page 1 when needed.

## Example requests and responses

Use real IDs from your own API; all values here are illustrative. Full response examples and schemas are in `openapi.json`.

First get permitted Mandals and members, then upload a photo:

```sh
curl -H "Authorization: Bearer $TOKEN" "$BASE/api/issues/mandals"
curl -H "Authorization: Bearer $TOKEN" "$BASE/api/mandals/3/members?search=&page=1&limit=20"
curl -X POST -H "Authorization: Bearer $TOKEN" -F "purpose=ISSUE" -F "file=@photo.png" "$BASE/api/mandals/3/issue-uploads"
```

Upload response:

```json
{
  "success": true,
  "data": {
    "id": "11111111-1111-4111-8111-111111111111",
    "mimeType": "image/png",
    "bytes": 2048,
    "width": 100,
    "height": 100,
    "url": "/api/issue-uploads/11111111-1111-4111-8111-111111111111/content",
    "thumbnailUrl": "/api/issue-uploads/11111111-1111-4111-8111-111111111111/content?thumbnail=true"
  },
  "serverTime": "2026-01-02T10:00:00.000Z"
}
```

Save the following as `issue.json`; send it to `/issues/preview` under the Mandal to preview, then publish:

```json
{
  "title": "Entrance lighting needs repair",
  "description": "The entrance light is not working.",
  "locationOrMandalName": "North entrance",
  "occurrenceDate": "2026-01-02",
  "participants": [{ "memberId": 12, "role": "MEMBER" }],
  "uploadIds": ["11111111-1111-4111-8111-111111111111"]
}
```

```sh
curl -X POST -H "Authorization: Bearer $TOKEN" -H "Content-Type: application/json" --data-binary @issue.json "$BASE/api/mandals/3/issues/preview"
curl -X POST -H "Authorization: Bearer $TOKEN" -H "Content-Type: application/json" -H "Idempotency-Key: publication-unique-001" --data-binary @issue.json "$BASE/api/mandals/3/issues"
curl -H "Authorization: Bearer $TOKEN" "$BASE/api/issues?mandalId=3&status=PENDING&sort=LATEST&page=1&limit=20"
curl -H "Authorization: Bearer $TOKEN" "$BASE/api/issues/42"
```

Create returns 201 with the full `IssueDetails` DTO. List returns a page of `IssueCard` DTOs. Details returns `IssueDetails`, including `supporterPreview`, `newCommentCount`, and `resolution` (null until resolved). All three complete example responses are embedded beside these operations in OpenAPI.

```sh
curl -X POST -H "Authorization: Bearer $TOKEN" "$BASE/api/issues/42/support"
curl -X POST -H "Authorization: Bearer $TOKEN" -H "Content-Type: application/json" -d '{"text":"Inspection is scheduled.","uploadIds":[]}' "$BASE/api/issues/42/comments"
```

Support returns:

```json
{
  "success": true,
  "data": { "isSupported": true, "supporterCount": 1 },
  "serverTime": "2026-01-03T10:00:00.000Z"
}
```

Comment returns 201:

```json
{
  "success": true,
  "data": {
    "id": 9,
    "issueId": 42,
    "text": "Inspection is scheduled.",
    "author": { "id": 7, "name": "Example member", "avatar": null },
    "attachments": [],
    "createdAt": "2026-01-03T10:00:00.000Z",
    "updatedAt": "2026-01-03T10:00:00.000Z",
    "permissions": { "canEdit": true, "canDelete": true }
  },
  "serverTime": "2026-01-03T10:00:00.000Z"
}
```

Upload comment images with purpose `COMMENT`, proof with `RESOLUTION`. Resolve using an active admin/approver token and their proof upload:

```sh
curl -X POST -H "Authorization: Bearer $ADMIN_TOKEN" -H "Content-Type: application/json" -H "Idempotency-Key: resolution-unique-001" -d '{"resolutionDate":"2026-01-03","description":"The light was replaced and tested.","memberIds":[12],"uploadIds":["22222222-2222-4222-8222-222222222222"]}' "$BASE/api/issues/42/resolve"
```

Resolve returns 200 with `Resolution`: effective date, description, authenticated resolver, selected solution providers, proof metadata, and timestamps. Subsequent details include this object and `status=RESOLVED`. Its full response example is in OpenAPI. A conflicting second submission returns:

```json
{
  "success": false,
  "code": "ALREADY_RESOLVED",
  "message": "Issue already resolved"
}
```

Field errors use the existing response convention with field details:

```json
{
  "success": false,
  "code": "VALIDATION_ERROR",
  "message": "Invalid request",
  "details": {
    "participants": "All selected members must be active in this Mandal"
  }
}
```

## Changed files

- `prisma/schema.prisma`: active membership and issue-related models/indexes.
- `prisma/migrations/20261110120000_mandal_issues/migration.sql`: additive schema, unique constraints, triggers.
- `prisma/migrations/20261110130000_issue_attachment_cascade/migration.sql`: attachment deletion ordering compatible with Mandal cascades.
- `src/server.js`: mounts the issue router.
- `src/issues/routes.js`, `service.js`, `repository.js`, `policy.js`, `validation.js`, `storage.js`: controllers/routes, flows, queries, policies, DTO validation and private uploads.
- `src/issues/dto.d.ts`, `express.d.ts`: request/response contracts and typed JWT context.
- `scripts/issues-cleanup.js`, `issues-test-db.js`, `issues-openapi.js`: cleanup, isolated migration/integration runner and contract generation.
- `tests/issues/core.test.js`, `integration.test.js`, `contract.test.js`, `baseline.sql`: service/policy tests, all-endpoint integration coverage, contract checks and pre-issue test baseline.
- `docs/issues/README.md`, `openapi.json`, `VERIFICATION.md`: operating instructions, design mapping, examples, assumptions and verification results.
- `package.json`, `package-lock.json`, `eslint.issues.config.js`, `tsconfig.issues.json`: scripts and development tooling.
- `.env.example`: configurable attachment-count limit.
