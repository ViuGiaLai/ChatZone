export const runtime = "nodejs";
import { NextResponse } from "next/server"
import { getCurrentUser } from "@/lib/auth"
import { updateUserPresence } from "@/lib/chat"

export async function POST() {
  const user = await getCurrentUser()

  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  }

  await updateUserPresence(user.id, true)

  return NextResponse.json({ success: true })
}
