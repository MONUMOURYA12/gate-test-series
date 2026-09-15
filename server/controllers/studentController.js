const Branch = require("../models/Branch");
const Subject = require("../models/Subject");
const Chapter = require("../models/Chapter");
const Test = require("../models/Test");
const Question = require("../models/Question");

// Restrict every level to active parents. Select metadata explicitly so adding
// fields to the question model cannot accidentally expose answers to students.
async function getCatalogue(req, res) {
  try {
    const branches = await Branch.find({ isActive: true })
      .select("name code description").sort({ name: 1 }).lean();
    const subjects = await Subject.find({ isActive: true, branch: { $in: branches.map(b => b._id) } })
      .select("name code description branch").sort({ name: 1 }).lean();
    const chapters = await Chapter.find({ isActive: true, subject: { $in: subjects.map(s => s._id) } })
      .select("name description subject order").sort({ order: 1, name: 1 }).lean();
    const tests = await Test.find({ isPublished: true, chapter: { $in: chapters.map(c => c._id) } })
      .select("title description chapter duration negativeMarking").sort({ createdAt: -1 }).lean();
    const counts = await Question.aggregate([
      { $match: { test: { $in: tests.map(t => t._id) }, isActive: true, isPublished: true } },
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
module.exports = { getCatalogue };
