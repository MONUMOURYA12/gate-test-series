const { test } = require("node:test");
const assert = require("node:assert/strict");
const express = require("express");
const XLSX = require("xlsx");
const Question = require("../models/Question");
const Subject = require("../models/Subject");
const Branch = require("../models/Branch");
const TestAttempt = require("../models/TestAttempt");
const User = require("../models/User");
const { getQuestions, createQuestion } = require("../controllers/questionController");
const { getSubjectsByBranch } = require("../controllers/subjectController");
const { getBranches } = require("../controllers/branchController");
const { getAttempt, saveAnswer, submitAttempt } = require("../controllers/attemptController");
const { parseSpreadsheet, validateSpreadsheetFile } = require("../services/spreadsheetUpload");
const upload = require("../middleware/uploadMiddleware");

// Every model call is mocked. No dotenv, server startup or live database writes.
const id = "aaaaaaaaaaaaaaaaaaaaaaaa";
const studentId = "bbbbbbbbbbbbbbbbbbbbbbbb";
const questionId = "cccccccccccccccccccccccc";

function response() {
  return { statusCode: 200, body: null, status(code) { this.statusCode = code; return this; }, json(body) { this.body = body; return this; } };
}

function chain(value) {
  return { populate() { return this; }, select() { return this; }, sort() { return this; }, skip() { return this; }, limit() { return this; },
    lean: async () => value, then(resolve, reject) { return Promise.resolve(value).then(resolve, reject); } };
}

function attempt(overrides = {}) {
  return {
    _id: id, student: studentId, test: id, title: "Test", duration: 60, status: "in_progress", __v: 0,
    startedAt: new Date(Date.now() - 60000), expiresAt: new Date(Date.now() + 300000),
    questions: [{ questionId, questionNumber: 1, questionText: "What is 1 + 1?", options: ["1", "2"],
      questionType: "mcq", correctAnswer: 1, explanation: "Private answer explanation", marks: 2, negativeMarks: 0.66,
      answer: null, markedForReview: false }],
    ...overrides,
  };
}

test("question filters reject operator objects, duplicate values and unbounded pagination before database access", async t => {
  t.mock.method(Question, "find", () => { assert.fail("Invalid filters reached the database"); });
  for (const query of [{ difficulty: { $ne: null } }, { search: ["a", "b"] }, { branch: { $ne: null } },
    { page: "Infinity" }, { page: "10001" }, { limit: "0" }, { limit: "101" }, { limit: "NaN" }, { search: "a".repeat(201) }]) {
    const res = response();
    await getQuestions({ query }, res);
    assert.equal(res.statusCode, 400, JSON.stringify(query));
  }
});

test("question search treats regex syntax as literal text", async t => {
  const search = "(a+)+$.*[x]";
  let filter;
  t.mock.method(Question, "find", value => { filter = value; return chain([]); });
  t.mock.method(Question, "countDocuments", async value => { assert.deepEqual(value, filter); return 0; });
  const res = response();
  await getQuestions({ query: { search, page: "1", limit: "20" } }, res);
  assert.equal(res.statusCode, 200);
  const regex = new RegExp(filter.questionText.$regex);
  assert.equal(regex.test(search), true);
  assert.equal(regex.test("aaaaaaaaax"), false);
});

test("invalid public catalogue IDs and database failures disclose no internal details", async t => {
  t.mock.method(Subject, "find", () => assert.fail("Invalid ID reached database"));
  const badId = response();
  await getSubjectsByBranch({ params: { branchId: "invalid" } }, badId);
  assert.equal(badId.statusCode, 400);
  t.mock.method(Branch, "find", () => { throw new Error("mongodb://private-host/private-db"); });
  const failure = response();
  await getBranches({}, failure);
  assert.equal(failure.statusCode, 500);
  assert.equal(JSON.stringify(failure.body).includes("private"), false);
});

test("question writes reject query operators and misleading publication flags before database access", async t => {
  t.mock.method(Branch, "findById", () => assert.fail("Invalid input reached database"));
  for (const body of [{ branch: { $ne: null }, questionText: "Question" }, { questionText: { $gt: "" } },
    { questionText: "Question", isPublished: "false" }, { questionText: "Question", options: [{ text: "x" }] }]) {
    const res = response();
    await createQuestion({ body }, res);
    assert.equal(res.statusCode, 400);
  }
});

test("all attempt reads and writes restrict lookup to the signed-in student", async t => {
  const filters = [];
  t.mock.method(TestAttempt, "findOne", filter => { filters.push(filter); return chain(null); });
  t.mock.method(TestAttempt, "findOneAndUpdate", () => assert.fail("Foreign attempt was mutated"));
  for (const action of [getAttempt, saveAnswer, submitAttempt]) {
    const res = response();
    await action({ user: { _id: studentId }, params: { attemptId: id }, body: {} }, res);
    assert.equal(res.statusCode, 404);
  }
  assert.equal(filters.length, 3);
  for (const filter of filters) assert.deepEqual(filter, { _id: id, student: studentId });
});

test("in-progress attempt responses do not expose answers, explanations or grades", async t => {
  t.mock.method(TestAttempt, "findOne", () => chain(attempt()));
  const res = response();
  await getAttempt({ user: { _id: studentId }, params: { attemptId: id } }, res);
  assert.equal(res.statusCode, 200);
  const question = res.body.attempt.questions[0];
  for (const field of ["correctAnswer", "explanation", "natAnswerMin", "natAnswerMax", "outcome", "awardedMarks"]) {
    assert.equal(Object.hasOwn(question, field), false, field);
  }
  assert.equal(res.body.attempt.result, undefined);
});

test("expired attempts ignore submitted answers and grade only the saved snapshot", async t => {
  const snapshot = attempt({ expiresAt: new Date(Date.now() - 1000) });
  t.mock.method(TestAttempt, "findOne", () => chain(snapshot));
  let update;
  t.mock.method(TestAttempt, "findOneAndUpdate", (filter, value) => {
    assert.deepEqual(filter, { _id: id, student: studentId, status: "in_progress", __v: 0 });
    update = value;
    return chain({ ...snapshot, ...value.$set });
  });
  const res = response();
  await saveAnswer({ user: { _id: studentId }, params: { attemptId: id },
    body: { questionId, answer: 1, markedForReview: false, score: 999 } }, res);
  assert.equal(res.statusCode, 409);
  assert.equal(update.$set.result.score, 0);
  assert.equal(update.$set.result.unanswered, 1);
  assert.equal(update.$set.submittedAt.getTime(), snapshot.expiresAt.getTime());
  assert.equal(res.body.attempt.questions[0].answer, null);
});

test("submission retries grading when an answer save wins the concurrency race", async t => {
  const before = attempt();
  const after = { ...before, __v: 1, questions: [{ ...before.questions[0], answer: 1 }] };
  let reads = 0;
  let writes = 0;
  t.mock.method(TestAttempt, "findOne", () => chain(reads++ === 0 ? before : after));
  t.mock.method(TestAttempt, "findOneAndUpdate", (filter, update) => {
    assert.equal(filter.student, studentId);
    assert.equal(filter.__v, writes);
    if (writes++ === 0) { assert.equal(update.$set.result.score, 0); return chain(null); }
    assert.equal(update.$set.result.score, 2);
    return chain({ ...after, ...update.$set });
  });
  const res = response();
  await submitAttempt({ user: { _id: studentId }, params: { attemptId: id }, body: { score: 999 } }, res);
  assert.equal(res.statusCode, 200);
  assert.equal(res.body.attempt.result.score, 2);
  assert.equal(writes, 2);
});

function spreadsheet(bookType = "xlsx", rows = [["questionNumber", "questionText", "questionType", "correctAnswer"], [1, "What is 1 + 1?", "nat", 2]]) {
  const workbook = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(workbook, XLSX.utils.aoa_to_sheet(rows), "Questions");
  return { originalname: `questions.${bookType === "biff8" ? "xls" : bookType}`,
    buffer: XLSX.write(workbook, { type: "buffer", bookType, compression: true }) };
}

test("bounded worker parser preserves supported XLSX, XLS and CSV templates", async () => {
  for (const type of ["xlsx", "biff8", "csv"]) {
    const matrix = await parseSpreadsheet(spreadsheet(type));
    assert.deepEqual(matrix[0], ["questionNumber", "questionText", "questionType", "correctAnswer"]);
    assert.equal(matrix[1][1], "What is 1 + 1?");
    assert.equal(matrix[1][3], 2);
  }
});

test("uploads reject disguised files and oversized compressed content", () => {
  for (const originalname of ["payload.xlsx", "payload.xls", "payload.csv"]) {
    assert.throws(() => validateSpreadsheetFile({ originalname, buffer: Buffer.from("<html>fake spreadsheet</html>") }));
  }
  const file = spreadsheet();
  const signature = Buffer.from([0x50, 0x4b, 0x01, 0x02]);
  const directory = file.buffer.indexOf(signature);
  assert.ok(directory > 0);
  file.buffer.writeUInt32LE(40 * 1024 * 1024, directory + 24);
  assert.throws(() => validateSpreadsheetFile(file), /uploaded file/);
});

test("worker rejects spreadsheets beyond row/column limits instead of silently truncating questions", async () => {
  await assert.rejects(parseSpreadsheet(spreadsheet("xlsx", Array.from({ length: 1002 }, () => ["row"]))), /1000 question rows/);
  await assert.rejects(parseSpreadsheet(spreadsheet("xlsx", [Array(65).fill("column")])), /64 columns/);
});

test("multipart upload accepts one file and rejects extra fields or files", async t => {
  const app = express();
  app.post("/upload", (req, res) => upload.single("file")(req, res, error => {
    res.status(error ? 400 : 200).json({ accepted: !error && Boolean(req.file) });
  }));
  const server = app.listen(0, "127.0.0.1");
  await new Promise(resolve => server.once("listening", resolve));
  t.after(() => server.close());
  const url = `http://127.0.0.1:${server.address().port}/upload`;
  for (const kind of ["one", "field", "files"]) {
    const form = new FormData();
    form.append("file", new Blob(["a,b\n1,2"]), "questions.csv");
    if (kind === "field") form.append("extra", "unexpected");
    if (kind === "files") form.append("file", new Blob(["a"]), "second.csv");
    const res = await fetch(url, { method: "POST", body: form });
    assert.equal(res.status, kind === "one" ? 200 : 400, kind);
  }
});

test("attempt start throttle follows student identity and does not block another student", async t => {
  const { createSessionToken } = require("../services/authSecurity");
  const previousSecret = process.env.JWT_SECRET;
  const previousEnv = process.env.NODE_ENV;
  process.env.JWT_SECRET = "isolated-api-security-test-secret-32-bytes";
  process.env.NODE_ENV = "test";
  t.after(() => {
    if (previousSecret === undefined) delete process.env.JWT_SECRET; else process.env.JWT_SECRET = previousSecret;
    if (previousEnv === undefined) delete process.env.NODE_ENV; else process.env.NODE_ENV = previousEnv;
  });
  t.mock.method(User, "findById", value => chain({ _id: value, role: "student", isActive: true, tokenVersion: 0 }));
  const app = express();
  app.use("/student", require("../routes/studentRoutes"));
  const server = app.listen(0, "127.0.0.1");
  await new Promise(resolve => server.once("listening", resolve));
  t.after(() => server.close());
  const url = `http://127.0.0.1:${server.address().port}/student/tests/invalid/attempts`;
  const request = _id => fetch(url, { method: "POST", headers: { cookie: `gate_session=${createSessionToken({ _id })}` } });
  for (let count = 0; count < 20; count++) assert.equal((await request(studentId)).status, 404);
  assert.equal((await request(studentId)).status, 429);
  assert.equal((await request(questionId)).status, 404);
});
