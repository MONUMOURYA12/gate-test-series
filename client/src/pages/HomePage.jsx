import { Link } from "react-router-dom";
import "../home.css";

const studyRoute = [
  { label: "Choose a subject", value: "Follow your GATE path", tone: "mint" },
  { label: "Focus on one concept", value: "Learn at your pace", tone: "amber" },
  { label: "Build your confidence", value: "Keep moving forward", tone: "coral" },
];

export default function HomePage() {
  return (
    <div className="home-shell">
      <header className="home-header">
        <div className="home-container home-header-inner">
          <Link className="home-brand" to="/" aria-label="GATE Test Series home">
            <span className="home-logo">G</span>
            <span>
              GATE <strong>Test Series</strong>
            </span>
          </Link>

          <Link className="home-login-button" to="/login">
            Login <span aria-hidden="true">↗</span>
          </Link>
        </div>
      </header>

      <main>
        <section className="home-hero" aria-labelledby="home-title">
          <div className="home-container home-hero-grid">
            <div className="home-hero-copy">
              <p className="home-eyebrow">GATE PREPARATION, MADE CLEAR</p>
              <h1 id="home-title">
                Practice with purpose.
                <span>Perform with confidence.</span>
              </h1>
              <p className="home-hero-description">
                Build a steady preparation habit with chapter-wise tests, timed
                exams, and feedback that helps you know what to work on next.
              </p>
              <div className="home-actions">
                <Link className="home-primary-button" to="/login">
                  Start practicing <span aria-hidden="true">→</span>
                </Link>
                <a className="home-text-link" href="#how-it-works">
                  See how it works <span aria-hidden="true">↓</span>
                </a>
              </div>
              <div className="home-proof" aria-label="Platform highlights">
                <span><i aria-hidden="true">✓</i> Chapter-wise practice</span>
                <span><i aria-hidden="true">✓</i> Timed attempts</span>
                <span><i aria-hidden="true">✓</i> Clear results</span>
              </div>
            </div>

            <div className="home-visual" aria-label="Preparation dashboard preview">
              <div className="home-visual-topline">
                <span className="home-visual-kicker">YOUR NEXT SESSION</span>
                <span className="home-status"><i aria-hidden="true" /> Ready</span>
              </div>
              <div className="home-visual-title-row">
                <div>
                  <p>Personal study route</p>
                  <h2>Make today count</h2>
                </div>
                <span className="home-round-mark">G</span>
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

        <section className="home-metrics" aria-label="Platform benefits">
          <div className="home-container home-metrics-grid">
            <div><strong>YOUR PATH</strong><span>Choose a branch and find the subjects that matter to you.</span></div>
            <div><strong>YOUR PACE</strong><span>Move from focused learning to timed practice when ready.</span></div>
            <div><strong>YOUR NEXT STEP</strong><span>Return to the exact subject or test that needs attention.</span></div>
          </div>
        </section>

        <section className="home-how" id="how-it-works" aria-labelledby="how-title">
          <div className="home-container">
            <div className="home-section-heading">
              <p className="home-eyebrow">A SIMPLE RHYTHM</p>
              <h2 id="how-title">Small sessions. Better understanding.</h2>
              <p>Everything you need to turn preparation into a routine that lasts.</p>
            </div>
            <div className="home-feature-grid">
              <article className="home-feature-card">
                <span className="home-feature-number">START</span>
                <h3>Choose your subject</h3>
                <p>Browse by branch, subject, and chapter so your learning stays focused.</p>
              </article>
              <article className="home-feature-card featured">
                <span className="home-feature-number">FOCUS</span>
                <h3>Learn with intention</h3>
                <p>Move from concept practice to timed preparation when you feel ready.</p>
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
          <span>GATE Test Series</span>
          <span>Build your understanding, one chapter at a time.</span>
        </div>
      </footer>
    </div>
  );
}
