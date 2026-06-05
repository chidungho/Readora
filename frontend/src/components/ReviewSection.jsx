import { useState, useEffect } from "react";
import {
  getBookReviews,
  createBookReview,
  getProfile,
  getMyOrders,
} from "../services/api";

const renderStars = (rating) => {
  const stars = [];
  const fullStars = Math.floor(rating);
  const hasHalf = rating - fullStars >= 0.5;

  for (let i = 1; i <= 5; i++) {
    if (i <= fullStars) {
      stars.push(
        <span key={i} className="review-star review-star--full">
          ★
        </span>
      );
    } else if (i === fullStars + 1 && hasHalf) {
      stars.push(
        <span key={i} className="review-star review-star--half">
          ★
        </span>
      );
    } else {
      stars.push(
        <span key={i} className="review-star review-star--empty">
          ☆
        </span>
      );
    }
  }

  return stars;
};

const StarInput = ({ value, onChange }) => {
  const [hovered, setHovered] = useState(0);

  return (
    <div className="star-input" role="radiogroup" aria-label="Chon so sao">
      {[1, 2, 3, 4, 5].map((star) => (
        <button
          key={star}
          type="button"
          className={"star-input__btn " + (star <= (hovered || value) ? "star-input__btn--active" : "")}
          onClick={() => onChange(star)}
          onMouseEnter={() => setHovered(star)}
          onMouseLeave={() => setHovered(0)}
          aria-label={star + " sao"}
        >
          ★
        </button>
      ))}
    </div>
  );
};

function ReviewSection({ bookId, onReviewSubmitted }) {
  const [reviews, setReviews] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [user, setUser] = useState(null);
  const [canReview, setCanReview] = useState(false);
  const [checkingCondition, setCheckingCondition] = useState(true);
  const [rating, setRating] = useState(0);
  const [comment, setComment] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState("");
  const [existingReview, setExistingReview] = useState(null);

  useEffect(() => {
    const loadReviewsAndUser = async () => {
      setLoading(true);
      try {
        const [reviewData] = await Promise.all([getBookReviews(bookId)]);
        setReviews(reviewData);

        try {
          const profile = await getProfile();
          setUser(profile);

          const existing = reviewData.find((r) => r.user?._id === profile._id);
          if (existing) {
            setExistingReview(existing);
          } else {
            const orders = await getMyOrders();
            const hasDeliveredOrderWithBook = orders.some(
              (o) =>
                o.status === "delivered" &&
                o.items?.some((item) => {
                  const itemBookId =
                    typeof item.book === "string" ? item.book : item.book?._id || item.book?.toString();
                  return itemBookId === bookId;
                })
            );
            setCanReview(hasDeliveredOrderWithBook);
          }
        } catch {
          // Not logged in
        }
      } catch (err) {
        setError(err.message || "Không thể tải đánh giá.");
      } finally {
        setLoading(false);
        setCheckingCondition(false);
      }
    };

    loadReviewsAndUser();
  }, [bookId]);

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (rating === 0) {
      setSubmitError("Vui long chon so sao.");
      return;
    }
    setSubmitting(true);
    setSubmitError("");

    try {
      const newReview = await createBookReview(bookId, { rating, comment });
      setReviews((prev) => [newReview, ...prev]);
      setRating(0);
      setComment("");
      setExistingReview(newReview);
      setCanReview(false);
      if (onReviewSubmitted) onReviewSubmitted();
    } catch (err) {
      setSubmitError(err.message || "Không thể gửi đánh giá.");
    } finally {
      setSubmitting(false);
    }
  };

  if (loading) {
    return (
      <section className="reviews-section">
        <h2>Danh gia</h2>
        <div className="skeleton skeleton--paragraph" />
      </section>
    );
  }

  return (
    <section className="reviews-section">
      <h2>
        Danh gia ({reviews.length})
      </h2>

      {error && <p className="error-message">{error}</p>}

      {!checkingCondition && user && !existingReview && (
        <>
          {canReview ? (
            <form className="review-form" onSubmit={handleSubmit}>
              <h3>Viet danh gia</h3>
              <div className="review-form__field">
                <label>Chon so sao</label>
                <StarInput value={rating} onChange={setRating} />
              </div>
              <div className="review-form__field">
                <label htmlFor="review-comment">Nhan xet (khong bat buoc)</label>
                <textarea
                  id="review-comment"
                  className="review-form__textarea"
                  rows="4"
                  value={comment}
                  onChange={(e) => setComment(e.target.value)}
                  placeholder="Chia se cam nhan cua ban ve sach..."
                />
              </div>
              {submitError && <p className="error-message">{submitError}</p>}
              <button
                type="submit"
                className="button button--primary"
                disabled={submitting || rating === 0}
              >
                {submitting ? "Dang gui..." : "Gui danh gia"}
              </button>
            </form>
          ) : (
            !existingReview && (
              <p className="review-condition-notice">
                Ban co the danh gia sau khi don hang duoc giao thanh cong.
              </p>
            )
          )}
        </>
      )}

      <div className="reviews-list">
        {reviews.length === 0 ? (
          <p className="reviews-list__empty">Chua co danh gia nao.</p>
        ) : (
          reviews.map((review) => (
            <div key={review._id} className="review-card">
              <div className="review-card__header">
                <div className="review-card__avatar">
                  {review.user?.name?.charAt(0)?.toUpperCase() || "?"}
                </div>
                <div className="review-card__info">
                  <strong className="review-card__name">
                    {review.user?.name || "Nguoi dung"}
                  </strong>
                  <div className="review-card__stars">
                    {renderStars(review.rating)}
                  </div>
                </div>
                <span className="review-card__date">
                  {new Date(review.createdAt).toLocaleDateString("vi-VN")}
                </span>
              </div>
              {review.comment && (
                <p className="review-card__comment">{review.comment}</p>
              )}
            </div>
          ))
        )}
      </div>
    </section>
  );
}

export default ReviewSection;
