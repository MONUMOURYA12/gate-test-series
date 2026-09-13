const express = require("express");

const {
  createQuestion,
  getQuestions,
  getQuestionsByTest,
  getQuestionsByChapter,
  bulkUploadQuestions,
} = require("../controllers/questionController");

const upload = require("../middleware/uploadMiddleware");

const router = express.Router();

// =====================================================
// CREATE SINGLE QUESTION
// =====================================================

router.post(
  "/",
  createQuestion
);

// =====================================================
// GET ALL QUESTIONS + FILTERS + PAGINATION
// =====================================================

router.get(
  "/",
  getQuestions
);

// =====================================================
// GET QUESTIONS BY TEST
// =====================================================

router.get(
  "/test/:testId",
  getQuestionsByTest
);

// =====================================================
// GET QUESTIONS BY CHAPTER
// =====================================================

router.get(
  "/chapter/:chapterId",
  getQuestionsByChapter
);

// =====================================================
// BULK UPLOAD QUESTIONS FROM EXCEL
// =====================================================

router.post(
  "/bulk-upload/:testId",
  upload.single("file"),
  bulkUploadQuestions
);

module.exports = router;