import { useEffect, useState } from "react";
import { Link, Navigate, useLocation, useNavigate } from "react-router-dom";
import { useAuth } from "../hooks/useAuth";
import { branchApi, registerStudent } from "../services/api";

const currentYear = new Date().getFullYear();

export default function RegisterPage() {
  const { isAuthenticated, isAdmin, isLoading } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const [branches, setBranches] = useState([]);
  const [branchLoading, setBranchLoading] = useState(true);
  const [branchError, setBranchError] = useState("");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    let active = true;
    branchApi.list()
      .then((data) => {
        if (active) setBranches(data.branches || []);
      })
      .catch((loadError) => {
        if (active) setBranchError(loadError.message || "Unable to load branches.");
      })
      .finally(() => {
        if (active) setBranchLoading(false);
      });

    return () => {
      active = false;
    };
  }, []);

  if (!isLoading && isAuthenticated) {
    return <Navigate to={isAdmin ? "/admin/dashboard" : "/student/dashboard"} replace />;
  }

  async function submit(event) {
    event.preventDefault();
    const values = Object.fromEntries(new FormData(event.currentTarget));
    const mobileNumber = values.mobileNumber.trim();
    const collegeName = values.collegeName.trim();
    const passingYear = Number(values.passingYear);

    if (values.password !== values.confirmPassword) {
      setError("Passwords do not match.");
      return;
    }
    if (values.name.trim().length < 2) {
      setError("Enter a name with at least 2 characters.");
      return;
    }
    if (!/^\+?[\d\s()-]{10,18}$/.test(mobileNumber)) {
      setError("Enter a valid mobile number.");
      return;
    }
    if (collegeName.length < 2) {
      setError("Enter your college name.");
      return;
    }
    if (!Number.isInteger(passingYear) || passingYear < 1950 || passingYear > currentYear + 10) {
      setError(`Enter a passing year between 1950 and ${currentYear + 10}.`);
      return;
    }

    setBusy(true);
    setError("");
    try {
      await registerStudent({
        name: values.name.trim(),
        mobileNumber,
        branch: values.branch,
        collegeName,
        passingYear,
        email: values.email.trim(),
        password: values.password,
      });
      navigate("/login", { replace: true, state: { registered: true, from: location.state?.from } });
    } catch (registrationError) {
      setError(registrationError.message);
    } finally {
      setBusy(false);
    }
  }

  return (
    <main className="auth-page">
      <section className="auth-panel register-panel" aria-labelledby="register-title">
        <p className="auth-brand">GATE Test Series</p>
        <h1 id="register-title">Create your candidate profile</h1>
        <p className="auth-copy">
          Choose your branch once. Your subjects and tests will be ready after you log in.
        </p>

        <form className="auth-form register-form" onSubmit={submit}>
          {error ? <p className="alert alert-error" role="alert">{error}</p> : null}
          {branchError ? <p className="alert alert-error" role="alert">{branchError}</p> : null}

          <div className="register-grid">
            <div className="field register-full-field">
              <label htmlFor="name">Full name</label>
              <input id="name" name="name" autoComplete="name" maxLength={100} minLength={2} required />
            </div>

            <div className="field">
              <label htmlFor="mobileNumber">Mobile number</label>
              <input
                id="mobileNumber"
                name="mobileNumber"
                type="tel"
                inputMode="tel"
                autoComplete="tel"
                placeholder="e.g. 9876543210"
                required
              />
            </div>

            <div className="field">
              <label htmlFor="branch">GATE branch</label>
              <select id="branch" name="branch" defaultValue="" disabled={branchLoading || !branches.length} required>
                <option value="">{branchLoading ? "Loading branches..." : "Select your branch"}</option>
                {branches.map((branch) => (
                  <option key={branch._id} value={branch._id}>
                    {branch.name} ({branch.code})
                  </option>
                ))}
              </select>
            </div>

            <div className="field register-full-field">
              <label htmlFor="collegeName">College name</label>
              <input id="collegeName" name="collegeName" autoComplete="organization" maxLength={150} required />
            </div>

            <div className="field">
              <label htmlFor="passingYear">Passing year</label>
              <input id="passingYear" name="passingYear" type="number" min="1950" max={currentYear + 10} required />
            </div>

            <div className="field">
              <label htmlFor="email">Email address</label>
              <input id="email" name="email" type="email" autoComplete="email" required />
            </div>

            <div className="field">
              <label htmlFor="password">Password</label>
              <input id="password" name="password" type="password" autoComplete="new-password" minLength={6} required />
              <span className="field-hint">At least 6 characters</span>
            </div>

            <div className="field">
              <label htmlFor="confirmPassword">Confirm password</label>
              <input id="confirmPassword" name="confirmPassword" type="password" autoComplete="new-password" minLength={6} required />
            </div>
          </div>

          <button className="primary-button" disabled={busy || branchLoading || !branches.length} type="submit">
            {busy ? "Creating profile..." : "Create account"}
          </button>
        </form>

        <p className="auth-copy">
          Already registered? <Link to="/login" state={{ from: location.state?.from }}>Sign in</Link>
        </p>
      </section>
    </main>
  );
}
