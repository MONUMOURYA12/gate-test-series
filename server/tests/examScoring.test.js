const { test } = require("node:test");
const assert = require("node:assert/strict");
const { normalizeAnswer, gradeQuestion, scoreAttempt } = require("../services/examScoring");

const mcq = {
  questionType: "mcq",
  options: ["A", "B", "C", "D"],
  correctAnswer: 1,
  marks: 2,
  negativeMarks: 0.66,
};

test("normalizes MCQ, MSQ and NAT answers and rejects invalid values", () => {
  assert.equal(normalizeAnswer(mcq, 1), 1);
  assert.deepEqual(normalizeAnswer({ ...mcq, questionType: "msq" }, [2, 0, 2]), [0, 2]);
  assert.equal(normalizeAnswer({ ...mcq, questionType: "nat" }, 3.14), 3.14);
  assert.equal(normalizeAnswer(mcq, null), null);
  assert.throws(() => normalizeAnswer(mcq, 4), /valid answer/);
  assert.throws(() => normalizeAnswer({ ...mcq, questionType: "nat" }, "3.14"), /valid answer/);
});

test("grades unanswered, correct and incorrect questions", () => {
  assert.deepEqual(gradeQuestion({ ...mcq, answer: null }), {
    outcome: "unanswered",
    awardedMarks: 0,
  });
  assert.deepEqual(gradeQuestion({ ...mcq, answer: 1 }), {
    outcome: "correct",
    awardedMarks: 2,
  });
  assert.deepEqual(gradeQuestion({ ...mcq, answer: 0 }), {
    outcome: "incorrect",
    awardedMarks: -0.66,
  });
});

test("grades NAT answers inside an imported answer range", () => {
  const question = {
    questionType: "nat",
    natAnswerMin: 0.48,
    natAnswerMax: 0.49,
    marks: 1,
    negativeMarks: 0,
  };
  assert.equal(gradeQuestion({ ...question, answer: 0.485 }).outcome, "correct");
  assert.equal(gradeQuestion({ ...question, answer: 0.5 }).outcome, "incorrect");
});

test("scores an attempt with exact totals and time used", () => {
  const startedAt = new Date("2026-01-01T00:00:00.000Z");
  const submittedAt = new Date("2026-01-01T00:05:30.000Z");
  const result = scoreAttempt({
    startedAt,
    questions: [
      { ...mcq, answer: 1 },
      { ...mcq, answer: 0 },
      { ...mcq, questionType: "nat", correctAnswer: 3.14, answer: null, marks: 1, negativeMarks: 0 },
    ],
  }, submittedAt);

  assert.deepEqual(result, {
    score: 1.34,
    totalMarks: 5,
    correct: 1,
    incorrect: 1,
    unanswered: 1,
    timeTakenSeconds: 330,
  });
});
