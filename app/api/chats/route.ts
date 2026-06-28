export const runtime = "nodejs";
import { NextResponse } from "next/server"
import { getCurrentUser } from "@/lib/auth"
import { createChat, getUserChats, getUnreadCounts } from "@/lib/chat"

export async function GET() {
  try {
    const user = await getCurrentUser()
    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    const [chats, unreadCounts] = await Promise.all([
      getUserChats(user.id),
      getUnreadCounts(user.id),
    ])
    return NextResponse.json({ chats, unreadCounts })
  } catch (error) {
    console.error("Error fetching chats:", error)
    return NextResponse.json({ error: "Internal server error" }, { status: 500 })
  }
}

export async function POST(request: Request) {
  try {
    const user = await getCurrentUser()
    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    // Parse request body
    let name, isGroup, members
    try {
      const body = await request.json()
      name = body.name?.trim()
      isGroup = Boolean(body.isGroup)
      members = Array.isArray(body.members) ? body.members.filter(Boolean) : []
    } catch (error) {
      console.error("Error parsing request body:", error)
      return NextResponse.json({ error: "Invalid request body" }, { status: 400 })
    }

    // Validate request data
    if (!name) {
      return NextResponse.json({ error: "Chat name is required" }, { status: 400 })
    }

    if (isGroup && members.length < 1) {
      return NextResponse.json({ error: "At least one member is required for a group chat" }, { status: 400 })
    }

    // Create the chat
    const chat = await createChat(name, isGroup, user.id, members)
    
    if (!chat) {
      return NextResponse.json({ error: "Failed to create chat" }, { status: 500 })
    }

    return NextResponse.json(chat, { status: 201 })
  } catch (error) {
    console.error("Error creating chat:", error)
    const errorMessage = error instanceof Error ? error.message : "Internal server error"
    return NextResponse.json({ error: errorMessage }, { status: 500 })
  }
}
