import { redirect } from "next/navigation"

export default function DashboardRedirectPage() {
  // Trong app này không có trang dashboard riêng, điều hướng về chat chính
  redirect("/chat")
}


