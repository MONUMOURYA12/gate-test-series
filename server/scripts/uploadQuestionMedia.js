const fs = require("node:fs/promises");
const path = require("node:path");
const crypto = require("node:crypto");
const mongoose = require("mongoose");
const QuestionMedia = require("../models/QuestionMedia");
const { mediaKey, validWebp } = require("../services/questionMedia");

async function main() {
  require("dotenv").config({ path: process.env.DOTENV_CONFIG_PATH || path.join(__dirname, "../.env"), quiet: true });
  const apply = process.argv.includes("--apply");
  const mediaDir = path.resolve(process.env.QUESTION_MEDIA_DIR || path.join(__dirname, "../data/question-media"));
  if (!process.env.MONGO_URI) throw new Error("MONGO_URI is required.");
  await mongoose.connect(process.env.MONGO_URI, { serverSelectionTimeoutMS: 15000 });
  try {
    const urls = await mongoose.connection.db.collection("questions").distinct("questionImages.url");
    const stored = new Map((await QuestionMedia.find().select("sha256").lean()).map(row => [row._id, row.sha256]));
    const pending = [];
    let bytes = 0;
    // Validate the complete set before writing anything. Never delete existing media.
    for (const url of urls) {
      const key = mediaKey(url);
      if (!key) throw new Error("The database contains an invalid media path.");
      const data = await fs.readFile(path.join(mediaDir, key));
      if (!validWebp(data)) throw new Error(`Invalid WebP image: ${key}`);
      const sha256 = crypto.createHash("sha256").update(data).digest("hex");
      bytes += data.length;
      if (stored.get(key) !== sha256) pending.push({ key, sha256, bytes: data.length });
    }
    console.log(JSON.stringify({ mode: apply ? "apply" : "dry-run", referencedImages: urls.length, totalBytes: bytes,
      imagesToUpload: pending.length, uploadBytes: pending.reduce((sum, file) => sum + file.bytes, 0) }));
    if (!apply) return;
    for (let offset = 0; offset < pending.length; offset += 100) {
      const batch = [];
      for (const file of pending.slice(offset, offset + 100)) {
        const data = await fs.readFile(path.join(mediaDir, file.key));
        if (crypto.createHash("sha256").update(data).digest("hex") !== file.sha256) throw new Error("An image changed during upload. Run again.");
        batch.push({ updateOne: { filter: { _id: file.key }, update: { $set: { data, sha256: file.sha256, bytes: data.length } }, upsert: true } });
      }
      await QuestionMedia.bulkWrite(batch, { ordered: true });
      console.log(`Uploaded ${Math.min(offset + 100, pending.length)}/${pending.length}`);
    }
    console.log("Question image upload complete.");
  } finally { await mongoose.disconnect(); }
}

main().catch(error => {
  console.error(error.name === "Error" && !/mongodb/i.test(error.message) ? error.message : "Media upload failed. Check database connectivity and storage capacity.");
  process.exitCode = 1;
});
