const mongoose = require("mongoose");

module.exports = new mongoose.Schema({
  url: { type: String, required: true, match: /^\/question-media\/[a-z0-9-]+\/[a-f0-9-]+\.webp$/ },
  width: { type: Number, required: true, min: 1 },
  height: { type: Number, required: true, min: 1 },
}, { _id: false });
