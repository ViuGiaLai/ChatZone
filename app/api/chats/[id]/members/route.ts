export const runtime = "nodejs"
import { NextResponse } from "next/server"
import { getCurrentUser } from "@/lib/auth"
import { addMembersToChat } from "@/lib/chat"

export async function PATCH(request: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const user = await getCurrentUser()
    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    const { id: chatId } = await params
    const { members } = await request.json()

    if (!Array.isArray(members) || members.length === 0) {
      return NextResponse.json({ error: "Members array is required" }, { status: 400 })
    }

    const result = await addMembersToChat(chatId, members, user.id)

    if (!result.success) {
      return NextResponse.json({ error: result.message }, { status: 400 })
    }

    return NextResponse.json(result)
  } catch (error) {
    console.error("Error adding members:", error)
    return NextResponse.json({ error: "Internal server error" }, { status: 500 })
  }
}
