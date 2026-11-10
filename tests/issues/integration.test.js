require("dotenv").config();
const { test } = require("node:test");
const assert = require("node:assert/strict");
const { randomUUID } = require("node:crypto");
const jwt = require("jsonwebtoken");
const sharp = require("sharp");
const prisma = require("../../src/config/prisma");
const app = require("../../src/server");
const storage = require("../../src/issues/storage");
const imagekit = require("../../src/config/imagekit");
const schema = new URL(process.env.DATABASE_URL).pathname.slice(1);
if (
  schema !== "digimandal_issues_test_v2" ||
  process.env.ISSUE_TEST_DATABASE !== schema
)
  throw new Error(
    "Use npm run test:issues:integration: isolated test database required",
  );

test("issue API: real MySQL transactions, all routes, tenancy, permissions, uploads and ordering", async (t) => {
  const users = [],
    mandals = [];
  let server;
  const originalUpload = imagekit.upload,
    originalDelete = imagekit.deleteFile,
    originalUrl = imagekit.url;
  let uploadedOptions;
  const png = await sharp({
    create: { width: 10, height: 10, channels: 3, background: "#123456" },
  })
    .png()
    .toBuffer();
  // Stub only the external storage boundary, never authentication, service, database or HTTP routes.
  imagekit.upload = async (options) => {
    uploadedOptions = options;
    return { fileId: randomUUID(), filePath: "/test/" + options.fileName };
  };
  imagekit.deleteFile = async () => ({});
  imagekit.url = () => "data:image/png;base64," + png.toString("base64");
  try {
    for (let n = 0; n < 5; n++)
      users.push(
        await prisma.user.create({
          data: {
            mobile: String(7000000000 + Math.floor(Math.random() * 999999999)),
            name: `Issue fixture ${n}`,
          },
        }),
      );
    const [admin, member, peer, outsider, inactive] = users;
    for (const owner of [admin, outsider])
      mandals.push(
        await prisma.mandal.create({
          data: {
            name: "Issue test " + randomUUID(),
            category: "Test",
            createdById: owner.id,
            status: "ACTIVE",
          },
        }),
      );
    const [a, b] = mandals;
    const memberships = [];
    for (const [u, m, role, isActive] of [
      [admin, a, "Admin", true],
      [member, a, "Member", true],
      [peer, a, "Member", true],
      [outsider, b, "Admin", true],
      [inactive, a, "Member", false],
    ])
      memberships.push(
        await prisma.mandalMember.create({
          data: {
            mandalId: m.id,
            userId: u.id,
            mobile: u.mobile,
            role,
            isActive,
          },
        }),
      );
    const [
      adminMembership,
      memberMembership,
      peerMembership,
      outsideMembership,
      inactiveMembership,
    ] = memberships;
    server = app.listen(0, "127.0.0.1");
    await new Promise((resolve) => server.once("listening", resolve));
    const base = "http://127.0.0.1:" + server.address().port + "/api";
    async function call(path, method = "GET", body, user = member, key) {
      const response = await fetch(base + path.replace(/^\/api\//, "/"), {
        method,
        headers: {
          ...(user
            ? {
                Authorization:
                  "Bearer " +
                  jwt.sign({ userId: user.id }, process.env.JWT_SECRET),
              }
            : {}),
          "Content-Type": "application/json",
          ...(key ? { "Idempotency-Key": key } : {}),
        },
        ...(body === undefined ? {} : { body: JSON.stringify(body) }),
      });
      return { status: response.status, ...(await response.json()) };
    }
    async function upload(
      purpose = "ISSUE",
      user = member,
      mandal = a,
      bytes = png,
      mime = "image/png",
    ) {
      const form = new FormData();
      form.append("purpose", purpose);
      form.append("file", new Blob([bytes], { type: mime }), "../../evil.png");
      const response = await fetch(
        base + `/mandals/${mandal.id}/issue-uploads`,
        {
          method: "POST",
          headers: {
            Authorization:
              "Bearer " + jwt.sign({ userId: user.id }, process.env.JWT_SECRET),
          },
          body: form,
        },
      );
      return { status: response.status, ...(await response.json()) };
    }
    const uploadId = async (purpose = "ISSUE", user = member, mandal = a) => {
      const r = await upload(purpose, user, mandal);
      assert.equal(r.status, 201, JSON.stringify(r));
      return r.data.id;
    };
    const creation = async (user = member, mandal = a, extra = {}) => ({
      title: "Repair request",
      description: "Please inspect the damaged surface.",
      locationOrMandalName: "Community entrance",
      occurrenceDate: "2026-01-02",
      participants: [],
      uploadIds: [await uploadId("ISSUE", user, mandal)],
      ...extra,
    });
    const expectStatus = (r, status) =>
      assert.equal(r.status, status, JSON.stringify(r));
    let issue, otherIssue;
    await t.test("publication retries, validation and ownership", async () => {
      const body = await creation();
      const preview = await call(
        `/mandals/${a.id}/issues/preview`,
        "POST",
        body,
      );
      expectStatus(preview, 200);
      assert.equal(preview.data.mandal.id, a.id);
      assert.equal(await prisma.issue.count({ where: { mandalId: a.id } }), 0);
      assert.equal(
        (
          await prisma.issueUpload.findUnique({
            where: { id: body.uploadIds[0] },
          })
        ).state,
        "READY",
      );
      assert.deepEqual(
        (await call("/issues/mandals")).data.items.map((m) => m.id),
        [a.id],
      );
      expectStatus(await call("/issues/mandals", "GET", undefined, null), 401);
      const secondMembership = await prisma.mandalMember.create({
        data: { mandalId: b.id, userId: member.id, role: "Member" },
      });
      expectStatus(
        await call(
          `/mandals/${b.id}/issues`,
          "POST",
          body,
          member,
          "cross-tenant-upload",
        ),
        400,
      );
      await prisma.mandalMember.delete({ where: { id: secondMembership.id } });
      const published = await Promise.all([
        call(`/mandals/${a.id}/issues`, "POST", body, member, "publication-1"),
        call(`/mandals/${a.id}/issues`, "POST", body, member, "publication-1"),
      ]);
      published.forEach((r) => expectStatus(r, 201));
      assert.equal(published[0].data.id, published[1].data.id);
      issue = published[0].data;
      expectStatus(
        await call(
          `/mandals/${a.id}/issues`,
          "POST",
          { ...body, title: "changed" },
          member,
          "publication-1",
        ),
        409,
      );
      expectStatus(
        await call(
          `/mandals/${a.id}/issues`,
          "POST",
          { ...body, mandalId: b.id },
          member,
          "invalid-body",
        ),
        400,
      );
      expectStatus(
        await call(
          `/mandals/${a.id}/issues`,
          "POST",
          { ...body, participants: [{ memberId: outsideMembership.id }] },
          member,
          "invalid-member",
        ),
        400,
      );
      expectStatus(
        await call(
          `/mandals/${a.id}/issues`,
          "POST",
          { ...body, participants: [{ memberId: inactiveMembership.id }] },
          member,
          "inactive-member",
        ),
        400,
      );
      expectStatus(
        await call(
          `/mandals/${a.id}/issues`,
          "POST",
          {
            ...body,
            participants: [{ memberId: memberMembership.id, role: "APPROVER" }],
          },
          member,
          "bad-approver",
        ),
        403,
      );
      expectStatus(
        await call(
          `/mandals/${a.id}/issues`,
          "POST",
          body,
          peer,
          "stolen-upload",
        ),
        400,
      );
      expectStatus(
        await call(
          `/mandals/${a.id}/issues`,
          "POST",
          body,
          member,
          "reused-upload",
        ),
        400,
      );
      expectStatus(
        await call(
          `/mandals/${b.id}/issues`,
          "POST",
          body,
          member,
          "wrong-mandal",
        ),
        404,
      );
      assert.equal(await prisma.issue.count({ where: { mandalId: a.id } }), 1);
      otherIssue = (
        await call(
          `/mandals/${b.id}/issues`,
          "POST",
          await creation(outsider, b),
          outsider,
          "outside-issue",
        )
      ).data;
      assert.ok(otherIssue.id);
    });
    await t.test(
      "all resource routes require auth and hide cross-Mandal existence",
      async () => {
        const body = await creation();
        const resolution = {
          resolutionDate: "2026-02-01",
          description: "Completed",
          memberIds: [memberMembership.id],
          uploadIds: body.uploadIds,
        };
        const routes = [
          [`/mandals/${a.id}/issues/preview`, "POST", body],
          [`/issues/${issue.id}`, "GET"],
          [`/issues/${issue.id}`, "PATCH", { title: "Change" }],
          [`/issues/${issue.id}`, "DELETE"],
          [`/issues/${issue.id}/support`, "POST"],
          [`/issues/${issue.id}/support`, "DELETE"],
          [`/issues/${issue.id}/supporters`, "GET"],
          [`/issues/${issue.id}/participants`, "PUT", { participants: [] }],
          [`/issues/${issue.id}/comments`, "GET"],
          [`/issues/${issue.id}/comments`, "POST", { text: "Private" }],
          [`/issues/${issue.id}/comments/999999`, "PATCH", { text: "Edit" }],
          [`/issues/${issue.id}/comments/999999`, "DELETE"],
          [
            `/issues/${issue.id}/comments/read`,
            "PUT",
            { through: new Date().toISOString() },
          ],
          [`/issues/${issue.id}/resolve`, "POST", resolution],
          [`/issues/${issue.id}/resolution`, "GET"],
          [`/mandals/${a.id}/members`, "GET"],
          [`/mandals/${a.id}/issues`, "POST", body],
          [`/issues?mandalId=${a.id}`, "GET"],
          [`/issue-uploads/${body.uploadIds[0]}`, "DELETE"],
        ];
        for (const [path, method, payload] of routes) {
          expectStatus(
            await call(path, method, payload, outsider, "tenancy-test"),
            404,
          );
          expectStatus(
            await call(path, method, payload, null, "tenancy-test"),
            401,
          );
        }
        expectStatus(
          await call(`/issues/${issue.id}`, "GET", undefined, inactive),
          404,
        );
        expectStatus(await upload("ISSUE", outsider, a), 404);
        const listed = await call("/issues", "GET", undefined, member);
        assert.ok(listed.data.items.every((r) => r.mandalId === a.id));
        await prisma.mandalMember.update({
          where: { id: adminMembership.id },
          data: { isActive: false },
        });
        expectStatus(
          await call(`/issues/${issue.id}`, "GET", undefined, admin),
          404,
        );
        await prisma.mandalMember.update({
          where: { id: adminMembership.id },
          data: { isActive: true },
        });
      },
    );
    await t.test(
      "private uploads, signature checks, size, expiry, attachment ownership and cleanup",
      async () => {
        assert.equal(uploadedOptions.isPrivateFile, true);
        assert.match(uploadedOptions.fileName, /^[\da-f-]{36}\.png$/);
        expectStatus(
          await upload("ISSUE", member, a, Buffer.from("not png")),
          400,
        );
        expectStatus(await upload("ISSUE", member, a, png, "image/jpeg"), 400);
        expectStatus(
          await upload("ISSUE", member, a, Buffer.alloc(5 * 1024 * 1024 + 1)),
          400,
        );
        expectStatus(await upload("OTHER"), 400);
        const own = await uploadId();
        const contentPath = `/issue-uploads/${own}/content`;
        expectStatus(await call(contentPath, "GET", undefined, peer), 404);
        expectStatus(await call(contentPath, "GET", undefined, outsider), 404);
        expectStatus(await call(contentPath, "GET", undefined, null), 401);
        let response = await fetch(base + contentPath, {
          headers: {
            Authorization:
              "Bearer " +
              jwt.sign({ userId: member.id }, process.env.JWT_SECRET),
          },
        });
        assert.equal(response.status, 200);
        assert.equal(
          response.headers.get("cache-control"),
          "private, no-store",
        );
        response = await fetch(
          base + issue.attachments[0].url.replace(/^\/api\//, "/"),
          {
            headers: {
              Authorization:
                "Bearer " +
                jwt.sign({ userId: peer.id }, process.env.JWT_SECRET),
            },
          },
        );
        assert.equal(response.status, 200);
        expectStatus(
          await call(issue.attachments[0].url, "GET", undefined, outsider),
          404,
        );
        expectStatus(await call(`/issue-uploads/${own}`, "DELETE"), 200);
        expectStatus(await call(contentPath), 404);
        const expired = await uploadId();
        await prisma.issueUpload.update({
          where: { id: expired },
          data: { expiresAt: new Date(0) },
        });
        expectStatus(
          await call(
            `/mandals/${a.id}/issues`,
            "POST",
            { ...(await creation()), uploadIds: [expired] },
            member,
            "expired-upload",
          ),
          400,
        );
        expectStatus(
          await call(`/issue-uploads/${issue.attachments[0].id}`, "DELETE"),
          409,
        );
        assert.ok((await storage.cleanup()).deleted >= 2);
      },
    );
    await t.test(
      "edit permissions, member search and selected participants",
      async () => {
        const adminPhoto = await uploadId("ISSUE", admin);
        const amended = await call(
          `/issues/${issue.id}`,
          "PATCH",
          { uploadIds: [issue.attachments[0].id, adminPhoto] },
          admin,
        );
        expectStatus(amended, 200);
        assert.equal(amended.data.totalAttachmentCount, 2);
        expectStatus(
          await call(`/issues/${issue.id}`, "PATCH", {
            title: "Updated title",
          }),
          200,
        );
        expectStatus(
          await call(
            `/issues/${issue.id}`,
            "PATCH",
            { title: "Not yours" },
            peer,
          ),
          403,
        );
        expectStatus(
          await call(
            `/issues/${issue.id}`,
            "PATCH",
            { status: "RESOLVED" },
            admin,
          ),
          400,
        );
        expectStatus(
          await call(`/issues/${issue.id}/participants`, "PUT", {
            participants: [{ memberId: peerMembership.id }],
          }),
          200,
        );
        const list = await call(
          `/mandals/${a.id}/members?role=Member&search=fixture&limit=1`,
        );
        expectStatus(list, 200);
        assert.equal(list.data.total, 2);
        assert.equal(list.data.items.length, 1);
        expectStatus(
          await call(
            `/issues/${issue.id}/participants`,
            "PUT",
            {
              participants: [{ memberId: peerMembership.id, role: "APPROVER" }],
            },
            admin,
          ),
          200,
        );
        assert.equal(
          (await call(`/issues/${issue.id}`, "GET", undefined, peer)).data
            .permissions.canResolve,
          true,
        );
        expectStatus(
          await call(`/issues/${issue.id}/participants`, "PUT", {
            participants: [],
          }),
          403,
        );
      },
    );
    await t.test(
      "duplicate and concurrent support with counts and supporter pagination",
      async () => {
        const responses = await Promise.all(
          Array.from({ length: 6 }, () =>
            call(`/issues/${issue.id}/support`, "POST"),
          ),
        );
        responses.forEach((r) => {
          expectStatus(r, 200);
          assert.equal(r.data.supporterCount, 1);
        });
        await call(`/issues/${issue.id}/support`, "POST", undefined, peer);
        assert.equal(
          (await call(`/issues/${issue.id}/supporters?limit=1`)).data.total,
          2,
        );
        assert.equal(
          (await call(`/issues/${issue.id}`)).data.isSupported,
          true,
        );
        await call(`/issues/${issue.id}/support`, "DELETE");
        assert.equal(
          (await call(`/issues/${issue.id}/support`, "DELETE")).data
            .supporterCount,
          1,
        );
        assert.equal(
          await prisma.issueSupporter.count({ where: { issueId: issue.id } }),
          1,
        );
      },
    );
    await t.test(
      "comments: own edit/delete, admin moderation, attachments and unread count",
      async () => {
        const photo = await uploadId("COMMENT");
        const c = await call(`/issues/${issue.id}/comments`, "POST", {
          text: "Please review",
          uploadIds: [photo],
        });
        expectStatus(c, 201);
        expectStatus(
          await call(
            `/issues/${issue.id}/comments/${c.data.id}`,
            "PATCH",
            { text: "No" },
            peer,
          ),
          403,
        );
        expectStatus(
          await call(
            `/issues/${issue.id}/comments/${c.data.id}`,
            "DELETE",
            undefined,
            peer,
          ),
          403,
        );
        expectStatus(
          await call(
            `/issues/${issue.id}/comments/${c.data.id}`,
            "PATCH",
            { text: "No" },
            admin,
          ),
          403,
        );
        expectStatus(
          await call(
            `/issues/${otherIssue.id}/comments/${c.data.id}`,
            "PATCH",
            { text: "No" },
            outsider,
          ),
          404,
        );
        expectStatus(
          await call(`/issues/${issue.id}/comments/${c.data.id}`, "PATCH", {
            text: "Updated",
            uploadIds: [],
          }),
          200,
        );
        expectStatus(
          await call(`/issues/${issue.id}/comments`, "POST", {
            text: "bad media",
            uploadIds: [await uploadId("ISSUE")],
          }),
          400,
        );
        assert.equal(
          (await call(`/issues/${issue.id}`, "GET", undefined, peer)).data
            .newCommentCount,
          1,
        );
        const listing = await call(
          `/issues/${issue.id}/comments?limit=1`,
          "GET",
          undefined,
          peer,
        );
        assert.equal(listing.data.total, 1);
        await call(
          `/issues/${issue.id}/comments/read`,
          "PUT",
          { through: listing.serverTime },
          peer,
        );
        assert.equal(
          (await call(`/issues/${issue.id}`, "GET", undefined, peer)).data
            .newCommentCount,
          0,
        );
        expectStatus(
          await call(
            `/issues/${issue.id}/comments/${c.data.id}`,
            "DELETE",
            undefined,
            admin,
          ),
          200,
        );
        const own = await call(`/issues/${issue.id}/comments`, "POST", {
          text: "Own comment",
        });
        expectStatus(
          await call(`/issues/${issue.id}/comments/${own.data.id}`, "DELETE"),
          200,
        );
        assert.equal((await call(`/issues/${issue.id}`)).data.commentCount, 0);
      },
    );
    await t.test(
      "resolution permissions, selected providers, concurrency, idempotency and immutable status",
      async () => {
        const body = {
          resolutionDate: "2026-02-01",
          description: "Work completed and inspected.",
          memberIds: [memberMembership.id],
          uploadIds: [await uploadId("RESOLUTION", peer)],
        };
        expectStatus(
          await call(
            `/issues/${issue.id}/resolve`,
            "POST",
            body,
            member,
            "resolve-member",
          ),
          403,
        );
        expectStatus(
          await call(
            `/issues/${issue.id}/resolve`,
            "POST",
            { ...body, memberIds: [outsideMembership.id] },
            peer,
            "resolve-invalid",
          ),
          400,
        );
        const badProof = await uploadId("COMMENT", peer);
        expectStatus(
          await call(
            `/issues/${issue.id}/resolve`,
            "POST",
            { ...body, uploadIds: [badProof] },
            peer,
            "wrong-proof-purpose",
          ),
          400,
        );
        assert.equal(
          await prisma.issueResolution.count({ where: { issueId: issue.id } }),
          0,
        );
        assert.equal(
          (await call(`/issues/${issue.id}`)).data.status,
          "PENDING",
        );
        const results = await Promise.all([
          call(
            `/issues/${issue.id}/resolve`,
            "POST",
            body,
            peer,
            "resolution-first",
          ),
          call(
            `/issues/${issue.id}/resolve`,
            "POST",
            body,
            peer,
            "resolution-other",
          ),
        ]);
        assert.deepEqual(results.map((r) => r.status).sort(), [200, 409]);
        const winningKey =
          results[0].status === 200 ? "resolution-first" : "resolution-other";
        expectStatus(
          await call(
            `/issues/${issue.id}/resolve`,
            "POST",
            body,
            peer,
            winningKey,
          ),
          200,
        );
        expectStatus(
          await call(
            `/issues/${issue.id}/resolve`,
            "POST",
            { ...body, description: "different" },
            peer,
            winningKey,
          ),
          409,
        );
        expectStatus(
          await call(`/issues/${issue.id}`, "PATCH", { title: "Change" }),
          403,
        );
        assert.equal(
          await prisma.issueResolution.count({ where: { issueId: issue.id } }),
          1,
        );
        const detail = await call(`/issues/${issue.id}`);
        assert.equal(detail.data.status, "RESOLVED");
        assert.equal(
          detail.data.resolution.solutionProviders[0].memberId,
          memberMembership.id,
        );
        assert.equal(
          (await call(`/issues/${issue.id}/resolution`)).data.resolver.id,
          peer.id,
        );
        await assert.rejects(
          prisma.issue.update({
            where: { id: issue.id },
            data: { status: "PENDING" },
          }),
        );
      },
    );
    await t.test(
      "status tabs, latest/collaborated ordering, pagination, card fields and bounded queries",
      async () => {
        const latest = (
          await call(
            `/mandals/${a.id}/issues`,
            "POST",
            await creation(admin),
            admin,
            "latest-issue",
          )
        ).data;
        const first = await call("/issues?sort=LATEST&limit=1");
        assert.equal(first.data.items[0].id, latest.id);
        assert.equal(
          (await call("/issues?sort=LATEST&limit=1&page=2")).data.items[0].id,
          issue.id,
        );
        assert.equal(
          (await call("/issues?sort=COLLABORATED&limit=1")).data.items[0].id,
          issue.id,
        );
        assert.equal((await call("/issues?status=PENDING")).data.total, 1);
        assert.equal((await call("/issues?status=RESOLVED")).data.total, 1);
        assert.equal((await call("/issues?status=ALL")).data.total, 2);
        assert.equal(
          (await call("/issues?search=Updated")).data.items[0].id,
          issue.id,
        );
        expectStatus(await call("/issues?status=invalid"), 400);
        for (const sort of ["LATEST", "COLLABORATED"]) {
          const literalSearch = await call(`/issues?sort=${sort}&search=%25`);
          assert.equal(literalSearch.data.total, 0);
          assert.equal(literalSearch.data.items.length, 0);
        }
        expectStatus(await call("/issues?sort=bad"), 400);
        expectStatus(await call("/issues?limit=101"), 400);
        const row = first.data.items[0];
        for (const field of [
          "creator",
          "mandal",
          "shortDescription",
          "supporterCount",
          "commentCount",
          "participants",
          "attachments",
          "totalAttachmentCount",
          "isSupported",
          "permissions",
        ])
          assert.ok(field in row, field);
        let queryCount = 0;
        const listener = () => queryCount++;
        prisma.$on("query", listener);
        await call("/issues?limit=1");
        const small = queryCount;
        queryCount = 0;
        await call("/issues?limit=100");
        assert.ok(queryCount <= small + 3, `${queryCount} vs ${small}`);
        expectStatus(await call(`/issues/${latest.id}`, "DELETE"), 403);
        expectStatus(
          await call(`/issues/${latest.id}`, "DELETE", undefined, admin),
          200,
        );
        expectStatus(await call(`/issues/${latest.id}`), 404);
        expectStatus(
          await call(latest.attachments[0].url, "GET", undefined, admin),
          404,
        );
        assert.equal((await call("/issues")).data.total, 1);
      },
    );
  } finally {
    imagekit.upload = originalUpload;
    imagekit.deleteFile = originalDelete;
    imagekit.url = originalUrl;
    if (server) {
      server.closeAllConnections();
      await new Promise((resolve) => server.close(resolve));
    }
    await prisma.issue.deleteMany({
      where: { mandalId: { in: mandals.map((m) => m.id) } },
    });
    await prisma.mandal.deleteMany({
      where: { id: { in: mandals.map((m) => m.id) } },
    });
    await prisma.user.deleteMany({
      where: { id: { in: users.map((u) => u.id) } },
    });
    await prisma.$disconnect();
  }
});
