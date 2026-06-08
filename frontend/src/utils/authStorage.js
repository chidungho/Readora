export const getStoredAuth = () => {
  if (typeof window === "undefined") {
    return { token: null, user: null };
  }

  const token = window.localStorage.getItem("readora_token");
  const savedUser = window.localStorage.getItem("readora_user");

  if (!token || !savedUser) {
    return { token: null, user: null };
  }

  try {
    return { token, user: JSON.parse(savedUser) };
  } catch {
    window.localStorage.removeItem("readora_token");
    window.localStorage.removeItem("readora_user");
    return { token: null, user: null };
  }
};

export const clearStoredAuth = () => {
  window.localStorage.removeItem("readora_token");
  window.localStorage.removeItem("readora_user");
};
