import { useCallback, useEffect, useRef, useState } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";
import { studentApi } from "../services/api";
import ScientificCalculator from "../components/ScientificCalculator.jsx";
import QuestionMedia from "../components/QuestionMedia.jsx";
import SolutionContent from "../components/SolutionContent.jsx";

function hasAnswer(question) {
  if (question.answer === null || question.answer === undefined || question.answer === "") return false;
  return question.questionType === "msq" ? question.answer.length > 0 : true;
}

function toApiAnswer(question, answer) {
  if (answer === null || answer === undefined || answer === "") return null;
  if (question.questionType === "msq") return Array.isArray(answer) ? answer.map(Number) : [];
  return Number(answer);
}

function formatTime(milliseconds) {
  const totalSeconds = Math.max(0, Math.ceil(milliseconds / 1000));
  const hours = Math.floor(totalSeconds / 3600);
  const minutes = Math.floor((totalSeconds % 3600) / 60);
  const seconds = totalSeconds % 60;
  return hours > 0
    ? `${hours}:${String(minutes).padStart(2, "0")}:${String(seconds).padStart(2, "0")}`
    : `${minutes}:${String(seconds).padStart(2, "0")}`;
}

export default function StudentExamPage() {
  const { attemptId } = useParams();
  const navigate = useNavigate();
  const [attempt, setAttempt] = useState(null);
  const [currentIndex, setCurrentIndex] = useState(0);
  const [remaining, setRemaining] = useState(0);
  const [clockOffset, setClockOffset] = useState(0);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [savingQuestion, setSavingQuestion] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [calculatorOpen, setCalculatorOpen] = useState(false);
  const [solutions, setSolutions] = useState({});
  const [solutionLoading, setSolutionLoading] = useState(false);
  const [isFullscreen, setIsFullscreen] = useState(false);
  const submitStarted = useRef(false);

  useEffect(() => {
    const controller = new AbortController();
    studentApi.attempt(attemptId, controller.signal).then(result => {
      if (controller.signal.aborted) return;
      const nextAttempt = result.attempt;
      if (nextAttempt.status === "submitted") {
        navigate(`/student/attempts/${attemptId}/result`, { replace: true });
        return;
      }
      setAttempt(nextAttempt);
      setClockOffset(new Date(nextAttempt.serverTime).getTime() - Date.now());
      setError("");
    }).catch(err => {
      if (!controller.signal.aborted) setError(err.message);
    }).finally(() => {
      if (!controller.signal.aborted) setLoading(false);
    });
    return () => controller.abort();
  }, [attemptId, navigate]);

  const submitNow = useCallback(async (automatic = false) => {
    if (submitStarted.current) return;
    if (!automatic && !window.confirm("Submit this test now? You will not be able to change your answers after submission.")) return;
    submitStarted.current = true;
    setSubmitting(true);
    setError("");
    try {
      const result = await studentApi.submitAttempt(attemptId);
      setAttempt(result.attempt);
      navigate(`/student/attempts/${attemptId}/result`, { replace: true });
    } catch (err) {
      const endedAttempt = err.data?.attempt;
      if (endedAttempt?.status === "submitted") {
        setAttempt(endedAttempt);
        navigate(`/student/attempts/${attemptId}/result`, { replace: true });
        return;
      }
      submitStarted.current = false;
      setSubmitting(false);
      setError(err.message);
    }
  }, [attemptId, navigate]);

  useEffect(() => {
    if (!attempt || attempt.status !== "in_progress") return undefined;
    const expiresAt = new Date(attempt.expiresAt).getTime();
    const updateClock = () => {
      const nextRemaining = Math.max(0, expiresAt - (Date.now() + clockOffset));
      setRemaining(nextRemaining);
      if (nextRemaining === 0) submitNow(true);
    };
    updateClock();
    const timer = window.setInterval(updateClock, 1000);
    return () => window.clearInterval(timer);
  }, [attempt, clockOffset, submitNow]);

  useEffect(() => {
    const updateFullscreenState = () => setIsFullscreen(Boolean(document.fullscreenElement));
    document.addEventListener("fullscreenchange", updateFullscreenState);
    return () => document.removeEventListener("fullscreenchange", updateFullscreenState);
  }, []);

  async function toggleFullscreen() {
    try {
      if (document.fullscreenElement) await document.exitFullscreen();
      else await document.documentElement.requestFullscreen();
    } catch {
      setError("Fullscreen mode is not available in this browser.");
    }
  }

  const saveAnswer = useCallback(async (questionId, answer, markedForReview, answerSubmitted = false) => {
    setSavingQuestion(questionId);
    setError("");
    try {
      await studentApi.saveAnswer(attemptId, {
        questionId,
        answer,
        markedForReview,
        answerSubmitted,
      });
    } catch (err) {
      const endedAttempt = err.data?.attempt;
      if (endedAttempt?.status === "submitted") {
        setAttempt(endedAttempt);
        navigate(`/student/attempts/${attemptId}/result`, { replace: true });
        return;
      }
      setError(err.message);
    } finally {
      setSavingQuestion("");
    }
  }, [attemptId, navigate]);

  const updateQuestion = useCallback((question, answer, markedForReview = question.markedForReview, answerSubmitted = question.answerSubmitted || false) => {
    const apiAnswer = toApiAnswer(question, answer);
    setAttempt(current => current ? {
      ...current,
      questions: current.questions.map(item => item.questionId === question.questionId
        ? { ...item, answer: apiAnswer, markedForReview, answerSubmitted }
        : item),
    } : current);
      saveAnswer(question.questionId, apiAnswer, markedForReview, answerSubmitted);
  }, [saveAnswer]);

  const questions = attempt?.questions || [];
  const question = questions[currentIndex];
  const answeredCount = questions.filter(hasAnswer).length;
  const reviewCount = questions.filter(item => item.markedForReview).length;

  if (loading) return <div className="learn-state" role="status">Loading your exam...</div>;
  if (error && !attempt) return <div className="learn-state" role="alert"><h1>Unable to open exam</h1><p>{error}</p><Link className="secondary-button" to="/student/tests">Back to tests</Link></div>;
  if (!attempt || !question) return <div className="learn-state" role="alert"><h1>Exam unavailable</h1><p>No questions are available for this attempt.</p><Link className="secondary-button" to="/student/tests">Back to tests</Link></div>;

  function chooseMcq(index) {
    updateQuestion(question, index);
  }

  function toggleMsq(index) {
    const current = Array.isArray(question.answer) ? question.answer : [];
    const next = current.includes(index)
      ? current.filter(value => value !== index)
      : [...current, index].sort((a, b) => a - b);
    updateQuestion(question, next);
  }

  function setNat(value) {
    updateQuestion(question, value === "" ? null : Number(value));
  }

  function toggleReview() {
    if (!question.answerSubmitted) updateQuestion(question, question.answer, !question.markedForReview);
  }

  async function showSolution() {
    setSolutionLoading(true);
    setError("");
    try {
      const result = await studentApi.solution(attemptId, String(question.questionId));
      setSolutions(current => ({ ...current, [question.questionId]: result.solution }));
    } catch (err) {
      setError(err.message);
    } finally {
      setSolutionLoading(false);
    }
  }

  function submitQuestion() {
    if (!hasAnswer(question) || question.answerSubmitted) return;
    updateQuestion(question, question.answer, question.markedForReview, true);
  }

  return <div className="student-exam-page">
    <div className="exam-topbar">
      <div>
        <p className="learn-eyebrow">LIVE EXAM ATTEMPT</p>
        <h1>{attempt.title}</h1>
        <p>Question {currentIndex + 1} of {questions.length}</p>
      </div>
      <div className="exam-tools">
        <button className={`exam-tool-button${calculatorOpen ? " active" : ""}`} type="button" onClick={() => setCalculatorOpen(value => !value)}>
          <span aria-hidden="true">⌗</span> Calculator
        </button>
        <button className="exam-tool-button" type="button" onClick={toggleFullscreen}>
          <span aria-hidden="true">⛶</span> {isFullscreen ? "Exit full screen" : "Full screen"}
        </button>
        <div className={`exam-timer${remaining <= 60000 ? " is-warning" : ""}`} aria-live="polite">
          <span>Time left</span>
          <strong>{formatTime(remaining)}</strong>
        </div>
      </div>
    </div>

    {error && <p className="alert alert-error" role="alert">{error}</p>}

    <div className="exam-layout">
      <section className="exam-question-panel" aria-labelledby="question-title">
        <div className="question-meta">
          <span>Question {question.questionNumber}</span>
          <span>{question.questionType.toUpperCase()}</span>
          <span>{question.marks} mark{question.marks === 1 ? "" : "s"}</span>
        </div>
        <h2 id="question-title">{question.questionText}</h2>
        <QuestionMedia key={question.questionId} images={question.questionImages} />

        {question.questionType === "mcq" && <div className="exam-options" role="radiogroup" aria-label="Answer options">
          {question.options.map((option, index) => <label className={`exam-option${question.answer === index ? " is-selected" : ""}`} key={index}>
            <input disabled={question.answerSubmitted} type="radio" name={`question-${question.questionId}`} checked={question.answer === index} onChange={() => chooseMcq(index)} />
            <span className="option-letter">{String.fromCharCode(65 + index)}</span>
            <span>{option}</span>
          </label>)}
        </div>}

        {question.questionType === "msq" && <div className="exam-options" aria-label="Answer options">
          {question.options.map((option, index) => <label className={`exam-option${question.answer?.includes(index) ? " is-selected" : ""}`} key={index}>
            <input disabled={question.answerSubmitted} type="checkbox" checked={question.answer?.includes(index) || false} onChange={() => toggleMsq(index)} />
            <span className="option-letter">{String.fromCharCode(65 + index)}</span>
            <span>{option}</span>
          </label>)}
        </div>}

        {question.questionType === "nat" && <div className="nat-answer field">
          <label htmlFor="nat-answer">Enter your numerical answer</label>
          <input disabled={question.answerSubmitted} id="nat-answer" inputMode="decimal" type="number" step="any" value={question.answer ?? ""} onChange={event => setNat(event.target.value)} />
        </div>}

        {hasAnswer(question) && <>
          <button className={question.answerSubmitted ? "solution-button exam-solution-button" : "primary-button exam-submit-question-button"} type="button" disabled={solutionLoading || (!question.answerSubmitted && savingQuestion === question.questionId)} onClick={question.answerSubmitted ? showSolution : submitQuestion}>
            {question.answerSubmitted ? (solutionLoading ? "Loading solution..." : "Solution") : "Submit"}
          </button>
          {solutions[question.questionId] && <div className="ai-solution-box"><strong>Solution</strong><SolutionContent text={solutions[question.questionId]} /><small>AI-generated explanations may contain mistakes. Verify against the answer key after submission.</small></div>}
        </>}

        <div className="exam-actions">
          <button className="secondary-button" type="button" disabled={currentIndex === 0} onClick={() => setCurrentIndex(index => index - 1)}>Previous</button>
          <button className={`review-button${question.markedForReview ? " is-marked" : ""}`} type="button" onClick={toggleReview}>
            {question.markedForReview ? "Remove review mark" : "Mark for review"}
          </button>
          {currentIndex < questions.length - 1 && <button className="primary-button" type="button" onClick={() => setCurrentIndex(index => index + 1)}>Next</button>}
        </div>
        <p className="exam-save-status" aria-live="polite">{savingQuestion === question.questionId ? "Saving answer..." : "Your answer is saved automatically."}</p>
      </section>

      <aside className="exam-sidebar" aria-label="Exam navigation">
        <div className="exam-sidebar-heading"><h2>Question map</h2><span>{answeredCount}/{questions.length} answered</span></div>
        <div className="exam-legend">
          <span><i className="legend-dot unanswered" />Not visited</span>
          <span><i className="legend-dot answered" />Answered</span>
          <span><i className="legend-dot review" />Review</span>
          <span><i className="legend-dot answered-review" />Answered + review</span>
        </div>
        <div className="question-map">
          {questions.map((item, index) => <button
            className={`question-map-button${index === currentIndex ? " current" : ""}${hasAnswer(item) ? " answered" : ""}${item.markedForReview ? " review" : ""}${hasAnswer(item) && item.markedForReview ? " answered-review" : ""}`}
            key={item.questionId}
            type="button"
            aria-label={`Go to question ${index + 1}${hasAnswer(item) ? ", answered" : ", unanswered"}${item.markedForReview ? ", marked for review" : ""}`}
            onClick={() => setCurrentIndex(index)}
          >{index + 1}</button>)}
        </div>
        <div className="exam-progress"><span>Marked for review</span><strong>{reviewCount}</strong></div>
        {calculatorOpen && <ScientificCalculator />}
        <button className="submit-exam-button" type="button" disabled={submitting} onClick={() => submitNow(false)}>{submitting ? "Submitting..." : "Submit test"}</button>
        <Link className="exam-exit-link" to="/student/tests">Leave and resume later</Link>
      </aside>
    </div>
  </div>;
}
