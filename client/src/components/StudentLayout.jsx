import { useEffect, useState } from "react";
import { NavLink, Outlet, useLocation } from "react-router-dom";
import { useAuth } from "../hooks/useAuth";
import { studentApi } from "../services/api";
import "../student.css";

export default function StudentLayout() {
  const { user, logout } = useAuth();
  const [data, setData] = useState(null);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(true);
  const [revision, setRevision] = useState(0);
  const location = useLocation();
  useEffect(() => {
    const controller = new AbortController();
    studentApi.catalogue(controller.signal).then(result => { if (!controller.signal.aborted) setData(result); }).catch(err => {
      if (!controller.signal.aborted) setError(err.message);
    }).finally(() => { if (!controller.signal.aborted) setLoading(false); });
    return () => controller.abort();
  }, [revision]);
  useEffect(() => { window.scrollTo(0, 0); }, [location.pathname]);
  return <div className="learn-shell">
    <a className="learn-skip" href="#student-content">Skip to content</a>
    <header className="learn-header">
      <NavLink to="/student/dashboard" className="learn-brand"><span className="learn-logo">G</span><span>GATE <strong>Test Series</strong></span></NavLink>
      <nav aria-label="Student navigation"><NavLink to="/student/dashboard">Dashboard</NavLink><NavLink to="/student/tests">Explore tests</NavLink></nav>
      <div className="learn-account"><span>{user?.name}</span><button className="secondary-button" onClick={logout}>Log out</button></div>
    </header>
    <main id="student-content" className="learn-main">
      {loading ? <div className="learn-state" role="status">Loading your test catalogue…</div> : error ?
        <div className="learn-state" role="alert"><h1>Unable to load tests</h1><p>{error}</p><button className="primary-button" onClick={() => { setLoading(true); setError(""); setRevision(r => r + 1); }}>Try again</button></div> :
        <Outlet context={data} />}
    </main>
    <footer className="learn-footer">GATE Test Series · Build your understanding, one chapter at a time.</footer>
  </div>;
}
