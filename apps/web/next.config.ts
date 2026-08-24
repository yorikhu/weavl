import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // workspace 内部包以 TS 源码形式参与编译
  transpilePackages: ["@loom/shared"],
};

export default nextConfig;
