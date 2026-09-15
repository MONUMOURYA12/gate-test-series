const mongoose = require("mongoose");

const attemptQuestionSchema = new mongoose.Schema({
  questionId: { type: mongoose.Schema.Types.ObjectId, required: true },
  questionNumber: { type: Number, required: true },
  questionText: { type: String, required: true },
  questionImages: { type: [require("./questionImageSchema")], default: [] },
  questionType: { type: String, enum: ["mcq", "msq", "nat"], required: true },
  options: [String],
  correctAnswer: { type: mongoose.Schema.Types.Mixed, default: null },
  natAnswerMin: Number,
  natAnswerMax: Number,
  explanation: String,
  marks: { type: Number, required: true },
  negativeMarks: { type: Number, default: 0 },
  answer: { type: mongoose.Schema.Types.Mixed, default: null },
  markedForReview: { type: Boolean, default: false },
}, { _id: false });

const testAttemptSchema = new mongoose.Schema({
  student: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true },
  test: { type: mongoose.Schema.Types.ObjectId, ref: "Test", required: true },
  title: { type: String, required: true },
  duration: { type: Number, required: true },
  status: { type: String, enum: ["in_progress", "submitted"], default: "in_progress" },
  startedAt: { type: Date, required: true },
  expiresAt: { type: Date, required: true },
  submittedAt: Date,
  questions: { type: [attemptQuestionSchema], required: true },
  result: {
    score: Number,
    totalMarks: Number,
    correct: Number,
    incorrect: Number,
    unanswered: Number,
    timeTakenSeconds: Number,
  },
}, { timestamps: true });

testAttemptSchema.index({ student: 1, test: 1 }, {
  unique: true,
  partialFilterExpression: { status: "in_progress" },
});
testAttemptSchema.index({ student: 1, createdAt: -1 });

module.exports = mongoose.model("TestAttempt", testAttemptSchema);
