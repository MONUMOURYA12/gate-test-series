const fs = require("node:fs");
const path = require("node:path");
const mongoose = require("mongoose");
const Branch = require("../models/Branch");
const Subject = require("../models/Subject");
const Chapter = require("../models/Chapter");
const Test = require("../models/Test");
const Question = require("../models/Question");

const serverDir = path.resolve(__dirname, "..");
const inputFlag = process.argv.indexOf("--input");
const input = path.resolve(inputFlag >= 0 && process.argv[inputFlag + 1]
  ? process.argv[inputFlag + 1]
  : path.join(serverDir, "data/ec-booklets.json"));
const branchCodes = ["EC", "ECE"];
const batchSize = 20;
require("dotenv").config({ path: path.join(serverDir, ".env"), quiet: true });

function writeReport(report) {
  const reportFlag = process.argv.indexOf("--report");
  if (reportFlag >= 0 && process.argv[reportFlag + 1]) {
    const reportPath = path.resolve(process.argv[reportFlag + 1]);
    fs.mkdirSync(path.dirname(reportPath), { recursive: true });
    fs.writeFileSync(reportPath, JSON.stringify(report, null, 2));
  }
}

function questionDocument(q, book, ids, questionNumber) {
  return {
    ...ids, questionNumber, questionText: q.questionText, questionImages: q.questionImages,
    sourceId: q.sourceId, sourceName: book.sourceName, sourcePage: q.sourcePage,
    sourceQuestionNumber: q.sourceQuestionNumber, sourceMarker: q.sourceMarker,
    sourceAnswer: q.sourceAnswer, reviewReasons: q.reviewReasons,
    questionType: q.questionType, options: q.options, correctAnswer: q.correctAnswer,
    natAnswerMin: q.natAnswerMin, natAnswerMax: q.natAnswerMax,
    marks: 1, negativeMarks: 0, isPYQ: q.examName === "GATE" || q.examName === "IES" || q.examName === "ESE",
    examName: q.examName, year: q.year ?? undefined, session: q.sourceMarker,
    difficulty: "medium", category: book.subjectName, topic: q.chapter,
    tags: ["booklet-import", book.slug, q.examName, "TARGATE Education"],
    explanation: "", solutionType: "none", isActive: true,
    isPublished: !q.requiresReview, requiresReview: q.requiresReview,
  };
}

async function validatePayload(payload) {
  if (payload.version !== 1 || !Array.isArray(payload.books) || payload.books.length === 0) throw new Error("Expected at least one configured EC booklet.");
  const seen = new Set();
  const id = new mongoose.Types.ObjectId();
  for (const book of payload.books) {
    if (!book.questions?.length) throw new Error(`No questions extracted for ${book.subjectName}`);
    for (const q of book.questions) {
      if (!q.sourceId || seen.has(q.sourceId)) throw new Error("Duplicate or missing source identity.");
      seen.add(q.sourceId);
      if (!q.questionImages?.length) throw new Error(`Question artwork missing for ${q.sourceId}`);
      for (const image of q.questionImages) {
        if (!/^\/question-media\/[a-z0-9-]+\/[a-f0-9-]+\.webp$/.test(image.url)) throw new Error("Invalid media path");
        const file = path.join(serverDir, "data", image.url.slice(1));
        if (!fs.existsSync(file) || fs.statSync(file).size === 0) throw new Error(`Missing image: ${image.url}`);
      }
      if (!q.requiresReview) {
        if (q.reviewReasons.length) throw new Error("Review reasons must block publishing.");
        if (q.questionType === "mcq" && (!Number.isInteger(q.correctAnswer) || q.correctAnswer < 0 || q.correctAnswer >= q.options.length)) throw new Error("Invalid MCQ answer");
        if (q.questionType === "nat" && !Number.isFinite(q.correctAnswer)) throw new Error("Invalid numerical answer");
        if ((q.natAnswerMin != null || q.natAnswerMax != null) && (!Number.isFinite(q.natAnswerMin) || !Number.isFinite(q.natAnswerMax) || q.natAnswerMin > q.natAnswerMax)) throw new Error("Invalid answer range");
      }
      await new Question(questionDocument(q, book, { branch: id, subject: id, chapter: id, test: id }, 1)).validate();
    }
  }
  return seen.size;
}

async function run() {
  const payload = JSON.parse(fs.readFileSync(input, "utf8"));
  const uniqueQuestions = await validatePayload(payload);
  console.log(`Validated ${uniqueQuestions} source questions and all image files.`);
  if (process.argv.includes("--validate-only")) return;
  if (!process.env.MONGO_URI) throw new Error("MONGO_URI is required");
  const dryRun = process.argv.includes("--dry-run");
  await mongoose.connect(process.env.MONGO_URI, { serverSelectionTimeoutMS: 15000,
    ...(dryRun ? { autoIndex: false, autoCreate: false } : {}) });
  const branches = await Branch.find({ code: { $in: branchCodes }, isActive: true }).select("name code").lean();
  if (!branches.length) throw new Error("The Electronics branch was not found.");
  const report = { checkedAt: new Date().toISOString(), mode: payload.mode, sourceQuestions: uniqueQuestions, branches: branches.map(b => b.code), subjects: [] };
  if (dryRun) {
    for (const branch of branches) {
      for (const book of payload.books) {
        const stored = await Question.find({ branch: branch._id, sourceId: { $in: book.questions.map(q => q.sourceId) } })
          .select("test marks isActive isPublished requiresReview").lean();
        const testIds = [...new Set(stored.filter(q => q.test).map(q => String(q.test)))];
        const tests = await Test.find({ _id: { $in: testIds } }).select("isPublished totalQuestions totalMarks").lean();
        const byTest = new Map(tests.map(t => [String(t._id), t]));
        const visible = stored.filter(q => q.isActive && q.isPublished && !q.requiresReview);
        const actualTotals = await Question.aggregate([
          { $match: { test: { $in: tests.map(t => t._id) }, isActive: true, isPublished: true, requiresReview: { $ne: true } } },
          { $group: { _id: "$test", questions: { $sum: 1 }, marks: { $sum: "$marks" } } },
        ]);
        const totalsByTest = new Map(actualTotals.map(t => [String(t._id), t]));
        report.subjects.push({ branch: branch.code, subject: book.subjectName, questions: book.questions.length,
          existing: stored.length, remaining: book.questions.length - stored.length,
          published: visible.length, available: visible.filter(q => byTest.get(String(q.test))?.isPublished).length,
          review: stored.filter(q => q.requiresReview).length, tests: tests.length,
          publishedTests: tests.filter(t => t.isPublished).length,
          missingTestReferences: stored.filter(q => !byTest.has(String(q.test))).length,
          testsWithIncorrectTotals: tests.filter(t => {
            const totals = totalsByTest.get(String(t._id));
            return t.totalQuestions !== (totals?.questions || 0) || t.totalMarks !== (totals?.marks || 0);
          }).length });
      }
    }
    writeReport(report);
    console.log(JSON.stringify(report, null, 2));
    return;
  }
  await Question.init();
  await Chapter.init();
  await Test.init();
  for (const branch of branches) {
    for (const book of payload.books) {
      const subject = await Subject.findOneAndUpdate({ branch: branch._id, name: book.subjectName }, {
        $setOnInsert: { code: `${branch.code}-${book.slug.toUpperCase()}`, description: `${book.subjectName} practice for Electronics and Communication.`, isActive: true },
      }, { upsert: true, returnDocument: "after" });
      let inserted = 0;
      const testIds = [];
      for (const [chapterIndex, chapterName] of book.chapters.entries()) {
        const questions = book.questions.filter(q => q.chapter === chapterName);
        if (!questions.length) continue;
        const chapter = await Chapter.findOneAndUpdate({ subject: subject._id, name: chapterName }, {
          $setOnInsert: { description: `${chapterName} previous year practice.`, order: chapterIndex + 1, isActive: true },
        }, { upsert: true, returnDocument: "after" });
        for (let offset = 0; offset < questions.length; offset += batchSize) {
          const batch = questions.slice(offset, offset + batchSize);
          const set = String(Math.floor(offset / batchSize) + 1).padStart(2, "0");
          const sourceBatchId = `${branch._id}:${book.slug}:${chapterIndex}:${set}`;
          let test = await Test.findOne({ sourceBatchId });
          const created = !test;
          if (!test) test = await Test.create({
            sourceBatchId, chapter: chapter._id, title: `GATE PYQs - TARGATE Set ${set}`,
            description: "Subject practice: 1 mark per question, no negative marking. Source: TARGATE EDUCATION.",
            duration: Math.max(10, batch.length * 2), negativeMarking: false, isPublished: false,
          });
          const operations = batch.map((q, index) => ({ updateOne: {
            filter: { branch: branch._id, sourceId: q.sourceId },
            update: { $setOnInsert: questionDocument(q, book, { branch: branch._id, subject: subject._id, chapter: chapter._id, test: test._id }, index + 1) },
            upsert: true,
          } }));
          const result = await Question.bulkWrite(operations, { ordered: true });
          inserted += result.upsertedCount;
          const visible = await Question.find({ test: test._id, isActive: true, isPublished: true, requiresReview: { $ne: true } }).select("marks").lean();
          const totals = { totalQuestions: visible.length, totalMarks: visible.reduce((sum, q) => sum + q.marks, 0) };
          if (created) totals.isPublished = visible.length > 0;
          await Test.updateOne({ _id: test._id }, { $set: totals });
          testIds.push(test._id);
        }
      }
      const filter = { branch: branch._id, sourceId: { $in: book.questions.map(q => q.sourceId) } };
      const total = await Question.countDocuments(filter);
      if (total !== book.questions.length) throw new Error(`Verification failed for ${branch.code} ${book.subjectName}`);
      const entry = { branch: branch.code, subject: book.subjectName, questions: total, inserted, tests: testIds.length,
        published: await Question.countDocuments({ ...filter, isPublished: true, requiresReview: { $ne: true } }),
        review: await Question.countDocuments({ ...filter, requiresReview: true }) };
      report.subjects.push(entry);
      console.log(JSON.stringify(entry));
    }
  }
  writeReport(report);
  console.log("Verified all imported question counts in MongoDB.");
}

if (require.main === module) run().catch(error => {
  console.error("EC booklet import failed:", error.message);
  process.exitCode = 1;
}).finally(() => mongoose.disconnect());

module.exports = { validatePayload, questionDocument };
