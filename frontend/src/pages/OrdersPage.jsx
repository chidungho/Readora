import { useEffect, useState } from "react";
import { Link, useLocation } from "react-router-dom";
import Layout from "../layouts/Layout";
import { FALLBACK_COVER_IMAGE, cancelOrder, getMyOrders } from "../services/api";
import OrderItemReview from "../components/OrderItemReview";

const statusLabels = {
  pending: "Chá» xÃ¡c nháº­n",
  confirmed: "ÄÃ£ xÃ¡c nháº­n",
  shipped: "Äang giao",
  delivered: "ÄÃ£ giao",
  cancelled: "ÄÃ£ há»§y",
};

const cancellableStatuses = ["pending", "confirmed"];

const canCancelOrder = (status) => cancellableStatuses.includes(status);

const formatCurrency = (value) => {
  const price = Number(value);

  if (!Number.isFinite(price)) {
    return "Äang cáº­p nháº­t";
  }

  return new Intl.NumberFormat("vi-VN", {
    style: "currency",
    currency: "VND",
  }).format(price);
};

const formatDate = (value) => {
  if (!value) {
    return "Äang cáº­p nháº­t";
  }

  const date = new Date(value);

  if (Number.isNaN(date.getTime())) {
    return "Äang cáº­p nháº­t";
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
          setError(ordersError.message || "KhÃ´ng thá»ƒ táº£i Ä‘Æ¡n hÃ ng.");
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
    const confirmed = window.confirm("Báº¡n cháº¯c cháº¯n muá»‘n há»§y Ä‘Æ¡n hÃ ng nÃ y?");

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
      setFeedbackMessage("ÄÃ£ há»§y Ä‘Æ¡n hÃ ng");
    } catch (cancelOrderError) {
      setCancelError(cancelOrderError.message || "KhÃ´ng thá»ƒ há»§y Ä‘Æ¡n hÃ ng.");
    } finally {
      setCancellingOrderId("");
    }
  };

  return (
    <Layout>
      <section className="page-section orders-page">
        <div className="container">
          <div className="page-header orders-page__header">
            <p className="eyebrow">ÄÆ¡n hÃ ng</p>
            <h1>Lá»‹ch sá»­ Ä‘Æ¡n hÃ ng</h1>
            <p>Theo dÃµi cÃ¡c Ä‘Æ¡n COD Ä‘Ã£ Ä‘áº·t báº±ng tÃ i khoáº£n Readora cá»§a báº¡n.</p>
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

          {loading && <p className="state-message">Äang táº£i Ä‘Æ¡n hÃ ng...</p>}

          {!loading && error && (
            <div className="empty-state">
              <p className="eyebrow">Cáº§n Ä‘Äƒng nháº­p</p>
              <h1>KhÃ´ng táº£i Ä‘Æ°á»£c Ä‘Æ¡n hÃ ng</h1>
              <p>{error}</p>
              <Link className="button button--primary" to="/login">
                ÄÄƒng nháº­p
              </Link>
            </div>
          )}

          {!loading && !error && orders.length === 0 && (
            <div className="empty-state">
              <p className="eyebrow">ChÆ°a cÃ³ Ä‘Æ¡n</p>
              <h1>Báº¡n chÆ°a Ä‘áº·t Ä‘Æ¡n hÃ ng nÃ o</h1>
              <p>HÃ£y chá»n vÃ i cuá»‘n sÃ¡ch yÃªu thÃ­ch rá»“i quay láº¡i Ä‘Ã¢y Ä‘á»ƒ xem lá»‹ch sá»­.</p>
              <Link className="button button--primary" to="/books">
                Mua sÃ¡ch
              </Link>
            </div>
          )}

          {!loading && !error && orders.length > 0 && (
            <div className="orders-list" aria-label="Danh sÃ¡ch Ä‘Æ¡n hÃ ng">
              {orders.map((order) => (
                <article className="order-card" key={order._id}>
                  <div className="order-card__header">
                    <div>
                      <p className="eyebrow">MÃ£ Ä‘Æ¡n</p>
                      <h2>#{String(order._id).slice(-8).toUpperCase()}</h2>
                      <span>{formatDate(order.createdAt)}</span>
                    </div>
                    <div className="order-card__status">
                      <strong
                        className={`order-card__status-badge order-card__status-badge--${order.status}`}
                      >
                        {statusLabels[order.status] || order.status}
                      </strong>
                      <span>{order.paymentMethod === "cod" ? "COD" : order.paymentMethod}</span>
                    </div>
                  </div>

                  <div className="order-card__items">
                    {(order.items || []).map((item) => (
                      <div className="order-card__item" key={`${order._id}-${item.book}`}>
                        <img
                          src={item.coverImage || FALLBACK_COVER_IMAGE}
                          alt={`BÃ¬a sÃ¡ch ${item.title}`}
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
                        <div className="order-card__item-review">
                          <OrderItemReview
                            bookId={typeof item.book === "string" ? item.book : item.book?._id}
                            orderStatus={order.status}
                          />
                        </div>
                      </div>
                    ))}
                  </div>

                  <div className="order-card__footer">
                    <div>
                      <span>NgÆ°á»i nháº­n</span>
                      <strong>{order.shippingAddress?.fullName}</strong>
                      <p>
                        {order.shippingAddress?.phone} Â· {order.shippingAddress?.address},{" "}
                        {order.shippingAddress?.city}
                      </p>
                    </div>
                    <div className="order-card__total">
                      <span>Tá»•ng tiá»n</span>
                      <strong>{formatCurrency(order.totalAmount)}</strong>
                      {canCancelOrder(order.status) && (
                        <button
                          className="button button--danger order-card__cancel"
                          disabled={cancellingOrderId === order._id}
                          type="button"
                          onClick={() => handleCancelOrder(order)}
                        >
                          {cancellingOrderId === order._id ? "Äang há»§y..." : "Há»§y Ä‘Æ¡n"}
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


