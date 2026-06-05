import { useEffect, useState } from "react";
import { getAdminReviews, FALLBACK_COVER_IMAGE } from "../services/api";
import { socket } from "../services/socket";

const formatDate = (value) => {
  const date = new Date(value);
  if (!value || Number.isNaN(date.getTime())) return "Đang cập nhật";
  return new Intl.DateTimeFormat("vi-VN", { dateStyle: "medium", timeStyle: "short" }).format(date);
};

const renderStars = (rating) => {
  const normalizedRating = Math.max(0, Math.min(5, Math.round(Number(rating) || 0)));
  return "★".repeat(normalizedRating) + "☆".repeat(5 - normalizedRating);
};

const normalizeReview = (review = {}) => ({
  ...review,
  user: review.user || { name: review.userName || "Người dùng", email: "" },
  book: review.book || { title: review.bookTitle || "Sách chưa rõ", coverImage: "" },
  order: review.order || { orderCode: review.orderCode || "" },
});

function AdminReviewsPage() {
  const [reviews, setReviews] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    const controller = new AbortController();
    let isActive = true;
    const loadReviews = async () => {
      try {
        const nextReviews = await getAdminReviews({ signal: controller.signal });
        if (isActive) setReviews(nextReviews.map(normalizeReview));
      } catch (reviewsError) {
        if (reviewsError.name !== "AbortError" && isActive) setError(reviewsError.message || "Không thể tải đánh giá.");
      } finally {
        if (isActive) setLoading(false);
      }
    };
    loadReviews();
    return () => { isActive = false; controller.abort(); };
  }, []);

  useEffect(() => {
    const handleNewReview = (payload = {}) => {
      console.log("[admin reviews] received admin:new-review", payload);
      const nextReview = normalizeReview(payload.review || payload);
      if (!nextReview._id) return;
      setReviews((currentReviews) => currentReviews.some((review) => review._id === nextReview._id) ? currentReviews : [nextReview, ...currentReviews]);
    };
    socket.connect();
    socket.on("admin:new-review", handleNewReview);
    return () => socket.off("admin:new-review", handleNewReview);
  }, []);

  return (
    <section className="admin-page fade-up">
      <div className="admin-page__header"><div><p className="eyebrow">ĐÁNH GIÁ</p><h1>Quản lý đánh giá</h1><p>Theo dõi đánh giá mới nhất từ khách hàng.</p></div></div>
      {loading && <p className="state-message">Đang tải đánh giá...</p>}
      {error && <p className="state-message state-message--error">{error}</p>}
      {!loading && !error && reviews.length === 0 && <div className="empty-state empty-state--inline"><p className="eyebrow">Chưa có đánh giá nào.</p><h2>Khách hàng chưa gửi đánh giá nào</h2><p>Đánh giá mới sẽ tự xuất hiện tại đây.</p></div>}
      {!loading && !error && reviews.length > 0 && <section className="admin-panel"><div className="admin-panel__header"><h2>TẤT CẢ ĐÁNH GIÁ</h2><span>{reviews.length} đánh giá</span></div><div className="admin-table-wrap"><table className="admin-table admin-reviews-table"><thead><tr><th>Người dùng</th><th>Sách</th><th>Số sao</th><th>Nhận xét</th><th>Mã đơn</th><th>Ngày tạo</th></tr></thead><tbody>{reviews.map((review) => <tr key={review._id}><td><strong>{review.user?.name || "Người dùng"}</strong><span>{review.user?.email || "Chưa có email"}</span></td><td><div className="admin-review-book"><img src={review.book?.coverImage || FALLBACK_COVER_IMAGE} alt={`Bìa sách ${review.book?.title || "Readora"}`} onError={(event) => { event.currentTarget.onerror = null; event.currentTarget.src = FALLBACK_COVER_IMAGE; }} /><strong>{review.book?.title || "Sách chưa rõ"}</strong></div></td><td><span className="admin-review-stars" aria-label={`${review.rating}/5 sao`}>{renderStars(review.rating)}</span></td><td><p className="admin-review-comment">{review.comment || "Không có nhận xét"}</p></td><td><strong>#{review.order?.orderCode || "?"}</strong></td><td>{formatDate(review.createdAt)}</td></tr>)}</tbody></table></div></section>}
    </section>
  );
}

export default AdminReviewsPage;
