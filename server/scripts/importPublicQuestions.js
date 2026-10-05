const fs = require("fs");
const path = require("path");
const mongoose = require("mongoose");
require("dotenv").config();

const Branch = require("../models/Branch");
const Subject = require("../models/Subject");
const Chapter = require("../models/Chapter");
const Test = require("../models/Test");
const Question = require("../models/Question");
const { normalizePublicQuestionBundle, buildQuestionRecord } = require("../services/publicQuestionImport");

const inputPath = path.resolve(process.argv[2] || path.join(__dirname, "../data/free-platform-sample.json"));

async function importPublicQuestions() {
  if (!process.env.MONGO_URI) throw new Error("MONGO_URI is required");
  if (!fs.existsSync(inputPath)) throw new Error(`Import file not found: ${inputPath}`);

  const payload = JSON.parse(fs.readFileSync(inputPath, "utf8"));
  const normalizedBundle = normalizePublicQuestionBundle(payload);

  const branch = await Branch.findOneAndUpdate(
    { code: normalizedBundle.branchCode },
    { $set: { name: normalizedBundle.branchName, description: `Public-source ${normalizedBundle.branchName} practice set.`, isActive: true } },
    { upsert: true, returnDocument: "after", setDefaultsOnInsert: true }
  );

  const subject = await Subject.findOneAndUpdate(
    { branch: branch._id, name: normalizedBundle.subjectName },
    {
      $set: {
        code: `${branch.code}-${normalizedBundle.subjectName.slice(0, 3).toUpperCase().replace(/[^A-Z]/g, "") || "GEN"}`,
        description: `${normalizedBundle.subjectName} practice sourced from a free public platform.`,
        isActive: true,
      },
    },
    { upsert: true, returnDocument: "after", setDefaultsOnInsert: true }
  );

  const chapter = await Chapter.findOneAndUpdate(
    { subject: subject._id, name: normalizedBundle.chapterName },
    {
      $set: {
        description: `${normalizedBundle.chapterName} practice imported from ${normalizedBundle.sourceName}.`,
        order: 1000,
        isActive: true,
      },
    },
    { upsert: true, returnDocument: "after", setDefaultsOnInsert: true }
  );

  const test = await Test.findOneAndUpdate(
    { chapter: chapter._id, title: normalizedBundle.testTitle },
    {
      $set: {
        description: `Public-source practice set for ${normalizedBundle.subjectName} imported from ${normalizedBundle.sourceName}.`,
        duration: 120,
        totalQuestions: normalizedBundle.questions.length,
        totalMarks: normalizedBundle.questions.reduce((sum, question) => sum + (Number(question.marks) || 1), 0),
        negativeMarking: true,
        isPublished: true,
      },
    },
    { upsert: true, returnDocument: "after", setDefaultsOnInsert: true }
  );

  const operations = normalizedBundle.questions.map(question => ({
    updateOne: {
      filter: { test: test._id, questionNumber: Number(question.questionNumber) },
      update: {
        $set: buildQuestionRecord({
          normalizedBundle,
          question,
          branchId: branch._id,
          subjectId: subject._id,
          chapterId: chapter._id,
          testId: test._id,
        }),
      },
      upsert: true,
    },
  }));

  if (operations.length) await Question.bulkWrite(operations, { ordered: false });

  console.log(`Public import complete: ${branch.code} / ${normalizedBundle.subjectName} / ${normalizedBundle.chapterName} (${normalizedBundle.questions.length} questions).`);
}

mongoose.connect(process.env.MONGO_URI)
  .then(importPublicQuestions)
  .then(() => mongoose.disconnect())
  .catch(error => {
    console.error("Unable to import public question bundle:", error.message);
    mongoose.disconnect().finally(() => { process.exitCode = 1; });
  });
