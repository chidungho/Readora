import { useEffect, useState } from "react";
import { Link, useOutletContext } from "react-router-dom";
import { getAdminBooks, getAdminOrders } from "../services/api";

const statusLabels = {
  pending: "Cho xac nhan",
  confirmed: "Da xac nhan",
  shipped: "Dang giao",
  delivered: "Da giao",
  cancelled: "Da huy",
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
          setError(dashboardError.message || "Khong the tai dashboard.");
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
          <p className="eyebrow">Tong quan</p>
          <h1>Xin chao, {user.name || "Admin"}</h1>
          <p>Quan ly sach va don hang Readora tu mot man hinh gon gang.</p>
        </div>
        <div className="admin-page__actions">
          <Link className="button button--secondary" to="/admin/orders">
            Xu ly don
          </Link>
          <Link className="button button--primary" to="/admin/books">
            Them sach
          </Link>
        </div>
      </div>

      {loading && <p className="state-message">Dang tai dashboard...</p>}
      {!loading && error && <p className="state-message state-message--error">{error}</p>}

      {!loading && !error && (
        <>
          <div className="admin-stats">
            <article className="admin-stat">
              <span>Books</span>
              <strong>{books.length}</strong>
            </article>
            <article className="admin-stat">
              <span>Orders</span>
              <strong>{orders.length}</strong>
            </article>
            <article className="admin-stat">
              <span>Pending</span>
              <strong>{pendingOrders}</strong>
            </article>
            <article className="admin-stat">
              <span>Revenue delivered</span>
              <strong>{formatCurrency(deliveredRevenue)}</strong>
            </article>
          </div>

          <section className="admin-panel">
            <div className="admin-panel__header">
              <div>
                <p className="eyebrow">Gan day</p>
                <h2>Don hang moi</h2>
              </div>
              <Link to="/admin/orders">Xem tat ca</Link>
            </div>

            {recentOrders.length === 0 ? (
              <p className="state-message">Chua co don hang.</p>
            ) : (
              <div className="admin-table-wrap">
                <table className="admin-table">
                  <thead>
                    <tr>
                      <th>Ma don</th>
                      <th>Khach hang</th>
                      <th>Trang thai</th>
                      <th>Tong tien</th>
                    </tr>
                  </thead>
                  <tbody>
                    {recentOrders.map((order) => (
                      <tr key={order._id}>
                        <td>#{String(order._id).slice(-8).toUpperCase()}</td>
                        <td>{order.user?.name || order.user?.email || "Khach hang"}</td>
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
