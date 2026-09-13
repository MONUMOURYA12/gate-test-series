const express = require("express");

const {
  createSubject,
  getSubjects,
  getSubjectsByBranch,
} = require("../controllers/subjectController");

const router = express.Router();

// Create subject
router.post("/", createSubject);

// Get all subjects
router.get("/", getSubjects);

// Get subjects by branch
router.get("/branch/:branchId", getSubjectsByBranch);

module.exports = router;