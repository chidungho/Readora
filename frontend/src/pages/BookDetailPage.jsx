import { useEffect, useState } from "react";
import { Link, useParams } from "react-router-dom";
import Layout from "../layouts/Layout";
import { FALLBACK_COVER_IMAGE, getBookById } from "../services/api";
import ReviewSection from "../components/ReviewSection";
import { addToCart } from "../services/cartService";

const formatCurrency = (value) => {
  if (value === null || value === undefined || value === "") {
    return "Đang cập nhật";
  }

  const price = Number(value);

  if (!Number.isFinite(price)) {
    return "Đang cập nhật";
  }

  return new Intl.NumberFormat("vi-VN", {
    style: "currency",
    currency: "VND",
  }).format(price);
};

const formatRating = (value) => {
  const rating = Number(value);

  if (!Number.isFinite(rating) || rating <= 0) {
    return "Chưa có đánh giá";
  }

  return `${rating.toFixed(1).replace(".0", "")}/5`;
};

const formatStock = (value) => {
  const stock = Number(value);

  if (!Number.isFinite(stock)) {
    return "Đang cập nhật";
  }

  return stock > 0 ? `Còn ${stock} cuốn` : "Tạm hết hàng";
};

function BookDetailPage() {
  const { id } = useParams();
  const [book, setBook] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [cartMessage, setCartMessage] = useState("");
  const [reviewUpdateKey, setReviewUpdateKey] = useState(0);

  useEffect(() => {
    const controller = new AbortController();
    let isActive = true;

    const loadBook = async () => {
      setLoading(true);
      setError("");

      try {
        const nextBook = await getBookById(id, {
          signal: controller.signal,
        });

        if (isActive) {
          setBook(nextBook);
        }
      } catch (fetchError) {
        if (fetchError.name !== "AbortError" && isActive) {
          setBook(null);
          setError(fetchError.message || "Không thể tải chi tiết sách.");
        }
      } finally {
        if (isActive) {
          setLoading(false);
        }
      }
    };

    loadBook();

    return () => {
      isActive = false;
      controller.abort();
    };
  }, [id]);

  useEffect(() => {
    if (!cartMessage) {
      return undefined;
    }

    const timerId = window.setTimeout(() => {
      setCartMessage("");
    }, 1800);

    return () => {
      window.clearTimeout(timerId);
    };
  }, [cartMessage]);

  if (loading) {
    return (
      <Layout>
        <section className="page-section book-detail-page" aria-busy="true">
          <div className="container book-detail book-detail--loading">
            <div className="book-detail__cover-skeleton skeleton" />

            <div className="book-detail__content">
              <span className="skeleton skeleton--eyebrow" />
              <span className="skeleton skeleton--title" />
              <span className="skeleton skeleton--line" />
              <span className="skeleton skeleton--paragraph" />
              <div className="book-detail__facts">
                <span className="skeleton skeleton--pill" />
                <span className="skeleton skeleton--pill" />
                <span className="skeleton skeleton--pill" />
              </div>
              <span className="skeleton skeleton--price" />
            </div>
          </div>
        </section>
      </Layout>
    );
  }

  if (error || !book) {
    return (
      <Layout>
        <section className="page-section">
          <div className="container">
            <div className="empty-state">
              <p className="eyebrow">Không thể hiển thị</p>
              <h1>Không tải được chi tiết sách</h1>
              <p>{error || "Sách này không còn trong hệ thống Readora."}</p>
              <Link className="button button--primary" to="/books">
                Quay lại danh sách sách
              </Link>
            </div>
          </div>
        </section>
      </Layout>
    );
  }

  const coverImage = book.coverImage || FALLBACK_COVER_IMAGE;
  const originalPrice = Number(book.originalPrice);
  const stock = Number(book.stock);
  const hasOriginalPrice =
    Number.isFinite(originalPrice) && originalPrice > Number(book.price);
  const canAddToCart = !Number.isFinite(stock) || stock > 0;
  const handleAddToCart = () => {
    if (!canAddToCart) {
      return;
    }

    addToCart(book);
    setCartMessage("Đã thêm vào giỏ");
  };

  return (
    <Layout>
      <section className="page-section book-detail-page">
        <div className="container book-detail">
          <div className="book-detail__cover">
            <img
              src={coverImage}
              alt={`Bìa sách ${book.title}`}
              onError={(event) => {
                event.currentTarget.onerror = null;
                event.currentTarget.src = FALLBACK_COVER_IMAGE;
              }}
            />
          </div>

          <div className="book-detail__content fade-up">
            <p className="eyebrow">{book.category || "Chưa phân loại"}</p>
            <h1>{book.title}</h1>
            <p className="book-detail__author">Tác giả: {book.author}</p>
            <p className="book-detail__description">
              {book.description || "Mô tả sách đang được Readora cập nhật."}
            </p>

            <div className="book-detail__facts" aria-label="Thông tin sách">
              <span>{book.category || "Chưa phân loại"}</span>
              <span>{formatStock(book.stock)}</span>
              <span>{formatRating(book.rating)}</span>
              <span>Đã bán {Number(book.sold) || 0}</span>
              <span>{Number(book.reviewCount) || 0} đánh giá</span>
            </div>

            <div className="book-detail__price-row">
              <strong className="book-detail__price">
                {formatCurrency(book.price)}
              </strong>
              {hasOriginalPrice && (
                <span className="book-detail__original-price">
                  {formatCurrency(originalPrice)}
                </span>
              )}
            </div>

            <div className="hero-actions">
              <button
                className="button button--primary"
                type="button"
                onClick={handleAddToCart}
                disabled={!canAddToCart}
              >
                Thêm vào giỏ
              </button>
              <Link className="button button--secondary" to="/books">
                Quay lại danh sách
              </Link>
            </div>
            {cartMessage && (
              <p className="cart-feedback" role="status" aria-live="polite">
                {cartMessage}
              </p>
            )}
          </div>
        </div>

        <ReviewSection key={reviewUpdateKey} bookId={id} onReviewSubmitted={() => setReviewUpdateKey((k) => k + 1)} />
      </section>
    </Layout>
  );
}

export default BookDetailPage;
