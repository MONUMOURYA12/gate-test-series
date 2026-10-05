const mongoose = require("mongoose");

const testSchema = new mongoose.Schema(
  {
    title: {
      type: String,
      required: true,
      trim: true,
    },

    description: {
      type: String,
      trim: true,
    },
    sourceBatchId: { type: String },

    chapter: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Chapter",
      required: true,
      index: true,
    },

    duration: {
      type: Number,
      required: true,
      min: 1,
    },

    totalQuestions: {
      type: Number,
      default: 0,
      min: 0,
    },

    totalMarks: {
      type: Number,
      default: 0,
      min: 0,
    },

    negativeMarking: {
      type: Boolean,
      default: true,
    },

    isPublished: {
      type: Boolean,
      default: false,
    },
  },
  {
    timestamps: true,
  }
);

// Prevent duplicate test titles inside the same chapter
testSchema.index(
  { chapter: 1, title: 1 },
  { unique: true }
);

const Test = mongoose.model("Test", testSchema);

module.exports = Test;
