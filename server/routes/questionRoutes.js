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

const handleSpreadsheetUpload = (req, res, next) => {
  upload.single("file")(req, res, error => {
    if (error) {
      return res.status(error.code === "LIMIT_FILE_SIZE" ? 413 : 400).json({
        message: error.code === "LIMIT_FILE_SIZE"
          ? "File is too large. Maximum upload size is 5 MB."
          : error.message,
      });
    }

    return next();
  });
};

// ============================================================
// ADMIN READ ACCESS (student catalogue uses /api/student/catalogue)
// ============================================================

// Get all questions
router.get(
  "/",
  protect,
  adminOnly,
  getQuestions
);

// Get questions by test
router.get(
  "/test/:testId",
  protect,
  adminOnly,
  getQuestionsByTest
);

// Get questions by chapter
router.get(
  "/chapter/:chapterId",
  protect,
  adminOnly,
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
  handleSpreadsheetUpload,
  bulkUploadQuestions
);

module.exports = router;
