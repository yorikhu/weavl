import { redirect } from "next/navigation";

/** 根路由 → /home（首页实际载体） */
export default function RootPage() {
  redirect("/home");
}
