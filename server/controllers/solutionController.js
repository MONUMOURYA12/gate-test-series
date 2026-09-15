const mongoose = require("mongoose");
const fs = require("node:fs");
const path = require("node:path");
const TestAttempt = require("../models/TestAttempt");
const Question = require("../models/Question");

const mediaDir = path.resolve(process.env.QUESTION_MEDIA_DIR || path.join(__dirname, "../data/question-media"));

function imageParts(images = []) {
  return images.slice(0, 4).flatMap(image => {
    const filePath = path.resolve(mediaDir, image.url.replace(/^\/question-media\//, ""));
    if (!filePath.startsWith(`${mediaDir}${path.sep}`) || !fs.existsSync(filePath)) return [];
    return [{ inlineData: { mimeType: "image/webp", data: fs.readFileSync(filePath).toString("base64") } }];
  });
}

async function generateSolution(question) {
  const prompt = [
    "You are a precise exam tutor. Explain this question clearly and accurately for a student.",
    "Return plain text only using exactly these short sections, each on its own line:",
    "Answer: ...",
    "Concept: ...",
    "Reasoning:",
    "- Explain the key steps in simple language.",
    "Conclusion: ...",
    "Do not use a table, do not repeat the prompt, and do not assume a circuit topology unless it is visible in the question or image.",
    "Use Unicode math notation directly: ω, ω₀, ∞, →, π, R₁ = R₂. Do not write LaTeX commands such as \\omega or wrap equations in dollar signs.",
    `Question type: ${question.questionType}`,
    `Question: ${question.questionText}`,
    `Options: ${(question.options || []).join(" | ")}`,
    `Correct answer from the verified exam key: ${JSON.stringify(question.correctAnswer)}`,
    question.natAnswerMin != null ? `Accepted numerical range: ${question.natAnswerMin} to ${question.natAnswerMax}` : "",
  ].filter(Boolean).join("\n");
  const parts = [{ text: prompt }, ...imageParts(question.questionImages)];
  const model = process.env.GEMINI_MODEL || "gemini-3.6-flash";
  const response = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/${encodeURIComponent(model)}:generateContent?key=${encodeURIComponent(process.env.GEMINI_API_KEY)}`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ contents: [{ parts }], generationConfig: { temperature: 0.2, maxOutputTokens: 4096 } }),
  });
  if (!response.ok) {
    const providerError = await response.json().catch(() => null);
    const error = new Error(providerError?.error?.message || "AI provider error");
    error.status = response.status;
    throw error;
  }
  const payload = await response.json();
  const text = payload.candidates?.[0]?.content?.parts?.map(part => part.text || "").join("\n").trim();
  if (!text) throw new Error("AI provider returned no explanation");
  return text;
}

async function getSolution(req, res) {
  try {
    if (!mongoose.isObjectIdOrHexString(req.params.attemptId) || !mongoose.isObjectIdOrHexString(req.params.questionId)) {
      return res.status(400).json({ message: "Invalid attempt or question." });
    }
    const attempt = await TestAttempt.findOne({ _id: req.params.attemptId, student: req.user._id }).lean();
    const question = attempt?.questions.find(item => String(item.questionId) === req.params.questionId);
    if (!question) return res.status(404).json({ message: "Question not found." });
    if (!question.answerSubmitted) return res.status(409).json({ message: "Submit your answer before viewing the solution." });
    const stored = await Question.findById(question.questionId).select("aiSolution explanation").lean();
    if (stored?.aiSolution) return res.json({ solution: stored.aiSolution, cached: true });
    if (stored?.explanation) return res.json({ solution: stored.explanation, cached: true });
    if (!process.env.GEMINI_API_KEY) return res.status(503).json({ message: "Add GEMINI_API_KEY in server/.env to generate new solutions. Cached solutions remain available." });
    const text = await generateSolution(question);
    await Question.updateOne({ _id: question.questionId }, { $set: { aiSolution: text, aiSolutionGenerated: true, aiSolutionModel: process.env.GEMINI_MODEL || "gemini-3.6-flash" } });
    res.set("Cache-Control", "private, no-store");
    return res.json({ solution: text, cached: false });
  } catch (error) {
    if (error.status === 401 || error.status === 403) return res.status(502).json({ message: "Gemini rejected the API key. Check GEMINI_API_KEY in server/.env." });
    if (error.status === 404) return res.status(502).json({ message: "The configured Gemini model is unavailable. Update GEMINI_MODEL in server/.env." });
    return res.status(502).json({ message: "The AI tutor is temporarily unavailable." });
  }
}

module.exports = { getSolution, generateSolution };
