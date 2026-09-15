const bcrypt = require("bcryptjs");
const jwt = require("jsonwebtoken");
const mongoose = require("mongoose");
const User = require("../models/User");
const Branch = require("../models/Branch");

function publicUser(user) {
  return {
    id: user._id,
    name: user.name,
    email: user.email,
    mobileNumber: user.mobileNumber,
    collegeName: user.collegeName,
    passingYear: user.passingYear,
    branch: user.branch,
    role: user.role,
    isActive: user.isActive,
    isEmailVerified: user.isEmailVerified,
    subscription: user.subscription,
    createdAt: user.createdAt,
  };
}

// ============================================================
// REGISTER USER
// ============================================================

const registerUser = async (req, res) => {
  try {
    const {
      name,
      mobileNumber,
      branch,
      collegeName,
      passingYear,
      email,
      password,
    } = req.body;

    if (!name || !mobileNumber || !branch || !collegeName || !passingYear || !email || !password) {
      return res.status(400).json({
        message: "Full name, mobile number, branch, college name, passing year, email and password are required",
      });
    }

    if (name.trim().length < 2) {
      return res.status(400).json({
        message:
          "Name must be at least 2 characters long",
      });
    }

    if (password.length < 6) {
      return res.status(400).json({
        message: "Password must be at least 6 characters long",
      });
    }

    const normalizedMobile = String(mobileNumber).replace(/[\s()-]/g, "");
    if (!/^\+?\d{10,15}$/.test(normalizedMobile)) {
      return res.status(400).json({ message: "Enter a valid mobile number" });
    }

    if (collegeName.trim().length < 2) {
      return res.status(400).json({ message: "College name must be at least 2 characters long" });
    }

    const normalizedPassingYear = Number(passingYear);
    const latestPassingYear = new Date().getFullYear() + 10;
    if (!Number.isInteger(normalizedPassingYear) || normalizedPassingYear < 1950 || normalizedPassingYear > latestPassingYear) {
      return res.status(400).json({ message: `Passing year must be between 1950 and ${latestPassingYear}` });
    }

    if (!mongoose.isObjectIdOrHexString(branch)) {
      return res.status(400).json({ message: "Select a valid branch" });
    }

    const selectedBranch = await Branch.findOne({ _id: branch, isActive: true }).select("name code");
    if (!selectedBranch) {
      return res.status(400).json({ message: "Selected branch is unavailable" });
    }

    const normalizedEmail =
      email.trim().toLowerCase();

    const existingUser =
      await User.findOne({
        email: normalizedEmail,
      });

    if (existingUser) {
      return res.status(409).json({
        message:
          "An account with this email already exists",
      });
    }

    const salt =
      await bcrypt.genSalt(10);

    const hashedPassword =
      await bcrypt.hash(
        password,
        salt
      );

    const user = await User.create({
      name: name.trim(),
      email: normalizedEmail,
      mobileNumber: normalizedMobile,
      collegeName: collegeName.trim(),
      passingYear: normalizedPassingYear,
      branch: selectedBranch._id,
      password: hashedPassword,
      role: "student",
      isActive: true,
      isEmailVerified: false,

      subscription: {
        plan: "free",
        status: "inactive",
      },
    });

    res.status(201).json({
      message:
        "User registered successfully",

      user: publicUser({ ...user.toObject(), branch: selectedBranch.toObject() }),
    });
  } catch (error) {
    if (error.code === 11000) {
      return res.status(409).json({
        message:
          "An account with this email already exists",
      });
    }

    res.status(500).json({
      message: "Server error",
      error: error.message,
    });
  }
};

// ============================================================
// LOGIN USER
// ============================================================

const loginUser = async (req, res) => {
  try {
    const {
      email,
      password,
    } = req.body;

    if (!email || !password) {
      return res.status(400).json({
        message:
          "Email and password are required",
      });
    }

    const normalizedEmail =
      email.trim().toLowerCase();

    const user = await User.findOne({ email: normalizedEmail }).populate("branch", "name code");

    if (!user) {
      return res.status(401).json({
        message:
          "Invalid email or password",
      });
    }

    if (!user.isActive) {
      return res.status(403).json({
        message:
          "Your account has been deactivated",
      });
    }

    const isPasswordCorrect =
      await bcrypt.compare(
        password,
        user.password
      );

    if (!isPasswordCorrect) {
      return res.status(401).json({
        message:
          "Invalid email or password",
      });
    }

    const token =
      jwt.sign(
        {
          userId: user._id,
          role: user.role,
        },
        process.env.JWT_SECRET,
        {
          expiresIn: "7d",
        }
      );

    res.status(200).json({
      message:
        "Login successful",

      token,

      user: publicUser(user),
    });
  } catch (error) {
    res.status(500).json({
      message: "Server error",
      error: error.message,
    });
  }
};

// ============================================================
// GET CURRENT LOGGED-IN USER
// ============================================================

const getCurrentUser = async (
  req,
  res
) => {
  try {
    res.status(200).json({
      message:
        "Current user fetched successfully",

      user: req.user,
    });
  } catch (error) {
    res.status(500).json({
      message: "Server error",
      error: error.message,
    });
  }
};

// ============================================================
// ADMIN TEST CONTROLLER
// ============================================================

const adminTest = async (
  req,
  res
) => {
  try {
    res.status(200).json({
      message:
        "Admin access granted",

      user: {
        id: req.user._id,
        name: req.user.name,
        email: req.user.email,
        role: req.user.role,
      },
    });
  } catch (error) {
    res.status(500).json({
      message: "Server error",
      error: error.message,
    });
  }
};

// ============================================================
// CREATE ADMIN USER
// ============================================================

const createAdmin = async (req, res) => {
  try {
    const {
      name,
      email,
      password,
    } = req.body;

    if (!name || !email || !password) {
      return res.status(400).json({
        message:
          "Name, email and password are required",
      });
    }

    if (name.trim().length < 2) {
      return res.status(400).json({
        message:
          "Name must be at least 2 characters long",
      });
    }

    if (password.length < 6) {
      return res.status(400).json({
        message:
          "Password must be at least 6 characters long",
      });
    }

    const normalizedEmail =
      email.trim().toLowerCase();

    const existingUser =
      await User.findOne({
        email: normalizedEmail,
      });

    if (existingUser) {
      return res.status(409).json({
        message:
          "An account with this email already exists",
      });
    }

    const salt =
      await bcrypt.genSalt(10);

    const hashedPassword =
      await bcrypt.hash(
        password,
        salt
      );

    const admin = await User.create({
      name: name.trim(),
      email: normalizedEmail,
      password: hashedPassword,
      role: "admin",
      isActive: true,
      isEmailVerified: false,

      subscription: {
        plan: "free",
        status: "inactive",
      },
    });

    res.status(201).json({
      message:
        "Admin created successfully",

      user: {
        id: admin._id,
        name: admin.name,
        email: admin.email,
        role: admin.role,
        isActive: admin.isActive,
        isEmailVerified:
          admin.isEmailVerified,
        subscription:
          admin.subscription,
        createdAt:
          admin.createdAt,
      },
    });
  } catch (error) {
    if (error.code === 11000) {
      return res.status(409).json({
        message:
          "An account with this email already exists",
      });
    }

    res.status(500).json({
      message: "Server error",
      error: error.message,
    });
  }
};

// ============================================================
// ADMIN RESET USER PASSWORD
// ============================================================

const adminResetPassword = async (req, res) => {
  try {
    const {
      email,
      newPassword,
    } = req.body;

    if (!email || !newPassword) {
      return res.status(400).json({
        message:
          "Email and new password are required",
      });
    }

    if (newPassword.length < 6) {
      return res.status(400).json({
        message:
          "New password must be at least 6 characters long",
      });
    }

    const normalizedEmail =
      email.trim().toLowerCase();

    const user =
      await User.findOne({
        email: normalizedEmail,
      });

    if (!user) {
      return res.status(404).json({
        message: "User not found",
      });
    }

    if (!user.isActive) {
      return res.status(403).json({
        message:
          "Target user account is deactivated",
      });
    }

    const salt =
      await bcrypt.genSalt(10);

    const hashedPassword =
      await bcrypt.hash(
        newPassword,
        salt
      );

    user.password = hashedPassword;

    await user.save();

    res.status(200).json({
      message:
        "Admin password reset successfully",
    });
  } catch (error) {
    res.status(500).json({
      message: "Server error",
      error: error.message,
    });
  }
};

// ============================================================
// EXPORTS
// ============================================================

module.exports = {
  registerUser,
  loginUser,
  getCurrentUser,
  adminTest,
  createAdmin,
  adminResetPassword,
};
