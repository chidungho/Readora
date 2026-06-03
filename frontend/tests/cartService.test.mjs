import assert from "node:assert/strict";
import { beforeEach, test } from "node:test";

import {
  addToCart,
  clearCart,
  getCart,
  getCartCount,
  getCartTotal,
  removeFromCart,
  updateCartItemQuantity,
} from "../src/services/cartService.js";

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

const book = {
  _id: "book-1",
  title: "Clean Code",
  author: "Robert C. Martin",
  price: 120000,
  coverImage: "/clean-code.jpg",
};

beforeEach(() => {
  global.window = {
    dispatchEvent() {},
    localStorage: createLocalStorage(),
  };
  global.localStorage = global.window.localStorage;
});

test("addToCart saves a new book and increases quantity when the book already exists", () => {
  addToCart(book);
  const cart = addToCart(book, 2);

  assert.equal(cart.length, 1);
  assert.equal(cart[0].id, "book-1");
  assert.equal(cart[0].quantity, 3);
  assert.equal(getCartCount(), 3);
});

test("updateCartItemQuantity changes item quantity and removes items at zero", () => {
  addToCart(book, 2);

  let cart = updateCartItemQuantity("book-1", 5);
  assert.equal(cart[0].quantity, 5);
  assert.equal(getCartCount(), 5);

  cart = updateCartItemQuantity("book-1", 0);
  assert.deepEqual(cart, []);
});

test("removeFromCart deletes one book and getCartTotal sums price by quantity", () => {
  addToCart(book, 2);
  addToCart(
    {
      id: "book-2",
      title: "Refactoring",
      author: "Martin Fowler",
      price: 90000,
    },
    1,
  );

  assert.equal(getCartTotal(), 330000);

  const cart = removeFromCart("book-1");
  assert.equal(cart.length, 1);
  assert.equal(cart[0].id, "book-2");
  assert.equal(getCartTotal(), 90000);
});

test("clearCart empties localStorage cart", () => {
  addToCart(book, 1);

  const cart = clearCart();

  assert.deepEqual(cart, []);
  assert.deepEqual(getCart(), []);
});
