import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { beforeEach, test } from "node:test";

import * as api from "../src/services/api.js";

const apiSource = readFileSync(
  new URL("../src/services/api.js", import.meta.url),
  "utf8",
);

const createLocalStorage = () => {
  const store = new Map();

  return {
    getItem(key) {
      return store.has(key) ? store.get(key) : null;
    },
    removeItem(key) {
      store.delete(key);
    },
    setItem(key, value) {
      store.set(key, String(value));
    },
  };
};

beforeEach(() => {
  const localStorage = createLocalStorage();

  global.localStorage = localStorage;
  global.window = { localStorage };
});

test("getBooksPage sends query params and returns books with pagination", async () => {
  let receivedUrl;
  let receivedOptions;

  global.fetch = async (url, options = {}) => {
    receivedUrl = url;
    receivedOptions = options;

    return {
      ok: true,
      async json() {
        return {
          success: true,
          data: [
            {
              _id: "book-1",
              title: "Clean Code",
              author: "Robert C. Martin",
              price: "120000",
            },
          ],
          pagination: {
            page: 2,
            limit: 10,
            total: 21,
            totalPages: 3,
          },
        };
      },
    };
  };

  const result = await api.getBooksPage({
    search: "clean code",
    category: "Cong nghe",
    minPrice: 50000,
    maxPrice: "200000",
    rating: "4.5",
    sort: "rating",
    page: 2,
    limit: 10,
    signal: "signal-token",
  });
  const url = new URL(receivedUrl);

  assert.equal(url.pathname, "/api/books");
  assert.equal(url.searchParams.get("search"), "clean code");
  assert.equal(url.searchParams.get("category"), "Cong nghe");
  assert.equal(url.searchParams.get("minPrice"), "50000");
  assert.equal(url.searchParams.get("maxPrice"), "200000");
  assert.equal(url.searchParams.get("rating"), "4.5");
  assert.equal(url.searchParams.get("sort"), "rating");
  assert.equal(url.searchParams.get("page"), "2");
  assert.equal(url.searchParams.get("limit"), "10");
  assert.equal(receivedOptions.signal, "signal-token");
  assert.equal(result.books[0]._id, "book-1");
  assert.equal(result.books[0].price, 120000);
  assert.deepEqual(result.pagination, {
    page: 2,
    limit: 10,
    total: 21,
    totalPages: 3,
  });
});

test("createOrder posts cart data with the saved auth token", async () => {
  localStorage.setItem("readora_token", "token-123");
  let receivedUrl;
  let receivedOptions;

  global.fetch = async (url, options) => {
    receivedUrl = url;
    receivedOptions = options;

    return {
      ok: true,
      async json() {
        return {
          success: true,
          data: { _id: "order-1", totalAmount: 240000 },
        };
      },
    };
  };

  const orderData = {
    items: [{ id: "book-1", title: "Clean Code", price: 120000, quantity: 2 }],
    shippingAddress: {
      fullName: "Nguyen Van A",
      phone: "0909123456",
      address: "12 Nguyen Trai",
      city: "Ha Noi",
    },
  };
  const order = await api.createOrder(orderData);

  assert.equal(receivedUrl, `${api.baseURL}/orders`);
  assert.equal(receivedOptions.method, "POST");
  assert.equal(receivedOptions.headers.Authorization, "Bearer token-123");
  assert.equal(receivedOptions.headers["Content-Type"], "application/json");
  assert.deepEqual(JSON.parse(receivedOptions.body), orderData);
  assert.deepEqual(order, { _id: "order-1", totalAmount: 240000 });
});

test("getMyOrders fetches order history with the saved auth token", async () => {
  localStorage.setItem("readora_token", "token-456");
  let receivedUrl;
  let receivedOptions;

  global.fetch = async (url, options) => {
    receivedUrl = url;
    receivedOptions = options;

    return {
      ok: true,
      async json() {
        return {
          success: true,
          data: [{ _id: "order-1", status: "pending" }],
        };
      },
    };
  };

  const orders = await api.getMyOrders();

  assert.equal(receivedUrl, `${api.baseURL}/orders/my`);
  assert.equal(receivedOptions.headers.Authorization, "Bearer token-456");
  assert.deepEqual(orders, [{ _id: "order-1", status: "pending" }]);
});

test("createBookReview posts review data with the selected order id", async () => {
  localStorage.setItem("readora_token", "token-review");
  let receivedUrl;
  let receivedOptions;

  global.fetch = async (url, options) => {
    receivedUrl = url;
    receivedOptions = options;

    return {
      ok: true,
      async json() {
        return {
          success: true,
          data: {
            _id: "review-1",
            book: "book-1",
            order: "order-1",
            rating: 5,
          },
        };
      },
    };
  };

  const review = await api.createBookReview("book-1", {
    rating: 5,
    comment: "Hay",
    orderId: "order-1",
  });

  assert.equal(receivedUrl, `${api.baseURL}/books/book-1/reviews`);
  assert.equal(receivedOptions.method, "POST");
  assert.equal(receivedOptions.headers.Authorization, "Bearer token-review");
  assert.equal(receivedOptions.headers["Content-Type"], "application/json");
  assert.deepEqual(JSON.parse(receivedOptions.body), {
    rating: 5,
    comment: "Hay",
    orderId: "order-1",
  });
  assert.deepEqual(review, {
    _id: "review-1",
    book: "book-1",
    order: "order-1",
    rating: 5,
  });
});

test("createBookReview uses request with auth and never calls itself", () => {
  const createMatch = apiSource.match(
    /export async function createBookReview\(bookId, payload\) \{[\s\S]*?\n\}/,
  );

  assert.ok(createMatch, "createBookReview must be an exported async function");
  assert.equal(
    (createMatch[0].match(/createBookReview/g) || []).length,
    1,
    "createBookReview must not call itself",
  );
  assert.match(
    createMatch[0],
    /return request\(`\/books\/\$\{bookId\}\/reviews`, \{[\s\S]*method: "POST"[\s\S]*body: JSON\.stringify\(payload\)[\s\S]*auth: true[\s\S]*\}\);/,
  );
});

test("getBookReviews calls request directly and never calls itself", () => {
  const getReviewsStart = apiSource.indexOf("getBookReviews");
  const getReviewsEnd = apiSource.indexOf("createBookReview", getReviewsStart);
  const getReviewsSource = apiSource.slice(getReviewsStart, getReviewsEnd);

  assert.notEqual(getReviewsStart, -1, "getBookReviews must exist");
  assert.ok(getReviewsEnd > getReviewsStart, "getBookReviews source boundary missing");
  assert.equal(
    (getReviewsSource.match(/getBookReviews/g) || []).length,
    1,
    "getBookReviews must not call itself",
  );
  assert.match(getReviewsSource, /request\(`\/books\/\$\{bookId\}\/reviews`\)/);
});

test("order API helpers require a saved auth token", async () => {
  await assert.rejects(
    () => api.createOrder({ items: [], shippingAddress: {} }),
    /You are not logged in/,
  );

  await assert.rejects(() => api.getMyOrders(), /You are not logged in/);
  await assert.rejects(
    () => api.createBookReview("book-1", { rating: 5, comment: "", orderId: "order-1" }),
    /You are not logged in/,
  );
});

test("admin book helpers call admin book endpoints with the saved auth token", async () => {
  localStorage.setItem("readora_token", "admin-token");
  const calls = [];

  global.fetch = async (url, options = {}) => {
    calls.push({ url, options });

    return {
      ok: true,
      async json() {
        return {
          success: true,
          data: url.endsWith("/admin/books")
            ? [{ _id: "book-1", title: "Admin Book", price: 100000 }]
            : { _id: "book-1", title: "Admin Book", price: 100000 },
        };
      },
    };
  };

  const books = await api.getAdminBooks();
  await api.createAdminBook({ title: "Admin Book" });
  await api.updateAdminBook("book-1", { title: "Updated Book" });
  await api.deleteAdminBook("book-1");

  assert.equal(calls[0].url, `${api.baseURL}/admin/books`);
  assert.equal(calls[0].options.headers.Authorization, "Bearer admin-token");
  assert.equal(books[0].title, "Admin Book");

  assert.equal(calls[1].url, `${api.baseURL}/admin/books`);
  assert.equal(calls[1].options.method, "POST");
  assert.equal(calls[1].options.headers.Authorization, "Bearer admin-token");
  assert.deepEqual(JSON.parse(calls[1].options.body), { title: "Admin Book" });

  assert.equal(calls[2].url, `${api.baseURL}/admin/books/book-1`);
  assert.equal(calls[2].options.method, "PUT");
  assert.deepEqual(JSON.parse(calls[2].options.body), { title: "Updated Book" });

  assert.equal(calls[3].url, `${api.baseURL}/admin/books/book-1`);
  assert.equal(calls[3].options.method, "DELETE");
});

test("admin order helpers list orders and update status with the saved auth token", async () => {
  localStorage.setItem("readora_token", "admin-token");
  const calls = [];

  global.fetch = async (url, options = {}) => {
    calls.push({ url, options });

    return {
      ok: true,
      async json() {
        return {
          success: true,
          data: url.endsWith("/status")
            ? { _id: "order-1", status: "shipped" }
            : [{ _id: "order-1", status: "pending" }],
        };
      },
    };
  };

  const orders = await api.getAdminOrders();
  const updatedOrder = await api.updateAdminOrderStatus("order-1", "shipped");

  assert.equal(calls[0].url, `${api.baseURL}/admin/orders`);
  assert.equal(calls[0].options.headers.Authorization, "Bearer admin-token");
  assert.deepEqual(orders, [{ _id: "order-1", status: "pending" }]);

  assert.equal(calls[1].url, `${api.baseURL}/admin/orders/order-1/status`);
  assert.equal(calls[1].options.method, "PATCH");
  assert.equal(calls[1].options.headers.Authorization, "Bearer admin-token");
  assert.deepEqual(JSON.parse(calls[1].options.body), { status: "shipped" });
  assert.deepEqual(updatedOrder, { _id: "order-1", status: "shipped" });
});
