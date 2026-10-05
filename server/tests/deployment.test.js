const test = require("node:test");
const assert = require("node:assert/strict");
const crypto = require("node:crypto");
const { readRuntimeConfig, validateStartup } = require("../config/runtime");
const { createApp } = require("../server");

function renderEnvironment(overrides = {}) {
  return {
    NODE_ENV: "production", RENDER: "true",
    RENDER_EXTERNAL_URL: "https://gate-tests.onrender.com",
    TRUST_PROXY: "1", PORT: "10000",
    MONGO_URI: "mongodb+srv://database.example/gate-tests",
    JWT_SECRET: crypto.randomBytes(48).toString("hex"),
    ...overrides,
  };
}

test("Render starts with its platform URL and an explicit custom domain takes precedence", () => {
  const config = validateStartup(renderEnvironment());
  assert.deepEqual(config.origins, ["https://gate-tests.onrender.com"]);
  assert.equal(config.port, 10000);
  assert.equal(config.trustProxy, 1);
  assert.deepEqual(validateStartup(renderEnvironment({ CLIENT_ORIGIN: "https://tests.example.com" })).origins,
    ["https://tests.example.com"]);
  assert.throws(() => readRuntimeConfig(renderEnvironment({ RENDER: "false" })), /CLIENT_ORIGIN is required/);
});

test("production rejects insecure origins, secrets, proxy settings and database TLS options", () => {
  for (const overrides of [
    { CLIENT_ORIGIN: "http://tests.example.com" },
    { CLIENT_ORIGIN: "https://tests.example.com/path" },
    { RENDER_EXTERNAL_URL: "http://gate-tests.onrender.com" },
    { JWT_SECRET: "replace-with-a-long-random-secret" },
    { TRUST_PROXY: "true" },
    { PORT: "0" },
    { MONGO_URI: "mongodb://database.example/gate-tests" },
    { MONGO_URI: "mongodb+srv://database.example/gate-tests?tls=false" },
    { MONGO_URI: "mongodb+srv://database.example/gate-tests?tlsAllowInvalidCertificates=true" },
  ]) assert.throws(() => validateStartup(renderEnvironment(overrides)), JSON.stringify(Object.keys(overrides)));
});

test("production HTTP requests, proxy HTTPS, origin restrictions and health checks work together", async t => {
  const app = createApp(validateStartup(renderEnvironment()));
  const server = app.listen(0, "127.0.0.1");
  await new Promise(resolve => server.once("listening", resolve));
  t.after(() => new Promise(resolve => server.close(resolve)));
  const base = `http://127.0.0.1:${server.address().port}`;
  const request = (path, options = {}) => fetch(`${base}${path}`, { redirect: "manual", ...options });

  const redirect = await request("/login");
  assert.equal(redirect.status, 308);
  assert.equal(redirect.headers.get("location"), "https://gate-tests.onrender.com/login");
  assert.equal((await request("/api/auth/logout", { method: "POST" })).status, 400);
  const health = await request("/health");
  assert.equal(health.status, 503); // No database is used in this isolated test.
  assert.deepEqual(await health.json(), { status: "degraded" });

  const headers = { "X-Forwarded-Proto": "https", Origin: "https://gate-tests.onrender.com", "X-Requested-With": "XMLHttpRequest" };
  const logout = await request("/api/auth/logout", { method: "POST", headers });
  assert.equal(logout.status, 200);
  assert.equal(logout.headers.get("access-control-allow-origin"), headers.Origin);
  assert.equal(logout.headers.get("access-control-allow-credentials"), "true");
  assert.match(logout.headers.get("content-security-policy"), /script-src 'self'/);
  assert.equal(logout.headers.get("cache-control"), "no-store");
  assert.equal((await request("/api/auth/logout", {
    method: "POST", headers: { ...headers, Origin: "https://attacker.example" },
  })).status, 403);
  assert.equal((await request("/api/auth/logout", {
    method: "POST", headers: { ...headers, "Sec-Fetch-Site": "cross-site" },
  })).status, 403);
  const missingHeader = { ...headers };
  delete missingHeader["X-Requested-With"];
  assert.equal((await request("/api/auth/logout", { method: "POST", headers: missingHeader })).status, 403);
  assert.equal((await request("/question-media/missing.webp", { headers })).status, 401);
  const missingApi = await request("/api/nonexistent", { headers });
  assert.equal(missingApi.status, 404);
  assert.match(missingApi.headers.get("content-type"), /application\/json/);
});
