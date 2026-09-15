const express = require("express");

const {
  createTest,
  getTests,
  getTestsByChapter,
  syncTestStatistics,
} = require("../controllers/testController");

const {
  protect,
  adminOnly,
} = require("../middleware/authMiddleware");

const router = express.Router();

// ============================================================
// ADMIN READ ACCESS (student catalogue uses /api/student/catalogue)
// ============================================================

// Get all tests
router.get("/", protect, adminOnly, getTests);

// Get tests by chapter
router.get(
  "/chapter/:chapterId",
  protect,
  adminOnly,
  getTestsByChapter
);

// ============================================================
// ADMIN ONLY
// ============================================================

// Create test
router.post(
  "/",
  protect,
  adminOnly,
  createTest
);

// Sync test statistics
router.post(
  "/:testId/sync",
  protect,
  adminOnly,
  syncTestStatistics
);

module.exports = router;