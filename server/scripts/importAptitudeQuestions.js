const fs = require("fs");
const path = require("path");
const mongoose = require("mongoose");
require("dotenv").config();

const Branch = require("../models/Branch");
const Subject = require("../models/Subject");
const Chapter = require("../models/Chapter");
const Test = require("../models/Test");
const Question = require("../models/Question");

const inputPath = path.resolve(
  process.argv[2] || path.join(__dirname, "../data/general-aptitude-pyq.json")
);

function normalizeAnswer(question) {
  if (question.correctAnswer !== undefined) return question.correctAnswer;
  return null;
}

async function importAptitudeQuestions() {
  if (!process.env.MONGO_URI) throw new Error("MONGO_URI is required");
  if (!fs.existsSync(inputPath)) throw new Error(`Import file not found: ${inputPath}`);

  const payload = JSON.parse(fs.readFileSync(inputPath, "utf8"));
  const branches = await Branch.find({ isActive: true }).select("_id code name").lean();
  if (!branches.length) throw new Error("No active branches found. Seed the GATE catalogue first.");

  let subjectCount = 0;
  let chapterCount = 0;
  let testCount = 0;
  let questionCount = 0;
  let reviewCount = 0;

  for (const branch of branches) {
    const subject = await Subject.findOneAndUpdate(
      { branch: branch._id, name: payload.subjectName },
      {
        $set: {
          code: `${branch.code}-GA`,
          description: "Common GATE General Aptitude practice for every branch.",
          isActive: true,
        },
      },
      { upsert: true, returnDocument: "after", setDefaultsOnInsert: true }
    );
    subjectCount += 1;

    for (const yearData of payload.years) {
      const chapter = await Chapter.findOneAndUpdate(
        { subject: subject._id, name: `GATE ${yearData.year} Previous Year Questions` },
        {
          $set: {
            description: `General Aptitude PYQs from the ${yearData.year} GATE booklet.`,
            order: 2100 - yearData.year,
            isActive: true,
          },
        },
        { upsert: true, returnDocument: "after", setDefaultsOnInsert: true }
      );
      chapterCount += 1;

      const test = await Test.findOneAndUpdate(
        { chapter: chapter._id, title: `GATE General Aptitude PYQ ${yearData.year}` },
        {
          $set: {
            description: `Full General Aptitude previous-year practice set for GATE ${yearData.year}. Questions flagged for review remain hidden until corrected in the admin panel.`,
            duration: 180,
            totalQuestions: yearData.questions.length,
            totalMarks: yearData.questions.reduce((total, question) => total + 1, 0),
            negativeMarking: true,
            isPublished: true,
          },
        },
        { upsert: true, returnDocument: "after", setDefaultsOnInsert: true }
      );
      testCount += 1;

      const operations = yearData.questions.map(question => {
        const requiresReview = Boolean(question.requiresReview);
        if (requiresReview) reviewCount += 1;
        questionCount += 1;
        return {
          updateOne: {
            filter: { test: test._id, questionNumber: question.questionNumber },
            update: {
              $set: {
                branch: branch._id,
                subject: subject._id,
                chapter: chapter._id,
                test: test._id,
                questionNumber: question.questionNumber,
                questionText: question.questionText,
                questionType: question.questionType,
                options: question.options || [],
                correctAnswer: normalizeAnswer(question),
                natAnswerMin: question.natAnswerMin,
                natAnswerMax: question.natAnswerMax,
                marks: 1,
                negativeMarks: question.questionType === "mcq" ? 0.33 : 0,
                isPYQ: true,
                examName: "GATE General Aptitude",
                year: question.year,
                session: question.sourceMarker,
                difficulty: "medium",
                category: "General Aptitude",
                topic: "GATE Previous Year Questions",
                tags: question.tags || [],
                explanation: "",
                solutionType: "none",
                isActive: true,
                isPublished: !requiresReview,
                requiresReview,
                sourceName: payload.sourceName,
                sourcePage: question.sourcePage,
                sourceMarker: question.sourceMarker,
              },
            },
            upsert: true,
          },
        };
      });

      if (operations.length) await Question.bulkWrite(operations, { ordered: false });
    }
  }

  console.log(`Aptitude import complete: ${branches.length} branches, ${subjectCount} subjects, ${chapterCount} chapters, ${testCount} tests, ${questionCount} questions.`);
  console.log(`Questions held for admin review: ${reviewCount}`);
}

mongoose.connect(process.env.MONGO_URI)
  .then(importAptitudeQuestions)
  .then(() => mongoose.disconnect())
  .catch(error => {
    console.error("Unable to import aptitude PYQs:", error.message);
    mongoose.disconnect().finally(() => { process.exitCode = 1; });
  });
