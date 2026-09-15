const express = require("express");

const {
  registerUser,
  loginUser,
  getCurrentUser,
  adminTest,
  createAdmin,
  adminResetPassword,
} = require("../controllers/authController");

const {
  protect,
  adminOnly,
} = require("../middleware/authMiddleware");

const router = express.Router();

// ============================================================
// PUBLIC ROUTES
// ============================================================

// Register
router.post(
  "/register",
  registerUser
);

// Login
router.post(
  "/login",
  loginUser
);

// ============================================================
// PROTECTED ROUTES
// ============================================================

// Current logged-in user
router.get(
  "/me",
  protect,
  getCurrentUser
);

// ============================================================
// ADMIN ONLY ROUTES
// ============================================================

router.get(
  "/admin-test",
  protect,
  adminOnly,
  adminTest
);

router.post(
  "/create-admin",
  protect,
  adminOnly,
  createAdmin
);

router.post(
  "/admin-reset-password",
  protect,
  adminOnly,
  adminResetPassword
);

module.exports = router;
