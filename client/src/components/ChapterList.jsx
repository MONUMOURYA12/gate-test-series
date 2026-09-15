function getSubjectLabel(chapter, subjects) {
  if (chapter.subject && typeof chapter.subject === "object") {
    return chapter.subject.code
      ? `${chapter.subject.code} - ${chapter.subject.name}`
      : chapter.subject.name;
  }

  const subject = subjects.find((item) => item._id === chapter.subject);

  if (subject) {
    return subject.code ? `${subject.code} - ${subject.name}` : subject.name;
  }

  return "Unassigned";
}

function ChapterList({ chapters, subjects }) {
  if (!chapters.length) {
    return (
      <div className="empty-state">
        <strong>No chapters found</strong>
        <p>Select another subject or add a chapter for the current subject.</p>
      </div>
    );
  }

  return (
    <div className="table-card">
      <div className="chapter-table">
        <div className="chapter-row chapter-row-head">
          <span>Chapter Name</span>
          <span>Subject</span>
          <span>Description</span>
          <span>Order</span>
          <span>Status</span>
        </div>

        {chapters.map((chapter) => (
          <div className="chapter-row" key={chapter._id}>
            <div className="chapter-name">
              <strong>{chapter.name}</strong>
              <span>Order {chapter.order ?? 0}</span>
            </div>
            <span className="chapter-subject">
              {getSubjectLabel(chapter, subjects)}
            </span>
            <span className="chapter-description">
              {chapter.description || "No description"}
            </span>
            <span className="chapter-order">{chapter.order ?? 0}</span>
            <span
              className={
                chapter.isActive ? "status-pill active" : "status-pill inactive"
              }
            >
              {chapter.isActive ? "Active" : "Inactive"}
            </span>
          </div>
        ))}
      </div>
    </div>
  );
}

export default ChapterList;
