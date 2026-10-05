const express = require("express");
const { rateLimit } = require("express-rate-limit");
const { protect } = require("../middleware/authMiddleware");
const { getCatalogue, getTestDetails, getHistory } = require("../controllers/studentController");
const { startAttempt, getAttempt, saveAnswer, submitAttempt } = require("../controllers/attemptController");
const { getSolution } = require("../controllers/solutionController");
const router = express.Router();
const attemptStartLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  limit: 20,
  keyGenerator: req => String(req.user._id),
  standardHeaders: "draft-8",
  legacyHeaders: false,
  message: { message: "Too many test starts. Please try again in 15 minutes." },
});
const solutionLimiter = rateLimit({
  windowMs: 60 * 60 * 1000,
  limit: 20,
  keyGenerator: req => String(req.user._id),
  standardHeaders: "draft-8",
  legacyHeaders: false,
  message: { message: "Too many AI explanations requested. Please try again later." },
});
router.use(protect);
router.use((req, res, next) => {
  if (req.user.role !== "student") return res.status(403).json({ message: "Student access required." });
  next();
});
router.get("/catalogue", getCatalogue);
router.get("/history", getHistory);
router.get("/profile", getHistory);
router.get("/attempts/:attemptId/questions/:questionId/solution", solutionLimiter, getSolution);
router.get("/tests/:testId", getTestDetails);
router.post("/tests/:testId/attempts", attemptStartLimiter, startAttempt);
router.get("/attempts/:attemptId", getAttempt);
router.put("/attempts/:attemptId/answers", saveAnswer);
router.post("/attempts/:attemptId/submit", submitAttempt);
module.exports = router;
