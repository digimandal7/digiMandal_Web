const { test } = require("node:test");
const assert = require("node:assert/strict");
const v = require("../../src/issues/validation");
const policy = require("../../src/issues/policy");
test("strict DTOs reject tenancy overrides, arbitrary URLs and invalid dates", () => {
  assert.throws(
    () => v.issue({ mandalId: 2 }),
    (e) => Boolean(e.details.mandalId),
  );
  assert.throws(
    () => v.issue({ pincode: "411001" }),
    (e) => Boolean(e.details.pincode),
  );
  assert.throws(() => v.uploads(["https://example.com/image.png"]));
  assert.throws(() => v.date("2026-02-30", "date"));
  assert.throws(() => v.date("2026-01-01T12:00:00", "date"));
  assert.equal(
    v.date("2026-01-01T12:00:00+05:30", "date").toISOString(),
    "2026-01-01T06:30:00.000Z",
  );
  assert.throws(() => v.participants([{ memberId: 1 }, { memberId: 1 }]));
  assert.throws(() => v.participants([{ memberId: 1, role: "RESOLVER" }]));
  assert.throws(() => v.paging({ limit: 101 }));
  assert.throws(() => v.key("x"));
});
test("only scoped admin permissions confer administrative authority", () => {
  const member = {
    id: 4,
    userId: 3,
    mandalId: 2,
    roleId: 5,
    roleRef: { mandalId: 99, permissions: ["*"] },
    mandal: { createdById: 1 },
  };
  const issue = { status: "PENDING", createdByUserId: 3 };
  assert.equal(policy.isAdmin(member), false);
  assert.equal(policy.permissions(issue, member).canEdit, true);
  assert.equal(policy.permissions(issue, member).canResolve, false);
  assert.equal(policy.permissions(issue, member, true).canResolve, true);
  assert.equal(
    policy.permissions({ ...issue, status: "RESOLVED" }, member, true)
      .canResolve,
    false,
  );
  assert.equal(
    policy.isAdmin({ ...member, roleRef: { mandalId: 2, permissions: ["*"] } }),
    true,
  );
  assert.equal(policy.isAdmin(null), false);
  assert.deepEqual(policy.permissions(issue, null), {
    canEdit: false,
    canResolve: false,
    canDelete: false,
    canComment: true,
    canSupport: true,
    canDesignateApprovers: false,
  });
});
test("viewer requires a valid registration PIN code", async () => {
  const db = {
    user: { findUnique: async () => ({ id: 2, pincode: "411001" }) },
  };
  assert.equal((await policy.viewer(db, 2)).pincode, "411001");
  db.user.findUnique = async () => ({ id: 2, pincode: null });
  await assert.rejects(
    policy.viewer(db, 2),
    (e) => e.code === "PINCODE_REQUIRED",
  );
});
test("membership guard fails closed for inactive/missing members including owners", async () => {
  let where;
  const db = {
    mandalMember: {
      findFirst: async (args) => {
        where = args.where;
        return null;
      },
    },
  };
  await assert.rejects(policy.membership(db, 1, 2), (e) => e.status === 404);
  assert.deepEqual(where, { mandalId: 1, userId: 2, isActive: true });
});
test("selection rejects cross-Mandal members and member-granted approvers", async () => {
  const db = { mandalMember: { findMany: async () => [] } };
  await assert.rejects(
    policy.selected(db, 1, [{ memberId: 2, role: "MEMBER" }], {}),
    (e) => e.status === 400,
  );
  db.mandalMember.findMany = async () => [{ id: 2 }];
  await assert.rejects(
    policy.selected(db, 1, [{ memberId: 2, role: "APPROVER" }], {
      mandalId: 1,
      userId: 1,
    }),
    (e) => e.status === 403,
  );
});

const repo = require("../../src/issues/repository");
const service = require("../../src/issues/service");
test("support service records activity only when support changes, and does not write on denied access", async () => {
  const transaction = repo.transaction,
    access = policy.issueAccess;
  let supported = false,
    writes = 0,
    activities = 0;
  const db = {
    issueSupporter: {
      findUnique: async () => (supported ? { userId: 2 } : null),
      create: async () => {
        supported = true;
        writes++;
      },
      delete: async () => {
        supported = false;
        writes++;
      },
      count: async () => (supported ? 1 : 0),
    },
    issueActivity: {
      create: async () => {
        activities++;
      },
    },
  };
  try {
    repo.transaction = (work) => work(db);
    policy.issueAccess = async () => ({ issue: {}, member: {} });
    assert.deepEqual(await service.support(2, 1, true), {
      isSupported: true,
      supporterCount: 1,
    });
    await service.support(2, 1, true);
    assert.equal(writes, 1);
    assert.equal(activities, 1);
    await service.support(2, 1, false);
    await service.support(2, 1, false);
    assert.equal(writes, 2);
    assert.equal(activities, 2);
    policy.issueAccess = async () => {
      throw Object.assign(new Error("Not found"), { status: 404 });
    };
    await assert.rejects(service.support(2, 1, true), (e) => e.status === 404);
    assert.equal(writes, 2);
  } finally {
    repo.transaction = transaction;
    policy.issueAccess = access;
  }
});
