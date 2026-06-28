export const runtime = "nodejs";
import { NextResponse } from "next/server"
import { getCurrentUser } from "@/lib/auth"
import { supabase } from "@/lib/db"

export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const user = await getCurrentUser()
    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    const { id: messageId } = await params
    const { emoji } = await request.json()

    if (!emoji) {
      return NextResponse.json({ error: "Emoji is required" }, { status: 400 })
    }

    // Get current reactions
    const { data: msg, error: fetchError } = await supabase
      .from('messages')
      .select('reactions, "chatId"')
      .eq('id', messageId)
      .single()

    if (fetchError || !msg) {
      return NextResponse.json({ error: "Message not found" }, { status: 404 })
    }

    const reactions = (msg.reactions as Record<string, string[]>) || {}
    const users = reactions[emoji] || []

    // Toggle: remove if already reacted, add if not
    const idx = users.indexOf(user.id)
    let updated: Record<string, string[]>
    
    if (idx >= 0) {
      users.splice(idx, 1)
      updated = { ...reactions, [emoji]: users }
      if (users.length === 0) {
        delete updated[emoji]
      }
    } else {
      updated = { ...reactions, [emoji]: [...users, user.id] }
    }

    const { error: updateError } = await supabase
      .from('messages')
      .update({ reactions: updated })
      .eq('id', messageId)

    if (updateError) {
      console.error('Error updating reaction:', updateError)
      return NextResponse.json({ error: "Failed to update reaction" }, { status: 500 })
    }

    return NextResponse.json({ reactions: updated })
  } catch (error) {
    console.error("Error in react endpoint:", error)
    return NextResponse.json({ error: "Internal server error" }, { status: 500 })
  }
}
