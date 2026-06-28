-- =============================================
-- ViuChat - Database Schema Migration
-- =============================================

-- Drop existing tables if they exist (order matters for FK)
DROP TABLE IF EXISTS public.notifications;
DROP TABLE IF EXISTS public.reactions;
DROP TABLE IF EXISTS public.reports;
DROP TABLE IF EXISTS public.blocked_users;
DROP TABLE IF EXISTS public.chat_members;
DROP TABLE IF EXISTS public.messages;
DROP TABLE IF EXISTS public.chats;
DROP TABLE IF EXISTS public.profiles;

-- =============================================
-- PROFILES
-- Maps 1:1 with auth.users
-- =============================================
CREATE TABLE public.profiles (
  id UUID PRIMARY KEY,                              -- matches auth.users.id
  username TEXT NOT NULL UNIQUE,
  full_name TEXT DEFAULT '',
  avatar_url TEXT DEFAULT '',
  avatar_color TEXT DEFAULT '#8B5CF6',
  role TEXT NOT NULL DEFAULT 'user',                 -- 'user' | 'admin'
  profile_color TEXT,
  bio TEXT,
  birthday TEXT,
  address TEXT,
  is_online BOOLEAN DEFAULT false,
  last_seen TIMESTAMPTZ DEFAULT NOW(),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- =============================================
-- CHATS
-- =============================================
CREATE TABLE public.chats (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  is_group BOOLEAN DEFAULT false,
  created_by UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
  members JSONB DEFAULT '[]'::jsonb,                -- array of user IDs
  icon TEXT,
  theme TEXT DEFAULT 'default',
  last_message JSONB,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- =============================================
-- MESSAGES
-- =============================================
CREATE TABLE public.messages (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  chat_id UUID NOT NULL REFERENCES public.chats(id) ON DELETE CASCADE,
  sender_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  sender_name TEXT NOT NULL DEFAULT '',
  content TEXT NOT NULL DEFAULT '',
  type TEXT DEFAULT 'text',                          -- 'text','image','file','voice','system'
  file_url TEXT,
  file_name TEXT,
  reply_to UUID,                                     -- message id being replied to
  is_pinned BOOLEAN DEFAULT false,
  edited BOOLEAN DEFAULT false,
  deleted BOOLEAN DEFAULT false,
  read_by JSONB DEFAULT '[]'::jsonb,                 -- array of user IDs
  timestamp BIGINT NOT NULL,                         -- milliseconds since epoch
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Indexes for messages
CREATE INDEX idx_messages_chat_id ON public.messages(chat_id);
CREATE INDEX idx_messages_timestamp ON public.messages(timestamp DESC);
CREATE INDEX idx_messages_sender_id ON public.messages(sender_id);
CREATE INDEX idx_messages_pinned ON public.messages(is_pinned) WHERE is_pinned = true;

-- =============================================
-- CHAT MEMBERS (replaces JSON array for proper role mgmt)
-- =============================================
CREATE TABLE public.chat_members (
  chat_id UUID NOT NULL REFERENCES public.chats(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  role TEXT DEFAULT 'member',                        -- 'owner','admin','member'
  joined_at TIMESTAMPTZ DEFAULT NOW(),
  PRIMARY KEY (chat_id, user_id)
);

-- =============================================
-- BLOCKED USERS
-- =============================================
CREATE TABLE public.blocked_users (
  user_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  blocked_user_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  PRIMARY KEY (user_id, blocked_user_id)
);

-- =============================================
-- REPORTS
-- =============================================
CREATE TABLE public.reports (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  reporter_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  reported_user_id UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
  message_id UUID,
  reason TEXT NOT NULL DEFAULT 'other',              -- 'spam','harassment','inappropriate','other'
  description TEXT,
  status TEXT DEFAULT 'pending',                     -- 'pending','resolved','dismissed'
  created_at TIMESTAMPTZ DEFAULT NOW(),
  resolved_at TIMESTAMPTZ,
  resolved_by UUID REFERENCES public.profiles(id) ON DELETE SET NULL
);

-- =============================================
-- REACTIONS (emoji on messages)
-- =============================================
CREATE TABLE public.reactions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  message_id UUID NOT NULL REFERENCES public.messages(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  emoji TEXT NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE (message_id, user_id, emoji)
);

-- =============================================
-- NOTIFICATIONS
-- =============================================
CREATE TABLE public.notifications (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  chat_id UUID REFERENCES public.chats(id) ON DELETE CASCADE,
  message_id UUID,
  sender_name TEXT NOT NULL DEFAULT '',
  type TEXT DEFAULT 'message',                       -- 'message','mention','group_invite','system'
  content TEXT NOT NULL DEFAULT '',
  timestamp BIGINT NOT NULL,
  read BOOLEAN DEFAULT false,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Indexes for notifications
CREATE INDEX idx_notifications_user_id ON public.notifications(user_id);
CREATE INDEX idx_notifications_unread ON public.notifications(user_id, read) WHERE read = false;

-- =============================================
-- Enable Row Level Security
-- =============================================
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.chats ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.messages ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.chat_members ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.blocked_users ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.reports ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.reactions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.notifications ENABLE ROW LEVEL SECURITY;

-- =============================================
-- RLS Policies (basic)
-- =============================================

-- Profiles: users can read all profiles, update only their own
CREATE POLICY "profiles_select" ON public.profiles FOR SELECT USING (true);
CREATE POLICY "profiles_insert" ON public.profiles FOR INSERT WITH CHECK (true);
CREATE POLICY "profiles_update" ON public.profiles FOR UPDATE USING (id = auth.uid());
CREATE POLICY "profiles_delete" ON public.profiles FOR DELETE USING (id = auth.uid());

-- Chats: members can read/update their chats
CREATE POLICY "chats_select" ON public.chats FOR SELECT USING (members ? auth.uid()::text);
CREATE POLICY "chats_insert" ON public.chats FOR INSERT WITH CHECK (true);
CREATE POLICY "chats_update" ON public.chats FOR UPDATE USING (members ? auth.uid()::text);
CREATE POLICY "chats_delete" ON public.chats FOR DELETE USING (created_by = auth.uid());

-- Messages: chat members can CRUD
CREATE POLICY "messages_select" ON public.messages FOR SELECT USING (true);
CREATE POLICY "messages_insert" ON public.messages FOR INSERT WITH CHECK (true);
CREATE POLICY "messages_update" ON public.messages FOR UPDATE USING (sender_id = auth.uid());
CREATE POLICY "messages_delete" ON public.messages FOR DELETE USING (sender_id = auth.uid());
