import Layout from "../layouts/Layout";

const blogPosts = [
  {
    title: "5 cách chọn sách khi bạn chưa biết mình muốn đọc gì",
    excerpt:
      "Bắt đầu từ tâm trạng, thời gian rảnh và mức độ tập trung để chọn một cuốn vừa sức.",
    date: "28/05/2026",
    category: "Gợi ý đọc",
  },
  {
    title: "Vì sao danh mục sách tốt giúp người đọc quyết định nhanh hơn",
    excerpt:
      "Một hệ thống danh mục rõ ràng giúp giảm phân vân và làm hành trình mua sách nhẹ hơn.",
    date: "20/05/2026",
    category: "Trải nghiệm",
  },
  {
    title: "Đọc sách cũ: tiết kiệm hơn nhưng vẫn cần chọn kỹ",
    excerpt:
      "Kiểm tra tình trạng, năm xuất bản và nhu cầu sử dụng trước khi thêm sách cũ vào giỏ.",
    date: "12/05/2026",
    category: "Mua sách",
  },
  {
    title: "Một kệ sách nhỏ cho người mới học công nghệ",
    excerpt:
      "Những cuốn nhập môn nên giải thích chậm rãi, nhiều ví dụ và tránh quá tải thuật ngữ.",
    date: "04/05/2026",
    category: "Công nghệ",
  },
];

function BlogPage() {
  return (
    <Layout>
      <section className="page-section blog-page">
        <div className="container">
          <div className="section-heading">
            <p className="eyebrow">Blog Readora</p>
            <h1>Bài viết mới</h1>
            <span>
              Một vài ghi chú ngắn về thói quen đọc, chọn sách và trải nghiệm
              mua sách trực tuyến.
            </span>
          </div>

          <div className="blog-list">
            {blogPosts.map((post) => (
              <article className="blog-card" key={post.title}>
                <div className="blog-card__meta">
                  <span>{post.category}</span>
                  <time dateTime={post.date.split("/").reverse().join("-")}>
                    {post.date}
                  </time>
                </div>
                <h2>{post.title}</h2>
                <p>{post.excerpt}</p>
              </article>
            ))}
          </div>
        </div>
      </section>
    </Layout>
  );
}

export default BlogPage;
