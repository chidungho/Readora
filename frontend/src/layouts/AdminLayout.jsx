import { useEffect, useState } from "react";
import { Link, NavLink, Navigate, Outlet } from "react-router-dom";
import { getProfile } from "../services/api";
import { socket } from "../services/socket";

const adminNavItems = [
  { label: "Dashboard", path: "/admin", end: true },
  { label: "Books", path: "/admin/books" },
  { label: "Orders", path: "/admin/orders" },
];

const notificationStorageKey = "readora_admin_notifications";
const maxStoredNotifications = 20;

const readStoredNotifications = () => {
  try {
    const stored = window.localStorage.getItem(notificationStorageKey);
    const parsed = stored ? JSON.parse(stored) : [];

    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
};

const saveStoredNotifications = (notifications) => {
  try {
    window.localStorage.setItem(
      notificationStorageKey,
      JSON.stringify(notifications),
    );
  } catch {
    // Local storage is best-effort for this phase.
  }
};

const normalizeNotification = (payload = {}) => {
  const receivedAt = new Date().toISOString();

  return {
    id: `${Date.now()}-${Math.random().toString(36).slice(2)}`,
    type: payload.type || "review",
    message: payload.message || "Có đánh giá mới",
    bookTitle: payload.bookTitle || "Sách chưa rõ",
    userName: payload.userName || "Người dùng",
    rating: Number(payload.rating) || 0,
    comment: payload.comment || "",
    orderId: payload.orderId || "",
    orderCode: payload.orderCode || "",
    createdAt: payload.createdAt || receivedAt,
    receivedAt,
  };
};

const formatNotificationTime = (value) => {
  const date = new Date(value);

  if (Number.isNaN(date.getTime())) {
    return "Vừa xong";
  }

  return new Intl.DateTimeFormat("vi-VN", {
    dateStyle: "medium",
    timeStyle: "short",
  }).format(date);
};

function AdminLayout() {
  const [user, setUser] = useState(null);
  const [isChecking, setIsChecking] = useState(true);
  const [notifications, setNotifications] = useState(readStoredNotifications);
  const [toastNotification, setToastNotification] = useState(null);
  const [isNotificationsOpen, setIsNotificationsOpen] = useState(false);

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

  useEffect(() => {
    if (!user || user.role !== "admin") {
      return undefined;
    }

    const handleNewReview = (payload) => {
      console.log("received admin:new-review", payload);

      const nextNotification = normalizeNotification(payload);

      setNotifications((currentNotifications) => {
        const nextNotifications = [
          nextNotification,
          ...currentNotifications,
        ].slice(0, maxStoredNotifications);

        saveStoredNotifications(nextNotifications);

        return nextNotifications;
      });
      setToastNotification(nextNotification);
    };

    socket.connect();
    socket.on("admin:new-review", handleNewReview);

    return () => {
      socket.off("admin:new-review", handleNewReview);
      socket.disconnect();
    };
  }, [user]);

  useEffect(() => {
    if (!toastNotification) {
      return undefined;
    }

    const timerId = window.setTimeout(() => {
      setToastNotification(null);
    }, 4200);

    return () => {
      window.clearTimeout(timerId);
    };
  }, [toastNotification]);

  const handleClearNotifications = () => {
    setNotifications([]);
    saveStoredNotifications([]);
    setIsNotificationsOpen(false);
  };

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

  const notificationCount = notifications.length;

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
          <div className="admin-topbar__actions">
            <span className="admin-topbar__email">{user.email}</span>

            <div className="admin-notifications">
              <button
                className="admin-notifications__button"
                type="button"
                aria-expanded={isNotificationsOpen}
                aria-label={`Thông báo admin: ${notificationCount} thông báo`}
                onClick={() => setIsNotificationsOpen((isOpen) => !isOpen)}
              >
                <span className="admin-notifications__icon" aria-hidden="true">
                  !
                </span>
                <span>Thông báo</span>
                {notificationCount > 0 && (
                  <span className="admin-notifications__badge">
                    {notificationCount}
                  </span>
                )}
              </button>

              {isNotificationsOpen && (
                <div
                  className="admin-notifications__panel"
                  role="dialog"
                  aria-label="Thông báo admin"
                >
                  <div className="admin-notifications__panel-header">
                    <strong>Thông báo</strong>
                    {notificationCount > 0 && (
                      <button type="button" onClick={handleClearNotifications}>
                        Xóa
                      </button>
                    )}
                  </div>

                  {notificationCount === 0 ? (
                    <p className="admin-notifications__empty">
                      Chưa có thông báo
                    </p>
                  ) : (
                    <ul className="admin-notifications__list">
                      {notifications.map((notification) => (
                        <li
                          className="admin-notifications__item"
                          key={notification.id}
                        >
                          <div>
                            <strong>{notification.message}</strong>
                            <span>
                              {formatNotificationTime(notification.createdAt)}
                            </span>
                          </div>
                          <p>
                            {notification.userName} đánh giá {notification.rating}/5 cho{" "}
                            {notification.bookTitle}
                          </p>
                          {notification.comment && (
                            <small>{notification.comment}</small>
                          )}
                        </li>
                      ))}
                    </ul>
                  )}
                </div>
              )}
            </div>
          </div>

          {toastNotification && (
            <div
              className="admin-notification-toast"
              role="status"
              aria-live="polite"
            >
              <strong>{toastNotification.message}</strong>
              <span>
                {toastNotification.userName} đánh giá {toastNotification.rating}/5 cho{" "}
                {toastNotification.bookTitle}
              </span>
            </div>
          )}
        </div>

        <Outlet context={{ user }} />
      </main>
    </div>
  );
}

export default AdminLayout;
