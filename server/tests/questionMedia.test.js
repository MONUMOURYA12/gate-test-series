const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs/promises");
const path = require("node:path");
const os = require("node:os");
const QuestionMedia = require("../models/QuestionMedia");
const { mediaKey, readQuestionImage, serveQuestionImage } = require("../services/questionMedia");

const url = "/question-media/networks/0123456789abcdef-1.webp";
const sample = Buffer.from("RIFF\x04\x00\x00\x00WEBP", "binary");

async function temporaryDirectory(t) {
  const dir = await fs.mkdtemp(path.join(os.tmpdir(), "gate-media-"));
  t.after(() => fs.rm(dir, { recursive: true, force: true }));
  return dir;
}

test("media rejects traversal, encoded paths and unexpected file types before querying storage", async t => {
  t.mock.method(QuestionMedia, "findById", () => { throw new Error("Storage must not be queried."); });
  for (const value of [null, {}, "/question-media/../secret.webp", "/question-media/networks/%2e%2e.webp",
    "/question-media/networks/abc.svg", "/question-media/networks/abc.webp/extra", "/question-media//abc.webp"]) {
    assert.equal(mediaKey(value), null);
    assert.equal(await readQuestionImage(value), null);
  }
});

test("existing local images remain usable without a database lookup", async t => {
  const dir = await temporaryDirectory(t);
  await fs.mkdir(path.join(dir, "networks"));
  await fs.writeFile(path.join(dir, mediaKey(url)), sample);
  t.mock.method(QuestionMedia, "findById", () => { throw new Error("Unexpected database lookup."); });
  assert.deepEqual(await readQuestionImage(url, dir), sample);
});

test("a missing local image loads the original binary from MongoDB", async t => {
  const dir = await temporaryDirectory(t);
  t.mock.method(QuestionMedia, "findById", key => {
    assert.equal(key, "networks/0123456789abcdef-1.webp");
    return { select(fields) { assert.equal(fields, "+data"); return Promise.resolve({ data: sample }); } };
  });
  assert.deepEqual(await readQuestionImage(url, dir), sample);
});

test("missing and corrupt stored images do not produce successful image responses", async t => {
  const dir = await temporaryDirectory(t);
  let record = null;
  t.mock.method(QuestionMedia, "findById", () => ({ select: async () => record }));
  assert.equal(await readQuestionImage(url, dir), null);
  record = { data: Buffer.from("<script>bad data</script>") };
  await assert.rejects(readQuestionImage(url, dir), /Invalid stored/);
});

test("the media endpoint serves WebP privately and forwards storage outages", async t => {
  const dir = await temporaryDirectory(t);
  let unavailable = false;
  t.mock.method(QuestionMedia, "findById", () => ({ select: async () => {
    if (unavailable) throw new Error("Database unavailable");
    return { data: sample };
  } }));
  const headers = {};
  const res = { set(k, v) { headers[k] = v; return this; }, type(v) { headers.type = v; return this; }, send(data) { this.data = data; } };
  const handler = serveQuestionImage(dir);
  const req = { method: "GET", path: "/networks/0123456789abcdef-1.webp" };
  await handler(req, res, error => { throw error || new Error("Unexpected fallback"); });
  assert.equal(headers.type, "image/webp");
  assert.equal(headers["Cache-Control"], "private, max-age=86400");
  assert.deepEqual(res.data, sample);
  unavailable = true;
  let forwarded;
  await handler(req, res, error => { forwarded = error; });
  assert.match(forwarded.message, /Database unavailable/);
});

test("anonymous HTTP requests cannot read stored question images", async t => {
  t.mock.method(QuestionMedia, "findById", () => { throw new Error("An anonymous request reached storage."); });
  const { createApp } = require("../server");
  const server = createApp({ production: false, trustProxy: false, origins: ["http://localhost:5000"],
    clientDir: os.tmpdir(), mediaDir: os.tmpdir() }).listen(0, "127.0.0.1");
  await new Promise(resolve => server.once("listening", resolve));
  t.after(() => new Promise(resolve => server.close(resolve)));
  const response = await fetch(`http://127.0.0.1:${server.address().port}${url}`);
  assert.equal(response.status, 401);
});
