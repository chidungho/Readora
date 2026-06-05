import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { test } from "node:test";

import { normalizeBook, normalizeCategoryNames } from "../src/services/api.js";

test("normalizeCategoryNames splits comma and spaced dash categories case-insensitively", () => {
  assert.deepEqual(normalizeCategoryNames("Tâm lý học, Kỹ năng sống"), [
    "Tâm lý học",
    "Kỹ năng sống",
  ]);
  assert.deepEqual(normalizeCategoryNames("Tâm lý học - Kỹ năng sống"), [
    "Tâm lý học",
    "Kỹ năng sống",
  ]);
  assert.deepEqual(normalizeCategoryNames([" Tâm lý học ", "tâm lý học", "Kỹ năng sống"]), [
    "Tâm lý học",
    "Kỹ năng sống",
  ]);
  assert.deepEqual(normalizeCategoryNames("Thiếu-nhi"), ["Thiếu-nhi"]);
});

test("normalizeBook preserves multiple categories for card and detail displays", () => {
  const book = normalizeBook({
    _id: "book-1",
    title: "Demo",
    categories: ["Tâm lý học", "Kỹ năng sống"],
  });

  assert.deepEqual(book.categories, ["Tâm lý học", "Kỹ năng sống"]);
  assert.equal(book.category, "Tâm lý học");
});

test("BookCard displays multiple categories joined by spaced dash", async () => {
  const source = await readFile(new URL("../src/components/BookCard.jsx", import.meta.url), "utf8");

  assert.match(source, /book\.categories\?\.join\(" - "\) \|\| book\.category/);
});

test("AdminBooksPage submit sends category and categories array", async () => {
  const source = await readFile(new URL("../src/pages/AdminBooksPage.jsx", import.meta.url), "utf8");

  assert.match(source, /const categories = normalizeCategoryNames\(form\.category\);/);
  assert.match(source, /category: categories\[0\] \|\| ""/);
  assert.match(source, /categories,/);
});

test("AdminBooksPage author input preserves Vietnamese composition", async () => {
  const source = await readFile(new URL("../src/pages/AdminBooksPage.jsx", import.meta.url), "utf8");
  const authorStart = source.indexOf('name="author"');
  const authorEnd = source.indexOf('placeholder="Robert C. Martin"', authorStart);
  const authorInput = source.slice(authorStart, authorEnd);

  assert.ok(authorStart >= 0, "author input is missing");
  assert.match(authorInput, /value=\{form\.author\}/);
  assert.match(authorInput, /onChange=\{handleFormChange\}/);
  assert.match(authorInput, /onCompositionStart=\{handleCompositionStart\}/);
  assert.match(authorInput, /onCompositionEnd=\{handleCompositionEnd\}/);
  assert.doesNotMatch(authorInput, /trim\(|normalize/);
  assert.match(source, /updateFormField\(event\.currentTarget\.name, event\.currentTarget\.value\)/);
});

test("AdminBooksPage fetches high-limit admin books and counts pagination total", async () => {
  const source = await readFile(new URL("../src/pages/AdminBooksPage.jsx", import.meta.url), "utf8");

  assert.match(source, /getAdminBooksPage\(\{ signal: controller\.signal \}\)/);
  assert.match(source, /setBooksTotal\(pagination\?\.totalItems \?\? pagination\?\.total \?\? nextBooks\.length\)/);
  assert.match(source, /<h2>\{booksTotal\} sách<\/h2>/);
});
