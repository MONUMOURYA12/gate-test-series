const User = require("../models/User");
const { readSessionCookie, verifySessionToken, clearSessionCookie } = require("../services/authSecurity");

const protect = async (req, res, next) => {
  const token = readSessionCookie(req);
  if (!token) {
    return res.status(401).json({ message: "Authentication required. Please login first." });
  }

  try {
    const decoded = verifySessionToken(token);
    const user = await User.findById(decoded.sub).select("+tokenVersion").populate("branch", "name code");
    // Older users default to version 0; resets atomically increment this version.
    if (!user || !user.isActive || (user.tokenVersion ?? 0) !== decoded.tokenVersion) {
      clearSessionCookie(res);
      return res.status(401).json({ message: "Session is invalid. Please login again." });
    }
    // The database role is authoritative; token contents cannot grant privileges.
    req.user = user;
    res.set("Cache-Control", "no-store");
    next();
  } catch (error) {
    if (["TokenExpiredError", "JsonWebTokenError", "NotBeforeError"].includes(error.name)) {
      clearSessionCookie(res);
      return res.status(401).json({ message: "Session is invalid or expired. Please login again." });
    }
    return res.status(500).json({ message: "Unable to authenticate. Please try again." });
  }
};

const adminOnly = (req, res, next) => {
  if (!req.user || req.user.role !== "admin") {
    return res.status(403).json({ message: "Admin access required" });
  }
  next();
};

module.exports = { protect, adminOnly };
