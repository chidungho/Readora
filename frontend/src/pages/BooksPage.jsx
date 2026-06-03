import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useSearchParams } from "react-router-dom";
import BookCard from "../components/BookCard";
import Layout from "../layouts/Layout";
import { getBooksPage, getCategories } from "../services/api";
import {
  buildBooksQueryParams,
  parseBooksQuery,
} from "../utils/booksQuery";

const PAGE_SIZE = 9;

const defaultPagination = {
  page: 1,
  limit: PAGE_SIZE,
  total: 0,
  totalPages: 0,
};

const ratingOptions = [
  { label: "Tất cả đánh giá", value: "0" },
  { label: "Từ 4 sao", value: "4" },
  { label: "Từ 4.5 sao", value: "4.5" },
  { label: "Từ 4.8 sao", value: "4.8" },
];

const sortOptions = [
  { label: "Phổ biến", value: "popular" },
  { label: "Đánh giá cao", value: "rating" },
  { label: "Giá thấp đến cao", value: "price_asc" },
  { label: "Giá cao đến thấp", value: "price_desc" },
  { label: "Mới nhất", value: "newest" },
];

function BooksPage() {
  const [searchParams, setSearchParams] = useSearchParams();
  const booksQuery = useMemo(
    () => parseBooksQuery(searchParams),
    [searchParams],
  );
  const {
    search: queryFromUrl,
    category: selectedCategory,
    rating: minimumRating,
    minPrice,
    maxPrice,
    sort: sortBy,
    page,
  } = booksQuery;
  const [books, setBooks] = useState([]);
  const [categories, setCategories] = useState([]);
  const [searchInput, setSearchInput] = useState(queryFromUrl);
  const [isSearchComposing, setIsSearchComposing] = useState(false);
  const [viewMode, setViewMode] = useState("grid");
  const [pagination, setPagination] = useState(defaultPagination);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const skipSearchInputSyncRef = useRef(false);
  const isSearchComposingRef = useRef(false);

  useEffect(() => {
    const controller = new AbortController();
    let isActive = true;

    const loadCategories = async () => {
      try {
        const nextCategories = await getCategories({ signal: controller.signal });

        if (isActive) {
          setCategories(nextCategories);
        }
      } catch (fetchError) {
        if (fetchError.name !== "AbortError" && isActive) {
          setCategories([]);
        }
      }
    };

    loadCategories();

    return () => {
      isActive = false;
      controller.abort();
    };
  }, []);

  useEffect(() => {
    const controller = new AbortController();
    let isActive = true;

    const loadBooks = async () => {
      setLoading(true);
      setError("");

      try {
        const result = await getBooksPage({
          search: queryFromUrl.trim(),
          category: selectedCategory,
          minPrice,
          maxPrice,
          rating: minimumRating === "0" ? "" : minimumRating,
          sort: sortBy,
          page,
          limit: PAGE_SIZE,
          signal: controller.signal,
        });

        if (isActive) {
          setBooks(result.books);
          setPagination(result.pagination);
        }
      } catch (fetchError) {
        if (fetchError.name !== "AbortError" && isActive) {
          setBooks([]);
          setPagination(defaultPagination);
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
  }, [
    maxPrice,
    minPrice,
    minimumRating,
    page,
    queryFromUrl,
    selectedCategory,
    sortBy,
  ]);

  const categoryOptions = useMemo(() => {
    const apiCategories = categories
      .map((category) => category.name)
      .filter(Boolean);
    const fallbackCategories = books.map((book) => book.category).filter(Boolean);

    return [...new Set([...apiCategories, ...fallbackCategories])];
  }, [books, categories]);

  const categoryHighlights = useMemo(
    () =>
      categoryOptions.map((category) => {
        const apiCategory = categories.find((item) => item.name === category);
        const apiCount = Number(apiCategory?.bookCount);

        return {
          name: category,
          count: Number.isFinite(apiCount) && apiCount > 0 ? apiCount : 0,
        };
      }),
    [categories, categoryOptions],
  );

  const applyBooksQuery = useCallback(
    (updates, options = {}) => {
      const nextSearchParams = buildBooksQueryParams(
        searchParams,
        updates,
        options,
      );

      if (nextSearchParams.toString() === searchParams.toString()) {
        return;
      }

      if (Object.prototype.hasOwnProperty.call(updates, "search")) {
        skipSearchInputSyncRef.current = true;
      }

      setSearchParams(nextSearchParams, {
        replace: options.replace ?? false,
      });
    },
    [searchParams, setSearchParams],
  );

  useEffect(() => {
    if (skipSearchInputSyncRef.current) {
      skipSearchInputSyncRef.current = false;
      return;
    }

    if (!isSearchComposingRef.current) {
      setSearchInput(queryFromUrl);
    }
  }, [queryFromUrl]);

  useEffect(() => {
    if (isSearchComposing) {
      return undefined;
    }

    const debounceTimer = window.setTimeout(() => {
      applyBooksQuery(
        {
          search: searchInput,
        },
        {
          replace: true,
        },
      );
    }, 400);

    return () => {
      window.clearTimeout(debounceTimer);
    };
  }, [applyBooksQuery, isSearchComposing, searchInput]);

  const handleSearchSubmit = (event) => {
    event.preventDefault();
    applyBooksQuery({ search: searchInput });
  };

  const handleSearchCompositionStart = () => {
    isSearchComposingRef.current = true;
    setIsSearchComposing(true);
  };

  const handleSearchCompositionEnd = (event) => {
    isSearchComposingRef.current = false;
    setIsSearchComposing(false);
    setSearchInput(event.currentTarget.value);
  };

  const updateSelectedCategory = (value) => {
    applyBooksQuery({ category: value });
  };

  const updateMinimumRating = (value) => {
    applyBooksQuery({ rating: value });
  };

  const updateMinPrice = (value) => {
    applyBooksQuery({ minPrice: value });
  };

  const updateMaxPrice = (value) => {
    applyBooksQuery({ maxPrice: value });
  };

  const updateSort = (value) => {
    applyBooksQuery({ sort: value });
  };

  const updatePage = (value) => {
    applyBooksQuery({ page: value }, { resetPage: false });
  };

  const resetFilters = () => {
    skipSearchInputSyncRef.current = true;
    setSearchInput("");
    setSearchParams(new URLSearchParams());
  };

  const totalPages = Math.max(pagination.totalPages, 1);
  const currentPage = Math.min(page, totalPages);
  const canGoPrevious = currentPage > 1 && !loading;
  const canGoNext = currentPage < totalPages && !loading;

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
                    className={`category-chip${
                      selectedCategory === category.name ? " is-active" : ""
                    }`}
                    key={category.name}
                    type="button"
                    onClick={() => updateSelectedCategory(category.name)}
                  >
                    <span>{category.name}</span>
                    <strong>
                      {category.count > 0 ? `${category.count} sách` : "Xem sách"}
                    </strong>
                  </button>
                ))}
              </div>
            </section>
          )}

          <div className="books-toolbar">
            <form className="books-search" onSubmit={handleSearchSubmit}>
              <span>Tìm sách</span>
              <input
                type="search"
                aria-label="Tìm sách"
                value={searchInput}
                onChange={(event) => setSearchInput(event.target.value)}
                onCompositionStart={handleSearchCompositionStart}
                onCompositionEnd={handleSearchCompositionEnd}
                placeholder="Nhập tên sách hoặc tác giả..."
              />
            </form>

            <label className="sort-control">
              <span>Sắp xếp</span>
              <select
                value={sortBy}
                onChange={(event) => updateSort(event.target.value)}
              >
                {sortOptions.map((option) => (
                  <option key={option.value} value={option.value}>
                    {option.label}
                  </option>
                ))}
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
                  <label className="filter-option">
                    <input
                      type="radio"
                      name="category"
                      checked={selectedCategory === ""}
                      onChange={() => updateSelectedCategory("")}
                    />
                    <span>Tất cả danh mục</span>
                  </label>
                  {categoryOptions.map((category) => (
                    <label className="filter-option" key={category}>
                      <input
                        type="radio"
                        name="category"
                        checked={selectedCategory === category}
                        onChange={() => updateSelectedCategory(category)}
                      />
                      <span>{category}</span>
                    </label>
                  ))}
                </fieldset>
              )}

              <fieldset className="filter-group">
                <legend>Khoảng giá</legend>
                <div className="price-filter-grid">
                  <label>
                    <span>Từ</span>
                    <input
                      type="number"
                      min="0"
                      step="1000"
                      value={minPrice}
                      onChange={(event) => updateMinPrice(event.target.value)}
                      placeholder="0"
                    />
                  </label>
                  <label>
                    <span>Đến</span>
                    <input
                      type="number"
                      min="0"
                      step="1000"
                      value={maxPrice}
                      onChange={(event) => updateMaxPrice(event.target.value)}
                      placeholder="200000"
                    />
                  </label>
                </div>
              </fieldset>

              <fieldset className="filter-group">
                <legend>Đánh giá</legend>
                {ratingOptions.map((rating) => (
                  <label className="filter-option" key={rating.value}>
                    <input
                      type="radio"
                      name="rating"
                      value={rating.value}
                      checked={minimumRating === rating.value}
                      onChange={(event) => updateMinimumRating(event.target.value)}
                    />
                    <span>{rating.label}</span>
                  </label>
                ))}
              </fieldset>
            </aside>

            <section
              className="books-results-panel"
              aria-busy={loading}
              aria-live="polite"
            >
              <div className="results-summary">
                <strong>
                  {loading
                    ? "Đang tải sách..."
                    : `${pagination.total} sách phù hợp`}
                </strong>
                <span>
                  Trang {currentPage} / {totalPages}
                </span>
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

              {!loading && !error && books.length > 0 && (
                <>
                  <div className={`book-grid books-results books-results--${viewMode}`}>
                    {books.map((book) => (
                      <BookCard key={book._id} book={book} viewMode={viewMode} />
                    ))}
                  </div>

                  <nav className="books-pagination" aria-label="Phân trang sách">
                    <button
                      className="button button--secondary"
                      type="button"
                      onClick={() => updatePage(Math.max(1, currentPage - 1))}
                      disabled={!canGoPrevious}
                    >
                      Trước
                    </button>
                    <span className="pagination-status">
                      Trang {currentPage} / {totalPages}
                    </span>
                    <button
                      className="button button--secondary"
                      type="button"
                      onClick={() => updatePage(currentPage + 1)}
                      disabled={!canGoNext}
                    >
                      Sau
                    </button>
                  </nav>
                </>
              )}

              {!loading && !error && books.length === 0 && (
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
