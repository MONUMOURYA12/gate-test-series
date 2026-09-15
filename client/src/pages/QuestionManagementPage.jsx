import { useEffect, useRef, useState } from "react";
import {
  branchApi,
  chapterApi,
  questionApi,
  subjectApi,
  testApi,
} from "../services/api";
import QuestionForm from "../components/QuestionForm.jsx";
import QuestionList from "../components/QuestionList.jsx";

function QuestionManagementPage() {
  const [branches, setBranches] = useState([]);
  const [subjects, setSubjects] = useState([]);
  const [chapters, setChapters] = useState([]);
  const [tests, setTests] = useState([]);
  const [questions, setQuestions] = useState([]);

  const [selectedBranchId, setSelectedBranchId] = useState("");
  const [selectedSubjectId, setSelectedSubjectId] = useState("");
  const [selectedChapterId, setSelectedChapterId] = useState("");
  const [selectedTestId, setSelectedTestId] = useState("");

  const [selectedBranch, setSelectedBranch] = useState(null);
  const [selectedSubject, setSelectedSubject] = useState(null);
  const [selectedChapter, setSelectedChapter] = useState(null);
  const [selectedTest, setSelectedTest] = useState(null);

  const [showQuestionForm, setShowQuestionForm] = useState(false);
  const [editingQuestion, setEditingQuestion] = useState(null);

  const [isLoadingBranches, setIsLoadingBranches] = useState(true);
  const [isLoadingSubjects, setIsLoadingSubjects] = useState(false);
  const [isLoadingChapters, setIsLoadingChapters] = useState(false);
  const [isLoadingTests, setIsLoadingTests] = useState(false);
  const [isLoadingQuestions, setIsLoadingQuestions] = useState(false);

  const [isSubmittingQuestion, setIsSubmittingQuestion] =
    useState(false);

  const [deletingQuestionId, setDeletingQuestionId] = useState("");

  const [error, setError] = useState("");
  const [successMessage, setSuccessMessage] = useState("");

  const [currentPage, setCurrentPage] = useState(1);
  const [pagination, setPagination] = useState(null);

  const [searchInput, setSearchInput] = useState("");
  const [questionTypeInput, setQuestionTypeInput] = useState("");
  const [difficultyInput, setDifficultyInput] = useState("");
  const [pyqInput, setPyqInput] = useState("");
  const [yearInput, setYearInput] = useState("");

  const [filters, setFilters] = useState({
    search: "",
    questionType: "",
    difficulty: "",
    isPYQ: "",
    year: "",
  });

  const [selectedExcelFile, setSelectedExcelFile] = useState(null);
  const [isUploadingExcel, setIsUploadingExcel] = useState(false);
  const [uploadErrors, setUploadErrors] = useState([]);
  const [existingQuestionNumbers, setExistingQuestionNumbers] =
    useState([]);

  const fileInputRef = useRef(null);

  useEffect(() => {
    loadBranches();
  }, []);

  const loadBranches = async () => {
    try {
      setIsLoadingBranches(true);
      setError("");

      const data = await branchApi.list();

      setBranches(data?.branches || []);
    } catch (requestError) {
      setError(requestError.message);
    } finally {
      setIsLoadingBranches(false);
    }
  };

  const loadSubjects = async (branchId) => {
    try {
      setIsLoadingSubjects(true);
      setError("");

      const data = await subjectApi.listByBranch(branchId);

      setSubjects(data?.subjects || []);
    } catch (requestError) {
      setSubjects([]);
      setError(requestError.message);
    } finally {
      setIsLoadingSubjects(false);
    }
  };

  const loadChapters = async (subjectId) => {
    try {
      setIsLoadingChapters(true);
      setError("");

      const data = await chapterApi.listBySubject(subjectId);

      setChapters(data?.chapters || []);
    } catch (requestError) {
      setChapters([]);
      setError(requestError.message);
    } finally {
      setIsLoadingChapters(false);
    }
  };

  const loadTests = async (chapterId) => {
    try {
      setIsLoadingTests(true);
      setError("");

      const data = await testApi.listByChapter(chapterId);

      setTests(data?.tests || []);
    } catch (requestError) {
      setTests([]);
      setError(requestError.message);
    } finally {
      setIsLoadingTests(false);
    }
  };

  const loadQuestions = async (
    testId,
    page = 1,
    activeFilters = filters
  ) => {
    if (!testId) {
      setQuestions([]);
      setPagination(null);
      return;
    }

    try {
      setIsLoadingQuestions(true);
      setError("");

      const params = new URLSearchParams();

      params.set("page", String(page));
      params.set("limit", "10");

      if (activeFilters.search.trim()) {
        params.set("search", activeFilters.search.trim());
      }

      if (activeFilters.questionType) {
        params.set("questionType", activeFilters.questionType);
      }

      if (activeFilters.difficulty) {
        params.set("difficulty", activeFilters.difficulty);
      }

      if (activeFilters.isPYQ !== "") {
        params.set("isPYQ", activeFilters.isPYQ);
      }

      if (activeFilters.year) {
        params.set("year", activeFilters.year);
      }

      const data = await questionApi.listByTest(
        testId,
        `?${params.toString()}`
      );

      setQuestions(data?.questions || []);
      setPagination(data?.pagination || null);
      setCurrentPage(page);
    } catch (requestError) {
      setQuestions([]);
      setPagination(null);
      setError(requestError.message);
    } finally {
      setIsLoadingQuestions(false);
    }
  };

  const resetBulkUploadState = () => {
    setSelectedExcelFile(null);
    setUploadErrors([]);
    setExistingQuestionNumbers([]);

    if (fileInputRef.current) {
      fileInputRef.current.value = "";
    }
  };

  const handleBranchChange = async (event) => {
    const branchId = event.target.value;

    setSelectedBranchId(branchId);
    setSelectedSubjectId("");
    setSelectedChapterId("");
    setSelectedTestId("");

    setSelectedBranch(
      branches.find((branch) => branch._id === branchId) || null
    );

    setSelectedSubject(null);
    setSelectedChapter(null);
    setSelectedTest(null);

    setSubjects([]);
    setChapters([]);
    setTests([]);
    setQuestions([]);
    setPagination(null);

    setShowQuestionForm(false);
    setEditingQuestion(null);

    setError("");
    setSuccessMessage("");

    resetBulkUploadState();

    if (branchId) {
      await loadSubjects(branchId);
    }
  };

  const handleSubjectChange = async (event) => {
    const subjectId = event.target.value;

    setSelectedSubjectId(subjectId);
    setSelectedChapterId("");
    setSelectedTestId("");

    setSelectedSubject(
      subjects.find((subject) => subject._id === subjectId) || null
    );

    setSelectedChapter(null);
    setSelectedTest(null);

    setChapters([]);
    setTests([]);
    setQuestions([]);
    setPagination(null);

    setShowQuestionForm(false);
    setEditingQuestion(null);

    setError("");
    setSuccessMessage("");

    resetBulkUploadState();

    if (subjectId) {
      await loadChapters(subjectId);
    }
  };

  const handleChapterChange = async (event) => {
    const chapterId = event.target.value;

    setSelectedChapterId(chapterId);
    setSelectedTestId("");

    setSelectedChapter(
      chapters.find((chapter) => chapter._id === chapterId) || null
    );

    setSelectedTest(null);

    setTests([]);
    setQuestions([]);
    setPagination(null);

    setShowQuestionForm(false);
    setEditingQuestion(null);

    setError("");
    setSuccessMessage("");

    resetBulkUploadState();

    if (chapterId) {
      await loadTests(chapterId);
    }
  };

  const handleTestChange = async (event) => {
    const testId = event.target.value;

    setSelectedTestId(testId);

    const test =
      tests.find((item) => item._id === testId) || null;

    setSelectedTest(test);

    setQuestions([]);
    setPagination(null);

    setShowQuestionForm(false);
    setEditingQuestion(null);

    setCurrentPage(1);

    setError("");
    setSuccessMessage("");

    resetBulkUploadState();

    if (testId) {
      await loadQuestions(testId, 1, filters);
    }
  };

  const handleApplyFilters = async () => {
    const nextFilters = {
      search: searchInput,
      questionType: questionTypeInput,
      difficulty: difficultyInput,
      isPYQ: pyqInput,
      year: yearInput,
    };

    setFilters(nextFilters);
    setCurrentPage(1);

    if (selectedTestId) {
      await loadQuestions(
        selectedTestId,
        1,
        nextFilters
      );
    }
  };

  const handleResetFilters = async () => {
    const emptyFilters = {
      search: "",
      questionType: "",
      difficulty: "",
      isPYQ: "",
      year: "",
    };

    setSearchInput("");
    setQuestionTypeInput("");
    setDifficultyInput("");
    setPyqInput("");
    setYearInput("");

    setFilters(emptyFilters);
    setCurrentPage(1);

    if (selectedTestId) {
      await loadQuestions(
        selectedTestId,
        1,
        emptyFilters
      );
    }
  };

  const handleSearchKeyDown = (event) => {
    if (event.key === "Enter") {
      handleApplyFilters();
    }
  };

  const handleAddQuestion = () => {
    setEditingQuestion(null);
    setShowQuestionForm(true);
    setError("");
    setSuccessMessage("");
  };

  const handleEditQuestion = (question) => {
    setEditingQuestion(question);
    setShowQuestionForm(true);
    setError("");
    setSuccessMessage("");

    window.scrollTo({
      top: 0,
      behavior: "smooth",
    });
  };

  const handleQuestionSubmit = async (
    payload,
    resetForm
  ) => {
    try {
      setIsSubmittingQuestion(true);
      setError("");
      setSuccessMessage("");

      if (editingQuestion?._id) {
        await questionApi.update(
          editingQuestion._id,
          payload
        );

        setSuccessMessage(
          "Question updated successfully."
        );
      } else {
        await questionApi.create(payload);

        setSuccessMessage(
          "Question created successfully."
        );
      }

      resetForm();

      setShowQuestionForm(false);
      setEditingQuestion(null);

      await loadQuestions(
        selectedTestId,
        currentPage,
        filters
      );
    } catch (requestError) {
      setError(requestError.message);
    } finally {
      setIsSubmittingQuestion(false);
    }
  };

  const handleCancelQuestionForm = () => {
    setShowQuestionForm(false);
    setEditingQuestion(null);
    setError("");
  };

  const handleDeleteQuestion = async (question) => {
    const confirmed = window.confirm(
      `Are you sure you want to delete Question #${question.questionNumber}?\n\nThis will remove it from the active question list.`
    );

    if (!confirmed) {
      return;
    }

    try {
      setDeletingQuestionId(question._id);
      setError("");
      setSuccessMessage("");

      await questionApi.delete(question._id);

      setSuccessMessage(
        `Question #${question.questionNumber} deleted successfully.`
      );

      if (editingQuestion?._id === question._id) {
        setEditingQuestion(null);
        setShowQuestionForm(false);
      }

      const currentQuestionCount = questions.length;

      const totalPages =
        pagination?.totalPages || 1;

      let pageToLoad = currentPage;

      if (
        currentQuestionCount === 1 &&
        currentPage > 1 &&
        currentPage === totalPages
      ) {
        pageToLoad = currentPage - 1;
      }

      await loadQuestions(
        selectedTestId,
        pageToLoad,
        filters
      );
    } catch (requestError) {
      setError(requestError.message);
    } finally {
      setDeletingQuestionId("");
    }
  };

  const handlePageChange = async (page) => {
    if (!selectedTestId) {
      return;
    }

    await loadQuestions(
      selectedTestId,
      page,
      filters
    );
  };

  const handleExcelFileChange = (event) => {
    const file = event.target.files?.[0];

    setUploadErrors([]);
    setExistingQuestionNumbers([]);
    setError("");
    setSuccessMessage("");

    if (!file) {
      setSelectedExcelFile(null);
      return;
    }

    const fileName = file.name.toLowerCase();

    const isValidExtension =
      fileName.endsWith(".xlsx") ||
      fileName.endsWith(".xls");

    if (!isValidExtension) {
      setSelectedExcelFile(null);
      event.target.value = "";

      setError(
        "Only Excel files (.xlsx or .xls) are allowed."
      );

      return;
    }

    const maxFileSize = 5 * 1024 * 1024;

    if (file.size > maxFileSize) {
      setSelectedExcelFile(null);
      event.target.value = "";

      setError(
        "Excel file size must be 5 MB or less."
      );

      return;
    }

    setSelectedExcelFile(file);
  };

  const handleBulkUpload = async () => {
    setUploadErrors([]);
    setExistingQuestionNumbers([]);
    setError("");
    setSuccessMessage("");

    if (!selectedTestId) {
      setError("Please select a test first.");
      return;
    }

    if (!selectedExcelFile) {
      setError("Please select an Excel file first.");
      return;
    }

    try {
      setIsUploadingExcel(true);

      const data = await questionApi.bulkUpload(
        selectedTestId,
        selectedExcelFile
      );

      setSuccessMessage(
        data?.message ||
          "Questions uploaded successfully."
      );

      setSelectedExcelFile(null);

      if (fileInputRef.current) {
        fileInputRef.current.value = "";
      }

      setUploadErrors([]);
      setExistingQuestionNumbers([]);

      await loadQuestions(
        selectedTestId,
        1,
        filters
      );
    } catch (requestError) {
      setError(requestError.message);

      setUploadErrors(
        Array.isArray(requestError.errors)
          ? requestError.errors
          : []
      );

      setExistingQuestionNumbers(
        Array.isArray(
          requestError.existingQuestionNumbers
        )
          ? requestError.existingQuestionNumbers
          : []
      );
    } finally {
      setIsUploadingExcel(false);
    }
  };

  return (
    <div className="management-page">
      <div className="page-heading">
        <div>
          <h1>Question Management</h1>

          <p>
            Create, search, edit and delete questions
            inside your GATE test series.
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

      <div className="management-panel">
        <div className="section-heading">
          <div>
            <h2>Select Question Location</h2>

            <span>
              Choose the hierarchy before managing
              questions.
            </span>
          </div>
        </div>

        <div className="form-grid">
          <div className="field">
            <label htmlFor="question-branch">
              Branch
            </label>

            <select
              disabled={isLoadingBranches}
              id="question-branch"
              onChange={handleBranchChange}
              value={selectedBranchId}
            >
              <option value="">
                {isLoadingBranches
                  ? "Loading branches..."
                  : "Select branch"}
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
            <label htmlFor="question-subject">
              Subject
            </label>

            <select
              disabled={
                !selectedBranchId ||
                isLoadingSubjects
              }
              id="question-subject"
              onChange={handleSubjectChange}
              value={selectedSubjectId}
            >
              <option value="">
                {isLoadingSubjects
                  ? "Loading subjects..."
                  : "Select subject"}
              </option>

              {subjects.map((subject) => (
                <option
                  key={subject._id}
                  value={subject._id}
                >
                  {subject.name}
                </option>
              ))}
            </select>
          </div>

          <div className="field">
            <label htmlFor="question-chapter">
              Chapter
            </label>

            <select
              disabled={
                !selectedSubjectId ||
                isLoadingChapters
              }
              id="question-chapter"
              onChange={handleChapterChange}
              value={selectedChapterId}
            >
              <option value="">
                {isLoadingChapters
                  ? "Loading chapters..."
                  : "Select chapter"}
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

          <div className="field">
            <label htmlFor="question-test">
              Test
            </label>

            <select
              disabled={
                !selectedChapterId ||
                isLoadingTests
              }
              id="question-test"
              onChange={handleTestChange}
              value={selectedTestId}
            >
              <option value="">
                {isLoadingTests
                  ? "Loading tests..."
                  : "Select test"}
              </option>

              {tests.map((test) => (
                <option
                  key={test._id}
                  value={test._id}
                >
                  {test.title}
                </option>
              ))}
            </select>
          </div>
        </div>
      </div>

      {selectedTestId ? (
        <>
          <div className="management-panel">
            <div className="section-heading">
              <div>
                <h2>Question Filters</h2>

                <span>
                  Search and filter questions in this
                  test.
                </span>
              </div>
            </div>

            <div className="form-grid">
              <div className="field">
                <label htmlFor="question-search">
                  Search
                </label>

                <input
                  id="question-search"
                  onChange={(event) =>
                    setSearchInput(
                      event.target.value
                    )
                  }
                  onKeyDown={handleSearchKeyDown}
                  placeholder="Search question text..."
                  type="text"
                  value={searchInput}
                />
              </div>

              <div className="field">
                <label htmlFor="question-filter-type">
                  Question Type
                </label>

                <select
                  id="question-filter-type"
                  onChange={(event) =>
                    setQuestionTypeInput(
                      event.target.value
                    )
                  }
                  value={questionTypeInput}
                >
                  <option value="">
                    All Types
                  </option>

                  <option value="mcq">
                    MCQ
                  </option>

                  <option value="msq">
                    MSQ
                  </option>

                  <option value="nat">
                    NAT
                  </option>
                </select>
              </div>

              <div className="field">
                <label htmlFor="question-filter-difficulty">
                  Difficulty
                </label>

                <select
                  id="question-filter-difficulty"
                  onChange={(event) =>
                    setDifficultyInput(
                      event.target.value
                    )
                  }
                  value={difficultyInput}
                >
                  <option value="">
                    All Difficulties
                  </option>

                  <option value="easy">
                    Easy
                  </option>

                  <option value="medium">
                    Medium
                  </option>

                  <option value="hard">
                    Hard
                  </option>
                </select>
              </div>

              <div className="field">
                <label htmlFor="question-filter-pyq">
                  PYQ
                </label>

                <select
                  id="question-filter-pyq"
                  onChange={(event) =>
                    setPyqInput(
                      event.target.value
                    )
                  }
                  value={pyqInput}
                >
                  <option value="">
                    All Questions
                  </option>

                  <option value="true">
                    PYQ Only
                  </option>

                  <option value="false">
                    Non-PYQ Only
                  </option>
                </select>
              </div>

              <div className="field">
                <label htmlFor="question-filter-year">
                  Year
                </label>

                <input
                  id="question-filter-year"
                  max="2100"
                  min="1980"
                  onChange={(event) =>
                    setYearInput(
                      event.target.value
                    )
                  }
                  placeholder="2025"
                  type="number"
                  value={yearInput}
                />
              </div>
            </div>

            <div className="form-actions">
              <button
                className="primary-button"
                onClick={handleApplyFilters}
                type="button"
              >
                Apply Filters
              </button>

              <button
                className="secondary-button"
                onClick={handleResetFilters}
                type="button"
              >
                Reset
              </button>
            </div>
          </div>

          <div className="management-panel">
            <div className="section-heading">
              <div>
                <h2>Bulk Upload Questions</h2>

                <span>
                  Upload multiple questions to the
                  selected test using an Excel file.
                </span>
              </div>
            </div>

            <div className="field">
              <label htmlFor="question-excel-file">
                Excel File
              </label>

              <input
                ref={fileInputRef}
                accept=".xlsx,.xls"
                id="question-excel-file"
                onChange={handleExcelFileChange}
                type="file"
              />

              <small>
                Allowed files: .xlsx, .xls. Maximum
                file size: 5 MB.
              </small>
            </div>

            {selectedExcelFile ? (
              <div className="empty-state">
                <strong>
                  Selected File
                </strong>

                <p>
                  {selectedExcelFile.name}
                </p>
              </div>
            ) : null}

            <div className="form-actions">
              <button
                className="primary-button"
                disabled={
                  isUploadingExcel ||
                  !selectedExcelFile ||
                  !selectedTestId
                }
                onClick={handleBulkUpload}
                type="button"
              >
                {isUploadingExcel
                  ? "Uploading..."
                  : "Upload Questions"}
              </button>
            </div>

            {uploadErrors.length > 0 ? (
              <div className="alert alert-error">
                <strong>
                  Excel validation errors:
                </strong>

                <ul>
                  {uploadErrors.map(
                    (uploadError, index) => (
                      <li key={index}>
                        {typeof uploadError ===
                        "string"
                          ? uploadError
                          : uploadError?.message ||
                            JSON.stringify(
                              uploadError
                            )}
                      </li>
                    )
                  )}
                </ul>
              </div>
            ) : null}

            {existingQuestionNumbers.length >
            0 ? (
              <div className="alert alert-error">
                <strong>
                  Duplicate question numbers:
                </strong>

                <p>
                  The following question numbers
                  already exist in this test:
                </p>

                <p>
                  {existingQuestionNumbers.join(
                    ", "
                  )}
                </p>
              </div>
            ) : null}
          </div>

          <div className="management-panel">
            <div className="section-heading">
              <div>
                <h2>
                  {editingQuestion
                    ? "Edit Question"
                    : "Add Question"}
                </h2>

                <span>
                  {editingQuestion
                    ? "Modify the selected question and save the changes."
                    : "Add a question to the selected test."}
                </span>
              </div>

              {!showQuestionForm ? (
                <button
                  className="primary-button"
                  onClick={handleAddQuestion}
                  type="button"
                >
                  + Add Question
                </button>
              ) : null}
            </div>

            {showQuestionForm ? (
              <QuestionForm
                branch={selectedBranch}
                subject={selectedSubject}
                chapter={selectedChapter}
                test={selectedTest}
                question={editingQuestion}
                isSubmitting={
                  isSubmittingQuestion
                }
                onCancel={
                  handleCancelQuestionForm
                }
                onSubmit={
                  handleQuestionSubmit
                }
              />
            ) : (
              <div className="empty-state">
                <strong>
                  Ready to manage questions
                </strong>

                <p>
                  Click “Add Question” to create a
                  new question, or use “Edit” on an
                  existing question below.
                </p>
              </div>
            )}
          </div>

          <div className="management-panel">
            <div className="section-heading">
              <div>
                <h2>Questions</h2>

                <span>
                  {pagination?.totalQuestions !==
                  undefined
                    ? `${pagination.totalQuestions} question(s) found`
                    : "Questions in selected test"}
                </span>
              </div>
            </div>

            <QuestionList
              questions={questions}
              pagination={pagination}
              isLoading={isLoadingQuestions}
              currentPage={currentPage}
              onPageChange={handlePageChange}
              onEdit={handleEditQuestion}
              onDelete={handleDeleteQuestion}
              deletingQuestionId={
                deletingQuestionId
              }
            />
          </div>
        </>
      ) : (
        <div className="management-panel">
          <div className="empty-state">
            <strong>
              Select a test to manage questions
            </strong>

            <p>
              Choose Branch → Subject → Chapter →
              Test to view and manage questions.
            </p>
          </div>
        </div>
      )}
    </div>
  );
}

export default QuestionManagementPage;