import { Navigate, Route, Routes } from "react-router-dom";
import "./App.css";

import AdminLayout from "./components/AdminLayout.jsx";
import AdminProtectedRoute from "./components/AdminProtectedRoute.jsx";
import AuthRedirect from "./components/AuthRedirect.jsx";
import StudentProtectedRoute from "./components/StudentProtectedRoute.jsx";

import BranchManagementPage from "./pages/BranchManagementPage.jsx";
import ChapterManagementPage from "./pages/ChapterManagementPage.jsx";
import AdminDashboard from "./pages/AdminDashboard.jsx";
import LoginPage from "./pages/LoginPage.jsx";
import PlaceholderPage from "./pages/PlaceholderPage.jsx";
import SubjectManagementPage from "./pages/SubjectManagementPage.jsx";
import UnauthorizedPage from "./pages/UnauthorizedPage.jsx";
import TestManagementPage from "./pages/TestManagementPage.jsx";
import QuestionManagementPage from "./pages/QuestionManagementPage.jsx";

import RegisterPage from "./pages/RegisterPage.jsx";
import StudentLayout from "./components/StudentLayout.jsx";
import StudentTestsPage from "./pages/StudentTestsPage.jsx";
import StudentTestDetailsPage from "./pages/StudentTestDetailsPage.jsx";
import StudentDashboard from "./components/StudentDashboard.jsx";

function App() {
  return (
    <Routes>
      {/* =====================================================
          ROOT
          ===================================================== */}

      <Route path="/" element={<AuthRedirect />} />

      {/* =====================================================
          AUTH
          ===================================================== */}

      <Route path="/login" element={<LoginPage />} />

      <Route path="/register" element={<RegisterPage />} />

      <Route
        path="/unauthorized"
        element={<UnauthorizedPage />}
      />

      {/* =====================================================
          ADMIN ROUTES
          ===================================================== */}

      <Route element={<AdminProtectedRoute />}>
        <Route path="/admin" element={<AdminLayout />}>
          <Route
            index
            element={
              <Navigate
                to="/admin/dashboard"
                replace
              />
            }
          />

          <Route
            path="dashboard"
            element={<AdminDashboard />}
          />

          <Route
            path="branches"
            element={<BranchManagementPage />}
          />

          <Route
            path="subjects"
            element={<SubjectManagementPage />}
          />

          <Route
            path="chapters"
            element={<ChapterManagementPage />}
          />

          <Route
            path="tests"
            element={<TestManagementPage />}
          />

          <Route
            path="questions"
            element={<QuestionManagementPage />}
          />

          <Route
            path="bulk-upload"
            element={
              <PlaceholderPage title="Bulk Upload" />
            }
          />
        </Route>
      </Route>

      {/* =====================================================
          STUDENT ROUTES
          ===================================================== */}

      <Route element={<StudentProtectedRoute />}>
        <Route path="/student" element={<StudentLayout />}>
          <Route index element={<Navigate to="dashboard" replace />} />
          <Route path="dashboard" element={<StudentDashboard />} />
          <Route path="tests" element={<StudentTestsPage />} />
          <Route path="tests/:testId" element={<StudentTestDetailsPage />} />
        </Route>
      </Route>

      {/* =====================================================
          FALLBACK
          ===================================================== */}

      <Route
        path="*"
        element={<Navigate to="/" replace />}
      />
    </Routes>
  );
}

export default App;