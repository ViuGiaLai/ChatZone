import { createClient } from '@supabase/supabase-js'

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || 'https://pxsrydtrpqcxchpairbw.supabase.co'
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InB4c3J5ZHRycHFjeGNocGFpcmJ3Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODI2NTE2MDIsImV4cCI6MjA5ODIyNzYwMn0.R1y1O5RFk81dU3eANqGp8Rr5XqM3WIFz2LNKGSxOEV0'

if (!supabaseUrl || !supabaseAnonKey) {
  throw new Error('Missing Supabase environment variables')
}

export const supabase = createClient(supabaseUrl, supabaseAnonKey, {
  auth: {
    persistSession: true,
    autoRefreshToken: true,
    detectSessionInUrl: true
  }
})

// Database type definitions
export type Database = {
  public: {
    Tables: {
      profiles: {
        Row: {
          id: string
          user_id: string
          username: string
          full_name: string
          avatar_url: string | null
          avatar_color: string | null
          role: 'user' | 'admin'
          profile_color: string | null
          bio: string | null
          birthday: string | null
          address: string | null
          is_online: boolean
          last_seen: string
          created_at: string
          updated_at: string
        }
        Insert: {
          user_id: string
          username: string
          full_name?: string
          avatar_url?: string | null
          avatar_color?: string | null
          role?: 'user' | 'admin'
          profile_color?: string | null
          bio?: string | null
          birthday?: string | null
          address?: string | null
          is_online?: boolean
          last_seen?: string
        }
        Update: {
          username?: string
          full_name?: string
          avatar_url?: string | null
          avatar_color?: string | null
          role?: 'user' | 'admin'
          profile_color?: string | null
          bio?: string | null
          birthday?: string | null
          address?: string | null
          is_online?: boolean
          last_seen?: string
        }
      }
      chats: {
        Row: {
          id: string
          name: string
          is_group: boolean
          created_by: string
          members: string[]
          icon: string | null
          theme: string | null
          last_message: any
          created_at: string
        }
        Insert: {
          name: string
          is_group: boolean
          created_by: string
          members: string[]
          icon?: string | null
          theme?: string | null
        }
      }
      messages: {
        Row: {
          id: string
          chatId: string
          senderId: string
          senderName: string
          content: string
          type: string
          fileUrl: string | null
          fileName: string | null
          replyTo: string | null
          isPinned: boolean
          edited: boolean
          deleted: boolean
          readBy: string[]
          reactions: Record<string, string[]>
          timestamp: number
          created_at: string
        }
        Insert: {
          chatId: string
          senderId: string
          senderName: string
          content: string
          type?: string
          fileUrl?: string | null
          fileName?: string | null
          replyTo?: string | null
          isPinned?: boolean
          edited?: boolean
          deleted?: boolean
          readBy?: string[]
          reactions?: Record<string, string[]>
          timestamp: number
        }
      }
      notifications: {
        Row: {
          id: string
          userId: string
          chatId: string
          messageId: string
          senderName: string
          type: string
          content: string
          timestamp: number
          read: boolean
          created_at: string
        }
        Insert: {
          userId: string
          chatId: string
          messageId: string
          senderName: string
          type?: string
          content: string
          timestamp: number
          read?: boolean
        }
      }
    }
  }
}
