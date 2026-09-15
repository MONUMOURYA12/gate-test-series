const jwt = require("jsonwebtoken");

const SESSION_SECONDS = 8 * 60 * 60;
const TOKEN_ISSUER = "gate-test-series";
const TOKEN_AUDIENCE = "gate-test-series-web";
const NEW_PASSWORD_MESSAGE = "Password must contain at least 12 characters and at most 72 UTF-8 bytes";

function normalizeEmail(value) {
  if (typeof value !== "string" || value.length > 254) return null;
  const email = value.trim().toLowerCase();
  if (!/^[^\s@\x00-\x1f\x7f]+@[^\s@\x00-\x1f\x7f]+\.[^\s@\x00-\x1f\x7f]+$/.test(email)) return null;
  if (email.split("@")[0].length > 64) return null;
  return email;
}

function validPassword(value, { isNew = true } = {}) {
  if (typeof value !== "string" || value.includes("\0") || value.length > 72) return false;
  // bcrypt silently truncates after 72 bytes. Reject longer input, including Unicode.
  const bytes = Buffer.byteLength(value, "utf8");
  return bytes <= 72 && Array.from(value).length >= (isNew ? 12 : 1);
}

function trimmedText(value, min, max) {
  if (typeof value !== "string" || value.length > max + 20) return null;
  const normalized = value.trim();
  if (normalized.length < min || normalized.length > max || /[\x00-\x1f\x7f]/.test(normalized)) return null;
  return normalized;
}

function publicUser(user) {
  const branch = user.branch;
  const populatedBranch = branch && typeof branch === "object" && typeof branch.name === "string";
  const subscription = user.subscription;
  return {
    id: user._id,
    _id: user._id,
    name: user.name,
    email: user.email,
    mobileNumber: user.mobileNumber,
    collegeName: user.collegeName,
    passingYear: user.passingYear,
    branch: populatedBranch ? { _id: branch._id, name: branch.name, code: branch.code } : branch,
    role: user.role,
    isActive: user.isActive,
    isEmailVerified: user.isEmailVerified,
    subscription: subscription ? {
      plan: subscription.plan,
      status: subscription.status,
      startDate: subscription.startDate,
      endDate: subscription.endDate,
    } : undefined,
    createdAt: user.createdAt,
  };
}

function cookieName() {
  return process.env.NODE_ENV === "production" ? "__Host-gate_session" : "gate_session";
}

function cookieOptions() {
  return {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "strict",
    path: "/",
  };
}

function sessionSecret() {
  const secret = process.env.JWT_SECRET;
  if (typeof secret !== "string" || Buffer.byteLength(secret, "utf8") < 32) {
    throw new Error("Session signing secret is not configured securely");
  }
  return secret;
}

function createSessionToken(user) {
  return jwt.sign({ tokenVersion: user.tokenVersion ?? 0 }, sessionSecret(), {
    algorithm: "HS256",
    issuer: TOKEN_ISSUER,
    audience: TOKEN_AUDIENCE,
    subject: String(user._id),
    expiresIn: SESSION_SECONDS,
  });
}

function setSessionCookie(res, user) {
  res.cookie(cookieName(), createSessionToken(user), {
    ...cookieOptions(),
    maxAge: SESSION_SECONDS * 1000,
  });
}

function clearSessionCookie(res) {
  res.clearCookie(cookieName(), cookieOptions());
}

function readSessionCookie(req) {
  const raw = req.headers?.cookie;
  if (typeof raw !== "string" || raw.length > 8192) return null;
  const name = cookieName();
  const matches = raw.split(";").map(part => part.trim()).filter(part => part.startsWith(`${name}=`));
  // Reject ambiguous duplicate cookies rather than allowing cookie shadowing.
  if (matches.length !== 1) return null;
  try {
    const token = decodeURIComponent(matches[0].slice(name.length + 1));
    return token.length > 0 && token.length <= 2048 ? token : null;
  } catch {
    return null;
  }
}

function verifySessionToken(token) {
  const decoded = jwt.verify(token, sessionSecret(), {
    algorithms: ["HS256"],
    issuer: TOKEN_ISSUER,
    audience: TOKEN_AUDIENCE,
    maxAge: SESSION_SECONDS,
    clockTolerance: 5,
  });
  if (typeof decoded !== "object" || !/^[a-f\d]{24}$/i.test(decoded.sub || "") ||
      !Number.isSafeInteger(decoded.tokenVersion) || decoded.tokenVersion < 0 ||
      !Number.isInteger(decoded.exp) || !Number.isInteger(decoded.iat) ||
      decoded.iat > Math.floor(Date.now() / 1000) + 5 || decoded.exp - decoded.iat > SESSION_SECONDS) {
    throw new jwt.JsonWebTokenError("Invalid session claims");
  }
  return decoded;
}

module.exports = {
  SESSION_SECONDS,
  TOKEN_ISSUER,
  TOKEN_AUDIENCE,
  NEW_PASSWORD_MESSAGE,
  normalizeEmail,
  validPassword,
  trimmedText,
  publicUser,
  cookieName,
  cookieOptions,
  createSessionToken,
  setSessionCookie,
  clearSessionCookie,
  readSessionCookie,
  verifySessionToken,
};
