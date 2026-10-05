import { useEffect, useState } from 'react';
import { Link, useParams, useSearchParams } from 'react-router-dom';
import { useAuth } from '../hooks/useAuth';
import { apiRequest } from '../services/api';
import Seo from '../components/Seo';
import groups from '../../../shared/examCatalogue.json';

const number = value => value.toLocaleString('en-IN');

function ComingSoon({ name }) {
  return <div className="exam-coming-soon"><div className="exam-coming-art" aria-hidden="true"><span>🌱</span><i>✨</i><b>📚</b></div><span className="exam-status soon">Coming soon</span><h3>A new chapter is growing.</h3><p>We are getting {name} practice ready.<br />Published tests will appear here when they are available.</p><Link to="/exams/ssc/cgl">Explore available maths practice <span aria-hidden="true">→</span></Link></div>;
}

function SubjectPractice({ subject, group, exam }) {
  const [chapter, setChapter] = useState('');
  const [page, setPage] = useState(1);
  const { isAuthenticated } = useAuth();
  const tests = subject.tests.filter(test => !chapter || test.chapterId === chapter);
  const pageSize = 12;
  if (!subject.available) return <ComingSoon name={subject.name} />;
  return <>
    <div className="exam-test-toolbar"><div><span className="exam-status ready">● Practice available</span><p>{number(subject.totalQuestions)} questions · {subject.chapters.length} chapters · {subject.tests.length} tests</p></div>
      <label>Choose a chapter<select value={chapter} onChange={event => { setChapter(event.target.value); setPage(1); }}><option value="">All chapters</option>{subject.chapters.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}</select></label>
    </div>
    {['ssc', 'railway', 'banking'].includes(group.id) && subject.id === 'mathematics' && <p className="exam-practice-note">📖 Includes bilingual Railway maths PYQs for topic practice. These are chapter tests, not full {exam.name} mock papers.</p>}
    <div className="exam-test-grid">{tests.slice((page - 1) * pageSize, page * pageSize).map(test => {
      const destination = { pathname: `/student/tests/${test.id}`, search: `?fromExam=${group.id}/${exam.id}` };
      return <article className="exam-test-card" key={test.id}><span className="exam-eyebrow">{test.chapterName}</span><h3>{test.title}</h3><p>{test.totalQuestions} questions <span>·</span> {test.duration} min <span>·</span> {test.totalMarks} marks</p><Link className="exam-take-test" to={isAuthenticated ? `${destination.pathname}${destination.search}` : '/login'} state={isAuthenticated ? undefined : { from: destination, branchId: test.branchId }}>Take test <span aria-hidden="true">→</span></Link></article>;
    })}</div>
    {tests.length > pageSize && <div className="exam-pagination"><button disabled={page === 1} onClick={() => setPage(p => p - 1)}>← Previous</button><span aria-live="polite">Page {page} of {Math.ceil(tests.length / pageSize)}</span><button disabled={page * pageSize >= tests.length} onClick={() => setPage(p => p + 1)}>Next →</button></div>}
    {!isAuthenticated && <p className="exam-login-note">🔒 Your test attempt and progress are saved after you log in.</p>}
  </>;
}

export default function ExamExplorePage() {
  const { family, examId } = useParams();
  const [params, setParams] = useSearchParams();
  const group = groups.find(g => g.id === family);
  const exam = group?.exams.find(e => e.id === examId);
  const [data, setData] = useState(null);
  const [failure, setFailure] = useState(null);
  const [revision, setRevision] = useState(0);
  const requestKey = `${family}/${examId}/${revision}`;
  const error = failure?.key === requestKey ? failure.message : '';
  useEffect(() => {
    if (!exam) return;
    const controller = new AbortController();
    apiRequest(`/explore/${family}/${examId}`, { signal: controller.signal }).then(result => {
      if (!controller.signal.aborted) setData({ key: requestKey, ...result });
    }).catch(err => { if (!controller.signal.aborted) setFailure({ key: requestKey, message: err.message }); });
    return () => controller.abort();
  }, [family, examId, exam, requestKey]);
  if (!group || (examId && !exam)) return <main className="exam-container exam-not-found"><span aria-hidden="true">🧭</span><h1>Let’s find your exam.</h1><p>This study path could not be found.</p><Link to="/">Explore all exams</Link></main>;
  if (!exam) return <main className="exam-container exam-family-page"><Seo title={`${group.label} exams | ParikshaSarthi`} description={group.description} /><Link className="exam-back" to="/">← All exams</Link><p className="exam-eyebrow">YOUR NEXT CHAPTER STARTS HERE</p><h1><span aria-hidden="true">{group.icon}</span> {group.label}</h1><p className="exam-lead">{group.description} Choose an exam to explore its subjects.</p><div className="exam-family-grid">{group.exams.map(e => <Link key={e.id} to={`/exams/${group.id}/${e.id}`}><span>{e.code || group.icon}</span><h2>{e.name}</h2><p>{e.subtitle}</p><strong>Explore subjects →</strong></Link>)}</div></main>;
  const current = data?.key === requestKey ? data : null;
  const selected = current?.subjects.find(s => s.id === params.get('subject')) || current?.subjects.find(s => s.available) || current?.subjects[0];
  return <main className="exam-detail-page">
    <Seo title={`${exam.name} subjects & tests | ParikshaSarthi`} description={exam.overview} path={`/exams/${group.id}/${exam.id}`} />
    <section className="exam-intro"><div className="exam-container"><nav className="exam-breadcrumb" aria-label="Breadcrumb"><Link to="/">Home</Link><span>/</span><Link to={`/exams/${group.id}`}>{group.label}</Link><span>/</span><span>{exam.code || exam.name}</span></nav>
      <div className="exam-intro-grid"><div><p className="exam-eyebrow">EXPLORE. PREPARE. GROW.</p><h1>{exam.name}</h1><p className="exam-subtitle">{exam.subtitle}</p><p className="exam-lead">{exam.overview}</p><div className="exam-intro-tags"><span>📚 {exam.subjects.length} study areas</span><span>🔓 Explore without login</span><span>🎯 Chapter-wise practice</span></div></div><div className="exam-intro-art" aria-hidden="true"><span>{group.icon}</span><i>✨</i><p>Your goal.<br /><strong>Your next step.</strong></p></div></div>
    </div></section>
    <section className="exam-container exam-subjects" aria-labelledby="exam-subject-heading"><div className="exam-section-heading"><div><p className="exam-eyebrow">BUILD YOUR STUDY PLAN</p><h2 id="exam-subject-heading">Important subjects</h2></div><p>Choose a subject to explore its practice.</p></div>
      {error ? <div className="exam-load-error" role="alert"><h3>Availability could not be checked</h3><p>{error}</p><button onClick={() => setRevision(r => r + 1)}>Try again</button></div> : null}
      <div className="exam-subject-grid">{exam.subjects.map(area => {
        const live = current?.subjects.find(s => s.id === area.id);
        return <button key={area.id} className={`exam-subject-card ${selected?.id === area.id ? 'is-selected' : ''}`} aria-pressed={selected?.id === area.id} onClick={() => { setParams({ subject: area.id }, { replace: true }); document.getElementById('subject-practice')?.scrollIntoView({ behavior: 'smooth', block: 'start' }); }}><span className="exam-subject-icon" aria-hidden="true">{area.icon}</span><span className={`exam-status ${live ? live.available ? 'ready' : 'soon' : 'checking'}`}>{live ? live.available ? `${live.tests.length} tests available` : 'Coming soon' : error ? 'Check unavailable' : 'Checking availability…'}</span><h3>{area.name}</h3><p>{area.topics || `Explore ${area.name.toLowerCase()} concepts and chapter-wise practice.`}</p><span className="exam-subject-action">{live?.available ? 'Explore tests' : 'View study area'} <span aria-hidden="true">→</span></span></button>;
      })}</div>
      {!current && !error && <p role="status" className="exam-loading">Checking published subjects and tests…</p>}
      {selected && <section id="subject-practice" className="exam-practice-section" aria-labelledby="subject-practice-heading"><div className="exam-section-heading"><div><p className="exam-eyebrow">ONE SUBJECT. ONE FOCUSED START.</p><h2 id="subject-practice-heading">{selected.icon} {selected.name}</h2></div></div><SubjectPractice key={`${family}/${examId}/${selected.id}`} subject={selected} group={group} exam={exam} /></section>}
      <p className="exam-source-note">Study areas are a preparation guide. <a href={exam.source || group.source} target="_blank" rel="noreferrer">View the official exam information ↗</a></p>
    </section>
  </main>;
}
