import { useEffect, useState } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";
import { studentApi } from "../services/api";
import QuestionMedia from "../components/QuestionMedia.jsx";
import SolutionContent from "../components/SolutionContent.jsx";

function answerLabel(question, answer) {
  if (answer === null || answer === undefined || (Array.isArray(answer) && !answer.length)) return "Not answered";
  if (question.questionType === "nat") return String(answer);
  const values = Array.isArray(answer) ? answer : [answer];
  return values.map(value => `${String.fromCharCode(65 + value)}. ${question.options[value] || "Option"}`).join(", ");
}

function outcomeLabel(outcome) {
  if (outcome === "correct") return "Correct";
  if (outcome === "incorrect") return "Incorrect";
  return "Unanswered";
}

export default function StudentResultPage() {
  const { attemptId } = useParams();
  const navigate = useNavigate();
  const [attempt, setAttempt] = useState(null);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(true);
  const [solutions, setSolutions] = useState({});
  const [solutionLoading, setSolutionLoading] = useState("");

  useEffect(() => {
    const controller = new AbortController();
    studentApi.attempt(attemptId, controller.signal).then(result => {
      if (controller.signal.aborted) return;
      if (result.attempt.status === "in_progress") {
        navigate(`/student/attempts/${attemptId}`, { replace: true });
        return;
      }
      setAttempt(result.attempt);
    }).catch(err => {
      if (!controller.signal.aborted) setError(err.message);
    }).finally(() => {
      if (!controller.signal.aborted) setLoading(false);
    });
    return () => controller.abort();
  }, [attemptId, navigate]);

  if (loading) return <div className="learn-state" role="status">Loading your result...</div>;
  if (error || !attempt) return <div className="learn-state" role="alert"><h1>Unable to load result</h1><p>{error || "This result is unavailable."}</p><Link className="secondary-button" to="/student/tests">Back to tests</Link></div>;

  async function loadSolution(questionId) {
    setSolutionLoading(questionId);
    try {
      const data = await studentApi.solution(attemptId, questionId);
      setSolutions(current => ({ ...current, [questionId]: data.solution }));
    } catch (solutionError) {
      setSolutions(current => ({ ...current, [questionId]: solutionError.message }));
    } finally {
      setSolutionLoading("");
    }
  }

  const result = attempt.result || {};
  const attempted = (result.correct || 0) + (result.incorrect || 0);
  const accuracy = attempted ? Math.round(((result.correct || 0) / attempted) * 100) : 0;
  const averageTime = attempted ? Math.round((result.timeTakenSeconds || 0) / attempted) : 0;
  const scorePercentage = result.totalMarks ? Math.max(0, Math.round(((result.score || 0) / result.totalMarks) * 100)) : 0;
  return <div className="student-result-page">
    <Link className="learn-back" to="/student/tests">Back to catalogue</Link>
    <section className="result-hero">
      <p className="learn-eyebrow">TEST COMPLETE</p>
      <h1>{attempt.title}</h1>
      <p>Submitted {attempt.submittedAt ? new Date(attempt.submittedAt).toLocaleString() : "just now"} · {scorePercentage}% score</p>
    </section>

    <section className="result-summary" aria-labelledby="result-summary-title">
      <div className="result-score"><span id="result-summary-title">Your score</span><strong>{result.score ?? 0}</strong><small>out of {result.totalMarks ?? 0}</small></div>
      <div className="result-summary-grid">
        <div><span>Correct</span><strong>{result.correct ?? 0}</strong></div>
        <div><span>Incorrect</span><strong>{result.incorrect ?? 0}</strong></div>
        <div><span>Unanswered</span><strong>{result.unanswered ?? 0}</strong></div>
        <div><span>Time used</span><strong>{Math.floor((result.timeTakenSeconds || 0) / 60)}m {(result.timeTakenSeconds || 0) % 60}s</strong></div>
      </div>
    </section>

    <section className="result-insights" aria-label="Performance insights">
      <div><span>Accuracy</span><strong>{accuracy}%</strong><small>of attempted questions</small></div>
      <div><span>Attempted</span><strong>{attempted}/{attempt.questions.length}</strong><small>questions answered</small></div>
      <div><span>Average time</span><strong>{Math.floor(averageTime / 60)}m {averageTime % 60}s</strong><small>per attempted question</small></div>
    </section>

    <section className="result-questions" aria-labelledby="review-title">
      <div className="learn-section-heading"><h2 id="review-title">Answer review</h2><Link className="secondary-button" to={`/student/tests/${attempt.test}`}>Try again</Link></div>
      <div className="result-question-list">
        {attempt.questions.map(question => <article className={`result-question ${question.outcome || "unanswered"}`} key={question.questionId}>
          <div className="result-question-heading"><span>Question {question.questionNumber}</span><strong>{outcomeLabel(question.outcome)}</strong></div>
          <h3>{question.questionText}</h3>
          <QuestionMedia images={question.questionImages} />
          <dl className="result-answers"><div><dt>Your answer</dt><dd>{answerLabel(question, question.answer)}</dd></div><div><dt>Correct answer</dt><dd>{question.questionType === "nat" && question.natAnswerMin != null && question.natAnswerMax != null ? `${question.natAnswerMin} to ${question.natAnswerMax}` : answerLabel(question, question.correctAnswer)}</dd></div></dl>
          <p className="result-award">{question.awardedMarks >= 0 ? "+" : ""}{question.awardedMarks} marks</p>
          {question.explanation && <p className="result-explanation"><strong>Explanation:</strong> {question.explanation}</p>}
          <button className="solution-button" type="button" disabled={solutionLoading === String(question.questionId)} onClick={() => loadSolution(String(question.questionId))}>{solutionLoading === String(question.questionId) ? "Loading solution..." : "Solution"}</button>
          {solutions[question.questionId] && <div className="ai-solution-box"><strong>Solution</strong><SolutionContent text={solutions[question.questionId]} /><small>Review the verified answer key alongside this explanation. AI-generated explanations may contain mistakes.</small></div>}
        </article>)}
      </div>
    </section>
  </div>;
}
