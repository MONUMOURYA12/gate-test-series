import { useEffect, useState } from "react";
import SubjectForm from "../components/SubjectForm.jsx";
import SubjectList from "../components/SubjectList.jsx";
import { branchApi, subjectApi } from "../services/api";

function getFriendlyError(error) {
  if (error.message === "Subject already exists in this branch") {
    return "Subject already exists in this branch.";
  }

  if (error.message === "Branch not found") {
    return "Selected branch was not found.";
  }

  if (error.message === "Subject name and branch are required") {
    return "Subject name and branch are required.";
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

function SubjectManagementPage() {
  const [branches, setBranches] = useState([]);
  const [subjects, setSubjects] = useState([]);
  const [selectedBranch, setSelectedBranch] = useState("");
  const [isLoading, setIsLoading] = useState(true);
  const [isFormOpen, setIsFormOpen] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");

  const loadSubjects = async (branchId = selectedBranch) => {
    const data = branchId
      ? await subjectApi.listByBranch(branchId)
      : await subjectApi.list();

    setSubjects(data.subjects || []);
  };

  useEffect(() => {
    let isMounted = true;

    const loadInitialData = async () => {
      try {
        const [branchData, subjectData] = await Promise.all([
          branchApi.list(),
          subjectApi.list(),
        ]);

        if (isMounted) {
          setBranches(branchData.branches || []);
          setSubjects(subjectData.subjects || []);
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

  const handleBranchFilterChange = async (event) => {
    const branchId = event.target.value;

    setSelectedBranch(branchId);
    setError("");
    setSuccess("");
    setIsLoading(true);

    try {
      await loadSubjects(branchId);
    } catch (loadError) {
      setError(getFriendlyError(loadError));
    } finally {
      setIsLoading(false);
    }
  };

  const handleCreateSubject = async (payload, resetForm) => {
    setError("");
    setSuccess("");
    setIsSubmitting(true);

    try {
      await subjectApi.create(payload);
      resetForm();
      setIsFormOpen(false);
      setSuccess("Subject created successfully.");
      await loadSubjects();
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
          <h1>Subjects</h1>
          <p>Manage subjects under each GATE branch.</p>
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
          + Add Subject
        </button>
      </div>

      {success ? <div className="alert alert-success">{success}</div> : null}
      {error ? <div className="alert alert-error">{error}</div> : null}

      <section className="management-panel" aria-labelledby="subject-filter-title">
        <div className="section-heading">
          <h2 id="subject-filter-title">Filter Subjects</h2>
          <span>{branches.length} active branches</span>
        </div>

        <div className="field filter-field">
          <label htmlFor="subject-branch-filter">Branch</label>
          <select
            disabled={isLoading}
            id="subject-branch-filter"
            onChange={handleBranchFilterChange}
            value={selectedBranch}
          >
            <option value="">All Branches</option>
            {branches.map((branch) => (
              <option key={branch._id} value={branch._id}>
                {branch.code} - {branch.name}
              </option>
            ))}
          </select>
        </div>
      </section>

      {isFormOpen ? (
        <section className="management-panel" aria-labelledby="subject-form-title">
          <h2 id="subject-form-title">Add Subject</h2>
          <SubjectForm
            branches={branches}
            isSubmitting={isSubmitting}
            onCancel={() => setIsFormOpen(false)}
            onSubmit={handleCreateSubject}
          />
        </section>
      ) : null}

      <section className="management-panel" aria-labelledby="subject-list-title">
        <div className="section-heading">
          <h2 id="subject-list-title">Subject List</h2>
          <span>{subjects.length} active subjects</span>
        </div>

        {isLoading ? (
          <div className="loading-state">Loading subjects...</div>
        ) : (
          <SubjectList branches={branches} subjects={subjects} />
        )}
      </section>
    </>
  );
}

export default SubjectManagementPage;
