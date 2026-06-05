import { useEffect, useState } from "react";
import { Link, useOutletContext } from "react-router-dom";
import { getAdminBooks, getAdminOrders } from "../services/api";

const statusLabels = {
  pending: "Chờ xác nhận",
  confirmed: "Đã xác nhận",
  shipped: "Đang giao",
  delivered: "Đã giao",
  cancelled: "Đã hủy",
};

const formatCurrency = (value) => {
  const number = Number(value);

  if (!Number.isFinite(number)) {
    return "0 d";
  }

  return new Intl.NumberFormat("vi-VN", {
    style: "currency",
    currency: "VND",
  }).format(number);
};

function AdminDashboardPage() {
  const { user } = useOutletContext();
  const [books, setBooks] = useState([]);
  const [orders, setOrders] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    const controller = new AbortController();
    let isActive = true;

    const loadDashboard = async () => {
      try {
        const [nextBooks, nextOrders] = await Promise.all([
          getAdminBooks({ signal: controller.signal }),
          getAdminOrders({ signal: controller.signal }),
        ]);

        if (isActive) {
          setBooks(nextBooks);
          setOrders(nextOrders);
        }
      } catch (dashboardError) {
        if (dashboardError.name !== "AbortError" && isActive) {
          setError(dashboardError.message || "Không thể tải tổng quan.");
        }
      } finally {
        if (isActive) {
          setLoading(false);
        }
      }
    };

    loadDashboard();

    return () => {
      isActive = false;
      controller.abort();
    };
  }, []);

  const pendingOrders = orders.filter((order) => order.status === "pending").length;
  const deliveredOrders = orders.filter((order) => order.status === "delivered");
  const deliveredRevenue = deliveredOrders.reduce(
    (total, order) => total + Number(order.totalAmount || 0),
    0,
  );
  const recentOrders = orders.slice(0, 5);

  return (
    <section className="admin-page fade-up">
      <div className="admin-page__header">
        <div>
          <p className="eyebrow">TỔNG QUAN</p>
          <h1>Xin chào, {user.name || "Admin"}</h1>
          <p>Quản lý sách, đơn hàng và đánh giá Readora trong một màn hình.</p>
        </div>
        <div className="admin-page__actions">
          <Link className="button button--secondary" to="/admin/orders">
            Xem tất cả
          </Link>
          <Link className="button button--primary" to="/admin/books">
            Thêm sách
          </Link>
        </div>
      </div>

      {loading && <p className="state-message">Đang tải tổng quan...</p>}
      {!loading && error && <p className="state-message state-message--error">{error}</p>}

      {!loading && !error && (
        <>
          <div className="admin-stats">
            <article className="admin-stat">
              <span>Sách</span>
              <strong>{books.length}</strong>
            </article>
            <article className="admin-stat">
              <span>Đơn hàng</span>
              <strong>{orders.length}</strong>
            </article>
            <article className="admin-stat">
              <span>Chờ xử lý</span>
              <strong>{pendingOrders}</strong>
            </article>
            <article className="admin-stat">
              <span>Doanh thu đã giao</span>
              <strong>{formatCurrency(deliveredRevenue)}</strong>
            </article>
          </div>

          <section className="admin-panel">
            <div className="admin-panel__header">
              <div>
                <p className="eyebrow">GẦN ĐÂY</p>
                <h2>Đơn hàng mới</h2>
              </div>
              <Link to="/admin/orders">Xem tất cả</Link>
            </div>

            {recentOrders.length === 0 ? (
              <p className="state-message">Chưa có đơn hàng.</p>
            ) : (
              <div className="admin-table-wrap">
                <table className="admin-table">
                  <thead>
                    <tr>
                      <th>Mã đơn</th>
                      <th>Khách hàng</th>
                      <th>Trạng thái</th>
                      <th>Tổng tiền</th>
                    </tr>
                  </thead>
                  <tbody>
                    {recentOrders.map((order) => (
                      <tr key={order._id}>
                        <td>#{String(order._id).slice(-8).toUpperCase()}</td>
                        <td>{order.user?.name || order.user?.email || "Khách hàng"}</td>
                        <td>
                          <span className={`admin-status admin-status--${order.status}`}>
                            {statusLabels[order.status] || order.status}
                          </span>
                        </td>
                        <td>{formatCurrency(order.totalAmount)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </section>
        </>
      )}
    </section>
  );
}

export default AdminDashboardPage;
