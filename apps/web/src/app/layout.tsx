import type { Metadata } from "next";
import { ThemeProvider } from "@/provider/ThemeProvider";
import { AuthProvider } from "@/provider/AuthProvider";
import { AccountProvider } from "@/provider/AccountProvider";
import { ToastHost } from "@/components/ToastHost";
import "@/styles/globals.scss";

export const metadata: Metadata = {
  title: "Weavl · 织光拾忆",
  description: "AIGC content production studio. Every template is a declarative, model-agnostic workflow pack.",
};

// 静态导出无法从服务端读取本地偏好；在正文绘制前同步根节点的主题。
const themeBootstrap = `try{document.documentElement.classList.toggle("dark",localStorage.getItem("weavl-theme")!=="light")}catch{document.documentElement.classList.add("dark")}`;

/**
 * 配置应用 HTML、Provider 和全局浮层。
 *
 * @param props - 组件属性。
 * @returns 应用根布局。
 */
export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="zh-CN" className="dark" suppressHydrationWarning>
      <head>
        <script dangerouslySetInnerHTML={{ __html: themeBootstrap }} />
      </head>
      <body>
        <ThemeProvider>
          <AuthProvider>
            <AccountProvider>
              {children}
              <ToastHost />
            </AccountProvider>
          </AuthProvider>
        </ThemeProvider>
      </body>
    </html>
  );
}
