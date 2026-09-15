import { Link, useOutletContext, useParams, useSearchParams } from "react-router-dom";

export default function StudentTestDetailsPage() {
  const { tests, chapters, subjects, branches } = useOutletContext();
  const { testId } = useParams();
  const [params] = useSearchParams();
  const test = tests.find(t => t._id === testId);
  const back = `/student/tests?${params.toString()}`;
  if (!test) return <div className="learn-state"><h1>Test unavailable</h1><p>This test may have been unpublished or removed.</p><Link className="primary-button" to={back}>Back to catalogue</Link></div>;
  const chapter = chapters.find(c => c._id === test.chapter);
  const subject = subjects.find(s => s._id === chapter?.subject);
  const branch = branches.find(b => b._id === subject?.branch);
  return <>
    <Link className="learn-back" to={back}>← Back to catalogue</Link>
    <section className="learn-detail">
      <p className="learn-eyebrow">GATE · {branch?.code}</p><h1 className="learn-title">{test.title}</h1>
      <p className="learn-intro">{subject?.name} / {chapter?.name}</p>
      {test.description && <p className="learn-description">{test.description}</p>}
      <dl className="learn-stats"><div><dt>Duration</dt><dd>{test.duration} <small>min</small></dd></div><div><dt>Published questions</dt><dd>{test.totalQuestions}</dd></div><div><dt>Total marks</dt><dd>{test.totalMarks}</dd></div></dl>
      <h2>Before you begin</h2>
      <ul className="learn-instructions"><li>Check the subject and chapter before choosing a test.</li><li>Duration shown above is in minutes.</li><li>{test.negativeMarking ? "Negative marking is enabled for this test. Applicable deductions will be shown with each question when attempts open." : "Negative marking is disabled for this test."}</li></ul>
      <div className="learn-notice"><strong>Test attempts are coming soon</strong><p>You can browse test details now. Timed attempts and results are not available yet.</p>{test.totalQuestions === 0 && <p>Questions are still being prepared for this test.</p>}</div>
      <Link className="primary-button" to={back}>Explore more tests</Link>
    </section>
  </>;
}
