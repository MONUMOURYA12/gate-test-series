import { NavLink, Outlet } from "react-router-dom";
import { useAuth } from "../hooks/useAuth";

const navItems = [
  { label: "Dashboard", to: "/admin/dashboard" },
  { label: "Branches", to: "/admin/branches" },
  { label: "Subjects", to: "/admin/subjects" },
  { label: "Chapters", to: "/admin/chapters" },
  { label: "Tests", to: "/admin/tests" },
  { label: "Questions", to: "/admin/questions" },
  { label: "Bulk Upload", to: "/admin/bulk-upload" },
];

function AdminLayout() {
  const { user, logout, isLoggingOut, logoutError } = useAuth();

  return (
    <div className="admin-layout">
      <aside className="admin-sidebar">
        <div className="sidebar-brand">
          <strong>GATE Admin</strong>
          <span>Test Series Console</span>
        </div>

        <nav className="sidebar-nav" aria-label="Admin navigation">
          {navItems.map((item) => (
            <NavLink className="sidebar-link" key={item.to} to={item.to}>
              {item.label}
            </NavLink>
          ))}
        </nav>
      </aside>

      <main className="admin-main">
        <header className="admin-header">
          <div className="admin-user">
            <strong>{user?.name || "Admin"}</strong>
            <span>{user?.email}</span>
          </div>
          <button className="secondary-button" type="button" onClick={logout} disabled={isLoggingOut}>
            {isLoggingOut ? "Logging out..." : "Logout"}
          </button>
        </header>

        <section className="admin-content">
          {logoutError ? <p className="alert alert-error" role="alert">{logoutError}</p> : null}
          <Outlet />
        </section>
      </main>
    </div>
  );
}

export default AdminLayout;
