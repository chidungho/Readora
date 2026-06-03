import { Link } from "react-router-dom";

function Footer() {
  return (
    <footer className="site-footer">
      <div className="container footer-content">
        <div className="footer-brand">
          <Link className="brand brand--footer" to="/">
            <span className="brand-mark">R</span>
            <span>Readora</span>
          </Link>
          <p>
            Nhà sách trực tuyến dành cho người thích tìm một cuốn sách hay và
            đọc chậm hơn một chút.
          </p>
        </div>

        <div className="footer-column">
          <h3>Khám phá</h3>
          <Link to="/books">Sách mới</Link>
          <Link to="/books">Sách bán chạy</Link>
          <Link to="/books">Gợi ý hôm nay</Link>
        </div>

        <div className="footer-column">
          <h3>Hỗ trợ</h3>
          <Link to="/about">Thanh toán</Link>
          <Link to="/about">Giao hàng</Link>
          <Link to="/about">Liên hệ</Link>
        </div>
      </div>

      <div className="container footer-bottom">
        <p>© 2026 Readora. All rights reserved.</p>
        <p>hello@readora.vn</p>
      </div>
    </footer>
  );
}

export default Footer;
