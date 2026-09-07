import type { Metadata } from "next";
import { ThemeProvider } from "@/provider/ThemeProvider";
import { ToastHost } from "@/components/ToastHost";
import "@/styles/globals.scss";

export const metadata: Metadata = {
  title: "织光 · Weavl",
  description:
    "AIGC content production studio. Every template is a declarative, model-agnostic workflow pack.",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="zh-CN" className="dark" suppressHydrationWarning>
      <body>
        <ThemeProvider>
          {children}
          <ToastHost />
        </ThemeProvider>
      </body>
    </html>
  );
}
