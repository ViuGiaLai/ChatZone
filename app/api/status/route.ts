// app/api/status/route.ts
import { NextResponse } from "next/server"
import { createClient } from "@/lib/auth"

export const runtime = "nodejs"

export async function GET() {
  try {
    // Kiểm tra biến môi trường Supabase có được cấu hình không
    const hasEnv =
      !!process.env.NEXT_PUBLIC_SUPABASE_URL &&
      !!process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY

    if (!hasEnv) {
      return NextResponse.json({
        configured: false,
        connected: false,
      })
    }

    const supabase = createClient()

    // Test kết nối database đơn giản
    const { error } = await supabase.from("profiles").select("id").limit(1)

    if (error) {
      console.error("Supabase error:", error)
      return NextResponse.json({
        configured: true,
        connected: false,
      })
    }

    return NextResponse.json({
      configured: true,
      connected: true,
    })
  } catch (error) {
    console.error("Database connection error:", error)
    return NextResponse.json(
      {
        configured: false,
        connected: false,
      },
      { status: 200 },
    )
  }
}