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
const BOOK_QUERY_KEYS = [
  "search",
  "category",
  "minPrice",
  "maxPrice",
  "rating",
  "sort",
  "page",
  "limit",
];

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

const appendQueryString = (endpoint, params = {}) => {
  const searchParams = new URLSearchParams();

  for (const [key, value] of Object.entries(params)) {
    if (value === undefined || value === null || value === "") {
      continue;
    }

    if (Array.isArray(value)) {
      for (const item of value) {
        if (item !== undefined && item !== null && item !== "") {
          searchParams.append(key, item);
        }
      }
      continue;
    }

    searchParams.set(key, value);
  }

  const queryString = searchParams.toString();

  return queryString ? `${endpoint}?${queryString}` : endpoint;
};

const extractBookRequestOptions = (options = {}) => {
  const params = { ...(options.params || {}) };
  const fetchOptions = { ...options };

  delete fetchOptions.params;

  for (const key of BOOK_QUERY_KEYS) {
    if (Object.prototype.hasOwnProperty.call(fetchOptions, key)) {
      params[key] = fetchOptions[key];
      delete fetchOptions[key];
    }
  }

  return { params, fetchOptions };
};

const normalizePagination = (pagination = {}) => ({
  page: toNumber(pagination.page, 1),
  limit: toNumber(pagination.limit, 12),
  total: toNumber(pagination.total, 0),
  totalPages: toNumber(pagination.totalPages, 0),
});

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

const requestPayload = async (endpoint, options = {}) => {
  const response = await fetch(`${baseURL}${endpoint}`, options);
  const payload = await response.json().catch(() => null);

  if (!response.ok || payload?.success === false) {
    throw new Error(payload?.message || DEFAULT_ERROR_MESSAGE);
  }

  return payload ?? {};
};

const request = async (endpoint, options = {}) => {
  const { auth, ...fetchOptions } = options;
  const payload = await requestPayload(
    endpoint,
    auth
      ? {
          ...fetchOptions,
          headers: getAuthHeaders(fetchOptions.headers),
        }
      : fetchOptions,
  );

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

const getAuthHeaders = (headers = {}) => {
  const token = getAuthToken();

  if (!token) {
    throw new Error("You are not logged in.");
  }

  return {
    ...headers,
    Authorization: `Bearer ${token}`,
  };
};

const requestWithAuth = (endpoint, options = {}) =>
  request(endpoint, {
    ...options,
    headers: getAuthHeaders(options.headers),
  });

const sendAdminJson = (endpoint, method, data) =>
  requestWithAuth(endpoint, {
    method,
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify(data),
  });

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
  const { books } = await getBooksPage(options);

  return books;
};

export const getBooksPage = async (options = {}) => {
  const { params, fetchOptions } = extractBookRequestOptions(options);
  const payload = await requestPayload(
    appendQueryString("/books", params),
    fetchOptions,
  );
  const books = Array.isArray(payload.data) ? payload.data.map(normalizeBook) : [];

  return {
    books,
    pagination: normalizePagination(payload.pagination),
  };
};

export const getBookById = async (id, options = {}) => {
  const data = await request(`/books/${id}`, options);

  return normalizeBook(data);
};

export const getCategories = async (options = {}) => {
  const data = await request("/categories", options);

  return Array.isArray(data) ? data.map(normalizeCategory) : [];
};

export const createOrder = async (data) =>
  request("/orders", {
    method: "POST",
    headers: getAuthHeaders({
      "Content-Type": "application/json",
    }),
    body: JSON.stringify(data),
  });

export const cancelOrder = async (id, reason = "") =>
  request(`/orders/${id}/cancel`, {
    method: "PATCH",
    headers: getAuthHeaders({
      "Content-Type": "application/json",
    }),
    body: JSON.stringify({
      cancelReason: reason,
    }),
  });

export const getMyOrders = async (options = {}) => {
  const data = await requestWithAuth("/orders/my", options);

  return Array.isArray(data) ? data : [];
};

export const getAdminBooks = async (options = {}) => {
  const data = await requestWithAuth("/admin/books", options);

  return Array.isArray(data) ? data.map(normalizeBook) : [];
};

export const createAdminBook = async (data) =>
  sendAdminJson("/admin/books", "POST", data);

export const updateAdminBook = async (id, data) =>
  sendAdminJson(`/admin/books/${id}`, "PUT", data);

export const deleteAdminBook = async (id) =>
  requestWithAuth(`/admin/books/${id}`, {
    method: "DELETE",
  });

export const getAdminOrders = async (options = {}) => {
  const data = await requestWithAuth("/admin/orders", options);

  return Array.isArray(data) ? data : [];
};

export const updateAdminOrderStatus = async (id, statusOrPayload) => {
  const payload =
    typeof statusOrPayload === "string" ? { status: statusOrPayload } : statusOrPayload;

  return sendAdminJson(`/admin/orders/${id}/status`, "PATCH", payload);
};

// Reviews
export const getBookReviews = async (bookId) => {
  const data = await request(`/books/${bookId}/reviews`);
  return Array.isArray(data) ? data : [];
};

export async function createBookReview(bookId, payload) {
  const token = localStorage.getItem("readora_token");

  const response = await fetch(`${baseURL}/books/${bookId}/reviews`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
    },
    body: JSON.stringify(payload),
  });

  const data = await response.json().catch(() => ({}));

  if (!response.ok) {
    throw new Error(data?.message || "Không gửi được đánh giá");
  }

  return data;
}
