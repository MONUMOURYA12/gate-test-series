const jwt = require("jsonwebtoken");
const User = require("../models/User");

// ============================================================
// AUTHENTICATION MIDDLEWARE
// ============================================================

const protect = async (req, res, next) => {
  try {
    const authHeader =
      req.headers.authorization;

    if (!authHeader) {
      return res.status(401).json({
        message:
          "Authentication required. Please login first.",
      });
    }

    if (
      !authHeader.startsWith("Bearer ")
    ) {
      return res.status(401).json({
        message:
          "Invalid authorization format",
      });
    }

    const token =
      authHeader.split(" ")[1];

    if (!token) {
      return res.status(401).json({
        message:
          "Authentication token is missing",
      });
    }

    const decoded =
      jwt.verify(
        token,
        process.env.JWT_SECRET
      );

    const userQuery = User.findById(decoded.userId).select("-password");
    const user = typeof userQuery.populate === "function"
      ? await userQuery.populate("branch", "name code")
      : await userQuery;

    if (!user) {
      return res.status(401).json({
        message:
          "User associated with this token was not found",
      });
    }

    if (!user.isActive) {
      return res.status(403).json({
        message:
          "Your account has been deactivated",
      });
    }

    req.user = user;

    next();
  } catch (error) {
    if (
      error.name ===
      "TokenExpiredError"
    ) {
      return res.status(401).json({
        message:
          "Authentication token has expired. Please login again.",
      });
    }

    if (
      error.name ===
      "JsonWebTokenError"
    ) {
      return res.status(401).json({
        message:
          "Invalid authentication token",
      });
    }

    res.status(500).json({
      message: "Server error",
      error: error.message,
    });
  }
};

// ============================================================
// ADMIN AUTHORIZATION
// ============================================================

const adminOnly = (
  req,
  res,
  next
) => {
  if (
    !req.user ||
    req.user.role !== "admin"
  ) {
    return res.status(403).json({
      message:
        "Admin access required",
    });
  }

  next();
};

// ============================================================
// EXPORTS
// ============================================================

module.exports = {
  protect,
  adminOnly,
};
