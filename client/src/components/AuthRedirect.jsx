import { Navigate } from "react-router-dom";
import { useAuth } from "../hooks/useAuth";
import HomePage from "../pages/HomePage.jsx";

function AuthRedirect() {
  const { isAuthenticated, isAdmin, isLoading } = useAuth();

  if (isLoading) {
    return <div className="loader-page">Loading...</div>;
  }

  if (isAuthenticated) {
    return <Navigate to={isAdmin ? "/admin/dashboard" : "/student/dashboard"} replace />;
  }

  return <HomePage />;
}

export default AuthRedirect;
