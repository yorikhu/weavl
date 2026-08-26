import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // workspace 内部包以 TS 源码形式参与编译
  transpilePackages: ["@weavl/shared"],

  // 静态导出（SSG）：产物为纯 HTML/CSS/JS，可直接托管任意静态服务
  // 或打包进桌面应用（Electron/Tauri）——无 SSR 运行时依赖
  output: "export",

  // 相对资源路径：file:// 协议（桌面容器）下资源可正确解析
  assetPrefix: "./",

  // 无自有图片域名场景，未启用 next/image 远程图；保留警告抑制
  images: {
    unoptimized: true,
  },
};

export default nextConfig;
