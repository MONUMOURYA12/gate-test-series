import { useEffect, useRef, useState } from "react";
import {
  branchApi,
  chapterApi,
  questionApi,
  subjectApi,
  testApi,
} from "../services/api";

const MAX_FILE_SIZE = 5 * 1024 * 1024;
const ACCEPTED_EXTENSIONS = [".xlsx", ".xls", ".csv"];

const templateHeaders = [
  "questionNumber",
  "questionText",
  "questionType",
  "optionA",
  "optionB",
  "optionC",
  "optionD",
  "correctAnswer",
  "marks",
  "negativeMarks",
  "isPYQ",
  "examName",
  "year",
  "session",
  "difficulty",
  "category",
  "topic",
  "tags",
  "explanation",
  "solutionType",
];

const templateExample = [
  1,
  "Which data structure uses FIFO order?",
  "mcq",
  "Stack",
  "Queue",
  "Tree",
  "Graph",
  1,
  1,
  0.33,
  "false",
  "GATE",
  "",
  "",
  "easy",
  "Data Structures",
  "Queue",
  "fifo,basics",
  "A queue removes the earliest inserted item first.",
  "manual",
];

function csvValue(value) {
  const text = String(value ?? "");
  return /[",\n]/.test(text) ? `"${text.replace(/"/g, '""')}"` : text;
}

function downloadTemplate() {
  const csv = [templateHeaders, templateExample]
    .map(row => row.map(csvValue).join(","))
    .join("\n");
  const blob = new Blob([`\uFEFF${csv}`], { type: "text/csv;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = "gate-question-upload-template.csv";
  document.body.appendChild(link);
  link.click();
  link.remove();
  URL.revokeObjectURL(url);
}

function formatBytes(bytes) {
  return `${(bytes / 1024 / 1024).toFixed(2)} MB`;
}

function BulkUploadPage() {
  const [branches, setBranches] = useState([]);
  const [subjects, setSubjects] = useState([]);
  const [chapters, setChapters] = useState([]);
  const [tests, setTests] = useState([]);
  const [selectedBranchId, setSelectedBranchId] = useState("");
  const [selectedSubjectId, setSelectedSubjectId] = useState("");
  const [selectedChapterId, setSelectedChapterId] = useState("");
  const [selectedTestId, setSelectedTestId] = useState("");
  const [selectedTest, setSelectedTest] = useState(null);
  const [loading, setLoading] = useState(true);
  const [loadingChildren, setLoadingChildren] = useState(false);
  const [file, setFile] = useState(null);
  const [isUploading, setIsUploading] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState(null);
  const [uploadErrors, setUploadErrors] = useState([]);
  const [duplicateNumbers, setDuplicateNumbers] = useState([]);
  const fileInputRef = useRef(null);

  useEffect(() => {
    branchApi.list().then(data => setBranches(data?.branches || []))
      .catch(requestError => setError(requestError.message))
      .finally(() => setLoading(false));
  }, []);

  function clearFeedback() {
    setError("");
    setSuccess(null);
    setUploadErrors([]);
    setDuplicateNumbers([]);
  }

  async function handleBranchChange(event) {
    const branchId = event.target.value;
    setSelectedBranchId(branchId);
    setSelectedSubjectId("");
    setSelectedChapterId("");
    setSelectedTestId("");
    setSelectedTest(null);
    setSubjects([]);
    setChapters([]);
    setTests([]);
    clearFeedback();
    if (!branchId) return;
    setLoadingChildren(true);
    try {
      const data = await subjectApi.listByBranch(branchId);
      setSubjects(data?.subjects || []);
    } catch (requestError) {
      setError(requestError.message);
    } finally {
      setLoadingChildren(false);
    }
  }

  async function handleSubjectChange(event) {
    const subjectId = event.target.value;
    setSelectedSubjectId(subjectId);
    setSelectedChapterId("");
    setSelectedTestId("");
    setSelectedTest(null);
    setChapters([]);
    setTests([]);
    clearFeedback();
    if (!subjectId) return;
    setLoadingChildren(true);
    try {
      const data = await chapterApi.listBySubject(subjectId);
      setChapters(data?.chapters || []);
    } catch (requestError) {
      setError(requestError.message);
    } finally {
      setLoadingChildren(false);
    }
  }

  async function handleChapterChange(event) {
    const chapterId = event.target.value;
    setSelectedChapterId(chapterId);
    setSelectedTestId("");
    setSelectedTest(null);
    setTests([]);
    clearFeedback();
    if (!chapterId) return;
    setLoadingChildren(true);
    try {
      const data = await testApi.listByChapter(chapterId);
      setTests(data?.tests || []);
    } catch (requestError) {
      setError(requestError.message);
    } finally {
      setLoadingChildren(false);
    }
  }

  function handleTestChange(event) {
    const testId = event.target.value;
    setSelectedTestId(testId);
    setSelectedTest(tests.find(test => test._id === testId) || null);
    setFile(null);
    if (fileInputRef.current) fileInputRef.current.value = "";
    clearFeedback();
  }

  function handleFileChange(event) {
    const nextFile = event.target.files?.[0] || null;
    clearFeedback();
    if (!nextFile) {
      setFile(null);
      return;
    }

    const lowerName = nextFile.name.toLowerCase();
    if (!ACCEPTED_EXTENSIONS.some(extension => lowerName.endsWith(extension))) {
      setFile(null);
      event.target.value = "";
      setError("Only .xlsx, .xls or .csv files are allowed.");
      return;
    }
    if (nextFile.size > MAX_FILE_SIZE) {
      setFile(null);
      event.target.value = "";
      setError("The file must be 5 MB or smaller.");
      return;
    }
    setFile(nextFile);
  }

  async function handleUpload() {
    clearFeedback();
    if (!selectedTestId) {
      setError("Select a test before uploading questions.");
      return;
    }
    if (!file) {
      setError("Choose a spreadsheet before uploading questions.");
      return;
    }

    setIsUploading(true);
    try {
      const data = await questionApi.bulkUpload(selectedTestId, file);
      setSuccess(data);
      setSelectedTest(current => current ? {
        ...current,
        totalQuestions: data.totalQuestions,
        totalMarks: data.totalMarks,
      } : current);
      setFile(null);
      if (fileInputRef.current) fileInputRef.current.value = "";
    } catch (requestError) {
      setError(requestError.message);
      setUploadErrors(Array.isArray(requestError.errors) ? requestError.errors : []);
      setDuplicateNumbers(Array.isArray(requestError.existingQuestionNumbers) ? requestError.existingQuestionNumbers : []);
    } finally {
      setIsUploading(false);
    }
  }

  return <div className="bulk-upload-page">
    <div className="page-heading">
      <div>
        <h1>Bulk Upload Questions</h1>
        <p>Import a complete question set into one selected GATE test.</p>
      </div>
      <button className="secondary-button" type="button" onClick={downloadTemplate}>Download CSV template</button>
    </div>

    {error && <div className="alert alert-error" role="alert">{error}</div>}
    {success && <div className="alert alert-success" role="status"><strong>{success.message}</strong> {success.uploadedQuestions} questions added. Test total: {success.totalQuestions} questions / {success.totalMarks} marks.</div>}

    <section className="management-panel">
      <div className="section-heading"><div><h2>1. Choose the destination test</h2><span>Questions inherit the selected test's branch, subject and chapter.</span></div></div>
      <div className="form-grid">
        <div className="field"><label htmlFor="bulk-branch">Branch</label><select id="bulk-branch" disabled={loading} value={selectedBranchId} onChange={handleBranchChange}><option value="">{loading ? "Loading branches..." : "Select branch"}</option>{branches.map(branch => <option key={branch._id} value={branch._id}>{branch.name} ({branch.code})</option>)}</select></div>
        <div className="field"><label htmlFor="bulk-subject">Subject</label><select id="bulk-subject" disabled={!selectedBranchId || loadingChildren} value={selectedSubjectId} onChange={handleSubjectChange}><option value="">{loadingChildren ? "Loading subjects..." : "Select subject"}</option>{subjects.map(subject => <option key={subject._id} value={subject._id}>{subject.name}</option>)}</select></div>
        <div className="field"><label htmlFor="bulk-chapter">Chapter</label><select id="bulk-chapter" disabled={!selectedSubjectId || loadingChildren} value={selectedChapterId} onChange={handleChapterChange}><option value="">{loadingChildren ? "Loading chapters..." : "Select chapter"}</option>{chapters.map(chapter => <option key={chapter._id} value={chapter._id}>{chapter.name}</option>)}</select></div>
        <div className="field"><label htmlFor="bulk-test">Test</label><select id="bulk-test" disabled={!selectedChapterId || loadingChildren} value={selectedTestId} onChange={handleTestChange}><option value="">{loadingChildren ? "Loading tests..." : "Select test"}</option>{tests.map(test => <option key={test._id} value={test._id}>{test.title}</option>)}</select></div>
      </div>
      {selectedTest && <div className="bulk-test-summary"><div><span>Selected test</span><strong>{selectedTest.title}</strong></div><div><span>Current questions</span><strong>{selectedTest.totalQuestions ?? 0}</strong></div><div><span>Current marks</span><strong>{selectedTest.totalMarks ?? 0}</strong></div></div>}
    </section>

    <section className="management-panel">
      <div className="section-heading"><div><h2>2. Upload the question file</h2><span>Rows are validated completely before anything is inserted.</span></div></div>
      <div className="bulk-upload-dropzone">
        <label className="bulk-file-label" htmlFor="bulk-question-file"><strong>{file ? file.name : "Choose a spreadsheet"}</strong><span>{file ? `${formatBytes(file.size)} selected` : "Supported: .xlsx, .xls and .csv - Maximum 5 MB"}</span></label>
        <input ref={fileInputRef} id="bulk-question-file" accept=".xlsx,.xls,.csv" onChange={handleFileChange} type="file" />
      </div>
      <div className="form-actions"><button className="primary-button" type="button" disabled={isUploading || !selectedTestId || !file} onClick={handleUpload}>{isUploading ? "Validating and uploading..." : "Upload questions"}</button>{file && <button className="secondary-button" type="button" disabled={isUploading} onClick={() => { setFile(null); if (fileInputRef.current) fileInputRef.current.value = ""; }}>Clear file</button>}</div>
      {uploadErrors.length > 0 && <div className="bulk-error-list alert alert-error"><strong>Fix these spreadsheet rows:</strong><ul>{uploadErrors.map((item, index) => <li key={`${item}-${index}`}>{item}</li>)}</ul></div>}
      {duplicateNumbers.length > 0 && <div className="alert alert-error"><strong>Duplicate question numbers:</strong> {duplicateNumbers.join(", ")}</div>}
    </section>

    <section className="management-panel bulk-format-panel">
      <div className="section-heading"><div><h2>File format</h2><span>Use the exact column names below. MCQ and MSQ need all four options; NAT leaves them blank.</span></div></div>
      <div className="bulk-format-table"><div className="bulk-format-row bulk-format-head"><span>Column</span><span>Example</span><span>Required</span></div><div className="bulk-format-row"><span>questionNumber</span><span>1</span><span>Yes</span></div><div className="bulk-format-row"><span>questionText</span><span>What is FIFO?</span><span>Yes</span></div><div className="bulk-format-row"><span>questionType</span><span>mcq / msq / nat</span><span>Yes</span></div><div className="bulk-format-row"><span>optionA - optionD</span><span>Four answer choices</span><span>MCQ/MSQ</span></div><div className="bulk-format-row"><span>correctAnswer</span><span>1 or 0,2 or 3.14</span><span>Yes</span></div><div className="bulk-format-row"><span>marks, negativeMarks</span><span>1, 0.33</span><span>No</span></div><div className="bulk-format-row"><span>difficulty</span><span>easy / medium / hard</span><span>No</span></div><div className="bulk-format-row"><span>isPYQ, year</span><span>false, 2024</span><span>PYQ needs year</span></div></div>
    </section>
  </div>;
}

export default BulkUploadPage;
