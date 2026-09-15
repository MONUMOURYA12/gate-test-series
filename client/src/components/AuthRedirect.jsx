import { Navigate } from "react-router-dom";
import { useAuth } from "../hooks/useAuth";

function AuthRedirect() {
  const { isAuthenticated, isAdmin, isLoading } = useAuth();

  if (isLoading) {
    return <div className="loader-page">Loading...</div>;
  }

  if (isAuthenticated) {
    return <Navigate to={isAdmin ? "/admin/dashboard" : "/student/dashboard"} replace />;
  }

  return <Navigate to="/login" replace />;
}

export default AuthRedirect;
