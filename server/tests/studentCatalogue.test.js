const { test } = require('node:test');
const assert = require('node:assert/strict');
const express = require('express');
const { createSessionToken, cookieName } = require('../services/authSecurity');
const User = require('../models/User');
const { getCatalogue } = require('../controllers/studentController');
const { getHistory } = require('../controllers/studentController');
const Branch = require('../models/Branch');
const Subject = require('../models/Subject');
const Chapter = require('../models/Chapter');
const Test = require('../models/Test');
const Question = require('../models/Question');
const TestAttempt = require('../models/TestAttempt');

// No dotenv or database connection: never use the repository's live credentials.
test('catalogue restricts parent hierarchy and counts only visible questions', async t => {
  const cases = [
    [Branch, { isActive: true, _id: 'b' }, [{ _id: 'b', name: 'ECE' }]],
    [Subject, { isActive: true, branch: { $in: ['b'] } }, [{ _id: 's' }]],
    [Chapter, { isActive: true, subject: { $in: ['s'] } }, [{ _id: 'c' }]],
    [Test, { isPublished: true, chapter: { $in: ['c'] } }, [{ _id: 't', title: 'Networks' }, { _id: 'empty' }]],
  ];
  for (const [model, expected, rows] of cases) {
    t.mock.method(model, 'find', filter => {
      if (model === Subject && filter.name) {
        return { select() { return this; }, sort() { return this; }, lean: async () => [] };
      }
      assert.deepEqual(filter, expected);
      return { select(fields) { assert.ok(fields.length); return this; }, sort() { return this; }, lean: async () => rows };
    });
  }
  t.mock.method(Question, 'aggregate', async pipeline => {
    assert.deepEqual(pipeline[0].$match, { test: { $in: ['t', 'empty'] }, isActive: true, isPublished: true, requiresReview: { $ne: true } });
    return [{ _id: 't', totalQuestions: 2, totalMarks: 3 }];
  });
  let result;
  await getCatalogue({ user: { role: 'student', branch: 'b' } }, { json(value) { result = value; } });
  assert.equal(result.tests[0].totalQuestions, 2);
  assert.equal(result.tests[0].totalMarks, 3);
  assert.equal(result.tests[1].totalQuestions, 0);
  assert.equal(result.tests[1].totalMarks, 0);
  assert.equal(JSON.stringify(result).includes('correctAnswer'), false);
});

test('catalogue database failures return a recoverable error without internal details', async t => {
  t.mock.method(Branch, 'find', () => { throw new Error('private database details'); });
  let status, body;
  await getCatalogue({}, { status(value) { status = value; return this; }, json(value) { body = value; } });
  assert.equal(status, 500);
  assert.ok(!JSON.stringify(body).includes('private database'));
});

test('student history derives weak-topic recommendations from the student-owned attempts', async t => {
  t.mock.method(TestAttempt, 'find', () => ({
    select() { return this; },
    sort() { return this; },
    limit() { return this; },
    lean: async () => [{ _id: 'attempt', test: 'test', title: 'Signals test', submittedAt: new Date(), result: { score: 1, totalMarks: 2 }, questions: [{ questionType: 'mcq', options: ['A', 'B'], correctAnswer: 1, answer: 0, marks: 1, negativeMarks: 0 }] }],
  }));
  t.mock.method(Test, 'find', () => ({ select() { return this; }, lean: async () => [{ _id: 'test', chapter: 'chapter' }] }));
  t.mock.method(Chapter, 'find', () => ({ select() { return this; }, lean: async () => [{ _id: 'chapter', name: 'Signals', subject: 'subject' }] }));
  t.mock.method(Subject, 'find', () => ({ select() { return this; }, lean: async () => [{ _id: 'subject', name: 'Signals and Systems' }] }));
  let result;
  await getHistory({ user: { _id: 'student' } }, { json(value) { result = value; } });
  assert.equal(result.history.length, 1);
  assert.deepEqual(result.recommendations[0], { topic: 'Signals', incorrect: 1, message: 'Review Signals and try a focused practice test.' });
});

test('raw test/question APIs block anonymous users and student sessions', async t => {
  const previous = process.env.JWT_SECRET;
  process.env.JWT_SECRET = 'isolated-test-secret-not-for-production';
  t.after(() => { if (previous === undefined) delete process.env.JWT_SECRET; else process.env.JWT_SECRET = previous; });
  const user = { _id: '507f1f77bcf86cd799439011', role: 'student', isActive: true, tokenVersion: 0 };
  t.mock.method(User, 'findById', () => ({ select() { return this; }, populate: async () => user }));
  const app = express();
  app.use('/api/tests', require('../routes/testRoutes'));
  app.use('/api/questions', require('../routes/questionRoutes'));
  app.use('/api/student', require('../routes/studentRoutes'));
  const server = app.listen(0, '127.0.0.1');
  await new Promise(resolve => server.once('listening', resolve));
  t.after(() => server.close());
  const base = `http://127.0.0.1:${server.address().port}`;
  const token = createSessionToken(user);
  for (const path of ['/api/tests', '/api/tests/chapter/test', '/api/questions', '/api/questions/test/test', '/api/questions/chapter/test']) {
    assert.equal((await fetch(base + path)).status, 401, path);
    assert.equal((await fetch(base + path, { headers: { Cookie: `${cookieName()}=${token}` } })).status, 403, path);
  }
  assert.equal((await fetch(base + '/api/student/catalogue')).status, 401);
});
