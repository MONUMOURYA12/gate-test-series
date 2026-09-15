import { useEffect, useState } from "react";

const initialFormData = {
  questionNumber: "",
  questionText: "",
  questionType: "mcq",
  optionA: "",
  optionB: "",
  optionC: "",
  optionD: "",
  mcqCorrectAnswer: "",
  msqCorrectAnswers: [],
  natCorrectAnswer: "",
  marks: "1",
  negativeMarks: "0",
  isPYQ: false,
  examName: "GATE",
  year: "",
  session: "",
  difficulty: "medium",
  category: "",
  topic: "",
  tags: "",
  explanation: "",
  isPublished: true,
};

function QuestionForm({
  branch,
  subject,
  chapter,
  test,
  question = null,
  isSubmitting,
  onCancel,
  onSubmit,
}) {
  const [formData, setFormData] = useState(initialFormData);
  const [validationError, setValidationError] = useState("");

  const isEditMode = Boolean(question?._id);

  useEffect(() => {
    if (!question) {
      setFormData(initialFormData);
      setValidationError("");
      return;
    }

    const options = question.options || [];

    let mcqCorrectAnswer = "";
    let msqCorrectAnswers = [];
    let natCorrectAnswer = "";

    if (question.questionType === "mcq") {
      mcqCorrectAnswer =
        question.correctAnswer !== undefined &&
        question.correctAnswer !== null
          ? String(question.correctAnswer)
          : "";
    }

    if (question.questionType === "msq") {
      msqCorrectAnswers = Array.isArray(question.correctAnswer)
        ? question.correctAnswer.map(Number)
        : [];
    }

    if (question.questionType === "nat") {
      natCorrectAnswer =
        question.correctAnswer !== undefined &&
        question.correctAnswer !== null
          ? String(question.correctAnswer)
          : "";
    }

    setFormData({
      questionNumber:
        question.questionNumber !== undefined
          ? String(question.questionNumber)
          : "",
      questionText: question.questionText || "",
      questionType: question.questionType || "mcq",
      optionA: options[0] || "",
      optionB: options[1] || "",
      optionC: options[2] || "",
      optionD: options[3] || "",
      mcqCorrectAnswer,
      msqCorrectAnswers,
      natCorrectAnswer,
      marks:
        question.marks !== undefined
          ? String(question.marks)
          : "1",
      negativeMarks:
        question.negativeMarks !== undefined
          ? String(question.negativeMarks)
          : "0",
      isPYQ: Boolean(question.isPYQ),
      examName: question.examName || "GATE",
      year:
        question.year !== undefined && question.year !== null
          ? String(question.year)
          : "",
      session: question.session || "",
      difficulty: question.difficulty || "medium",
      category: question.category || "",
      topic: question.topic || "",
      tags: Array.isArray(question.tags)
        ? question.tags.join(", ")
        : "",
      explanation: question.explanation || "",
      isPublished:
        question.isPublished !== undefined
          ? Boolean(question.isPublished)
          : true,
    });

    setValidationError("");
  }, [question]);

  const handleChange = (event) => {
    const { name, type, value, checked } = event.target;

    setFormData((current) => ({
      ...current,
      [name]: type === "checkbox" ? checked : value,
    }));
  };

  const handleQuestionTypeChange = (event) => {
    const newType = event.target.value;

    setFormData((current) => ({
      ...current,
      questionType: newType,
      mcqCorrectAnswer: "",
      msqCorrectAnswers: [],
      natCorrectAnswer: "",
    }));

    setValidationError("");
  };

  const handleMSQOptionChange = (optionIndex) => {
    setFormData((current) => {
      const exists = current.msqCorrectAnswers.includes(optionIndex);

      const updatedAnswers = exists
        ? current.msqCorrectAnswers.filter(
            (index) => index !== optionIndex
          )
        : [...current.msqCorrectAnswers, optionIndex].sort(
            (a, b) => a - b
          );

      return {
        ...current,
        msqCorrectAnswers: updatedAnswers,
      };
    });
  };

  const handleSubmit = (event) => {
    event.preventDefault();
    setValidationError("");

    const questionNumber = Number(formData.questionNumber);
    const questionText = formData.questionText.trim();

    const marks = Number(formData.marks);
    const negativeMarks = Number(formData.negativeMarks);

    const year = formData.year
      ? Number(formData.year)
      : undefined;

    if (!branch?._id) {
      setValidationError("Branch selection is required.");
      return;
    }

    if (!subject?._id) {
      setValidationError("Subject selection is required.");
      return;
    }

    if (!chapter?._id) {
      setValidationError("Chapter selection is required.");
      return;
    }

    if (!test?._id) {
      setValidationError("Test selection is required.");
      return;
    }

    if (
      !Number.isInteger(questionNumber) ||
      questionNumber < 1
    ) {
      setValidationError(
        "Question number must be a positive number."
      );
      return;
    }

    if (!questionText) {
      setValidationError("Question text is required.");
      return;
    }

    if (!Number.isFinite(marks) || marks < 0) {
      setValidationError(
        "Marks must be a valid non-negative number."
      );
      return;
    }

    if (
      !Number.isFinite(negativeMarks) ||
      negativeMarks < 0
    ) {
      setValidationError(
        "Negative marks must be a valid non-negative number."
      );
      return;
    }

    const options = [
      formData.optionA.trim(),
      formData.optionB.trim(),
      formData.optionC.trim(),
      formData.optionD.trim(),
    ];

    if (
      formData.questionType === "mcq" ||
      formData.questionType === "msq"
    ) {
      if (options.some((option) => !option)) {
        setValidationError(
          "All four options (A, B, C and D) are required for MCQ/MSQ."
        );
        return;
      }
    }

    let correctAnswer;

    if (formData.questionType === "mcq") {
      if (formData.mcqCorrectAnswer === "") {
        setValidationError(
          "Please select the correct answer for MCQ."
        );
        return;
      }

      correctAnswer = Number(formData.mcqCorrectAnswer);

      if (
        !Number.isInteger(correctAnswer) ||
        correctAnswer < 0 ||
        correctAnswer >= options.length
      ) {
        setValidationError(
          "Please select a valid MCQ correct answer."
        );
        return;
      }
    }

    if (formData.questionType === "msq") {
      if (formData.msqCorrectAnswers.length === 0) {
        setValidationError(
          "Please select at least one correct answer for MSQ."
        );
        return;
      }

      correctAnswer = formData.msqCorrectAnswers;
    }

    if (formData.questionType === "nat") {
      if (formData.natCorrectAnswer.trim() === "") {
        setValidationError(
          "NAT correct answer is required."
        );
        return;
      }

      correctAnswer = Number(formData.natCorrectAnswer);

      if (Number.isNaN(correctAnswer)) {
        setValidationError(
          "NAT correct answer must be a number."
        );
        return;
      }
    }

    if (formData.isPYQ && !year) {
      setValidationError(
        "Year is required for previous year questions."
      );
      return;
    }

    const tags = formData.tags
      .split(",")
      .map((tag) => tag.trim())
      .filter(Boolean);

    const payload = {
      branch: branch._id,
      subject: subject._id,
      chapter: chapter._id,
      test: test._id,

      questionNumber,
      questionText,
      questionType: formData.questionType,

      options:
        formData.questionType === "nat"
          ? []
          : options,

      correctAnswer,

      marks,
      negativeMarks,

      isPYQ: formData.isPYQ,
      examName: formData.examName.trim() || "GATE",
      year,

      session: formData.session.trim(),

      difficulty: formData.difficulty,

      category: formData.category.trim(),
      topic: formData.topic.trim(),

      tags,

      explanation: formData.explanation.trim(),

      solutionType: isEditMode
        ? question.solutionType || "manual"
        : "manual",

      aiSolutionGenerated:
        isEditMode
          ? Boolean(question.aiSolutionGenerated)
          : false,

      aiSolutionModel:
        isEditMode
          ? question.aiSolutionModel || ""
          : "",

      isActive:
        isEditMode
          ? question.isActive !== false
          : true,

      isPublished: formData.isPublished,
    };

    onSubmit(payload, () => {
      setFormData(initialFormData);
      setValidationError("");
    });
  };

  return (
    <form
      className="management-form question-form"
      onSubmit={handleSubmit}
    >
      {validationError ? (
        <div className="alert alert-error">
          {validationError}
        </div>
      ) : null}

      <div className="question-context">
        <div>
          <strong>Branch</strong>
          <span>{branch?.name || "-"}</span>
        </div>

        <div>
          <strong>Subject</strong>
          <span>{subject?.name || "-"}</span>
        </div>

        <div>
          <strong>Chapter</strong>
          <span>{chapter?.name || "-"}</span>
        </div>

        <div>
          <strong>Test</strong>
          <span>{test?.title || "-"}</span>
        </div>
      </div>

      {isEditMode ? (
        <div className="alert">
          Editing Question #{question.questionNumber}
        </div>
      ) : null}

      <div className="form-grid">
        <div className="field">
          <label htmlFor="question-number">
            Question Number
          </label>

          <input
            disabled={isSubmitting}
            id="question-number"
            min="1"
            name="questionNumber"
            onChange={handleChange}
            placeholder="1"
            type="number"
            value={formData.questionNumber}
          />
        </div>

        <div className="field">
          <label htmlFor="question-type">
            Question Type
          </label>

          <select
            disabled={isSubmitting}
            id="question-type"
            name="questionType"
            onChange={handleQuestionTypeChange}
            value={formData.questionType}
          >
            <option value="mcq">MCQ</option>
            <option value="msq">MSQ</option>
            <option value="nat">NAT</option>
          </select>
        </div>
      </div>

      <div className="field">
        <label htmlFor="question-text">
          Question Text
        </label>

        <textarea
          disabled={isSubmitting}
          id="question-text"
          name="questionText"
          onChange={handleChange}
          placeholder="Enter the complete question..."
          rows="6"
          value={formData.questionText}
        />
      </div>

      {formData.questionType === "mcq" ||
      formData.questionType === "msq" ? (
        <div className="question-options-section">
          <div className="section-heading">
            <div>
              <h3>Options</h3>
              <span>Enter all four options.</span>
            </div>
          </div>

          <div className="form-grid">
            <div className="field">
              <label htmlFor="question-option-a">
                Option A
              </label>

              <input
                disabled={isSubmitting}
                id="question-option-a"
                name="optionA"
                onChange={handleChange}
                placeholder="Option A"
                type="text"
                value={formData.optionA}
              />
            </div>

            <div className="field">
              <label htmlFor="question-option-b">
                Option B
              </label>

              <input
                disabled={isSubmitting}
                id="question-option-b"
                name="optionB"
                onChange={handleChange}
                placeholder="Option B"
                type="text"
                value={formData.optionB}
              />
            </div>

            <div className="field">
              <label htmlFor="question-option-c">
                Option C
              </label>

              <input
                disabled={isSubmitting}
                id="question-option-c"
                name="optionC"
                onChange={handleChange}
                placeholder="Option C"
                type="text"
                value={formData.optionC}
              />
            </div>

            <div className="field">
              <label htmlFor="question-option-d">
                Option D
              </label>

              <input
                disabled={isSubmitting}
                id="question-option-d"
                name="optionD"
                onChange={handleChange}
                placeholder="Option D"
                type="text"
                value={formData.optionD}
              />
            </div>
          </div>

          {formData.questionType === "mcq" ? (
            <div className="field">
              <label htmlFor="mcq-correct-answer">
                Correct Answer
              </label>

              <select
                disabled={isSubmitting}
                id="mcq-correct-answer"
                name="mcqCorrectAnswer"
                onChange={handleChange}
                value={formData.mcqCorrectAnswer}
              >
                <option value="">
                  Select correct option
                </option>
                <option value="0">A</option>
                <option value="1">B</option>
                <option value="2">C</option>
                <option value="3">D</option>
              </select>
            </div>
          ) : null}

          {formData.questionType === "msq" ? (
            <div className="field">
              <label>Correct Answers</label>

              <div className="question-answer-options">
                {[
                  { index: 0, label: "A" },
                  { index: 1, label: "B" },
                  { index: 2, label: "C" },
                  { index: 3, label: "D" },
                ].map((option) => (
                  <label
                    className="check-field"
                    key={option.index}
                  >
                    <input
                      checked={formData.msqCorrectAnswers.includes(
                        option.index
                      )}
                      disabled={isSubmitting}
                      onChange={() =>
                        handleMSQOptionChange(option.index)
                      }
                      type="checkbox"
                    />

                    <span>{option.label}</span>
                  </label>
                ))}
              </div>
            </div>
          ) : null}
        </div>
      ) : null}

      {formData.questionType === "nat" ? (
        <div className="field">
          <label htmlFor="nat-correct-answer">
            Correct Numerical Answer
          </label>

          <input
            disabled={isSubmitting}
            id="nat-correct-answer"
            name="natCorrectAnswer"
            onChange={handleChange}
            placeholder="Example: 3.14"
            step="any"
            type="number"
            value={formData.natCorrectAnswer}
          />
        </div>
      ) : null}

      <div className="form-grid">
        <div className="field">
          <label htmlFor="question-marks">
            Marks
          </label>

          <input
            disabled={isSubmitting}
            id="question-marks"
            min="0"
            name="marks"
            onChange={handleChange}
            step="0.5"
            type="number"
            value={formData.marks}
          />
        </div>

        <div className="field">
          <label htmlFor="question-negative-marks">
            Negative Marks
          </label>

          <input
            disabled={isSubmitting}
            id="question-negative-marks"
            min="0"
            name="negativeMarks"
            onChange={handleChange}
            step="0.5"
            type="number"
            value={formData.negativeMarks}
          />
        </div>
      </div>

      <div className="question-pyq-section">
        <label
          className="check-field"
          htmlFor="question-pyq"
        >
          <input
            checked={formData.isPYQ}
            disabled={isSubmitting}
            id="question-pyq"
            name="isPYQ"
            onChange={handleChange}
            type="checkbox"
          />

          <span>
            This is a Previous Year Question (PYQ)
          </span>
        </label>
      </div>

      <div className="form-grid">
        <div className="field">
          <label htmlFor="question-exam-name">
            Exam Name
          </label>

          <input
            disabled={isSubmitting}
            id="question-exam-name"
            name="examName"
            onChange={handleChange}
            placeholder="GATE"
            type="text"
            value={formData.examName}
          />
        </div>

        <div className="field">
          <label htmlFor="question-year">
            Year
          </label>

          <input
            disabled={isSubmitting}
            id="question-year"
            max="2100"
            min="1980"
            name="year"
            onChange={handleChange}
            placeholder="2025"
            type="number"
            value={formData.year}
          />
        </div>
      </div>

      <div className="form-grid">
        <div className="field">
          <label htmlFor="question-session">
            Session
          </label>

          <input
            disabled={isSubmitting}
            id="question-session"
            name="session"
            onChange={handleChange}
            placeholder="For example: Session 1"
            type="text"
            value={formData.session}
          />
        </div>

        <div className="field">
          <label htmlFor="question-difficulty">
            Difficulty
          </label>

          <select
            disabled={isSubmitting}
            id="question-difficulty"
            name="difficulty"
            onChange={handleChange}
            value={formData.difficulty}
          >
            <option value="easy">Easy</option>
            <option value="medium">Medium</option>
            <option value="hard">Hard</option>
          </select>
        </div>
      </div>

      <div className="form-grid">
        <div className="field">
          <label htmlFor="question-category">
            Category
          </label>

          <input
            disabled={isSubmitting}
            id="question-category"
            name="category"
            onChange={handleChange}
            placeholder="Conceptual"
            type="text"
            value={formData.category}
          />
        </div>

        <div className="field">
          <label htmlFor="question-topic">
            Topic
          </label>

          <input
            disabled={isSubmitting}
            id="question-topic"
            name="topic"
            onChange={handleChange}
            placeholder="Matrix Operations"
            type="text"
            value={formData.topic}
          />
        </div>
      </div>

      <div className="field">
        <label htmlFor="question-tags">
          Tags
        </label>

        <input
          disabled={isSubmitting}
          id="question-tags"
          name="tags"
          onChange={handleChange}
          placeholder="matrix, determinant, eigenvalue"
          type="text"
          value={formData.tags}
        />

        <small>
          Enter multiple tags separated by commas.
        </small>
      </div>

      <div className="field">
        <label htmlFor="question-explanation">
          Explanation
        </label>

        <textarea
          disabled={isSubmitting}
          id="question-explanation"
          name="explanation"
          onChange={handleChange}
          placeholder="Enter the solution or explanation..."
          rows="6"
          value={formData.explanation}
        />
      </div>

      <label
        className="check-field"
        htmlFor="question-published"
      >
        <input
          checked={formData.isPublished}
          disabled={isSubmitting}
          id="question-published"
          name="isPublished"
          onChange={handleChange}
          type="checkbox"
        />

        <span>Published</span>
      </label>

      <div className="form-actions">
        <button
          className="primary-button"
          disabled={isSubmitting}
          type="submit"
        >
          {isSubmitting
            ? isEditMode
              ? "Updating..."
              : "Saving..."
            : isEditMode
              ? "Update Question"
              : "Save Question"}
        </button>

        <button
          className="secondary-button"
          disabled={isSubmitting}
          onClick={onCancel}
          type="button"
        >
          Cancel
        </button>
      </div>
    </form>
  );
}

export default QuestionForm;