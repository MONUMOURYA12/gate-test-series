import { useState } from "react";
import { Link, Navigate, useNavigate } from "react-router-dom";
import { useAuth } from "../hooks/useAuth";
import { registerStudent } from "../services/api";

export default function RegisterPage() {
  const { isAuthenticated, isAdmin, isLoading } = useAuth();
  const navigate = useNavigate();
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  if (!isLoading && isAuthenticated) return <Navigate to={isAdmin ? "/admin/dashboard" : "/student/dashboard"} replace />;
  async function submit(event) {
    event.preventDefault();
    const values = Object.fromEntries(new FormData(event.currentTarget));
    if (values.password !== values.confirmPassword) { setError("Passwords do not match."); return; }
    if (values.name.trim().length < 2) { setError("Enter a name with at least 2 characters."); return; }
    setBusy(true); setError("");
    try {
      await registerStudent({ name: values.name.trim(), email: values.email.trim(), password: values.password });
      navigate("/login", { replace: true, state: { registered: true } });
    } catch (err) { setError(err.message); }
    finally { setBusy(false); }
  }
  return <main className="auth-page"><section className="auth-panel" aria-labelledby="register-title">
    <p className="auth-brand">GATE Test Series</p><h1 id="register-title">Start your preparation</h1>
    <p className="auth-copy">Create your student account to explore tests.</p>
    <form className="auth-form" onSubmit={submit}>
      {error && <p className="alert alert-error" role="alert">{error}</p>}
      <div className="field"><label htmlFor="name">Full name</label><input id="name" name="name" autoComplete="name" minLength={2} required /></div>
      <div className="field"><label htmlFor="email">Email</label><input id="email" name="email" type="email" autoComplete="email" required /></div>
      <div className="field"><label htmlFor="password">Password (at least 6 characters)</label><input id="password" name="password" type="password" autoComplete="new-password" minLength={6} required /></div>
      <div className="field"><label htmlFor="confirmPassword">Confirm password</label><input id="confirmPassword" name="confirmPassword" type="password" autoComplete="new-password" minLength={6} required /></div>
      <button className="primary-button" disabled={busy}>{busy ? "Creating account…" : "Create account"}</button>
    </form><p className="auth-copy">Already registered? <Link to="/login">Sign in</Link></p>
  </section></main>;
}
