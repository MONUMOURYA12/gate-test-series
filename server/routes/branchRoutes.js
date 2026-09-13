const express = require("express");

const {
  createBranch,
  getBranches,
} = require("../controllers/branchController");

const router = express.Router();

// POST /api/branches
router.post("/", createBranch);

// GET /api/branches
router.get("/", getBranches);

module.exports = router;