const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs/promises');
const os = require('node:os');
const path = require('node:path');
const { questionDocument, validatePayload } = require('../scripts/importMadeEasyCs');

async function fixture(t) {
  const root = await fs.mkdtemp(path.join(os.tmpdir(), 'made-easy-cs-test-'));
  const slug = 'made-easy-cs-test';
  const sourceId = 'a'.repeat(24);
  const dir = path.join(root, slug);
  await fs.mkdir(dir);
  const file = path.join(dir, `${sourceId}-1.webp`);
  // The media validator checks the RIFF/WebP signature; extraction verifies pixels.
  await fs.writeFile(file, Buffer.from('RIFF0000WEBPtest'));
  t.after(async () => { await fs.unlink(file); await fs.rmdir(dir); await fs.rmdir(root); });
  const payload = { version: 1, branchCode: 'CS', sourceEdition: 'test-edition', sourceName: 'Test source',
    subjectName: 'Theory of Computation', chapterName: 'Finite Automata', slug, sourceSha256: 'b'.repeat(64), sourcePages: 18,
    questions: [{ sourceId, sourceQuestionNumber: 1, sourcePage: 7, chapter: 'Finite Automata',
      questionText: 'Read the supplied automaton.', questionType: 'mcq', options: ['A', 'B', 'C', 'D', 'E'],
      correctAnswer: 4, sourceAnswer: 'e', marks: 2, year: 2007, requiresReview: false, reviewReasons: [],
      questionImages: [{ url: `/question-media/${slug}/${sourceId}-1.webp`, width: 620, height: 800 }],
    }],
  };
  return { root, file, payload, q: payload.questions[0] };
}

test('import supports original five-option questions and stores printed marks', async t => {
  const { root, payload, q } = await fixture(t);
  const media = await validatePayload(payload, root);
  assert.equal(media.size, 1);
  const row = questionDocument(q, payload, {}, 1);
  assert.equal(row.correctAnswer, 4);
  assert.equal(row.marks, 2);
  assert.equal(row.negativeMarks, 0);
  assert.equal(row.isPublished, true);
});

test('ambiguous and incomplete questions stay unpublished with no fabricated answer', async t => {
  const { root, payload, q } = await fixture(t);
  Object.assign(q, { requiresReview: true, reviewReasons: ['Missing continuation.'], correctAnswer: null });
  await validatePayload(payload, root);
  const row = questionDocument(q, payload, {}, 1);
  assert.equal(row.isPublished, false);
  assert.equal(row.requiresReview, true);
  assert.equal(row.correctAnswer, null);
  q.requiresReview = false;
  await assert.rejects(validatePayload(payload, root), /Review reasons must block/);
});

test('invalid or conflicting answers cannot be published', async t => {
  const { root, payload, q } = await fixture(t);
  q.correctAnswer = null;
  await assert.rejects(validatePayload(payload, root), /Invalid or conflicting MCQ answer/);
  q.correctAnswer = 1;
  await assert.rejects(validatePayload(payload, root), /Invalid or conflicting MCQ answer/);
});

test('duplicate source identities and source numbers fail before database writes', async t => {
  const { root, payload, q } = await fixture(t);
  payload.questions.push({ ...q });
  await assert.rejects(validatePayload(payload, root), /Duplicate or invalid source identity/);
});

test('missing, corrupt and out-of-scope artwork block the import', async t => {
  const { root, file, payload, q } = await fixture(t);
  const originalUrl = q.questionImages[0].url;
  q.questionImages[0].url = '/question-media/../../.env';
  await assert.rejects(validatePayload(payload, root), /Unexpected question media path/);
  q.questionImages[0].url = originalUrl.replace('-1.webp', '-2.webp');
  await assert.rejects(validatePayload(payload, root), /ENOENT/);
  q.questionImages[0].url = originalUrl;
  await fs.writeFile(file, 'not an image');
  await assert.rejects(validatePayload(payload, root), /Invalid WebP/);
});
