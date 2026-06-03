import { useMemo, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import Layout from "../layouts/Layout";
import {
  SEPAY_ACCOUNT,
  SEPAY_ACCOUNT_NAME,
  SEPAY_BANK,
  createSepayQrUrl,
} from "../config/sepay";
import { FALLBACK_COVER_IMAGE, createOrder, getMyOrders } from "../services/api";
import { clearCart, getCart } from "../services/cartService";

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

const getCartTotal = (items) =>
  items.reduce((total, item) => total + item.price * item.quantity, 0);

function CheckoutPage() {
  const navigate = useNavigate();
  const [cartItems] = useState(getCart);
  const [shippingAddress, setShippingAddress] = useState({
    fullName: "",
    phone: "",
    address: "",
    city: "",
  });
  const [paymentMethod, setPaymentMethod] = useState("cod");
  const [error, setError] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [createdOrder, setCreatedOrder] = useState(null);
  const [statusMessage, setStatusMessage] = useState("");
  const [isCheckingStatus, setIsCheckingStatus] = useState(false);

  const cartTotal = useMemo(() => getCartTotal(cartItems), [cartItems]);
  const cartCount = useMemo(
    () => cartItems.reduce((count, item) => count + item.quantity, 0),
    [cartItems],
  );

  const handleChange = (event) => {
    const { name, value } = event.target;

    setShippingAddress((currentAddress) => ({
      ...currentAddress,
      [name]: value,
    }));
  };

  const handleSubmit = async (event) => {
    event.preventDefault();
    setError("");
    setIsSubmitting(true);

    try {
      const order = await createOrder({
        items: cartItems.map((item) => ({
          book: item.id,
          title: item.title,
          price: item.price,
          quantity: item.quantity,
          coverImage: item.coverImage,
        })),
        shippingAddress,
        paymentMethod,
      });

      clearCart();
      if (order.paymentMethod === "bank_transfer") {
        setCreatedOrder(order);
        setStatusMessage("Vui lòng chuyển khoản đúng số tiền và nội dung bên dưới.");
        return;
      }

      navigate("/orders", {
        state: {
          checkoutMessage: "Đặt hàng thành công. Đơn hàng của bạn đang chờ xác nhận.",
        },
      });
    } catch (orderError) {
      setError(orderError.message || "Không thể tạo đơn hàng.");
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleCheckPaymentStatus = async () => {
    if (!createdOrder) {
      return;
    }

    setIsCheckingStatus(true);
    setStatusMessage("");

    try {
      const orders = await getMyOrders();
      const latestOrder = orders.find((order) => order._id === createdOrder._id);

      if (latestOrder) {
        setCreatedOrder(latestOrder);
      }

      setStatusMessage(
        latestOrder?.paymentStatus === "paid"
          ? "Readora đã ghi nhận thanh toán."
          : "Chưa ghi nhận thanh toán. Vui lòng thử lại sau vài phút.",
      );
    } catch (statusError) {
      setStatusMessage(statusError.message || "Không thể kiểm tra trạng thái thanh toán.");
    } finally {
      setIsCheckingStatus(false);
    }
  };

  if (createdOrder?.paymentMethod === "bank_transfer") {
    const transferContent = `READORA-${createdOrder.orderCode}`;
    const qrUrl = createSepayQrUrl({
      amount: createdOrder.totalAmount,
      orderCode: createdOrder.orderCode,
    });

    return (
      <Layout>
        <section className="page-section checkout-page">
          <div className="container">
            <div className="empty-state empty-state--centered payment-confirmation">
              <p className="eyebrow">Thanh toán chuyển khoản</p>
              <h1>Quét QR SePay để thanh toán</h1>
              <p>Đơn hàng #{createdOrder.orderCode} đang chờ thanh toán.</p>

              <img className="payment-confirmation__qr" src={qrUrl} alt="QR thanh toán SePay" />

              <dl className="bank-transfer-box payment-confirmation__details">
                <div>
                  <dt>Số tiền</dt>
                  <dd>{formatCurrency(createdOrder.totalAmount)}</dd>
                </div>
                <div>
                  <dt>Nội dung chuyển khoản</dt>
                  <dd>{transferContent}</dd>
                </div>
                <div>
                  <dt>Ngân hàng</dt>
                  <dd>{SEPAY_BANK}</dd>
                </div>
                <div>
                  <dt>Số tài khoản</dt>
                  <dd>{SEPAY_ACCOUNT}</dd>
                </div>
                <div>
                  <dt>Chủ tài khoản</dt>
                  <dd>{SEPAY_ACCOUNT_NAME}</dd>
                </div>
                <div>
                  <dt>Trạng thái</dt>
                  <dd>
                    {createdOrder.paymentStatus === "paid" ? "Đã thanh toán" : "Chưa thanh toán"}
                  </dd>
                </div>
              </dl>

              {statusMessage && <p className="cart-feedback">{statusMessage}</p>}

              <div className="checkout-actions">
                <button
                  className="button button--primary"
                  type="button"
                  disabled={isCheckingStatus}
                  onClick={handleCheckPaymentStatus}
                >
                  {isCheckingStatus ? "Đang kiểm tra..." : "Tôi đã chuyển khoản"}
                </button>
                <Link className="button button--secondary" to="/orders">
                  Xem đơn hàng
                </Link>
              </div>
            </div>
          </div>
        </section>
      </Layout>
    );
  }

  if (cartItems.length === 0) {
    return (
      <Layout>
        <section className="page-section">
          <div className="container">
            <div className="empty-state empty-state--centered cart-empty">
              <p className="eyebrow">Thanh toán</p>
              <h1>Giỏ hàng đang trống</h1>
              <p>Hãy thêm sách vào giỏ trước khi tạo đơn hàng.</p>
              <Link className="button button--primary" to="/books">
                Xem danh sách sách
              </Link>
            </div>
          </div>
        </section>
      </Layout>
    );
  }

  return (
    <Layout>
      <section className="page-section checkout-page">
        <div className="container">
          <div className="page-header cart-page__header">
            <p className="eyebrow">Thanh toán</p>
            <h1>Thông tin nhận hàng</h1>
            <p>Chọn COD hoặc chuyển khoản ngân hàng để hoàn tất đơn hàng.</p>
          </div>

          <div className="checkout-layout">
            <form className="checkout-form" onSubmit={handleSubmit}>
              {error && (
                <p className="auth-card__error" role="alert">
                  {error}
                </p>
              )}

              <label className="form-group">
                Họ tên
                <input
                  type="text"
                  name="fullName"
                  value={shippingAddress.fullName}
                  onChange={handleChange}
                  placeholder="Nguyễn Văn A"
                  autoComplete="name"
                  required
                />
              </label>

              <div className="checkout-form__grid">
                <label className="form-group">
                  Số điện thoại
                  <input
                    type="tel"
                    name="phone"
                    value={shippingAddress.phone}
                    onChange={handleChange}
                    placeholder="0909123456"
                    autoComplete="tel"
                    required
                  />
                </label>

                <label className="form-group">
                  Thành phố
                  <input
                    type="text"
                    name="city"
                    value={shippingAddress.city}
                    onChange={handleChange}
                    placeholder="Hà Nội"
                    autoComplete="address-level2"
                    required
                  />
                </label>
              </div>

              <label className="form-group">
                Địa chỉ
                <input
                  type="text"
                  name="address"
                  value={shippingAddress.address}
                  onChange={handleChange}
                  placeholder="Số nhà, đường, phường/xã"
                  autoComplete="street-address"
                  required
                />
              </label>

              <fieldset className="payment-methods">
                <legend>Phương thức thanh toán</legend>
                <label className="payment-methods__option">
                  <input
                    type="radio"
                    name="paymentMethod"
                    value="cod"
                    checked={paymentMethod === "cod"}
                    onChange={(event) => setPaymentMethod(event.target.value)}
                  />
                  <span>
                    <strong>COD</strong>
                    <small>Thanh toán khi nhận hàng.</small>
                  </span>
                </label>
                <label className="payment-methods__option">
                  <input
                    type="radio"
                    name="paymentMethod"
                    value="bank_transfer"
                    checked={paymentMethod === "bank_transfer"}
                    onChange={(event) => setPaymentMethod(event.target.value)}
                  />
                  <span>
                    <strong>Chuyển khoản ngân hàng</strong>
                    <small>Quét QR SePay sau khi đặt hàng, không cần nhập API key.</small>
                  </span>
                </label>
              </fieldset>

              {paymentMethod === "bank_transfer" && (
                <div className="bank-transfer-box" aria-live="polite">
                  <p className="eyebrow">Thông tin chuyển khoản mẫu</p>
                  <dl>
                    <div>
                      <dt>Ngân hàng</dt>
                      <dd>{SEPAY_BANK}</dd>
                    </div>
                    <div>
                      <dt>Số tài khoản</dt>
                      <dd>{SEPAY_ACCOUNT}</dd>
                    </div>
                    <div>
                      <dt>Chủ tài khoản</dt>
                      <dd>{SEPAY_ACCOUNT_NAME}</dd>
                    </div>
                    <div>
                      <dt>Nội dung</dt>
                      <dd>READORA-MADON sau khi tạo đơn</dd>
                    </div>
                  </dl>
                </div>
              )}

              <div className="checkout-actions">
                <button
                  className="button button--primary"
                  type="submit"
                  disabled={isSubmitting}
                >
                  {isSubmitting ? "Đang tạo đơn..." : "Đặt hàng"}
                </button>
                <Link className="button button--secondary" to="/cart">
                  Quay lại giỏ hàng
                </Link>
              </div>
            </form>

            <aside className="cart-summary checkout-summary" aria-label="Tóm tắt đơn hàng">
              <p className="eyebrow">Đơn hàng</p>
              <div className="checkout-summary__items">
                {cartItems.map((item) => (
                  <div className="checkout-summary__item" key={item.id}>
                    <img
                      src={item.coverImage || FALLBACK_COVER_IMAGE}
                      alt={`Bìa sách ${item.title}`}
                      onError={(event) => {
                        event.currentTarget.onerror = null;
                        event.currentTarget.src = FALLBACK_COVER_IMAGE;
                      }}
                    />
                    <div>
                      <strong>{item.title}</strong>
                      <span>
                        {item.quantity} x {formatCurrency(item.price)}
                      </span>
                    </div>
                  </div>
                ))}
              </div>
              <div className="cart-summary__row">
                <span>Số lượng</span>
                <strong>{cartCount}</strong>
              </div>
              <div className="cart-summary__row">
                <span>Thanh toán</span>
                <strong>{paymentMethod === "cod" ? "COD" : "Chuyển khoản"}</strong>
              </div>
              <div className="cart-summary__row cart-summary__row--total">
                <span>Tổng cộng</span>
                <strong>{formatCurrency(cartTotal)}</strong>
              </div>
            </aside>
          </div>
        </div>
      </section>
    </Layout>
  );
}

export default CheckoutPage;
