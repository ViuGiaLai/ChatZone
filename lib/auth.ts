// lib/auth.ts
import { createServerClient } from '@supabase/ssr'
import { cookies } from 'next/headers'
import { redirect } from 'next/navigation'
import { createClient as createSupabaseClient } from '@supabase/supabase-js'
import { Database, supabase } from './db'

export type User = {
  id: string
  username: string
  email?: string
  avatar?: string
  role: 'user' | 'admin'
  profileColor?: string
}

export function createClient() {
  const cookieStore = cookies()
  
  return createServerClient<Database>(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        async get(name: string) {
          return (await cookieStore).get(name)?.value
        },
        async set(name: string, value: string, options: any) {
          ;(await cookieStore).set({ name, value, ...options })
        },
        async remove(name: string, options: any) {
          ;(await cookieStore).set({ name, value: '', ...options })
        },
      },
    }
  )
}

export async function getCurrentUser(): Promise<User | null> {
  try {
    const supabase = createClient()
    const { data: { user }, error } = await supabase.auth.getUser()

    if (!user) return null

    // Get user profile from profiles table
    const { data: profile, error: profileError } = await supabase
      .from('profiles')
      .select('username, avatar_url, role, profile_color, user_id')
      .eq('user_id', user.id)
      .maybeSingle()

    if (profileError) {
      console.error('Error fetching profile:', profileError)
      return null
    }

    return {
      id: user.id,
      email: user.email || '',
      username: profile?.username || '',
      avatar: profile?.avatar_url || '',
      role: (profile?.role as 'user' | 'admin') || 'user',
      profileColor: profile?.profile_color || getRandomColor()
    }
  } catch (error) {
    console.error('Error in getCurrentUser:', error)
    return null
  }
}

export async function requireAuth() {
  const user = await getCurrentUser()
  if (!user) redirect('/login')
  return user
}

export async function requireAdmin() {
  const user = await requireAuth()
  if (user.role !== 'admin') redirect('/')
  return user
}

export async function loginUser(email: string, password: string) {
  const supabase = createClient()
  const { data, error } = await supabase.auth.signInWithPassword({
    email,
    password,
  })

  if (error) throw error
  return data
}

export async function logoutUser() {
  const supabase = createClient()
  await supabase.auth.signOut()
}

export async function registerUser(email: string, password: string, username: string) {
  const supabase = createClient()
  const { data, error } = await supabase.auth.signUp({
    email,
    password,
    options: {
      data: {
        username,
        role: 'user',
      }
    }
  })

  if (error) throw error
  return data
}

export function getRandomColor() {
  const colors = [
    '#FF6B6B', '#4ECDC4', '#45B7D1', '#96CEB4', 
    '#FFEEAD', '#D4A5A5', '#9B97B2', '#E8F9FD'
  ]
  return colors[Math.floor(Math.random() * colors.length)]
}

export async function updateUserProfile(userId: string, updates: { username?: string; avatar?: string; profileColor?: string }): Promise<{ success: boolean; message?: string; user?: any }> {
  try {
    const dbUpdates: Record<string, any> = {}
    if (updates.username) dbUpdates.username = updates.username
    if (updates.avatar) dbUpdates.avatar_url = updates.avatar
    if (updates.profileColor) dbUpdates.profile_color = updates.profileColor

    const { error } = await supabase
      .from('profiles')
      .update(dbUpdates)
      .eq('user_id', userId)

    if (error) {
      console.error('Error updating profile:', error)
      return { success: false, message: error.message }
    }

    return { success: true }
  } catch (error) {
    console.error('Error in updateUserProfile:', error)
    return { success: false, message: 'Internal error' }
  }
}

// Ensure there is at least one admin profile in the database.
// Tự động tạo admin user từ biến môi trường ADMIN_EMAIL và ADMIN_PASSWORD
export async function ensureAdminExists() {
  try {
    const { data, error } = await supabase
      .from('profiles')
      .select('user_id')
      .eq('role', 'admin')
      .limit(1)

    if (error) {
      console.error('Error checking admin profile:', error)
      return
    }

    if (data && data.length > 0) {
      return
    }

    // Auto-create admin user using service role key
    const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY
    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
    const adminEmail = process.env.ADMIN_EMAIL
    const adminPassword = process.env.ADMIN_PASSWORD

    if (!serviceKey || !supabaseUrl || !adminEmail || !adminPassword) {
      console.warn('Missing environment variables for auto-creating admin user.')
      return
    }

    const supabaseAdmin = createSupabaseClient(supabaseUrl, serviceKey, {
      auth: {
        autoRefreshToken: false,
        persistSession: false,
      },
    })

    // Create user in Auth
    const { data: authData, error: authError } = await supabaseAdmin.auth.admin.createUser({
      email: adminEmail,
      password: adminPassword,
      email_confirm: true,
      user_metadata: { role: 'admin', username: 'admin' },
    })

    if (authError) {
      if (authError.message?.includes('already exists')) {
        console.log('Admin user already exists in Auth.')
      } else {
        console.error('Error creating admin auth user:', authError)
        return
      }
    }

    const userId = authData?.user?.id
    if (!userId) {
      console.warn('Could not get admin user ID after creation.')
      return
    }

    // Create profile record
    const { error: profileError } = await supabaseAdmin
      .from('profiles')
      .upsert({
        user_id: userId,
        username: 'admin',
        role: 'admin',
        avatar_url: '',
        profile_color: '#FF6B6B',
      }, { onConflict: 'user_id' })

    if (profileError) {
      console.error('Error creating admin profile:', profileError)
      return
    }

    console.log('Admin user created successfully! Email: ' + adminEmail)
  } catch (error) {
    console.error('Error in ensureAdminExists:', error)
  }
}