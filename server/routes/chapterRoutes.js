const express = require("express");

const {
  createChapter,
  getChapters,
  getChaptersBySubject,
} = require("../controllers/chapterController");

const router = express.Router();

// Create chapter
router.post("/", createChapter);

// Get all chapters
router.get("/", getChapters);

// Get chapters by subject
router.get("/subject/:subjectId", getChaptersBySubject);

module.exports = router;