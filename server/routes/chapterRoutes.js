const express = require("express");

const {
  createChapter,
  getChapters,
  getChaptersBySubject,
} = require("../controllers/chapterController");

const {
  protect,
  adminOnly,
} = require("../middleware/authMiddleware");

const router = express.Router();

// ============================================================
// PUBLIC / STUDENT ACCESS
// ============================================================

// Get all chapters
router.get("/", getChapters);

// Get chapters by subject
router.get(
  "/subject/:subjectId",
  getChaptersBySubject
);

// ============================================================
// ADMIN ONLY
// ============================================================

// Create chapter
router.post(
  "/",
  protect,
  adminOnly,
  createChapter
);

module.exports = router;