import { useMemo, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import Layout from "../layouts/Layout";
import { FALLBACK_COVER_IMAGE, createOrder } from "../services/api";
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
  const [error, setError] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);

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
      await createOrder({
        items: cartItems.map((item) => ({
          book: item.id,
          title: item.title,
          price: item.price,
          quantity: item.quantity,
          coverImage: item.coverImage,
        })),
        shippingAddress,
      });

      clearCart();
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
            <p>Readora chỉ hỗ trợ thanh toán khi nhận hàng cho phase này.</p>
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

              <div className="checkout-actions">
                <button
                  className="button button--primary"
                  type="submit"
                  disabled={isSubmitting}
                >
                  {isSubmitting ? "Đang tạo đơn..." : "Đặt hàng COD"}
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
                <strong>COD</strong>
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
