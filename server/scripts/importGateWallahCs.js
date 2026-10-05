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
const { mediaKey, validWebp, MAX_IMAGE_BYTES } = require('../services/questionMedia');

const serverDir = path.resolve(__dirname, '..');
const hash = data => crypto.createHash('sha256').update(data).digest('hex');
const sameId = (left, right) => String(left) === String(right);
const validSlug = value => typeof value === 'string' && /^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(value);
const nonempty = value => typeof value === 'string' && value.trim().length > 0;
const chunks = (items, size) => Array.from({ length: Math.ceil(items.length / size) }, (_, i) => items.slice(i * size, (i + 1) * size));
const checkpointCollection = () => mongoose.connection.db.collection('gate_wallah_import_checkpoints');

function canonicalSubject(name) {
  const aliases = {
    dbms: 'Databases', 'database management system': 'Databases', 'database management systems': 'Databases',
    coa: 'Computer Organization', 'computer organization and architecture': 'Computer Organization',
    'computer organisation and architecture': 'Computer Organization', 'computer organisation': 'Computer Organization',
    os: 'Operating Systems', 'operating system': 'Operating Systems',
    'discrete math': 'Discrete Mathematics', 'discrete maths': 'Discrete Mathematics',
    'discrete mathematical structures': 'Discrete Mathematics',
  };
  const trimmed = typeof name === 'string' ? name.trim() : '';
  return aliases[trimmed.toLowerCase()] || trimmed;
}

function sourceChoices(value) {
  if (typeof value !== 'string') return null;
  const normalized = value.toLowerCase().replace(/\band\b/g, ',').replace(/[\s(),/&]/g, '');
  return /^[a-e]+$/.test(normalized) ? [...normalized].map(letter => letter.charCodeAt(0) - 97).sort((a, b) => a - b) : null;
}

function sourceRange(value) {
  if (typeof value !== 'string') return null;
  const normalized = value.trim().replace(/^[\[(]\s*|\s*[\])]$/g, '').replace(/−/g, '-');
  const numeric = '[+-]?(?:\\d+(?:\\.\\d*)?|\\.\\d+)(?:[eE][+-]?\\d+)?';
  const match = new RegExp(`^(${numeric})(?:\\s*(?:to|–|—|\\.\\.|,|:|-)\\s*(${numeric}))?$`, 'i').exec(normalized);
  if (!match) return null;
  const range = [Number(match[1]), Number(match[2] ?? match[1])];
  return range.every(Number.isFinite) && range[0] <= range[1] ? range : null;
}

function validateQuestion(q, payload) {
  const fail = reason => { throw new Error(`${q.sourceId || 'Unknown source'}: ${reason}`); };
  if (!/^[a-f0-9]{24}$/.test(q.sourceId) || !Number.isInteger(q.sourceQuestionNumber) || q.sourceQuestionNumber < 1 ||
      !Number.isInteger(q.sourcePage) || q.sourcePage < 1 || q.sourcePage > payload.sourcePages) fail('Invalid source identity or location.');
  if (!nonempty(q.questionText)) fail('Missing question text.');
  if (typeof q.requiresReview !== 'boolean' || !Array.isArray(q.reviewReasons) ||
      !q.reviewReasons.every(nonempty) || q.requiresReview !== (q.reviewReasons.length > 0)) fail('Review reasons must block publishing.');
  if (!['mcq', 'msq', 'nat'].includes(q.questionType) || ![1, 2].includes(q.marks)) fail('Unsupported question type or marks.');
  if (!Array.isArray(q.options) || !q.options.every(nonempty)) fail('Options must be strings.');
  const expectedPenalty = q.questionType === 'mcq' ? q.marks / 3 : 0;
  if (q.negativeMarks != null && (typeof q.negativeMarks !== 'number' || !Number.isFinite(q.negativeMarks) ||
      Math.abs(q.negativeMarks - expectedPenalty) > 1e-8)) fail('Invalid GATE negative marking.');
  if (q.year != null && (!Number.isInteger(q.year) || q.year < 1980 || q.year > 2100)) fail('Invalid exam year.');
  if (!Array.isArray(q.questionImages)) fail('Question images must be an array.');
  if (q.questionType === 'nat' && q.options.length) fail('NAT questions cannot have options.');
  // A draft may have an incomplete answer/options/year, but it can never be exposed to students.
  if (q.requiresReview) return;
  if (!Number.isInteger(q.year)) fail('Publishable questions need an exam year.');
  const validOption = value => Number.isInteger(value) && value >= 0 && value < q.options.length;
  if (['mcq', 'msq'].includes(q.questionType)) {
    if (q.options.length < 2 || q.options.length > 5) fail('Invalid choice count.');
    if (q.natAnswerMin != null || q.natAnswerMax != null) fail('Choice questions cannot have a NAT range.');
    const answer = q.questionType === 'mcq' ? [q.correctAnswer] : q.correctAnswer;
    const printed = sourceChoices(q.sourceAnswer);
    if (!Array.isArray(answer) || !answer.length || !answer.every(validOption) || new Set(answer).size !== answer.length ||
        !printed || JSON.stringify([...answer].sort((a, b) => a - b)) !== JSON.stringify(printed)) fail('Invalid or conflicting choice answer.');
  } else {
    const hasRange = q.natAnswerMin != null || q.natAnswerMax != null;
    const range = hasRange ? [q.natAnswerMin, q.natAnswerMax] : [q.correctAnswer, q.correctAnswer];
    const printed = sourceRange(q.sourceAnswer);
    if (!range.every(value => typeof value === 'number' && Number.isFinite(value)) || range[0] > range[1] ||
        !printed || range.some((value, i) => Math.abs(value - printed[i]) > 1e-9) ||
        (q.correctAnswer != null && (typeof q.correctAnswer !== 'number' || !Number.isFinite(q.correctAnswer) ||
          q.correctAnswer < range[0] || q.correctAnswer > range[1]))) fail('Invalid or conflicting NAT answer.');
  }
}

function questionDocument(q, payload, book, chapter, ids, questionNumber) {
  return {
    ...ids, questionNumber, questionText: q.questionText, questionImages: q.questionImages,
    sourceId: q.sourceId, sourceName: payload.sourceName, sourcePage: q.sourcePage,
    sourceQuestionNumber: q.sourceQuestionNumber, sourceMarker: q.sourceMarker, sourceAnswer: q.sourceAnswer,
    reviewReasons: q.reviewReasons, questionType: q.questionType, options: q.options,
    correctAnswer: q.correctAnswer, natAnswerMin: q.natAnswerMin, natAnswerMax: q.natAnswerMax,
    marks: q.marks, negativeMarks: q.negativeMarks ?? (q.questionType === 'mcq' ? q.marks / 3 : 0),
    isPYQ: true, examName: 'GATE', year: q.year, session: q.session, difficulty: 'medium',
    category: canonicalSubject(book.subjectName), topic: chapter.name,
    tags: ['booklet-import', 'gate-wallah-cs', payload.sourceEdition, book.slug, chapter.slug, 'GATE'],
    explanation: q.explanation || '', solutionType: q.explanation ? 'manual' : 'none',
    isActive: true, isPublished: !q.requiresReview, requiresReview: q.requiresReview,
  };
}

async function validatePayload(payload, mediaDir) {
  if (payload.version !== 1 || payload.branchCode !== 'CS' || !validSlug(payload.sourceEdition) ||
      !nonempty(payload.sourceName) || !/^[a-f0-9]{64}$/.test(payload.sourceSha256) ||
      !Number.isInteger(payload.sourcePages) || payload.sourcePages < 1 || !Array.isArray(payload.books) || !payload.books.length) {
    throw new Error('Invalid Gate Wallah CS source manifest.');
  }
  const media = new Map();
  const identities = new Set();
  const subjects = new Set();
  const slugs = new Set();
  const id = new mongoose.Types.ObjectId();
  for (const book of payload.books) {
    const subject = canonicalSubject(book.subjectName);
    if (!nonempty(subject) || subjects.has(subject.toLowerCase()) || !validSlug(book.slug) || slugs.has(book.slug) ||
        !Array.isArray(book.chapters) || !book.chapters.length) throw new Error('Invalid or duplicate subject.');
    subjects.add(subject.toLowerCase());
    slugs.add(book.slug);
    const chapterNames = new Set();
    for (const chapter of book.chapters) {
      if (!nonempty(chapter.name) || chapterNames.has(chapter.name.trim().toLowerCase()) || !validSlug(chapter.slug) ||
          slugs.has(chapter.slug) || !Number.isInteger(chapter.order) || chapter.order < 0 ||
          !Array.isArray(chapter.questions) || !chapter.questions.length) throw new Error('Invalid or duplicate chapter.');
      chapterNames.add(chapter.name.trim().toLowerCase());
      slugs.add(chapter.slug);
      const numbers = new Set();
      for (const q of chapter.questions) {
        validateQuestion(q, payload);
        if (identities.has(q.sourceId) || numbers.has(q.sourceQuestionNumber)) throw new Error('Duplicate source identity or chapter question number.');
        identities.add(q.sourceId);
        numbers.add(q.sourceQuestionNumber);
        for (const img of q.questionImages) {
          const key = mediaKey(img.url);
          if (!key || !new RegExp(`^(?:${book.slug}|${chapter.slug})/${q.sourceId}-[1-9][0-9]*\\.webp$`).test(key) ||
              media.has(key) || !Number.isInteger(img.width) || !Number.isInteger(img.height) || img.width < 1 || img.height < 1) {
            throw new Error('Unexpected or duplicate question media path/dimensions.');
          }
          const filename = path.resolve(mediaDir, key);
          const stat = await fs.stat(filename);
          if (!stat.isFile() || stat.size > MAX_IMAGE_BYTES) throw new Error(`Invalid WebP size: ${key}`);
          const data = await fs.readFile(filename);
          if (!validWebp(data)) throw new Error(`Invalid WebP: ${key}`);
          // Keep hashes and paths, not the entire book's image buffers in memory.
          media.set(key, { filename, sha256: hash(data), bytes: data.length });
        }
        await new Question(questionDocument(q, payload, book, chapter,
          { branch: id, subject: id, chapter: id, test: id }, q.sourceQuestionNumber)).validate();
      }
    }
  }
  return media;
}

function makeBatches(payload) {
  return payload.books.flatMap(book => book.chapters.flatMap(chapter => {
    const questions = [...chapter.questions].sort((a, b) => a.sourceQuestionNumber - b.sourceQuestionNumber);
    return chunks(questions, 20).map((batch, index) => {
      const set = String(index + 1).padStart(2, '0');
      const years = batch.map(q => q.year).filter(Number.isInteger);
      const yearLabel = years.length ? `${Math.min(...years)}${Math.min(...years) === Math.max(...years) ? '' : `–${Math.max(...years)}`}` : 'Chapter Practice';
      const sourceBatchId = `${payload.branchCode}:${payload.sourceEdition}:${book.slug}:${chapter.slug}:${set}`;
      // The publisher suffix avoids collisions with previously imported booklets.
      const title = `GATE PYQs ${yearLabel} - Set ${set} (Gate Wallah)`;
      const fingerprint = hash(JSON.stringify({ sourceSha256: payload.sourceSha256, subject: canonicalSubject(book.subjectName),
        chapter: chapter.name, questions: batch }));
      return { book, chapter, batch, sourceBatchId, title, fingerprint };
    });
  }));
}

async function findBatched(Model, field, values, additional = {}, projection) {
  const rows = [];
  for (const batch of chunks(values, 250)) {
    let query = Model.find({ ...additional, [field]: { $in: batch } });
    if (projection) query = query.select(projection);
    rows.push(...await query.lean());
  }
  return rows;
}

function uniqueMap(rows, key, label) {
  const result = new Map();
  for (const row of rows) {
    const value = key(row);
    if (result.has(value)) throw new Error(`Duplicate existing ${label}.`);
    result.set(value, row);
  }
  return result;
}

async function buildPlan(payload, media) {
  const branch = await Branch.findOne({ code: 'CS' }).lean();
  if (branch && !branch.isActive) throw new Error('The CS branch is inactive.');
  const subjects = branch ? await Subject.find({ branch: branch._id,
    name: { $in: payload.books.map(book => canonicalSubject(book.subjectName)) } }).lean() : [];
  const subjectMap = uniqueMap(subjects, row => row.name, 'subject');
  if (subjects.some(row => !row.isActive)) throw new Error('A required CS subject is inactive.');
  const chapterNames = payload.books.flatMap(book => book.chapters.map(chapter => chapter.name));
  const chapters = subjects.length ? await Chapter.find({ subject: { $in: subjects.map(row => row._id) }, name: { $in: chapterNames } }).lean() : [];
  const chapterMap = uniqueMap(chapters, row => `${row.subject}:${row.name}`, 'chapter');
  const batches = makeBatches(payload);
  const tests = await findBatched(Test, 'sourceBatchId', batches.map(batch => batch.sourceBatchId));
  const testMap = uniqueMap(tests, row => row.sourceBatchId, 'source test');
  const sources = batches.flatMap(batch => batch.batch.map(q => q.sourceId));
  const questions = branch ? await findBatched(Question, 'sourceId', sources, { branch: branch._id }) : [];
  const questionMap = uniqueMap(questions, row => row.sourceId, 'source question');
  const existingMedia = new Map((await findBatched(QuestionMedia, '_id', [...media.keys()], {}, 'sha256 bytes')).map(row => [row._id, row]));
  for (const [key, file] of media) {
    const existing = existingMedia.get(key);
    if (existing && (existing.sha256 !== file.sha256 || existing.bytes !== file.bytes)) throw new Error(`Existing artwork differs: ${key}`);
  }
  const states = new Map();
  for (const batch of chunks(batches.map(item => item.sourceBatchId), 250)) {
    for (const state of await checkpointCollection().find({ _id: { $in: batch }, kind: 'batch' }).toArray()) states.set(state._id, state);
  }
  for (const plan of batches) {
    plan.subject = subjectMap.get(canonicalSubject(plan.book.subjectName));
    plan.existingChapter = plan.subject && chapterMap.get(`${plan.subject._id}:${plan.chapter.name}`);
    if (plan.existingChapter && !plan.existingChapter.isActive) throw new Error(`Existing chapter is inactive: ${plan.chapter.name}`);
    plan.existingTest = testMap.get(plan.sourceBatchId);
    plan.state = states.get(plan.sourceBatchId);
    if (plan.state && (plan.state.fingerprint !== plan.fingerprint || !['pending', 'complete'].includes(plan.state.state))) {
      throw new Error(`Import checkpoint differs from the manifest: ${plan.chapter.name}`);
    }
    if (plan.existingTest && (!plan.existingChapter || !sameId(plan.existingTest.chapter, plan.existingChapter._id))) {
      throw new Error('Existing source test has conflicting hierarchy.');
    }
    if (plan.state && plan.existingTest && !sameId(plan.state.testId, plan.existingTest._id)) throw new Error('Checkpoint test identity changed.');
    for (const [index, q] of plan.batch.entries()) {
      const stored = questionMap.get(q.sourceId);
      if (stored && (!plan.existingTest || !sameId(stored.test, plan.existingTest._id) ||
          !sameId(stored.branch, branch._id) || !sameId(stored.subject, plan.subject._id) ||
          !sameId(stored.chapter, plan.existingChapter._id) || stored.questionNumber !== index + 1)) {
        throw new Error('Existing source question has conflicting hierarchy or numbering.');
      }
      if (!stored && plan.state?.state === 'complete') throw new Error('A completed import question was removed. Review before restoring it.');
    }
  }
  // Check title collisions in one scoped query per group, including sources outside this import.
  const titleFilters = batches.filter(plan => plan.existingChapter).map(plan => ({ chapter: plan.existingChapter._id, title: plan.title }));
  for (const filters of chunks(titleFilters, 100)) {
    const conflicts = await Test.find({ $or: filters }).select('chapter title sourceBatchId').lean();
    for (const row of conflicts) {
      if (!batches.some(plan => plan.sourceBatchId === row.sourceBatchId && plan.existingChapter && sameId(plan.existingChapter._id, row.chapter))) {
        throw new Error(`Existing test title conflict: ${row.title}`);
      }
    }
  }
  // A changed source set must never silently add/move/remove existing test questions.
  const allTestQuestions = await findBatched(Question, 'test', tests.map(test => test._id), {}, 'sourceId test');
  const expectedTestSources = new Map(batches.filter(plan => plan.existingTest).map(plan =>
    [String(plan.existingTest._id), new Set(plan.batch.map(q => q.sourceId))]));
  for (const row of allTestQuestions) {
    if (!expectedTestSources.get(String(row.test))?.has(row.sourceId)) throw new Error('Existing test contains questions outside this manifest.');
  }
  return { branch, subjects, chapters, tests, questions, questionMap, existingMedia, batches, states };
}

function baseReport(payload, media, mode) {
  const batches = makeBatches(payload);
  const questions = batches.flatMap(plan => plan.batch);
  return {
    checkedAt: new Date().toISOString(), mode, sourceEdition: payload.sourceEdition, sourceSha256: payload.sourceSha256,
    sourcePages: payload.sourcePages, branch: 'CS', subjects: payload.books.length,
    chapters: payload.books.reduce((sum, book) => sum + book.chapters.length, 0), sourceQuestions: questions.length,
    ready: questions.filter(q => !q.requiresReview).length,
    review: questions.filter(q => q.requiresReview).map(q => ({ sourceId: q.sourceId, sourcePage: q.sourcePage,
      sourceQuestionNumber: q.sourceQuestionNumber, reasons: q.reviewReasons })),
    images: media.size, mediaBytes: [...media.values()].reduce((sum, file) => sum + file.bytes, 0),
    tests: batches.map(plan => ({ subject: canonicalSubject(plan.book.subjectName), chapter: plan.chapter.name,
      title: plan.title, sourceQuestions: plan.batch.length, ready: plan.batch.filter(q => !q.requiresReview).length })),
  };
}

async function persistMedia(media, existingMedia, progress = () => {}) {
  let verified = 0;
  // Small batches cap memory and BSON response size even for unusually large diagrams.
  for (const batch of chunks([...media], 12)) {
    const operations = [];
    for (const [key, file] of batch) {
      if (existingMedia.has(key)) continue;
      const data = await fs.readFile(file.filename);
      if (data.length !== file.bytes || hash(data) !== file.sha256 || !validWebp(data)) throw new Error(`Artwork changed during import: ${key}`);
      operations.push({ updateOne: { filter: { _id: key }, update: { $setOnInsert: { data, sha256: file.sha256, bytes: file.bytes } },
        upsert: true, timestamps: false } });
    }
    if (operations.length) await QuestionMedia.bulkWrite(operations, { ordered: true });
    const storedRows = await QuestionMedia.find({ _id: { $in: batch.map(([key]) => key) } }).select('+data').lean();
    const stored = new Map(storedRows.map(row => [row._id, row]));
    for (const [key, file] of batch) {
      const row = stored.get(key);
      const data = row && (Buffer.isBuffer(row.data) ? row.data : Buffer.from(row.data.buffer));
      if (!data || !validWebp(data) || data.length !== file.bytes || row.bytes !== file.bytes || row.sha256 !== file.sha256 ||
          hash(data) !== file.sha256) throw new Error(`Persistent media verification failed: ${key}`);
    }
    verified += batch.length;
    if (verified % 120 === 0 || verified === media.size) progress(`Verified persistent artwork: ${verified}/${media.size}`);
  }
  return verified;
}

function importedFields(row, template) {
  return Object.fromEntries(Object.keys(template).filter(key => !['_id', 'createdAt', 'updatedAt', '__v'].includes(key))
    .map(key => [key, row[key]]));
}

function unchangedImportedRow(row, template) {
  return JSON.stringify(importedFields(row, template)) === JSON.stringify(importedFields(template, template));
}

function verifyBatchRows(plan, rows, ids) {
  if (rows.length !== plan.batch.length) throw new Error('Imported test question count mismatch.');
  const sourceRows = uniqueMap(rows, row => row.sourceId, 'imported question');
  for (const [index, q] of plan.batch.entries()) {
    const row = sourceRows.get(q.sourceId);
    if (!row || !sameId(row.branch, ids.branch) || !sameId(row.subject, ids.subject) ||
        !sameId(row.chapter, ids.chapter) || !sameId(row.test, ids.test) || row.questionNumber !== index + 1) {
      throw new Error('Imported question hierarchy verification failed.');
    }
    if (row.isPublished && (row.requiresReview || row.reviewReasons?.length)) throw new Error('A question requiring review became published.');
    if (row.isActive && row.isPublished) validateQuestion(row, { sourcePages: Number.MAX_SAFE_INTEGER });
  }
  return sourceRows;
}

async function applyPlan(payload, media, dbPlan, report, outputDir, progress = console.log) {
  const collection = checkpointCollection();
  const leaseId = `lease:${payload.branchCode}:${payload.sourceEdition}`;
  const owner = crypto.randomUUID();
  const now = new Date();
  try {
    await collection.findOneAndUpdate({ _id: leaseId, $or: [{ expiresAt: { $lte: now } }, { owner }] },
      { $set: { kind: 'lease', owner, expiresAt: new Date(now.getTime() + 60 * 60 * 1000) } }, { upsert: true });
  } catch (error) {
    if (error.code === 11000) throw new Error('Another import is running for this edition.');
    throw error;
  }
  try {
    // Refresh all reads under the lease. Dry-run snapshots may have become stale.
    dbPlan = await buildPlan(payload, media);
    const stamp = `${Date.now()}-${owner.slice(0, 8)}`;
    const backupPath = path.join(outputDir, `before-import-${stamp}.json`);
    await fs.writeFile(backupPath, JSON.stringify({ sourceEdition: payload.sourceEdition, sourceSha256: payload.sourceSha256,
      branch: dbPlan.branch, subjects: dbPlan.subjects, chapters: dbPlan.chapters, tests: dbPlan.tests,
      questions: dbPlan.questions, checkpoints: [...dbPlan.states.values()], media: [...dbPlan.existingMedia.values()] }, null, 2), { flag: 'wx' });
    report.backup = backupPath;
    report.mediaVerified = await persistMedia(media, dbPlan.existingMedia, progress);
    const branch = dbPlan.branch || (await Branch.create({ code: 'CS', name: 'Computer Science and Information Technology',
      description: 'GATE CS preparation path', isActive: true })).toObject();
    const subjectMap = new Map(dbPlan.subjects.map(subject => [subject.name, subject]));
    const chapterMap = new Map(dbPlan.chapters.map(chapter => [`${chapter.subject}:${chapter.name}`, chapter]));
    let inserted = 0;
    const verifiedTests = [];
    for (const plan of dbPlan.batches) {
      const refreshed = await collection.updateOne({ _id: leaseId, owner }, { $set: { expiresAt: new Date(Date.now() + 60 * 60 * 1000) } });
      if (refreshed.matchedCount !== 1) throw new Error('Import lease was lost.');
      const subjectName = canonicalSubject(plan.book.subjectName);
      let subject = subjectMap.get(subjectName);
      if (!subject) {
        subject = await Subject.findOneAndUpdate({ branch: branch._id, name: subjectName }, { $setOnInsert: {
          description: `${subjectName} chapter-wise GATE CS practice.`, isActive: true,
        } }, { upsert: true, returnDocument: 'after', runValidators: true }).lean();
        if (!subject.isActive || !sameId(subject.branch, branch._id)) throw new Error('Subject hierarchy changed.');
        subjectMap.set(subjectName, subject);
      }
      const chapterKey = `${subject._id}:${plan.chapter.name}`;
      let chapter = chapterMap.get(chapterKey);
      if (!chapter) {
        chapter = await Chapter.findOneAndUpdate({ subject: subject._id, name: plan.chapter.name }, { $setOnInsert: {
          description: `${plan.chapter.name} chapter-wise GATE practice.`, order: plan.chapter.order, isActive: true,
        } }, { upsert: true, returnDocument: 'after', runValidators: true }).lean();
        if (!chapter.isActive || !sameId(chapter.subject, subject._id)) throw new Error('Chapter hierarchy changed.');
        chapterMap.set(chapterKey, chapter);
      }
      const testId = plan.existingTest?._id || plan.state?.testId || new mongoose.Types.ObjectId();
      const initialState = { kind: 'batch', fingerprint: plan.fingerprint, state: 'pending', testId,
        sourceEdition: payload.sourceEdition, createdAt: new Date(), publishTest: !plan.existingTest,
        managedSourceIds: plan.batch.filter(q => !dbPlan.questionMap.has(q.sourceId)).map(q => q.sourceId) };
      await collection.updateOne({ _id: plan.sourceBatchId }, { $setOnInsert: initialState }, { upsert: true });
      const state = await collection.findOne({ _id: plan.sourceBatchId });
      if (state.fingerprint !== plan.fingerprint || !sameId(state.testId, testId)) throw new Error('Import checkpoint changed.');
      const duration = Math.max(10, plan.batch.filter(q => !q.requiresReview).length * 2);
      const test = await Test.findOneAndUpdate({ sourceBatchId: plan.sourceBatchId }, { $setOnInsert: {
        _id: testId, title: plan.title, chapter: chapter._id, duration, negativeMarking: true, isPublished: false,
        description: 'Chapter-wise GATE CS/IT previous-year questions. MCQs use GATE negative marking; MSQ and NAT questions have no negative marking.',
      } }, { upsert: true, returnDocument: 'after', runValidators: true, timestamps: false }).lean();
      if (!sameId(test._id, testId) || !sameId(test.chapter, chapter._id)) throw new Error('Test hierarchy changed.');
      const ids = { branch: branch._id, subject: subject._id, chapter: chapter._id, test: test._id };
      const initialDocs = new Map(plan.batch.map((q, index) => {
        const doc = new Question({ ...questionDocument(q, payload, plan.book, plan.chapter, ids, index + 1), isPublished: false }).toObject();
        return [q.sourceId, doc];
      }));
      const missing = plan.batch.filter(q => !dbPlan.questionMap.has(q.sourceId));
      if (missing.length) {
        const result = await Question.bulkWrite(missing.map(q => ({ updateOne: {
          filter: { branch: branch._id, sourceId: q.sourceId }, update: { $setOnInsert: initialDocs.get(q.sourceId) },
          upsert: true, timestamps: false,
        } })), { ordered: true });
        inserted += result.upsertedCount;
      }
      let rows = await Question.find({ test: test._id }).lean();
      const sourceRows = verifyBatchRows(plan, rows, ids);
      for (const q of missing) {
        if (!unchangedImportedRow(sourceRows.get(q.sourceId), initialDocs.get(q.sourceId))) throw new Error('Inserted question content verification failed.');
      }
      if (state.state !== 'complete') {
        const managed = new Set(state.managedSourceIds);
        const publicationOps = plan.batch.filter(q => !q.requiresReview && managed.has(q.sourceId) &&
          unchangedImportedRow(sourceRows.get(q.sourceId), initialDocs.get(q.sourceId))).map(q => {
          const row = sourceRows.get(q.sourceId);
          return { updateOne: { filter: { _id: row._id, isPublished: false, requiresReview: false,
            updatedAt: row.updatedAt ?? { $exists: false } }, update: { $set: { isPublished: true } } } };
        });
        if (publicationOps.length) await Question.bulkWrite(publicationOps, { ordered: true });
        rows = await Question.find({ test: test._id }).lean();
        verifyBatchRows(plan, rows, ids);
      }
      const visible = rows.filter(q => q.isActive && q.isPublished && !q.requiresReview);
      const totals = { totalQuestions: visible.length, totalMarks: visible.reduce((sum, q) => sum + q.marks, 0) };
      if (state.state !== 'complete' && state.publishTest) totals.isPublished = visible.length > 0;
      await Test.updateOne({ _id: test._id }, { $set: totals });
      const verified = await Test.findById(test._id).lean();
      if (!sameId(verified.chapter, chapter._id) || verified.totalQuestions !== totals.totalQuestions ||
          verified.totalMarks !== totals.totalMarks) throw new Error('Final test totals verification failed.');
      await collection.updateOne({ _id: plan.sourceBatchId, fingerprint: plan.fingerprint },
        { $set: { state: 'complete', completedAt: new Date() } });
      verifiedTests.push({ id: String(test._id), subject: subjectName, chapter: chapter.name, title: verified.title,
        sourceQuestions: rows.length, totalQuestions: verified.totalQuestions, totalMarks: verified.totalMarks,
        published: verified.isPublished, reviewQuestions: rows.filter(q => q.requiresReview).length });
      if (verifiedTests.length % 10 === 0 || verifiedTests.length === dbPlan.batches.length) {
        progress(`Verified question sets: ${verifiedTests.length}/${dbPlan.batches.length}`);
      }
    }
    report.inserted = inserted;
    report.tests = verifiedTests;
    report.storedQuestions = verifiedTests.reduce((sum, test) => sum + test.sourceQuestions, 0);
    report.publishedQuestions = verifiedTests.filter(test => test.published).reduce((sum, test) => sum + test.totalQuestions, 0);
    report.storedReviewQuestions = verifiedTests.reduce((sum, test) => sum + test.reviewQuestions, 0);
    if (report.storedQuestions !== report.sourceQuestions) throw new Error('Final source question count mismatch.');
    const storedSourceCount = await Question.countDocuments({ branch: branch._id,
      sourceId: { $in: dbPlan.batches.flatMap(plan => plan.batch.map(q => q.sourceId)) } });
    if (storedSourceCount !== report.sourceQuestions) throw new Error('Final persisted source count mismatch.');
    await fs.writeFile(path.join(outputDir, 'import-report.json'), JSON.stringify(report, null, 2));
    return report;
  } finally {
    await collection.deleteOne({ _id: leaseId, owner });
  }
}

function cliOptions(argv) {
  const allowed = new Set(['--apply', '--validate-only', '--input', '--media-dir', '--output-dir', '--branch']);
  const result = { apply: false, validateOnly: false };
  for (let i = 0; i < argv.length; i += 1) {
    const flag = argv[i];
    if (!allowed.has(flag)) throw new Error(`Unknown argument: ${flag}`);
    if (flag === '--apply') result.apply = true;
    else if (flag === '--validate-only') result.validateOnly = true;
    else {
      if (!argv[i + 1] || argv[i + 1].startsWith('--')) throw new Error(`Missing value for ${flag}`);
      result[flag.slice(2)] = argv[++i];
    }
  }
  if (result.apply && result.validateOnly) throw new Error('--apply and --validate-only cannot be combined.');
  if (result.branch && result.branch !== 'CS') throw new Error('This importer only supports the existing CS branch.');
  return result;
}

function printSummary(report) {
  console.log(JSON.stringify({ mode: report.mode, sourceQuestions: report.sourceQuestions, ready: report.ready,
    review: report.review.length, subjects: report.subjects, chapters: report.chapters, sets: report.tests.length,
    images: report.images, existingQuestions: report.existingQuestions, newQuestions: report.newQuestions,
    inserted: report.inserted, publishedQuestions: report.publishedQuestions, mediaVerified: report.mediaVerified,
    report: report.reportPath }, null, 2));
}

async function run(argv = process.argv.slice(2)) {
  require('dotenv').config({ path: process.env.DOTENV_CONFIG_PATH || path.join(serverDir, '.env'), quiet: true });
  const options = cliOptions(argv);
  const input = path.resolve(options.input || path.join(serverDir, 'data/gate-wallah-cs/questions.json'));
  const mediaDir = path.resolve(options['media-dir'] || process.env.QUESTION_MEDIA_DIR || path.join(serverDir, 'data/question-media'));
  const outputDir = path.resolve(options['output-dir'] || path.join(serverDir, 'data/gate-wallah-cs'));
  const payload = JSON.parse(await fs.readFile(input, 'utf8'));
  const media = await validatePayload(payload, mediaDir);
  const mode = options.validateOnly ? 'validate-only' : options.apply ? 'apply' : 'dry-run';
  const report = baseReport(payload, media, mode);
  await fs.mkdir(outputDir, { recursive: true });
  report.reportPath = path.join(outputDir, options.validateOnly ? 'validation-report.json' : options.apply ? 'import-report.json' : 'dry-run-report.json');
  if (!options.validateOnly) {
    if (!process.env.MONGO_URI) throw new Error('MONGO_URI is required.');
    await mongoose.connect(process.env.MONGO_URI, { serverSelectionTimeoutMS: 15000, connectTimeoutMS: 15000,
      socketTimeoutMS: 120000, autoCreate: false, autoIndex: false });
    const plan = await buildPlan(payload, media);
    report.existingQuestions = plan.questions.length;
    report.newQuestions = report.sourceQuestions - plan.questions.length;
    report.imagesToUpload = media.size - plan.existingMedia.size;
    if (options.apply) await applyPlan(payload, media, plan, report, outputDir);
  }
  await fs.writeFile(report.reportPath, JSON.stringify(report, null, 2));
  printSummary(report);
  return report;
}

if (require.main === module) {
  run().catch(error => {
    console.error(error.name === 'Error' && !/mongodb|password|credential|mongodb\+srv/i.test(error.message)
      ? error.message : `Gate Wallah CS import failed (${error.name}). Check connectivity and validation.`);
    process.exitCode = 1;
  }).finally(() => mongoose.disconnect());
}

module.exports = { canonicalSubject, sourceChoices, sourceRange, validateQuestion, questionDocument,
  validatePayload, makeBatches, cliOptions, verifyBatchRows, unchangedImportedRow, baseReport, run };
