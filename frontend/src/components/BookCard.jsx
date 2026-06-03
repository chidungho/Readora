import { Link } from "react-router-dom";
import { FALLBACK_COVER_IMAGE } from "../services/api";

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

  return Number.isFinite(rating) && rating > 0
    ? `${rating.toFixed(1).replace(".0", "")}/5`
    : "Chưa có đánh giá";
};

const formatStock = (value) => {
  const stock = Number(value);

  if (!Number.isFinite(stock)) {
    return "Đang cập nhật";
  }

  return stock > 0 ? `Còn ${stock} cuốn` : "Tạm hết hàng";
};

function BookCard({ book, viewMode = "grid" }) {
  const bookId = book._id || book.id;
  const cardViewClass =
    viewMode === "list" ? "book-card--list" : "book-card--grid";
  const coverImage = book.coverImage || book.image || FALLBACK_COVER_IMAGE;
  const title = book.title || "Sách đang cập nhật";
  const author = book.author || "Readora";
  const category = book.category || "Chưa phân loại";
  const description =
    book.description || "Mô tả sách đang được Readora cập nhật.";
  const formattedPrice = formatCurrency(book.price);
  const originalPrice = Number(book.originalPrice);
  const hasOriginalPrice =
    Number.isFinite(originalPrice) && originalPrice > Number(book.price);
  const detailPath = bookId ? `/books/${bookId}` : "/books";

  const cover = (
    <div className="book-card__cover">
      <img
        src={coverImage}
        alt={`Bìa sách ${title}`}
        onError={(event) => {
          event.currentTarget.onerror = null;
          event.currentTarget.src = FALLBACK_COVER_IMAGE;
        }}
      />
    </div>
  );

  const details = (
    <div className="book-card__content">
      <p className="book-card__category">{category}</p>
      <h3>{title}</h3>
      <p className="book-card__author">Tác giả: {author}</p>
      <p className="book-card__description">{description}</p>

      <div className="book-card__meta">
        <span>{formatRating(book.rating)}</span>
        <span>{formatStock(book.stock)}</span>
      </div>
    </div>
  );

  const footer = (
    <div className="book-card__footer">
      <div className="book-card__prices">
        <strong>{formattedPrice}</strong>
        {hasOriginalPrice && (
          <span className="book-card__original-price">
            {formatCurrency(originalPrice)}
          </span>
        )}
      </div>
      <Link to={detailPath} className="book-card__button">
        Xem chi tiết
      </Link>
    </div>
  );

  if (viewMode === "list") {
    return (
      <article className={`book-card ${cardViewClass}`}>
        {cover}
        {details}
        {footer}
      </article>
    );
  }

  return (
    <article className={`book-card ${cardViewClass}`}>
      {cover}
      <div className="book-card__content">
        <p className="book-card__category">{category}</p>
        <h3>{title}</h3>
        <p className="book-card__author">Tác giả: {author}</p>
        <p className="book-card__description">{description}</p>

        <div className="book-card__meta">
          <span>{formatRating(book.rating)}</span>
          <span>{formatStock(book.stock)}</span>
        </div>

        {footer}
      </div>
    </article>
  );
}

export default BookCard;
