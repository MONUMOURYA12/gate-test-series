const bcrypt = require("bcryptjs");
const crypto = require("node:crypto");
const mongoose = require("mongoose");
const User = require("../models/User");
const Branch = require("../models/Branch");
const {
  NEW_PASSWORD_MESSAGE,
  normalizeEmail,
  validPassword,
  trimmedText,
  publicUser,
  setSessionCookie,
  clearSessionCookie,
} = require("../services/authSecurity");

const PASSWORD_COST = 12;
// Missing accounts still perform a password comparison and receive the same error.
const DUMMY_PASSWORD_HASH = bcrypt.hashSync(crypto.randomBytes(32).toString("hex"), PASSWORD_COST);
const invalidLogin = res => res.status(401).json({ message: "Invalid email or password" });
const serverError = res => res.status(500).json({ message: "Unable to complete this request. Please try again." });
const duplicateAccount = res => res.status(409).json({ message: "Unable to create an account with these details" });

const registerUser = async (req, res) => {
  try {
    const input = req.body || {};
    const name = trimmedText(input.name, 2, 100);
    const collegeName = trimmedText(input.collegeName, 2, 150);
    const email = normalizeEmail(input.email);
    if (!name || !collegeName || !email) {
      return res.status(400).json({ message: "Enter a valid full name, college name and email address" });
    }
    if (!validPassword(input.password)) {
      return res.status(400).json({ message: NEW_PASSWORD_MESSAGE });
    }
    const mobileNumber = typeof input.mobileNumber === "string" && input.mobileNumber.length <= 30
      ? input.mobileNumber.replace(/[\s()-]/g, "") : "";
    if (!/^\+?\d{10,15}$/.test(mobileNumber)) {
      return res.status(400).json({ message: "Enter a valid mobile number" });
    }
    const yearInput = input.passingYear;
    const passingYear = (typeof yearInput === "number" || (typeof yearInput === "string" && /^\d{4}$/.test(yearInput)))
      ? Number(yearInput) : NaN;
    const latestPassingYear = Math.min(2100, new Date().getFullYear() + 10);
    if (!Number.isInteger(passingYear) || passingYear < 1950 || passingYear > latestPassingYear) {
      return res.status(400).json({ message: `Passing year must be between 1950 and ${latestPassingYear}` });
    }
    if (typeof input.branch !== "string" || !mongoose.isObjectIdOrHexString(input.branch)) {
      return res.status(400).json({ message: "Select a valid branch" });
    }
    const selectedBranch = await Branch.findOne({ _id: input.branch, isActive: true }).select("name code");
    if (!selectedBranch) return res.status(400).json({ message: "Selected branch is unavailable" });
    if (await User.exists({ email })) return duplicateAccount(res);

    const user = await User.create({
      name,
      email,
      mobileNumber,
      collegeName,
      passingYear,
      branch: selectedBranch._id,
      password: await bcrypt.hash(input.password, PASSWORD_COST),
      role: "student",
      isActive: true,
      isEmailVerified: false,
      subscription: { plan: "free", status: "inactive" },
    });
    res.set("Cache-Control", "no-store");
    return res.status(201).json({
      message: "User registered successfully",
      user: publicUser({ ...user.toObject(), branch: selectedBranch }),
    });
  } catch (error) {
    if (error.code === 11000) return duplicateAccount(res);
    return serverError(res);
  }
};

const loginUser = async (req, res) => {
  try {
    const { email: rawEmail, password } = req.body || {};
    const email = normalizeEmail(rawEmail);
    // Existing short passwords continue to work, but all new passwords use the stronger policy.
    if (!email || !validPassword(password, { isNew: false })) return invalidLogin(res);
    const user = await User.findOne({ email }).select("+password +tokenVersion").populate("branch", "name code");
    const isPasswordCorrect = await bcrypt.compare(password, user?.password || DUMMY_PASSWORD_HASH);
    if (!user || !user.isActive || !isPasswordCorrect) return invalidLogin(res);

    setSessionCookie(res, user);
    res.set("Cache-Control", "no-store");
    return res.status(200).json({ message: "Login successful", user: publicUser(user) });
  } catch {
    return serverError(res);
  }
};

const logoutUser = (req, res) => {
  clearSessionCookie(res);
  res.set("Cache-Control", "no-store");
  return res.status(200).json({ message: "Logged out successfully" });
};

const getCurrentUser = (req, res) => {
  res.set("Cache-Control", "no-store");
  return res.status(200).json({ message: "Current user fetched successfully", user: publicUser(req.user) });
};

const updateCurrentUser = async (req, res) => {
  try {
    const input = req.body || {};
    const name = trimmedText(input.name, 2, 100);
    const collegeName = trimmedText(input.collegeName, 2, 150);
    const mobileNumber = typeof input.mobileNumber === "string" && input.mobileNumber.length <= 30
      ? input.mobileNumber.replace(/[\s()-]/g, "") : "";
    const passingYear = (typeof input.passingYear === "number" || (typeof input.passingYear === "string" && /^\d{4}$/.test(input.passingYear)))
      ? Number(input.passingYear) : NaN;
    const latestPassingYear = Math.min(2100, new Date().getFullYear() + 10);
    if (!name || !collegeName || !/^\+?\d{10,15}$/.test(mobileNumber) || !Number.isInteger(passingYear) || passingYear < 1950 || passingYear > latestPassingYear) {
      return res.status(400).json({ message: "Enter valid profile details." });
    }
    const user = await User.findByIdAndUpdate(req.user._id, {
      $set: { name, collegeName, mobileNumber, passingYear },
    }, { new: true, runValidators: true }).populate("branch", "name code");
    if (!user) return res.status(404).json({ message: "Profile not found." });
    res.set("Cache-Control", "no-store");
    return res.json({ message: "Profile updated successfully", user: publicUser(user) });
  } catch {
    return serverError(res);
  }
};

const adminTest = (req, res) => res.status(200).json({
  message: "Admin access granted",
  user: { id: req.user._id, name: req.user.name, email: req.user.email, role: req.user.role },
});

const createAdmin = async (req, res) => {
  try {
    const input = req.body || {};
    const name = trimmedText(input.name, 2, 100);
    const email = normalizeEmail(input.email);
    if (!name || !email) return res.status(400).json({ message: "Enter a valid name and email address" });
    if (!validPassword(input.password)) return res.status(400).json({ message: NEW_PASSWORD_MESSAGE });
    if (await User.exists({ email })) return duplicateAccount(res);

    const admin = await User.create({
      name,
      email,
      password: await bcrypt.hash(input.password, PASSWORD_COST),
      role: "admin",
      isActive: true,
      isEmailVerified: false,
      subscription: { plan: "free", status: "inactive" },
    });
    res.set("Cache-Control", "no-store");
    return res.status(201).json({ message: "Admin created successfully", user: publicUser(admin) });
  } catch (error) {
    if (error.code === 11000) return duplicateAccount(res);
    return serverError(res);
  }
};

const adminResetPassword = async (req, res) => {
  try {
    const { email: rawEmail, newPassword } = req.body || {};
    const email = normalizeEmail(rawEmail);
    if (!email) return res.status(400).json({ message: "Enter a valid email address" });
    if (!validPassword(newPassword)) return res.status(400).json({ message: NEW_PASSWORD_MESSAGE });
    const hashedPassword = await bcrypt.hash(newPassword, PASSWORD_COST);
    // Atomic increment prevents concurrent resets from accidentally restoring an old session version.
    const user = await User.findOneAndUpdate(
      { email, isActive: true },
      { $set: { password: hashedPassword }, $inc: { tokenVersion: 1 } },
      { new: true, runValidators: true }
    );
    if (!user) return res.status(404).json({ message: "Active user not found" });
    res.set("Cache-Control", "no-store");
    return res.status(200).json({ message: "Password reset successfully. Existing sessions have been revoked." });
  } catch {
    return serverError(res);
  }
};

module.exports = { registerUser, loginUser, logoutUser, getCurrentUser, updateCurrentUser, adminTest, createAdmin, adminResetPassword };
