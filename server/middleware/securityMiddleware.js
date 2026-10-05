const crypto = require("node:crypto");
const cors = require("cors");
const helmet = require("helmet");
const { rateLimit } = require("express-rate-limit");
const SAFE_METHODS = new Set(["GET", "HEAD", "OPTIONS"]);

function headers(config) {
  return helmet({
    contentSecurityPolicy: { directives: {
      defaultSrc: ["'self'"], scriptSrc: ["'self'"], scriptSrcAttr: ["'none'"],
      styleSrc: ["'self'", "https://fonts.googleapis.com"], imgSrc: ["'self'", "data:"],
      fontSrc: ["'self'", "https://fonts.gstatic.com"],
      connectSrc: ["'self'"], objectSrc: ["'none'"], baseUri: ["'none'"],
      formAction: ["'self'"], frameAncestors: ["'none'"],
      upgradeInsecureRequests: config.production ? [] : null,
    } },
    strictTransportSecurity: config.production ? { maxAge: 31536000, includeSubDomains: false } : false,
    referrerPolicy: { policy: "no-referrer" }, crossOriginResourcePolicy: { policy: "same-origin" },
  });
}

function apiOriginGuard(config) {
  const allowed = new Set(config.origins);
  return (req, res, next) => {
    res.set("Cache-Control", "no-store"); res.vary("Origin"); res.vary("Sec-Fetch-Site");
    const origin = req.get("Origin");
    if ((origin && !allowed.has(origin)) || req.get("Sec-Fetch-Site") === "cross-site") {
      return res.status(403).json({ message: "This request origin is not allowed." });
    }
    // This header triggers a CORS preflight, including for multipart uploads.
    // Exact-origin CORS never grants an untrusted site permission to send it.
    if (!SAFE_METHODS.has(req.method) && req.get("X-Requested-With") !== "XMLHttpRequest") {
      return res.status(403).json({ message: "A protected application request is required." });
    }
    next();
  };
}

function apiCors(config) {
  const allowed = new Set(config.origins);
  return cors({ origin(origin, callback) { callback(null, Boolean(origin && allowed.has(origin))); },
    credentials: true, methods: ["GET", "HEAD", "POST", "PUT", "PATCH", "DELETE", "OPTIONS"],
    allowedHeaders: ["Content-Type", "X-Requested-With"], maxAge: 600,
  });
}

function rejectUnsafeKeys(req, res, next) {
  const queue = [[req.body, 0]];
  let visited = 0;
  while (queue.length) {
    const [value, depth] = queue.pop();
    if (++visited > 10000 || depth > 20) return res.status(400).json({ message: "Request data is too complex." });
    if (!value || typeof value !== "object") continue;
    for (const key of Object.keys(value)) {
      if (key.startsWith("$") || ["__proto__", "constructor", "prototype"].includes(key)) {
        return res.status(400).json({ message: "Request contains an unsupported field." });
      }
      queue.push([value[key], depth + 1]);
    }
  }
  next();
}

function limits() {
  const base = { standardHeaders: "draft-8", legacyHeaders: false,
    message: { message: "Too many requests. Please wait and try again." } };
  return {
    api: rateLimit({ ...base, windowMs: 60 * 1000, limit: 600 }),
    loginIp: rateLimit({ ...base, windowMs: 15 * 60 * 1000, limit: 30, skipSuccessfulRequests: true }),
    loginAccount: rateLimit({ ...base, windowMs: 15 * 60 * 1000, limit: 15, skipSuccessfulRequests: true,
      keyGenerator(req) {
        const email = typeof req.body?.email === "string" ? req.body.email.trim().toLowerCase() : "invalid-input";
        return crypto.createHash("sha256").update(email).digest("hex");
      } }),
    register: rateLimit({ ...base, windowMs: 60 * 60 * 1000, limit: 10 }),
  };
}

function apiErrorHandler(error, req, res, next) {
  if (res.headersSent) return next(error);
  if (error.type === "entity.too.large") return res.status(413).json({ message: "Request body is too large." });
  if (error.type === "encoding.unsupported") return res.status(415).json({ message: "Compressed request bodies are not supported." });
  if (error.type === "entity.parse.failed" || error.type === "request.aborted") return res.status(400).json({ message: "Invalid request body." });
  return res.status(500).json({ message: "Unable to process the request. Please try again." });
}

module.exports = { headers, apiOriginGuard, apiCors, rejectUnsafeKeys, limits, apiErrorHandler };
