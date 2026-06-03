import { useEffect, useState } from "react";
import { Link, NavLink, useLocation, useNavigate } from "react-router-dom";
import { useTheme } from "../hooks/useTheme";

const navItems = [
  { label: "Trang chủ", path: "/" },
  { label: "Sản phẩm", path: "/books" },
  { label: "Giới thiệu", path: "/about" },
  { label: "Blog", path: "/blog" },
];

const getStoredUser = () => {
  if (typeof window === "undefined") {
    return null;
  }

  const token = window.localStorage.getItem("readora_token");
  const savedUser = window.localStorage.getItem("readora_user");

  if (!token || !savedUser) {
    return null;
  }

  try {
    return JSON.parse(savedUser);
  } catch {
    window.localStorage.removeItem("readora_token");
    window.localStorage.removeItem("readora_user");
    return null;
  }
};

function Header() {
  const navigate = useNavigate();
  const location = useLocation();
  const { theme, toggleTheme } = useTheme();
  const [headerSearch, setHeaderSearch] = useState("");
  const [user, setUser] = useState(getStoredUser);
  const isAccountRoute = ["/login", "/register"].includes(location.pathname);

  useEffect(() => {
    const syncUser = () => {
      setUser(getStoredUser());
    };

    window.addEventListener("storage", syncUser);

    return () => {
      window.removeEventListener("storage", syncUser);
    };
  }, []);

  const handleSearchSubmit = (event) => {
    event.preventDefault();

    const keyword = headerSearch.trim();
    const query = keyword ? `?q=${encodeURIComponent(keyword)}` : "";

    navigate(`/books${query}`);
  };

  const handleLogout = () => {
    localStorage.removeItem("readora_token");
    localStorage.removeItem("readora_user");
    setUser(null);
    navigate("/login");
  };

  return (
    <header className="site-header">
      <div className="container header-content">
        <Link className="brand" to="/" aria-label="Readora trang chủ">
          <span className="brand-mark">R</span>
          <span>Readora</span>
        </Link>

        <nav className="header-nav" aria-label="Điều hướng chính">
          {navItems.map((item) => (
            <NavLink
              key={item.label}
              to={item.path}
              end={item.path === "/"}
              className={({ isActive }) =>
                isActive ? "nav-link nav-link--active" : "nav-link"
              }
            >
              {item.label}
            </NavLink>
          ))}
        </nav>

        <form className="header-search" onSubmit={handleSearchSubmit}>
          <label className="sr-only" htmlFor="header-search">
            Tìm sách
          </label>
          <input
            id="header-search"
            type="search"
            value={headerSearch}
            onChange={(event) => setHeaderSearch(event.target.value)}
            placeholder="Tìm sách, tác giả..."
          />
          <button type="submit">Tìm</button>
        </form>

        <div className="header-actions">
          <NavLink
            className={({ isActive }) =>
              isActive ? "cart-link cart-link--active" : "cart-link"
            }
            to="/cart"
          >
            Giỏ hàng <span className="cart-badge">0</span>
          </NavLink>

          {user ? (
            <div className="account-menu">
              <span className="account-user">{user.name || user.email}</span>
              <button
                className="account-link account-link--button"
                type="button"
                onClick={handleLogout}
              >
                Đăng xuất
              </button>
            </div>
          ) : (
            <Link
              className={
                isAccountRoute
                  ? "account-link account-link--active"
                  : "account-link"
              }
              to="/login"
            >
              Tài khoản
            </Link>
          )}

          <button
            className="theme-toggle"
            type="button"
            onClick={toggleTheme}
            aria-label={
              theme === "dark"
                ? "Chuyển sang giao diện sáng"
                : "Chuyển sang giao diện tối"
            }
            title={
              theme === "dark"
                ? "Chuyển sang giao diện sáng"
                : "Chuyển sang giao diện tối"
            }
          >
            {theme === "dark" ? "☀️" : "🌙"}
          </button>
        </div>
      </div>
    </header>
  );
}

export default Header;
