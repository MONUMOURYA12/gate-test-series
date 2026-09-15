const express = require("express");
const { protect } = require("../middleware/authMiddleware");
const { getCatalogue, getTestDetails } = require("../controllers/studentController");
const { startAttempt, getAttempt, saveAnswer, submitAttempt } = require("../controllers/attemptController");
const router = express.Router();
router.use(protect);
router.use((req, res, next) => {
  if (req.user.role !== "student") return res.status(403).json({ message: "Student access required." });
  next();
});
router.get("/catalogue", getCatalogue);
router.get("/tests/:testId", getTestDetails);
router.post("/tests/:testId/attempts", startAttempt);
router.get("/attempts/:attemptId", getAttempt);
router.put("/attempts/:attemptId/answers", saveAnswer);
router.post("/attempts/:attemptId/submit", submitAttempt);
module.exports = router;
