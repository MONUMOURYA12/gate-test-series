const express = require("express");

const {
  createQuestion,
  getQuestions,
  getQuestionsByTest,
  getQuestionsByChapter,
  bulkUploadQuestions,
} = require("../controllers/questionController");

const {
  updateQuestion,
  deleteQuestion,
} = require("../controllers/questionAdminController");

const upload = require("../middleware/uploadMiddleware");

const {
  protect,
  adminOnly,
} = require("../middleware/authMiddleware");

const router = express.Router();

// ============================================================
// PUBLIC / STUDENT ACCESS
// ============================================================

// Get all questions
router.get(
  "/",
  getQuestions
);

// Get questions by test
router.get(
  "/test/:testId",
  getQuestionsByTest
);

// Get questions by chapter
router.get(
  "/chapter/:chapterId",
  getQuestionsByChapter
);

// ============================================================
// ADMIN ONLY
// ============================================================

// Create single question
router.post(
  "/",
  protect,
  adminOnly,
  createQuestion
);

// Update single question
router.put(
  "/:questionId",
  protect,
  adminOnly,
  updateQuestion
);

// Delete / deactivate single question
router.delete(
  "/:questionId",
  protect,
  adminOnly,
  deleteQuestion
);

// Bulk upload questions
router.post(
  "/bulk-upload/:testId",
  protect,
  adminOnly,
  upload.single("file"),
  bulkUploadQuestions
);

module.exports = router;