import { NextResponse } from "next/server"
export const runtime = "nodejs";
import { getCurrentUser } from "@/lib/auth"
import { getUserNotifications, getUnreadNotificationCount } from "@/lib/chat"

export async function GET(request: Request) {
  try {
    const user = await getCurrentUser()
    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    const { searchParams } = new URL(request.url, process.env.NEXT_PUBLIC_BASE_URL || 'http://localhost:3000')
    const countOnly = searchParams.get("countOnly") === "true"

    if (countOnly) {
      const count = await getUnreadNotificationCount(user.id)
      return NextResponse.json({ count })
    } else {
      const notifications = await getUserNotifications(user.id)
      return NextResponse.json(Array.isArray(notifications) ? notifications : [])
    }
  } catch (error) {
    console.error(
      "Error getting notifications:",
      error instanceof Error ? error.message : "Unknown error",
      error instanceof Error && error.stack ? error.stack : "",
    )
    return NextResponse.json(
      { error: "Internal server error", details: error instanceof Error ? error.message : "Unknown error" },
      { status: 500 },
    )
  }
}
