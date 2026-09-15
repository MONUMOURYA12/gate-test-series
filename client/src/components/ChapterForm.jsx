import { useState } from "react";

const initialFormData = {
  name: "",
  description: "",
  subject: "",
  order: "0",
};

function ChapterForm({ isSubmitting, onCancel, onSubmit, subjects }) {
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

    const order = Number(formData.order);
    const payload = {
      name: formData.name.trim(),
      description: formData.description.trim(),
      subject: formData.subject,
      order,
    };

    if (!payload.name) {
      setValidationError("Chapter name is required.");
      return;
    }

    if (!payload.subject) {
      setValidationError("Subject selection is required.");
      return;
    }

    if (!Number.isFinite(order)) {
      setValidationError("Order must be a valid number.");
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
          <label htmlFor="chapter-name">Chapter Name</label>
          <input
            disabled={isSubmitting}
            id="chapter-name"
            name="name"
            onChange={handleChange}
            placeholder="Signals and Systems"
            value={formData.name}
          />
        </div>

        <div className="field">
          <label htmlFor="chapter-order">Order</label>
          <input
            disabled={isSubmitting}
            id="chapter-order"
            name="order"
            onChange={handleChange}
            type="number"
            value={formData.order}
          />
        </div>
      </div>

      <div className="field">
        <label htmlFor="chapter-subject">Subject</label>
        <select
          disabled={isSubmitting}
          id="chapter-subject"
          name="subject"
          onChange={handleChange}
          value={formData.subject}
        >
          <option value="">Select a subject</option>
          {subjects.map((subject) => (
            <option key={subject._id} value={subject._id}>
              {subject.code ? `${subject.code} - ` : ""}
              {subject.name}
            </option>
          ))}
        </select>
      </div>

      <div className="field">
        <label htmlFor="chapter-description">Description</label>
        <textarea
          disabled={isSubmitting}
          id="chapter-description"
          name="description"
          onChange={handleChange}
          placeholder="Signals and Systems concepts for GATE ECE"
          rows="3"
          value={formData.description}
        />
      </div>

      <div className="form-actions">
        <button className="primary-button" disabled={isSubmitting} type="submit">
          {isSubmitting ? "Saving..." : "Save Chapter"}
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

export default ChapterForm;
