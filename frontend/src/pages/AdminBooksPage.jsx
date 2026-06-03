import { useEffect, useState } from "react";
import {
  createAdminBook,
  deleteAdminBook,
  FALLBACK_COVER_IMAGE,
  getAdminBooks,
  updateAdminBook,
} from "../services/api";

const emptyForm = {
  title: "",
  author: "",
  category: "",
  price: "",
  originalPrice: "",
  stock: "",
  coverImage: "",
  description: "",
};

const formatCurrency = (value) => {
  const number = Number(value);

  if (!Number.isFinite(number)) {
    return "Dang cap nhat";
  }

  return new Intl.NumberFormat("vi-VN", {
    style: "currency",
    currency: "VND",
  }).format(number);
};

const toNumber = (value, fallback = 0) => {
  const number = Number(value);

  return Number.isFinite(number) ? number : fallback;
};

function AdminBooksPage() {
  const [books, setBooks] = useState([]);
  const [form, setForm] = useState(emptyForm);
  const [editingBookId, setEditingBookId] = useState("");
  const [loading, setLoading] = useState(true);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");

  const loadBooks = async (options = {}) => {
    const nextBooks = await getAdminBooks(options);
    setBooks(nextBooks);
  };

  useEffect(() => {
    const controller = new AbortController();
    let isActive = true;

    const loadInitialBooks = async () => {
      try {
        const nextBooks = await getAdminBooks({ signal: controller.signal });

        if (isActive) {
          setBooks(nextBooks);
        }
      } catch (booksError) {
        if (booksError.name !== "AbortError" && isActive) {
          setError(booksError.message || "Khong the tai sach.");
        }
      } finally {
        if (isActive) {
          setLoading(false);
        }
      }
    };

    loadInitialBooks();

    return () => {
      isActive = false;
      controller.abort();
    };
  }, []);

  const handleFormChange = (event) => {
    const { name, value } = event.target;

    setForm((currentForm) => ({
      ...currentForm,
      [name]: value,
    }));
  };

  const resetForm = () => {
    setForm(emptyForm);
    setEditingBookId("");
  };

  const handleEditBook = (book) => {
    setEditingBookId(book._id);
    setMessage("");
    setError("");
    setForm({
      title: book.title || "",
      author: book.author || "",
      category: book.category || "",
      price: book.price ?? "",
      originalPrice: book.originalPrice ?? "",
      stock: book.stock ?? "",
      coverImage: book.coverImage || "",
      description: book.description || "",
    });
  };

  const handleSubmit = async (event) => {
    event.preventDefault();
    setIsSubmitting(true);
    setMessage("");
    setError("");

    const coverImage = form.coverImage.trim();
    const payload = {
      title: form.title.trim(),
      author: form.author.trim(),
      category: form.category.trim(),
      description: form.description.trim(),
      price: toNumber(form.price),
      originalPrice: form.originalPrice === "" ? undefined : toNumber(form.originalPrice),
      stock: toNumber(form.stock),
      coverImage,
      image: coverImage,
    };

    try {
      if (editingBookId) {
        await updateAdminBook(editingBookId, payload);
        setMessage("Da cap nhat sach.");
      } else {
        await createAdminBook(payload);
        setMessage("Da them sach moi.");
      }

      resetForm();
      await loadBooks();
    } catch (submitError) {
      setError(submitError.message || "Khong the luu sach.");
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleDeleteBook = async (book) => {
    const confirmed = window.confirm(`Xoa sach "${book.title}"?`);

    if (!confirmed) {
      return;
    }

    setMessage("");
    setError("");

    try {
      await deleteAdminBook(book._id);
      await loadBooks();
      setMessage("Da xoa sach.");
    } catch (deleteError) {
      setError(deleteError.message || "Khong the xoa sach.");
    }
  };

  return (
    <section className="admin-page fade-up">
      <div className="admin-page__header">
        <div>
          <p className="eyebrow">Books</p>
          <h1>Quan ly sach</h1>
          <p>Them, sua va xoa sach. Cover image nhap bang URL, khong upload file.</p>
        </div>
      </div>

      {message && <p className="cart-feedback">{message}</p>}
      {error && <p className="state-message state-message--error">{error}</p>}

      <div className="admin-books-layout">
        <form className="admin-form" onSubmit={handleSubmit}>
          <div>
            <p className="eyebrow">{editingBookId ? "Dang sua" : "Sach moi"}</p>
            <h2>{editingBookId ? "Sua sach" : "Them sach"}</h2>
          </div>

          <label className="form-group">
            Ten sach
            <input
              name="title"
              value={form.title}
              onChange={handleFormChange}
              placeholder="Clean Code"
              required
            />
          </label>

          <label className="form-group">
            Tac gia
            <input
              name="author"
              value={form.author}
              onChange={handleFormChange}
              placeholder="Robert C. Martin"
              required
            />
          </label>

          <div className="admin-form__grid">
            <label className="form-group">
              Danh muc
              <input
                name="category"
                value={form.category}
                onChange={handleFormChange}
                placeholder="Cong nghe"
                required
              />
            </label>

            <label className="form-group">
              Ton kho
              <input
                min="0"
                name="stock"
                type="number"
                value={form.stock}
                onChange={handleFormChange}
                placeholder="20"
              />
            </label>
          </div>

          <div className="admin-form__grid">
            <label className="form-group">
              Gia
              <input
                min="0"
                name="price"
                type="number"
                value={form.price}
                onChange={handleFormChange}
                placeholder="120000"
                required
              />
            </label>

            <label className="form-group">
              Gia goc
              <input
                min="0"
                name="originalPrice"
                type="number"
                value={form.originalPrice}
                onChange={handleFormChange}
                placeholder="150000"
              />
            </label>
          </div>

          <label className="form-group">
            Cover image URL
            <input
              name="coverImage"
              type="url"
              value={form.coverImage}
              onChange={handleFormChange}
              placeholder="https://example.com/book.jpg"
            />
          </label>

          <label className="form-group">
            Mo ta
            <textarea
              name="description"
              value={form.description}
              onChange={handleFormChange}
              placeholder="Mo ta ngan ve sach"
              rows="4"
            />
          </label>

          <div className="admin-form__actions">
            <button className="button button--primary" disabled={isSubmitting} type="submit">
              {isSubmitting ? "Dang luu..." : editingBookId ? "Luu thay doi" : "Them sach"}
            </button>
            {editingBookId && (
              <button className="button button--secondary" type="button" onClick={resetForm}>
                Huy sua
              </button>
            )}
          </div>
        </form>

        <section className="admin-panel">
          <div className="admin-panel__header">
            <div>
              <p className="eyebrow">Danh sach</p>
              <h2>{books.length} sach</h2>
            </div>
          </div>

          {loading && <p className="state-message">Dang tai sach...</p>}
          {!loading && books.length === 0 && (
            <p className="state-message">Chua co sach nao trong he thong.</p>
          )}

          {!loading && books.length > 0 && (
            <div className="admin-book-list">
              {books.map((book) => (
                <article className="admin-book-row" key={book._id}>
                  <img
                    src={book.coverImage || FALLBACK_COVER_IMAGE}
                    alt={book.title}
                    onError={(event) => {
                      event.currentTarget.onerror = null;
                      event.currentTarget.src = FALLBACK_COVER_IMAGE;
                    }}
                  />
                  <div>
                    <h3>{book.title}</h3>
                    <p>{book.author}</p>
                    <span>{book.category}</span>
                  </div>
                  <div className="admin-book-row__meta">
                    <strong>{formatCurrency(book.price)}</strong>
                    <span>Stock: {book.stock}</span>
                  </div>
                  <div className="admin-row-actions">
                    <button
                      className="button button--secondary"
                      type="button"
                      onClick={() => handleEditBook(book)}
                    >
                      Sua
                    </button>
                    <button
                      className="button button--danger"
                      type="button"
                      onClick={() => handleDeleteBook(book)}
                    >
                      Xoa
                    </button>
                  </div>
                </article>
              ))}
            </div>
          )}
        </section>
      </div>
    </section>
  );
}

export default AdminBooksPage;
