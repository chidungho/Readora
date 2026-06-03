import { useEffect, useState } from "react";
import { ThemeContext } from "./themeStore";

function getInitialTheme() {
  const savedTheme = localStorage.getItem("readora-theme");

  if (savedTheme === "dark" || savedTheme === "light") {
    return savedTheme;
  }

  return "light";
}

export function ThemeProvider({ children }) {
  const [theme, setTheme] = useState(getInitialTheme);

  useEffect(() => {
    localStorage.setItem("readora-theme", theme);
    document.body.dataset.theme = theme;
    document.body.classList.toggle("theme-dark", theme === "dark");
  }, [theme]);

  const toggleTheme = () => {
    setTheme((currentTheme) => (currentTheme === "dark" ? "light" : "dark"));
  };

  return (
    <ThemeContext.Provider value={{ theme, toggleTheme }}>
      {children}
    </ThemeContext.Provider>
  );
}
