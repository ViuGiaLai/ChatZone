import { supabase } from './db'
import type { RealtimeChannel } from '@supabase/supabase-js'

// Message type definition
export type Message = {
  id: string
  content: string
  senderId: string
  senderName: string
  chatId: string
  timestamp: number
  edited?: boolean
  deleted?: boolean
  fileUrl?: string
  fileName?: string
  fileType?: string
  readBy?: string[]
  reactions?: Record<string, string[]>
}

// Chat type definition
export type Chat = {
  id: string
  name: string
  isGroup: boolean
  createdBy: string
  members: string[]
  createdAt: number
  lastMessage?: Message
  theme?: string
  icon?: string
}

// Typing indicator types
export type TypingUser = {
  userId: string
  username: string
  chatId: string
  timestamp: number
}

const typingChannels = new Map<string, RealtimeChannel>()

export function broadcastTyping(chatId: string, userId: string, username: string) {
  const channel = supabase.channel(`typing:${chatId}`)
  channel.subscribe(async (status) => {
    if (status !== 'SUBSCRIBED') return
    await channel.send({
      type: 'broadcast',
      event: 'typing',
      payload: { userId, username, chatId, timestamp: Date.now() },
    })
    setTimeout(() => supabase.removeChannel(channel), 1000)
  })
}

export function subscribeToTyping(
  chatId: string,
  userId: string,
  onTyping: (user: TypingUser) => void,
  onStopTyping: (userId: string) => void
) {
  const key = `typing:${chatId}`
  if (typingChannels.has(key)) {
    supabase.removeChannel(typingChannels.get(key)!)
  }

  const channel = supabase.channel(key)
  channel
    .on('broadcast', { event: 'typing' }, (payload) => {
      const data = payload.payload as TypingUser
      if (data.userId !== userId) {
        onTyping(data)
      }
    })
    .subscribe()

  typingChannels.set(key, channel)

  return () => {
    supabase.removeChannel(channel)
    typingChannels.delete(key)
  }
}

// Get unread message count per chat
export async function getUnreadCounts(userId: string): Promise<Record<string, number>> {
  try {
    const { data, error } = await supabase
      .from('messages')
      .select('chatId, senderId, readBy')

    if (error) {
      console.error('Error fetching unread counts:', error)
      return {}
    }

    const counts: Record<string, number> = {}
    for (const msg of data || []) {
      const m = msg as any
      if (m.senderId === userId) continue
      const readBy: string[] = m.readBy || []
      if (!readBy.includes(userId)) {
        counts[m.chatId] = (counts[m.chatId] || 0) + 1
      }
    }
    return counts
  } catch (error) {
    console.error('Error in getUnreadCounts:', error)
    return {}
  }
}

// Get user chats
export async function getUserChats(userId: string): Promise<Chat[]> {
  try {
    const { data, error } = await supabase
      .from("chats")
      .select("*")
      .filter('members', 'cs', `["${userId}"]`)

    if (error) {
      if ((error as any).code === "PGRST205") {
        console.warn("Supabase: bảng `chats` chưa tồn tại.")
        return []
      }
      console.error("Error fetching chats:", error)
      return []
    }

    // Build initial chat list
    const chatIdsWithoutLast: string[] = []
    const chats: Chat[] = (data || []).map((item: any) => {
      const hasLast = !!item.last_message
      if (!hasLast) chatIdsWithoutLast.push(item.id)
      return {
        id: item.id,
        name: item.name,
        isGroup: item.is_group,
        createdBy: item.created_by,
        members: item.members || [],
        createdAt: item.created_at ? new Date(item.created_at).getTime() : Date.now(),
        lastMessage: hasLast ? {
          id: item.last_message.id,
          content: item.last_message.content,
          senderId: item.last_message.senderId || item.last_message.sender_id,
          senderName: item.last_message.senderName || item.last_message.sender_name,
          chatId: item.last_message.chatId || item.last_message.chat_id,
          timestamp: item.last_message.timestamp,
          edited: item.last_message.edited,
          deleted: item.last_message.deleted,
          fileUrl: item.last_message.fileUrl || item.last_message.file_url,
          fileName: item.last_message.fileName || item.last_message.file_name,
          readBy: item.last_message.readBy || item.last_message.read_by,
        } : undefined,
        theme: item.theme,
        icon: item.icon,
      }
    })

    // Fallback: fetch latest message for chats without last_message
    if (chatIdsWithoutLast.length > 0) {
      for (const chatId of chatIdsWithoutLast) {
        const { data: msgs } = await supabase
          .from('messages')
          .select('*')
          .eq('chatId', chatId)
          .order('timestamp', { ascending: false })
          .limit(1)
        if (msgs && msgs.length > 0) {
          const m = msgs[0]
          const chat = chats.find(c => c.id === chatId)
          if (chat) {
            chat.lastMessage = {
              id: m.id,
              content: m.content,
              senderId: m.senderId,
              senderName: m.senderName,
              chatId: m.chatId,
              timestamp: m.timestamp,
              edited: m.edited,
              deleted: m.deleted,
              fileUrl: m.fileUrl,
              fileName: m.fileName,
              fileType: m.type,
              readBy: m.readBy || [],
              reactions: m.reactions || {},
            }
          }
        }
      }
    }

    return chats as Chat[]
  } catch (error) {
    console.error("Unexpected error fetching chats:", error)
    return []
  }
}

// Send a message
export async function sendMessage(
  content: string,
  chatId: string,
  senderId: string,
  senderName: string,
  fileUrl?: string,
  fileName?: string
): Promise<Message | null> {
  const message: Omit<Message, 'id' | 'timestamp'> = {
    content,
    senderId,
    senderName,
    chatId,
    readBy: [senderId],
    fileUrl,
    fileName
  }

  const { data, error } = await supabase
    .from('messages')
    .insert([{ ...message, timestamp: Date.now() }])
    .select()
    .single()

  if (error) {
    console.error('Error sending message:', error)
    return null
  }

  // Update last message in chat
  const { error: updateError } = await supabase
    .from('chats')
    .update({ last_message: data })
    .eq('id', chatId)

  if (updateError) {
    console.error('Error updating last_message:', updateError)
  }

  return data
}

// Get messages for a chat
export async function getMessages(chatId: string, limit = 50): Promise<Message[]> {
  const { data, error } = await supabase
    .from('messages')
    .select('*')
    .eq('chatId', chatId)
    .order('timestamp', { ascending: false })
    .limit(limit)

  if (error) {
    console.error('Error fetching messages:', error)
    return []
  }

  // Map snake_case DB fields to camelCase Message type if needed
  const mapped: Message[] = (data || []).map((msg: any) => ({
    id: msg.id,
    content: msg.content,
    senderId: msg.senderId,
    senderName: msg.senderName,
    chatId: msg.chatId,
    timestamp: msg.timestamp,
    edited: msg.edited,
    deleted: msg.deleted,
    fileUrl: msg.fileUrl,
    fileName: msg.fileName,
    fileType: msg.type,
    readBy: msg.readBy || [],
    reactions: msg.reactions || {},
  }))
  // Fetch newest-first, then reverse so oldest is first (top)
  return mapped.reverse()
}

// Create a new chat
export async function createChat(
  name: string,
  isGroup: boolean,
  createdBy: string,
  members: string[],
  icon?: string
): Promise<Chat | null> {
  try {
    // Đảm bảo createdBy có trong members
    const allMembers = Array.from(new Set([...members, createdBy]));
    
    const chatData = {
      name,
      is_group: isGroup,
      created_by: createdBy,
      members: allMembers,
      icon: icon || null,
      created_at: new Date().toISOString()
    };

    console.log('Creating chat with data:', chatData);

    const { data, error } = await supabase
      .from('chats')
      .insert(chatData)
      .select()
      .single();

    if (error) {
      console.error('Error creating chat:', error);
      throw error;
    }

    console.log('Chat created successfully:', data);

    // Map response về kiểu Chat
    return {
      id: data.id,
      name: data.name,
      isGroup: data.is_group,
      createdBy: data.created_by,
      members: data.members || [],
      createdAt: data.created_at ? new Date(data.created_at).getTime() : Date.now(),
      theme: data.theme,
      icon: data.icon,
    };
  } catch (error) {
    console.error('Error in createChat:', error);
    return null;
  }
}

// Update chat settings
export async function updateChatSettings(
  chatId: string,
  updates: Partial<Chat>,
  userId: string
): Promise<{ success: boolean; message?: string }> {
  const { error } = await supabase
    .from('chats')
    .update(updates)
    .eq('id', chatId)

  if (error) {
    console.error('Error updating chat:', error)
    return { success: false, message: error.message }
  }

  return { success: true }
}

// Add members to a group chat
export async function addMembersToChat(
  chatId: string,
  newMemberIds: string[],
  userId: string
): Promise<{ success: boolean; message?: string }> {
  try {
    const { data: chat, error: fetchError } = await supabase
      .from('chats')
      .select('members, created_by')
      .eq('id', chatId)
      .single()

    if (fetchError || !chat) {
      return { success: false, message: 'Chat not found' }
    }

    if (chat.created_by !== userId) {
      return { success: false, message: 'Only the creator can add members' }
    }

    const currentMembers: string[] = chat.members || []
    const updatedMembers = Array.from(new Set([...currentMembers, ...newMemberIds]))

    const { error: updateError } = await supabase
      .from('chats')
      .update({ members: updatedMembers })
      .eq('id', chatId)

    if (updateError) {
      return { success: false, message: updateError.message }
    }

    return { success: true }
  } catch (error) {
    console.error('Error in addMembersToChat:', error)
    return { success: false, message: 'Internal server error' }
  }
}

// Mark message as read
export async function markMessageAsRead(
  messageId: string,
  chatId: string,
  userId: string
): Promise<boolean> {
  const { data: message, error: fetchError } = await supabase
    .from('messages')
    .select('readBy')
    .eq('id', messageId)
    .single()

  if (fetchError || !message) {
    console.error('Error fetching message:', fetchError)
    return false
  }

  const readBy = Array.from(new Set([...(message.readBy || []), userId]))

  const { error: updateError } = await supabase
    .from('messages')
    .update({ readBy })
    .eq('id', messageId)

  if (updateError) {
    console.error('Error updating message:', updateError)
    return false
  }

  return true
}

// Get all users
export async function getAllUsers(): Promise<Array<{ id: string; username: string; avatar_url?: string; is_online?: boolean; last_seen?: string }>> {
  const { data, error } = await supabase
    .from('profiles')
    .select('user_id, username, avatar_url, is_online, last_seen')
    .order('username', { ascending: true })

  if (error) {
    console.error('Error fetching users:', error)
    return []
  }

  return (data || []).map(p => ({
    id: p.user_id,
    username: p.username,
    avatar_url: p.avatar_url,
    is_online: p.is_online,
    last_seen: p.last_seen,
  }))
}

// Update user presence (online/offline status)
export async function updateUserPresence(userId: string, isOnline: boolean): Promise<boolean> {
  const { error } = await supabase
    .from('profiles')
    .update({ is_online: isOnline, last_seen: new Date().toISOString() })
    .eq('user_id', userId)

  if (error) {
    console.error('Error updating user presence:', error)
    return false
  }

  return true
}

// Notification type (phù hợp với NotificationBell component)
export type Notification = {
  id: string
  userId: string
  chatId: string
  messageId: string
  senderName: string
  content: string
  timestamp: number
  read: boolean
}

// Get notifications for a user
export async function getUserNotifications(userId: string): Promise<Notification[]> {
  try {
    const { data, error } = await supabase
      .from("notifications")
      .select("*")
      .eq("userId", userId)
      .order("timestamp", { ascending: false })

    if (error) {
      console.error("Error fetching notifications:", error)
      return []
    }

    return (data as Notification[]) || []
  } catch (error) {
    console.error("Unexpected error fetching notifications:", error)
    return []
  }
}

// Get unread notification count for a user
export async function getUnreadNotificationCount(userId: string): Promise<number> {
  try {
    const { count, error } = await supabase
      .from("notifications")
      .select("id", { count: "exact", head: true })
      .eq("userId", userId)
      .eq("read", false)

    if (error) {
      console.error("Error fetching unread notification count:", error)
      return 0
    }

    return count ?? 0
  } catch (error) {
    console.error("Unexpected error fetching unread notification count:", error)
    return 0
  }
}

// Edit a message
export async function editMessage(
  messageId: string,
  chatId: string,
  content: string,
  userId: string
): Promise<{ success: boolean; message?: string }> {
  try {
    // Check ownership
    const { data: msg, error: fetchError } = await supabase
      .from('messages')
      .select('senderId, timestamp')
      .eq('id', messageId)
      .single()

    if (fetchError || !msg) {
      return { success: false, message: 'Message not found' }
    }

    if (msg.senderId !== userId) {
      return { success: false, message: 'You can only edit your own messages' }
    }

    // Check 15-minute edit window
    const now = Date.now()
    if (now - msg.timestamp > 15 * 60 * 1000) {
      return { success: false, message: 'Edit window has expired (15 minutes)' }
    }

    const { error } = await supabase
      .from('messages')
      .update({ content, edited: true })
      .eq('id', messageId)
      .eq('chatId', chatId)

    if (error) {
      console.error('Error editing message:', error)
      return { success: false, message: error.message }
    }

    return { success: true }
  } catch (error) {
    console.error('Error in editMessage:', error)
    return { success: false, message: 'Internal error' }
  }
}

// Delete / recall a message
export async function deleteMessage(
  messageId: string,
  chatId: string,
  userId: string
): Promise<{ success: boolean; message?: string }> {
  try {
    const { data: msg, error: fetchError } = await supabase
      .from('messages')
      .select('senderId')
      .eq('id', messageId)
      .single()

    if (fetchError || !msg) {
      return { success: false, message: 'Message not found' }
    }

    if (msg.senderId !== userId) {
      return { success: false, message: 'You can only delete your own messages' }
    }

    // Soft delete: replace content with recall message
    const { error } = await supabase
      .from('messages')
      .update({ content: 'Tin nhắn đã được thu hồi', deleted: true })
      .eq('id', messageId)
      .eq('chatId', chatId)

    if (error) {
      console.error('Error deleting message:', error)
      return { success: false, message: error.message }
    }

    return { success: true }
  } catch (error) {
    console.error('Error in deleteMessage:', error)
    return { success: false, message: 'Internal error' }
  }
}

