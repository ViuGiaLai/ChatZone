export const runtime = "nodejs";
import { NextResponse } from "next/server"
import { getCurrentUser } from "@/lib/auth"
import { getMessages } from "@/lib/chat"
import { supabase } from "@/lib/db"

export async function GET(request: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const user = await getCurrentUser()
    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    const { id: chatId } = await params

    const { data: chat, error: chatError } = await supabase
      .from('chats')
      .select('members')
      .eq('id', chatId)
      .single()

    if (chatError || !chat) {
      return NextResponse.json({ error: "Chat not found" }, { status: 404 })
    }

    const members = chat.members || []
    if (!members.includes(user.id)) {
      return NextResponse.json({ error: "Unauthorized: Not a member of this chat" }, { status: 403 })
    }

    const messages = await getMessages(chatId)
    return NextResponse.json(messages)
  } catch (error) {
    console.error(
      "Error fetching messages:",
      error instanceof Error ? error.message : "Unknown error",
    )
    return NextResponse.json({ error: "Internal server error" }, { status: 500 })
  }
}
