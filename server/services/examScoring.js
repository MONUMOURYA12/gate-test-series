function normalizeAnswer(question, answer) {
  if (answer === null) return null;
  const validOption = value => Number.isInteger(value) && value >= 0 && value < question.options.length;
  if (question.questionType === "mcq" && validOption(answer)) return answer;
  if (question.questionType === "msq" && Array.isArray(answer) && answer.every(validOption)) {
    return answer.length ? [...new Set(answer)].sort((a, b) => a - b) : null;
  }
  if (question.questionType === "nat" && typeof answer === "number" && Number.isFinite(answer)) return answer;
  const error = new Error("Enter a valid answer for this question.");
  error.status = 400;
  throw error;
}

function gradeQuestion(question) {
  const answer = question.answer;
  if (answer === null || answer === undefined || (Array.isArray(answer) && !answer.length)) {
    return { outcome: "unanswered", awardedMarks: 0 };
  }
  const expected = question.correctAnswer;
  const correct = question.questionType === "nat" && question.natAnswerMin != null && question.natAnswerMax != null
    ? answer >= question.natAnswerMin && answer <= question.natAnswerMax
    : question.questionType === "msq"
      ? new Set(answer).size === new Set(expected).size && answer.every(value => expected.includes(value))
      : answer === expected;
  return {
    outcome: correct ? "correct" : "incorrect",
    awardedMarks: correct ? question.marks : -question.negativeMarks,
  };
}

function scoreAttempt(attempt, submittedAt) {
  const result = { score: 0, totalMarks: 0, correct: 0, incorrect: 0, unanswered: 0 };
  for (const question of attempt.questions) {
    const grade = gradeQuestion(question);
    result[grade.outcome] += 1;
    result.score += grade.awardedMarks;
    result.totalMarks += question.marks;
  }
  result.score = Math.round(result.score * 10000) / 10000;
  result.totalMarks = Math.round(result.totalMarks * 10000) / 10000;
  result.timeTakenSeconds = Math.max(0, Math.floor((submittedAt - new Date(attempt.startedAt)) / 1000));
  return result;
}

module.exports = { normalizeAnswer, gradeQuestion, scoreAttempt };
