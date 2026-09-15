const { test } = require("node:test");
const assert = require("node:assert/strict");
const mongoose = require("mongoose");
const Test = require("../models/Test");
const Chapter = require("../models/Chapter");
const Subject = require("../models/Subject");
const Branch = require("../models/Branch");
const TestAttempt = require("../models/TestAttempt");
const { findPublishedTest } = require("../services/studentTest");
const { getAttempt } = require("../controllers/attemptController");

function query(value) { return { select() { return this; }, lean: async () => value }; }

test("an imported test cannot be opened from a different branch", async t => {
  t.mock.method(Test, "findOne", () => query({ _id: "test", chapter: "chapter" }));
  t.mock.method(Chapter, "findOne", () => query({ _id: "chapter", subject: "subject" }));
  t.mock.method(Subject, "findOne", () => query({ _id: "subject", branch: "electronics" }));
  t.mock.method(Branch, "findOne", () => { throw new Error("Do not replace the actual branch with the student's branch."); });
  assert.equal(await findPublishedTest(new mongoose.Types.ObjectId().toString(), "mechanical"), null);
});

test("attempt snapshots preserve images and keep annotations and answer ranges private until submission", async t => {
  const id = new mongoose.Types.ObjectId();
  const question = { questionId: id, questionNumber: 1, questionText: "Extracted text may contain a hidden answer annotation",
    questionType: "nat", options: [], correctAnswer: 0.48, natAnswerMin: 0.48, natAnswerMax: 0.49,
    marks: 1, negativeMarks: 0, answer: 0.485,
    questionImages: [{ url: "/question-media/networks/0123456789abcdef-1.webp", width: 600, height: 300 }] };
  const snapshot = new TestAttempt({ student: id, test: id, title: "Sample", duration: 40, startedAt: new Date(),
    expiresAt: new Date(Date.now() + 60000), questions: [question] });
  await snapshot.validate();
  const stored = snapshot.toObject();
  t.mock.method(TestAttempt, "findOne", () => query(stored));
  let response;
  const res = { json(value) { response = value; }, status() { return this; } };
  const req = { params: { attemptId: id.toString() }, user: { _id: id } };
  await getAttempt(req, res);
  assert.equal(response.attempt.questions[0].questionImages[0].url, question.questionImages[0].url);
  assert.equal(response.attempt.questions[0].questionText, "Question 1");
  assert.equal("correctAnswer" in response.attempt.questions[0], false);
  assert.equal("natAnswerMin" in response.attempt.questions[0], false);
  stored.status = "submitted";
  await getAttempt(req, res);
  assert.equal(response.attempt.questions[0].natAnswerMin, 0.48);
  assert.equal(response.attempt.questions[0].outcome, "correct");
});
