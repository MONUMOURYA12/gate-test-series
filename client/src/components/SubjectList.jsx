function getBranchLabel(subject, branches) {
  if (subject.branch && typeof subject.branch === "object") {
    return subject.branch.code
      ? `${subject.branch.code} - ${subject.branch.name}`
      : subject.branch.name;
  }

  const branch = branches.find((item) => item._id === subject.branch);

  if (branch) {
    return `${branch.code} - ${branch.name}`;
  }

  return "Unassigned";
}

function SubjectList({ branches, subjects }) {
  if (!subjects.length) {
    return (
      <div className="empty-state">
        <strong>No subjects found</strong>
        <p>Select another branch or add a subject for the current branch.</p>
      </div>
    );
  }

  return (
    <div className="table-card">
      <div className="subject-table">
        <div className="subject-row subject-row-head">
          <span>Subject Name</span>
          <span>Code</span>
          <span>Branch</span>
          <span>Description</span>
          <span>Status</span>
        </div>

        {subjects.map((subject) => (
          <div className="subject-row" key={subject._id}>
            <div className="subject-name">
              <strong>{subject.name}</strong>
              <span>{subject.code || "No code"}</span>
            </div>
            <span className="subject-code">{subject.code || "--"}</span>
            <span className="subject-branch">
              {getBranchLabel(subject, branches)}
            </span>
            <span className="subject-description">
              {subject.description || "No description"}
            </span>
            <span
              className={
                subject.isActive ? "status-pill active" : "status-pill inactive"
              }
            >
              {subject.isActive ? "Active" : "Inactive"}
            </span>
          </div>
        ))}
      </div>
    </div>
  );
}

export default SubjectList;
