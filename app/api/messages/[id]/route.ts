export const runtime = "nodejs";
import { NextResponse } from "next/server"
import { getCurrentUser } from "@/lib/auth"
import { editMessage, deleteMessage, markMessageAsRead } from "@/lib/chat"

export async function PUT(request: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const user = await getCurrentUser()
    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    const { id: messageId } = await params
    const { content, chatId } = await request.json()

    if (!content || !chatId) {
      return NextResponse.json({ error: "Content and chatId are required" }, { status: 400 })
    }

    const result = await editMessage(messageId, chatId, content, user.id)

    if (!result.success) {
      return NextResponse.json({ error: result.message }, { status: 400 })
    }

    return NextResponse.json(result)
  } catch (error) {
    console.error("Error editing message:", error)
    return NextResponse.json({ error: "Internal server error" }, { status: 500 })
  }
}

export async function DELETE(request: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const user = await getCurrentUser()
    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    const { id: messageId } = await params
    const { searchParams } = new URL(request.url, process.env.NEXT_PUBLIC_BASE_URL || 'http://localhost:3000')
    const chatId = searchParams.get("chatId")

    if (!chatId) {
      return NextResponse.json({ error: "ChatId is required" }, { status: 400 })
    }

    const result = await deleteMessage(messageId, chatId, user.id)

    if (!result.success) {
      return NextResponse.json({ error: result.message }, { status: 400 })
    }

    return NextResponse.json(result)
  } catch (error) {
    console.error("Error deleting message:", error)
    return NextResponse.json({ error: "Internal server error" }, { status: 500 })
  }
}

export async function PATCH(request: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const user = await getCurrentUser()
    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    const { id: messageId } = await params
    const { chatId } = await request.json()

    if (!chatId) {
      return NextResponse.json({ error: "ChatId is required" }, { status: 400 })
    }

    const result = await markMessageAsRead(messageId, chatId, user.id)

    if (!result.success) {
      return NextResponse.json({ error: result.message }, { status: 400 })
    }

    return NextResponse.json(result)
  } catch (error) {
    console.error("Error marking message as read:", error)
    return NextResponse.json({ error: "Internal server error" }, { status: 500 })
  }
}
