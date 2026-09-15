import { useEffect, useState } from "react";
import BranchForm from "../components/BranchForm.jsx";
import BranchList from "../components/BranchList.jsx";
import { branchApi } from "../services/api";

function getFriendlyError(error) {
  if (error.message === "Branch already exists") {
    return "Branch already exists.";
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

function BranchManagementPage() {
  const [branches, setBranches] = useState([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isFormOpen, setIsFormOpen] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");

  const refreshBranches = async () => {
    setError("");
    setIsLoading(true);

    try {
      const data = await branchApi.list();
      setBranches(data.branches || []);
    } catch (loadError) {
      setError(getFriendlyError(loadError));
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    let isMounted = true;

    const loadInitialBranches = async () => {
      try {
        const data = await branchApi.list();

        if (isMounted) {
          setBranches(data.branches || []);
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

    loadInitialBranches();

    return () => {
      isMounted = false;
    };
  }, []);

  const handleCreateBranch = async (payload, resetForm) => {
    setError("");
    setSuccess("");
    setIsSubmitting(true);

    try {
      await branchApi.create(payload);
      resetForm();
      setIsFormOpen(false);
      setSuccess("Branch created successfully.");
      await refreshBranches();
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
          <h1>Branches</h1>
          <p>Manage GATE branches used to organize subjects and tests.</p>
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
          + Add Branch
        </button>
      </div>

      {success ? <div className="alert alert-success">{success}</div> : null}
      {error ? <div className="alert alert-error">{error}</div> : null}

      {isFormOpen ? (
        <section className="management-panel" aria-labelledby="branch-form-title">
          <h2 id="branch-form-title">Add Branch</h2>
          <BranchForm
            isSubmitting={isSubmitting}
            onCancel={() => setIsFormOpen(false)}
            onSubmit={handleCreateBranch}
          />
        </section>
      ) : null}

      <section className="management-panel" aria-labelledby="branch-list-title">
        <div className="section-heading">
          <h2 id="branch-list-title">Branch List</h2>
          <span>{branches.length} active branches</span>
        </div>

        {isLoading ? (
          <div className="loading-state">Loading branches...</div>
        ) : (
          <BranchList branches={branches} />
        )}
      </section>
    </>
  );
}

export default BranchManagementPage;
