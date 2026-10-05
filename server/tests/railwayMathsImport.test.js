const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs/promises');
const crypto = require('node:crypto');
const { validatePayload, questionDocument } = require('../scripts/importRailwayMaths');

function fixture() {
  const counts = [109,79,79,27,26,90,38,31,5,72,54,36,45,28,4,5,62,40,120,51,50,12,61,5,64,112,55,8,36];
  const chapters = counts.map((totalQuestions, i) => ({ order: i+1, name: `Chapter ${i+1}`, totalQuestions }));
  return { version: 1, slug: 'railway-maths-2026', sourceName: 'Synthetic import validation fixture',
    sourceSha256: '31109702672d5ad8a88bd70e7c734ba66243fd95303e6d9b83d70d0b39eca37a', sourcePages: 248,
    subjectName: 'Mathematics', chapters, questions: chapters.flatMap(chapter => Array.from({ length: chapter.totalQuestions }, (_, i) => {
      const sourceId = crypto.createHash('sha256').update(`railway-maths-2026:${chapter.order}:${i+1}`).digest('hex').slice(0,24);
      return { sourceId, chapter: chapter.name, chapterOrder: chapter.order, sourceQuestionNumber: i+1, sourcePage: 12,
        questionText: 'Synthetic maths question', questionType: 'mcq', options: ['A','B','C','D'],
        correctAnswer: 1, sourceAnswer: 'b', marks: 1, requiresReview: false, reviewReasons: [],
        questionImages: [{ url: `/question-media/railway-maths-2026/${sourceId}-1.webp`, width: 600, height: 300 }] };
    })) };
}

test('railway import validates coverage, media and answers before any database operation', async t => {
  const bytes = Buffer.from('RIFFxxxxWEBPfake');
  t.mock.method(fs, 'readFile', async () => bytes);
  const payload = fixture();
  assert.equal((await validatePayload(payload, '/test-media')).size, 1404);
  payload.questions[0].correctAnswer = 3;
  await assert.rejects(validatePayload(payload, '/test-media'), /answer key/);
  payload.questions[0].correctAnswer = 1;
  payload.questions[1].sourceId = payload.questions[0].sourceId;
  await assert.rejects(validatePayload(payload, '/test-media'), /source identity/);
});

test('railway import rejects incorrect source, unreviewed flags and unsafe artwork paths', async t => {
  t.mock.method(fs, 'readFile', async () => { throw new Error('Unsafe media must not be read.'); });
  const payload = fixture();
  payload.sourceSha256 = '0'.repeat(64);
  await assert.rejects(validatePayload(payload, '/test-media'), /source manifest/);
  payload.sourceSha256 = fixture().sourceSha256;
  payload.questions[0].reviewReasons = ['Unclear source'];
  await assert.rejects(validatePayload(payload, '/test-media'), /review status/);
  payload.questions[0].reviewReasons = [];
  payload.questions[0].questionImages[0].url = '/question-media/../../secret';
  await assert.rejects(validatePayload(payload, '/test-media'), /media location/);
});

test('the three exam catalogues reuse source media but preserve their branch identity and Railway attribution', () => {
  const payload = fixture();
  const q = payload.questions[0];
  const ssc = questionDocument(q, payload, { branch: 'ssc' }, 1);
  const banking = questionDocument(q, payload, { branch: 'banking' }, 1);
  assert.notEqual(ssc.branch, banking.branch);
  assert.equal(ssc.questionImages[0].url, banking.questionImages[0].url);
  assert.equal(ssc.examName, 'Railways');
  assert.equal(ssc.negativeMarks, 0);
  const held = questionDocument({ ...q, requiresReview: true, reviewReasons: ['Unclear source'] }, payload, {}, 1);
  assert.equal(held.isPublished, false);
});
