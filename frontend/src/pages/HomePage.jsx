import { useEffect, useState } from "react";
import BookCard from "../components/BookCard";
import Layout from "../layouts/Layout";
import { getBooks } from "../services/api";

const heroImages = [
  {
    src: "https://images.unsplash.com/photo-1512820790803-83ca734da794?auto=format&fit=crop&w=520&q=80",
    alt: "Stack of books on a cozy reading table",
  },
  {
    src: "https://images.unsplash.com/photo-1495446815901-a7297e633e8d?auto=format&fit=crop&w=520&q=80",
    alt: "Open books arranged on shelves",
  },
  {
    src: "https://images.unsplash.com/photo-1524995997946-a1c2e315a42f?auto=format&fit=crop&w=520&q=80",
    alt: "Reader browsing books in a warm library",
  },
];

function HomePage() {
  const [featuredBooks, setFeaturedBooks] = useState([]);
  const [categoryCount, setCategoryCount] = useState(0);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    const controller = new AbortController();
    let isActive = true;

    const loadBooks = async () => {
      setLoading(true);
      setError("");

      try {
        const books = await getBooks({ signal: controller.signal });
        const featured = books.filter((book) => book.isFeatured);
        const nextFeaturedBooks = featured.length > 0 ? featured : books;
        const categories = new Set(
          books.map((book) => book.category).filter(Boolean),
        );

        if (isActive) {
          setFeaturedBooks(nextFeaturedBooks.slice(0, 4));
          setCategoryCount(categories.size);
        }
      } catch (fetchError) {
        if (fetchError.name !== "AbortError" && isActive) {
          setFeaturedBooks([]);
          setCategoryCount(0);
          setError(fetchError.message || "Không thể tải danh sách sách.");
        }
      } finally {
        if (isActive) {
          setLoading(false);
        }
      }
    };

    loadBooks();

    return () => {
      isActive = false;
      controller.abort();
    };
  }, []);

  return (
    <Layout>
      <section className="hero-section" id="top">
        <div className="container hero-grid">
          <div className="hero-copy fade-up">
            <p className="eyebrow">Nhà sách trực tuyến</p>
            <h1>Readora</h1>
            <p className="hero-description">
              Tìm sách hay theo tâm trạng đọc hôm nay, từ tiểu thuyết nhẹ nhàng
              đến kỹ năng, tản văn và khoa học phổ thông.
            </p>

            <div className="hero-actions">
              <a className="button button--primary" href="#featured-books">
                Xem sách nổi bật
              </a>
              <a className="button button--secondary" href="#featured-books">
                Khám phá thể loại
              </a>
            </div>

            <div className="hero-stats">
              <div>
                <strong>{featuredBooks.length}</strong>
                <span>Sách gợi ý</span>
              </div>
              <div>
                <strong>{categoryCount || "..."}</strong>
                <span>Thể loại</span>
              </div>
              <div>
                <strong>24h</strong>
                <span>Cập nhật</span>
              </div>
            </div>
          </div>

          <div className="hero-visual fade-up">
            {heroImages.map((image, index) => (
              <figure className="hero-image-card" key={image.src}>
                <img src={image.src} alt={image.alt} loading={index === 0 ? "eager" : "lazy"} />
              </figure>
            ))}
          </div>
        </div>
      </section>

      <section className="featured-section" id="featured-books">
        <div className="container">
          <div className="section-heading">
            <p className="eyebrow">Gợi ý hôm nay</p>
            <h2>4 cuốn sách nổi bật</h2>
            <span>Chọn một cuốn phù hợp cho buổi đọc tiếp theo của bạn.</span>
          </div>

          {loading && (
            <div className="state-message" role="status">
              Đang tải sách...
            </div>
          )}

          {error && (
            <div className="state-message state-message--error" role="alert">
              {error}
            </div>
          )}

          {!loading && !error && featuredBooks.length > 0 && (
            <div className="book-grid">
              {featuredBooks.map((book) => (
                <BookCard key={book._id} book={book} />
              ))}
            </div>
          )}

          {!loading && !error && featuredBooks.length === 0 && (
            <div className="empty-state empty-state--inline">
              <p className="eyebrow">Chưa có sách</p>
              <h2>Readora đang cập nhật danh sách nổi bật</h2>
              <p>Vui lòng quay lại sau khi dữ liệu sách được bổ sung.</p>
            </div>
          )}
        </div>
      </section>
    </Layout>
  );
}

export default HomePage;
