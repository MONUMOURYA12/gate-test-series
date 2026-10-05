const fs = require("node:fs/promises");
const path = require("node:path");
const mongoose = require("mongoose");
const Test = require("../models/Test");
const TestAttempt = require("../models/TestAttempt");

const OLD_DESCRIPTION = "Subject practice: 1 mark per question, no negative marking. Source: TARGATE EDUCATION.";
const DESCRIPTION = "Subject practice: 1 mark per question, no negative marking.";
const bookletTitle = set => `GATE PYQs - Set ${set}`;

function labelChanges(test) {
  // Only change the importer-owned defaults; keep custom admin edits intact.
  if (!test.sourceBatchId) return {};
  const changes = {};
  const match = /^GATE PYQs - TARGATE Set (\d+)$/.exec(test.title);
  if (match) changes.title = bookletTitle(match[1]);
  if (test.description === OLD_DESCRIPTION) changes.description = DESCRIPTION;
  return changes;
}

async function main() {
  require("dotenv").config({ path: process.env.DOTENV_CONFIG_PATH || path.join(__dirname, "../.env"), quiet: true });
  if (!process.env.MONGO_URI) throw new Error("MONGO_URI is required.");
  const apply = process.argv.includes("--apply");
  await mongoose.connect(process.env.MONGO_URI, { serverSelectionTimeoutMS: 15000, autoIndex: false, autoCreate: false });
  try {
    const tests = await Test.find().select("title description sourceBatchId chapter").lean();
    const imported = tests.filter(test => test.sourceBatchId);
    const pending = imported.map(test => ({ test, changes: labelChanges(test) }))
      .filter(item => Object.keys(item.changes).length);
    for (const { test, changes } of pending) {
      if (changes.title && tests.some(other => String(other._id) !== String(test._id) &&
          String(other.chapter) === String(test.chapter) && other.title === changes.title)) {
        throw new Error("A replacement title already exists in this chapter. Review test names before applying.");
      }
    }
    const attempts = await TestAttempt.find({ test: { $in: imported.map(test => test._id) }, title: /^GATE PYQs - TARGATE Set \d+$/ })
      .select("title test").lean();
    console.log(JSON.stringify({ mode: apply ? "apply" : "dry-run", tests: pending.length, attemptTitles: attempts.length }));
    if (!apply || (!pending.length && !attempts.length)) return;
    const backup = path.join(__dirname, "../data/branding-audit", `labels-before-${Date.now()}.json`);
    await fs.mkdir(path.dirname(backup), { recursive: true });
    await fs.writeFile(backup, JSON.stringify({ tests: pending, attempts }, null, 2), { flag: "wx" });
    let updatedTests = 0;
    for (const { test, changes } of pending) {
      const result = await Test.updateOne({ _id: test._id, title: test.title, description: test.description }, { $set: changes });
      if (result.matchedCount !== 1) throw new Error("A test changed during cleanup. Preview again before retrying.");
      updatedTests += result.modifiedCount;
    }
    let updatedAttempts = 0;
    for (const attempt of attempts) {
      const title = attempt.title.replace(" - TARGATE Set ", " - Set ");
      const result = await TestAttempt.updateOne({ _id: attempt._id, title: attempt.title }, { $set: { title } });
      updatedAttempts += result.modifiedCount;
    }
    console.log(JSON.stringify({ updatedTests, updatedAttempts, backup }));
  } finally {
    await mongoose.disconnect();
  }
}

if (require.main === module) main().catch(error => {
  console.error(error.name === "Error" && !/mongodb/i.test(error.message) ? error.message : "Label cleanup failed. Check database connectivity.");
  process.exitCode = 1;
});

module.exports = { labelChanges, bookletTitle, DESCRIPTION };
