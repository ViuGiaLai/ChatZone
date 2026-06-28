export const runtime = "nodejs";
import { NextResponse } from "next/server"
import { getCurrentUser } from "@/lib/auth"
import { supabase } from "@/lib/db"
import { createClient as createSupabaseClient } from '@supabase/supabase-js'

export async function GET() {
  try {
    const user = await getCurrentUser()
    if (!user || user.role !== "admin") {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    const { data: profiles, error } = await supabase
      .from('profiles')
      .select('user_id, username, avatar_url, role, profile_color, last_seen, created_at')
      .order('username', { ascending: true })

    if (error) {
      console.error('Error fetching users:', error)
      return NextResponse.json({ error: "Internal server error" }, { status: 500 })
    }

    return NextResponse.json((profiles || []).map(p => ({ ...p, id: p.user_id })))
  } catch (error) {
    console.error("Error getting users:", error)
    return NextResponse.json({ error: "Internal server error" }, { status: 500 })
  }
}

export async function POST(request: Request) {
  try {
    const admin = await getCurrentUser()
    if (!admin || admin.role !== "admin") {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    const { email, username, password, role } = await request.json()

    if (!email || !username || !password) {
      return NextResponse.json({ error: "Email, username and password are required" }, { status: 400 })
    }

    const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY
    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
    if (!serviceKey || !supabaseUrl) {
      return NextResponse.json({ error: "Server configuration error" }, { status: 500 })
    }

    const supabaseAdmin = createSupabaseClient(supabaseUrl, serviceKey, {
      auth: { autoRefreshToken: false, persistSession: false },
    })

    // Check if user already exists in Auth
    const { data: existingAuth } = await supabaseAdmin.auth.admin.listUsers()
    const existingUser = existingAuth?.users?.find(u => u.email === email)
    if (existingUser) {
      return NextResponse.json({ error: "Email already registered" }, { status: 400 })
    }

    // Create user in Auth
    const { data: authData, error: authError } = await supabaseAdmin.auth.admin.createUser({
      email,
      password,
      email_confirm: true,
      user_metadata: { username, role: role || 'user' },
    })

    if (authError) {
      return NextResponse.json({ error: authError.message }, { status: 400 })
    }

    const userId = authData?.user?.id
    if (!userId) {
      return NextResponse.json({ error: "Failed to create user" }, { status: 500 })
    }

    // Create profile
    const { error: profileError } = await supabaseAdmin
      .from('profiles')
      .upsert({
        user_id: userId,
        username,
        role: role || 'user',
        avatar_url: '',
        profile_color: getRandomColor(),
      }, { onConflict: 'user_id' })

    if (profileError) {
      console.error('Error creating profile:', profileError)
      return NextResponse.json({ error: "Profile creation failed" }, { status: 500 })
    }

    return NextResponse.json({
      id: userId,
      username,
      email,
      role: role || 'user',
      profile_color: getRandomColor(),
    })
  } catch (error) {
    console.error("Error creating user:", error)
    return NextResponse.json({ error: "Internal server error" }, { status: 500 })
  }
}

function getRandomColor() {
  const colors = [
    "#FF6B6B", "#4ECDC4", "#45B7D1", "#96CEB4",
    "#FFEEAD", "#D4A5A5", "#9B97B2", "#E8F9FD"
  ]
  return colors[Math.floor(Math.random() * colors.length)]
}
