"use client";

import { createContext, useCallback, useContext, useLayoutEffect, useState, type ReactNode } from "react";

type Theme = "light" | "dark";

const ThemeContext = createContext<{
  theme: Theme;
  toggle: () => void;
}>({ theme: "dark", toggle: () => {} });

/**
 * 提供明暗主题切换，并将用户选择持久化到 localStorage。
 *
 * @param props - 应用子树。
 * @returns 默认使用暗色主题的主题上下文。
 */
export function ThemeProvider({ children }: { children: ReactNode }) {
  const [theme, setTheme] = useState<Theme>("dark");

  useLayoutEffect(() => {
    setTheme(document.documentElement.classList.contains("dark") ? "dark" : "light");
  }, []);

  const toggle = useCallback(() => {
    const nextTheme = document.documentElement.classList.contains("dark") ? "light" : "dark";
    document.documentElement.classList.toggle("dark", nextTheme === "dark");
    try {
      localStorage.setItem("weavl-theme", nextTheme);
    } catch {
      // 隐私模式禁用存储时，当前页面仍可正常切换主题。
    }
    setTheme(nextTheme);
  }, []);

  return <ThemeContext.Provider value={{ theme, toggle }}>{children}</ThemeContext.Provider>;
}

/**
 * 读取当前主题及切换操作。
 *
 * @returns 主题上下文。
 */
export function useTheme() {
  return useContext(ThemeContext);
}
