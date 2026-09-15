import { Navigate, Outlet, useLocation } from "react-router-dom";
import { useAuth } from "../hooks/useAuth";

function StudentProtectedRoute() {
  const location = useLocation();
  const {
    user,
    isLoading,
    isAuthenticated,
    isAdmin,
  } = useAuth();

  if (isLoading) {
    return (
      <div className="loader-page">
        <p>Loading...</p>
      </div>
    );
  }

  if (!isAuthenticated) {
    return <Navigate to="/login" state={{ from: location }} replace />;
  }

  if (isAdmin) {
    return <Navigate to="/admin/dashboard" replace />;
  }

  if (user?.role !== "student") {
    return <Navigate to="/unauthorized" replace />;
  }

  return <Outlet />;
}

export default StudentProtectedRoute;