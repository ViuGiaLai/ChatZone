"use client"

import { useState, useEffect, useCallback } from "react"
import Link from "next/link"
import { usePathname, useRouter } from "next/navigation"
import { useWebSocket } from "@/components/websocket-provider"
import type { User } from "@/lib/auth"
import type { Chat, Message } from "@/lib/chat"
import { ScrollArea } from "@/components/ui/scroll-area"
import { CreateChatDialog } from "@/components/create-chat-dialog"
import { LogoutButton } from "@/components/logout-button"
import { NotificationBell } from "@/components/notification-bell"
import { ChatHeader } from "@/components/chat-header"
import { MessageList } from "@/components/message-list"
import { MessageInput } from "@/components/message-input"
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar"
import { MessageSquarePlus, Settings, Users, Pin, BellOff, CheckCheck, Trash2, Archive, MoreVertical } from "lucide-react"
import { cn } from "@/lib/utils"
import { DialogTrigger } from "@/components/ui/dialog"
import { StatusDot } from "@/components/status-dot"

function formatTime(ts: number): string {
  const now = Date.now()
  const diff = now - ts
  const date = new Date(ts)
  if (diff < 86400000) return date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
  if (diff < 172800000) return 'Yesterday'
  return date.toLocaleDateString([], { month: 'short', day: 'numeric' })
}
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"

interface SidebarProps {
  user: User
}

export function Sidebar({ user }: SidebarProps) {
  const router = useRouter()
  const pathname = usePathname()
  const { usePolling } = useWebSocket()
  const [chats, setChats] = useState<Chat[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [selectedChat, setSelectedChat] = useState<Chat | null>(null) // Track selected chat
  const [mobileActiveChat, setMobileActiveChat] = useState<Chat | null>(null)
  const [mobileMessages, setMobileMessages] = useState<Message[]>([])
  const [mobileLoading, setMobileLoading] = useState(false)
  const [mobileError, setMobileError] = useState<string | null>(null)
  const [isMobile, setIsMobile] = useState(false)
  const [activeTab, setActiveTab] = useState<'chats' | 'friends'>("chats")
  const [friends, setFriends] = useState<any[]>([])
  const [loadingFriends, setLoadingFriends] = useState(false)
  const [searchTerm, setSearchTerm] = useState("")
  const [unreadCounts, setUnreadCounts] = useState<Record<string, number>>({})
  const [onlineUsers, setOnlineUsers] = useState<Record<string, boolean>>({})

  const fetchOnlineStatus = useCallback(async () => {
    try {
      const res = await fetch("/api/users")
      if (res.ok) {
        const data = await res.json()
        const map: Record<string, boolean> = {}
        data.forEach((u: any) => { if (u.is_online) map[u.id] = true })
        setOnlineUsers(map)
      }
    } catch {}
  }, [])

  const fetchUnreadCounts = useCallback(async () => {
    try {
      const response = await fetch("/api/chats/unread")
      if (response.ok) {
        const data = await response.json()
        setUnreadCounts(data)
      }
    } catch (error) {
      console.error("Error fetching unread counts:", error)
    }
  }, [])

  const fetchChats = useCallback(async () => {
    try {
      const response = await fetch("/api/chats")
      if (response.ok) {
        const data = await response.json()
        setChats(data)
      } else {
        console.error("Failed to load chats:", await response.text())
      }
    } catch (error) {
      console.error("Error loading chats:", error)
    } finally {
      setIsLoading(false)
    }
  }, [])

  const fetchFriends = useCallback(async () => {
    setLoadingFriends(true)
    try {
      const res = await fetch("/api/users")
      if (res.ok) {
        const data = await res.json()
        // Lọc bỏ chính mình
        setFriends(Array.isArray(data) ? data.filter((u) => u.id !== user.id) : [])
      } else {
        setFriends([])
      }
    } catch {
      setFriends([])
    } finally {
      setLoadingFriends(false)
    }
  }, [user.id])

  useEffect(() => {
    fetchChats()
    fetchUnreadCounts()
    fetchOnlineStatus()
    const interval = setInterval(() => {
      fetchChats()
      fetchUnreadCounts()
      fetchOnlineStatus()
    }, usePolling ? 3000 : 10000)
    return () => clearInterval(interval)
  }, [fetchChats, fetchUnreadCounts, fetchOnlineStatus, usePolling])

  useEffect(() => {
    const checkMobile = () => setIsMobile(window.innerWidth < 1024)
    checkMobile()
    window.addEventListener('resize', checkMobile)
    return () => window.removeEventListener('resize', checkMobile)
  }, [])

  // Fetch messages for mobile chat
  useEffect(() => {
    async function fetchMessages() {
      if (!mobileActiveChat) return
      setMobileLoading(true)
      setMobileError(null)
      try {
        const res = await fetch(`/api/chats/${mobileActiveChat.id}/messages`)
        if (!res.ok) throw new Error(await res.text())
        const data = await res.json()
        setMobileMessages(Array.isArray(data) ? data : [])
      } catch (err: any) {
        setMobileError("Không thể tải tin nhắn. Vui lòng thử lại.")
        setMobileMessages([])
      } finally {
        setMobileLoading(false)
      }
    }
    if (mobileActiveChat) fetchMessages()
  }, [mobileActiveChat])

  const handleChatSelect = (chat: Chat) => {
    if (isMobile) {
      setMobileActiveChat(chat)
    } else {
      router.push(`/chat/${chat.id}`)
    }
  }

  const handleBackToChatList = () => {
    setSelectedChat(null) // Return to chat list on mobile
  }

  if (mobileActiveChat) {
    return (
      <div className="flex flex-col h-screen bg-gray-900 block lg:hidden overflow-x-hidden w-screen max-w-screen">
        {/* Header */}
        <ChatHeader
          chat={mobileActiveChat}
          onChatUpdated={(updatedChat) => setMobileActiveChat(updatedChat)}
          className="block lg:hidden w-full max-w-full"
        />
        {mobileLoading ? (
          <div style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', minHeight: 0 }} className="w-full max-w-full">
            <div className="animate-spin rounded-full h-10 w-10 border-b-2 border-white"></div>
          </div>
        ) : mobileError ? (
          <ScrollArea className="flex-1 overflow-y-auto px-0 py-1 w-full max-w-full">
            <div className="text-center text-red-400 py-4 w-full max-w-full">{mobileError}</div>
          </ScrollArea>
        ) : (
          <>
            {/* Danh sách tin nhắn */}
            <ScrollArea className="flex-1 overflow-y-auto px-0 py-1 w-full max-w-full">
              <MessageList
                className="w-full max-w-full"
                messages={mobileMessages}
                currentUserId={user.id}
                chatTheme={mobileActiveChat.theme}
                onMessageRead={() => {}}
                users={{}}
              />
            </ScrollArea>
            {/* Ô nhập tin nhắn */}
            <div className="px-2 py-2 bg-gray-800 w-full max-w-full">
              <MessageInput
                chatId={mobileActiveChat.id}
                onMessageSent={() => {
                  // Refetch messages after sending
                  if (mobileActiveChat) {
                    fetch(`/api/chats/${mobileActiveChat.id}/messages`).then(async (res) => {
                      if (res.ok) {
                        const data = await res.json()
                        setMobileMessages(Array.isArray(data) ? data : [])
                      }
                    })
                  }
                }}
                chatTheme={mobileActiveChat.theme}
                className="w-full max-w-full"
              />
              <button
                onClick={() => setMobileActiveChat(null)}
                className="w-full max-w-full mt-2 py-2 text-sm bg-gray-700 text-white rounded"
              >
                Quay lại danh sách chat
              </button>
            </div>
          </>
        )}
      </div>
    )
  }

  // MOBILE: Hiển thị giao diện danh sách chat với header, search, tab dưới cùng
  if (isMobile) {
    return (
      <div className="flex flex-col h-screen bg-gray-900 w-screen max-w-screen overflow-x-hidden block lg:hidden">
        {/* Header */}
        <div className="flex items-center justify-between px-4 py-3 border-b border-gray-800">
          <Avatar className="h-9 w-9 cursor-pointer mr-2" onClick={() => router.push("/profile")}>
            {user.avatar ? (
              <AvatarImage src={user.avatar || "/placeholder.svg"} alt={user.username} />
            ) : (
              <AvatarFallback className="bg-blue-600">
                {user.username.charAt(0).toUpperCase()}
              </AvatarFallback>
            )}
          </Avatar>
          <span className="text-lg font-bold text-white">{activeTab === "friends" ? "Friends" : "Viu Chat"}</span>
          {activeTab === "chats" && (
            <CreateChatDialog
              triggerClassName="text-2xl text-white bg-gray-700 rounded-full w-8 h-8 flex items-center justify-center"
              triggerContent="+"
              onChatCreated={(chat) => {
                setChats((prev) => [chat, ...prev]);
                fetchChats();
              }}
            />
          )}
        </div>
        {/* Search */}
        <div className="px-4 py-2 border-b border-gray-800 bg-gray-900">
          <input
            type="text"
            placeholder={activeTab === "friends" ? "Search friends" : "Search messages"}
            className="w-full rounded-full px-4 py-2 bg-gray-800 text-white placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-blue-600"
            style={{ fontSize: 15 }}
            value={searchTerm}
            onChange={e => setSearchTerm(e.target.value)}
          />
        </div>
        {/* Danh sách chat hoặc bạn bè */}
        {activeTab === "chats" ? (
          <ScrollArea className="flex-1 w-full max-w-full pb-16">
            <div className="p-2">
              {(() => {
                const filteredChats = searchTerm.trim()
                  ? chats.filter(chat =>
                      chat.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
                      (chat.lastMessage && chat.lastMessage.senderName && chat.lastMessage.senderName.toLowerCase().includes(searchTerm.toLowerCase()))
                    )
                  : chats
                if (isLoading) {
                  return (
                    <div className="flex items-center justify-center h-16">
                      <div className="animate-spin rounded-full h-5 w-5 border-b-2 border-white"></div>
                    </div>
                  )
                } else if (filteredChats.length > 0) {
                  return (
                    <div className="space-y-2">
                      {filteredChats.map((chat) => (
                        <div
                          key={chat.id}
                          onClick={() => handleChatSelect(chat)}
                          className={cn(
                            "flex items-center space-x-3 px-3 py-2 rounded-md transition-colors cursor-pointer",
                            pathname === `/chat/${chat.id}`
                              ? "bg-gray-800 text-white"
                              : "text-gray-400 hover:text-white hover:bg-gray-800/50"
                          )}
                        >
                          <div
                            className={cn(
                              "h-10 w-10 rounded-full flex items-center justify-center",
                              chat.isGroup
                                ? "bg-gradient-to-r from-green-600 to-teal-600"
                                : "bg-gradient-to-r from-purple-600 to-blue-600"
                            )}
                          >
                            {chat.isGroup ? (
                              <Users className="h-5 w-5 text-white" />
                            ) : (
                              <span className="text-white text-xl font-bold">{chat.name.charAt(0).toUpperCase()}</span>
                            )}
                          </div>
                          <div className="flex-1 min-w-0 overflow-hidden">
                            <p className="text-base font-medium truncate text-white">{chat.name}</p>
                            {chat.lastMessage && (
                              <p className="text-sm truncate opacity-70 text-gray-300">
                                {chat.lastMessage.senderName}: {chat.lastMessage.deleted ? "Deleted" : chat.lastMessage.fileUrl ? "Sent a file" : chat.lastMessage.content}
                              </p>
                            )}
                          </div>
                          <div className="flex flex-col items-end space-y-0.5 ml-2 shrink-0">
                            {chat.lastMessage && (
                              <span className="text-xs text-gray-500 whitespace-nowrap">{formatTime(chat.lastMessage.timestamp)}</span>
                            )}
                            {unreadCounts[chat.id] > 0 && (
                              <div className="h-4 min-w-[16px] rounded-full bg-red-500 flex items-center justify-center px-1">
                                <span className="text-[10px] font-bold text-white">{unreadCounts[chat.id]}</span>
                              </div>
                            )}
                          </div>
                        </div>
                      ))}
                    </div>
                  )
                } else {
                  return (
                    <div className="text-center py-6 text-gray-500">
                      <MessageSquarePlus className="h-8 w-8 mx-auto mb-2" />
                      <p className="text-lg">No chats found</p>
                    </div>
                  )
                }
              })()}
            </div>
          </ScrollArea>
        ) : (
          <ScrollArea className="flex-1 w-full max-w-full pb-16">
            <div className="p-2">
              {(() => {
                const filteredFriends = searchTerm.trim()
                  ? friends.filter(friend =>
                      friend.username.toLowerCase().includes(searchTerm.toLowerCase())
                    )
                  : friends
                if (loadingFriends) {
                  return (
                    <div className="flex items-center justify-center h-16">
                      <div className="animate-spin rounded-full h-5 w-5 border-b-2 border-white"></div>
                    </div>
                  )
                } else if (filteredFriends.length > 0) {
                  return (
                    <div className="space-y-2">
                      {filteredFriends.map((friend) => (
                        <div key={friend.id} className="flex items-center space-x-3 px-3 py-2 rounded-md bg-gray-800/50">
                          <div className="h-10 w-10 rounded-full flex items-center justify-center bg-gradient-to-r from-purple-600 to-blue-600">
                            {friend.avatar ? (
                              <img src={friend.avatar} alt={friend.username} className="h-10 w-10 rounded-full object-cover" />
                            ) : (
                              <span className="text-white text-xl font-bold">{friend.username.charAt(0).toUpperCase()}</span>
                            )}
                          </div>
                          <div className="flex-1 min-w-0">
                            <p className="text-base font-medium truncate text-white">{friend.username}</p>
                          </div>
                        </div>
                      ))}
                    </div>
                  )
                } else {
                  return (
                    <div className="text-center py-6 text-gray-500">
                      <Users className="h-8 w-8 mx-auto mb-2" />
                      <p className="text-lg">No friends found</p>
                    </div>
                  )
                }
              })()}
            </div>
          </ScrollArea>
        )}
        {/* Tab dưới cùng */}
        <div className="fixed bottom-0 left-0 right-0 z-10 flex items-center justify-around border-t border-gray-800 bg-gray-900 py-2 w-full max-w-full">
          <button
            className={cn("flex flex-col items-center focus:outline-none", activeTab === "chats" ? "text-white" : "text-gray-400")}
            onClick={() => setActiveTab("chats")}
          >
            <MessageSquarePlus className="h-6 w-6 mb-1" />
            <span className="text-xs">Chats</span>
          </button>
          <button
            className={cn("flex flex-col items-center focus:outline-none", activeTab === "friends" ? "text-white" : "text-gray-400")}
            onClick={() => {
              setActiveTab("friends");
              fetchFriends();
            }}
          >
            <Users className="h-6 w-6 mb-1" />
            <span className="text-xs">Friends</span>
          </button>
          <button
            className="flex flex-col items-center text-gray-400 focus:outline-none"
            onClick={() => router.push("/profile")}
          >
            <Settings className="h-6 w-6 mb-1" />
            <span className="text-xs">Settings</span>
          </button>
        </div>
      </div>
    )
  }
  
  

  return (
    <div className="flex flex-col h-full bg-gray-900 w-full md:w-80 md:border-r md:border-gray-800">
      {/* Header */}
      <div className="p-4 border-b border-gray-800 flex items-center justify-between">
        <h1 className="text-xl font-bold text-white">Viu Chat</h1>
        <div className="flex items-center space-x-1">
          <NotificationBell />
          <Link href="/profile" className="hidden md:flex">
            <button className="text-gray-400 hover:text-white">
              <Settings className="h-6 w-6" />
              <span className="sr-only">Settings</span>
            </button>
          </Link>
          <LogoutButton />
        </div>
      </div>

      {/* User Profile Section */}
      <div className="p-4 border-b border-gray-800">
        <div className="flex items-center space-x-2 mb-4">
          <Avatar className="h-10 w-10 cursor-pointer" onClick={() => router.push("/profile")}>
            {user.avatar ? (
              <AvatarImage src={user.avatar || "/placeholder.svg"} alt={user.username} />
            ) : (
              <AvatarFallback className="bg-blue-600">
                {user.username.charAt(0).toUpperCase()}
              </AvatarFallback>
            )}
          </Avatar>
          <div>
            <p className="text-sm font-medium text-white">{user.username}</p>
            <p className="text-xs text-gray-400">{usePolling ? "Polling mode" : "Real-time mode"}</p>
          </div>
        </div>
      </div>

      {/* Search */}
      <div className="px-4 py-2 border-b border-gray-800">
        <input
          type="text"
          placeholder="Search conversations..."
          value={searchTerm}
          onChange={(e) => setSearchTerm(e.target.value)}
          className="w-full rounded-lg px-3 py-1.5 bg-gray-800 text-white placeholder-gray-500 text-sm focus:outline-none focus:ring-1 focus:ring-blue-600"
        />
      </div>

      {/* Create Chat Section */}
      <div className="p-4 border-b border-gray-800">
        <CreateChatDialog
          onChatCreated={(chat) => {
            setChats((prev) => [chat, ...prev])
            fetchChats()
          }}
        />
      </div>

      {/* Chat List */}
      <ScrollArea className="flex-1">
        <div className="p-2">
          {isLoading ? (
            <div className="flex items-center justify-center h-16">
              <div className="animate-spin rounded-full h-5 w-5 border-b-2 border-white"></div>
            </div>
          ) : chats.length > 0 ? (
            <div className="space-y-2">
              {(searchTerm.trim()
                ? chats.filter(c => c.name.toLowerCase().includes(searchTerm.toLowerCase()))
                : chats
              ).map((chat) => {
                const otherUserId = chat.isGroup ? null : chat.members.find((m: string) => m !== user.id)
                const isOnline = otherUserId ? onlineUsers[otherUserId] : false

                return (
                  <div key={chat.id} className={cn("group relative flex items-center px-3 py-2 rounded-md transition-colors cursor-pointer hover:bg-gray-800/50", pathname === `/chat/${chat.id}` && "bg-gray-800")}
                    onClick={() => handleChatSelect(chat)}
                  >
                    <div className="relative shrink-0">
                      <div
                        className={cn(
                          "h-10 w-10 rounded-full flex items-center justify-center",
                          chat.isGroup
                            ? "bg-gradient-to-r from-green-600 to-teal-600"
                            : "bg-gradient-to-r from-purple-600 to-blue-600"
                        )}
                      >
                        {chat.isGroup ? (
                          <Users className="h-5 w-5 text-white" />
                        ) : (
                          <span className="text-white text-xl font-bold">{chat.name.charAt(0).toUpperCase()}</span>
                        )}
                      </div>
                      {!chat.isGroup && <StatusDot isOnline={isOnline} />}
                    </div>
                    <div className="flex-1 min-w-0 ml-3 overflow-hidden">
                      <p className={cn("text-lg font-medium truncate", pathname === `/chat/${chat.id}` ? "text-white" : "text-gray-400")}>{chat.name}</p>
                      {chat.lastMessage && (
                        <p className="text-sm truncate opacity-70 text-gray-400">
                          {chat.lastMessage.senderName}:{" "}
                          {chat.lastMessage.deleted
                            ? "Deleted"
                            : chat.lastMessage.fileUrl
                            ? "Sent a file"
                            : chat.lastMessage.content}
                        </p>
                      )}
                    </div>
                    <div className="flex flex-col items-end justify-center space-y-1 ml-2 shrink-0" onClick={(e) => e.stopPropagation()}>
                      {chat.lastMessage && (
                        <span className="text-[11px] text-gray-600 whitespace-nowrap">{formatTime(chat.lastMessage.timestamp)}</span>
                      )}
                      {unreadCounts[chat.id] > 0 && (
                        <div className="h-5 min-w-[20px] rounded-full bg-red-500 flex items-center justify-center px-1.5">
                          <span className="text-xs font-bold text-white">{unreadCounts[chat.id]}</span>
                        </div>
                      )}
                    </div>
                    <div className="ml-1 shrink-0" onClick={(e) => e.stopPropagation()}>
                      <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                          <button className="h-7 w-7 rounded-full flex items-center justify-center text-gray-500 hover:bg-gray-700 hover:text-white">
                            <MoreVertical className="h-4 w-4" />
                          </button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="start" className="bg-gray-800 border-gray-700 text-white min-w-[180px]">
                          <DropdownMenuItem onClick={() => handleChatSelect(chat)} className="cursor-pointer hover:bg-gray-700">
                            Open
                          </DropdownMenuItem>
                          <DropdownMenuItem className="cursor-pointer hover:bg-gray-700">
                            <CheckCheck className="h-4 w-4 mr-2" /> Mark as Read
                          </DropdownMenuItem>
                          <DropdownMenuItem className="cursor-pointer hover:bg-gray-700">
                            <Pin className="h-4 w-4 mr-2" /> Pin
                          </DropdownMenuItem>
                          <DropdownMenuItem className="cursor-pointer hover:bg-gray-700">
                            <BellOff className="h-4 w-4 mr-2" /> Mute
                          </DropdownMenuItem>
                          <DropdownMenuItem className="cursor-pointer hover:bg-gray-700">
                            <Archive className="h-4 w-4 mr-2" /> Archive
                          </DropdownMenuItem>
                          <DropdownMenuSeparator className="bg-gray-700" />
                          <DropdownMenuItem className="cursor-pointer text-red-400 hover:bg-gray-700 hover:text-red-300">
                            <Trash2 className="h-4 w-4 mr-2" /> Delete
                          </DropdownMenuItem>
                        </DropdownMenuContent>
                      </DropdownMenu>
                    </div>
                  </div>
                )
              })}
            </div>
          ) : (
            <div className="text-center py-6 text-gray-500">
              <MessageSquarePlus className="h-8 w-8 mx-auto mb-2" />
              <p className="text-lg">No chats yet</p>
              <p className="text-sm">Create a new chat to get started</p>
            </div>
          )}
        </div>
      </ScrollArea>
    </div>
  )
}
