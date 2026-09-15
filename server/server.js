const express = require("express");
const cors = require("cors");
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

app.use(express.json());

// ============================================================
// DATABASE
// ============================================================

connectDB();

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

app.get("/", (req, res) => {
  res.json({
    message:
      "GATE Test Series API is running",
  });
});

// ============================================================
// SERVER
// ============================================================

const PORT =
  process.env.PORT || 5000;

app.listen(PORT, () => {
  console.log(
    `Server running on port ${PORT}`
  );
});