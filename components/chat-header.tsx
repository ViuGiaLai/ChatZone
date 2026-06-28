"use client"

import { cn } from "@/lib/utils"
import { useState, useEffect, useRef } from "react"
import type { Chat, TypingUser } from "@/lib/chat"
import { subscribeToTyping } from "@/lib/chat"
import { Button } from "@/components/ui/button"
import { Info, Users } from "lucide-react"
import { ChatInfoDialog } from "@/components/chat-info-dialog"
import { ChatSettingsDialog } from "@/components/chat-settings-dialog"
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar"

interface ChatHeaderProps {
  className?: string
  chat: Chat
  currentUserId?: string
  onChatUpdated?: (chat: Chat) => void
}

export function ChatHeader({ chat, currentUserId, onChatUpdated }: ChatHeaderProps) {
  const [showInfo, setShowInfo] = useState(false)
  const [currentChat, setCurrentChat] = useState<Chat>(chat)
  const [typingUsers, setTypingUsers] = useState<TypingUser[]>([])
  const typingTimers = useRef<Map<string, NodeJS.Timeout>>(new Map())

  const handleChatUpdated = (updatedChat: Chat) => {
    setCurrentChat(updatedChat)
    if (onChatUpdated) {
      onChatUpdated(updatedChat)
    }
  }

  useEffect(() => {
    const unsubscribe = subscribeToTyping(
      chat.id,
      currentUserId || '',
      (user) => {
        setTypingUsers(prev => {
          const exists = prev.find(u => u.userId === user.userId)
          if (exists) return prev
          return [...prev, user]
        })

        const existingTimer = typingTimers.current.get(user.userId)
        if (existingTimer) clearTimeout(existingTimer)

        const timer = setTimeout(() => {
          setTypingUsers(prev => prev.filter(u => u.userId !== user.userId))
          typingTimers.current.delete(user.userId)
        }, 3000)
        typingTimers.current.set(user.userId, timer)
      },
      (userId) => {
        setTypingUsers(prev => prev.filter(u => u.userId !== userId))
        const timer = typingTimers.current.get(userId)
        if (timer) clearTimeout(timer)
        typingTimers.current.delete(userId)
      }
    )

    return () => {
      unsubscribe()
      typingTimers.current.forEach(timer => clearTimeout(timer))
      typingTimers.current.clear()
    }
  }, [chat.id, currentUserId])

  const typingText = typingUsers.length === 1
    ? `${typingUsers[0].username} is typing...`
    : `${typingUsers.length} people are typing...`

  return (
    <div className="h-16 border-b border-gray-800 flex items-center justify-between px-4 bg-gray-900 shrink-0">
      <div className="flex items-center space-x-3">
        <Avatar className="h-10 w-10">
          {chat.icon ? (
            <AvatarImage src={chat.icon || "/placeholder.svg"} alt={currentChat.name} />
          ) : (
            <AvatarFallback
              className={cn(
                currentChat.isGroup
                  ? "bg-gradient-to-r from-green-600 to-teal-600"
                  : "bg-gradient-to-r from-purple-600 to-blue-600",
              )}
            >
              {currentChat.isGroup ? (
                <Users className="h-5 w-5 text-white" />
              ) : (
                <span className="text-white font-bold">{currentChat.name.charAt(0).toUpperCase()}</span>
              )}
            </AvatarFallback>
          )}
        </Avatar>
        <div>
          <h2 className="text-lg font-medium text-white">{currentChat.name}</h2>
          {typingUsers.length > 0 ? (
            <p className="text-xs text-green-400 animate-pulse">{typingText}</p>
          ) : (
            <p className="text-xs text-gray-400">
              {currentChat.isGroup ? `${currentChat.members.length} members` : "Direct message"}
            </p>
          )}
        </div>
      </div>

      <div className="flex items-center space-x-1">
        <ChatSettingsDialog chat={currentChat} onSettingsUpdated={handleChatUpdated} />
        <Button
          variant="ghost"
          size="icon"
          onClick={() => setShowInfo(true)}
          className="text-gray-400 hover:text-white"
        >
          <Info className="h-5 w-5" />
          <span className="sr-only">Chat info</span>
        </Button>
      </div>

      {showInfo && <ChatInfoDialog chat={currentChat} onClose={() => setShowInfo(false)} onChatUpdated={handleChatUpdated} />}
    </div>
  )
}
