export const CART_STORAGE_KEY = "readora_cart";
export const CART_UPDATED_EVENT = "readora_cart_updated";

const DEFAULT_BOOK_TITLE = "Sách đang cập nhật";
const DEFAULT_BOOK_AUTHOR = "Readora";

const hasLocalStorage = () =>
  typeof window !== "undefined" && Boolean(window.localStorage);

const toSafeQuantity = (quantity, fallback = 1) => {
  const nextQuantity = Number(quantity);

  if (!Number.isFinite(nextQuantity) || nextQuantity <= 0) {
    return fallback;
  }

  return Math.floor(nextQuantity);
};

const toSafePrice = (price) => {
  const nextPrice = Number(price);

  return Number.isFinite(nextPrice) && nextPrice > 0 ? nextPrice : 0;
};

const getBookId = (book) => book?._id || book?.id || "";

const normalizeCartItem = (item) => {
  const id = getBookId(item);

  if (!id) {
    return null;
  }

  return {
    id: String(id),
    title: item.title || DEFAULT_BOOK_TITLE,
    author: item.author || DEFAULT_BOOK_AUTHOR,
    price: toSafePrice(item.price),
    coverImage: item.coverImage || item.image || "",
    quantity: toSafeQuantity(item.quantity),
  };
};

const notifyCartUpdated = (cart) => {
  if (typeof window === "undefined" || typeof window.dispatchEvent !== "function") {
    return;
  }

  if (typeof window.CustomEvent === "function") {
    window.dispatchEvent(
      new window.CustomEvent(CART_UPDATED_EVENT, {
        detail: { cart },
      }),
    );
    return;
  }

  window.dispatchEvent({ type: CART_UPDATED_EVENT, detail: { cart } });
};

const saveCart = (cart) => {
  if (!hasLocalStorage()) {
    return cart;
  }

  window.localStorage.setItem(CART_STORAGE_KEY, JSON.stringify(cart));
  notifyCartUpdated(cart);

  return cart;
};

export const getCart = () => {
  if (!hasLocalStorage()) {
    return [];
  }

  try {
    const savedCart = JSON.parse(window.localStorage.getItem(CART_STORAGE_KEY));

    if (!Array.isArray(savedCart)) {
      return [];
    }

    return savedCart.map(normalizeCartItem).filter(Boolean);
  } catch {
    window.localStorage.removeItem(CART_STORAGE_KEY);
    return [];
  }
};

export const addToCart = (book, quantity = 1) => {
  const nextItem = normalizeCartItem({
    ...book,
    quantity,
  });

  if (!nextItem) {
    return getCart();
  }

  const cart = getCart();
  const existingItem = cart.find((item) => item.id === nextItem.id);

  if (existingItem) {
    existingItem.quantity += nextItem.quantity;
    return saveCart(cart);
  }

  return saveCart([...cart, nextItem]);
};

export const removeFromCart = (bookId) => {
  const cart = getCart().filter((item) => item.id !== String(bookId));

  return saveCart(cart);
};

export const updateCartItemQuantity = (bookId, quantity) => {
  const nextQuantity = Number(quantity);

  if (!Number.isFinite(nextQuantity) || nextQuantity <= 0) {
    return removeFromCart(bookId);
  }

  const cart = getCart().map((item) =>
    item.id === String(bookId)
      ? {
          ...item,
          quantity: toSafeQuantity(nextQuantity),
        }
      : item,
  );

  return saveCart(cart);
};

export const clearCart = () => {
  if (hasLocalStorage()) {
    window.localStorage.removeItem(CART_STORAGE_KEY);
  }

  notifyCartUpdated([]);

  return [];
};

export const getCartCount = () =>
  getCart().reduce((count, item) => count + item.quantity, 0);

export const getCartTotal = () =>
  getCart().reduce((total, item) => total + item.price * item.quantity, 0);
