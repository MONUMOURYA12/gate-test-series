import { useState } from "react";

const initialFormData = {
  name: "",
  code: "",
  description: "",
  branch: "",
};

function SubjectForm({ branches, isSubmitting, onCancel, onSubmit }) {
  const [formData, setFormData] = useState(initialFormData);
  const [validationError, setValidationError] = useState("");

  const handleChange = (event) => {
    const { name, value } = event.target;

    setFormData((current) => ({
      ...current,
      [name]: value,
    }));
  };

  const handleSubmit = (event) => {
    event.preventDefault();
    setValidationError("");

    const payload = {
      name: formData.name.trim(),
      code: formData.code.trim(),
      description: formData.description.trim(),
      branch: formData.branch,
    };

    if (!payload.name) {
      setValidationError("Subject name is required.");
      return;
    }

    if (!payload.branch) {
      setValidationError("Branch selection is required.");
      return;
    }

    onSubmit(payload, () => {
      setFormData(initialFormData);
    });
  };

  return (
    <form className="management-form" onSubmit={handleSubmit}>
      {validationError ? (
        <div className="alert alert-error">{validationError}</div>
      ) : null}

      <div className="form-grid">
        <div className="field">
          <label htmlFor="subject-name">Subject Name</label>
          <input
            disabled={isSubmitting}
            id="subject-name"
            name="name"
            onChange={handleChange}
            placeholder="Engineering Mathematics"
            value={formData.name}
          />
        </div>

        <div className="field">
          <label htmlFor="subject-code">Subject Code</label>
          <input
            disabled={isSubmitting}
            id="subject-code"
            name="code"
            onChange={handleChange}
            placeholder="EM"
            value={formData.code}
          />
        </div>
      </div>

      <div className="field">
        <label htmlFor="subject-branch">Branch</label>
        <select
          disabled={isSubmitting}
          id="subject-branch"
          name="branch"
          onChange={handleChange}
          value={formData.branch}
        >
          <option value="">Select a branch</option>
          {branches.map((branch) => (
            <option key={branch._id} value={branch._id}>
              {branch.code} - {branch.name}
            </option>
          ))}
        </select>
      </div>

      <div className="field">
        <label htmlFor="subject-description">Description</label>
        <textarea
          disabled={isSubmitting}
          id="subject-description"
          name="description"
          onChange={handleChange}
          placeholder="Engineering Mathematics for GATE ECE"
          rows="3"
          value={formData.description}
        />
      </div>

      <div className="form-actions">
        <button className="primary-button" disabled={isSubmitting} type="submit">
          {isSubmitting ? "Saving..." : "Save Subject"}
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

export default SubjectForm;
