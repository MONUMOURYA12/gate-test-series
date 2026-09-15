const Branch = require("../models/Branch");
const Subject = require("../models/Subject");
const Chapter = require("../models/Chapter");
const Test = require("../models/Test");
const Question = require("../models/Question");
const TestAttempt = require("../models/TestAttempt");
const { findPublishedTest } = require("../services/studentTest");
const { gradeQuestion } = require("../services/examScoring");

// Restrict every level to active parents. Select metadata explicitly so adding
// fields to the question model cannot accidentally expose answers to students.
async function getCatalogue(req, res) {
  try {
    const branchId = req.user?.branch?._id || req.user?.branch;
    const branchFilter = { isActive: true };
    if (branchId) branchFilter._id = branchId;
    const branches = await Branch.find(branchFilter)
      .select("name code description").sort({ name: 1 }).lean();
    const branchSubjects = await Subject.find({ isActive: true, branch: { $in: branches.map(b => b._id) } })
      .select("name code description branch").sort({ name: 1 }).lean();
    const commonSubjects = await Subject.find({ isActive: true, name: { $in: ["General Aptitude", "Engineering Mathematics"] } })
      .select("name code description branch").sort({ name: 1 }).lean();
    const subjects = [...new Map([...branchSubjects, ...commonSubjects.map(subject => ({ ...subject, isCommon: true }))].map(subject => [String(subject._id), subject])).values()];
    const chapters = await Chapter.find({ isActive: true, subject: { $in: subjects.map(s => s._id) } })
      .select("name description subject order").sort({ order: 1, name: 1 }).lean();
    const tests = await Test.find({ isPublished: true, chapter: { $in: chapters.map(c => c._id) } })
      .select("title description chapter duration negativeMarking").sort({ createdAt: -1 }).lean();
    const counts = await Question.aggregate([
      { $match: { test: { $in: tests.map(t => t._id) }, isActive: true, isPublished: true, requiresReview: { $ne: true } } },
      { $group: { _id: "$test", totalQuestions: { $sum: 1 }, totalMarks: { $sum: "$marks" } } },
    ]);
    const byTest = new Map(counts.map(c => [String(c._id), c]));
    res.json({ branches, subjects, chapters, tests: tests.map(t => ({
      ...t,
      totalQuestions: byTest.get(String(t._id))?.totalQuestions || 0,
      totalMarks: byTest.get(String(t._id))?.totalMarks || 0,
    })) });
  } catch {
    res.status(500).json({ message: "Unable to load the test catalogue. Please try again." });
  }
}
async function getTestDetails(req, res) {
  try {
    const branchId = req.user?.branch?._id || req.user?.branch;
    const test = await findPublishedTest(req.params.testId, branchId);
    if (!test) return res.status(404).json({ message: "This test is unavailable." });
    const questions = await Question.find({ test: test._id, isActive: true, isPublished: true, requiresReview: { $ne: true } }).select("marks").lean();
    const attempts = await TestAttempt.find({ student: req.user._id, test: test._id })
      .select("status startedAt expiresAt submittedAt result").sort({ createdAt: -1 }).limit(20).lean();
    return res.json({
      test: { ...test, totalQuestions: questions.length, totalMarks: questions.reduce((sum, q) => sum + q.marks, 0) },
      attempts,
    });
  } catch {
    return res.status(500).json({ message: "Unable to load test details. Please try again." });
  }
}

async function getHistory(req, res) {
  try {
    const attempts = await TestAttempt.find({ student: req.user._id, status: "submitted" })
      .select("test title submittedAt result questions")
      .sort({ submittedAt: -1 }).limit(100).lean();
    const testIds = [...new Set(attempts.map(attempt => String(attempt.test)))];
    const tests = await Test.find({ _id: { $in: testIds } }).select("_id chapter").lean();
    const chapterIds = [...new Set(tests.map(test => String(test.chapter)))];
    const chapters = await Chapter.find({ _id: { $in: chapterIds } }).select("_id name subject").lean();
    const subjectIds = [...new Set(chapters.map(chapter => String(chapter.subject)))];
    const subjects = await Subject.find({ _id: { $in: subjectIds } }).select("_id name").lean();
    const testMap = new Map(tests.map(test => [String(test._id), test]));
    const chapterMap = new Map(chapters.map(chapter => [String(chapter._id), chapter]));
    const subjectMap = new Map(subjects.map(subject => [String(subject._id), subject]));
    const weakTopics = new Map();
    const history = attempts.map(attempt => {
      const test = testMap.get(String(attempt.test));
      const chapter = chapterMap.get(String(test?.chapter));
      const subject = subjectMap.get(String(chapter?.subject));
      for (const question of attempt.questions || []) {
        if (gradeQuestion(question).outcome === "incorrect") {
          const key = chapter?.name || "General practice";
          weakTopics.set(key, (weakTopics.get(key) || 0) + 1);
        }
      }
      return { _id: attempt._id, title: attempt.title, submittedAt: attempt.submittedAt, result: attempt.result, subject: subject?.name, chapter: chapter?.name };
    });
    const recommendations = [...weakTopics.entries()].sort((a, b) => b[1] - a[1]).slice(0, 8)
      .map(([topic, incorrect]) => ({ topic, incorrect, message: `Review ${topic} and try a focused practice test.` }));
    return res.json({ history, recommendations });
  } catch {
    return res.status(500).json({ message: "Unable to load your learning record." });
  }
}

module.exports = { getCatalogue, getTestDetails, getHistory };
