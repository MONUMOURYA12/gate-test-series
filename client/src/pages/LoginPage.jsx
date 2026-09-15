import { useState } from "react";
import { Link, Navigate, useLocation, useNavigate } from "react-router-dom";
import { useAuth } from "../hooks/useAuth";

function loginDestination(isAdmin, from) {
  const prefix = isAdmin ? "/admin" : "/student";
  return from?.pathname?.startsWith(`${prefix}/`)
    ? `${from.pathname}${from.search || ""}`
    : `${prefix}/dashboard`;
}

function LoginPage() {
  const { isAuthenticated, isAdmin, isLoading, login } = useAuth();
  const location = useLocation();
  const navigate = useNavigate();
  const [formData, setFormData] = useState({
    email: "",
    password: "",
  });
  const [error, setError] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);

  if (!isLoading && isAuthenticated) {
    return <Navigate to={loginDestination(isAdmin, location.state?.from)} replace />;
  }

  const handleChange = (event) => {
    const { name, value } = event.target;
    setFormData((current) => ({
      ...current,
      [name]: value,
    }));
  };

  const handleSubmit = async (event) => {
    event.preventDefault();
    setError("");
    setIsSubmitting(true);

    try {
      const user = await login(formData);

      const destination = loginDestination(user.role === "admin", location.state?.from);

      navigate(destination, { replace: true });
    } catch (loginError) {
      setError(loginError.message);
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <main className="auth-page">
      <section className="auth-panel" aria-labelledby="login-title">
        <p className="auth-brand">GATE Test Series</p>
        <h1 id="login-title">Welcome back</h1>
        <p className="auth-copy">
          Sign in to explore your GATE test series.
        </p>

        <form className="auth-form" onSubmit={handleSubmit}>
          {location.state?.registered ? <p role="status">Account created. Sign in to continue.</p> : null}
          {error ? <div role="alert" className="alert alert-error">{error}</div> : null}

          <div className="field">
            <label htmlFor="email">Email</label>
            <input
              autoComplete="email"
              id="email"
              name="email"
              onChange={handleChange}
              required
              type="email"
              value={formData.email}
            />
          </div>

          <div className="field">
            <label htmlFor="password">Password</label>
            <input
              autoComplete="current-password"
              id="password"
              name="password"
              onChange={handleChange}
              required
              type="password"
              value={formData.password}
            />
          </div>

          <button
            className="primary-button"
            disabled={isSubmitting}
            type="submit"
          >
            {isSubmitting ? "Signing in..." : "Login"}
          </button>
        </form>
        <p className="auth-copy">New here? <Link to="/register" state={{ from: location.state?.from }}>Create a student account</Link></p>
      </section>
    </main>
  );
}

export default LoginPage;
