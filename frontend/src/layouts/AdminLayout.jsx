import { useEffect, useState } from "react";
import { Link, NavLink, Navigate, Outlet } from "react-router-dom";
import { getProfile } from "../services/api";

const adminNavItems = [
  { label: "Dashboard", path: "/admin", end: true },
  { label: "Books", path: "/admin/books" },
  { label: "Orders", path: "/admin/orders" },
];

function AdminLayout() {
  const [user, setUser] = useState(null);
  const [isChecking, setIsChecking] = useState(true);

  useEffect(() => {
    let isActive = true;

    const checkAdmin = async () => {
      const token = localStorage.getItem("readora_token");

      if (!token) {
        setIsChecking(false);
        return;
      }

      try {
        const profile = await getProfile();
        const currentUser = profile.user || profile;

        if (currentUser?.role === "admin") {
          localStorage.setItem("readora_user", JSON.stringify(currentUser));

          if (isActive) {
            setUser(currentUser);
          }
        }
      } catch {
        localStorage.removeItem("readora_token");
        localStorage.removeItem("readora_user");
      } finally {
        if (isActive) {
          setIsChecking(false);
        }
      }
    };

    checkAdmin();

    return () => {
      isActive = false;
    };
  }, []);

  if (isChecking) {
    return (
      <div className="admin-shell admin-shell--checking">
        <p className="state-message">Dang kiem tra quyen admin...</p>
      </div>
    );
  }

  if (!user) {
    return <Navigate to="/" replace />;
  }

  return (
    <div className="admin-shell">
      <aside className="admin-sidebar">
        <Link className="admin-brand" to="/admin">
          <span className="brand-mark">R</span>
          <span>Readora Admin</span>
        </Link>

        <nav className="admin-nav" aria-label="Admin navigation">
          {adminNavItems.map((item) => (
            <NavLink
              key={item.path}
              to={item.path}
              end={item.end}
              className={({ isActive }) =>
                isActive ? "admin-nav__link admin-nav__link--active" : "admin-nav__link"
              }
            >
              {item.label}
            </NavLink>
          ))}
        </nav>

        <Link className="admin-store-link" to="/">
          Ve cua hang
        </Link>
      </aside>

      <main className="admin-main">
        <div className="admin-topbar">
          <div>
            <p className="eyebrow">Admin</p>
            <strong>{user.name || user.email}</strong>
          </div>
          <span>{user.email}</span>
        </div>

        <Outlet context={{ user }} />
      </main>
    </div>
  );
}

export default AdminLayout;
