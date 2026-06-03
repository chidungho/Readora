import assert from "node:assert/strict";
import { test } from "node:test";

import {
  buildBooksQueryParams,
  parseBooksQuery,
} from "../src/utils/booksQuery.js";

test("parseBooksQuery reads canonical search params and legacy q fallback", () => {
  const canonical = parseBooksQuery(
    new URLSearchParams(
      "search=t%C6%B0%20duy%20s%E1%BB%91ng&category=K%C4%A9%20n%C4%83ng&rating=4.5&minPrice=50000&maxPrice=200000&sort=rating&page=3",
    ),
  );

  assert.deepEqual(canonical, {
    search: "tư duy sống",
    category: "Kĩ năng",
    rating: "4.5",
    minPrice: "50000",
    maxPrice: "200000",
    sort: "rating",
    page: 3,
  });

  const legacy = parseBooksQuery(new URLSearchParams("q=%C4%90%E1%BA%AFc%20Nh%C3%A2n%20T%C3%A2m"));

  assert.equal(legacy.search, "Đắc Nhân Tâm");
});

test("buildBooksQueryParams trims only when committing query params and resets page", () => {
  const params = buildBooksQueryParams(
    new URLSearchParams("search=old&page=4&sort=rating"),
    {
      search: "  tư duy sống  ",
    },
  );

  assert.equal(params.get("search"), "tư duy sống");
  assert.equal(params.get("sort"), "rating");
  assert.equal(params.has("page"), false);
});

test("buildBooksQueryParams syncs filters, sort, and pagination in the URL", () => {
  const filtered = buildBooksQueryParams(
    new URLSearchParams("q=%C4%90%E1%BA%AFc%20Nh%C3%A2n%20T%C3%A2m&page=5"),
    {
      category: "Kĩ năng sống",
      sort: "price_asc",
      rating: "4",
      minPrice: "10000",
      maxPrice: "150000",
    },
  );

  assert.equal(filtered.get("search"), "Đắc Nhân Tâm");
  assert.equal(filtered.has("q"), false);
  assert.equal(filtered.get("category"), "Kĩ năng sống");
  assert.equal(filtered.get("sort"), "price_asc");
  assert.equal(filtered.get("rating"), "4");
  assert.equal(filtered.get("minPrice"), "10000");
  assert.equal(filtered.get("maxPrice"), "150000");
  assert.equal(filtered.has("page"), false);

  const paged = buildBooksQueryParams(filtered, { page: 2 }, { resetPage: false });

  assert.equal(paged.get("page"), "2");
});
