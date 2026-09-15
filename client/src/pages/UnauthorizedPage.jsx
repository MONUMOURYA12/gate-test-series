import { Link } from "react-router-dom";
import { useAuth } from "../hooks/useAuth";

function UnauthorizedPage() {
  const { logout } = useAuth();

  return (
    <main className="auth-page">
      <section className="auth-panel" aria-labelledby="unauthorized-title">
        <p className="auth-brand">Access Restricted</p>
        <h1 id="unauthorized-title">Admin access required</h1>
        <p className="auth-copy">
          The signed-in account does not have permission to open the admin
          dashboard.
        </p>

        <div className="auth-form">
          <Link className="primary-button" to="/login" onClick={logout}>
            Back to Login
          </Link>
        </div>
      </section>
    </main>
  );
}

export default UnauthorizedPage;
