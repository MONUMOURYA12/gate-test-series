const { test } = require('node:test');
const assert = require('node:assert/strict');
const express = require('express');
const jwt = require('jsonwebtoken');
const User = require('../models/User');
const { getCatalogue } = require('../controllers/studentController');
const Branch = require('../models/Branch');
const Subject = require('../models/Subject');
const Chapter = require('../models/Chapter');
const Test = require('../models/Test');
const Question = require('../models/Question');

// No dotenv or database connection: never use the repository's live credentials.
test('catalogue restricts parent hierarchy and counts only visible questions', async t => {
  const cases = [
    [Branch, { isActive: true }, [{ _id: 'b', name: 'ECE' }]],
    [Subject, { isActive: true, branch: { $in: ['b'] } }, [{ _id: 's' }]],
    [Chapter, { isActive: true, subject: { $in: ['s'] } }, [{ _id: 'c' }]],
    [Test, { isPublished: true, chapter: { $in: ['c'] } }, [{ _id: 't', title: 'Networks' }, { _id: 'empty' }]],
  ];
  for (const [model, expected, rows] of cases) {
    t.mock.method(model, 'find', filter => {
      assert.deepEqual(filter, expected);
      return { select(fields) { assert.ok(fields.length); return this; }, sort() { return this; }, lean: async () => rows };
    });
  }
  t.mock.method(Question, 'aggregate', async pipeline => {
    assert.deepEqual(pipeline[0].$match, { test: { $in: ['t', 'empty'] }, isActive: true, isPublished: true });
    return [{ _id: 't', totalQuestions: 2, totalMarks: 3 }];
  });
  let result;
  await getCatalogue({}, { json(value) { result = value; } });
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

test('raw test/question APIs block anonymous users and student tokens', async t => {
  const previous = process.env.JWT_SECRET;
  process.env.JWT_SECRET = 'isolated-test-secret-not-for-production';
  t.after(() => { if (previous === undefined) delete process.env.JWT_SECRET; else process.env.JWT_SECRET = previous; });
  t.mock.method(User, 'findById', () => ({ select: async () => ({ _id: 'user', role: 'student', isActive: true }) }));
  const app = express();
  app.use('/api/tests', require('../routes/testRoutes'));
  app.use('/api/questions', require('../routes/questionRoutes'));
  app.use('/api/student', require('../routes/studentRoutes'));
  const server = app.listen(0, '127.0.0.1');
  await new Promise(resolve => server.once('listening', resolve));
  t.after(() => server.close());
  const base = `http://127.0.0.1:${server.address().port}`;
  const token = jwt.sign({ userId: 'user' }, process.env.JWT_SECRET);
  for (const path of ['/api/tests', '/api/tests/chapter/test', '/api/questions', '/api/questions/test/test', '/api/questions/chapter/test']) {
    assert.equal((await fetch(base + path)).status, 401, path);
    assert.equal((await fetch(base + path, { headers: { Authorization: `Bearer ${token}` } })).status, 403, path);
  }
  assert.equal((await fetch(base + '/api/student/catalogue')).status, 401);
});
