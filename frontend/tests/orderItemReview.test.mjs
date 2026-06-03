import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { test } from "node:test";

const source = readFileSync(
  new URL("../src/components/OrderItemReview.jsx", import.meta.url),
  "utf8",
);
const ordersPageSource = readFileSync(
  new URL("../src/pages/OrdersPage.jsx", import.meta.url),
  "utf8",
);

test("OrdersPage passes the order id to each item review control", () => {
  assert.match(source, /function OrderItemReview\(\{ bookId, orderId, orderStatus, onReviewComplete \}\)/);
  assert.match(ordersPageSource, /<OrderItemReview[\s\S]*orderId=\{order\._id\}/);
});

test("OrderItemReview never submits when the item is already reviewed", () => {
  const submitStart = source.indexOf("const handleSubmit = async");
  const createCall = source.indexOf("await createBookReview", submitStart);
  const skipLog = source.indexOf(
    'console.log("[review ui] review already exists, skip submit", bookId);',
    submitStart,
  );
  const submitLog = source.indexOf(
    'console.log("[review ui] submitting review", bookId);',
    submitStart,
  );

  assert.match(source, /const isReviewed = state === "reviewed";/);
  assert.ok(skipLog > submitStart, "reviewed-state skip log is missing");
  assert.ok(createCall > submitStart, "createBookReview call is missing");
  assert.ok(skipLog < createCall, "reviewed-state guard must run before createBookReview");
  assert.ok(submitLog > skipLog, "submit log must run after reviewed-state guard");
  assert.ok(submitLog < createCall, "submit log must run before createBookReview");
});

test("OrderItemReview submit handler never recursively submits", () => {
  const submitStart = source.indexOf("const handleSubmit = async");
  const submitEnd = source.indexOf("const handleCancel", submitStart);
  const submitBody = source.slice(submitStart, submitEnd);

  assert.ok(submitStart >= 0, "handleSubmit is missing");
  assert.ok(submitEnd > submitStart, "handleSubmit source boundary missing");
  assert.doesNotMatch(submitBody, /handleSubmit\(/);
});

test("OrderItemReview does not create reviews while rendering", () => {
  const cancelStart = source.indexOf("const handleCancel");
  const renderStart = source.indexOf("if (!canReviewOrder", cancelStart);
  const renderSource = source.slice(renderStart);

  assert.ok(cancelStart >= 0, "handleCancel is missing");
  assert.ok(renderStart >= 0, "render branch is missing");
  assert.doesNotMatch(renderSource, /createBookReview\(/);
});

test("OrderItemReview checks reviewed state by book and order", () => {
  assert.match(source, /const getEntityId = \(value\) =>/);
  assert.match(source, /getEntityId\(r\.order\) === orderId/);
});

test("OrderItemReview submits reviews with the current order id", () => {
  assert.match(source, /await createBookReview\(bookId, \{ rating, comment, orderId \}\);/);
});

test("OrderItemReview renders only the reviewed badge for reviewed items", () => {
  assert.match(
    source,
    /if \(isReviewed\) {\s+return <span className="order-review__badge">Đã đánh giá<\/span>;\s+}/,
  );
});

test("OrderItemReview treats duplicate review errors as reviewed state", () => {
  assert.match(source, /msg\.includes\("đánh giá sách này trong đơn hàng này"\)/);
  assert.match(source, /setState\("reviewed"\);/);
  assert.match(source, /setShowForm\(false\);/);
  assert.match(source, /setError\(""\);/);
});
