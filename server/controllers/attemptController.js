const mongoose = require("mongoose");
const TestAttempt = require("../models/TestAttempt");
const Question = require("../models/Question");
const { findPublishedTest } = require("../services/studentTest");
const { normalizeAnswer, gradeQuestion, scoreAttempt } = require("../services/examScoring");

// Explicit response fields keep the snapshot's answer key private until submission.
function attemptResponse(attempt) {
  const submitted = attempt.status === "submitted";
  return {
    _id: attempt._id,
    test: attempt.test,
    title: attempt.title,
    duration: attempt.duration,
    status: attempt.status,
    startedAt: attempt.startedAt,
    expiresAt: attempt.expiresAt,
    submittedAt: attempt.submittedAt,
    serverTime: new Date(),
    result: submitted ? attempt.result : undefined,
    questions: attempt.questions.map(question => ({
      questionId: question.questionId,
      questionNumber: question.questionNumber,
      questionText: question.questionImages?.length ? `Question ${question.questionNumber}` : question.questionText,
      questionImages: question.questionImages || [],
      questionType: question.questionType,
      options: question.options,
      marks: question.marks,
      negativeMarks: question.negativeMarks,
      answer: question.answer,
      answerSubmitted: question.answerSubmitted || false,
      markedForReview: question.markedForReview,
      ...(submitted ? {
        correctAnswer: question.correctAnswer,
        natAnswerMin: question.natAnswerMin,
        natAnswerMax: question.natAnswerMax,
        explanation: question.explanation,
        ...gradeQuestion(question),
      } : {}),
    })),
  };
}

async function ownedAttempt(req) {
  if (!mongoose.isObjectIdOrHexString(req.params.attemptId)) return null;
  return TestAttempt.findOne({ _id: req.params.attemptId, student: req.user._id }).lean();
}

async function finalizeAttempt(attempt) {
  // Optimistic concurrency prevents an answer save racing with grading.
  while (attempt?.status === "in_progress") {
    const submittedAt = new Date(Math.min(Date.now(), new Date(attempt.expiresAt).getTime()));
    const updated = await TestAttempt.findOneAndUpdate({
      _id: attempt._id, student: attempt.student, status: "in_progress", __v: attempt.__v,
    }, {
      $set: { status: "submitted", submittedAt, result: scoreAttempt(attempt, submittedAt) },
      $inc: { __v: 1 },
    }, { new: true }).lean();
    if (updated) return updated;
    attempt = await TestAttempt.findOne({ _id: attempt._id, student: attempt.student }).lean();
  }
  return attempt;
}

function handleError(res, error) {
  return res.status(error.status || 500).json({
    message: error.status ? error.message : "Unable to process your attempt. Please try again.",
  });
}

async function startAttempt(req, res) {
  try {
    const branchId = req.user?.branch?._id || req.user?.branch;
    const test = await findPublishedTest(req.params.testId, branchId);
    if (!test) return res.status(404).json({ message: "This test is unavailable." });
    let attempt = await TestAttempt.findOne({ student: req.user._id, test: test._id, status: "in_progress" }).lean();
    if (attempt) {
      if (new Date(attempt.expiresAt) <= new Date()) attempt = await finalizeAttempt(attempt);
      return res.json({ attempt: attemptResponse(attempt) });
    }
    const questions = await Question.find({ test: test._id, isActive: true, isPublished: true, requiresReview: { $ne: true } })
      .select("questionNumber questionText questionImages questionType options correctAnswer natAnswerMin natAnswerMax explanation marks negativeMarks")
      .sort({ questionNumber: 1, _id: 1 }).lean();
    if (!questions.length) return res.status(409).json({ message: "Questions are still being prepared for this test." });
    const startedAt = new Date();
    // Ensure the partial unique index exists before accepting concurrent starts.
    await TestAttempt.init();
    try {
      const created = await TestAttempt.create({
        student: req.user._id,
        test: test._id,
        title: test.title,
        duration: test.duration,
        startedAt,
        expiresAt: new Date(startedAt.getTime() + test.duration * 60000),
        questions: questions.map(question => ({
          ...question,
          questionId: question._id,
          negativeMarks: test.negativeMarking && question.questionType === "mcq" ? question.negativeMarks : 0,
          answer: null,
          answerSubmitted: false,
          markedForReview: false,
        })),
      });
      attempt = created.toObject();
    } catch (error) {
      if (error.code !== 11000) throw error;
      attempt = await TestAttempt.findOne({ student: req.user._id, test: test._id, status: "in_progress" }).lean();
      if (!attempt) throw error;
    }
    return res.status(201).json({ attempt: attemptResponse(attempt) });
  } catch (error) {
    return handleError(res, error);
  }
}

async function getAttempt(req, res) {
  try {
    let attempt = await ownedAttempt(req);
    if (!attempt) return res.status(404).json({ message: "Attempt not found." });
    if (attempt.status === "in_progress" && new Date(attempt.expiresAt) <= new Date()) {
      attempt = await finalizeAttempt(attempt);
    }
    return res.json({ attempt: attemptResponse(attempt) });
  } catch (error) {
    return handleError(res, error);
  }
}

async function saveAnswer(req, res) {
  try {
    let attempt = await ownedAttempt(req);
    if (!attempt) return res.status(404).json({ message: "Attempt not found." });
    if (attempt.status === "submitted" || new Date(attempt.expiresAt) <= new Date()) {
      if (attempt.status !== "submitted") attempt = await finalizeAttempt(attempt);
      return res.status(409).json({ message: "This attempt has ended.", attempt: attemptResponse(attempt) });
    }
    const { questionId, answer, markedForReview, answerSubmitted = false } = req.body || {};
    const question = attempt.questions.find(item => String(item.questionId) === questionId);
    if (!question) return res.status(400).json({ message: "Question does not belong to this attempt." });
    if (typeof markedForReview !== "boolean") return res.status(400).json({ message: "Review status must be true or false." });
    if (question.answerSubmitted && !answerSubmitted) return res.status(409).json({ message: "This question has already been submitted." });
    if (typeof answerSubmitted !== "boolean") return res.status(400).json({ message: "Question submit status must be true or false." });
    const normalized = normalizeAnswer(question, answer);
    const saved = await TestAttempt.findOneAndUpdate({
      _id: attempt._id,
      student: req.user._id,
      status: "in_progress",
      expiresAt: { $gt: new Date() },
      "questions.questionId": question.questionId,
    }, {
      $set: { "questions.$.answer": normalized, "questions.$.markedForReview": markedForReview, "questions.$.answerSubmitted": answerSubmitted || question.answerSubmitted || false },
      $inc: { __v: 1 },
    }, { new: true }).select("_id").lean();
    if (!saved) {
      attempt = await finalizeAttempt(await ownedAttempt(req));
      if (!attempt) return res.status(404).json({ message: "Attempt not found." });
      return res.status(409).json({ message: "This attempt has ended.", attempt: attemptResponse(attempt) });
    }
    return res.json({ saved: true, serverTime: new Date() });
  } catch (error) {
    return handleError(res, error);
  }
}

async function submitAttempt(req, res) {
  try {
    let attempt = await ownedAttempt(req);
    if (!attempt) return res.status(404).json({ message: "Attempt not found." });
    attempt = await finalizeAttempt(attempt);
    return res.json({ attempt: attemptResponse(attempt) });
  } catch (error) {
    return handleError(res, error);
  }
}

module.exports = { startAttempt, getAttempt, saveAnswer, submitAttempt };
