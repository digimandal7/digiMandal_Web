const fs = require("node:fs");
const ref = (name) => ({ $ref: "#/components/schemas/" + name });
const string = { type: "string" },
  integer = { type: "integer", minimum: 1 },
  count = { type: "integer", minimum: 0 },
  boolean = { type: "boolean" },
  timestamp = { type: "string", format: "date-time" };
const array = (items) => ({ type: "array", items });
const object = (properties, required = Object.keys(properties)) => ({
  type: "object",
  properties,
  required,
  additionalProperties: false,
});
const text = (maxLength) => ({ type: "string", minLength: 1, maxLength });
const nullable = (schema) => ({ ...schema, nullable: true });
const dateInput = {
  type: "string",
  description:
    "YYYY-MM-DD (UTC midnight) or ISO-8601 timestamp with explicit timezone.",
};
const uploadIds = {
  ...array({ type: "string", format: "uuid" }),
  minItems: 1,
  maxItems: 10,
  uniqueItems: true,
  description:
    "Owned, unexpired upload IDs from this Mandal and purpose; maximum is configurable through ISSUE_MAX_ATTACHMENTS.",
};
const selected = object(
  {
    memberId: integer,
    role: { type: "string", enum: ["MEMBER", "APPROVER"], default: "MEMBER" },
  },
  ["memberId"],
);
const create = object(
  {
    title: text(200),
    description: text(10000),
    locationOrMandalName: text(255),
    occurrenceDate: dateInput,
    participants: { ...array(selected), maxItems: 100 },
    uploadIds,
  },
  [
    "title",
    "description",
    "locationOrMandalName",
    "occurrenceDate",
    "uploadIds",
  ],
);
const person = object({
  id: integer,
  name: nullable(string),
  avatar: nullable(string),
});
const attachment = object({
  id: { type: "string", format: "uuid" },
  mimeType: { type: "string", enum: ["image/jpeg", "image/png"] },
  bytes: count,
  width: integer,
  height: integer,
  url: string,
  thumbnailUrl: string,
});
const participant = object({
  memberId: integer,
  role: { type: "string", enum: ["MEMBER", "APPROVER", "RESOLVER"] },
  active: boolean,
  user: { ...ref("Person"), nullable: true },
});
const permissions = object(
  Object.fromEntries(
    [
      "canEdit",
      "canResolve",
      "canDelete",
      "canComment",
      "canSupport",
      "canDesignateApprovers",
    ].map((k) => [k, boolean]),
  ),
);
const resolution = object({
  id: integer,
  resolutionDate: timestamp,
  description: string,
  resolver: ref("Person"),
  solutionProviders: array(ref("Participant")),
  attachments: array(ref("Attachment")),
  createdAt: timestamp,
  updatedAt: timestamp,
});
const cardProperties = {
  id: integer,
  mandalId: integer,
  title: string,
  description: string,
  shortDescription: string,
  locationOrMandalName: string,
  pincode: { type: "string", pattern: "^[0-9]{6}$", readOnly: true },
  status: { type: "string", enum: ["PENDING", "RESOLVED"] },
  occurrenceDate: timestamp,
  publishedAt: timestamp,
  resolvedAt: nullable(timestamp),
  createdAt: timestamp,
  updatedAt: timestamp,
  archivedAt: nullable(timestamp),
  creator: ref("Person"),
  mandal: object({ id: integer, name: string }),
  supporterCount: count,
  commentCount: count,
  participants: array(ref("Participant")),
  participantCount: count,
  attachments: array(ref("Attachment")),
  totalAttachmentCount: count,
  isSupported: boolean,
  permissions: ref("Permissions"),
};
const page = (items) =>
  object({
    items: array(items),
    total: count,
    page: integer,
    limit: integer,
    hasNext: boolean,
  });
const success = (data) =>
  object({
    success: { type: "boolean", enum: [true] },
    data,
    serverTime: timestamp,
  });
const schemas = {
  Person: person,
  Attachment: attachment,
  Participant: participant,
  Permissions: permissions,
  CreateIssueRequest: create,
  UpdateIssueRequest: { ...create, required: [], minProperties: 1 },
  CommentRequest: object(
    { text: text(2000), uploadIds: { ...uploadIds, minItems: 0 } },
    ["text"],
  ),
  UpdateCommentRequest: {
    ...object(
      { text: text(2000), uploadIds: { ...uploadIds, minItems: 0 } },
      [],
    ),
    minProperties: 1,
  },
  ResolveIssueRequest: object({
    resolutionDate: dateInput,
    description: text(10000),
    memberIds: {
      ...array(integer),
      minItems: 1,
      maxItems: 100,
      uniqueItems: true,
    },
    uploadIds,
  }),
  IssueCard: object(cardProperties),
  IssueDetails: object({
    ...cardProperties,
    supporterPreview: array(ref("Person")),
    newCommentCount: count,
    resolution: { ...ref("Resolution"), nullable: true },
  }),
  Resolution: resolution,
  Comment: object({
    id: integer,
    issueId: integer,
    text: string,
    author: ref("Person"),
    createdAt: timestamp,
    updatedAt: timestamp,
    attachments: array(ref("Attachment")),
    permissions: object({ canEdit: boolean, canDelete: boolean }),
  }),
  Error: object(
    {
      success: { type: "boolean", enum: [false] },
      code: string,
      message: string,
      details: { type: "object", additionalProperties: string },
    },
    ["success", "code", "message"],
  ),
};
const examples = {
  CreateIssueRequest: {
    title: "Entrance lighting needs repair",
    description: "The entrance light is not working.",
    locationOrMandalName: "North entrance",
    occurrenceDate: "2026-01-02",
    participants: [{ memberId: 12, role: "MEMBER" }],
    uploadIds: ["11111111-1111-4111-8111-111111111111"],
  },
  CommentRequest: { text: "Inspection is scheduled.", uploadIds: [] },
  ResolveIssueRequest: {
    resolutionDate: "2026-01-03",
    description: "The light was replaced and tested.",
    memberIds: [12],
    uploadIds: ["22222222-2222-4222-8222-222222222222"],
  },
};
const examplePerson = { id: 7, name: "Example member", avatar: null };
const cardExample = {
  id: 42,
  mandalId: 3,
  title: examples.CreateIssueRequest.title,
  description: examples.CreateIssueRequest.description,
  shortDescription: examples.CreateIssueRequest.description,
  locationOrMandalName: "North entrance",
  pincode: "411001",
  status: "PENDING",
  occurrenceDate: "2026-01-02T00:00:00.000Z",
  publishedAt: "2026-01-02T10:00:00.000Z",
  resolvedAt: null,
  createdAt: "2026-01-02T10:00:00.000Z",
  updatedAt: "2026-01-02T10:00:00.000Z",
  archivedAt: null,
  creator: examplePerson,
  mandal: { id: 3, name: "Example association" },
  supporterCount: 0,
  commentCount: 0,
  participants: [],
  participantCount: 0,
  attachments: [
    {
      id: examples.CreateIssueRequest.uploadIds[0],
      mimeType: "image/png",
      bytes: 2048,
      width: 100,
      height: 100,
      url: "/api/issue-uploads/11111111-1111-4111-8111-111111111111/content",
      thumbnailUrl:
        "/api/issue-uploads/11111111-1111-4111-8111-111111111111/content?thumbnail=true",
    },
  ],
  totalAttachmentCount: 1,
  isSupported: false,
  permissions: {
    canEdit: true,
    canResolve: false,
    canDelete: false,
    canComment: true,
    canSupport: true,
    canDesignateApprovers: false,
  },
};
const detailExample = {
  ...cardExample,
  supporterPreview: [],
  newCommentCount: 0,
  resolution: null,
};
const paths = {};
function operation(path, method, summary, response, body, opts = {}) {
  const parameters = [...path.matchAll(/\{(\w+)\}/g)].map((m) => ({
    name: m[1],
    in: "path",
    required: true,
    schema: m[1] === "uploadId" ? { type: "string", format: "uuid" } : integer,
  }));
  if (opts.page)
    parameters.push(
      ...["page", "limit"].map((name) => ({
        name,
        in: "query",
        schema: {
          type: "integer",
          minimum: 1,
          maximum: name === "limit" ? 100 : 100000,
          default: name === "limit" ? 20 : 1,
        },
      })),
    );
  if (opts.key)
    parameters.push({
      name: "Idempotency-Key",
      in: "header",
      required: true,
      schema: {
        type: "string",
        minLength: 8,
        maxLength: 100,
        pattern: "^[\\w.-]+$",
      },
    });
  parameters.push(...(opts.query || []));
  const responses = Object.fromEntries(
    [400, 401, 403, 404, 409, 503].map((code) => [
      code,
      {
        description: {
          400: "Validation error with field details",
          401: "Authentication required",
          403: "Operation not permitted",
          404: "Missing or inaccessible resource",
          409: "Conflicting state or idempotency key",
          503: "Temporarily unavailable",
        }[code],
        content: { "application/json": { schema: ref("Error") } },
      },
    ]),
  );
  responses[opts.status || 200] = {
    description: "Success",
    content: {
      "application/json": {
        schema: success(response),
        ...(opts.example
          ? {
              example: {
                success: true,
                data: opts.example,
                serverTime: "2026-01-03T10:00:00.000Z",
              },
            }
          : {}),
      },
    },
  };
  paths[path] ||= {};
  paths[path][method] = {
    summary,
    operationId: method + path.replace(/[^a-zA-Z]/g, "_"),
    tags: ["Issues"],
    parameters,
    responses,
    ...(body
      ? {
          requestBody: {
            required: true,
            content: {
              "application/json": {
                schema: typeof body === "string" ? ref(body) : body,
                ...(examples[body] ? { example: examples[body] } : {}),
              },
            },
          },
        }
      : {}),
    ...(opts.description ? { description: opts.description } : {}),
  };
}
const query = (name, schema) => ({ name, in: "query", schema });
operation(
  "/mandals/{mandalId}/issues",
  "post",
  "Publish an issue atomically",
  ref("IssueDetails"),
  "CreateIssueRequest",
  { status: 201, key: true, example: detailExample },
);
operation(
  "/issues",
  "get",
  "List authorized Mandal issues",
  page(ref("IssueCard")),
  null,
  {
    page: true,
    query: [
      query("mandalId", integer),
      query("status", {
        type: "string",
        enum: ["ALL", "PENDING", "RESOLVED"],
        default: "ALL",
      }),
      query("sort", {
        type: "string",
        enum: ["LATEST", "COLLABORATED"],
        default: "LATEST",
      }),
      query("search", { type: "string", maxLength: 200 }),
    ],
    description:
      "Returns non-archived issues whose immutable issue pincode matches the authenticated user's registered pincode. An explicit mandalId filters that visible set. LATEST: publishedAt DESC, id DESC. COLLABORATED: issues with your recorded activity first, latest personal activity DESC, publishedAt DESC, id DESC. Activity includes creation, selection, support/un-support, comment changes, edits and resolution. Historical interaction remains after removal. Paging is stable for an unchanged dataset; concurrent activity can move rows between pages. Cards include at most 10 participants and 5 images, with total counts.",
    example: {
      items: [cardExample],
      page: 1,
      limit: 20,
      total: 1,
      hasNext: false,
    },
  },
);
operation(
  "/issues/{issueId}",
  "get",
  "Get complete issue details",
  ref("IssueDetails"),
  null,
  { example: detailExample },
);
operation(
  "/issues/{issueId}",
  "patch",
  "Edit a pending issue",
  ref("IssueDetails"),
  "UpdateIssueRequest",
);
operation(
  "/issues/{issueId}",
  "delete",
  "Archive an issue as its Mandal administrator",
  object({ archived: boolean }),
  null,
  {
    description:
      "Soft archive only. Issue and attached images become inaccessible. No hard delete or reopen API.",
  },
);
operation(
  "/issues/{issueId}/support",
  "post",
  "Support an issue idempotently",
  object({ isSupported: boolean, supporterCount: count }),
  null,
  { example: { isSupported: true, supporterCount: 1 } },
);
operation(
  "/issues/{issueId}/support",
  "delete",
  "Remove your support idempotently",
  object({ isSupported: boolean, supporterCount: count }),
);
operation(
  "/issues/{issueId}/supporters",
  "get",
  "List supporters",
  page({
    ...person,
    properties: { ...person.properties, supportedAt: timestamp },
    required: [...person.required, "supportedAt"],
  }),
  null,
  { page: true },
);
operation(
  "/mandals/{mandalId}/members",
  "get",
  "Search active members for selection",
  page(object({ memberId: integer, role: string, user: ref("Person") })),
  null,
  { page: true, query: [query("search", text(200)), query("role", text(100))] },
);
operation(
  "/issues/{issueId}/participants",
  "put",
  "Replace selected members on a pending issue",
  ref("IssueDetails"),
  object({ participants: { ...array(selected), maxItems: 100 } }),
  {
    description:
      "Only admins can assign APPROVER. A creator cannot replace an existing approver list. Member IDs are MandalMember IDs, not User IDs.",
  },
);
operation(
  "/issues/{issueId}/comments",
  "get",
  "List comments newest first",
  page(ref("Comment")),
  null,
  { page: true },
);
operation(
  "/issues/{issueId}/comments",
  "post",
  "Create a comment and attach owned uploads atomically",
  ref("Comment"),
  "CommentRequest",
  {
    status: 201,
    example: {
      id: 9,
      issueId: 42,
      text: "Inspection is scheduled.",
      author: examplePerson,
      attachments: [],
      createdAt: "2026-01-03T10:00:00.000Z",
      updatedAt: "2026-01-03T10:00:00.000Z",
      permissions: { canEdit: true, canDelete: true },
    },
  },
);
operation(
  "/issues/{issueId}/comments/{commentId}",
  "patch",
  "Edit your own comment",
  ref("Comment"),
  "UpdateCommentRequest",
);
operation(
  "/issues/{issueId}/comments/{commentId}",
  "delete",
  "Delete your comment or moderate as Mandal admin",
  object({ deleted: boolean }),
);
operation(
  "/issues/{issueId}/comments/read",
  "put",
  "Acknowledge comments displayed through a timestamp",
  object({ commentsReadAt: timestamp }),
  object({ through: timestamp }),
  {
    description:
      "Use serverTime from the displayed comments response; timestamps cannot be in the future or move the read watermark backwards.",
  },
);
operation(
  "/issues/{issueId}/resolve",
  "post",
  "Resolve a pending issue exactly once",
  ref("Resolution"),
  "ResolveIssueRequest",
  {
    key: true,
    description:
      "Active Mandal admin or designated approver only. The same key, payload and resolver safely replay the original resolution; other attempts return 409. Proof images and at least one solution provider required. Resolution date must be between occurrence and now.",
    example: {
      id: 4,
      resolutionDate: "2026-01-03T00:00:00.000Z",
      description: examples.ResolveIssueRequest.description,
      resolver: examplePerson,
      solutionProviders: [
        { memberId: 12, role: "RESOLVER", active: true, user: examplePerson },
      ],
      attachments: [
        {
          ...cardExample.attachments[0],
          id: examples.ResolveIssueRequest.uploadIds[0],
        },
      ],
      createdAt: "2026-01-03T10:00:00.000Z",
      updatedAt: "2026-01-03T10:00:00.000Z",
    },
  },
);
operation(
  "/issues/{issueId}/resolution",
  "get",
  "Get the completed resolution",
  ref("Resolution"),
);
operation(
  "/mandals/{mandalId}/issue-uploads",
  "post",
  "Upload a private image for preview or attachment",
  ref("Attachment"),
  null,
  {
    status: 201,
    description:
      "One JPEG or PNG up to 5 MiB; verified by decoding, metadata stripped, filename generated. Unattached uploads expire after 24 hours. No arbitrary URLs accepted.",
  },
);
paths["/mandals/{mandalId}/issue-uploads"].post.requestBody = {
  required: true,
  content: {
    "multipart/form-data": {
      schema: object({
        file: { type: "string", format: "binary" },
        purpose: { type: "string", enum: ["ISSUE", "COMMENT", "RESOLUTION"] },
      }),
    },
  },
};
operation(
  "/issue-uploads/{uploadId}/content",
  "get",
  "Read image bytes with fresh pincode authorization",
  string,
  null,
  { query: [query("thumbnail", boolean)] },
);
paths["/issue-uploads/{uploadId}/content"].get.responses["200"] = {
  description: "Private non-cacheable image bytes; use Authorization header",
  content: {
    "image/png": { schema: { type: "string", format: "binary" } },
    "image/jpeg": { schema: { type: "string", format: "binary" } },
  },
};
operation(
  "/issue-uploads/{uploadId}",
  "delete",
  "Abandon your unattached upload",
  object({ deleted: boolean }),
);
const spec = {
  openapi: "3.0.3",
  info: {
    title: "DigiMandal Issues API",
    version: "1.0.0",
    description:
      "Pincode-scoped issues using existing MySQL, JWT, Mandal membership and private ImageKit storage. Every issue belongs to one Mandal, while authenticated users with the same registered pincode may view, support and comment. Creation, participant selection, resolution and administration still require the relevant active Mandal role. The server derives and snapshots pincode from the creator profile. All returned timestamps are UTC. Request examples are illustrative, not seeded production data.",
  },
  servers: [{ url: "/api" }],
  security: [{ bearerAuth: [] }],
  tags: [{ name: "Issues" }],
  paths,
  components: {
    securitySchemes: {
      bearerAuth: { type: "http", scheme: "bearer", bearerFormat: "JWT" },
    },
    schemas,
  },
};
delete schemas.UpdateIssueRequest.required;
delete schemas.UpdateCommentRequest.required;
operation(
  "/issues/mandals",
  "get",
  "List Mandals available in the user's issue view",
  page(object({ id: integer, name: string, canCreateIssue: boolean })),
  null,
  { page: true },
);
operation(
  "/mandals/{mandalId}/issues/preview",
  "post",
  "Validate and preview an unpublished issue without claiming uploads",
  object({
    title: string,
    description: string,
    locationOrMandalName: string,
    pincode: { type: "string", pattern: "^[0-9]{6}$", readOnly: true },
    occurrenceDate: timestamp,
    creator: ref("Person"),
    mandal: object({ id: integer, name: string }),
    participants: array(
      object({
        memberId: integer,
        role: { type: "string", enum: ["MEMBER", "APPROVER"] },
        user: ref("Person"),
      }),
    ),
    attachments: array(ref("Attachment")),
  }),
  "CreateIssueRequest",
);
fs.writeFileSync(
  "docs/issues/openapi.json",
  JSON.stringify(spec, null, 2) + "\n",
);
