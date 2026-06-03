import { useState, useEffect, useRef } from "react";
import { getBookReviews, createBookReview, getProfile } from "../services/api";

// Simple module-level cache so multiple instances share one profile call
let profileCache = null;
let profilePromise = null;

const getCachedProfile = async () => {
  if (profileCache) return profileCache;
  if (profilePromise) return profilePromise;
  profilePromise = getProfile()
    .then((profile) => {
      profileCache = profile;
      return profile;
    })
    .finally(() => {
      profilePromise = null;
    });
  return profilePromise;
};

const getEntityId = (value) => {
  if (!value) return "";
  if (typeof value === "string") return value;
  if (value._id) return getEntityId(value._id);
  if (value.id) return getEntityId(value.id);
  return String(value);
};

function OrderItemReview({ bookId, orderId, orderStatus, onReviewComplete }) {
  const [state, setState] = useState("loading"); // loading | can_review | reviewed | hidden
  const [showForm, setShowForm] = useState(false);
  const [rating, setRating] = useState(0);
  const [comment, setComment] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState("");
  const mountedRef = useRef(true);
  const canReviewOrder = orderStatus === "delivered";
  const isReviewed = state === "reviewed";

  useEffect(() => {
    mountedRef.current = true;
    return () => {
      mountedRef.current = false;
    };
  }, []);

  useEffect(() => {
    if (!canReviewOrder || !bookId || !orderId) {
      return;
    }

    let cancelled = false;

    const checkStatus = async () => {
      try {
        const profile = await getCachedProfile();
        if (cancelled || !mountedRef.current) return;

        const reviews = await getBookReviews(bookId);
        if (cancelled || !mountedRef.current) return;

        const existing = reviews.find(
          (r) => r.user?._id === profile._id && getEntityId(r.order) === orderId
        );

        if (existing) {
          setState("reviewed");
          setShowForm(false);
          setError("");
        } else {
          setState("can_review");
        }
      } catch {
        if (!cancelled && mountedRef.current) {
          setState("hidden");
        }
      }
    };

    checkStatus();

    return () => {
      cancelled = true;
    };
  }, [bookId, canReviewOrder, orderId]);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError("");

    if (isReviewed) {
      console.log("[review ui] review already exists, skip submit", bookId);
      setShowForm(false);
      return;
    }

    if (rating === 0) {
      setError("Vui lòng chọn số sao.");
      return;
    }

    console.log("[review ui] submitting review", bookId);
    setSubmitting(true);

    try {
      await createBookReview(bookId, { rating, comment, orderId });
      if (!mountedRef.current) return;
      setState("reviewed");
      setShowForm(false);
      setRating(0);
      setComment("");
      if (onReviewComplete) onReviewComplete();
    } catch (err) {
      if (!mountedRef.current) return;
      const msg = err.message || "";

      if (
        msg.includes("đánh giá sách này trong đơn hàng này") ||
        msg.includes("danh gia sach nay trong don hang nay")
      ) {
        setState("reviewed");
        setShowForm(false);
        setError("");
        setRating(0);
        setComment("");
      } else {
        setError(msg || "Không thể gửi đánh giá.");
      }
    } finally {
      if (mountedRef.current) setSubmitting(false);
    }
  };

  const handleCancel = () => {
    setShowForm(false);
    setError("");
    setRating(0);
    setComment("");
  };

  if (!canReviewOrder || !bookId || !orderId || state === "hidden" || state === "loading") return null;

  if (isReviewed) {
    return <span className="order-review__badge">Đã đánh giá</span>;
  }

  if (!showForm) {
    return (
      <button
        className="button order-review__trigger"
        type="button"
        onClick={() => setShowForm(true)}
      >
        Đánh giá
      </button>
    );
  }

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
          disabled={submitting || isReviewed || rating === 0}
        >
          {submitting ? "Đang gửi..." : "Gửi đánh giá"}
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
