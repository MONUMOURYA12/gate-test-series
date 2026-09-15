import { useEffect, useState } from "react";
import { Link, useNavigate, useParams, useSearchParams } from "react-router-dom";
import { studentApi } from "../services/api";

export default function StudentTestDetailsPage() {
  const { testId } = useParams();
  const [params] = useSearchParams();
  const navigate = useNavigate();
  const [data, setData] = useState(null);
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const [revision, setRevision] = useState(0);
  const back = `/student/tests?${params.toString()}`;

  useEffect(() => {
    const controller = new AbortController();
    setData(null);
    setError("");
    studentApi.testDetails(testId, controller.signal).then(result => {
      if (!controller.signal.aborted) setData(result);
    }).catch(err => {
      if (!controller.signal.aborted) setError(err.message);
    });
    return () => controller.abort();
  }, [testId, revision]);

  async function start() {
    setBusy(true);
    setError("");
    try {
      const { attempt } = await studentApi.startAttempt(testId);
      navigate(`/student/attempts/${attempt._id}${attempt.status === "submitted" ? "/result" : ""}`);
    } catch (err) {
      setError(err.message);
      setBusy(false);
    }
  }

  if (!data) return <div className="learn-state" role={error ? "alert" : "status"}>
    {error ? <><h1>Test unavailable</h1><p>{error}</p><button className="secondary-button" onClick={() => setRevision(r => r + 1)}>Try again</button><p><Link to={back}>Back to catalogue</Link></p></> : "Loading test details..."}
  </div>;

  const { test, attempts } = data;
  const active = attempts.find(attempt => attempt.status === "in_progress");
  return <>
    <Link className="learn-back" to={back}>Back to catalogue</Link>
    <section className="learn-detail">
      <p className="learn-eyebrow">GATE / {test.branch.code}</p>
      <h1 className="learn-title">{test.title}</h1>
      <p className="learn-intro">{test.subject.name} / {test.chapter.name}</p>
      {test.description && <p className="learn-description">{test.description}</p>}
      <dl className="learn-stats">
        <div><dt>Duration</dt><dd>{test.duration} <small>min</small></dd></div>
        <div><dt>Questions</dt><dd>{test.totalQuestions}</dd></div>
        <div><dt>Total marks</dt><dd>{test.totalMarks}</dd></div>
      </dl>
      <h2>Exam rules</h2>
      <ul className="learn-instructions">
        <li>The timer starts when you begin and continues if you leave the exam.</li>
        <li>MCQ: one correct option. MSQ: all correct options are required, with no partial marks. NAT: a numerical answer.</li>
        <li>{test.negativeMarking ? "Incorrect MCQ answers incur the deduction shown on each question. MSQ and NAT have no negative marking." : "There is no negative marking for this test."}</li>
        <li>Unanswered questions receive zero marks. When time runs out, your saved answers are final.</li>
      </ul>
      {error && <p className="alert alert-error" role="alert">{error}</p>}
      {test.totalQuestions === 0 && <p className="learn-notice">Questions are still being prepared for this test.</p>}
      {active ? <Link className="primary-button" to={`/student/attempts/${active._id}`}>Resume attempt</Link> :
        <button className="primary-button" disabled={busy || !test.totalQuestions} onClick={start}>
          {busy ? "Starting..." : attempts.length ? "Retake test" : "Start test"}
        </button>}
    </section>
    {attempts.length > 0 && <section className="attempt-history" aria-labelledby="history-title">
      <h2 id="history-title">Your attempts</h2>
      <div className="attempt-history-list">{attempts.map(attempt => <div className="attempt-history-row" key={attempt._id}>
        <div><strong>{attempt.status === "submitted" ? "Completed" : "In progress"}</strong><p>{new Date(attempt.startedAt).toLocaleString()}</p></div>
        <span>{attempt.status === "submitted" ? `${attempt.result.score} / ${attempt.result.totalMarks} marks` : `${test.duration} min`}</span>
        <Link className="secondary-button" to={`/student/attempts/${attempt._id}${attempt.status === "submitted" ? "/result" : ""}`}>{attempt.status === "submitted" ? "View result" : "Resume"}</Link>
      </div>)}</div>
    </section>}
  </>;
}
