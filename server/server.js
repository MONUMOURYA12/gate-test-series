const express = require("express");
const cors = require("cors");
require("dotenv").config();

const connectDB = require("./config/db");
const subjectRoutes = require("./routes/subjectRoutes");
const branchRoutes = require("./routes/branchRoutes");
const chapterRoutes = require("./routes/chapterRoutes");
const testRoutes = require("./routes/testRoutes");
const questionRoutes = require("./routes/questionRoutes");

const app = express();

app.use(cors());
app.use(express.json());

connectDB();
app.use("/api/branches", branchRoutes);
app.use("/api/subjects", subjectRoutes)
app.use("/api/chapters", chapterRoutes);
app.use("/api/tests", testRoutes);
app.use("/api/questions", questionRoutes);

app.get("/", (req, res) => {
  res.json({
    message: "GATE Test Series API is running",
  });
});

const PORT = process.env.PORT || 5000;

app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});