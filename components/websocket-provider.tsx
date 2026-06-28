"use client"

import { createContext, useContext, useEffect, useState, type ReactNode } from "react"
import { useRouter, usePathname } from "next/navigation"
import { supabase } from "@/lib/db"
import type { RealtimeChannel } from "@supabase/supabase-js"

type WebSocketContextType = {
  connected: boolean
  usePolling: boolean
}

const WebSocketContext = createContext<WebSocketContextType>({
  connected: false,
  usePolling: true,
})

export function useWebSocket() {
  return useContext(WebSocketContext)
}

export function WebSocketProvider({ children }: { children: ReactNode }) {
  const [connected, setConnected] = useState(false)
  const [usePolling, setUsePolling] = useState(true)
  const router = useRouter()
  const pathname = usePathname()

  useEffect(() => {
    const channels: RealtimeChannel[] = []

    const messagesChannel = supabase
      .channel('public:messages')
      .on(
        'postgres_changes',
        { event: 'INSERT', schema: 'public', table: 'messages' },
        (payload) => {
          const message = payload.new as any
          if (pathname === `/chat/${message.chatId}`) {
            router.refresh()
          }
        }
      )
      .subscribe((status) => {
        if (status === 'SUBSCRIBED') {
          setConnected(true)
          setUsePolling(false)
        }
      })

    channels.push(messagesChannel)

    const chatsChannel = supabase
      .channel('public:chats')
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'chats' },
        () => router.refresh()
      )
      .subscribe()

    channels.push(chatsChannel)

    return () => {
      channels.forEach(ch => supabase.removeChannel(ch))
    }
  }, [router, pathname])

  return (
    <WebSocketContext.Provider value={{ connected, usePolling }}>
      {children}
    </WebSocketContext.Provider>
  )
}

export default WebSocketProvider
