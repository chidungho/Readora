import { useState, useEffect } from "react";
import { getBookReviews, createBookReview } from "../services/api";

function OrderItemReview({ bookId, orderId, orderStatus }) {
  const [isOpen, setIsOpen] = useState(false);
  const [isReviewed, setIsReviewed] = useState(false);
  const [rating, setRating] = useState(0);
  const [comment, setComment] = useState("");
  const [error, setError] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);

  useEffect(() => {
    if (orderStatus !== "delivered" || !bookId) return;

    let cancelled = false;

    const checkReview = async () => {
      try {
        const reviews = await getBookReviews(bookId);
        if (cancelled) return;
        if (reviews.some((r) => r.order === orderId)) {
          setIsReviewed(true);
        }
      } catch {
        // silent — user can retry
      }
    };

    checkReview();

    return () => {
      cancelled = true;
    };
  }, [bookId, orderId, orderStatus]);

  if (orderStatus !== "delivered") return null;

  if (isReviewed) {
    return <span className="order-review__badge">Đã đánh giá</span>;
  }

  if (!isOpen) {
    return (
      <button
        className="button order-review__trigger"
        type="button"
        onClick={() => setIsOpen(true)}
      >
        Đánh giá
      </button>
    );
  }

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError("");

    if (rating === 0) {
      setError("Vui lòng chọn số sao.");
      return;
    }

    setIsSubmitting(true);

    try {
      await createBookReview(bookId, {
        rating,
        comment: comment.trim(),
        orderId,
      });
      setIsReviewed(true);
      setIsOpen(false);
      setRating(0);
      setComment("");
    } catch (err) {
      const msg = err?.message || "";
      if (
        msg.includes("đánh giá sách này trong đơn hàng này") ||
        msg.includes("danh gia sach nay trong don hang nay")
      ) {
        setIsReviewed(true);
        setIsOpen(false);
        setError("");
      } else {
        setError(msg || "Không gửi được đánh giá");
      }
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleCancel = () => {
    setIsOpen(false);
    setError("");
    setRating(0);
    setComment("");
  };

  return (
    <form className="order-review__form" onSubmit={handleSubmit}>
      <div className="order-review__stars">
        <span className="order-review__label">Chất lượng:</span>
        <div className="order-review__star-group">
          {[1, 2, 3, 4, 5].map((star) => (
            <button
              key={star}
              type="button"
              className={
                "order-review__star" +
                (star <= rating ? " order-review__star--active" : "")
              }
              onClick={() => setRating(star)}
              aria-label={star + " sao"}
            >
              ★
            </button>
          ))}
        </div>
      </div>

      <textarea
        className="order-review__textarea"
        rows="2"
        value={comment}
        onChange={(e) => setComment(e.target.value)}
        placeholder="Nhận xét (không bắt buộc)..."
      />

      {error && <p className="order-review__error">{error}</p>}

      <div className="order-review__actions">
        <button
          type="submit"
          className="button button--primary order-review__submit"
          disabled={isSubmitting || rating === 0}
        >
          {isSubmitting ? "Đang gửi..." : "Gửi đánh giá"}
        </button>
        <button
          type="button"
          className="button button--secondary order-review__cancel"
          onClick={handleCancel}
        >
          Hủy
        </button>
      </div>
    </form>
  );
}

export default OrderItemReview;
