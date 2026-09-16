import { useNavigate } from "react-router-dom";
import { useAuth } from "../hooks/useAuth";

function UnauthorizedPage() {
  const { logout, isLoggingOut, logoutError } = useAuth();
  const navigate = useNavigate();

  const returnToLogin = async () => {
    if (await logout()) navigate("/login", { replace: true });
  };

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
          {logoutError ? <p className="alert alert-error" role="alert">{logoutError}</p> : null}
          <button className="primary-button" type="button" disabled={isLoggingOut} onClick={returnToLogin}>
            {isLoggingOut ? "Logging out..." : "Back to Login"}
          </button>
        </div>
      </section>
    </main>
  );
}

export default UnauthorizedPage;
