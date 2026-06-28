export const runtime = "nodejs";
import { NextResponse } from "next/server"
import { getCurrentUser } from "@/lib/auth"
import { sendMessage } from "@/lib/chat"
import { supabase } from "@/lib/db"

export async function POST(request: Request) {
  try {
    const user = await getCurrentUser()
    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    let content, chatId, fileUrl, fileName
    try {
      const body = await request.json()
      content = body.content
      chatId = body.chatId
      fileUrl = body.fileUrl
      fileName = body.fileName
    } catch (error) {
      return NextResponse.json({ error: "Invalid request body" }, { status: 400 })
    }

    if ((!content || content.trim() === "") && !fileUrl) {
      return NextResponse.json({ error: "Content or file is required" }, { status: 400 })
    }

    if (!chatId) {
      return NextResponse.json({ error: "ChatId is required" }, { status: 400 })
    }

    // Verify the chat exists and user is a member
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
      return NextResponse.json({ error: "Unauthorized" }, { status: 403 })
    }

    const message = await sendMessage(content || "", chatId, user.id, user.username, fileUrl, fileName)
    return NextResponse.json(message)
  } catch (error) {
    console.error("Error sending message:", error instanceof Error ? error.message : "Unknown error")
    return NextResponse.json({ error: "Internal server error" }, { status: 500 })
  }
}
