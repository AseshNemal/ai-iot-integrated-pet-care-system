import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import hrApi from "../utils/hrApi";
import "../styles/AdminShell.css";

export default function AdminReturnLink() {
  const [isAdmin, setIsAdmin] = useState(false);

  useEffect(() => {
    let active = true;
    hrApi.get("/employee/me").then(({ data }) => {
      if (active) setIsAdmin(data.user?.role?.toLowerCase() === "admin");
    }).catch(() => {
      if (active) setIsAdmin(false);
    });
    return () => { active = false; };
  }, []);

  if (!isAdmin) return null;

  return (
    <aside className="admin-return-rail" aria-label="Admin return navigation">
      <Link to="/adminDashboard">
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden="true"><path d="m15 18-6-6 6-6"/></svg>
        <span>Admin workspace</span>
      </Link>
    </aside>
  );
}
