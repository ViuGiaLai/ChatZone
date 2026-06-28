export const runtime = "nodejs";
import { NextResponse } from "next/server"
import { getCurrentUser } from "@/lib/auth"
import { getUnreadCounts } from "@/lib/chat"

export async function GET() {
  try {
    const user = await getCurrentUser()
    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    const counts = await getUnreadCounts(user.id)
    return NextResponse.json(counts)
  } catch (error) {
    console.error("Error fetching unread counts:", error)
    return NextResponse.json({ error: "Internal server error" }, { status: 500 })
  }
}
