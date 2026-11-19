# DigiMandal Issues - Frontend Integration Handoff

**Audience:** frontend developer or AI coding agent. **Scope:** connect the existing member/admin issue designs to the implemented backend; preserve the UI. All people, Mandals, images, dates, statuses and counts must come from API responses or user input.

## 1. Shared API setup

- Local server origin: `http://localhost:3000`. Configure the deployed origin through frontend environment settings. All paths below include `/api`.
- Send `Authorization: Bearer <logged-in-user JWT>` on **every** request, including images. Use the existing app login/session; do not add a separate admin login flow. The same APIs serve members and admins.
- JSON requests: `Content-Type: application/json`. Success: `{ success: true, data, serverTime }`. Read actual screen data from `response.data` (or `axiosResponse.data.data` with Axios).
- Lists return `data: { items, total, page, limit, hasNext }`. Default `page=1&limit=20`; maximum limit 100. Reset page when filters change; append/de-duplicate by ID for load-more.
- IDs are numeric except upload IDs, which are UUID strings. **`memberId` is `MandalMember.id` returned by the member picker, not `user.id`.**
- Select Mandals only from the permitted-Mandals API. Never send `mandalId`, creator/resolver IDs, counts, status or timestamps in issue JSON bodies. The server validates tenant access.

## 2. Page-to-API map

| Page / UI action                                      | API to integrate                                                                     | What to do with the response                                                                                                                                    |
| ----------------------------------------------------- | ------------------------------------------------------------------------------------ | --------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Issue listing: Mandal filter                          | `GET /api/issues/mandals?page=1&limit=20`                                            | Use `data.items[].id/name` as options. Load more if needed.                                                                                                     |
| Issue listing: All / Pending / Resolved, sort, search | `GET /api/issues?mandalId={id}&status=ALL&sort=LATEST&search={text}&page=1&limit=20` | Bind cards to `data.items`. Status: `ALL`, `PENDING`, `RESOLVED`. Sort: `LATEST`, `COLLABORATED`. Omit `mandalId` for all permitted Mandals. URL-encode search. |
| Raise Issue / Resolve Issue: member picker            | `GET /api/mandals/{mandalId}/members?search={text}&role={role}&page=1&limit=20`      | Bind `memberId`, `role`, `user.name`, `user.avatar`. Search and role are optional; omit empty filters. Store selected **memberId** values.                      |
| Raise Issue: Next / preview                           | `POST /api/mandals/{mandalId}/issues/preview`                                        | Send the issue body below. Render returned title, description, Mandal, creator, participants and attachments. This does not publish or create a draft ID.       |
| Issue Preview: Submit Issue                           | `POST /api/mandals/{mandalId}/issues`                                                | Send the same body with `Idempotency-Key`. Save `data.id`, show success, refresh listing/open details. Returns 201.                                             |
| Issue Details: page load                              | `GET /api/issues/{issueId}`                                                          | Full issue, all photos/participants, counts, supporter preview, permissions and completed resolution.                                                           |
| Edit pending issue                                    | `PATCH /api/issues/{issueId}`                                                        | Send only changed editable fields from the issue body. Refresh details/list.                                                                                    |
| Change selected participants                          | `PUT /api/issues/{issueId}/participants`                                             | Body: `{ participants: [{ memberId, role }] }`. Replaces the selection; send the complete desired list.                                                         |
| Issue Details: support button                         | `POST /api/issues/{issueId}/support`                                                 | No body. Update `isSupported` and `supporterCount` from `data`.                                                                                                 |
| Issue Details: remove support                         | `DELETE /api/issues/{issueId}/support`                                               | No body. Update the same fields.                                                                                                                                |
| Supporters drawer                                     | `GET /api/issues/{issueId}/supporters?page=1&limit=20`                               | Display paginated names, avatars and `supportedAt`.                                                                                                             |
| Comments drawer                                       | `GET /api/issues/{issueId}/comments?page=1&limit=20`                                 | Display `text`, `author`, timestamps, attachments and each comment's `permissions`. Newest first.                                                               |
| Comments drawer: send                                 | `POST /api/issues/{issueId}/comments`                                                | Send comment body below. Save `data.id`; refresh comments and issue counts. Returns 201.                                                                        |
| Comment menu: edit                                    | `PATCH /api/issues/{issueId}/comments/{commentId}`                                   | Send `{ text }` and optionally the complete desired `uploadIds`.                                                                                                |
| Comment menu: delete                                  | `DELETE /api/issues/{issueId}/comments/{commentId}`                                  | No body. Remove comment and refresh counts after success.                                                                                                       |
| Comments displayed: clear New badge                   | `PUT /api/issues/{issueId}/comments/read`                                            | Body: `{ through: commentsResponse.serverTime }`, after displaying comments. Then refresh details. GET alone does not mark read.                                |
| Resolve Issue: submit                                 | `POST /api/issues/{issueId}/resolve`                                                 | Send resolution body below with `Idempotency-Key`. Refresh details/list; render `status=RESOLVED` and resolution.                                               |
| Completed resolution section                          | Use `details.resolution`; optional `GET /api/issues/{issueId}/resolution`            | Show resolver, `resolutionDate`, description, `solutionProviders` and attachments. No extra call needed when details are loaded.                                |
| Admin archive action                                  | `DELETE /api/issues/{issueId}`                                                       | Soft archive. On success remove card and return to listing. Archived issue/photos become inaccessible.                                                          |

**Card binding:** `id`, `title`, `shortDescription`, `creator.name/avatar`, `mandal.id/name`, `status`, `occurrenceDate`, `publishedAt`, `supporterCount`, `commentCount`, `participants`, `participantCount`, `attachments`, `totalAttachmentCount`, `isSupported`, `permissions`. Cards return up to 5 photos and 10 participants; use totals for “+N”. Details return full collections, `supporterPreview`, `newCommentCount`, and nullable `resolution`. A person's name/avatar can be null: use a neutral UI fallback.

**Collaborated** already prioritizes the current user's creation, selection, support, comments and resolution activity, then most recent personal activity. Do not re-sort on the frontend. Mere viewing does not count.

## 3. Request bodies and upload flow

These JavaScript shapes use values from the form and APIs; they are not hard-coded sample content.

```js
// Preview + publish. PATCH accepts a subset of these fields.
const issueBody = {
  title, // required, max 200 characters
  description, // required, max 10,000 characters
  locationOrMandalName, // required, max 255 characters
  occurrenceDate, // YYYY-MM-DD or ISO-8601 with timezone
  participants: selectedMembers.map((m) => ({
    memberId: m.memberId,
    role: "MEMBER", // APPROVER only when admin-authorized
  })), // optional; maximum 100
  uploadIds: issueUploadIds, // at least one ISSUE-purpose photo
};

const commentBody = {
  text, // required, max 2,000 characters
  uploadIds: commentUploadIds, // optional; COMMENT-purpose photos
};

const resolutionBody = {
  resolutionDate, // required; occurrence date <= date <= now
  description, // required, max 10,000 characters
  memberIds: selectedProviders.map((m) => m.memberId), // 1-100 providers
  uploadIds: proofUploadIds, // at least one RESOLUTION-purpose photo
};
```

**Use the same photo component on Raise Issue, Comments and Resolve Issue:**

1. `POST /api/mandals/{mandalId}/issue-uploads`, multipart form-data with exactly `file` (one image) and `purpose` (`ISSUE`, `COMMENT` or `RESOLUTION`). Let the browser/client set the multipart Content-Type boundary.
2. Validate JPEG/PNG, maximum 5 MiB per file. Default attachment limit is 10 per issue/comment/resolution; make this configurable to match the backend. Upload each file separately.
3. Save `data.id` as an upload ID. Returned metadata includes `mimeType`, `bytes`, `width`, `height`, `url` and `thumbnailUrl`. Pass IDs, **never arbitrary file URLs**, in request bodies. New uploads must belong to the acting user and selected Mandal and cannot be reused for another entity.
4. Fetch returned `url`/`thumbnailUrl` against the **server origin** (they already start with `/api`). They require a Bearer header: use authenticated fetch -> Blob -> object URL for browser images, or a mobile image loader with headers. Revoke object URLs on cleanup. Do not put the token in the URL.
5. Remove an unused photo with `DELETE /api/issue-uploads/{uploadId}`. This only works for the owner's unattached upload. Unattached uploads expire after 24 hours. Remove an attached photo through PATCH using the remaining `uploadIds`; omitted `uploadIds` preserves attachments. Issue photos cannot be reduced to zero.
6. If the chosen Mandal changes, clear selected members/photos and upload for the new Mandal. Disable Next/Submit while uploads are pending or failed.

## 4. Permissions, retries and UI behavior

- Bind issue actions to `permissions.canEdit`, `canResolve`, `canDelete`, `canSupport`, `canComment`; use `canDesignateApprovers` for approver controls on existing issues. On a new-issue form, use the app's existing Mandal admin capability; if unavailable, offer only MEMBER selection. Never derive admin powers from display names or platform role.
- Only active Mandal admins or designated approvers resolve. A selected MEMBER is not automatically an approver. Creators cannot replace a participant list containing approvers. Bind comment menus to **that comment's** `permissions.canEdit/canDelete`; admins may delete others' comments but not rewrite them.
- Resolved issues cannot be edited/reopened/resolved again. Support and comments remain allowed. Display completed resolution below issue details; hide the resolve action.
- Publication and resolution need a UUID `Idempotency-Key` header. Generate one per submission intent, preserve key **and body** on network retry, and disable duplicate clicks. After an uncertain result, retry the same request before changing its body. New submission intent needs a new key. Support/un-support are idempotent; **comment POST is not**, so do not automatically retry an uncertain send.
- After publication/edit/comments/support/resolution/archive, invalidate relevant list/details/drawer caches. Namespace caches by logged-in user and Mandal; clear on logout/account change. Avoid stale cross-Mandal content when switching filters.
- Input date-only strings remain `YYYY-MM-DD`; do not convert through local midnight. Returned timestamps are UTC ISO-8601. Format timestamps for the viewer; preserve date-only field meaning when displaying calendar dates.
- Show loading, empty, upload-failure and retry states. Debounce search and cancel/ignore stale responses. Page ordering is deterministic for unchanged data, but new activity can move rows: refresh from page 1 when necessary.

**Errors:** `{ success: false, code, message, details?: { field: message } }`. Show 400 field errors inline. On 401 use the app's sign-in/session flow. On 403 refresh permissions and explain the unavailable action. On 404 show “Issue unavailable” without exposing another Mandal's data. On 409 refetch state; `ALREADY_RESOLVED` means show completed resolution, while `IDEMPOTENCY_CONFLICT` means a key was reused with changed content. On 503 show retry; apply the retry rules above.

## 5. Instruction to the frontend AI / developer

Integrate the page map into the existing frontend architecture and design components. Build a shared authenticated API client and reusable upload/member-picker logic. Keep member/admin screens on the same APIs and use server permission flags. Do not invent routes, seed mockup content, calculate authority on the client, or modify backend contracts to fit assumptions. Verify: publish -> details -> support -> comment/edit/delete -> authorized resolution; all tabs/filter/sort/pagination; private image loading; and graceful 401/403/404/409 handling.

For complete schemas/examples, use `openapi.json`. For runnable requests, import `DigiMandal-Issues.postman_collection.json`. Both are supplied alongside this handoff in `docs/issues/`. Existing client DTOs are in `src/issues/dto.d.ts`.
