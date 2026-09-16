import { useMemo, useState } from "react";
import { Link, NavLink, useOutletContext } from "react-router-dom";
import { useAuth } from "../hooks/useAuth";

const commonSubjects = [
  { key: "engineering-mathematics", code: "MATH", name: "Engineering Mathematics", description: "Common GATE foundation subject." },
  { key: "general-aptitude", code: "GA", name: "General Aptitude", description: "Common GATE aptitude practice." },
];

function getBranchId(value) {
  return typeof value === "object" ? value?._id : value;
}

export default function StudentDashboard() {
  const { branches, subjects, chapters, tests } = useOutletContext();
  const { user } = useAuth();
  const [subjectQuery, setSubjectQuery] = useState("");

  const branchId = user?.branch?._id || user?.branch;
  const branch = branchId ? branches.find(item => item._id === branchId) || branches[0] : null;
  const branchSubjects = subjects.filter(subject => getBranchId(subject.branch) === branch?._id && !subject.isCommon);
  const visibleSubjects = useMemo(() => {
    const query = subjectQuery.trim().toLowerCase();
    return branchSubjects.filter(subject => !query || `${subject.name} ${subject.code || ""}`.toLowerCase().includes(query));
  }, [branchSubjects, subjectQuery]);

  return <>
    <section className="learn-hero student-dashboard-hero">
      <div>
        <p className="learn-eyebrow">{branch ? `${branch.code} PREPARATION` : "YOUR GATE PREPARATION"}</p>
        <h1>Welcome back, {user?.name}.</h1>
        <p>{branch ? `Your ${branch.name} learning path is ready. Pick one subject and make a focused start.` : "Choose a subject and find your next chapter to work on."}</p>
      </div>
      <div className="student-hero-mark" aria-hidden="true">{branch?.code?.slice(0, 2) || "G"}</div>
      <Link className="primary-button" to="#subjects-heading">Open my subjects <span aria-hidden="true">↓</span></Link>
    </section>

    <section className="study-hub-toolbar" aria-label="Practice modes">
      <div className="study-mode-tabs" role="tablist" aria-label="Study modes">
        <NavLink className="study-mode-tab" to="/student/dashboard" end>Self-paced</NavLink>
        <NavLink className="study-mode-tab" to="/student/tests">Timed tests</NavLink>
      </div>
      <label className="study-search">
        <span>Find a subject</span>
        <input type="search" value={subjectQuery} onChange={event => setSubjectQuery(event.target.value)} placeholder="Search your subject" />
      </label>
    </section>

    <section aria-labelledby="subjects-heading" className="student-path-section">
      <div className="learn-section-heading">
        <div><p className="learn-eyebrow">YOUR LEARNING PATH</p><h2 id="subjects-heading">{branch ? `Subjects in ${branch.name}` : "Available subjects"}</h2></div>
        <span>{visibleSubjects.length} ready to explore</span>
      </div>
      {visibleSubjects.length === 0 ? <div className="learn-state"><h3>{subjectQuery ? "No matching subject" : "Subjects are on their way"}</h3><p>{subjectQuery ? "Try another subject name or clear the search." : "Your admin will see this branch here once subjects are published."}</p></div> :
        <div className="learn-grid">{visibleSubjects.map(subject => {
          const subjectChapters = chapters.filter(chapter => chapter.subject === subject._id);
          const chapterIds = new Set(subjectChapters.map(chapter => chapter._id));
          const subjectTests = tests.filter(test => chapterIds.has(test.chapter));
          return <article className="learn-card subject-path-card" key={subject._id}>
            <span className="learn-code">{subject.code || "SUBJECT"}</span><h3>{subject.name}</h3><p>{subject.description || "Work through chapter-wise practice and build your confidence."}</p>
            <p className="learn-meta">{subjectChapters.length ? `${subjectChapters.length} chapters to explore` : "Learning path being prepared"}</p>
            <Link className="learn-card-link" to={`/student/subjects/${subject._id}`}>Open subject <span aria-hidden="true">→</span></Link>
            {subjectTests.length > 0 ? <span className="subject-ready-note">Timed practice is ready</span> : null}
          </article>;
        })}</div>}
    </section>

    <section className="common-subject-section" aria-labelledby="common-subjects-heading">
      <div className="learn-section-heading"><div><p className="learn-eyebrow">COMMON TO EVERY BRANCH</p><h2 id="common-subjects-heading">Foundation subjects</h2></div><span>Shared GATE practice</span></div>
      <div className="learn-grid">{commonSubjects.map(subject => {
        const configuredSubject = subjects.find(item => item.name.toLowerCase() === subject.name.toLowerCase() && item.isCommon);
        return <Link className="learn-card common-subject-card" key={subject.key} to={configuredSubject ? `/student/subjects/${configuredSubject._id}` : `/student/subjects/common/${subject.key}`}>
          <span className="learn-code">{subject.code}</span><h3>{subject.name}</h3><p>{subject.description}</p>
          <span className={configuredSubject ? "subject-ready-note" : "coming-soon-label"}>{configuredSubject ? "Open common practice" : "We are working on it"} <span aria-hidden="true">→</span></span>
        </Link>;
      })}</div>
    </section>
  </>;
}
