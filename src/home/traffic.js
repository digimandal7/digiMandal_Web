// Passive scrolling must not consume the budget for explicit user actions.
function isPassiveWrite(req) {
  return req.method === "PUT" && /^\/(posts\/\d+\/impression|stories\/\d+\/seen)\/?$/.test(req.path);
}
module.exports = { isPassiveWrite };
