export const runtime = "nodejs";

import { NextResponse } from "next/server"
import { getCurrentUser } from "@/lib/auth"
import { supabase } from "@/lib/db"
import { createClient as createSupabaseClient } from '@supabase/supabase-js'

export async function PUT(request: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const admin = await getCurrentUser()
    if (!admin || admin.role !== "admin") {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    const { id: userId } = await params
    const { username, password, role } = await request.json()

    if (!username) {
      return NextResponse.json({ error: "Username is required" }, { status: 400 })
    }

    const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY
    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
    if (!serviceKey || !supabaseUrl) {
      return NextResponse.json({ error: "Server configuration error" }, { status: 500 })
    }

    const supabaseAdmin = createSupabaseClient(supabaseUrl, serviceKey, {
      auth: { autoRefreshToken: false, persistSession: false },
    })

    // Check if new username already exists (excluding current user)
    const { data: existingProfile } = await supabaseAdmin
      .from('profiles')
      .select('user_id')
      .eq('username', username)
      .neq('user_id', userId)
      .maybeSingle()

    if (existingProfile) {
      return NextResponse.json({ error: "Username already exists" }, { status: 400 })
    }

    // Update profile
    const updates: Record<string, any> = { username }
    if (role) updates.role = role

    const { error: updateError } = await supabaseAdmin
      .from('profiles')
      .update(updates)
      .eq('user_id', userId)

    if (updateError) {
      console.error('Error updating profile:', updateError)
      return NextResponse.json({ error: "Failed to update user" }, { status: 500 })
    }

    // Update password if provided (via Auth admin API)
    if (password) {
      const { error: passwordError } = await supabaseAdmin.auth.admin.updateUserById(userId, {
        password,
      })
      if (passwordError) {
        console.error('Error updating password:', passwordError)
      }
    }

    const { data: updated } = await supabaseAdmin
      .from('profiles')
      .select('user_id, username, role, avatar_url, profile_color')
      .eq('user_id', userId)
      .single()

    return NextResponse.json(updated ? { ...updated, id: updated.user_id } : { id: userId, username, role })
  } catch (error) {
    console.error("Error updating user:", error)
    return NextResponse.json({ error: "Internal server error" }, { status: 500 })
  }
}

export async function DELETE(request: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const admin = await getCurrentUser()
    if (!admin || admin.role !== "admin") {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    const { id: userId } = await params

    if (userId === admin.id) {
      return NextResponse.json({ error: "Cannot delete your own account" }, { status: 400 })
    }

    const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY
    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
    if (!serviceKey || !supabaseUrl) {
      return NextResponse.json({ error: "Server configuration error" }, { status: 500 })
    }

    const supabaseAdmin = createSupabaseClient(supabaseUrl, serviceKey, {
      auth: { autoRefreshToken: false, persistSession: false },
    })

    // Delete profile
    await supabaseAdmin.from('profiles').delete().eq('user_id', userId)

    // Delete user from Auth
    const { error } = await supabaseAdmin.auth.admin.deleteUser(userId)
    if (error) {
      console.error('Error deleting auth user:', error)
      return NextResponse.json({ error: error.message }, { status: 500 })
    }

    return NextResponse.json({ success: true })
  } catch (error) {
    console.error("Error deleting user:", error)
    return NextResponse.json({ error: "Internal server error" }, { status: 500 })
  }
}
