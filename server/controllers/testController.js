const Test = require("../models/Test");
const Chapter = require("../models/Chapter");
const Question = require("../models/Question");

// ============================================================
// HELPER: UPDATE TEST STATISTICS
// ============================================================

const updateTestStatistics = async (testId) => {
  const totalQuestions = await Question.countDocuments({
    test: testId,
    isActive: true,
  });

  const questions = await Question.find({
    test: testId,
    isActive: true,
  }).select("marks");

  const totalMarks = questions.reduce(
    (sum, question) => sum + question.marks,
    0
  );

  const updatedTest = await Test.findByIdAndUpdate(
    testId,
    {
      totalQuestions,
      totalMarks,
    },
    {
      new: true,
    }
  );

  return updatedTest;
};

// ============================================================
// CREATE NEW TEST
// ============================================================

const createTest = async (req, res) => {
  try {
    const {
      title,
      description,
      chapter,
      duration,
      totalQuestions,
      totalMarks,
      negativeMarking,
      isPublished,
    } = req.body;

    if (!title || !chapter || !duration) {
      return res.status(400).json({
        message:
          "Test title, chapter and duration are required",
      });
    }

    const existingChapter = await Chapter.findById(
      chapter
    );

    if (!existingChapter) {
      return res.status(404).json({
        message: "Chapter not found",
      });
    }

    const existingTest = await Test.findOne({
      title: title.trim(),
      chapter,
    });

    if (existingTest) {
      return res.status(409).json({
        message:
          "Test already exists in this chapter",
      });
    }

    const test = await Test.create({
      title,
      description,
      chapter,
      duration,
      totalQuestions: totalQuestions || 0,
      totalMarks: totalMarks || 0,
      negativeMarking:
        negativeMarking !== undefined
          ? negativeMarking
          : true,
      isPublished:
        isPublished !== undefined
          ? isPublished
          : false,
    });

    res.status(201).json({
      message: "Test created successfully",
      test,
    });
  } catch (error) {
    res.status(500).json({
      message: "Server error",
      error: error.message,
    });
  }
};

// ============================================================
// GET ALL TESTS
// ============================================================

const getTests = async (req, res) => {
  try {
    const tests = await Test.find()
      .populate({
        path: "chapter",
        select: "name subject",
        populate: {
          path: "subject",
          select: "name code",
        },
      })
      .sort({
        createdAt: -1,
      });

    res.status(200).json({
      tests,
    });
  } catch (error) {
    res.status(500).json({
      message: "Server error",
      error: error.message,
    });
  }
};

// ============================================================
// GET TESTS BY CHAPTER
// ============================================================

const getTestsByChapter = async (req, res) => {
  try {
    const { chapterId } = req.params;

    const tests = await Test.find({
      chapter: chapterId,
    }).sort({
      createdAt: -1,
    });

    res.status(200).json({
      tests,
    });
  } catch (error) {
    res.status(500).json({
      message: "Server error",
      error: error.message,
    });
  }
};

// ============================================================
// SYNC TEST STATISTICS
// ============================================================

const syncTestStatistics = async (req, res) => {
  try {
    const { testId } = req.params;

    const existingTest = await Test.findById(
      testId
    );

    if (!existingTest) {
      return res.status(404).json({
        message: "Test not found",
      });
    }

    const updatedTest =
      await updateTestStatistics(testId);

    res.status(200).json({
      message:
        "Test statistics synchronized successfully",

      test: updatedTest,
    });
  } catch (error) {
    res.status(500).json({
      message: "Server error",
      error: error.message,
    });
  }
};

// ============================================================
// EXPORTS
// ============================================================

module.exports = {
  createTest,
  getTests,
  getTestsByChapter,
  syncTestStatistics,
};