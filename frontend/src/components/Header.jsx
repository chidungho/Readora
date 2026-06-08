import { useEffect, useMemo, useState } from "react";
import { Link, NavLink, useLocation, useNavigate } from "react-router-dom";
import { useTheme } from "../hooks/useTheme";
import { clearStoredAuth, getStoredAuth } from "../utils/authStorage";
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

const getStoredUser = () => getStoredAuth().user;

function Header() {
  const navigate = useNavigate();
  const location = useLocation();
  const { theme, toggleTheme } = useTheme();
  const [headerSearch, setHeaderSearch] = useState("");
  const [isHeaderSearchDirty, setIsHeaderSearchDirty] = useState(false);
  const [user, setUser] = useState(getStoredUser);
  const [cartCount, setCartCount] = useState(getCartCount);
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);
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
  const displayCartCount = cartCount > 99 ? "99+" : cartCount;
  const closeMobileMenu = () => setIsMobileMenuOpen(false);

  useEffect(() => {
    if (!isMobileMenuOpen) {
      return undefined;
    }

    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";

    return () => {
      document.body.style.overflow = previousOverflow;
    };
  }, [isMobileMenuOpen]);

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

  useEffect(() => {
    if (!isMobileMenuOpen) {
      return undefined;
    }

    const handleKeyDown = (event) => {
      if (event.key === "Escape") {
        closeMobileMenu();
      }
    };

    window.addEventListener("keydown", handleKeyDown);

    return () => {
      window.removeEventListener("keydown", handleKeyDown);
    };
  }, [isMobileMenuOpen]);

  const handleSearchSubmit = (event) => {
    event.preventDefault();
    const keyword = headerSearchValue.trim();

    const searchQuery = buildBooksQueryParams(new URLSearchParams(), {
      search: keyword,
    }).toString();

    setHeaderSearch(keyword);
    setIsHeaderSearchDirty(false);
    closeMobileMenu();
    navigate({
      pathname: "/books",
      search: searchQuery ? `?${searchQuery}` : "",
    });
  };

  const handleLogout = () => {
    clearStoredAuth();
    setUser(null);
    closeMobileMenu();
    navigate("/login");
  };

  const cartBadge = (
    <span className="cart-badge" aria-label={`${cartCount} sản phẩm trong giỏ`}>
      {displayCartCount}
    </span>
  );

  return (
    <header className="site-header">
      <div className="container header-content">
        <Link className="brand" to="/" aria-label="Readora trang chủ">
          <span className="brand-mark">R</span>
          <span>Readora</span>
        </Link>

        <div className="mobile-header-actions">
          <NavLink
            className={({ isActive }) =>
              isActive
                ? "mobile-cart-button mobile-cart-button--active"
                : "mobile-cart-button"
            }
            to="/cart"
            aria-label={`Giỏ hàng, ${cartCount} sản phẩm`}
          >
            <span aria-hidden="true">Giỏ</span>
            {cartBadge}
          </NavLink>

          <button
            className="mobile-menu-toggle"
            type="button"
            aria-expanded={isMobileMenuOpen}
            aria-controls="header-menu"
            onClick={() => setIsMobileMenuOpen((isOpen) => !isOpen)}
          >
            <span aria-hidden="true">Menu</span>
            <span className="sr-only">Mở menu</span>
          </button>
        </div>

        <button
          className={
            isMobileMenuOpen
              ? "mobile-menu-backdrop mobile-menu-backdrop--open"
              : "mobile-menu-backdrop"
          }
          type="button"
          aria-label="Đóng menu"
          onClick={closeMobileMenu}
        />

        <div
          id="header-menu"
          className={isMobileMenuOpen ? "header-menu header-menu--open" : "header-menu"}
        >
          <div className="mobile-menu-header">
            <Link
              className="brand"
              to="/"
              aria-label="Readora trang chủ"
              onClick={closeMobileMenu}
            >
              <span className="brand-mark">R</span>
              <span>Readora</span>
            </Link>
            <button className="mobile-menu-close" type="button" onClick={closeMobileMenu}>
              Đóng
            </button>
          </div>

          <nav className="header-nav" aria-label="Điều hướng chính">
            {navItems.map((item) => (
              <NavLink
                key={item.label}
                to={item.path}
                end={item.path === "/"}
                className={({ isActive }) =>
                  isActive ? "nav-link nav-link--active" : "nav-link"
                }
                onClick={closeMobileMenu}
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
              onClick={closeMobileMenu}
            >
              Giỏ hàng {cartBadge}
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
                  onClick={closeMobileMenu}
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
                    onClick={closeMobileMenu}
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
                onClick={closeMobileMenu}
              >
                Đăng nhập
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
      </div>
    </header>
  );
}

export default Header;
