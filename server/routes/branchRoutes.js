const express = require("express");

const {
  createBranch,
  getBranches,
} = require("../controllers/branchController");

const {
  protect,
  adminOnly,
} = require("../middleware/authMiddleware");

const router = express.Router();

// ============================================================
// GET ALL BRANCHES
// ============================================================

router.get(
  "/",
  getBranches
);

// ============================================================
// CREATE BRANCH - ADMIN ONLY
// ============================================================

router.post(
  "/",
  protect,
  adminOnly,
  createBranch
);

module.exports = router;