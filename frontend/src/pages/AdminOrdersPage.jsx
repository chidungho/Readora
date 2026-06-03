import { useEffect, useState } from "react";
import { getAdminOrders, updateAdminOrderStatus } from "../services/api";

const orderStatuses = [
  { value: "pending", label: "Cho xac nhan" },
  { value: "confirmed", label: "Da xac nhan" },
  { value: "shipped", label: "Dang giao" },
  { value: "delivered", label: "Da giao" },
  { value: "cancelled", label: "Da huy" },
];

const statusLabels = orderStatuses.reduce((labels, status) => {
  labels[status.value] = status.label;
  return labels;
}, {});

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

const formatDate = (value) => {
  if (!value) {
    return "Dang cap nhat";
  }

  const date = new Date(value);

  if (Number.isNaN(date.getTime())) {
    return "Dang cap nhat";
  }

  return new Intl.DateTimeFormat("vi-VN", {
    dateStyle: "medium",
    timeStyle: "short",
  }).format(date);
};

function AdminOrdersPage() {
  const [orders, setOrders] = useState([]);
  const [loading, setLoading] = useState(true);
  const [changingOrderId, setChangingOrderId] = useState("");
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");

  const loadOrders = async (options = {}) => {
    const nextOrders = await getAdminOrders(options);
    setOrders(nextOrders);
  };

  useEffect(() => {
    const controller = new AbortController();
    let isActive = true;

    const loadInitialOrders = async () => {
      try {
        const nextOrders = await getAdminOrders({ signal: controller.signal });

        if (isActive) {
          setOrders(nextOrders);
        }
      } catch (ordersError) {
        if (ordersError.name !== "AbortError" && isActive) {
          setError(ordersError.message || "Khong the tai don hang.");
        }
      } finally {
        if (isActive) {
          setLoading(false);
        }
      }
    };

    loadInitialOrders();

    return () => {
      isActive = false;
      controller.abort();
    };
  }, []);

  const handleStatusChange = async (order, nextStatus) => {
    setChangingOrderId(order._id);
    setMessage("");
    setError("");

    try {
      await updateAdminOrderStatus(order._id, nextStatus);
      await loadOrders();
      setMessage("Da cap nhat trang thai don hang.");
    } catch (statusError) {
      setError(statusError.message || "Khong the doi trang thai don hang.");
    } finally {
      setChangingOrderId("");
    }
  };

  return (
    <section className="admin-page fade-up">
      <div className="admin-page__header">
        <div>
          <p className="eyebrow">Orders</p>
          <h1>Quan ly don hang</h1>
          <p>Xem tat ca don hang va doi trang thai xu ly.</p>
        </div>
      </div>

      {message && <p className="cart-feedback">{message}</p>}
      {error && <p className="state-message state-message--error">{error}</p>}
      {loading && <p className="state-message">Dang tai don hang...</p>}

      {!loading && !error && orders.length === 0 && (
        <p className="state-message">Chua co don hang nao.</p>
      )}

      {!loading && !error && orders.length > 0 && (
        <section className="admin-panel">
          <div className="admin-panel__header">
            <div>
              <p className="eyebrow">Danh sach</p>
              <h2>{orders.length} don hang</h2>
            </div>
          </div>

          <div className="admin-table-wrap">
            <table className="admin-table admin-table--orders">
              <thead>
                <tr>
                  <th>Ma don</th>
                  <th>Khach hang</th>
                  <th>San pham</th>
                  <th>Ngay dat</th>
                  <th>Tong tien</th>
                  <th>Trang thai</th>
                </tr>
              </thead>
              <tbody>
                {orders.map((order) => (
                  <tr key={order._id}>
                    <td>#{String(order._id).slice(-8).toUpperCase()}</td>
                    <td>
                      <strong>{order.user?.name || "Khach hang"}</strong>
                      <span>{order.user?.email || order.shippingAddress?.phone || ""}</span>
                    </td>
                    <td>{(order.items || []).length} sach</td>
                    <td>{formatDate(order.createdAt)}</td>
                    <td>{formatCurrency(order.totalAmount)}</td>
                    <td>
                      <label className="admin-status-control">
                        <span className={`admin-status admin-status--${order.status}`}>
                          {statusLabels[order.status] || order.status}
                        </span>
                        <select
                          value={order.status}
                          disabled={changingOrderId === order._id}
                          onChange={(event) => handleStatusChange(order, event.target.value)}
                        >
                          {orderStatuses.map((status) => (
                            <option key={status.value} value={status.value}>
                              {status.label}
                            </option>
                          ))}
                        </select>
                      </label>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>
      )}
    </section>
  );
}

export default AdminOrdersPage;
