function BranchList({ branches }) {
  if (!branches.length) {
    return (
      <div className="empty-state">
        <strong>No branches found</strong>
        <p>Add the first branch to begin organizing subjects and tests.</p>
      </div>
    );
  }

  return (
    <div className="table-card">
      <div className="branch-table">
        <div className="branch-row branch-row-head">
          <span>Branch Name</span>
          <span>Code</span>
          <span>Description</span>
          <span>Status</span>
        </div>

        {branches.map((branch) => (
          <div className="branch-row" key={branch._id}>
            <div className="branch-name">
              <strong>{branch.name}</strong>
              <span>{branch.code}</span>
            </div>
            <span className="branch-code">{branch.code}</span>
            <span className="branch-description">
              {branch.description || "No description"}
            </span>
            <span
              className={
                branch.isActive ? "status-pill active" : "status-pill inactive"
              }
            >
              {branch.isActive ? "Active" : "Inactive"}
            </span>
          </div>
        ))}
      </div>
    </div>
  );
}

export default BranchList;
