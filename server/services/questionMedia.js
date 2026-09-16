const fs = require("node:fs/promises");
const path = require("node:path");
const QuestionMedia = require("../models/QuestionMedia");

const MEDIA_URL = /^\/question-media\/([a-z0-9-]+\/[a-f0-9-]+\.webp)$/;
const MAX_IMAGE_BYTES = 8 * 1024 * 1024;

function mediaKey(url) {
  return typeof url === "string" ? MEDIA_URL.exec(url)?.[1] || null : null;
}

function validWebp(data) {
  return Buffer.isBuffer(data) && data.length >= 12 && data.length <= MAX_IMAGE_BYTES &&
    data.toString("ascii", 0, 4) === "RIFF" && data.toString("ascii", 8, 12) === "WEBP";
}

async function readQuestionImage(url, mediaDir = process.env.QUESTION_MEDIA_DIR || path.join(__dirname, "../data/question-media")) {
  const key = mediaKey(url);
  if (!key) return null;
  const filename = path.resolve(mediaDir, key);
  try {
    const stat = await fs.stat(filename);
    if (!stat.isFile() || stat.size > MAX_IMAGE_BYTES) throw new Error("Invalid question image.");
    const data = await fs.readFile(filename);
    if (!validWebp(data)) throw new Error("Invalid question image.");
    return data;
  } catch (error) {
    if (error.code !== "ENOENT") throw error;
  }
  const stored = await QuestionMedia.findById(key).select("+data");
  if (!stored) return null;
  const data = Buffer.from(stored.data);
  if (!validWebp(data)) throw new Error("Invalid stored question image.");
  return data;
}

function serveQuestionImage(mediaDir) {
  return async (req, res, next) => {
    if (!["GET", "HEAD"].includes(req.method)) return next();
    try {
      const data = await readQuestionImage(`/question-media${req.path}`, mediaDir);
      if (!data) return next();
      res.set("Cache-Control", "private, max-age=86400");
      res.type("image/webp").send(data);
    } catch (error) { next(error); }
  };
}

module.exports = { mediaKey, validWebp, readQuestionImage, serveQuestionImage, MAX_IMAGE_BYTES };
