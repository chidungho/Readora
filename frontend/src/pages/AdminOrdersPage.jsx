import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { getAdminOrders, updateAdminOrderStatus } from "../services/api";
import { socket } from "../services/socket";

const orderStatuses = [
  { value: "pending", label: "Chờ xác nhận" },
  { value: "confirmed", label: "Đã xác nhận" },
  { value: "shipped", label: "Đang giao" },
  { value: "delivered", label: "Đã giao" },
  { value: "cancelled", label: "Đã hủy" },
];

const paymentStatusOptions = [
  { value: "unpaid", label: "Chưa thanh toán" },
  { value: "paid", label: "Đã thanh toán" },
];

const paymentMethodLabels = {
  cod: "COD",
  bank_transfer: "Chuyển khoản",
};

const paymentStatusLabels = paymentStatusOptions.reduce((labels, status) => {
  labels[status.value] = status.label;
  return labels;
}, {});

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
    return "Đang cập nhật";
  }

  const date = new Date(value);

  if (Number.isNaN(date.getTime())) {
    return "Đang cập nhật";
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
    const handleNewOrder = (payload = {}) => {
      const newOrder = payload.order || payload;
      if (!newOrder?._id) return;

      setOrders((prev) =>
        prev.some((order) => order._id === newOrder._id) ? prev : [newOrder, ...prev],
      );
    };

    socket.connect();
    socket.on("admin:new-order", handleNewOrder);

    return () => {
      socket.off("admin:new-order", handleNewOrder);
    };
  }, []);

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
          setError(ordersError.message || "Không thể tải đơn hàng.");
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

  const handleOrderUpdate = async (order, payload) => {
    setChangingOrderId(order._id);
    setMessage("");
    setError("");

    try {
      await updateAdminOrderStatus(order._id, payload);
      await loadOrders();
      setMessage("Đã cập nhật trạng thái đơn hàng.");
    } catch (statusError) {
      setError(statusError.message || "Không thể đổi trạng thái đơn hàng.");
    } finally {
      setChangingOrderId("");
    }
  };

  const handleStatusChange = (order, nextStatus) =>
    handleOrderUpdate(order, { status: nextStatus });

  const handlePaymentStatusChange = (order, nextPaymentStatus) =>
    handleOrderUpdate(order, { paymentStatus: nextPaymentStatus });

  return (
    <section className="admin-page fade-up">
      <div className="admin-page__header">
        <div>
          <p className="eyebrow">ĐƠN HÀNG</p>
          <h1>Quản lý đơn hàng</h1>
          <p>Xem tất cả đơn hàng và đổi trạng thái xử lý.</p>
        </div>
      </div>

      {message && <p className="cart-feedback">{message}</p>}
      {error && <p className="state-message state-message--error">{error}</p>}
      {loading && <p className="state-message">Đang tải đơn hàng...</p>}

      {!loading && !error && orders.length === 0 && (
        <p className="state-message">Chưa có đơn hàng nào.</p>
      )}

      {!loading && !error && orders.length > 0 && (
        <section className="admin-panel">
          <div className="admin-panel__header">
            <div>
              <p className="eyebrow">DANH SÁCH</p>
              <h2>{orders.length} đơn hàng</h2>
            </div>
          </div>

          <div className="admin-table-wrap">
            <table className="admin-table admin-table--orders">
              <thead>
                <tr>
                  <th>Mã đơn</th>
                  <th>Khách hàng</th>
                  <th>Sản phẩm</th>
                  <th>Ngày đặt</th>
                  <th>Tổng tiền</th>
                  <th>Thanh toán</th>
                  <th>Trạng thái</th>
                  <th>Chi tiết</th>
                </tr>
              </thead>
              <tbody>
                {orders.map((order) => (
                  <tr key={order._id}>
                    <td>#{order.orderCode || String(order._id).slice(-8).toUpperCase()}</td>
                    <td>
                      <strong>{order.user?.name || "Khách hàng"}</strong>
                      <span>{order.user?.email || order.shippingAddress?.phone || ""}</span>
                    </td>
                    <td>{(order.items || []).length} sách</td>
                    <td>{formatDate(order.createdAt)}</td>
                    <td>{formatCurrency(order.totalAmount)}</td>
                    <td>
                      <label className="admin-status-control">
                        <span className="admin-status admin-status--payment">
                          {paymentMethodLabels[order.paymentMethod] || order.paymentMethod || "COD"}
                        </span>
                        <select
                          value={order.paymentStatus || "unpaid"}
                          disabled={changingOrderId === order._id}
                          onChange={(event) => handlePaymentStatusChange(order, event.target.value)}
                        >
                          {paymentStatusOptions.map((status) => (
                            <option key={status.value} value={status.value}>
                              {status.label}
                            </option>
                          ))}
                        </select>
                        <small>{paymentStatusLabels[order.paymentStatus] || "Chưa thanh toán"}</small>
                      </label>
                    </td>
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
                    <td>
                      <Link className="button button--secondary admin-order-detail-link" to={`/admin/orders/${order._id}`}>
                        Xem chi tiết
                      </Link>
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
