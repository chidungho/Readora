import { useEffect, useMemo, useState } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";
import Layout from "../layouts/Layout";
import {
  FALLBACK_COVER_IMAGE,
  cancelOrder,
  getAdminOrderById,
  getOrderById,
} from "../services/api";
import { connectUserSocket, socket } from "../services/socket";

const statusLabels = {
  pending: "Chờ xác nhận",
  confirmed: "Đã xác nhận",
  shipped: "Đang giao",
  delivered: "Đã giao",
  cancelled: "Đã hủy",
};

const paymentMethodLabels = {
  cod: "COD",
  bank_transfer: "Chuyển khoản",
};

const paymentStatusLabels = {
  unpaid: "Chưa thanh toán",
  paid: "Đã thanh toán",
};

const cancellableStatuses = ["pending", "confirmed"];

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

const getBookId = (book) => (typeof book === "string" ? book : book?._id || book?.id || "book");

const isUnpaidBankTransferOrder = (order) =>
  order?.status !== "cancelled" &&
  order?.paymentMethod === "bank_transfer" &&
  order?.paymentStatus === "unpaid";

const canCancelOrder = (order) => cancellableStatuses.includes(order?.status);

const getTimelineSteps = (order) => {
  const paymentLabel = order?.paymentMethod === "cod" ? "COD" : "Đã thanh toán";
  const currentStatus = order?.status || "pending";
  const statusRank = {
    pending: 0,
    confirmed: 2,
    shipped: 3,
    delivered: 4,
    cancelled: 0,
  };
  const rank = statusRank[currentStatus] ?? 0;
  const paymentDone = order?.paymentMethod === "cod" || order?.paymentStatus === "paid";

  return [
    { key: "created", label: "Đặt hàng", complete: true },
    {
      key: "payment",
      label: paymentDone ? paymentLabel : "Chờ thanh toán",
      complete: paymentDone,
      waiting: isUnpaidBankTransferOrder(order),
    },
    { key: "confirmed", label: "Đã xác nhận", complete: rank >= 2 },
    { key: "shipped", label: "Đang giao", complete: rank >= 3 },
    { key: "delivered", label: "Đã giao/Hoàn thành", complete: rank >= 4 },
  ];
};

function OrderDetailPage({ admin = false }) {
  const { id } = useParams();
  const navigate = useNavigate();
  const [order, setOrder] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [feedbackMessage, setFeedbackMessage] = useState("");
  const [cancelling, setCancelling] = useState(false);

  const timelineSteps = useMemo(() => getTimelineSteps(order), [order]);

  useEffect(() => {
    const controller = new AbortController();
    let isActive = true;

    const loadOrder = async () => {
      setLoading(true);
      setError("");

      try {
        const nextOrder = await (admin ? getAdminOrderById : getOrderById)(id, {
          signal: controller.signal,
        });

        if (isActive) {
          setOrder(nextOrder);
        }
      } catch (orderError) {
        if (orderError.name !== "AbortError" && isActive) {
          setError(orderError.message || "Không thể tải chi tiết đơn hàng.");
        }
      } finally {
        if (isActive) {
          setLoading(false);
        }
      }
    };

    loadOrder();

    return () => {
      isActive = false;
      controller.abort();
    };
  }, [admin, id]);

  const handleCancelOrder = async () => {
    if (!order || !window.confirm("Bạn chắc chắn muốn hủy đơn hàng này?")) {
      return;
    }

    setCancelling(true);
    setFeedbackMessage("");
    setError("");

    try {
      const updatedOrder = await cancelOrder(order._id);
      setOrder(updatedOrder);
      setFeedbackMessage("Đã hủy đơn hàng");
    } catch (cancelError) {
      setError(cancelError.message || "Không thể hủy đơn hàng.");
    } finally {
      setCancelling(false);
    }
  };

  useEffect(() => {
    if (admin || loading || error || !order?._id) {
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

    const handleOrderStatusUpdated = (payload) => {
      const payloadOrder = payload.order || payload;
      const payloadOrderId = String(payload.orderId || payloadOrder?._id || "");

      if (payloadOrderId !== String(order._id)) {
        return;
      }

      const nextOrder = payload.order
        ? payload.order
        : {
            ...order,
            status: payload.status ?? order.status,
            paymentStatus: payload.paymentStatus ?? order.paymentStatus,
            updatedAt: payload.updatedAt ?? order.updatedAt,
          };
      const statusLabel = statusLabels[nextOrder.status] || nextOrder.status;

      setOrder(nextOrder);
      setFeedbackMessage(
        payload.message || `\u0110\u01a1n #${nextOrder.orderCode} \u0111\u00e3 chuy\u1ec3n sang: ${statusLabel}`,
      );
    };

    connectUserSocket();

    if (userId) {
      socket.emit("user:join", { userId });
    }

    socket.on("user:order-status-updated", handleOrderStatusUpdated);
    socket.on("user:order-updated", handleOrderStatusUpdated);

    return () => {
      socket.off("user:order-status-updated", handleOrderStatusUpdated);
      socket.off("user:order-updated", handleOrderStatusUpdated);
    };
  }, [admin, error, loading, order]);

  const content = (
    <section className="page-section orders-page order-detail-page">
      <div className="container">
        <div className="page-header orders-page__header order-detail-page__header">
          <div className="order-detail-page__title">
            <button className="order-detail-page__back-link" type="button" onClick={() => navigate(admin ? "/admin/orders" : "/orders")}>
              {"\u2190 Quay l\u1ea1i \u0111\u01a1n h\u00e0ng"}
            </button>
            <p className="eyebrow">Chi tiết đơn hàng</p>
            <h1>{order ? `#${order.orderCode || String(order._id).slice(-8).toUpperCase()}` : "Đơn hàng"}</h1>
            <p>{order ? `Đặt lúc ${formatDate(order.createdAt)}` : "Theo dõi trạng thái và thông tin giao hàng."}</p>
          </div>
          <div className="order-detail-page__actions" aria-label="Thao tac don hang">
            {order && (
              <span className={`order-card__status-badge order-card__status-badge--${order.status}`}>
                {statusLabels[order.status] || order.status}
              </span>
            )}
          </div>
        </div>

        {feedbackMessage && <p className="cart-feedback" role="status" aria-live="polite">{feedbackMessage}</p>}
        {loading && <p className="state-message">Đang tải chi tiết đơn hàng...</p>}
        {!loading && error && <p className="state-message state-message--error" role="alert">{error}</p>}

        {!loading && !error && order && (
          <article className="order-card order-detail-card">
            <div className="order-card__header order-detail-card__summary">
              <div>
                <p className="eyebrow">Trạng thái đơn</p>
                <strong className={`order-card__status-badge order-card__status-badge--${order.status}`}>
                  {statusLabels[order.status] || order.status}
                </strong>
              </div>
              <div className="order-card__status">
                <span>{paymentMethodLabels[order.paymentMethod] || order.paymentMethod}</span>
                <span>{isUnpaidBankTransferOrder(order) ? "Chờ thanh toán" : paymentStatusLabels[order.paymentStatus] || "Chưa thanh toán"}</span>
              </div>
            </div>

            <div className="order-detail-timeline" aria-label="Tiến trình đơn hàng">
              {timelineSteps.map((step) => (
                <div
                  className={`order-detail-timeline__step${step.complete ? " order-detail-timeline__step--complete" : ""}${step.waiting ? " order-detail-timeline__step--waiting" : ""}`}
                  key={step.key}
                >
                  <span aria-hidden="true" />
                  <strong>{step.label}</strong>
                </div>
              ))}
            </div>

            {isUnpaidBankTransferOrder(order) && (
              <div className="order-detail-alert">
                <strong>Chờ thanh toán</strong>
                <p>Vui lòng hoàn tất chuyển khoản để Readora xử lý đơn hàng của bạn.</p>
                <Link
                  className="button button--primary"
                  to="/checkout"
                  state={{
                    paymentOrder: order,
                    paymentMessage: "Vui lòng chuyển khoản đúng số tiền và nội dung bên dưới.",
                  }}
                >
                  Thanh toán ngay
                </Link>
              </div>
            )}

            <div className="order-card__items">
              {(order.items || []).map((item) => (
                <div className="order-card__item order-detail-card__item" key={`${order._id}-${getBookId(item.book)}`}>
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
                    <span>{item.quantity} x {formatCurrency(item.price)}</span>
                  </div>
                  <strong>{formatCurrency(Number(item.quantity || 0) * Number(item.price || 0))}</strong>
                </div>
              ))}
            </div>

            <div className="order-detail-grid">
              <section>
                <p className="eyebrow">Giao hàng</p>
                <strong>{order.shippingAddress?.fullName || "Người nhận"}</strong>
                <p>{order.shippingAddress?.phone}</p>
                <p>{order.shippingAddress?.address}, {order.shippingAddress?.city}</p>
              </section>
              <section>
                <p className="eyebrow">Thanh toán</p>
                <p>{paymentMethodLabels[order.paymentMethod] || order.paymentMethod}</p>
                <strong>{paymentStatusLabels[order.paymentStatus] || "Chưa thanh toán"}</strong>
              </section>
              <section>
                <p className="eyebrow">Tổng tiền</p>
                <strong className="order-detail-card__total">{formatCurrency(order.totalAmount)}</strong>
                <p>{formatDate(order.createdAt)}</p>
              </section>
            </div>

            {!admin && canCancelOrder(order) && (
              <div className="order-detail-card__actions">
                <button className="button button--danger" disabled={cancelling} type="button" onClick={handleCancelOrder}>
                  {cancelling ? "Đang hủy..." : "Hủy đơn"}
                </button>
              </div>
            )}
          </article>
        )}
      </div>
    </section>
  );

  if (admin) {
    return content;
  }

  return <Layout>{content}</Layout>;
}

export default OrderDetailPage;

