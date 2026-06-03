import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import Layout from "../layouts/Layout";
import { FALLBACK_COVER_IMAGE } from "../services/api";
import {
  CART_UPDATED_EVENT,
  getCart,
  removeFromCart,
  updateCartItemQuantity,
} from "../services/cartService";

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

const getCartTotalFromItems = (items) =>
  items.reduce((total, item) => total + item.price * item.quantity, 0);

function CartPage() {
  const [cartItems, setCartItems] = useState(getCart);

  useEffect(() => {
    const syncCart = () => {
      setCartItems(getCart());
    };

    window.addEventListener("storage", syncCart);
    window.addEventListener(CART_UPDATED_EVENT, syncCart);

    return () => {
      window.removeEventListener("storage", syncCart);
      window.removeEventListener(CART_UPDATED_EVENT, syncCart);
    };
  }, []);

  const handleIncreaseQuantity = (item) => {
    setCartItems(updateCartItemQuantity(item.id, item.quantity + 1));
  };

  const handleDecreaseQuantity = (item) => {
    setCartItems(updateCartItemQuantity(item.id, item.quantity - 1));
  };

  const handleRemoveItem = (itemId) => {
    setCartItems(removeFromCart(itemId));
  };

  const cartTotal = getCartTotalFromItems(cartItems);
  const cartCount = cartItems.reduce((count, item) => count + item.quantity, 0);

  if (cartItems.length === 0) {
    return (
      <Layout>
        <section className="page-section">
          <div className="container">
            <div className="empty-state empty-state--centered cart-empty">
              <p className="eyebrow">Giỏ hàng</p>
              <h1>Giỏ hàng của bạn đang trống</h1>
              <p>
                Hãy chọn một cuốn sách yêu thích để bắt đầu danh sách đọc tiếp
                theo.
              </p>
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
      <section className="page-section cart-page">
        <div className="container">
          <div className="page-header cart-page__header">
            <p className="eyebrow">Giỏ hàng</p>
            <h1>Giỏ hàng của bạn</h1>
            <p>
              {cartCount} sản phẩm đã sẵn sàng để bạn kiểm tra trước khi thanh
              toán.
            </p>
          </div>

          <div className="cart-layout">
            <div className="cart-items" aria-label="Danh sách sách trong giỏ">
              {cartItems.map((item) => (
                <article className="cart-item" key={item.id}>
                  <Link className="cart-item__cover" to={`/books/${item.id}`}>
                    <img
                      src={item.coverImage || FALLBACK_COVER_IMAGE}
                      alt={`Bìa sách ${item.title}`}
                      onError={(event) => {
                        event.currentTarget.onerror = null;
                        event.currentTarget.src = FALLBACK_COVER_IMAGE;
                      }}
                    />
                  </Link>

                  <div className="cart-item__content">
                    <div className="cart-item__main">
                      <p className="cart-item__author">Tác giả: {item.author}</p>
                      <h2>
                        <Link to={`/books/${item.id}`}>{item.title}</Link>
                      </h2>
                    </div>

                    <div className="cart-item__price-row">
                      <strong>{formatCurrency(item.price)}</strong>
                      <span>
                        Thành tiền:{" "}
                        {formatCurrency(item.price * item.quantity)}
                      </span>
                    </div>

                    <div className="cart-item__actions">
                      <div
                        className="quantity-control"
                        aria-label={`Số lượng ${item.title}`}
                      >
                        <button
                          type="button"
                          onClick={() => handleDecreaseQuantity(item)}
                          disabled={item.quantity <= 1}
                          aria-label={`Giảm số lượng ${item.title}`}
                        >
                          -
                        </button>
                        <span>{item.quantity}</span>
                        <button
                          type="button"
                          onClick={() => handleIncreaseQuantity(item)}
                          aria-label={`Tăng số lượng ${item.title}`}
                        >
                          +
                        </button>
                      </div>

                      <button
                        className="cart-item__remove"
                        type="button"
                        onClick={() => handleRemoveItem(item.id)}
                      >
                        Xóa
                      </button>
                    </div>
                  </div>
                </article>
              ))}
            </div>

            <aside className="cart-summary" aria-label="Tổng giỏ hàng">
              <p className="eyebrow">Tổng tiền</p>
              <div className="cart-summary__row">
                <span>Số lượng</span>
                <strong>{cartCount}</strong>
              </div>
              <div className="cart-summary__row cart-summary__row--total">
                <span>Tổng cộng</span>
                <strong>{formatCurrency(cartTotal)}</strong>
              </div>
              <Link
                className="button button--primary cart-summary__checkout"
                to="/checkout"
              >
                Thanh toán
              </Link>
              <Link className="button button--secondary" to="/books">
                Tiếp tục mua sách
              </Link>
            </aside>
          </div>
        </div>
      </section>
    </Layout>
  );
}

export default CartPage;
