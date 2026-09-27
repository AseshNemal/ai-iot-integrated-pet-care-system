import { useEffect, useState } from "react";
import { Link, useLocation, useNavigate } from "react-router-dom";
import hrApi from "../utils/hrApi";
import "../styles/AdminShell.css";

const navItems = [
  { label: "Dashboard", path: "/adminDashboard", icon: "dashboard" },
  { label: "Employees", path: "/employee", icon: "employees" },
  { label: "Ad reviews", path: "/admin-dashboard", icon: "reviews" },
  { label: "Product management", path: "/adminDashboard/product", icon: "products" },
  { label: "Store preview", path: "/product/all", icon: "store" },
  { label: "Adoption portal", path: "/adoption-portal", icon: "paw" },
  { label: "Submit adoption ad", path: "/submit-ad", icon: "add" },
];

function AdminIcon({ name }) {
  const paths = {
    dashboard: <><rect x="4" y="4" width="6" height="6" rx="1"/><rect x="14" y="4" width="6" height="6" rx="1"/><rect x="4" y="14" width="6" height="6" rx="1"/><rect x="14" y="14" width="6" height="6" rx="1"/></>,
    employees: <><circle cx="9" cy="8" r="3"/><path d="M3.5 19c.5-4 2.3-6 5.5-6s5 2 5.5 6M16 8.5a2.5 2.5 0 0 1 0 5M16 14c2.6.2 4 1.8 4.5 5"/></>,
    reviews: <><path d="M12 3 4.5 6v5c0 4.7 2.8 8 7.5 10 4.7-2 7.5-5.3 7.5-10V6L12 3Z"/><path d="m9 12 2 2 4-4"/></>,
    products: <><path d="M4 7h16l-1 13H5L4 7Z"/><path d="M8 7a4 4 0 0 1 8 0"/></>,
    store: <><path d="M4 10v10h16V10M3 4h18l-2 6H5L3 4Z"/><path d="M9 20v-6h6v6"/></>,
    paw: <><circle cx="8" cy="7" r="2"/><circle cx="16" cy="7" r="2"/><circle cx="5" cy="12" r="2"/><circle cx="19" cy="12" r="2"/><path d="M8 19c-1.5-2.8.5-6 4-6s5.5 3.2 4 6c-1.2 2.2-6.8 2.2-8 0Z"/></>,
    add: <><rect x="4" y="4" width="16" height="16" rx="3"/><path d="M12 8v8M8 12h8"/></>,
  };
  return <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" aria-hidden="true">{paths[name]}</svg>;
}

export default function AdminShell({ children, pageTitle }) {
  const [collapsed, setCollapsed] = useState(false);
  const [employee, setEmployee] = useState(null);
  const [logoutError, setLogoutError] = useState("");
  const location = useLocation();
  const navigate = useNavigate();

  useEffect(() => {
    let active = true;
    hrApi.get("/employee/me").then(({ data }) => {
      if (active) setEmployee(data.user || null);
    }).catch(() => {});
    return () => { active = false; };
  }, []);

  const handleLogout = async () => {
    setLogoutError("");
    try {
      await hrApi.post("/employee/logout");
      navigate("/employee-login", { replace: true });
    } catch {
      setLogoutError("Logout failed. Please try again.");
    }
  };

  return (
    <div className={`admin-shell ${collapsed ? "admin-shell--collapsed" : ""}`}>
      <header className="admin-shell__header">
        <button
          type="button"
          className="admin-shell__menu-button"
          aria-label={collapsed ? "Expand admin navigation" : "Collapse admin navigation"}
          aria-expanded={!collapsed}
          onClick={() => setCollapsed((value) => !value)}
        >
          <span /><span /><span />
        </button>
        <Link className="admin-shell__brand" to="/adminDashboard">
          <span className="admin-shell__brand-mark">P</span>
          <span><strong>Pet Care</strong><small>Administration</small></span>
        </Link>
        <div className="admin-shell__identity">
          <span className="admin-shell__identity-copy">
            <strong>{employee ? `${employee.firstName || ""} ${employee.lastName || ""}`.trim() || employee.username : "HR Admin"}</strong>
            <small>{employee?.role || "Administrator"}</small>
          </span>
          <button type="button" className="admin-shell__logout" onClick={handleLogout}>Sign out</button>
        </div>
      </header>

      <aside className="admin-shell__sidebar" aria-label="Admin navigation">
        <p className="admin-shell__section-label">Workspace</p>
        <nav>
          {navItems.map((item) => {
            const active = location.pathname === item.path;
            return (
              <Link key={item.path} to={item.path} className={active ? "is-active" : ""} aria-current={active ? "page" : undefined} title={collapsed ? item.label : undefined}>
                <AdminIcon name={item.icon} />
                <span>{item.label}</span>
              </Link>
            );
          })}
        </nav>
        <div className="admin-shell__sidebar-footer">
          <span>Secure HR session</span>
          <strong>Admin access</strong>
        </div>
      </aside>

      <main className="admin-shell__main" id="admin-main-content">
        {pageTitle && <div className="admin-shell__page-heading"><p>Administration</p><h1>{pageTitle}</h1></div>}
        {logoutError && <div className="admin-shell__error" role="alert">{logoutError}</div>}
        {children}
      </main>
    </div>
  );
}
