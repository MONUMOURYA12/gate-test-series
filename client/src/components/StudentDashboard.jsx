import { Link, useOutletContext } from "react-router-dom";
import { useAuth } from "../hooks/useAuth";

export default function StudentDashboard() {
  const { branches, subjects, tests } = useOutletContext();
  const { user } = useAuth();
  return <>
    <section className="learn-hero">
      <p className="learn-eyebrow">YOUR GATE PREPARATION</p>
      <h1>A little practice.<br />A stronger foundation.</h1>
      <p>Welcome, {user?.name}. Choose your branch and find your next chapter to work on.</p>
      <Link className="primary-button" to="/student/tests">Explore test catalogue <span aria-hidden="true">→</span></Link>
    </section>
    <dl className="learn-stats"><div><dt>Available branches</dt><dd>{branches.length}</dd></div><div><dt>Subjects to explore</dt><dd>{subjects.length}</dd></div><div><dt>Published tests</dt><dd>{tests.length}</dd></div></dl>
    <section aria-labelledby="branches-heading">
      <div className="learn-section-heading"><div><p className="learn-eyebrow">CHOOSE YOUR PATH</p><h2 id="branches-heading">Explore by branch</h2></div><span>GATE</span></div>
      {branches.length === 0 ? <div className="learn-state"><h3>Your catalogue is on its way</h3><p>Branches will appear here when they are available.</p></div> :
        <div className="learn-grid">{branches.map(branch => {
          const subjectIds = new Set(subjects.filter(s => s.branch === branch._id).map(s => s._id));
          return <article className="learn-card" key={branch._id}>
            <span className="learn-code">{branch.code}</span><h3>{branch.name}</h3><p>{branch.description || "Explore subjects and chapter-wise tests for this branch."}</p>
            <p className="learn-meta">{subjectIds.size} subjects</p>
            <Link className="learn-card-link" to={`/student/tests?branch=${branch._id}`}>Explore tests <span aria-hidden="true">→</span></Link>
          </article>;
        })}</div>}
    </section>
  </>;
}
