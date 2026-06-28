export const runtime = "nodejs";
import { NextResponse } from "next/server"
import { getCurrentUser, updateUserProfile } from "@/lib/auth"
import { supabase } from "@/lib/db"

export async function PUT(request: Request) {
  try {
    const user = await getCurrentUser()
    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    const body = await request.json()
    const { username, avatar, profileColor } = body

    if (!username) {
      return NextResponse.json({ error: "Username is required" }, { status: 400 })
    }

    // Check if username is already taken
    if (username !== user.username) {
      const { data: existing } = await supabase
        .from('profiles')
        .select('user_id')
        .eq('username', username)
        .neq('user_id', user.id)
        .maybeSingle()

      if (existing) {
        return NextResponse.json({ error: "Username is already taken" }, { status: 400 })
      }
    }

    const result = await updateUserProfile(user.id, { username, avatar, profileColor })

    if (!result.success) {
      return NextResponse.json({ error: result.message }, { status: 500 })
    }

    return NextResponse.json({ success: true, user: result.user })
  } catch (error) {
    console.error("Error updating profile:", error)
    return NextResponse.json({ error: "Internal server error" }, { status: 500 })
  }
}
