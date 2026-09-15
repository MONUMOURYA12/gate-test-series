const mongoose = require("mongoose");
const Test = require("../models/Test");
const Chapter = require("../models/Chapter");
const Subject = require("../models/Subject");
const Branch = require("../models/Branch");

async function findPublishedTest(testId, branchId) {
  if (!mongoose.isObjectIdOrHexString(testId)) return null;
  const test = await Test.findOne({ _id: testId, isPublished: true })
    .select("title description chapter duration negativeMarking").lean();
  if (!test) return null;
  const chapter = await Chapter.findOne({ _id: test.chapter, isActive: true }).select("name subject").lean();
  if (!chapter) return null;
  const subject = await Subject.findOne({ _id: chapter.subject, isActive: true }).select("name branch").lean();
  if (!subject) return null;
  const commonSubject = ["General Aptitude", "Engineering Mathematics"].includes(subject.name);
  if (branchId && String(subject.branch) !== String(branchId) && !commonSubject) return null;
  const branchFilter = { _id: subject.branch, isActive: true };
  const branch = await Branch.findOne(branchFilter).select("name code").lean();
  return branch ? { ...test, chapter, subject, branch } : null;
}

module.exports = { findPublishedTest };
