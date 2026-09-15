import { Navigate, Outlet } from "react-router-dom";
import { useAuth } from "../hooks/useAuth";

function StudentProtectedRoute() {
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
    return <Navigate to="/login" replace />;
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