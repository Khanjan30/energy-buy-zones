"use client";
import { useEffect, useState } from "react";

export default function ThemeToggle() {
  const [theme, setTheme] = useState(null);
  useEffect(() => setTheme(document.documentElement.getAttribute("data-theme") || "light"), []);
  function flip() {
    const next = theme === "dark" ? "light" : "dark";
    document.documentElement.setAttribute("data-theme", next);
    try { localStorage.setItem("theme", next); } catch {}
    setTheme(next);
  }
  return (
    <button className="btn sm" onClick={flip} aria-label="Switch between light and dark mode">
      {theme === "dark" ? "Light mode" : "Dark mode"}
    </button>
  );
}
