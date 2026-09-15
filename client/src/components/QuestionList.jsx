function QuestionList({
  questions,
  pagination,
  isLoading,
  currentPage,
  onPageChange,
  onEdit,
  onDelete,
  deletingQuestionId,
}) {
  if (isLoading) {
    return (
      <div className="loading-state">
        Loading questions...
      </div>
    );
  }

  if (questions.length === 0) {
    return (
      <div className="empty-state">
        <strong>No questions found</strong>

        <p>
          No questions match the current search or filters.
        </p>
      </div>
    );
  }

  const totalPages =
    pagination?.totalPages || 1;

  return (
    <div>
      <div className="table-card">
        <div className="question-table">
          <div className="question-row question-row-head">
            <span>Q. No.</span>
            <span>Question</span>
            <span>Type</span>
            <span>Marks</span>
            <span>Negative</span>
            <span>PYQ</span>
            <span>Difficulty</span>
            <span>Topic</span>
            <span>Status</span>
            <span>Actions</span>
          </div>

          {questions.map((question) => {
            const isDeleting =
              deletingQuestionId ===
              question._id;

            return (
              <div
                className="question-row"
                key={question._id}
              >
                <strong>
                  {question.questionNumber ||
                    "-"}
                </strong>

                <div className="question-preview">
                  <strong>
                    {question.questionText}
                  </strong>

                  {question.options?.length >
                  0 ? (
                    <div className="question-options-preview">
                      {question.options.map(
                        (option, index) => (
                          <span key={index}>
                            {String.fromCharCode(
                              65 + index
                            )}
                            . {option}
                          </span>
                        )
                      )}
                    </div>
                  ) : null}

                  {question.requiresReview ? (
                    <small className="question-review-note">
                      Source page {question.sourcePage || "needs checking"}
                    </small>
                  ) : null}
                </div>

                <span className="question-type">
                  {question.questionType?.toUpperCase()}
                </span>

                <span>
                  {question.marks}
                </span>

                <span>
                  {question.negativeMarks}
                </span>

                <span>
                  {question.isPYQ
                    ? question.year ||
                      "Yes"
                    : "No"}
                </span>

                <span
                  className={`difficulty-pill difficulty-${question.difficulty}`}
                >
                  {question.difficulty}
                </span>

                <span>
                  {question.topic || "-"}
                </span>

                <span
                  className={`status-pill ${
                    question.requiresReview
                      ? "review"
                      : question.isPublished
                      ? "active"
                      : "inactive"
                  }`}
                >
                  {question.requiresReview
                    ? "Needs review"
                    : question.isPublished
                    ? "Published"
                    : "Draft"}
                </span>

                <div className="question-actions">
                  <button
                    className="secondary-button"
                    disabled={isDeleting}
                    onClick={() =>
                      onEdit(question)
                    }
                    type="button"
                  >
                    Edit
                  </button>

                  <button
                    className="danger-button"
                    disabled={isDeleting}
                    onClick={() =>
                      onDelete(question)
                    }
                    type="button"
                  >
                    {isDeleting
                      ? "Deleting..."
                      : "Delete"}
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {totalPages > 1 ? (
        <div className="pagination">
          <button
            className="secondary-button"
            disabled={currentPage <= 1}
            onClick={() =>
              onPageChange(
                currentPage - 1
              )
            }
            type="button"
          >
            Previous
          </button>

          <span className="pagination-info">
            Page {currentPage} of{" "}
            {totalPages}
          </span>

          <button
            className="secondary-button"
            disabled={
              currentPage >= totalPages
            }
            onClick={() =>
              onPageChange(
                currentPage + 1
              )
            }
            type="button"
          >
            Next
          </button>
        </div>
      ) : null}
    </div>
  );
}

export default QuestionList;
