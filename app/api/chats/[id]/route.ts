export const runtime = "nodejs";
import { NextResponse } from "next/server"
import { getCurrentUser } from "@/lib/auth"
import { supabase } from "@/lib/db"

export async function GET(request: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const user = await getCurrentUser()
    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    const { id: chatId } = await params
    const { data: chat, error } = await supabase
      .from('chats')
      .select('*')
      .eq('id', chatId)
      .single()

    if (error || !chat) {
      return NextResponse.json({ error: "Chat not found" }, { status: 404 })
    }

    // Check if user is a member
    const members = chat.members || []
    if (!members.includes(user.id)) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 403 })
    }

    return NextResponse.json({
      id: chat.id,
      name: chat.name,
      isGroup: chat.is_group,
      createdBy: chat.created_by,
      members: chat.members,
      createdAt: chat.created_at ? new Date(chat.created_at).getTime() : Date.now(),
      lastMessage: chat.last_message ? {
        id: chat.last_message.id,
        content: chat.last_message.content,
        senderId: chat.last_message.senderId || chat.last_message.sender_id,
        senderName: chat.last_message.senderName || chat.last_message.sender_name,
        chatId: chat.last_message.chatId || chat.last_message.chat_id,
        timestamp: chat.last_message.timestamp,
        edited: chat.last_message.edited,
        deleted: chat.last_message.deleted,
        fileUrl: chat.last_message.fileUrl || chat.last_message.file_url,
        fileName: chat.last_message.fileName || chat.last_message.file_name,
        readBy: chat.last_message.readBy || chat.last_message.read_by,
      } : undefined,
      theme: chat.theme,
      icon: chat.icon,
    })
  } catch (error) {
    console.error("Error fetching chat:", error)
    return NextResponse.json({ error: "Internal server error" }, { status: 500 })
  }
}
