import { useEffect, useState } from "react";
import { branchApi } from "../services/api";

function StudentDashboard() {
  const [branches, setBranches] = useState([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    const loadBranches = async () => {
      try {
        setIsLoading(true);
        setError("");

        const data = await branchApi.list();

        setBranches(data?.branches || []);
      } catch (requestError) {
        setError(
          requestError.message ||
            "Unable to load available exams."
        );
      } finally {
        setIsLoading(false);
      }
    };

    loadBranches();
  }, []);

  return (
    <div className="student-page">
      <header className="student-header">
        <div>
          <p className="student-eyebrow">
            GATE Test Series
          </p>

          <h1>Student Dashboard</h1>

          <p className="student-subtitle">
            Practice with free test series and improve
            your preparation.
          </p>
        </div>
      </header>

      {error ? (
        <div className="alert alert-error">
          {error}
        </div>
      ) : null}

      <section className="student-section">
        <div className="student-section-heading">
          <div>
            <h2>Available Exams</h2>

            <p>
              Choose your branch to explore subjects,
              chapters and tests.
            </p>
          </div>
        </div>

        {isLoading ? (
          <div className="loading-state">
            <p>Loading available exams...</p>
          </div>
        ) : branches.length === 0 ? (
          <div className="empty-state">
            <strong>No exams available</strong>

            <p>
              Test series will appear here when they
              become available.
            </p>
          </div>
        ) : (
          <div className="student-card-grid">
            {branches.map((branch) => (
              <article
                className="student-exam-card"
                key={branch._id}
              >
                <div className="student-card-icon">
                  {branch.code || "GATE"}
                </div>

                <div className="student-card-content">
                  <span className="student-card-label">
                    GATE
                  </span>

                  <h3>{branch.name}</h3>

                  {branch.description ? (
                    <p>{branch.description}</p>
                  ) : (
                    <p>
                      Practice branch-wise test series
                      and prepare effectively.
                    </p>
                  )}

                  <button
                    className="primary-button"
                    type="button"
                    disabled
                  >
                    Explore Tests
                  </button>
                </div>
              </article>
            ))}
          </div>
        )}
      </section>
    </div>
  );
}

export default StudentDashboard;