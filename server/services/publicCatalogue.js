const catalogue = require('../../shared/examCatalogue.json');
const Branch = require('../models/Branch');
const Subject = require('../models/Subject');
const Chapter = require('../models/Chapter');
const Test = require('../models/Test');
const Question = require('../models/Question');

const sameId = (a, b) => String(a) === String(b);
const normalize = value => String(value || '').trim().toLowerCase();

// Public responses contain only study areas, chapter names and test summaries.
// Question content, answers, media, attempts and student data stay authenticated.
function summarizeExam(definition, branches, subjects, chapters, tests, counts) {
  const countMap = new Map(counts.map(c => [String(c._id), c]));
  const chapterMap = new Map(chapters.map(c => [String(c._id), c]));
  const branchMap = new Map(branches.map(b => [String(b._id), b]));
  const visibleTests = tests.filter(test => countMap.get(String(test._id))?.totalQuestions > 0);
  const hasPractice = subject => visibleTests.some(test => sameId(chapterMap.get(String(test.chapter))?.subject, subject._id));
  const rows = definition.subjects.map(area => {
    const candidates = subjects.filter(s => area.matches.map(normalize).includes(normalize(s.name)) &&
      (definition.branchCodes.includes(branchMap.get(String(s.branch))?.code) || area.shared));
    const rank = s => {
      const own = definition.branchCodes.indexOf(branchMap.get(String(s.branch))?.code);
      return own < 0 ? 100 : own;
    };
    candidates.sort((a, b) => rank(a) - rank(b) || String(a._id).localeCompare(String(b._id)));
    const preferred = candidates.find(hasPractice) || candidates[0];
    // Pick one branch's edition instead of repeating identical cross-branch PYQs.
    const selected = preferred ? candidates.filter(s => sameId(s.branch, preferred.branch)) : [];
    const selectedIds = new Set(selected.map(s => String(s._id)));
    const areaChapters = chapters.filter(c => selectedIds.has(String(c.subject)));
    const areaChapterIds = new Set(areaChapters.map(c => String(c._id)));
    const areaTests = visibleTests.filter(t => areaChapterIds.has(String(t.chapter))).map(test => {
      const count = countMap.get(String(test._id));
      const branch = branchMap.get(String(preferred.branch));
      return { id: String(test._id), title: test.title, duration: test.duration,
        chapterId: String(test.chapter), chapterName: chapterMap.get(String(test.chapter)).name,
        totalQuestions: count.totalQuestions, totalMarks: count.totalMarks,
        branchId: String(branch._id), branchCode: branch.code };
    });
    const readyChapters = areaChapters.filter(c => areaTests.some(t => t.chapterId === String(c._id)))
      .map(c => ({ id: String(c._id), name: c.name, order: c.order }));
    return { id: area.id, name: area.name, icon: area.icon, topics: area.topics,
      available: areaTests.length > 0, totalQuestions: areaTests.reduce((n, t) => n + t.totalQuestions, 0),
      chapters: readyChapters, tests: areaTests };
  });
  return { subjects: rows, totalTests: rows.reduce((n, s) => n + s.tests.length, 0),
    totalQuestions: rows.reduce((n, s) => n + s.totalQuestions, 0) };
}

async function loadPublicExam(family, examId) {
  const group = catalogue.find(g => g.id === family);
  const definition = group?.exams.find(e => e.id === examId);
  if (!definition) return null;
  const codes = family === 'gate' ? catalogue.find(g => g.id === 'gate').exams.flatMap(e => e.branchCodes) : definition.branchCodes;
  const branches = await Branch.find({ isActive: true, code: { $in: codes } }).select('name code').lean();
  const ownIds = branches.filter(b => definition.branchCodes.includes(b.code)).map(b => b._id);
  const sharedNames = definition.subjects.filter(s => s.shared).flatMap(s => s.matches);
  const subjectFilter = { isActive: true, $or: [{ branch: { $in: ownIds } }] };
  if (sharedNames.length) subjectFilter.$or.push({ branch: { $in: branches.map(b => b._id) }, name: { $in: sharedNames } });
  const subjects = await Subject.find(subjectFilter).select('name branch').lean();
  const chapters = await Chapter.find({ isActive: true, subject: { $in: subjects.map(s => s._id) } })
    .select('name subject order').sort({ order: 1, name: 1 }).lean();
  const tests = await Test.find({ isPublished: true, chapter: { $in: chapters.map(c => c._id) } })
    .select('title chapter duration').sort({ title: 1, _id: 1 }).lean();
  const counts = tests.length ? await Question.aggregate([
    { $match: { test: { $in: tests.map(t => t._id) }, isActive: true, isPublished: true, requiresReview: { $ne: true } } },
    { $group: { _id: '$test', totalQuestions: { $sum: 1 }, totalMarks: { $sum: '$marks' } } },
  ]) : [];
  return summarizeExam(definition, branches, subjects, chapters, tests, counts);
}

module.exports = { loadPublicExam, summarizeExam };
