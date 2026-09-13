const express = require("express");

const {
  createTest,
  getTests,
  getTestsByChapter,
  syncTestStatistics,
} = require("../controllers/testController");

const router = express.Router();

// Create test
router.post("/", createTest);

// Get all tests
router.get("/", getTests);

// Get tests by chapter
router.get("/chapter/:chapterId", getTestsByChapter);

// Sync test statistics
router.post(
  "/:testId/sync",
  syncTestStatistics
);

module.exports = router;