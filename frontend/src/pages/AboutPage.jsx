import Layout from "../layouts/Layout";

const values = [
  {
    title: "Chọn sách có chủ đích",
    text: "Readora ưu tiên những cuốn dễ bắt đầu, có mô tả rõ và phù hợp từng nhu cầu đọc.",
  },
  {
    title: "Trải nghiệm gọn gàng",
    text: "Giao diện tập trung vào tìm kiếm, lọc nhanh và xem thông tin sách mà không bị rối.",
  },
  {
    title: "Phù hợp người mới đọc",
    text: "Nội dung, danh mục và thao tác được viết đơn giản để ai cũng có thể dùng ngay.",
  },
];

function AboutPage() {
  return (
    <Layout>
      <section className="page-section about-page">
        <div className="container about-grid">
          <div className="about-copy">
            <p className="eyebrow">Giới thiệu</p>
            <h1>Readora giúp bạn tìm cuốn sách tiếp theo dễ hơn.</h1>
            <p>
              Đây là giao diện demo cho nhà sách trực tuyến Readora. Ứng dụng
              tập trung vào routing, giao diện đọc dễ chịu, danh sách sách từ
              API và các thao tác lọc cơ bản trước khi bước sang auth, cart
              logic và order.
            </p>
          </div>

          <div className="about-panel">
            <span>READORA</span>
            <strong>Books + API</strong>
            <p>React routes, Express API, responsive layout và dark/light mode.</p>
          </div>
        </div>

        <div className="container value-grid">
          {values.map((value) => (
            <article className="value-card" key={value.title}>
              <h2>{value.title}</h2>
              <p>{value.text}</p>
            </article>
          ))}
        </div>
      </section>
    </Layout>
  );
}

export default AboutPage;
