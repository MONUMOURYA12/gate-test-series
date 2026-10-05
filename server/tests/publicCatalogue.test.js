const { test } = require('node:test');
const assert = require('node:assert/strict');
const express = require('express');
const { summarizeExam, loadPublicExam } = require('../services/publicCatalogue');
const Branch = require('../models/Branch');
const Subject = require('../models/Subject');
const Chapter = require('../models/Chapter');
const Test = require('../models/Test');
const Question = require('../models/Question');
const groups = require('../../shared/examCatalogue.json');
const query = rows => ({ select() { return this; }, sort() { return this; }, lean: async () => rows });

test('public subjects distinguish published practice from empty areas and do not serialize answers', () => {
  const definition = groups.find(g => g.id === 'ssc').exams.find(e => e.id === 'cgl');
  const data = summarizeExam(definition, [{ _id: 'b', code: 'SSC' }], [{ _id: 's', branch: 'b', name: 'Mathematics' }],
    [{ _id: 'c', subject: 's', name: 'Percentage', order: 1 }],
    [{ _id: 't', chapter: 'c', title: 'Practice', duration: 20, correctAnswer: 'secret' }, { _id: 'empty', chapter: 'c', title: 'Empty' }],
    [{ _id: 't', totalQuestions: 4, totalMarks: 4 }]);
  assert.equal(data.totalTests, 1);
  assert.equal(data.totalQuestions, 4);
  assert.equal(data.subjects[0].available, true);
  assert.equal(data.subjects[1].available, false);
  assert.equal(data.subjects[0].tests[0].branchCode, 'SSC');
  assert(!JSON.stringify(data).includes('secret'));
  assert(!JSON.stringify(data).includes('correctAnswer'));
});

test('GATE alias editions are not duplicated and common practice can fill empty subjects', () => {
  const definition = { branchCodes: ['EC', 'ECE'], subjects: [
    { id: 'signals', name: 'Signals', matches: ['Signals'] },
    { id: 'maths', name: 'Engineering Mathematics', matches: ['Engineering Mathematics'], shared: true },
  ] };
  const data = summarizeExam(definition, [{ _id: 'b1', code: 'EC' }, { _id: 'b2', code: 'ECE' }, { _id: 'b3', code: 'CS' }],
    [{ _id: 's1', branch: 'b1', name: 'Signals' }, { _id: 's2', branch: 'b2', name: 'Signals' }, { _id: 's3', branch: 'b3', name: 'Engineering Mathematics' }],
    [1,2,3].map(i => ({ _id: `c${i}`, subject: `s${i}`, name: 'Chapter' })),
    [1,2,3].map(i => ({ _id: `t${i}`, chapter: `c${i}`, title: 'Test' })),
    [1,2,3].map(i => ({ _id: `t${i}`, totalQuestions: 20, totalMarks: 20 })));
  assert.equal(data.totalTests, 2);
  assert.equal(data.subjects[0].tests[0].id, 't1');
  assert.equal(data.subjects[1].tests[0].id, 't3');
});

test('public catalogue filters active parents and visible questions, using trusted exam IDs', async t => {
  t.mock.method(Branch, 'find', filter => {
    assert.deepEqual(filter, { isActive: true, code: { $in: ['SSC'] } });
    return query([{ _id: 'b', code: 'SSC' }]);
  });
  t.mock.method(Subject, 'find', filter => {
    assert.deepEqual(filter, { isActive: true, $or: [{ branch: { $in: ['b'] } }] });
    return query([{ _id: 's', branch: 'b', name: 'Mathematics' }]);
  });
  t.mock.method(Chapter, 'find', filter => {
    assert.deepEqual(filter, { isActive: true, subject: { $in: ['s'] } });
    return query([{ _id: 'c', subject: 's', name: 'Percentage' }]);
  });
  t.mock.method(Test, 'find', filter => {
    assert.deepEqual(filter, { isPublished: true, chapter: { $in: ['c'] } });
    return query([{ _id: 'test', chapter: 'c', title: 'Test', duration: 10 }]);
  });
  t.mock.method(Question, 'aggregate', async pipeline => {
    assert.deepEqual(pipeline[0].$match, { test: { $in: ['test'] }, isActive: true, isPublished: true, requiresReview: { $ne: true } });
    return [{ _id: 'test', totalQuestions: 1, totalMarks: 1 }];
  });
  const app = express();
  app.use('/api/explore', require('../routes/exploreRoutes'));
  const server = app.listen(0, '127.0.0.1');
  await new Promise(resolve => server.once('listening', resolve));
  t.after(() => server.close());
  const base = `http://127.0.0.1:${server.address().port}`;
  const response = await fetch(`${base}/api/explore/ssc/cgl`);
  assert.equal(response.status, 200);
  assert.equal((await response.json()).totalQuestions, 1);
  assert.equal((await fetch(`${base}/api/explore/ssc/unknown`)).status, 404);
});

test('JEE and NEET never substitute GATE subjects with the same name', async t => {
  t.mock.method(Branch, 'find', filter => { assert.deepEqual(filter.code.$in, ['NEET', 'NEET_UG']); return query([]); });
  t.mock.method(Subject, 'find', filter => { assert.deepEqual(filter.$or, [{ branch: { $in: [] } }]); return query([]); });
  t.mock.method(Chapter, 'find', () => query([]));
  t.mock.method(Test, 'find', () => query([]));
  const data = await loadPublicExam('neet', 'ug');
  assert.equal(data.subjects.length, 3);
  assert(data.subjects.every(s => !s.available));
  assert.equal(data.totalTests, 0);
});

test('a database failure is an unavailable response, not a false coming-soon result', async t => {
  t.mock.method(Branch, 'find', () => { throw new Error('offline'); });
  const app = express();
  app.use('/api/explore', require('../routes/exploreRoutes'));
  const server = app.listen(0, '127.0.0.1');
  await new Promise(resolve => server.once('listening', resolve));
  t.after(() => server.close());
  const response = await fetch(`http://127.0.0.1:${server.address().port}/api/explore/ssc/cgl`);
  assert.equal(response.status, 503);
  assert.match((await response.json()).message, /try again/i);
});
