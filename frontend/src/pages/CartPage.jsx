import { Link } from "react-router-dom";
import Layout from "../layouts/Layout";

function CartPage() {
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

export default CartPage;
