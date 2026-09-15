const express = require("express");
const mongoose = require("mongoose");
const fs = require("node:fs");
const path = require("node:path");
const connectDB = require("./config/db");
const { readRuntimeConfig, validateStartup } = require("./config/runtime");
const { protect } = require("./middleware/authMiddleware");
const security = require("./middleware/securityMiddleware");

function createApp(config = readRuntimeConfig()) {
  const app = express();
  app.disable("x-powered-by");
  app.set("trust proxy", config.trustProxy);
  app.set("query parser", "simple");
  app.use(security.headers(config));
  app.use((req, res, next) => {
    res.set("Permissions-Policy", "camera=(), microphone=(), geolocation=(), payment=()");
    if (config.production && !req.secure && req.path !== "/health") {
      if (!["GET", "HEAD"].includes(req.method)) return res.status(400).json({ message: "HTTPS is required." });
      return res.redirect(308, `${config.origins[0]}${req.originalUrl}`);
    }
    next();
  });
  const rateLimits = security.limits();
  app.use("/api", security.apiOriginGuard(config), security.apiCors(config), rateLimits.api,
    express.json({ limit: "256kb", strict: true, inflate: false }), security.rejectUnsafeKeys);
  app.post("/api/auth/login", rateLimits.loginIp, rateLimits.loginAccount);
  app.post("/api/auth/register", rateLimits.register);
  for (const route of ["branches", "subjects", "chapters", "tests", "questions", "auth", "student"]) {
    const moduleName = { branches: "branch", subjects: "subject", chapters: "chapter", tests: "test", questions: "question" }[route] || route;
    app.use(`/api/${route}`, require(`./routes/${moduleName}Routes`));
  }
  app.use("/api", (req, res) => res.status(404).json({ message: "API route not found." }));
  app.use("/question-media", protect, express.static(config.mediaDir, {
    index: false, dotfiles: "deny", redirect: false,
    setHeaders(res) { res.set("Cache-Control", "private, max-age=86400"); },
  }));
  app.use("/question-media", (req, res) => res.status(404).json({ message: "Question image not found." }));
  app.get("/health", (req, res) => {
    const databaseReady = mongoose.connection.readyState === 1;
    res.set("Cache-Control", "no-store");
    return res.status(databaseReady ? 200 : 503).json({ status: databaseReady ? "ok" : "degraded" });
  });
  const indexFile = path.join(config.clientDir, "index.html");
  if (fs.existsSync(indexFile)) {
    app.use(express.static(config.clientDir, { index: false, dotfiles: "deny", redirect: false,
      setHeaders(res, filename) { res.set("Cache-Control", filename.endsWith(".html") ? "no-cache" : "public, max-age=3600"); } }));
    app.get("/{*splat}", (req, res, next) => {
      if (!req.accepts("html") || req.path.split("/").some(segment => segment.includes("."))) return next();
      res.set("Cache-Control", "no-cache");
      return res.sendFile(indexFile);
    });
  } else {
    app.get("/", (req, res) => res.json({ message: "GATE Test Series API is running" }));
  }
  app.use((req, res) => res.status(404).json({ message: "Page not found." }));
  app.use(security.apiErrorHandler);
  return app;
}

async function startServer() {
  require("dotenv").config({ path: path.join(__dirname, ".env"), quiet: true });
  const config = validateStartup();
  if (config.production && !fs.existsSync(path.join(config.clientDir, "index.html"))) {
    throw new Error("Build the frontend before starting the production server.");
  }
  await connectDB();
  const app = createApp(config);
  if (config.production) {
    // autoIndex is disabled in production. Ensure unique email and active-attempt
    // constraints exist before accepting requests, including on a fresh database.
    try {
      await Promise.all(Object.values(mongoose.models).map(model => model.createIndexes()));
    } catch {
      await mongoose.disconnect();
      throw new Error("Unable to create database indexes. Check database permissions and resolve duplicate records before deployment.");
    }
  }
  const server = app.listen(config.port, () => console.log(`Server running on port ${config.port}`));
  server.requestTimeout = 30000;
  server.headersTimeout = 15000;
  const shutdown = () => {
    const deadline = setTimeout(() => process.exit(1), 10000).unref();
    server.close(() => mongoose.disconnect().finally(() => { clearTimeout(deadline); process.exit(0); }));
  };
  process.once("SIGTERM", shutdown);
  process.once("SIGINT", shutdown);
  return server;
}

if (require.main === module) {
  startServer().catch(error => {
    console.error(error.name === "Error" ? error.message : "Unable to start server. Check configuration and database connectivity.");
    process.exitCode = 1;
  });
}

module.exports = { createApp, startServer };
