import { Link, useOutletContext, useParams } from "react-router-dom";

export default function StudentSubjectPage() {
  const { subjectId } = useParams();
  const { branches, subjects, chapters, tests } = useOutletContext();
  const subject = subjects.find((item) => item._id === subjectId);
  const branch = branches.find((item) => item._id === subject?.branch);

  if (!subject) {
    return (
      <div className="learn-state" role="alert">
        <h1>Subject unavailable</h1>
        <p>This subject is no longer available in your branch catalogue.</p>
        <Link className="secondary-button" to="/student/dashboard">Back to dashboard</Link>
      </div>
    );
  }

  const subjectChapters = chapters.filter((chapter) => chapter.subject === subject._id);
  const subjectChapterIds = new Set(subjectChapters.map((chapter) => chapter._id));
  const subjectTests = tests.filter((test) => subjectChapterIds.has(test.chapter));

  return (
    <div className="subject-page">
      <Link className="learn-back" to="/student/dashboard">Back to dashboard</Link>
      <section className="learn-detail subject-hero">
        <p className="learn-eyebrow">{branch ? `${branch.code} / SUBJECT` : "SUBJECT"}</p>
        <h1 className="learn-title">{subject.name}</h1>
        <p className="learn-intro">{subject.description || "Work through chapters, then test your understanding under time."}</p>
        <dl className="learn-stats subject-stats">
          <div><dt>Chapters</dt><dd>{subjectChapters.length}</dd></div>
          <div><dt>Tests</dt><dd>{subjectTests.length}</dd></div>
          <div><dt>Questions</dt><dd>{subjectTests.reduce((sum, test) => sum + (test.totalQuestions || 0), 0)}</dd></div>
        </dl>
        <p className="learn-notice">Questions stay inside their timed test. Your answers, score, accuracy, and explanations appear after submission.</p>
      </section>

      <section aria-labelledby="chapter-tests-title">
        <div className="learn-section-heading">
          <div>
            <p className="learn-eyebrow">CHAPTER PRACTICE</p>
            <h2 id="chapter-tests-title">Tests in this subject</h2>
          </div>
          <span>{subjectTests.length} tests</span>
        </div>

        {!subjectChapters.length ? (
          <div className="learn-state"><h3>Chapters are coming soon</h3><p>Your admin will publish the learning path here.</p></div>
        ) : (
          <div className="subject-chapter-list">
            {subjectChapters.map((chapter) => {
              const chapterTests = tests.filter((test) => test.chapter === chapter._id);
              return (
                <section className="subject-chapter" key={chapter._id}>
                  <div className="subject-chapter-heading">
                    <div>
                      <span className="learn-code">Chapter {chapter.order || ""}</span>
                      <h3>{chapter.name}</h3>
                    </div>
                    <span>{chapterTests.length} tests</span>
                  </div>
                  {chapter.description ? <p>{chapter.description}</p> : null}
                  {!chapterTests.length ? <p className="subject-empty">Tests for this chapter are coming soon.</p> : (
                    <div className="subject-test-list">
                      {chapterTests.map((test) => (
                        <article className="subject-test-row" key={test._id}>
                          <div>
                            <h4>{test.title}</h4>
                            <p>{test.totalQuestions} questions · {test.duration} minutes · {test.totalMarks} marks</p>
                          </div>
                          <Link className="secondary-button" to={`/student/tests/${test._id}`}>View test</Link>
                        </article>
                      ))}
                    </div>
                  )}
                </section>
              );
            })}
          </div>
        )}
      </section>
    </div>
  );
}
