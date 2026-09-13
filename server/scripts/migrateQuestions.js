const mongoose = require("mongoose");
require("dotenv").config();

const Question = require("../models/Question");
const Test = require("../models/Test");
const Chapter = require("../models/Chapter");
const Subject = require("../models/Subject");
const Branch = require("../models/Branch");

// ============================================================
// MIGRATE EXISTING QUESTIONS
// ============================================================

const migrateQuestions = async () => {
  try {
    console.log("Connecting to MongoDB...");

    await mongoose.connect(process.env.MONGO_URI);

    console.log("MongoDB connected successfully");

    // --------------------------------------------------------
    // FIND ALL QUESTIONS THAT BELONG TO A TEST
    // --------------------------------------------------------

    const questions = await Question.find({
      test: { $exists: true, $ne: null },
    });

    console.log(
      `Found ${questions.length} questions to check`
    );

    let migratedCount = 0;
    let skippedCount = 0;

    // --------------------------------------------------------
    // PROCESS EACH QUESTION
    // --------------------------------------------------------

    for (const question of questions) {
      // Find Test
      const test = await Test.findById(question.test);

      if (!test) {
        console.log(
          `Skipping Question ${question.questionNumber}: Test not found`
        );

        skippedCount++;
        continue;
      }

      // Find Chapter
      const chapter = await Chapter.findById(
        test.chapter
      );

      if (!chapter) {
        console.log(
          `Skipping Question ${question.questionNumber}: Chapter not found`
        );

        skippedCount++;
        continue;
      }

      // Find Subject
      const subject = await Subject.findById(
        chapter.subject
      );

      if (!subject) {
        console.log(
          `Skipping Question ${question.questionNumber}: Subject not found`
        );

        skippedCount++;
        continue;
      }

      // Find Branch
      const branch = await Branch.findById(
        subject.branch
      );

      if (!branch) {
        console.log(
          `Skipping Question ${question.questionNumber}: Branch not found`
        );

        skippedCount++;
        continue;
      }

      // ------------------------------------------------------
      // UPDATE QUESTION
      // ------------------------------------------------------

      question.branch = branch._id;
      question.subject = subject._id;
      question.chapter = chapter._id;

      await question.save();

      migratedCount++;

      console.log(
        `Question ${question.questionNumber} migrated successfully`
      );
    }

    // --------------------------------------------------------
    // RESULT
    // --------------------------------------------------------

    console.log("\n=================================");
    console.log("MIGRATION COMPLETED");
    console.log("=================================");

    console.log(
      `Total questions checked : ${questions.length}`
    );

    console.log(
      `Questions migrated      : ${migratedCount}`
    );

    console.log(
      `Questions skipped       : ${skippedCount}`
    );

    console.log("=================================\n");

    await mongoose.connection.close();

    console.log("MongoDB connection closed");

    process.exit(0);
  } catch (error) {
    console.error("\nMigration failed:");
    console.error(error.message);

    await mongoose.connection.close();

    process.exit(1);
  }
};

migrateQuestions();