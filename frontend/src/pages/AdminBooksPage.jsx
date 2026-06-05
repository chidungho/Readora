import { useEffect, useRef, useState } from "react";
import {
  API_ORIGIN,
  createAdminBook,
  deleteAdminBook,
  FALLBACK_COVER_IMAGE,
  getAdminBooks,
  updateAdminBook,
  uploadBookCover,
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
    return "Đang cập nhật";
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
  const [coverMode, setCoverMode] = useState("url");
  const [uploadingCover, setUploadingCover] = useState(false);
  const [coverError, setCoverError] = useState("");
  const [cameraStream, setCameraStream] = useState(null);
  const [cameraMessage, setCameraMessage] = useState("");
  const [editingBookId, setEditingBookId] = useState("");
  const [loading, setLoading] = useState(true);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");
  const videoRef = useRef(null);

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
          setError(booksError.message || "Không thể tải sách.");
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

  useEffect(
    () => () => {
      cameraStream?.getTracks().forEach((track) => track.stop());
    },
    [cameraStream],
  );

  const handleFormChange = (event) => {
    const { name, value } = event.target;

    setForm((currentForm) => ({
      ...currentForm,
      [name]: value,
    }));
  };

  const stopCamera = () => {
    cameraStream?.getTracks().forEach((track) => track.stop());
    setCameraStream(null);
    setCameraMessage("");
  };

  const handleCoverModeChange = (mode) => {
    setCoverMode(mode);
    setCoverError("");
    setCameraMessage("");

    if (mode === "camera") {
      startCamera();
      return;
    }

    stopCamera();
  };

  const handleUploadCover = async (file) => {
    if (!file) {
      return;
    }

    console.log("[cover upload] selected file", {
      name: file.name,
      type: file.type,
      size: file.size,
    });

    if (!file.type.startsWith("image/")) {
      setCoverError("Chỉ nhận file ảnh.");
      return "";
    }

    if (file.size > 5 * 1024 * 1024) {
      setCoverError("Ảnh bìa không được vượt quá 5MB.");
      return "";
    }

    setUploadingCover(true);
    setCoverError("");

    try {
      const response = await uploadBookCover(file);
      console.log("[cover upload] response", response);
      const finalUrl = response.url.startsWith("http")
        ? response.url
        : `${API_ORIGIN}${response.url}`;

      setForm((currentForm) => ({
        ...currentForm,
        coverImage: finalUrl,
      }));
      setCoverError("");
      setMessage("Đã tải ảnh bìa lên.");
      return finalUrl;
    } catch (uploadError) {
      setCoverError(uploadError.message || "Không thể tải ảnh bìa lên.");
      return "";
    } finally {
      setUploadingCover(false);
    }
  };

  const handleCoverFileChange = async (event) => {
    const file = event.target.files?.[0];
    if (!file) return;
    await handleUploadCover(file);
    event.target.value = "";
  };

  const startCamera = async () => {
    console.log("[camera] starting");
    setCoverError("");
    setCameraMessage("");

    if (!navigator.mediaDevices?.getUserMedia) {
      setCameraMessage("Thiết bị không hỗ trợ camera.");
      return;
    }

    try {
      stopCamera();
      let stream;

      try {
        stream = await navigator.mediaDevices.getUserMedia({
          video: { facingMode: "environment" },
        });
      } catch (environmentError) {
        console.log("[camera] error", environmentError);
        stream = await navigator.mediaDevices.getUserMedia({ video: true });
      }

      setCameraStream(stream);
      const video = videoRef.current;

      if (video) {
        video.srcObject = stream;
        video.muted = true;
        video.playsInline = true;
        video.autoplay = true;
        await video.play().catch(() => {});
      }
    } catch (cameraError) {
      console.log("[camera] error", cameraError);
      setCameraMessage(cameraError.message || "Không thể mở camera.");
    }
  };

  const handleCaptureCover = () => {
    console.log("[camera] capture clicked");
    const video = videoRef.current;

    if (!video || !video.videoWidth) {
      setCoverError("Camera chưa sẵn sàng, vui lòng thử lại.");
      return;
    }

    const canvas = document.createElement("canvas");
    canvas.width = video.videoWidth;
    canvas.height = video.videoHeight;
    const ctx = canvas.getContext("2d");
    ctx.drawImage(video, 0, 0, canvas.width, canvas.height);

    canvas.toBlob(async (blob) => {
      console.log("[camera] blob created", blob && { type: blob.type, size: blob.size });

      if (!blob) {
        setCoverError("Không chụp được ảnh.");
        return;
      }

      const file = new File([blob], `book-cover-${Date.now()}.jpg`, { type: "image/jpeg" });
      const uploadedUrl = await handleUploadCover(file);
      console.log("[camera] uploaded", uploadedUrl);
      stopCamera();
    }, "image/jpeg", 0.9);
  };

  const resetForm = () => {
    stopCamera();
    setForm(emptyForm);
    setEditingBookId("");
    setCoverMode("url");
    setCoverError("");
  };

  const handleEditBook = (book) => {
    setEditingBookId(book._id);
    setMessage("");
    setError("");
    setCoverError("");
    setCoverMode("url");
    stopCamera();
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
        setMessage("Đã cập nhật sách.");
      } else {
        await createAdminBook(payload);
        setMessage("Đã thêm sách mới.");
      }

      resetForm();
      await loadBooks();
    } catch (submitError) {
      setError(submitError.message || "Không thể lưu sách.");
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleDeleteBook = async (book) => {
    const confirmed = window.confirm(`Xóa sách "${book.title}"?`);

    if (!confirmed) {
      return;
    }

    setMessage("");
    setError("");

    try {
      await deleteAdminBook(book._id);
      await loadBooks();
      setMessage("Đã xóa sách.");
    } catch (deleteError) {
      setError(deleteError.message || "Không thể xóa sách.");
    }
  };

  return (
    <section className="admin-page fade-up">
      <div className="admin-page__header">
        <div>
          <p className="eyebrow">SÁCH</p>
          <h1>Quản lý sách</h1>
          <p>Thêm, sửa và xóa sách. Ảnh bìa có thể dùng URL, tải lên hoặc chụp trực tiếp.</p>
        </div>
      </div>

      {message && <p className="cart-feedback">{message}</p>}
      {error && <p className="state-message state-message--error">{error}</p>}

      <div className="admin-books-layout">
        <form className="admin-form" onSubmit={handleSubmit}>
          <div>
            <p className="eyebrow">{editingBookId ? "Đang sửa" : "SÁCH MỚI"}</p>
            <h2>{editingBookId ? "Cập nhật sách" : "Thêm sách"}</h2>
          </div>

          <label className="form-group">
            Tên sách
            <input
              name="title"
              value={form.title}
              onChange={handleFormChange}
              placeholder="Clean Code"
              required
            />
          </label>

          <label className="form-group">
            Tác giả
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
              Danh mục
              <input
                name="category"
                value={form.category}
                onChange={handleFormChange}
                placeholder="Công nghệ"
                required
              />
            </label>

            <label className="form-group">
              Tồn kho
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
              Giá
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
              Giá gốc
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

          <div className="form-group admin-cover-field">
            <span>Ảnh bìa</span>
            <div className="admin-cover-tabs" role="tablist" aria-label="Chọn nguồn ảnh bìa">
              {[
                ["url", "URL"],
                ["upload", "Tải ảnh lên"],
                ["camera", "Chụp ảnh"],
              ].map(([mode, label]) => (
                <button
                  className={`button ${coverMode === mode ? "button--primary" : "button--secondary"}`}
                  key={mode}
                  type="button"
                  onClick={() => handleCoverModeChange(mode)}
                >
                  {label}
                </button>
              ))}
            </div>

            {coverMode === "url" && (
              <input
                name="coverImage"
                type="url"
                value={form.coverImage}
                onChange={handleFormChange}
                placeholder="https://example.com/book.jpg"
              />
            )}

            {coverMode === "upload" && (
              <div className="admin-cover-actions">
                <input
                  type="file"
                  accept="image/jpeg,image/png,image/webp"
                  onChange={handleCoverFileChange}
                />
                {uploadingCover && <p className="state-message">Đang tải ảnh bìa...</p>}
              </div>
            )}

            {coverMode === "camera" && (
              <div className="admin-cover-actions">
                {!cameraStream && (
                  <button className="button button--secondary" type="button" onClick={startCamera}>
                    Mở camera
                  </button>
                )}
                {cameraMessage && <p className="state-message state-message--error">{cameraMessage}</p>}
                {cameraStream && (
                  <>
                    <video className="admin-cover-video" ref={videoRef} autoPlay muted playsInline />
                    <div className="admin-form__actions">
                      <button
                        className="button button--primary"
                        disabled={uploadingCover}
                        type="button"
                        onClick={handleCaptureCover}
                      >
                        Chụp ảnh
                      </button>
                      <button className="button button--secondary" type="button" onClick={stopCamera}>
                        Tắt camera
                      </button>
                    </div>
                  </>
                )}
              </div>
            )}

            {coverError && <p className="state-message state-message--error">{coverError}</p>}
            {form.coverImage && (
              <div className="admin-cover-preview">
                <img
                  src={form.coverImage}
                  alt="Preview ảnh bìa"
                  onError={(event) => {
                    event.currentTarget.onerror = null;
                    event.currentTarget.src = FALLBACK_COVER_IMAGE;
                  }}
                />
              </div>
            )}
          </div>

          <label className="form-group">
            Mô tả
            <textarea
              name="description"
              value={form.description}
              onChange={handleFormChange}
              placeholder="Mô tả ngắn về sách"
              rows="4"
            />
          </label>

          <div className="admin-form__actions">
            <button className="button button--primary" disabled={isSubmitting} type="submit">
              {isSubmitting ? "Đang lưu..." : editingBookId ? "Cập nhật sách" : "Lưu sách"}
            </button>
            {editingBookId && (
              <button className="button button--secondary" type="button" onClick={resetForm}>
                Hủy
              </button>
            )}
          </div>
        </form>

        <section className="admin-panel">
          <div className="admin-panel__header">
            <div>
              <p className="eyebrow">DANH SÁCH</p>
              <h2>{books.length} sách</h2>
            </div>
          </div>

          {loading && <p className="state-message">Đang tải sách...</p>}
          {!loading && books.length === 0 && (
            <p className="state-message">Chưa có sách nào trong hệ thống.</p>
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
                    <span>Tồn kho: {book.stock}</span>
                  </div>
                  <div className="admin-row-actions">
                    <button
                      className="button button--secondary"
                      type="button"
                      onClick={() => handleEditBook(book)}
                    >
                      Sửa
                    </button>
                    <button
                      className="button button--danger"
                      type="button"
                      onClick={() => handleDeleteBook(book)}
                    >
                      Xóa
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
