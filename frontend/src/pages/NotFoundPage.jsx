import { Link } from "react-router-dom";
import Layout from "../layouts/Layout";

function NotFoundPage() {
  return (
    <Layout>
      <section className="page-section">
        <div className="container">
          <div className="empty-state">
            <p className="eyebrow">404</p>
            <h1>Không tìm thấy trang</h1>
            <p>Đường dẫn bạn vừa mở không tồn tại trong Readora.</p>
            <Link className="button button--primary" to="/">
              Quay về trang chủ
            </Link>
          </div>
        </div>
      </section>
    </Layout>
  );
}

export default NotFoundPage;
