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

const SOURCE_SHA = '31109702672d5ad8a88bd70e7c734ba66243fd95303e6d9b83d70d0b39eca37a';
const SLUG = 'railway-maths-2026';
const TRACKS = [
  { code: 'SSC', name: 'SSC' }, { code: 'RAILWAYS', name: 'Railways' }, { code: 'BANKING', name: 'Banking' },
];
const serverDir = path.resolve(__dirname, '..');
const hash = value => crypto.createHash('sha256').update(value).digest('hex');
const batches = (rows, size) => Array.from({ length: Math.ceil(rows.length / size) }, (_, i) => rows.slice(i * size, (i + 1) * size));

function questionDocument(q, payload, ids, questionNumber) {
  return { ...ids, questionNumber, questionText: q.questionText, questionImages: q.questionImages,
    sourceId: q.sourceId, sourceName: payload.sourceName, sourcePage: q.sourcePage,
    sourceMarker: q.sourceMarker, sourceQuestionNumber: q.sourceQuestionNumber,
    sourceAnswer: q.sourceAnswer, questionType: 'mcq', options: q.options, correctAnswer: q.correctAnswer,
    marks: 1, negativeMarks: 0, isPYQ: true, examName: 'Railways', difficulty: 'medium',
    category: 'Mathematics', topic: q.chapter, tags: ['booklet-import', SLUG, 'bilingual', 'maths'],
    explanation: '', solutionType: 'none', isActive: true, isPublished: !q.requiresReview,
    requiresReview: q.requiresReview, reviewReasons: q.reviewReasons,
  };
}

async function validatePayload(payload, mediaDir) {
  if (payload.version !== 1 || payload.slug !== SLUG || payload.sourceSha256 !== SOURCE_SHA ||
      payload.sourcePages !== 248 || payload.subjectName !== 'Mathematics' || !payload.sourceName ||
      payload.chapters?.length !== 29 || payload.questions?.length !== 1404) throw new Error('Unexpected Railway Maths source manifest.');
  const seen = new Set();
  const media = new Map();
  const id = new mongoose.Types.ObjectId();
  for (const [index, chapter] of payload.chapters.entries()) {
    if (chapter.order !== index + 1 || !chapter.name || !Number.isInteger(chapter.totalQuestions)) throw new Error('Invalid chapter metadata.');
    const questions = payload.questions.filter(q => q.chapterOrder === chapter.order);
    if (questions.length !== chapter.totalQuestions) throw new Error('Chapter question count mismatch.');
    for (const [number, q] of questions.entries()) {
      const expectedId = hash(`${SLUG}:${chapter.order}:${number + 1}`).slice(0, 24);
      if (q.sourceId !== expectedId || seen.has(q.sourceId) || q.sourceQuestionNumber !== number + 1 ||
          q.chapter !== chapter.name || q.questionType !== 'mcq' || q.options?.length !== 4 || q.marks !== 1 ||
          !Number.isInteger(q.sourcePage) || q.sourcePage < 12 || q.sourcePage > 244) throw new Error('Invalid source identity or question format.');
      seen.add(q.sourceId);
      if (typeof q.requiresReview !== 'boolean' || !Array.isArray(q.reviewReasons) || q.requiresReview !== (q.reviewReasons.length > 0)) throw new Error('Invalid review status.');
      if (!Number.isInteger(q.correctAnswer) || q.correctAnswer < 0 || q.correctAnswer > 3 ||
          q.sourceAnswer !== String.fromCharCode(97 + q.correctAnswer)) throw new Error('Conflicting printed answer key.');
      if (!q.questionImages?.length) throw new Error('Missing question image.');
      for (const image of q.questionImages) {
        const key = mediaKey(image.url);
        if (!key || !key.startsWith(`${SLUG}/${q.sourceId}-`)) throw new Error('Unexpected media location.');
        const data = await fs.readFile(path.join(mediaDir, key));
        if (!validWebp(data)) throw new Error('Invalid question image data.');
        media.set(key, { data, sha256: hash(data), bytes: data.length });
      }
      await new Question(questionDocument(q, payload, { branch: id, subject: id, chapter: id, test: id }, number + 1)).validate();
    }
  }
  if (seen.size !== payload.questions.length) throw new Error('Unassigned source questions.');
  return media;
}

async function inspectTrack(track, payload) {
  const branch = await Branch.findOne({ code: track.code }).lean();
  if (branch && !branch.isActive) throw new Error(`Existing ${track.code} branch is inactive.`);
  const subjects = branch ? await Subject.find({ branch: branch._id, name: 'Mathematics' }).lean() : [];
  if (subjects.length > 1 || (subjects[0] && !subjects[0].isActive)) throw new Error(`Review existing ${track.code} Mathematics subjects.`);
  const subject = subjects[0];
  const existingChapters = subject ? await Chapter.find({ subject: subject._id }).lean() : [];
  const existingQuestions = branch ? await Question.find({ branch: branch._id, sourceId: { $in: payload.questions.map(q => q.sourceId) } }).lean() : [];
  const plans = [];
  for (const metadata of payload.chapters) {
    const chapter = existingChapters.find(c => c.name === metadata.name);
    if (chapter && !chapter.isActive) throw new Error(`Existing ${metadata.name} chapter is inactive.`);
    const rows = payload.questions.filter(q => q.chapterOrder === metadata.order);
    for (const [index, batch] of batches(rows, 20).entries()) {
      const sourceBatchId = `${SLUG}:${track.code}:${metadata.order}:${index + 1}`;
      const matches = await Test.find({ sourceBatchId }).lean();
      if (matches.length > 1) throw new Error('Duplicate source tests need review.');
      const existing = matches[0];
      if (existing && (!chapter || String(existing.chapter) !== String(chapter._id))) throw new Error('Source test belongs to another chapter.');
      const title = existing?.title || `Railway Maths PYQs - Set ${String(index + 1).padStart(2, '0')}`;
      if (!existing && chapter && await Test.exists({ chapter: chapter._id, title })) throw new Error('Existing test title conflict.');
      for (const q of batch) {
        const stored = existingQuestions.find(row => row.sourceId === q.sourceId);
        if (stored && (!existing || String(stored.test) !== String(existing._id))) throw new Error('Existing question belongs to another test.');
      }
      plans.push({ metadata, chapter, batch, sourceBatchId, existing, title });
    }
  }
  return { track, branch, subject, existingQuestions, plans };
}

async function run() {
  require('dotenv').config({ path: process.env.DOTENV_CONFIG_PATH || path.join(serverDir, '.env'), quiet: true });
  const flag = process.argv.indexOf('--input');
  const input = path.resolve(flag >= 0 ? process.argv[flag + 1] : path.join(serverDir, 'data/railway-maths/questions.json'));
  const payload = JSON.parse(await fs.readFile(input, 'utf8'));
  const mediaDir = path.resolve(process.env.QUESTION_MEDIA_DIR || path.join(serverDir, 'data/question-media'));
  const media = await validatePayload(payload, mediaDir);
  const report = { checkedAt: new Date().toISOString(), sourceSha256: SOURCE_SHA, sourceQuestions: payload.questions.length,
    chapters: payload.chapters.length, reviewQuestions: payload.questions.filter(q => q.requiresReview).length,
    mediaFiles: media.size, mediaBytes: [...media.values()].reduce((n, m) => n + m.bytes, 0),
    mode: process.argv.includes('--apply') ? 'apply' : 'dry-run', tracks: [] };
  if (process.argv.includes('--validate-only')) { console.log(JSON.stringify(report, null, 2)); return; }
  if (!process.env.MONGO_URI) throw new Error('MONGO_URI is required.');
  await mongoose.connect(process.env.MONGO_URI, { serverSelectionTimeoutMS: 15000, connectTimeoutMS: 15000, autoCreate: false, autoIndex: false });
  const existingMedia = new Map((await QuestionMedia.find({ _id: { $in: [...media.keys()] } }).select('sha256').lean()).map(m => [m._id, m.sha256]));
  for (const [key, file] of media) {
    if (existingMedia.has(key) && existingMedia.get(key) !== file.sha256) throw new Error('Existing source artwork differs; review before replacing.');
  }
  const inspections = [];
  for (const track of TRACKS) {
    const inspection = await inspectTrack(track, payload);
    inspections.push(inspection);
    report.tracks.push({ code: track.code, existingQuestions: inspection.existingQuestions.length,
      newQuestions: payload.questions.length - inspection.existingQuestions.length, tests: inspection.plans.length });
  }
  const stats = await mongoose.connection.db.stats({ scale: 1024 * 1024 });
  report.database = { dataSizeMB: stats.dataSize, storageSizeMB: stats.storageSize, indexSizeMB: stats.indexSize };
  report.imagesToUpload = media.size - existingMedia.size;
  console.log(JSON.stringify(report, null, 2));
  if (!process.argv.includes('--apply')) return;
  await fs.writeFile(path.join(path.dirname(input), `before-import-${Date.now()}.json`), JSON.stringify(inspections, null, 2), { flag: 'wx' });
  const newMedia = [...media].filter(([key]) => !existingMedia.has(key));
  for (const batch of batches(newMedia, 30)) {
    await QuestionMedia.bulkWrite(batch.map(([key, file]) => ({ updateOne: { filter: { _id: key }, update: { $setOnInsert: file }, upsert: true } })), { ordered: true });
  }
  for (const keys of batches([...media.keys()], 40)) {
    const stored = await QuestionMedia.find({ _id: { $in: keys } }).select('+data').lean();
    if (stored.length !== keys.length) throw new Error('Persistent media count mismatch.');
    for (const item of stored) {
      const data = Buffer.isBuffer(item.data) ? item.data : Buffer.from(item.data.buffer);
      if (hash(data) !== media.get(item._id).sha256) throw new Error('Persistent media checksum mismatch.');
    }
  }
  for (const inspection of inspections) {
    const { track } = inspection;
    const branch = inspection.branch || (await Branch.create({ ...track, description: `${track.name} exam preparation with chapter-wise bilingual maths practice.`, isActive: true })).toObject();
    const subject = inspection.subject || (await Subject.create({ branch: branch._id, name: 'Mathematics', code: 'MATHS',
      description: 'Bilingual Railway maths PYQs for SSC, Railways and Banking practice.', isActive: true })).toObject();
    const chapters = new Map();
    let inserted = 0;
    const verifiedTests = [];
    for (const plan of inspection.plans) {
      if (!chapters.has(plan.metadata.order)) {
        chapters.set(plan.metadata.order, plan.chapter || (await Chapter.create({ subject: subject._id, name: plan.metadata.name,
          order: plan.metadata.order, description: 'Chapter-wise maths previous-year questions in Hindi and English.', isActive: true })).toObject());
      }
      const chapter = chapters.get(plan.metadata.order);
      const test = plan.existing || (await Test.create({ sourceBatchId: plan.sourceBatchId, chapter: chapter._id, title: plan.title,
        description: 'Bilingual Railway maths PYQs. One mark per question; no negative marking in practice.',
        duration: Math.max(10, plan.batch.length * 2), negativeMarking: false, isPublished: false })).toObject();
      const result = await Question.bulkWrite(plan.batch.map((q, index) => ({ updateOne: {
        filter: { branch: branch._id, sourceId: q.sourceId }, update: { $setOnInsert: questionDocument(q, payload,
          { branch: branch._id, subject: subject._id, chapter: chapter._id, test: test._id }, index + 1) }, upsert: true,
      } })), { ordered: true });
      inserted += result.upsertedCount;
      const stored = await Question.find({ test: test._id }).lean();
      if (stored.length !== plan.batch.length) throw new Error('Imported question count mismatch.');
      for (const q of plan.batch) {
        const row = stored.find(item => item.sourceId === q.sourceId);
        if (!row || String(row.branch) !== String(branch._id) || String(row.chapter) !== String(chapter._id)) throw new Error('Imported question hierarchy mismatch.');
        if (q.requiresReview && (row.isPublished || !row.requiresReview)) throw new Error('Review-only question became published.');
        if (!inspection.existingQuestions.some(item => item.sourceId === q.sourceId) && (row.correctAnswer !== q.correctAnswer || row.questionImages[0]?.url !== q.questionImages[0].url)) throw new Error('Imported answer/artwork mismatch.');
      }
      const visible = stored.filter(q => q.isActive && q.isPublished && !q.requiresReview);
      const totals = { totalQuestions: visible.length, totalMarks: visible.length };
      // Preserve administrator publication choices on a repeat import.
      if (!plan.existing || !inspection.existingQuestions.some(q => String(q.test) === String(test._id))) totals.isPublished = visible.length > 0;
      await Test.updateOne({ _id: test._id }, { $set: totals });
      verifiedTests.push({ id: String(test._id), chapter: chapter.name, title: test.title, ...totals });
    }
    const summary = report.tracks.find(t => t.code === track.code);
    Object.assign(summary, { inserted, branchId: String(branch._id), chapterCount: chapters.size, verifiedTests });
    console.log(JSON.stringify({ track: track.code, inserted, chapters: chapters.size, tests: verifiedTests.length }));
  }
  await fs.writeFile(path.join(path.dirname(input), 'import-report.json'), JSON.stringify(report, null, 2));
  console.log('Railway Maths import and persistent media verification completed.');
}

if (require.main === module) {
  const deadline = setTimeout(() => { console.error('Import timed out; inspect with a dry-run before retrying.'); process.exit(1); }, 600000);
  run().catch(error => {
    console.error(error.name === 'Error' && !/mongodb|password|credential/i.test(error.message) ? error.message : `Railway Maths import failed (${error.name}).`);
    process.exitCode = 1;
  }).finally(async () => { await mongoose.disconnect(); clearTimeout(deadline); });
}

module.exports = { questionDocument, validatePayload, TRACKS };
