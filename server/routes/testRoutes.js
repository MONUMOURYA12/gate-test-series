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
// PUBLIC / STUDENT ACCESS
// ============================================================

// Get all tests
router.get("/", getTests);

// Get tests by chapter
router.get(
  "/chapter/:chapterId",
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