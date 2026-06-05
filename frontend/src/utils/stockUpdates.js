import { socket } from '../services/socket';

const toBookId = (book) => String(book?._id || book?.id || book?.bookId || '');

export const applyStockUpdatesToBooks = (books, updates = []) => {
  if (!Array.isArray(books) || !Array.isArray(updates) || updates.length === 0) {
    return books;
  }

  const updatesById = new Map(
    updates.map((update) => [String(update.bookId || update._id || update.id || ''), update]),
  );
  let hasChanged = false;

  const nextBooks = books.map((book) => {
    const update = updatesById.get(toBookId(book));

    if (!update) {
      return book;
    }

    hasChanged = true;
    return {
      ...book,
      stock: update.stock ?? book.stock,
      sold: update.sold ?? book.sold,
    };
  });

  return hasChanged ? nextBooks : books;
};

export const applyStockUpdatesToBook = (book, updates = []) => {
  if (!book || !Array.isArray(updates) || updates.length === 0) {
    return book;
  }

  const update = updates.find((item) => String(item.bookId || item._id || item.id || '') === toBookId(book));

  if (!update) {
    return book;
  }

  return {
    ...book,
    stock: update.stock ?? book.stock,
    sold: update.sold ?? book.sold,
  };
};

export const subscribeToStockUpdates = (handler) => {
  socket.connect();
  socket.on('books:stock-updated', handler);

  return () => {
    socket.off('books:stock-updated', handler);
  };
};
