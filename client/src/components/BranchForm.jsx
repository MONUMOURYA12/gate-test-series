import { useState } from "react";

const initialFormData = {
  name: "",
  code: "",
  description: "",
};

function BranchForm({ isSubmitting, onCancel, onSubmit }) {
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
    };

    if (!payload.name || !payload.code) {
      setValidationError("Branch name and code are required.");
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
          <label htmlFor="branch-name">Branch Name</label>
          <input
            disabled={isSubmitting}
            id="branch-name"
            name="name"
            onChange={handleChange}
            placeholder="Electronics and Communication Engineering"
            value={formData.name}
          />
        </div>

        <div className="field">
          <label htmlFor="branch-code">Branch Code</label>
          <input
            disabled={isSubmitting}
            id="branch-code"
            name="code"
            onChange={handleChange}
            placeholder="ECE"
            value={formData.code}
          />
        </div>
      </div>

      <div className="field">
        <label htmlFor="branch-description">Description</label>
        <textarea
          disabled={isSubmitting}
          id="branch-description"
          name="description"
          onChange={handleChange}
          placeholder="GATE Electronics and Communication Engineering"
          rows="3"
          value={formData.description}
        />
      </div>

      <div className="form-actions">
        <button className="primary-button" disabled={isSubmitting} type="submit">
          {isSubmitting ? "Saving..." : "Save Branch"}
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

export default BranchForm;
