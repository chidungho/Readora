export const baseURL = "http://localhost:5000/api";

const fallbackCoverSvg = `
  <svg xmlns="http://www.w3.org/2000/svg" width="400" height="600" viewBox="0 0 400 600">
    <rect width="400" height="600" rx="24" fill="#9A3412"/>
    <rect x="38" y="38" width="324" height="524" rx="18" fill="none" stroke="rgba(255,255,255,0.44)" stroke-width="4"/>
    <text x="50%" y="47%" text-anchor="middle" fill="#FFFDFC" font-family="Georgia, serif" font-size="48" font-weight="700">Readora</text>
    <text x="50%" y="56%" text-anchor="middle" fill="rgba(255,255,255,0.82)" font-family="Arial, sans-serif" font-size="20">Book cover</text>
  </svg>
`;

export const FALLBACK_COVER_IMAGE = `data:image/svg+xml;utf8,${encodeURIComponent(
  fallbackCoverSvg,
)}`;

const DEFAULT_ERROR_MESSAGE = "Không thể tải dữ liệu từ Readora API.";

const toNumber = (value, fallback = 0) => {
  if (value === null || value === undefined || value === "") {
    return fallback;
  }

  const number = Number(value);

  return Number.isFinite(number) ? number : fallback;
};

const normalizeCategoryName = (category) => {
  if (!category) {
    return "";
  }

  if (typeof category === "string") {
    return category;
  }

  return category.name || category.title || category.slug || "";
};

const createSlug = (value) =>
  value
    .toLocaleLowerCase("vi-VN")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/(^-|-$)/g, "");

export const normalizeBook = (book = {}) => {
  const id = book._id || book.id || "";
  const category = normalizeCategoryName(book.category) || "Chưa phân loại";
  const coverImage = book.coverImage || book.image || FALLBACK_COVER_IMAGE;

  return {
    ...book,
    _id: id,
    id,
    title: book.title || "Sách đang cập nhật",
    author: book.author || "Readora",
    description:
      book.description || "Mô tả sách đang được Readora cập nhật.",
    category,
    price: toNumber(book.price, null),
    originalPrice: toNumber(book.originalPrice, null),
    stock: toNumber(book.stock, 0),
    coverImage,
    image: coverImage,
    rating: toNumber(book.rating, 0),
    sold: toNumber(book.sold, 0),
    reviewCount: toNumber(book.reviewCount ?? book.reviewsCount, 0),
    isFeatured: Boolean(book.isFeatured ?? book.featured ?? false),
    condition: book.condition || "",
    publishedAt: book.publishedAt || book.createdAt || "",
    createdAt: book.createdAt || book.publishedAt || "",
  };
};

export const normalizeCategory = (category = {}) => {
  if (typeof category === "string") {
    return {
      _id: category,
      name: category,
      slug: createSlug(category),
      bookCount: 0,
    };
  }

  const name = category.name || category.title || category.slug || "";

  return {
    ...category,
    _id: category._id || category.id || category.slug || name,
    name,
    slug: category.slug || createSlug(name),
    bookCount: toNumber(category.bookCount, 0),
  };
};

const request = async (endpoint, options = {}) => {
  const response = await fetch(`${baseURL}${endpoint}`, options);
  const payload = await response.json().catch(() => null);

  if (!response.ok || payload?.success === false) {
    throw new Error(payload?.message || DEFAULT_ERROR_MESSAGE);
  }

  return payload?.data ?? payload;
};

const postJson = async (endpoint, data) =>
  request(endpoint, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify(data),
  });

const getAuthToken = () => localStorage.getItem("readora_token");

export const registerUser = async (data) => postJson("/auth/register", data);

export const loginUser = async (data) => postJson("/auth/login", data);

export const getProfile = async () => {
  const token = getAuthToken();

  if (!token) {
    throw new Error("You are not logged in.");
  }

  return request("/auth/profile", {
    headers: {
      Authorization: `Bearer ${token}`,
    },
  });
};

export const getBooks = async (options = {}) => {
  const data = await request("/books", options);

  return Array.isArray(data) ? data.map(normalizeBook) : [];
};

export const getBookById = async (id, options = {}) => {
  const data = await request(`/books/${id}`, options);

  return normalizeBook(data);
};

export const getCategories = async (options = {}) => {
  const data = await request("/categories", options);

  return Array.isArray(data) ? data.map(normalizeCategory) : [];
};
