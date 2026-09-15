import { useEffect, useState } from "react";
import ChapterForm from "../components/ChapterForm.jsx";
import ChapterList from "../components/ChapterList.jsx";
import { chapterApi, subjectApi } from "../services/api";

function getFriendlyError(error) {
  if (error.message === "Chapter already exists in this subject") {
    return "Chapter already exists in this subject.";
  }

  if (error.message === "Subject not found") {
    return "Selected subject was not found.";
  }

  if (error.message === "Chapter name and subject are required") {
    return "Chapter name and subject are required.";
  }

  if (error.message === "Authentication required. Please login first.") {
    return "Authentication required. Please login again.";
  }

  if (error.message === "Admin access required") {
    return "Admin access required.";
  }

  if (error.message === "Server error") {
    return "Server error. Please try again.";
  }

  return error.message || "Unable to complete the request.";
}

function ChapterManagementPage() {
  const [subjects, setSubjects] = useState([]);
  const [chapters, setChapters] = useState([]);
  const [selectedSubject, setSelectedSubject] = useState("");
  const [isLoading, setIsLoading] = useState(true);
  const [isFormOpen, setIsFormOpen] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");

  const loadChapters = async (subjectId = selectedSubject) => {
    const data = subjectId
      ? await chapterApi.listBySubject(subjectId)
      : await chapterApi.list();

    setChapters(data.chapters || []);
  };

  useEffect(() => {
    let isMounted = true;

    const loadInitialData = async () => {
      try {
        const [subjectData, chapterData] = await Promise.all([
          subjectApi.list(),
          chapterApi.list(),
        ]);

        if (isMounted) {
          setSubjects(subjectData.subjects || []);
          setChapters(chapterData.chapters || []);
        }
      } catch (loadError) {
        if (isMounted) {
          setError(getFriendlyError(loadError));
        }
      } finally {
        if (isMounted) {
          setIsLoading(false);
        }
      }
    };

    loadInitialData();

    return () => {
      isMounted = false;
    };
  }, []);

  const handleSubjectFilterChange = async (event) => {
    const subjectId = event.target.value;

    setSelectedSubject(subjectId);
    setError("");
    setSuccess("");
    setIsLoading(true);

    try {
      await loadChapters(subjectId);
    } catch (loadError) {
      setError(getFriendlyError(loadError));
    } finally {
      setIsLoading(false);
    }
  };

  const handleCreateChapter = async (payload, resetForm) => {
    setError("");
    setSuccess("");
    setIsSubmitting(true);

    try {
      await chapterApi.create(payload);
      resetForm();
      setIsFormOpen(false);
      setSuccess("Chapter created successfully.");
      await loadChapters();
    } catch (createError) {
      setError(getFriendlyError(createError));
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <>
      <div className="page-header-row">
        <div className="page-title">
          <h1>Chapters</h1>
          <p>Manage chapters under each GATE subject.</p>
        </div>

        <button
          className="primary-button"
          onClick={() => {
            setError("");
            setSuccess("");
            setIsFormOpen(true);
          }}
          type="button"
        >
          + Add Chapter
        </button>
      </div>

      {success ? <div className="alert alert-success">{success}</div> : null}
      {error ? <div className="alert alert-error">{error}</div> : null}

      <section className="management-panel" aria-labelledby="chapter-filter-title">
        <div className="section-heading">
          <h2 id="chapter-filter-title">Filter Chapters</h2>
          <span>{subjects.length} active subjects</span>
        </div>

        <div className="field filter-field">
          <label htmlFor="chapter-subject-filter">Subject</label>
          <select
            disabled={isLoading}
            id="chapter-subject-filter"
            onChange={handleSubjectFilterChange}
            value={selectedSubject}
          >
            <option value="">All Subjects</option>
            {subjects.map((subject) => (
              <option key={subject._id} value={subject._id}>
                {subject.code ? `${subject.code} - ` : ""}
                {subject.name}
              </option>
            ))}
          </select>
        </div>
      </section>

      {isFormOpen ? (
        <section className="management-panel" aria-labelledby="chapter-form-title">
          <h2 id="chapter-form-title">Add Chapter</h2>
          <ChapterForm
            isSubmitting={isSubmitting}
            onCancel={() => setIsFormOpen(false)}
            onSubmit={handleCreateChapter}
            subjects={subjects}
          />
        </section>
      ) : null}

      <section className="management-panel" aria-labelledby="chapter-list-title">
        <div className="section-heading">
          <h2 id="chapter-list-title">Chapter List</h2>
          <span>{chapters.length} active chapters</span>
        </div>

        {isLoading ? (
          <div className="loading-state">Loading chapters...</div>
        ) : (
          <ChapterList chapters={chapters} subjects={subjects} />
        )}
      </section>
    </>
  );
}

export default ChapterManagementPage;
