export const runtime = "nodejs";
import { NextResponse } from "next/server"
import { supabase } from "@/lib/db"

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url, process.env.NEXT_PUBLIC_BASE_URL || 'http://localhost:3000')
    const username = searchParams.get("username")

    if (!username) {
      return NextResponse.json({ error: "Username is required" }, { status: 400 })
    }

    const { data } = await supabase
      .from('profiles')
      .select('id')
      .eq('username', username)
      .maybeSingle()

    return NextResponse.json({ exists: !!data })
  } catch (error) {
    console.error("Error checking username:", error)
    return NextResponse.json({ error: "Internal server error" }, { status: 500 })
  }
}
