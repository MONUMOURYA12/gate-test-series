import { useState } from "react";

const initialFormData = {
  title: "",
  description: "",
  duration: "",
  negativeMarking: "true",
  isPublished: false,
};

function TestForm({
  chapter,
  isSubmitting,
  onCancel,
  onSubmit,
}) {
  const [formData, setFormData] = useState(initialFormData);
  const [validationError, setValidationError] = useState("");

  const handleChange = (event) => {
    const { checked, name, type, value } = event.target;

    setFormData((current) => ({
      ...current,
      [name]: type === "checkbox" ? checked : value,
    }));
  };

  const handleSubmit = (event) => {
    event.preventDefault();
    setValidationError("");

    const title = formData.title.trim();
    const description = formData.description.trim();
    const duration = Number(formData.duration);

    if (!title) {
      setValidationError("Test title is required.");
      return;
    }

    if (!chapter?._id) {
      setValidationError("Chapter selection is required.");
      return;
    }

    if (!Number.isFinite(duration) || duration < 1) {
      setValidationError(
        "Duration must be a number of at least 1 minute."
      );
      return;
    }

    const payload = {
      title,
      description,
      chapter: chapter._id,
      duration,
      negativeMarking: formData.negativeMarking === "true",
      isPublished: formData.isPublished,
    };

    onSubmit(payload, () => {
      setFormData(initialFormData);
      setValidationError("");
    });
  };

  return (
    <form className="management-form" onSubmit={handleSubmit}>
      {validationError ? (
        <div className="alert alert-error">
          {validationError}
        </div>
      ) : null}

      <div className="form-grid">
        <div className="field">
          <label htmlFor="test-title">Test Title</label>

          <input
            disabled={isSubmitting}
            id="test-title"
            name="title"
            onChange={handleChange}
            placeholder="Linear Algebra Test 2"
            type="text"
            value={formData.title}
          />
        </div>

        <div className="field">
          <label htmlFor="test-duration">
            Duration (minutes)
          </label>

          <input
            disabled={isSubmitting}
            id="test-duration"
            min="1"
            name="duration"
            onChange={handleChange}
            placeholder="30"
            type="number"
            value={formData.duration}
          />
        </div>
      </div>

      <div className="field">
        <label htmlFor="test-chapter">Chapter</label>

        <input
          disabled
          id="test-chapter"
          type="text"
          value={chapter?.name || ""}
        />
      </div>

      <div className="field">
        <label htmlFor="test-description">
          Description
        </label>

        <textarea
          disabled={isSubmitting}
          id="test-description"
          name="description"
          onChange={handleChange}
          placeholder="Practice test for Linear Algebra"
          rows="3"
          value={formData.description}
        />
      </div>

      <div className="form-grid">
        <div className="field">
          <label htmlFor="test-negative-marking">
            Negative Marking
          </label>

          <select
            disabled={isSubmitting}
            id="test-negative-marking"
            name="negativeMarking"
            onChange={handleChange}
            value={formData.negativeMarking}
          >
            <option value="true">Yes</option>
            <option value="false">No</option>
          </select>
        </div>

        <label
          className="check-field"
          htmlFor="test-published"
        >
          <input
            checked={formData.isPublished}
            disabled={isSubmitting}
            id="test-published"
            name="isPublished"
            onChange={handleChange}
            type="checkbox"
          />

          <span>Published</span>
        </label>
      </div>

      <div className="form-actions">
        <button
          className="primary-button"
          disabled={isSubmitting}
          type="submit"
        >
          {isSubmitting ? "Saving..." : "Save Test"}
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

export default TestForm;