const mongoose = require("mongoose");

const schema = new mongoose.Schema({
  _id: { type: String, required: true },
  data: { type: Buffer, required: true, select: false },
  sha256: { type: String, required: true },
  bytes: { type: Number, required: true },
}, { timestamps: true, collection: "question_media", autoCreate: false, autoIndex: false });

module.exports = mongoose.model("QuestionMedia", schema);
