import assert from "node:assert/strict";
import { afterEach, test } from "node:test";
import { apiRequest, authApi, clearLegacyToken, questionMediaUrl } from "../src/services/api.js";

const originalFetch = globalThis.fetch;
const originalWindow = globalThis.window;
const originalStorage = globalThis.localStorage;
afterEach(() => {
  globalThis.fetch = originalFetch;
  globalThis.window = originalWindow;
  globalThis.localStorage = originalStorage;
});
const jsonResponse = (data = {}, status = 200) => new Response(JSON.stringify(data), {
  status, headers: { "content-type": "application/json" },
});

test("API uses same-origin cookie sessions without copying legacy tokens into headers", async () => {
  globalThis.localStorage = { getItem: () => { throw new Error("Tokens must not be read"); } };
  globalThis.fetch = async (url, options) => {
    assert.equal(url, "/api/auth/me");
    assert.equal(options.credentials, "include");
    assert.equal(options.headers.has("Authorization"), false);
    assert.equal(options.headers.has("X-Requested-With"), false);
    return jsonResponse({ user: { id: "student" } });
  };
  assert.equal((await authApi.me()).user.id, "student");
});

test("all unsafe API requests carry CSRF header, including multipart uploads and logout", async () => {
  const seen = [];
  globalThis.fetch = async (url, options) => {
    assert.equal(options.credentials, "include");
    assert.equal(options.headers.get("X-Requested-With"), "XMLHttpRequest");
    if (options.body instanceof FormData) assert.equal(options.headers.has("Content-Type"), false);
    seen.push([url, options.method]);
    return jsonResponse({ user: { id: "student" } });
  };
  await authApi.login({ email: "test@example.com", password: "long test password" });
  await apiRequest("/auth/register", { method: "POST", body: "{}", credentials: "omit" });
  await apiRequest("/questions/123", { method: "PUT", body: "{}" });
  await apiRequest("/questions/123", { method: "DELETE" });
  await apiRequest("/questions/bulk-upload/123", { method: "POST", body: new FormData() });
  await authApi.logout();
  assert.deepEqual(seen.at(-1), ["/api/auth/logout", "POST"]);
  assert.equal(seen.length, 6);
});

test("legacy tokens are removed even when storage is unavailable", () => {
  let removed;
  globalThis.localStorage = { removeItem: key => { removed = key; } };
  clearLegacyToken();
  assert.equal(removed, "gateTestSeriesToken");
  globalThis.localStorage = { removeItem: () => { throw new Error("Storage blocked"); } };
  assert.doesNotThrow(clearLegacyToken);
});

test("an older unauthenticated response cannot expire a newly signed-in session", async () => {
  globalThis.window = new EventTarget();
  let expirations = 0;
  window.addEventListener("auth-expired", () => { expirations += 1; });
  let resolveEarlier;
  globalThis.fetch = url => url === "/api/auth/me"
    ? new Promise(resolve => { resolveEarlier = resolve; })
    : Promise.resolve(jsonResponse({ user: { id: "student" } }));
  const earlier = authApi.me();
  await authApi.login({ email: "test@example.com", password: "long test password" });
  resolveEarlier(jsonResponse({ message: "Please sign in" }, 401));
  await assert.rejects(earlier, { status: 401 });
  assert.equal(expirations, 0);
  globalThis.fetch = async () => jsonResponse({ message: "Session expired" }, 401);
  await assert.rejects(apiRequest("/student/catalogue"), { status: 401 });
  assert.equal(expirations, 1);
});

test("question image URLs accept only the stored WebP media path format", () => {
  const path = "/question-media/networks/0123456789abcdef-1.webp";
  assert.equal(questionMediaUrl(path), path);
  for (const value of ["javascript:alert(1)", "//example.com/pixel.webp", "https://example.com/pixel.webp",
    "/question-media/../secret", "/question-media/networks/image.svg", "/question-media/networks/a.webp?redirect=x", null]) {
    assert.equal(questionMediaUrl(value), null);
  }
});
