const mongoose = require("mongoose");

const questionSchema = new mongoose.Schema(
  {
    // ============================================
    // HIERARCHY RELATIONS
    // ============================================

    branch: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Branch",
      required: true,
      index: true,
    },

    subject: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Subject",
      required: true,
      index: true,
    },

    chapter: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Chapter",
      required: true,
      index: true,
    },

    test: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Test",
      required: false,
      index: true,
    },

    // ============================================
    // QUESTION IDENTITY
    // ============================================

    questionNumber: {
      type: Number,
      required: true,
      min: 1,
    },

    questionText: {
      type: String,
      required: true,
      trim: true,
    },

    questionType: {
      type: String,
      enum: ["mcq", "msq", "nat"],
      required: true,
      default: "mcq",
      index: true,
    },

    // ============================================
    // OPTIONS / ANSWER
    // ============================================

    options: {
      type: [String],
      default: [],
    },

    correctAnswer: {
      type: mongoose.Schema.Types.Mixed,
      required: function requiredAnswer() {
        return !this.requiresReview && !(this.natAnswerMin != null && this.natAnswerMax != null);
      },
    },

    natAnswerMin: {
      type: Number,
    },

    natAnswerMax: {
      type: Number,
    },

    // ============================================
    // MARKING
    // ============================================

    marks: {
      type: Number,
      required: true,
      default: 1,
      min: 0,
    },

    negativeMarks: {
      type: Number,
      default: 0,
      min: 0,
    },

    // ============================================
    // PYQ / EXAM INFORMATION
    // ============================================

    isPYQ: {
      type: Boolean,
      default: false,
      index: true,
    },

    examName: {
      type: String,
      trim: true,
      default: "GATE",
    },

    year: {
      type: Number,
      min: 1980,
      max: 2100,
      index: true,
    },

    session: {
      type: String,
      trim: true,
    },

    questionImages: { type: [require("./questionImageSchema")], default: [] },
    sourceId: { type: String },
    sourceQuestionNumber: Number,
    sourceAnswer: String,
    reviewReasons: { type: [String], default: [] },

    sourceName: {
      type: String,
      trim: true,
    },

    sourcePage: {
      type: Number,
      min: 1,
    },

    sourceMarker: {
      type: String,
      trim: true,
    },

    // ============================================
    // CLASSIFICATION
    // ============================================

    difficulty: {
      type: String,
      enum: ["easy", "medium", "hard"],
      default: "medium",
      index: true,
    },

    category: {
      type: String,
      trim: true,
      index: true,
    },

    topic: {
      type: String,
      trim: true,
      index: true,
    },

    tags: {
      type: [String],
      default: [],
    },

    // ============================================
    // SOLUTION
    // ============================================

    explanation: {
      type: String,
      trim: true,
    },

    solutionType: {
      type: String,
      enum: ["manual", "ai", "none"],
      default: "none",
    },

    aiSolutionGenerated: {
      type: Boolean,
      default: false,
    },

    aiSolutionModel: {
      type: String,
      trim: true,
    },

    // ============================================
    // STATUS
    // ============================================

    isActive: {
      type: Boolean,
      default: true,
      index: true,
    },

    isPublished: {
      type: Boolean,
      default: true,
      index: true,
    },

    requiresReview: {
      type: Boolean,
      default: false,
      index: true,
    },
  },
  {
    timestamps: true,
  }
);

// ============================================
// INDEXES FOR SCALE
// ============================================

// Fast subject/chapter browsing
questionSchema.index({
  branch: 1,
  subject: 1,
  chapter: 1,
});

// Fast PYQ year filtering
questionSchema.index({
  subject: 1,
  year: 1,
  isPYQ: 1,
});

// Fast topic/difficulty filtering
questionSchema.index({
  subject: 1,
  chapter: 1,
  topic: 1,
  difficulty: 1,
});

// Prevent duplicate question numbers inside same test
questionSchema.index(
  {
    test: 1,
    questionNumber: 1,
  },
  {
    name: "question_test_number_unique",
    unique: true,
    partialFilterExpression: {
      test: {
        $type: "objectId",
      },
    },
  }
);

questionSchema.index({ branch: 1, sourceId: 1 }, {
  unique: true,
  partialFilterExpression: { sourceId: { $type: "string" } },
});

const Question = mongoose.model(
  "Question",
  questionSchema
);

module.exports = Question;
