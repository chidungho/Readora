import { useEffect, useMemo, useState } from "react";
import { Link, NavLink, useLocation, useNavigate } from "react-router-dom";
import { useTheme } from "../hooks/useTheme";
import {
  CART_STORAGE_KEY,
  CART_UPDATED_EVENT,
  getCartCount,
} from "../services/cartService";
import {
  buildBooksQueryParams,
  parseBooksQuery,
} from "../utils/booksQuery";

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
  const [isHeaderSearchDirty, setIsHeaderSearchDirty] = useState(false);
  const [user, setUser] = useState(getStoredUser);
  const [cartCount, setCartCount] = useState(getCartCount);
  const isAccountRoute = ["/login", "/register"].includes(location.pathname);
  const routeSearch = useMemo(() => {
    if (location.pathname !== "/books") {
      return "";
    }

    return parseBooksQuery(new URLSearchParams(location.search)).search;
  }, [location.pathname, location.search]);
  const headerSearchValue =
    location.pathname === "/books" && !isHeaderSearchDirty
      ? routeSearch
      : headerSearch;

  useEffect(() => {
    const syncUser = () => {
      setUser(getStoredUser());
    };

    const syncCart = () => {
      setCartCount(getCartCount());
    };

    const syncStorage = (event) => {
      syncUser();

      if (!event.key || event.key === CART_STORAGE_KEY) {
        syncCart();
      }
    };

    window.addEventListener("storage", syncStorage);
    window.addEventListener(CART_UPDATED_EVENT, syncCart);

    return () => {
      window.removeEventListener("storage", syncStorage);
      window.removeEventListener(CART_UPDATED_EVENT, syncCart);
    };
  }, []);

  const handleSearchSubmit = (event) => {
    event.preventDefault();
    const keyword = headerSearchValue.trim();

    const searchQuery = buildBooksQueryParams(new URLSearchParams(), {
      search: keyword,
    }).toString();

    setHeaderSearch(keyword);
    setIsHeaderSearchDirty(false);
    navigate({
      pathname: "/books",
      search: searchQuery ? `?${searchQuery}` : "",
    });
  };

  const handleLogout = () => {
    localStorage.removeItem("readora_token");
    localStorage.removeItem("readora_user");
    setUser(null);
    navigate("/login");
  };

  const displayCartCount = cartCount > 99 ? "99+" : cartCount;

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
            value={headerSearchValue}
            onChange={(event) => {
              setIsHeaderSearchDirty(true);
              setHeaderSearch(event.target.value);
            }}
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
            Giỏ hàng{" "}
            <span
              className="cart-badge"
              aria-label={`${cartCount} sản phẩm trong giỏ`}
            >
              {displayCartCount}
            </span>
          </NavLink>

          {user ? (
            <div className="account-menu">
              <span className="account-user">{user.name || user.email}</span>
              <Link
                className={
                  location.pathname === "/orders"
                    ? "account-link account-link--active"
                    : "account-link"
                }
                to="/orders"
              >
                Đơn hàng
              </Link>
              {user.role === "admin" && (
                <Link
                  className={
                    location.pathname.startsWith("/admin")
                      ? "account-link account-link--active"
                      : "account-link"
                  }
                  to="/admin"
                >
                  Admin
                </Link>
              )}
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
