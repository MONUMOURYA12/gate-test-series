function normalizePublicQuestionBundle(bundle = {}) {
  if (!bundle || typeof bundle !== "object") {
    throw new Error("A public question bundle is required.");
  }

  const questions = Array.isArray(bundle.questions) ? bundle.questions : [];

  return {
    branchCode: String(bundle.branchCode || "").trim().toUpperCase() || "CS",
    branchName: String(bundle.branchName || "Computer Science and Information Technology").trim(),
    subjectName: String(bundle.subjectName || "General").trim(),
    chapterName: String(bundle.chapterName || "General Practice").trim(),
    testTitle: String(bundle.testTitle || "Free platform sample").trim(),
    sourceName: String(bundle.sourceName || "Open educational resource").trim(),
    questions: questions.map((question, index) => ({
      questionNumber: Number(question?.questionNumber ?? index + 1),
      questionText: String(question?.questionText || "").trim(),
      questionType: question?.questionType === "nat" ? "nat" : "mcq",
      options: Array.isArray(question?.options) ? question.options.map(value => String(value).trim()) : [],
      correctAnswer: question?.correctAnswer ?? null,
      natAnswerMin: question?.natAnswerMin ?? null,
      natAnswerMax: question?.natAnswerMax ?? null,
      marks: Number.isFinite(Number(question?.marks)) ? Number(question.marks) : 1,
      negativeMarks: Number.isFinite(Number(question?.negativeMarks)) ? Number(question.negativeMarks) : 0,
      tags: Array.isArray(question?.tags) ? question.tags.map(tag => String(tag).trim()).filter(Boolean) : [],
      difficulty: question?.difficulty || "medium",
      topic: question?.topic || "Public source practice",
      sourcePage: question?.sourcePage ?? undefined,
      sourceMarker: question?.sourceMarker || "",
      year: question?.year ?? undefined,
    })),
  };
}

function buildQuestionRecord({ normalizedBundle, question, branchId, subjectId, chapterId, testId }) {
  const base = {
    branch: branchId,
    subject: subjectId,
    chapter: chapterId,
    test: testId,
    questionNumber: Number(question.questionNumber),
    questionText: question.questionText,
    questionType: question.questionType,
    options: question.options || [],
    correctAnswer: question.correctAnswer,
    natAnswerMin: question.natAnswerMin ?? null,
    natAnswerMax: question.natAnswerMax ?? null,
    marks: Number(question.marks) || 1,
    negativeMarks: Number(question.negativeMarks) || 0,
    isPYQ: false,
    examName: "Open-source practice",
    year: question.year ?? undefined,
    difficulty: question.difficulty || "medium",
    category: normalizedBundle.subjectName,
    topic: question.topic || normalizedBundle.chapterName,
    tags: question.tags || [],
    explanation: "",
    solutionType: "none",
    isActive: true,
    isPublished: true,
    sourceName: normalizedBundle.sourceName,
    sourcePage: question.sourcePage,
    sourceMarker: question.sourceMarker,
  };

  if (question.questionType === "nat") {
    delete base.options;
    delete base.correctAnswer;
  }

  return base;
}

module.exports = { normalizePublicQuestionBundle, buildQuestionRecord };
