const express = require("express");
const cors = require("cors");
const mongoose = require("mongoose");
const path = require("path");
require("dotenv").config();

const connectDB = require("./config/db");

const branchRoutes = require("./routes/branchRoutes");
const subjectRoutes = require("./routes/subjectRoutes");
const chapterRoutes = require("./routes/chapterRoutes");
const testRoutes = require("./routes/testRoutes");
const questionRoutes = require("./routes/questionRoutes");
const authRoutes = require("./routes/authRoutes");

const studentRoutes = require("./routes/studentRoutes");

const app = express();

// ============================================================
// MIDDLEWARE
// ============================================================

app.use(cors());

app.use(express.json({ limit: "1mb" }));
app.use("/question-media", express.static(path.join(__dirname, "data/question-media"), {
  index: false,
  dotfiles: "deny",
  maxAge: "1d",
}));

// ============================================================
// ROUTES
// ============================================================

app.use(
  "/api/branches",
  branchRoutes
);

app.use(
  "/api/subjects",
  subjectRoutes
);

app.use(
  "/api/chapters",
  chapterRoutes
);

app.use(
  "/api/tests",
  testRoutes
);

app.use(
  "/api/questions",
  questionRoutes
);

app.use(
  "/api/auth",
  authRoutes
);

// ============================================================
// ROOT ROUTE
// ============================================================

app.use("/api/student", studentRoutes);

app.get("/health", (req, res) => {
  const databaseReady = mongoose.connection.readyState === 1;
  return res.status(databaseReady ? 200 : 503).json({
    status: databaseReady ? "ok" : "degraded",
    database: databaseReady ? "connected" : "disconnected",
  });
});

app.get("/", (req, res) => {
  res.json({
    message:
      "GATE Test Series API is running",
  });
});

// ============================================================
// SERVER
// ============================================================

const PORT = process.env.PORT || 5000;

async function startServer() {
  await connectDB();
  return app.listen(PORT, () => {
    console.log(`Server running on port ${PORT}`);
  });
}

if (require.main === module) {
  startServer().catch(error => {
    console.error("Unable to start server:", error.message);
    process.exitCode = 1;
  });
}

module.exports = { app, startServer };
