import { Link } from "react-router-dom";
import Seo from "../components/Seo.jsx";
import groups from "../../../shared/examCatalogue.json";
import "../home.css";

const studyRoute = [
  { label: "Choose your exam", value: "Find your preparation path", tone: "mint" },
  { label: "Focus on one subject", value: "Learn at your pace", tone: "amber" },
  { label: "Build your confidence", value: "Keep moving forward", tone: "coral" },
];

export default function HomePage() {
  return (
    <div className="home-shell">
      <Seo
        title="All India Test Series | SSC, JEE, NEET and GATE Practice"
        description="Focused subject practice, timed exams, and performance insights for SSC, JEE, NEET, and GATE preparation."
      />
      <main>
        <section className="home-hero" aria-labelledby="home-title">
          <div className="home-container home-hero-grid">
            <div className="home-hero-copy">
              <p className="home-eyebrow">SSC / RAILWAY / GATE / JEE / NEET</p>
              <h1 id="home-title">
                One place for every goal.
                <span>Practice with confidence.</span>
              </h1>
              <p className="home-hero-description">
                Build a steady preparation habit with focused practice, timed
                exams, and feedback that helps you know what to work on next.
              </p>
              <div className="home-actions">
                <a className="home-primary-button" href="#choose-exam">
                  Explore your exam <span aria-hidden="true">→</span>
                </a>
                <a className="home-text-link" href="#how-it-works">
                  See how it works <span aria-hidden="true">↓</span>
                </a>
              </div>
              <div className="home-proof" aria-label="Platform highlights">
                <span><i aria-hidden="true">✓</i> Browse before you sign in</span>
                <span><i aria-hidden="true">✓</i> Timed attempts</span>
                <span><i aria-hidden="true">✓</i> Clear performance insights</span>
              </div>
            </div>

            <div className="home-visual" aria-label="Preparation dashboard preview">
              <div className="home-visual-topline">
                <span className="home-visual-kicker">YOUR NEXT SESSION</span>
                <span className="home-status"><i aria-hidden="true" /> Ready</span>
              </div>
              <div className="home-visual-title-row">
                <div>
                  <p>Personal preparation route</p>
                  <h2>Make your next session count</h2>
                </div>
                <span className="home-round-mark" aria-hidden="true">🎯</span>
              </div>
              <div className="home-progress-block">
                <div className="home-progress-label"><span>Study rhythm</span><strong>Steady</strong></div>
                <div className="home-progress-track"><span /></div>
              </div>
              <div className="home-focus-list">
                {studyRoute.map((item) => (
                  <div className="home-focus-item" key={item.label}>
                    <span className={`home-focus-icon ${item.tone}`} aria-hidden="true" />
                    <span>{item.label}</span>
                    <strong>{item.value}</strong>
                  </div>
                ))}
              </div>
              <div className="home-visual-footer">
                <span><strong>Self-paced</strong> preparation, built around your goal</span>
                <span className="home-arrow-circle" aria-hidden="true">→</span>
              </div>
            </div>
          </div>
        </section>

        <section className="home-exam-paths" id="choose-exam" aria-labelledby="choose-exam-title"><div className="home-container"><div className="home-section-heading"><p className="home-eyebrow">YOUR AMBITION, YOUR PATH</p><h2 id="choose-exam-title">Where would you like to begin?</h2><p>Explore subjects and available practice. Log in only when you’re ready for a test.</p></div><div className="home-exam-path-grid">{groups.map(group => <Link key={group.id} to={`/exams/${group.id}`}><span aria-hidden="true">{group.icon}</span><h3>{group.label}</h3><p>{group.id === 'gate' ? '30 papers to explore' : group.id === 'neet' ? 'Physics, Chemistry, Biology' : group.id === 'jee' ? 'Main & Advanced' : 'Explore exams & subjects'} →</p></Link>)}</div></div></section>

        <section className="home-metrics" aria-label="Platform benefits">
          <div className="home-container home-metrics-grid">
          <div><strong>YOUR EXAM</strong><span>Choose the exam and subjects that match your goal.</span></div>
          <div><strong>YOUR PACE</strong><span>Move from focused learning to timed practice when ready.</span></div>
          <div><strong>YOUR NEXT STEP</strong><span>Use performance feedback to decide what to practise next.</span></div>
          </div>
        </section>

        <section className="home-how" id="how-it-works" aria-labelledby="how-title">
          <div className="home-container">
            <div className="home-section-heading">
              <p className="home-eyebrow">A SIMPLE RHYTHM</p>
              <h2 id="how-title">A clear rhythm for serious preparation.</h2>
              <p>Everything you need to turn preparation into a routine that lasts.</p>
            </div>
            <div className="home-feature-grid">
              <article className="home-feature-card">
                <span className="home-feature-number">START</span>
                <h3>Choose your exam</h3>
                <p>Start with the exam that matters to you and find the right subject path.</p>
              </article>
              <article className="home-feature-card featured">
                <span className="home-feature-number">FOCUS</span>
                <h3>Learn with intention</h3>
                <p>Move from concept practice to timed preparation when your foundation is ready.</p>
              </article>
              <article className="home-feature-card">
                <span className="home-feature-number">REVIEW</span>
                <h3>Know your next step</h3>
                <p>Use your performance feedback to return to the right place.</p>
              </article>
            </div>
          </div>
        </section>
      </main>

      <footer className="home-footer">
        <div className="home-container home-footer-inner">
          <span>ParikshaSarthi</span>
          <span>Build your understanding, one chapter at a time.</span>
        </div>
      </footer>
    </div>
  );
}
