import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // workspace 内部包以 TS 源码形式参与编译
  transpilePackages: ["@weavl/shared"],

  // 静态导出（SSG）：产物为纯 HTML/CSS/JS，可直接托管任意静态服务
  // 或打包进桌面应用（Electron/Tauri）——无 SSR 运行时依赖
  output: "export",

  // 资源前缀：
  // - dev 环境下用 "/"，避免浏览器在 /preset、/preset/detail 等嵌套路由下
  //   把相对路径 _next/... 解析成 /preset/_next/... 导致 404、样式丢失。
  // - build（静态导出）时用 "./"，保证 file:// 协议（桌面容器）下资源可正确解析。
  assetPrefix: process.env.NEXT_PUBLIC_ASSET_PREFIX ?? (process.env.NODE_ENV === "production" ? "./" : "/"),

  // 无自有图片域名场景，未启用 next/image 远程图；保留警告抑制
  images: {
    unoptimized: true,
  },
};

export default nextConfig;
