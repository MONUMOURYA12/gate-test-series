const express = require("express");

const {
  createSubject,
  getSubjects,
  getSubjectsByBranch,
} = require("../controllers/subjectController");

const {
  protect,
  adminOnly,
} = require("../middleware/authMiddleware");

const router = express.Router();

// ============================================================
// PUBLIC / STUDENT ACCESS
// ============================================================

// Get all subjects
router.get("/", getSubjects);

// Get subjects by branch
router.get(
  "/branch/:branchId",
  getSubjectsByBranch
);

// ============================================================
// ADMIN ONLY
// ============================================================

// Create subject
router.post(
  "/",
  protect,
  adminOnly,
  createSubject
);

module.exports = router;