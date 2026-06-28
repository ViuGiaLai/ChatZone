"use client"

import { useEffect, useState, useCallback, use } from "react"
import { useRouter } from "next/navigation"
import { ChatHeader } from "@/components/chat-header"
import { MessageList } from "@/components/message-list"
import { MessageInput } from "@/components/message-input"
import { useWebSocket } from "@/components/websocket-provider"
import type { Chat, Message } from "@/lib/chat"
import { getCurrentUser } from "@/lib/auth-client"
import { Alert, AlertDescription } from "@/components/ui/alert"
import { AlertCircle, RefreshCcw } from "lucide-react"
import { Button } from "@/components/ui/button"

async function getChatData(chatId: string) {
  try {
    const response = await fetch(`/api/chats/${chatId}`, {
      credentials: "include", // Important: include cookies in the request
      cache: "no-store", // Don't cache the response
    })

    if (!response.ok) {
      const errorText = await response.text()
      throw new Error(`Failed to fetch chat: ${errorText}`)
    }

    return response.json()
  } catch (error) {
    console.error("Error fetching chat:", error)
    throw error
  }
}

async function getMessages(chatId: string) {
  try {
    const response = await fetch(`/api/chats/${chatId}/messages`, {
      credentials: "include", // Important: include cookies in the request
      cache: "no-store", // Don't cache the response
    })

    if (!response.ok) {
      const errorText = await response.text()
      throw new Error(`Failed to fetch messages: ${errorText}`)
    }

    return response.json()
  } catch (error) {
    console.error("Error fetching messages:", error)
    throw error
  }
}

async function markMessageAsRead(messageId: string, chatId: string) {
  try {
    await fetch(`/api/messages/${messageId}`, {
      method: "PATCH",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ chatId }),
      credentials: "include", // Important: include cookies in the request
    })
  } catch (error) {
    console.error("Error marking message as read:", error)
  }
}

export default function ChatPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params)
  const router = useRouter()
  const { usePolling } = useWebSocket()
  const [user, setUser] = useState<any>(null)
  const [chat, setChat] = useState<Chat | null>(null)
  const [messages, setMessages] = useState<Message[]>([])
  const [users, setUsers] = useState<Record<string, any>>({})
  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [fetchError, setFetchError] = useState<string | null>(null)
  const [retryCount, setRetryCount] = useState(0)
  const [authError, setAuthError] = useState<boolean>(false)

  const fetchMessages = useCallback(async () => {
    if (!id) return

    try {
      setFetchError(null)
      const messagesData = await getMessages(id)
      setMessages(Array.isArray(messagesData) ? messagesData : [])
    } catch (error) {
      console.error("Error fetching messages:", error)

      // Check if it's an authentication error
      if (error instanceof Error && error.message.includes("Unauthorized")) {
        setAuthError(true)
        router.push("/login")
        return
      }

      setFetchError("Failed to fetch messages. Retrying...")
      // Don't set error state here to avoid disrupting the UI during polling
    }
  }, [id, router])

  const fetchUsers = useCallback(async () => {
    try {
      const response = await fetch("/api/users", {
        credentials: "include", // Important: include cookies in the request
        cache: "no-store", // Don't cache the response
      })

      if (response.ok) {
        const usersData = await response.json()
        const usersMap: Record<string, any> = {}
        usersData.forEach((user: any) => {
          usersMap[user.id] = user
        })
        setUsers(usersMap)
      }
    } catch (error) {
      console.error("Error fetching users:", error)
    }
  }, [])

  const handleMessageRead = useCallback(
    (messageId: string) => {
      if (id) {
        markMessageAsRead(messageId, id)
      }
    },
    [id],
  )

  const handleRetry = useCallback(() => {
    setRetryCount((prev) => prev + 1)
    setIsLoading(true)
    setError(null)
    setFetchError(null)
    setAuthError(false)
  }, [])

  useEffect(() => {
    async function loadData() {
      try {
        setIsLoading(true)
        setError(null)
        setAuthError(false)

        // Try to get the current user
        const userData = await getCurrentUser()
        if (!userData) {
          // If not logged in, redirect to login
          setAuthError(true)
          router.push("/login")
          return
        }
        setUser(userData)

        // Try to get chat data
        try {
          const chatData = await getChatData(id)
          setChat(chatData)

          // Check if user is a member of this chat
          if (!chatData.members.includes(userData.id)) {
            setError("You are not a member of this chat")
            setIsLoading(false)
            return
          }
        } catch (chatError) {
          console.error("Error loading chat:", chatError)

          if (chatError instanceof Error && chatError.message.includes("Unauthorized")) {
            setAuthError(true)
            router.push("/login")
            return
          }

          // Chat not found — redirect to dashboard
          if (chatError instanceof Error && chatError.message.includes("not found")) {
            router.push("/dashboard")
            return
          }

          setError("Failed to load chat. Please try again.")
          setIsLoading(false)
          return
        }

        // Try to fetch messages
        try {
          await fetchMessages()
        } catch (messagesError) {
          console.error("Error loading messages:", messagesError)

          // Check if it's an authentication error
          if (messagesError instanceof Error && messagesError.message.includes("Unauthorized")) {
            setAuthError(true)
            router.push("/login")
            return
          }

          setFetchError("Failed to load messages. Please try again.")
        }

        // Try to fetch users
        try {
          await fetchUsers()
        } catch (usersError) {
          console.error("Error loading users:", usersError)
        }
      } catch (error) {
        console.error("Error loading chat data:", error)

        // Check if it's an authentication error
        if (error instanceof Error && error.message.includes("Unauthorized")) {
          setAuthError(true)
          router.push("/login")
          return
        }

        setError("Failed to load chat data. Please try again.")
      } finally {
        setIsLoading(false)
      }
    }

    loadData()

    // Set up polling for new messages if WebSockets aren't available
    let interval: NodeJS.Timeout | null = null

    if (usePolling) {
      interval = setInterval(fetchMessages, 5000)
    }

    return () => {
      if (interval) {
        clearInterval(interval)
      }
    }
  }, [id, router, fetchMessages, fetchUsers, usePolling, retryCount])

  if (authError) {
    // If there's an authentication error, we'll redirect to login
    // This is just a fallback in case the redirect in the useEffect doesn't work
    return (
      <div className="flex-1 flex flex-col items-center justify-center p-6 text-center">
        <Alert variant="destructive" className="mb-4 bg-red-900/20 border-red-800 max-w-md">
          <AlertCircle className="h-4 w-4" />
          <AlertDescription className="text-red-300">You need to log in to access this chat.</AlertDescription>
        </Alert>
        <Button onClick={() => router.push("/login")} className="mt-4">
          Go to Login
        </Button>
      </div>
    )
  }

  if (isLoading) {
    return (
      <div className="flex-1 flex items-center justify-center">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-white"></div>
      </div>
    )
  }

  if (error) {
    return (
      <div className="flex-1 flex flex-col items-center justify-center p-6 text-center">
        <Alert variant="destructive" className="mb-4 bg-red-900/20 border-red-800 max-w-md">
          <AlertCircle className="h-4 w-4" />
          <AlertDescription className="text-red-300">{error}</AlertDescription>
        </Alert>
        <Button onClick={handleRetry} className="mt-4 flex items-center space-x-2">
          <RefreshCcw className="h-4 w-4 mr-2" />
          Try Again
        </Button>
      </div>
    )
  }

  if (!chat || !user) {
    return (
      <div className="flex-1 flex flex-col items-center justify-center p-6 text-center">
        <Alert variant="destructive" className="mb-4 bg-red-900/20 border-red-800 max-w-md">
          <AlertCircle className="h-4 w-4" />
          <AlertDescription className="text-red-300">Chat data could not be loaded</AlertDescription>
        </Alert>
        <Button onClick={handleRetry} className="mt-4 flex items-center space-x-2">
          <RefreshCcw className="h-4 w-4 mr-2" />
          Try Again
        </Button>
      </div>
    )
  }

  return (
    <>
      <ChatHeader
        chat={chat}
        currentUserId={user.id}
        onChatUpdated={(updatedChat) => setChat(updatedChat)}
      />

      {fetchError && (
        <Alert variant="destructive" className="m-2 bg-red-900/20 border-red-800">
          <AlertCircle className="h-4 w-4" />
          <AlertDescription>{fetchError}</AlertDescription>
        </Alert>
      )}

      {usePolling && (
        <div className="bg-yellow-900/20 border border-yellow-800 text-yellow-300 px-4 py-2 text-sm text-center">
          Using polling mode. Real-time updates may be delayed.
        </div>
      )}

      <MessageList
        className="w-full flex-1"
        messages={messages}
        currentUserId={user.id}
        chatTheme={chat.theme}
        onMessageRead={handleMessageRead}
        users={users}
      />

      <MessageInput
        chatId={id}
        userId={user.id}
        username={user.username}
        onMessageSent={fetchMessages}
        chatTheme={chat.theme}
      />
    </>
  )
}
