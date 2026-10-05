const { test } = require("node:test");
const assert = require("node:assert/strict");
const bcrypt = require("bcryptjs");
const jwt = require("jsonwebtoken");
const User = require("../models/User");
const Branch = require("../models/Branch");
const auth = require("../controllers/authController");
const { protect, adminOnly } = require("../middleware/authMiddleware");
const {
  SESSION_SECONDS, TOKEN_ISSUER, TOKEN_AUDIENCE, normalizeEmail, validPassword,
  publicUser, cookieName, readSessionCookie, createSessionToken, verifySessionToken,
} = require("../services/authSecurity");

// No dotenv and no database connection: these tests never use live credentials.
const TEST_SECRET = "isolated-auth-security-test-secret-at-least-32-bytes";
const USER_ID = "507f1f77bcf86cd799439011";
const BRANCH_ID = "507f1f77bcf86cd799439022";
const LEGACY_HASH = bcrypt.hashSync("legacy", 4);

function testEnvironment(t, production = false) {
  const previous = { NODE_ENV: process.env.NODE_ENV, JWT_SECRET: process.env.JWT_SECRET };
  process.env.NODE_ENV = production ? "production" : "test";
  process.env.JWT_SECRET = TEST_SECRET;
  t.after(() => {
    for (const [key, value] of Object.entries(previous)) {
      if (value === undefined) delete process.env[key]; else process.env[key] = value;
    }
  });
}

function response() {
  return {
    statusCode: 200, headers: {}, cookies: [], clearedCookies: [],
    status(code) { this.statusCode = code; return this; },
    json(body) { this.body = body; return this; },
    set(name, value) { this.headers[name] = value; return this; },
    cookie(name, value, options) { this.cookies.push({ name, value, options }); return this; },
    clearCookie(name, options) { this.clearedCookies.push({ name, options }); return this; },
  };
}

function fakeUser(overrides = {}) {
  return {
    _id: USER_ID, name: "Test Student", email: "student@example.test", role: "student",
    isActive: true, isEmailVerified: false, password: LEGACY_HASH, tokenVersion: 0,
    branch: { _id: BRANCH_ID, name: "Electronics", code: "EC", privateField: "private-branch-data" },
    subscription: {
      plan: "free", status: "inactive", paymentProvider: "private-provider",
      paymentCustomerId: "private-customer", subscriptionId: "private-subscription",
    },
    ...overrides,
  };
}

function userQuery(user, onSelect = () => {}) {
  return { select(fields) { onSelect(fields); return this; }, populate: async () => user };
}

function signedClaims(payload = {}, options = {}) {
  return jwt.sign({ tokenVersion: 0, ...payload }, TEST_SECRET, {
    algorithm: "HS256", issuer: TOKEN_ISSUER, audience: TOKEN_AUDIENCE,
    subject: USER_ID, expiresIn: SESSION_SECONDS, ...options,
  });
}

test("password validation enforces Unicode character count and bcrypt byte limit", () => {
  assert.equal(validPassword("correct horse battery staple"), true);
  assert.equal(validPassword("a".repeat(72)), true);
  assert.equal(validPassword("a".repeat(73)), false);
  assert.equal(validPassword("😀".repeat(18)), true);
  assert.equal(validPassword("😀".repeat(19)), false);
  assert.equal(validPassword("😀".repeat(6)), false);
  assert.equal(validPassword("legacy"), false);
  assert.equal(validPassword("legacy", { isNew: false }), true);
  for (const value of [null, {}, [], 123456789012, "", "long-password\0value"]) {
    assert.equal(validPassword(value), false);
  }
});

test("email validation rejects objects, control characters and oversized addresses", () => {
  assert.equal(normalizeEmail(" Student@Example.Test "), "student@example.test");
  for (const value of [{ $ne: null }, ["test@example.test"], null, "not-an-email", "a\n@example.test", "a".repeat(65) + "@example.test"]) {
    assert.equal(normalizeEmail(value), null);
  }
});

test("public user responses allowlist profile data and exclude authentication/payment internals", () => {
  const user = fakeUser({ privateField: "private-user-data" });
  const payload = publicUser(user);
  assert.equal(payload.id, USER_ID);
  assert.equal(payload._id, USER_ID);
  assert.deepEqual(payload.branch, { _id: BRANCH_ID, name: "Electronics", code: "EC" });
  assert.deepEqual(payload.subscription, { plan: "free", status: "inactive", startDate: undefined, endDate: undefined });
  for (const secret of ["password", "tokenVersion", "private-", "paymentCustomerId", "subscriptionId"]) {
    assert.equal(JSON.stringify(payload).includes(secret), false, secret);
  }
  assert.equal(User.schema.path("password").options.select, false);
  assert.equal(User.schema.path("tokenVersion").options.select, false);
});

test("login supports legacy passwords and sets a strict production cookie without returning a token", async t => {
  testEnvironment(t, true);
  const user = fakeUser();
  t.mock.method(User, "findOne", filter => {
    assert.deepEqual(filter, { email: "student@example.test" });
    return userQuery(user, fields => assert.equal(fields, "+password +tokenVersion"));
  });
  const res = response();
  await auth.loginUser({ body: { email: " Student@Example.Test ", password: "legacy" } }, res);
  assert.equal(res.statusCode, 200);
  assert.equal(Object.hasOwn(res.body, "token"), false);
  assert.equal(Object.hasOwn(res.body.user, "password"), false);
  assert.equal(res.headers["Cache-Control"], "no-store");
  assert.equal(res.cookies.length, 1);
  const cookie = res.cookies[0];
  assert.equal(cookie.name, "__Host-gate_session");
  assert.deepEqual(cookie.options, { httpOnly: true, secure: true, sameSite: "strict", path: "/", maxAge: SESSION_SECONDS * 1000 });
  const claims = verifySessionToken(cookie.value);
  assert.equal(claims.sub, USER_ID);
  assert.equal(claims.tokenVersion, 0);
  assert.equal(claims.exp - claims.iat, SESSION_SECONDS);
  assert.equal(Object.hasOwn(claims, "role"), false);
});

test("missing, disabled and incorrect-password accounts have identical login errors", async t => {
  testEnvironment(t);
  let currentUser;
  t.mock.method(User, "findOne", () => userQuery(currentUser));
  const responses = [];
  for (const user of [null, fakeUser({ isActive: false }), fakeUser()]) {
    currentUser = user;
    const res = response();
    await auth.loginUser({ body: { email: "student@example.test", password: "wrong-password" } }, res);
    assert.equal(res.statusCode, 401);
    assert.deepEqual(res.cookies, []);
    responses.push(res.body);
  }
  assert.deepEqual(responses[0], responses[1]);
  assert.deepEqual(responses[1], responses[2]);
});

test("invalid login input is rejected before database queries", async t => {
  testEnvironment(t);
  t.mock.method(User, "findOne", () => { assert.fail("Invalid input reached database"); });
  for (const body of [undefined, null, {}, { email: { $ne: null }, password: "legacy" }, { email: "student@example.test", password: ["legacy"] }, { email: "student@example.test", password: "😀".repeat(19) }]) {
    const res = response();
    await auth.loginUser({ body }, res);
    assert.equal(res.statusCode, 401);
  }
});

test("registration validates hostile values and prevents client privilege assignment", async t => {
  testEnvironment(t);
  const input = {
    name: "Test Student", email: "student@example.test", password: "a strong password",
    mobileNumber: "+91 98765 43210", collegeName: "Test College", passingYear: "2027", branch: BRANCH_ID,
    role: "admin", isEmailVerified: true, subscription: { plan: "premium", status: "active" },
  };
  t.mock.method(Branch, "findOne", () => ({ select: async () => ({ _id: BRANCH_ID, name: "Electronics", code: "EC" }) }));
  t.mock.method(User, "exists", async () => null);
  let created;
  t.mock.method(User, "create", async payload => {
    created = payload;
    return { toObject: () => ({ _id: USER_ID, ...payload }) };
  });
  for (const body of [{ ...input, name: {} }, { ...input, passingYear: [2027] }, { ...input, mobileNumber: {} }, { ...input, branch: { $ne: null } }, { ...input, password: "short" }]) {
    const res = response();
    await auth.registerUser({ body }, res);
    assert.equal(res.statusCode, 400);
    assert.equal(created, undefined);
  }
  const res = response();
  await auth.registerUser({ body: input }, res);
  assert.equal(res.statusCode, 201);
  assert.equal(created.role, "student");
  assert.equal(created.isEmailVerified, false);
  assert.deepEqual(created.subscription, { plan: "free", status: "inactive" });
  assert.equal(bcrypt.getRounds(created.password), 12);
  assert.equal(await bcrypt.compare(input.password, created.password), true);
  assert.equal(Object.hasOwn(res.body.user, "password"), false);
});

test("session verification rejects wrong algorithms, destinations, expiry and legacy claims", t => {
  testEnvironment(t);
  const tokens = [
    signedClaims({}, { algorithm: "HS384" }),
    signedClaims({}, { issuer: "another-app" }),
    signedClaims({}, { audience: "another-client" }),
    signedClaims({}, { expiresIn: -10 }),
    signedClaims({}, { expiresIn: "7d" }),
    signedClaims({ tokenVersion: -1 }),
    signedClaims({ tokenVersion: "0" }),
    signedClaims({ iat: Math.floor(Date.now() / 1000) + 60 }),
    signedClaims({}, { subject: "not-an-object-id" }),
    jwt.sign({ userId: USER_ID, role: "admin" }, TEST_SECRET),
  ];
  for (const token of tokens) assert.throws(() => verifySessionToken(token));
  assert.equal(verifySessionToken(createSessionToken(fakeUser())).sub, USER_ID);
});

test("cookie parser rejects duplicates, oversized values and malformed encoding", t => {
  testEnvironment(t);
  assert.equal(readSessionCookie({ headers: { cookie: "other=1; gate_session=valid.jwt.here" } }), "valid.jwt.here");
  for (const cookie of ["gate_session=one; gate_session=two", "gate_session=%ZZ", "gate_session=", "gate_session=" + "x".repeat(2049)]) {
    assert.equal(readSessionCookie({ headers: { cookie } }), null);
  }
});

test("protected routes reject old bearer authorization and untrusted tokens before querying MongoDB", async t => {
  testEnvironment(t);
  t.mock.method(User, "findById", () => { assert.fail("Untrusted token reached database"); });
  for (const headers of [{}, { authorization: `Bearer ${createSessionToken(fakeUser())}` }, { cookie: `${cookieName()}=${signedClaims({}, { audience: "wrong-client" })}` }]) {
    const res = response();
    await protect({ headers }, res, () => assert.fail("Untrusted session authorized"));
    assert.equal(res.statusCode, 401);
  }
});

test("authorization uses current account state and database role instead of JWT role", async t => {
  testEnvironment(t);
  let currentUser = fakeUser();
  t.mock.method(User, "findById", id => {
    assert.equal(id, USER_ID);
    return userQuery(currentUser, fields => assert.equal(fields, "+tokenVersion"));
  });
  const headers = { cookie: `${cookieName()}=${signedClaims({ role: "admin" })}` };
  const req = { headers };
  let nextCalls = 0;
  await protect(req, response(), () => { nextCalls++; });
  assert.equal(nextCalls, 1);
  const adminRes = response();
  adminOnly(req, adminRes, () => assert.fail("Token role elevated privileges"));
  assert.equal(adminRes.statusCode, 403);
  for (const user of [null, fakeUser({ isActive: false }), fakeUser({ tokenVersion: 1 })]) {
    currentUser = user;
    const res = response();
    await protect({ headers }, res, () => assert.fail("Revoked account authorized"));
    assert.equal(res.statusCode, 401);
    assert.equal(res.clearedCookies.length, 1);
  }
});

test("password resets hash the password and atomically invalidate existing sessions", async t => {
  testEnvironment(t);
  const user = fakeUser();
  const oldToken = createSessionToken(user);
  t.mock.method(User, "findOneAndUpdate", async (filter, update, options) => {
    assert.deepEqual(filter, { email: "student@example.test", isActive: true });
    assert.deepEqual(update.$inc, { tokenVersion: 1 });
    assert.deepEqual(options, { new: true, runValidators: true });
    assert.equal(await bcrypt.compare("new strong password", update.$set.password), true);
    user.password = update.$set.password;
    user.tokenVersion += update.$inc.tokenVersion;
    return user;
  });
  t.mock.method(User, "findById", () => userQuery(user));
  const resetRes = response();
  await auth.adminResetPassword({ body: { email: " Student@Example.Test ", newPassword: "new strong password" } }, resetRes);
  assert.equal(resetRes.statusCode, 200);
  const oldRes = response();
  await protect({ headers: { cookie: `${cookieName()}=${oldToken}` } }, oldRes, () => assert.fail("Old password session survived reset"));
  assert.equal(oldRes.statusCode, 401);
  let authorized = false;
  await protect({ headers: { cookie: `${cookieName()}=${createSessionToken(user)}` } }, response(), () => { authorized = true; });
  assert.equal(authorized, true);
});

test("auth errors do not expose database details or session secrets", async t => {
  testEnvironment(t);
  const privateMessage = "private-database-uri-and-collection-details";
  t.mock.method(User, "findOne", () => { throw new Error(privateMessage); });
  t.mock.method(User, "findById", () => { throw new Error(privateMessage); });
  const loginRes = response();
  await auth.loginUser({ body: { email: "student@example.test", password: "legacy" } }, loginRes);
  assert.equal(loginRes.statusCode, 500);
  const protectRes = response();
  await protect({ headers: { cookie: `${cookieName()}=${createSessionToken(fakeUser())}` } }, protectRes, () => assert.fail("Database failure authorized"));
  assert.equal(protectRes.statusCode, 500);
  for (const res of [loginRes, protectRes]) {
    assert.equal(JSON.stringify(res.body).includes(privateMessage), false);
    assert.equal(JSON.stringify(res.body).includes(TEST_SECRET), false);
  }
});

test("current user and logout return uncached allowlisted data and clear the matching cookie", t => {
  testEnvironment(t, true);
  const res = response();
  auth.getCurrentUser({ user: fakeUser() }, res);
  assert.equal(res.headers["Cache-Control"], "no-store");
  assert.equal(Object.hasOwn(res.body.user, "password"), false);
  assert.equal(Object.hasOwn(res.body.user, "tokenVersion"), false);
  const logoutRes = response();
  auth.logoutUser({}, logoutRes);
  assert.equal(logoutRes.statusCode, 200);
  assert.deepEqual(logoutRes.clearedCookies, [{ name: "__Host-gate_session", options: { httpOnly: true, secure: true, sameSite: "strict", path: "/" } }]);
});
