"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";

/**
 * 根路由 → /home
 * 静态导出模式下无服务端，用客户端跳转（挂载即重定向）。
 */
export default function RootPage() {
  const router = useRouter();

  useEffect(() => {
    router.replace("/home");
  }, [router]);

  return null;
}
