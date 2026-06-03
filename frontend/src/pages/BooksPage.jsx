import { useEffect, useMemo, useState } from "react";
import { useSearchParams } from "react-router-dom";
import BookCard from "../components/BookCard";
import Layout from "../layouts/Layout";
import { getBooks, getCategories } from "../services/api";

const ratingOptions = [
  { label: "Tất cả đánh giá", value: "0" },
  { label: "Từ 4 sao", value: "4" },
  { label: "Từ 4.5 sao", value: "4.5" },
  { label: "Từ 4.8 sao", value: "4.8" },
];

const normalizeText = (value) =>
  value
    .toLocaleLowerCase("vi-VN")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "");

const getBookDate = (book) => {
  const timestamp = new Date(book.publishedAt || book.createdAt).getTime();

  return Number.isFinite(timestamp) ? timestamp : 0;
};

const getBookPrice = (book, fallback) => {
  const price = Number(book.price);

  return Number.isFinite(price) ? price : fallback;
};

function toggleFilterValue(currentValues, value) {
  if (currentValues.includes(value)) {
    return currentValues.filter((currentValue) => currentValue !== value);
  }

  return [...currentValues, value];
}

function BooksPage() {
  const [searchParams, setSearchParams] = useSearchParams();
  const queryFromUrl = searchParams.get("q") ?? "";
  const [books, setBooks] = useState([]);
  const [categories, setCategories] = useState([]);
  const [selectedCategories, setSelectedCategories] = useState([]);
  const [minimumRating, setMinimumRating] = useState("0");
  const [selectedConditions, setSelectedConditions] = useState([]);
  const [sortBy, setSortBy] = useState("popular");
  const [viewMode, setViewMode] = useState("grid");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    const controller = new AbortController();
    let isActive = true;

    const loadBooksPageData = async () => {
      setLoading(true);
      setError("");

      try {
        const [nextBooks, nextCategories] = await Promise.all([
          getBooks({ signal: controller.signal }),
          getCategories({ signal: controller.signal }),
        ]);

        if (isActive) {
          setBooks(nextBooks);
          setCategories(nextCategories);
        }
      } catch (fetchError) {
        if (fetchError.name !== "AbortError" && isActive) {
          setBooks([]);
          setCategories([]);
          setError(fetchError.message || "Không thể tải danh sách sách.");
        }
      } finally {
        if (isActive) {
          setLoading(false);
        }
      }
    };

    loadBooksPageData();

    return () => {
      isActive = false;
      controller.abort();
    };
  }, []);

  const categoryOptions = useMemo(() => {
    const apiCategories = categories
      .map((category) => category.name)
      .filter(Boolean);
    const bookCategories = books.map((book) => book.category).filter(Boolean);

    return [...new Set([...apiCategories, ...bookCategories])];
  }, [books, categories]);

  const categoryHighlights = useMemo(
    () =>
      categoryOptions.map((category) => {
        const apiCategory = categories.find((item) => item.name === category);
        const apiCount = Number(apiCategory?.bookCount);
        const bookCount = books.filter((book) => book.category === category).length;

        return {
          name: category,
          count: Number.isFinite(apiCount) && apiCount > 0 ? apiCount : bookCount,
        };
      }),
    [books, categories, categoryOptions],
  );

  const conditionOptions = useMemo(
    () => [...new Set(books.map((book) => book.condition).filter(Boolean))],
    [books],
  );

  const filteredBooks = useMemo(() => {
    const keyword = normalizeText(queryFromUrl.trim());
    const ratingNumber = Number(minimumRating);

    return books
      .filter((book) => {
        const searchableBook = normalizeText(
          `${book.title} ${book.author} ${book.category} ${book.description}`,
        );
        const matchesSearch = !keyword || searchableBook.includes(keyword);
        const matchesCategory =
          selectedCategories.length === 0 ||
          selectedCategories.includes(book.category);
        const matchesRating = Number(book.rating) >= ratingNumber;
        const matchesCondition =
          selectedConditions.length === 0 ||
          selectedConditions.includes(book.condition);

        return (
          matchesSearch &&
          matchesCategory &&
          matchesRating &&
          matchesCondition
        );
      })
      .sort((firstBook, secondBook) => {
        if (sortBy === "price-asc") {
          return (
            getBookPrice(firstBook, Number.MAX_SAFE_INTEGER) -
            getBookPrice(secondBook, Number.MAX_SAFE_INTEGER)
          );
        }

        if (sortBy === "price-desc") {
          return (
            getBookPrice(secondBook, Number.NEGATIVE_INFINITY) -
            getBookPrice(firstBook, Number.NEGATIVE_INFINITY)
          );
        }

        if (sortBy === "newest") {
          return getBookDate(secondBook) - getBookDate(firstBook);
        }

        return (
          Number(secondBook.sold) - Number(firstBook.sold) ||
          Number(secondBook.rating) - Number(firstBook.rating)
        );
      });
  }, [
    books,
    minimumRating,
    queryFromUrl,
    selectedCategories,
    selectedConditions,
    sortBy,
  ]);

  const updateSearchTerm = (value) => {
    const nextSearchParams = new URLSearchParams(searchParams);

    if (value) {
      nextSearchParams.set("q", value);
    } else {
      nextSearchParams.delete("q");
    }

    setSearchParams(nextSearchParams);
  };

  const resetFilters = () => {
    updateSearchTerm("");
    setSelectedCategories([]);
    setMinimumRating("0");
    setSelectedConditions([]);
    setSortBy("popular");
  };

  return (
    <Layout>
      <section className="page-section books-page">
        <div className="container">
          <div className="section-heading">
            <p className="eyebrow">Thư viện Readora</p>
            <h1>Danh sách sách</h1>
            <span>
              Tìm, lọc và sắp xếp sách từ Readora API theo tên sách, tác giả,
              danh mục, đánh giá và giá.
            </span>
          </div>

          {categoryHighlights.length > 0 && (
            <section
              className="featured-categories"
              aria-labelledby="featured-categories-title"
            >
              <div className="section-heading section-heading--compact">
                <p className="eyebrow">Danh mục nổi bật</p>
                <h2 id="featured-categories-title">Chọn nhanh theo gu đọc</h2>
              </div>

              <div className="category-strip">
                {categoryHighlights.map((category) => (
                  <button
                    className="category-chip"
                    key={category.name}
                    type="button"
                    onClick={() => setSelectedCategories([category.name])}
                  >
                    <span>{category.name}</span>
                    <strong>{category.count} sách</strong>
                  </button>
                ))}
              </div>
            </section>
          )}

          <div className="books-toolbar">
            <label className="books-search">
              <span>Tìm sách</span>
              <input
                type="search"
                value={queryFromUrl}
                onChange={(event) => updateSearchTerm(event.target.value)}
                placeholder="Nhập tên sách, tác giả, danh mục..."
              />
            </label>

            <label className="sort-control">
              <span>Sắp xếp</span>
              <select
                value={sortBy}
                onChange={(event) => setSortBy(event.target.value)}
              >
                <option value="popular">Phổ biến</option>
                <option value="price-asc">Giá thấp đến cao</option>
                <option value="price-desc">Giá cao đến thấp</option>
                <option value="newest">Mới nhất</option>
              </select>
            </label>

            <div className="view-toggle" aria-label="Chọn kiểu hiển thị">
              <button
                className={viewMode === "grid" ? "is-active" : ""}
                type="button"
                onClick={() => setViewMode("grid")}
              >
                Grid
              </button>
              <button
                className={viewMode === "list" ? "is-active" : ""}
                type="button"
                onClick={() => setViewMode("list")}
              >
                List
              </button>
            </div>
          </div>

          <div className="books-layout">
            <aside className="filters-sidebar" aria-label="Bộ lọc sách">
              <div className="filters-header">
                <h2>Bộ lọc</h2>
                <button type="button" onClick={resetFilters}>
                  Xóa lọc
                </button>
              </div>

              {categoryOptions.length > 0 && (
                <fieldset className="filter-group">
                  <legend>Danh mục</legend>
                  {categoryOptions.map((category) => (
                    <label className="filter-option" key={category}>
                      <input
                        type="checkbox"
                        checked={selectedCategories.includes(category)}
                        onChange={() =>
                          setSelectedCategories((currentCategories) =>
                            toggleFilterValue(currentCategories, category),
                          )
                        }
                      />
                      <span>{category}</span>
                    </label>
                  ))}
                </fieldset>
              )}

              <fieldset className="filter-group">
                <legend>Đánh giá</legend>
                {ratingOptions.map((rating) => (
                  <label className="filter-option" key={rating.value}>
                    <input
                      type="radio"
                      name="rating"
                      value={rating.value}
                      checked={minimumRating === rating.value}
                      onChange={(event) => setMinimumRating(event.target.value)}
                    />
                    <span>{rating.label}</span>
                  </label>
                ))}
              </fieldset>

              {conditionOptions.length > 0 && (
                <fieldset className="filter-group">
                  <legend>Tình trạng</legend>
                  {conditionOptions.map((condition) => (
                    <label className="filter-option" key={condition}>
                      <input
                        type="checkbox"
                        checked={selectedConditions.includes(condition)}
                        onChange={() =>
                          setSelectedConditions((currentConditions) =>
                            toggleFilterValue(currentConditions, condition),
                          )
                        }
                      />
                      <span>{condition}</span>
                    </label>
                  ))}
                </fieldset>
              )}
            </aside>

            <section className="books-results-panel" aria-live="polite">
              <div className="results-summary">
                <strong>
                  {loading ? "Đang tải sách..." : `${filteredBooks.length} sách phù hợp`}
                </strong>
                <span>Dữ liệu từ Readora API</span>
              </div>

              {loading && (
                <div className="state-message" role="status">
                  Đang tải danh sách sách...
                </div>
              )}

              {error && (
                <div className="empty-state empty-state--inline" role="alert">
                  <p className="eyebrow">Không thể hiển thị</p>
                  <h2>Không tải được danh sách sách</h2>
                  <p>{error}</p>
                </div>
              )}

              {!loading && !error && filteredBooks.length > 0 && (
                <div className={`book-grid books-results books-results--${viewMode}`}>
                  {filteredBooks.map((book) => (
                    <BookCard key={book._id} book={book} />
                  ))}
                </div>
              )}

              {!loading && !error && filteredBooks.length === 0 && (
                <div className="empty-state empty-state--inline">
                  <p className="eyebrow">Không có kết quả</p>
                  <h2>Chưa tìm thấy sách phù hợp</h2>
                  <p>
                    Thử đổi từ khóa, bỏ bớt bộ lọc hoặc quay lại danh sách đầy đủ.
                  </p>
                  <button
                    className="button button--primary"
                    type="button"
                    onClick={resetFilters}
                  >
                    Xem tất cả sách
                  </button>
                </div>
              )}
            </section>
          </div>
        </div>
      </section>
    </Layout>
  );
}

export default BooksPage;
