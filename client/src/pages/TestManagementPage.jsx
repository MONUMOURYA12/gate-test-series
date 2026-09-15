import { useEffect, useState } from "react";
import {
  branchApi,
  chapterApi,
  subjectApi,
  testApi,
} from "../services/api.js";
import TestForm from "../components/TestForm.jsx";
import TestList from "../components/TestList.jsx";

function TestManagementPage() {
  const [branches, setBranches] = useState([]);
  const [subjects, setSubjects] = useState([]);
  const [chapters, setChapters] = useState([]);
  const [tests, setTests] = useState([]);

  const [selectedBranch, setSelectedBranch] = useState("");
  const [selectedSubject, setSelectedSubject] = useState("");
  const [selectedChapter, setSelectedChapter] = useState("");

  const [isLoadingBranches, setIsLoadingBranches] = useState(true);
  const [isLoadingSubjects, setIsLoadingSubjects] = useState(false);
  const [isLoadingChapters, setIsLoadingChapters] = useState(false);
  const [isLoadingTests, setIsLoadingTests] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [syncingTestId, setSyncingTestId] = useState("");

  const [showTestForm, setShowTestForm] = useState(false);

  const [error, setError] = useState("");
  const [successMessage, setSuccessMessage] = useState("");

  useEffect(() => {
    const loadBranches = async () => {
      try {
        setError("");
        setIsLoadingBranches(true);

        const data = await branchApi.list();
        setBranches(data?.branches || []);
      } catch (err) {
        setError(err.message);
      } finally {
        setIsLoadingBranches(false);
      }
    };

    loadBranches();
  }, []);

  useEffect(() => {
    if (!selectedBranch) {
      setSubjects([]);
      setChapters([]);
      setTests([]);
      setSelectedSubject("");
      setSelectedChapter("");
      setShowTestForm(false);
      return;
    }

    const loadSubjects = async () => {
      try {
        setError("");
        setSuccessMessage("");
        setIsLoadingSubjects(true);

        const data = await subjectApi.listByBranch(selectedBranch);
        setSubjects(data?.subjects || []);

        setSelectedSubject("");
        setSelectedChapter("");
        setChapters([]);
        setTests([]);
        setShowTestForm(false);
      } catch (err) {
        setError(err.message);
      } finally {
        setIsLoadingSubjects(false);
      }
    };

    loadSubjects();
  }, [selectedBranch]);

  useEffect(() => {
    if (!selectedSubject) {
      setChapters([]);
      setTests([]);
      setSelectedChapter("");
      setShowTestForm(false);
      return;
    }

    const loadChapters = async () => {
      try {
        setError("");
        setSuccessMessage("");
        setIsLoadingChapters(true);

        const data = await chapterApi.listBySubject(selectedSubject);
        setChapters(data?.chapters || []);

        setSelectedChapter("");
        setTests([]);
        setShowTestForm(false);
      } catch (err) {
        setError(err.message);
      } finally {
        setIsLoadingChapters(false);
      }
    };

    loadChapters();
  }, [selectedSubject]);

  useEffect(() => {
    if (!selectedChapter) {
      setTests([]);
      setShowTestForm(false);
      return;
    }

    const loadTests = async () => {
      try {
        setError("");
        setIsLoadingTests(true);

        const data = await testApi.listByChapter(selectedChapter);
        setTests(data?.tests || []);
      } catch (err) {
        setError(err.message);
      } finally {
        setIsLoadingTests(false);
      }
    };

    loadTests();
  }, [selectedChapter]);

  const selectedChapterData = chapters.find(
    (chapter) => chapter._id === selectedChapter
  );

  const handleBranchChange = (event) => {
    setSelectedBranch(event.target.value);
  };

  const handleSubjectChange = (event) => {
    setSelectedSubject(event.target.value);
  };

  const handleChapterChange = (event) => {
    setSelectedChapter(event.target.value);
    setShowTestForm(false);
    setSuccessMessage("");
    setError("");
  };

  const handleCreateTest = async (payload, onSuccess) => {
    try {
      setError("");
      setSuccessMessage("");
      setIsSubmitting(true);

      await testApi.create(payload);

      onSuccess();

      setShowTestForm(false);

      const data = await testApi.listByChapter(selectedChapter);
      setTests(data?.tests || []);

      setSuccessMessage("Test created successfully.");
    } catch (err) {
      setError(err.message);
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleSyncTest = async (testId) => {
    try {
      setError("");
      setSuccessMessage("");
      setSyncingTestId(testId);

      const data = await testApi.sync(testId);

      const syncedTest = data?.test;

      setTests((currentTests) =>
        currentTests.map((test) =>
          test._id === testId && syncedTest
            ? {
                ...test,
                totalQuestions: syncedTest.totalQuestions,
                totalMarks: syncedTest.totalMarks,
              }
            : test
        )
      );

      setSuccessMessage(
        "Test statistics synchronized successfully."
      );
    } catch (err) {
      setError(err.message);
    } finally {
      setSyncingTestId("");
    }
  };

  const handleCancelForm = () => {
    if (isSubmitting) {
      return;
    }

    setShowTestForm(false);
  };

  return (
    <div>
      <div className="page-header-row">
        <div className="page-title">
          <h1>Test Management</h1>
          <p>
            Create and manage tests using the Branch → Subject → Chapter
            hierarchy.
          </p>
        </div>
      </div>

      {error ? (
        <div className="alert alert-error">
          {error}
        </div>
      ) : null}

      {successMessage ? (
        <div className="alert alert-success">
          {successMessage}
        </div>
      ) : null}

      <section className="management-panel">
        <div className="section-heading">
          <div>
            <h2>Test Selection</h2>
            <span>
              Select a branch, subject and chapter to view its tests.
            </span>
          </div>
        </div>

        <div className="form-grid">
          <div className="field">
            <label htmlFor="test-branch">
              Branch
            </label>

            <select
              id="test-branch"
              disabled={isLoadingBranches}
              onChange={handleBranchChange}
              value={selectedBranch}
            >
              <option value="">
                {isLoadingBranches
                  ? "Loading branches..."
                  : "Select a branch"}
              </option>

              {branches.map((branch) => (
                <option
                  key={branch._id}
                  value={branch._id}
                >
                  {branch.name} ({branch.code})
                </option>
              ))}
            </select>
          </div>

          <div className="field">
            <label htmlFor="test-subject">
              Subject
            </label>

            <select
              id="test-subject"
              disabled={!selectedBranch || isLoadingSubjects}
              onChange={handleSubjectChange}
              value={selectedSubject}
            >
              <option value="">
                {isLoadingSubjects
                  ? "Loading subjects..."
                  : !selectedBranch
                    ? "Select a branch first"
                    : "Select a subject"}
              </option>

              {subjects.map((subject) => (
                <option
                  key={subject._id}
                  value={subject._id}
                >
                  {subject.name}
                  {subject.code
                    ? ` (${subject.code})`
                    : ""}
                </option>
              ))}
            </select>
          </div>
        </div>

        <div className="field">
          <label htmlFor="test-chapter">
            Chapter
          </label>

          <select
            id="test-chapter"
            disabled={!selectedSubject || isLoadingChapters}
            onChange={handleChapterChange}
            value={selectedChapter}
          >
            <option value="">
              {isLoadingChapters
                ? "Loading chapters..."
                : !selectedSubject
                  ? "Select a subject first"
                  : "Select a chapter"}
            </option>

            {chapters.map((chapter) => (
              <option
                key={chapter._id}
                value={chapter._id}
              >
                {chapter.name}
              </option>
            ))}
          </select>
        </div>
      </section>

      {selectedChapter ? (
        <section className="management-panel">
          <div className="section-heading">
            <div>
              <h2>Add Test</h2>

              <span>
                Create a new test under{" "}
                {selectedChapterData?.name}.
              </span>
            </div>

            {!showTestForm ? (
              <button
                className="primary-button"
                onClick={() => {
                  setError("");
                  setSuccessMessage("");
                  setShowTestForm(true);
                }}
                type="button"
              >
                Add Test
              </button>
            ) : null}
          </div>

          {showTestForm ? (
            <TestForm
              chapter={selectedChapterData}
              isSubmitting={isSubmitting}
              onCancel={handleCancelForm}
              onSubmit={handleCreateTest}
            />
          ) : null}
        </section>
      ) : null}

      <section className="management-panel">
        <div className="section-heading">
          <div>
            <h2>Tests</h2>

            <span>
              {selectedChapterData
                ? `Tests in ${selectedChapterData.name}`
                : "Select a chapter to view tests"}
            </span>
          </div>

          {selectedChapter ? (
            <span>
              {tests.length}{" "}
              {tests.length === 1
                ? "test"
                : "tests"}
            </span>
          ) : null}
        </div>

        {!selectedChapter ? (
          <div className="empty-state">
            <strong>Select a chapter</strong>

            <p>
              Choose a branch, subject and chapter above
              to view its tests.
            </p>
          </div>
        ) : (
          <TestList
            tests={tests}
            isLoading={isLoadingTests}
            syncingTestId={syncingTestId}
            onSync={handleSyncTest}
          />
        )}
      </section>
    </div>
  );
}

export default TestManagementPage;