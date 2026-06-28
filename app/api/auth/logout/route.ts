export const runtime = "nodejs";
import { NextResponse } from "next/server"
import { logoutUser, getCurrentUser } from "@/lib/auth"
import { updateUserPresence } from "@/lib/chat"

export async function POST() {
  try {
    const user = await getCurrentUser()

    if (user) {
      // Set user as offline
      try {
        await updateUserPresence(user.id, false)
      } catch (error) {
        console.error("Error updating user presence:", error)
        // Continue even if presence update fails
      }
    }

    await logoutUser()

    return NextResponse.json({ success: true })
  } catch (error) {
    console.error("Logout error:", error)
    return NextResponse.json({ error: "Failed to logout" }, { status: 500 })
  }
}
