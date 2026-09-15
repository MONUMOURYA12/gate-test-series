const mongoose = require("mongoose");

const userSchema = new mongoose.Schema(
  {
    // ============================================
    // BASIC USER INFORMATION
    // ============================================

    name: {
      type: String,
      required: true,
      trim: true,
      minlength: 2,
      maxlength: 100,
    },

    email: {
      type: String,
      required: true,
      unique: true,
      lowercase: true,
      trim: true,
      maxlength: 254,
      match: /^[^\s@]+@[^\s@]+\.[^\s@]+$/,
      index: true,
    },

    mobileNumber: {
      type: String,
      trim: true,
      maxlength: 16,
    },

    collegeName: {
      type: String,
      trim: true,
      maxlength: 150,
    },

    passingYear: {
      type: Number,
      min: 1950,
      max: 2100,
    },

    branch: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Branch",
      index: true,
    },

    password: {
      type: String,
      required: true,
      minlength: 6,
      select: false,
    },

    tokenVersion: {
      type: Number,
      default: 0,
      min: 0,
      select: false,
    },

    // ============================================
    // USER ROLE
    // ============================================

    role: {
      type: String,
      enum: ["student", "admin"],
      default: "student",
      index: true,
    },

    // ============================================
    // ACCOUNT STATUS
    // ============================================

    isActive: {
      type: Boolean,
      default: true,
      index: true,
    },

    isEmailVerified: {
      type: Boolean,
      default: false,
    },

    // ============================================
    // FUTURE SUBSCRIPTION SYSTEM
    // ============================================

    subscription: {
      plan: {
        type: String,
        enum: ["free", "premium"],
        default: "free",
      },

      status: {
        type: String,
        enum: [
          "active",
          "inactive",
          "cancelled",
          "expired",
        ],
        default: "inactive",
      },

      startDate: {
        type: Date,
      },

      endDate: {
        type: Date,
      },

      paymentProvider: {
        type: String,
        trim: true,
      },

      paymentCustomerId: {
        type: String,
        trim: true,
      },

      subscriptionId: {
        type: String,
        trim: true,
      },
    },
  },
  {
    timestamps: true,
  }
);

const User = mongoose.model("User", userSchema);

module.exports = User;
