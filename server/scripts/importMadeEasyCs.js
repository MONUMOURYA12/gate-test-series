const fs = require('node:fs/promises');
const path = require('node:path');
const crypto = require('node:crypto');
const mongoose = require('mongoose');
const Branch = require('../models/Branch');
const Subject = require('../models/Subject');
const Chapter = require('../models/Chapter');
const Test = require('../models/Test');
const Question = require('../models/Question');
const QuestionMedia = require('../models/QuestionMedia');
const { mediaKey, validWebp } = require('../services/questionMedia');
const { bookletTitle } = require('./refreshBookletLabels');

const serverDir = path.resolve(__dirname, '..');
const hash = data => crypto.createHash('sha256').update(data).digest('hex');

function questionDocument(q, payload, ids, questionNumber) {
  return {
    ...ids, questionNumber, questionText: q.questionText, questionImages: q.questionImages,
    sourceId: q.sourceId, sourceName: payload.sourceName, sourcePage: q.sourcePage,
    sourceQuestionNumber: q.sourceQuestionNumber, sourceMarker: q.sourceMarker,
    sourceAnswer: q.sourceAnswer, reviewReasons: q.reviewReasons,
    questionType: q.questionType, options: q.options, correctAnswer: q.correctAnswer,
    marks: q.marks, negativeMarks: 0, isPYQ: true, examName: 'GATE', year: q.year,
    difficulty: 'medium', category: payload.subjectName, topic: payload.chapterName,
    tags: ['booklet-import', payload.slug, payload.sourceEdition, 'GATE', 'MADE EASY'],
    explanation: q.explanation || '', solutionType: q.solutionType || 'none',
    isActive: true, isPublished: !q.requiresReview, requiresReview: q.requiresReview,
  };
}

async function validatePayload(payload, mediaDir) {
  if (payload.version !== 1 || payload.branchCode !== 'CS' || !payload.sourceEdition ||
      !payload.subjectName || !payload.chapterName || !/^[a-z0-9-]+$/.test(payload.slug) ||
      !/^[a-f0-9]{64}$/.test(payload.sourceSha256) || !Array.isArray(payload.questions) || !payload.questions.length) {
    throw new Error('Invalid CS source manifest.');
  }
  const seen = new Set();
  const numbers = new Set();
  const media = new Map();
  const id = new mongoose.Types.ObjectId();
  for (const q of payload.questions) {
    if (!/^[a-f0-9]{24}$/.test(q.sourceId) || seen.has(q.sourceId) || numbers.has(q.sourceQuestionNumber)) {
      throw new Error('Duplicate or invalid source identity.');
    }
    seen.add(q.sourceId);
    numbers.add(q.sourceQuestionNumber);
    if (q.chapter !== payload.chapterName || !Number.isInteger(q.sourceQuestionNumber) || q.sourceQuestionNumber < 1 ||
        !Number.isInteger(q.sourcePage) || q.sourcePage < 1 || q.sourcePage > payload.sourcePages) {
      throw new Error('Invalid chapter or source location.');
    }
    if (typeof q.requiresReview !== 'boolean' || !Array.isArray(q.reviewReasons) ||
        q.requiresReview !== (q.reviewReasons.length > 0)) throw new Error('Review reasons must block publishing.');
    if (q.questionType !== 'mcq' || !Array.isArray(q.options) || q.options.length < 2 || q.options.length > 5 ||
        ![1, 2].includes(q.marks)) throw new Error('Unsupported question format.');
    if (!q.requiresReview && (!Number.isInteger(q.correctAnswer) || q.correctAnswer < 0 || q.correctAnswer >= q.options.length ||
        q.sourceAnswer !== String.fromCharCode(97 + q.correctAnswer))) throw new Error('Invalid or conflicting MCQ answer.');
    if (!q.questionImages?.length) throw new Error('Missing question artwork.');
    for (const img of q.questionImages) {
      const key = mediaKey(img.url);
      if (!key || !key.startsWith(`${payload.slug}/${q.sourceId}-`)) throw new Error('Unexpected question media path.');
      const data = await fs.readFile(path.join(mediaDir, key));
      if (!validWebp(data)) throw new Error(`Invalid WebP: ${key}`);
      media.set(key, { data, sha256: hash(data), bytes: data.length });
    }
    await new Question(questionDocument(q, payload, { branch: id, subject: id, chapter: id, test: id }, q.sourceQuestionNumber)).validate();
  }
  return media;
}

async function run() {
  require('dotenv').config({ path: process.env.DOTENV_CONFIG_PATH || path.join(serverDir, '.env'), quiet: true });
  const inputFlag = process.argv.indexOf('--input');
  const input = path.resolve(inputFlag >= 0 ? process.argv[inputFlag + 1] : path.join(serverDir, 'data/made-easy-cs/questions.json'));
  const payload = JSON.parse(await fs.readFile(input, 'utf8'));
  const mediaDir = path.resolve(process.env.QUESTION_MEDIA_DIR || path.join(serverDir, 'data/question-media'));
  const media = await validatePayload(payload, mediaDir);
  const report = {
    checkedAt: new Date().toISOString(), mode: process.argv.includes('--apply') ? 'apply' : 'dry-run',
    sourceSha256: payload.sourceSha256, sourcePages: payload.sourcePages,
    branch: payload.branchCode, subject: payload.subjectName, chapter: payload.chapterName,
    sourceQuestions: payload.questions.length, ready: payload.questions.filter(q => !q.requiresReview).length,
    review: payload.questions.filter(q => q.requiresReview).map(q => ({ question: q.sourceLabel, reasons: q.reviewReasons })),
    images: media.size, mediaBytes: [...media.values()].reduce((sum, file) => sum + file.bytes, 0),
    coverage: payload.coverage,
  };
  if (process.argv.includes('--validate-only')) { console.log(JSON.stringify(report, null, 2)); return; }
  if (!process.env.MONGO_URI) throw new Error('MONGO_URI is required.');
  await mongoose.connect(process.env.MONGO_URI, { serverSelectionTimeoutMS: 10000, connectTimeoutMS: 10000, autoCreate: false, autoIndex: false });
  const branch = await Branch.findOne({ code: payload.branchCode, isActive: true }).lean();
  if (!branch) throw new Error('Active CS branch not found.');
  const subject = await Subject.findOne({ branch: branch._id, name: payload.subjectName, isActive: true }).lean();
  if (!subject) throw new Error('Active Theory of Computation subject not found.');
  let chapter = await Chapter.findOne({ subject: subject._id, name: payload.chapterName }).lean();
  if (chapter && !chapter.isActive) throw new Error('The existing chapter is inactive.');
  const existingQuestions = await Question.find({ branch: branch._id, sourceId: { $in: payload.questions.map(q => q.sourceId) } }).lean();
  const existingMedia = new Map((await QuestionMedia.find({ _id: { $in: [...media.keys()] } }).select('sha256').lean()).map(m => [m._id, m.sha256]));
  // Never replace artwork already serving an existing source identity.
  for (const [key, file] of media) {
    if (existingMedia.has(key) && existingMedia.get(key) !== file.sha256) throw new Error('Existing artwork differs. Review before replacing it.');
  }
  const plans = [];
  for (let offset = 0; offset < payload.questions.length; offset += 20) {
    const batch = payload.questions.slice(offset, offset + 20);
    const set = String(offset / 20 + 1).padStart(2, '0');
    const sourceBatchId = `${branch._id}:${payload.slug}:${set}`;
    const existing = await Test.findOne({ sourceBatchId }).lean();
    if (existing && (!chapter || String(existing.chapter) !== String(chapter._id))) throw new Error('Existing source test belongs to another chapter.');
    const title = existing?.title || bookletTitle(set);
    if (!existing && chapter && await Test.exists({ chapter: chapter._id, title })) throw new Error(`Test title conflict: ${title}`);
    for (const q of batch) {
      const stored = existingQuestions.find(item => item.sourceId === q.sourceId);
      if (stored && (!existing || String(stored.test) !== String(existing._id))) throw new Error('Existing source question is assigned to another test.');
    }
    plans.push({ batch, sourceBatchId, title, existing });
  }
  report.existingQuestions = existingQuestions.length;
  report.newQuestions = payload.questions.length - existingQuestions.length;
  report.imagesToUpload = [...media.keys()].filter(key => !existingMedia.has(key)).length;
  report.tests = plans.map(p => ({ title: p.title, sourceQuestions: p.batch.length,
    publishableQuestions: p.batch.filter(q => !q.requiresReview).length, existing: !!p.existing }));
  console.log(JSON.stringify(report, null, 2));
  if (!process.argv.includes('--apply')) return;
  await fs.writeFile(path.join(path.dirname(input), `before-import-${Date.now()}.json`), JSON.stringify({
    branch: branch._id, subject: subject._id, chapter, questions: existingQuestions,
    tests: plans.map(p => p.existing).filter(Boolean),
  }, null, 2), { flag: 'wx' });
  // Store and verify persistent media before exposing any new question/test.
  const mediaOps = [...media].filter(([key]) => !existingMedia.has(key)).map(([key, file]) => ({ updateOne: {
    filter: { _id: key }, update: { $setOnInsert: file }, upsert: true,
  } }));
  if (mediaOps.length) await QuestionMedia.bulkWrite(mediaOps, { ordered: true });
  for (const [key, file] of media) {
    const stored = await QuestionMedia.findById(key).select('+data').lean();
    const data = stored && (Buffer.isBuffer(stored.data) ? stored.data : Buffer.from(stored.data.buffer));
    if (!data || hash(data) !== file.sha256) throw new Error('Persistent media verification failed.');
  }
  if (!chapter) chapter = await Chapter.findOneAndUpdate({ subject: subject._id, name: payload.chapterName }, {
    $setOnInsert: { description: `${payload.chapterName} chapter-wise GATE practice.`, order: 1, isActive: true },
  }, { upsert: true, returnDocument: 'after' }).lean();
  let inserted = 0;
  const verifiedTests = [];
  for (const plan of plans) {
    let test = plan.existing;
    if (!test) test = (await Test.create({ sourceBatchId: plan.sourceBatchId, title: plan.title, chapter: chapter._id,
      description: 'Chapter-wise GATE PYQs with original diagrams and printed marks. No negative marking.',
      duration: Math.max(10, plan.batch.filter(q => !q.requiresReview).length * 2),
      negativeMarking: false, isPublished: false,
    })).toObject();
    const operations = plan.batch.map((q, index) => ({ updateOne: {
      filter: { branch: branch._id, sourceId: q.sourceId },
      update: { $setOnInsert: questionDocument(q, payload, { branch: branch._id, subject: subject._id, chapter: chapter._id, test: test._id }, index + 1) },
      upsert: true,
    } }));
    const result = await Question.bulkWrite(operations, { ordered: true });
    inserted += result.upsertedCount;
    const stored = await Question.find({ test: test._id }).lean();
    if (stored.length !== plan.batch.length) throw new Error('Imported test question count mismatch.');
    for (const q of plan.batch) {
      const row = stored.find(item => item.sourceId === q.sourceId);
      if (!row) throw new Error('Imported source question missing.');
      if (q.requiresReview && (row.isPublished || !row.requiresReview)) throw new Error('A question requiring review became published.');
      if (!existingQuestions.some(item => item.sourceId === q.sourceId) && (
        row.correctAnswer !== q.correctAnswer || row.marks !== q.marks || row.year !== q.year ||
        row.questionImages.length !== q.questionImages.length)) throw new Error('Inserted question verification failed.');
    }
    const visible = stored.filter(q => q.isActive && q.isPublished && !q.requiresReview);
    const totals = { totalQuestions: visible.length, totalMarks: visible.reduce((sum, q) => sum + q.marks, 0) };
    // A new/import-interrupted test can be published only after full verification.
    // Leave an existing administrator-unpublished test unchanged on repeat runs.
    if (!plan.existing || !existingQuestions.some(q => String(q.test) === String(test._id))) totals.isPublished = visible.length > 0;
    await Test.updateOne({ _id: test._id }, { $set: totals });
    const verified = await Test.findById(test._id).lean();
    if (verified.totalQuestions !== totals.totalQuestions || verified.totalMarks !== totals.totalMarks) throw new Error('Test totals verification failed.');
    verifiedTests.push({ id: String(test._id), title: verified.title, published: verified.isPublished, ...totals });
  }
  report.inserted = inserted;
  report.tests = verifiedTests;
  report.publishedQuestions = verifiedTests.filter(t => t.published).reduce((sum, t) => sum + t.totalQuestions, 0);
  report.mediaVerified = media.size;
  await fs.writeFile(path.join(path.dirname(input), 'import-report.json'), JSON.stringify(report, null, 2));
  console.log(JSON.stringify({ inserted, publishedQuestions: report.publishedQuestions, review: report.review.length,
    mediaVerified: report.mediaVerified, tests: verifiedTests }, null, 2));
}

if (require.main === module) {
  const deadline = setTimeout(() => { console.error('Import timed out; re-run dry-run to inspect its status.'); process.exit(1); }, 180000);
  run().catch(error => {
    console.error(error.name === 'Error' && !/mongodb|password|credential/i.test(error.message)
      ? error.message : `CS import failed (${error.name}). Check connectivity and validation.`);
    process.exitCode = 1;
  }).finally(async () => { await mongoose.disconnect(); clearTimeout(deadline); });
}

module.exports = { questionDocument, validatePayload };
