const fail = (status, code, message, details) => {
  throw Object.assign(new Error(message), { status, code, details });
};
const invalid = (field, message) =>
  fail(400, "VALIDATION_ERROR", "Invalid request", { [field]: message });
function id(value, field = "id") {
  if (!/^[1-9]\d*$/.test(String(value)) || !Number.isSafeInteger(Number(value)))
    invalid(field, "Expected a positive integer");
  return Number(value);
}
function text(value, field, max = 10000) {
  if (typeof value !== "string" || !value.trim() || value.trim().length > max)
    invalid(field, `Required text, maximum ${max} characters`);
  return value.trim();
}
function date(value, field) {
  if (
    typeof value !== "string" ||
    !/^\d{4}-\d{2}-\d{2}(T\d{2}:\d{2}:\d{2}(\.\d{1,3})?(Z|[+-]\d{2}:\d{2}))?$/.test(
      value,
    ) ||
    !Number.isFinite(Date.parse(value))
  )
    invalid(field, "Use ISO-8601 with timezone, or YYYY-MM-DD");
  const d = new Date(value);
  if (
    new Date(value.slice(0, 10)).toISOString().slice(0, 10) !==
    value.slice(0, 10)
  )
    invalid(field, "Invalid calendar date");
  return d;
}
function only(body, fields) {
  if (!body || typeof body !== "object" || Array.isArray(body))
    invalid("body", "Expected an object");
  for (const key of Object.keys(body))
    if (!fields.includes(key)) invalid(key, "Unknown or immutable field");
}
function uploads(value = [], required = false) {
  const max = Number(process.env.ISSUE_MAX_ATTACHMENTS || 10);
  if (!Number.isInteger(max) || max < 1 || max > 50)
    fail(
      500,
      "CONFIGURATION_ERROR",
      "ISSUE_MAX_ATTACHMENTS must be an integer from 1 to 50",
    );
  if (
    !Array.isArray(value) ||
    value.length > max ||
    (required && !value.length) ||
    value.some((v) => typeof v !== "string" || !/^[a-f0-9-]{36}$/i.test(v)) ||
    new Set(value).size !== value.length
  )
    invalid(
      "uploadIds",
      `Expected ${required ? 1 : 0}-${max} unique upload UUIDs`,
    );
  return value;
}
function participants(value = []) {
  if (!Array.isArray(value) || value.length > 100)
    invalid("participants", "Maximum 100 members");
  const result = value.map((p) => {
    only(p, ["memberId", "role"]);
    const role = p.role || "MEMBER";
    if (!["MEMBER", "APPROVER"].includes(role))
      invalid("participants", "Role must be MEMBER or APPROVER");
    return { memberId: id(p.memberId, "participants"), role };
  });
  if (new Set(result.map((p) => p.memberId)).size !== result.length)
    invalid("participants", "Duplicate member");
  return result;
}
function issue(body, partial = false) {
  only(body, [
    "title",
    "description",
    "locationOrMandalName",
    "occurrenceDate",
    "participants",
    "uploadIds",
  ]);
  const result = {};
  for (const [key, max] of Object.entries({
    title: 200,
    description: 10000,
    locationOrMandalName: 255,
  }))
    if (!partial || key in body) result[key] = text(body[key], key, max);
  if (!partial || "occurrenceDate" in body)
    result.occurrenceDate = date(body.occurrenceDate, "occurrenceDate");
  if (!partial || "participants" in body)
    result.participants = participants(body.participants);
  if (!partial || "uploadIds" in body)
    result.uploadIds = uploads(body.uploadIds, true);
  if (!Object.keys(result).length)
    invalid("body", "At least one field is required");
  return result;
}
function comment(body, partial = false) {
  only(body, ["text", "uploadIds"]);
  const result = {};
  if (!partial || "text" in body) result.text = text(body.text, "text", 2000);
  if (!partial || "uploadIds" in body)
    result.uploadIds = uploads(body.uploadIds);
  if (!Object.keys(result).length)
    invalid("body", "At least one field is required");
  return result;
}
function resolution(body) {
  only(body, ["resolutionDate", "description", "memberIds", "uploadIds"]);
  if (
    !Array.isArray(body.memberIds) ||
    !body.memberIds.length ||
    body.memberIds.length > 100
  )
    invalid("memberIds", "Select 1-100 solution providers");
  const memberIds = body.memberIds.map((v) => id(v, "memberIds"));
  if (new Set(memberIds).size !== memberIds.length)
    invalid("memberIds", "Duplicate member");
  return {
    resolutionDate: date(body.resolutionDate, "resolutionDate"),
    description: text(body.description, "description"),
    memberIds,
    uploadIds: uploads(body.uploadIds, true),
  };
}
function paging(query) {
  const page = id(query.page ?? 1, "page"),
    limit = id(query.limit ?? 20, "limit");
  if (limit > 100 || page > 100000)
    invalid("pagination", "limit <= 100 and page <= 100000");
  return { page, limit, skip: (page - 1) * limit };
}
function key(value) {
  if (typeof value !== "string" || !/^[\w.-]{8,100}$/.test(value))
    invalid(
      "Idempotency-Key",
      "Required: 8-100 letters, numbers, dots, hyphens or underscores",
    );
  return value;
}
module.exports = {
  fail,
  invalid,
  id,
  text,
  date,
  only,
  uploads,
  participants,
  issue,
  comment,
  resolution,
  paging,
  key,
};
