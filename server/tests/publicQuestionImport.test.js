const { test } = require("node:test");
const assert = require("node:assert/strict");
const { normalizePublicQuestionBundle, buildQuestionRecord } = require("../services/publicQuestionImport");

test("public bundle normalizer maps free-source data into the app schema", () => {
  const bundle = {
    branchCode: "CS",
    branchName: "Computer Science and Information Technology",
    subjectName: "Algorithms",
    chapterName: "Dynamic Programming",
    testTitle: "Free platform sample",
    sourceName: "NPTEL / Open educational resources",
    questions: [
      {
        questionNumber: 1,
        questionText: "What is the time complexity of merge sort?",
        questionType: "mcq",
        options: ["O(n)", "O(log n)", "O(n log n)", "O(n^2)"],
        correctAnswer: 2,
        marks: 1,
        negativeMarks: 0.33,
      },
      {
        questionNumber: 2,
        questionText: "Find the sum of first 10 natural numbers.",
        questionType: "nat",
        natAnswerMin: 55,
        natAnswerMax: 55,
        marks: 1,
      }
    ]
  };

  const normalized = normalizePublicQuestionBundle(bundle);
  assert.equal(normalized.branchCode, "CS");
  assert.equal(normalized.subjectName, "Algorithms");
  assert.equal(normalized.chapterName, "Dynamic Programming");
  assert.equal(normalized.testTitle, "Free platform sample");
  assert.equal(normalized.questions.length, 2);

  const mcq = buildQuestionRecord({ normalizedBundle: normalized, question: normalized.questions[0], branchId: "b1", subjectId: "s1", chapterId: "c1", testId: "t1" });
  assert.equal(mcq.questionType, "mcq");
  assert.equal(mcq.options.length, 4);
  assert.equal(mcq.correctAnswer, 2);
  assert.equal(mcq.sourceName, "NPTEL / Open educational resources");

  const nat = buildQuestionRecord({ normalizedBundle: normalized, question: normalized.questions[1], branchId: "b1", subjectId: "s1", chapterId: "c1", testId: "t1" });
  assert.equal(nat.questionType, "nat");
  assert.equal(nat.natAnswerMin, 55);
  assert.equal(nat.natAnswerMax, 55);
});
