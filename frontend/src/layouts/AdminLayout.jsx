import { useEffect, useState } from "react";
import { Link, NavLink, Navigate, Outlet } from "react-router-dom";
import { getProfile } from "../services/api";
import { socket } from "../services/socket";

const adminNavItems = [
  { label: "Tổng quan", path: "/admin", end: true },
  { label: "Sách", path: "/admin/books" },
  { label: "Đơn hàng", path: "/admin/orders" },
  { label: "Đánh giá", path: "/admin/reviews" },
];

const notificationStorageKey = "readora_admin_notifications_v2";
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
    title: payload.title || "",
    message: payload.message || "Có đánh giá mới",
    detail: payload.detail || "",
    bookTitle: payload.bookTitle || payload.review?.book?.title || "Sách chưa rõ",
    userName: payload.userName || payload.review?.user?.name || payload.order?.user?.name || "Người dùng",
    rating: Number(payload.rating || payload.review?.rating) || 0,
    comment: payload.comment || payload.review?.comment || "",
    orderId: payload.orderId || "",
    orderCode: payload.orderCode || payload.order?.orderCode || "",
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

    const pushNotification = (payload) => {
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

    const handleNewOrder = (payload) => {
      pushNotification(payload);
    };

    const handleNewReview = (payload) => {
      pushNotification(payload);
    };

    socket.connect();
    socket.on("admin:new-order", handleNewOrder);
    socket.on("admin:new-review", handleNewReview);

    return () => {
      socket.off("admin:new-order", handleNewOrder);
      socket.off("admin:new-review", handleNewReview);
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
        <p className="state-message">Đang kiểm tra quyền admin...</p>
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

        <nav className="admin-nav" aria-label="Điều hướng quản trị">
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
          Về cửa hàng
        </Link>
      </aside>

      <main className="admin-main">
        <div className="admin-topbar">
          <div>
            <p className="eyebrow">QUẢN TRỊ</p>
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
