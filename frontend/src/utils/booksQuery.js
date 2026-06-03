export const BOOKS_QUERY_DEFAULTS = {
  search: "",
  category: "",
  rating: "0",
  minPrice: "",
  maxPrice: "",
  sort: "popular",
  page: 1,
};

const toSearchParams = (source = "") => new URLSearchParams(source);

const hasOwn = (object, key) =>
  Object.prototype.hasOwnProperty.call(object, key);

const parsePositivePage = (value) => {
  const page = Number(value);

  return Number.isInteger(page) && page > 0
    ? page
    : BOOKS_QUERY_DEFAULTS.page;
};

const setTextParam = (params, key, value) => {
  const nextValue = String(value ?? "").trim();

  if (nextValue) {
    params.set(key, nextValue);
  } else {
    params.delete(key);
  }
};

const setDefaultParam = (params, key, value, defaultValue) => {
  const nextValue = String(value ?? "").trim();

  if (nextValue && nextValue !== defaultValue) {
    params.set(key, nextValue);
  } else {
    params.delete(key);
  }
};

export const parseBooksQuery = (source = "") => {
  const params = toSearchParams(source);

  return {
    search:
      params.get("search") ??
      params.get("q") ??
      BOOKS_QUERY_DEFAULTS.search,
    category: params.get("category") ?? BOOKS_QUERY_DEFAULTS.category,
    rating: params.get("rating") ?? BOOKS_QUERY_DEFAULTS.rating,
    minPrice: params.get("minPrice") ?? BOOKS_QUERY_DEFAULTS.minPrice,
    maxPrice: params.get("maxPrice") ?? BOOKS_QUERY_DEFAULTS.maxPrice,
    sort: params.get("sort") ?? BOOKS_QUERY_DEFAULTS.sort,
    page: parsePositivePage(params.get("page")),
  };
};

export const buildBooksQueryParams = (
  currentParams = "",
  updates = {},
  options = {},
) => {
  const nextParams = toSearchParams(currentParams);
  const shouldResetPage = options.resetPage ?? true;
  const currentSearch = nextParams.get("search") ?? nextParams.get("q") ?? "";

  nextParams.delete("q");
  setTextParam(nextParams, "search", currentSearch);

  if (hasOwn(updates, "search")) {
    setTextParam(nextParams, "search", updates.search);
  }

  if (hasOwn(updates, "category")) {
    setTextParam(nextParams, "category", updates.category);
  }

  if (hasOwn(updates, "rating")) {
    setDefaultParam(
      nextParams,
      "rating",
      updates.rating,
      BOOKS_QUERY_DEFAULTS.rating,
    );
  }

  if (hasOwn(updates, "minPrice")) {
    setTextParam(nextParams, "minPrice", updates.minPrice);
  }

  if (hasOwn(updates, "maxPrice")) {
    setTextParam(nextParams, "maxPrice", updates.maxPrice);
  }

  if (hasOwn(updates, "sort")) {
    setDefaultParam(
      nextParams,
      "sort",
      updates.sort,
      BOOKS_QUERY_DEFAULTS.sort,
    );
  }

  if (shouldResetPage) {
    nextParams.delete("page");
  } else if (hasOwn(updates, "page")) {
    const nextPage = parsePositivePage(updates.page);

    if (nextPage > 1) {
      nextParams.set("page", String(nextPage));
    } else {
      nextParams.delete("page");
    }
  }

  return nextParams;
};
