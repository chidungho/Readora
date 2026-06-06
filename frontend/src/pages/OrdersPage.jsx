import { useEffect, useState } from "react";
import { Link, useLocation } from "react-router-dom";
import Layout from "../layouts/Layout";
import { FALLBACK_COVER_IMAGE, cancelOrder, getMyOrders } from "../services/api";
import OrderItemReview from "../components/OrderItemReview";
import { socket } from "../services/socket";

const statusLabels = {
  pending: "Chờ xác nhận",
  confirmed: "Đã xác nhận",
  shipped: "Đang giao",
  delivered: "Đã giao",
  cancelled: "Đã hủy",
};

const cancellableStatuses = ["pending", "confirmed"];

const paymentMethodLabels = {
  cod: "COD",
  bank_transfer: "Chuyển khoản",
};

const paymentStatusLabels = {
  unpaid: "Chưa thanh toán",
  paid: "Đã thanh toán",
};

const canCancelOrder = (status) => cancellableStatuses.includes(status);

const formatCurrency = (value) => {
  const price = Number(value);

  if (!Number.isFinite(price)) {
    return "Đang cập nhật";
  }

  return new Intl.NumberFormat("vi-VN", {
    style: "currency",
    currency: "VND",
  }).format(price);
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

function OrdersPage() {
  const location = useLocation();
  const [orders, setOrders] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [feedbackMessage, setFeedbackMessage] = useState(
    location.state?.checkoutMessage || "",
  );
  const [cancelError, setCancelError] = useState("");
  const [cancellingOrderId, setCancellingOrderId] = useState("");

  useEffect(() => {
    if (loading || error || orders.length === 0) {
      return undefined;
    }

    let userId;

    try {
      const savedUser = window.localStorage.getItem("readora_user");
      const currentUser = savedUser ? JSON.parse(savedUser) : null;
      userId = currentUser?._id || currentUser?.id || "";
    } catch {
      userId = undefined;
    }

    const handleOrderUpdated = (payload) => {

      const updatedOrder = payload.order || payload;

      if (!updatedOrder?._id || !orders.some((order) => order._id === updatedOrder._id)) {
        return;
      }

      const statusLabel = statusLabels[updatedOrder.status] || updatedOrder.status;

      setOrders((previousOrders) =>
        previousOrders.map((order) => (order._id === updatedOrder._id ? updatedOrder : order)),
      );
      setFeedbackMessage(
        `\u0110\u01a1n #${updatedOrder.orderCode} \u0111\u00e3 c\u1eadp nh\u1eadt tr\u1ea1ng th\u00e1i: ${statusLabel}`,
      );
    };

    socket.connect();

    if (userId) {
      socket.emit("user:join", { userId });
    }

    socket.on("user:order-updated", handleOrderUpdated);

    return () => {
      socket.off("user:order-updated", handleOrderUpdated);
    };
  }, [error, loading, orders]);

  useEffect(() => {
    const controller = new AbortController();
    let isActive = true;

    const loadOrders = async () => {
      setLoading(true);
      setError("");

      try {
        const nextOrders = await getMyOrders({
          signal: controller.signal,
        });

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

    loadOrders();

    return () => {
      isActive = false;
      controller.abort();
    };
  }, []);

  const handleCancelOrder = async (order) => {
    const confirmed = window.confirm("Bạn chắc chắn muốn hủy đơn hàng này?");

    if (!confirmed) {
      return;
    }

    setCancellingOrderId(order._id);
    setCancelError("");
    setFeedbackMessage("");

    try {
      await cancelOrder(order._id);
      const nextOrders = await getMyOrders();

      setOrders(nextOrders);
      setFeedbackMessage("Đã hủy đơn hàng");
    } catch (cancelOrderError) {
      setCancelError(cancelOrderError.message || "Không thể hủy đơn hàng.");
    } finally {
      setCancellingOrderId("");
    }
  };

  return (
    <Layout>
      <section className="page-section orders-page">
        <div className="container">
          <div className="page-header orders-page__header">
            <p className="eyebrow">Đơn hàng</p>
            <h1>Lịch sử đơn hàng</h1>
            <p>Theo dõi đơn hàng và trạng thái thanh toán của bạn.</p>
          </div>

          {feedbackMessage && (
            <p className="cart-feedback" role="status" aria-live="polite">
              {feedbackMessage}
            </p>
          )}

          {cancelError && (
            <p className="state-message state-message--error" role="alert">
              {cancelError}
            </p>
          )}

          {loading && <p className="state-message">Đang tải đơn hàng...</p>}

          {!loading && error && (
            <div className="empty-state">
              <p className="eyebrow">Cần đăng nhập</p>
              <h1>Không tải được đơn hàng</h1>
              <p>{error}</p>
              <Link className="button button--primary" to="/login">
                Đăng nhập
              </Link>
            </div>
          )}

          {!loading && !error && orders.length === 0 && (
            <div className="empty-state">
              <p className="eyebrow">Chưa có đơn</p>
              <h1>Bạn chưa đặt đơn hàng nào</h1>
              <p>Hãy chọn vài cuốn sách yêu thích rồi quay lại đây để xem lịch sử.</p>
              <Link className="button button--primary" to="/books">
                Mua sách
              </Link>
            </div>
          )}

          {!loading && !error && orders.length > 0 && (
            <div className="orders-list" aria-label="Danh sách đơn hàng">
              {orders.map((order) => (
                <article className="order-card" key={order._id}>
                  <div className="order-card__header">
                    <div>
                      <p className="eyebrow">Mã đơn</p>
                      <h2>#{order.orderCode || String(order._id).slice(-8).toUpperCase()}</h2>
                      <span>{formatDate(order.createdAt)}</span>
                    </div>
                    <div className="order-card__status">
                      <strong
                        className={`order-card__status-badge order-card__status-badge--${order.status}`}
                      >
                        {statusLabels[order.status] || order.status}
                      </strong>
                      <span>{paymentMethodLabels[order.paymentMethod] || order.paymentMethod}</span>
                      <span>{paymentStatusLabels[order.paymentStatus] || "Chưa thanh toán"}</span>
                    </div>
                  </div>

                  <div className="order-card__items">
                    {(order.items || []).map((item) => (
                      <div className="order-card__item" key={`${order._id}-${item.book}`}>
                        <img
                          src={item.coverImage || FALLBACK_COVER_IMAGE}
                          alt={`Bìa sách ${item.title}`}
                          onError={(event) => {
                            event.currentTarget.onerror = null;
                            event.currentTarget.src = FALLBACK_COVER_IMAGE;
                          }}
                        />
                        <div className="order-card__item-info">
                          <strong>{item.title}</strong>
                          <span>
                            {item.quantity} x {formatCurrency(item.price)}
                          </span>
                        </div>
                        {order.status === "delivered" && (
                          <div className="order-card__item-review">
                            <OrderItemReview
                              bookId={typeof item.book === "string" ? item.book : item.book?._id}
                              orderId={order._id}
                              orderStatus={order.status}
                            />
                          </div>
                        )}
                      </div>
                    ))}
                  </div>

                  <div className="order-card__footer">
                    <div>
                      <span>Người nhận</span>
                      <strong>{order.shippingAddress?.fullName}</strong>
                      <p>
                        {order.shippingAddress?.phone} · {order.shippingAddress?.address},{" "}
                        {order.shippingAddress?.city}
                      </p>
                    </div>
                    <div className="order-card__total">
                      <span>Tổng tiền</span>
                      <strong>{formatCurrency(order.totalAmount)}</strong>
                      {canCancelOrder(order.status) && (
                        <button
                          className="button button--danger order-card__cancel"
                          disabled={cancellingOrderId === order._id}
                          type="button"
                          onClick={() => handleCancelOrder(order)}
                        >
                          {cancellingOrderId === order._id ? "Đang hủy..." : "Hủy đơn"}
                        </button>
                      )}
                    </div>
                  </div>
                </article>
              ))}
            </div>
          )}
        </div>
      </section>
    </Layout>
  );
}

export default OrdersPage;


