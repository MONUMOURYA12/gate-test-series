import { Link, useOutletContext, useSearchParams } from "react-router-dom";

export default function StudentTestsPage() {
  const { branches, subjects, chapters, tests } = useOutletContext();
  const [params, setParams] = useSearchParams();
  const branch = params.get("branch") || "";
  const subject = params.get("subject") || "";
  const chapter = params.get("chapter") || "";
  const query = params.get("q") || "";
  const availableSubjects = subjects.filter(s => !branch || s.branch === branch || s.isCommon);
  const subjectIds = new Set(availableSubjects.filter(s => !subject || s._id === subject).map(s => s._id));
  const availableChapters = chapters.filter(c => subjectIds.has(c.subject));
  const chapterIds = new Set(availableChapters.filter(c => !chapter || c._id === chapter).map(c => c._id));
  const matches = tests.filter(t => chapterIds.has(t.chapter) && t.title.toLowerCase().includes(query.trim().toLowerCase()));
  const pages = Math.max(1, Math.ceil(matches.length / 12));
  const rawPage = Number(params.get("page"));
  const page = Math.min(pages, Number.isInteger(rawPage) && rawPage > 0 ? rawPage : 1);
  function change(key, value) {
    const next = new URLSearchParams(params);
    if (value) next.set(key, value); else next.delete(key);
    if (key === "branch") { next.delete("subject"); next.delete("chapter"); }
    if (key === "subject") next.delete("chapter");
    if (key !== "page") next.delete("page");
    setParams(next, { replace: key === "q" });
  }
  return <>
    <p className="learn-eyebrow">FIND YOUR NEXT CHALLENGE</p><h1 className="learn-title">Test catalogue</h1>
    <p className="learn-intro">Explore published tests by branch, subject and chapter.</p>
    <div className="learn-filters" role="search" aria-label="Filter tests">
      {[{ key: "branch", label: "Branch", value: branch, items: branches }, { key: "subject", label: "Subject", value: subject, items: availableSubjects }, { key: "chapter", label: "Chapter", value: chapter, items: availableChapters }].map(filter =>
        <div className="field" key={filter.key}><label htmlFor={filter.key}>{filter.label}</label><select id={filter.key} value={filter.value} onChange={e => change(filter.key, e.target.value)}><option value="">All {filter.key === "branch" ? "branches" : `${filter.key}s`}</option>{filter.items.map(item => <option value={item._id} key={item._id}>{item.name}</option>)}</select></div>)}
      <div className="field"><label htmlFor="search">Search test titles</label><input id="search" type="search" value={query} onChange={e => change("q", e.target.value)} placeholder="e.g. Network analysis" /></div>
    </div>
    <div className="learn-section-heading"><p role="status">{matches.length} {matches.length === 1 ? "test" : "tests"} found</p><button className="secondary-button" onClick={() => setParams({})}>Reset filters</button></div>
    {matches.length === 0 ? <div className="learn-state"><h2>No tests found</h2><p>Try a different filter. New tests will appear here once published.</p></div> :
      <div className="learn-grid">{matches.slice((page - 1) * 12, page * 12).map(test => {
        const testChapter = chapters.find(c => c._id === test.chapter);
        const testSubject = subjects.find(s => s._id === testChapter?.subject);
        return <article className="learn-card" key={test._id}>
          <span className="learn-tag">{testSubject?.name}</span><h2>{test.title}</h2><p>{testChapter?.name}</p>
          <dl className="learn-test-stats"><div><dt>Duration</dt><dd>{test.duration} min</dd></div><div><dt>Questions</dt><dd>{test.totalQuestions}</dd></div><div><dt>Marks</dt><dd>{test.totalMarks}</dd></div></dl>
          <Link className="learn-card-link" to={`/student/tests/${test._id}?${params.toString()}`}>View test details <span aria-hidden="true">→</span></Link>
        </article>;
      })}</div>}
    {pages > 1 && <nav className="learn-pagination" aria-label="Test pages"><button className="secondary-button" disabled={page === 1} onClick={() => change("page", String(page - 1))}>Previous</button><span>Page {page} of {pages}</span><button className="secondary-button" disabled={page === pages} onClick={() => change("page", String(page + 1))}>Next</button></nav>}
  </>;
}
