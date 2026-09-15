function TestList({
  tests,
  isLoading,
  syncingTestId,
  onSync,
}) {
  if (isLoading) {
    return (
      <div className="loading-state">
        Loading tests...
      </div>
    );
  }

  if (tests.length === 0) {
    return (
      <div className="empty-state">
        <strong>No tests found</strong>
        <p>
          This chapter does not have any tests yet.
        </p>
      </div>
    );
  }

  return (
    <div className="table-card">
      <div className="test-table">
        <div className="test-row test-row-head">
          <span>Test</span>
          <span>Duration</span>
          <span>Questions</span>
          <span>Marks</span>
          <span>Negative</span>
          <span>Status</span>
          <span>Action</span>
        </div>

        {tests.map((test) => {
          const isSyncing = syncingTestId === test._id;

          return (
            <div className="test-row" key={test._id}>
              <div className="test-name">
                <strong>{test.title}</strong>

                {test.description ? (
                  <span>{test.description}</span>
                ) : null}
              </div>

              <span>{test.duration} min</span>

              <span>{test.totalQuestions}</span>

              <span>{test.totalMarks}</span>

              <span>
                {test.negativeMarking ? "Yes" : "No"}
              </span>

              <span
                className={`status-pill ${
                  test.isPublished ? "active" : "inactive"
                }`}
              >
                {test.isPublished ? "Published" : "Draft"}
              </span>

              <button
                className="secondary-button"
                disabled={isSyncing}
                onClick={() => onSync(test._id)}
                type="button"
              >
                {isSyncing ? "Syncing..." : "Sync"}
              </button>
            </div>
          );
        })}
      </div>
    </div>
  );
}

export default TestList;