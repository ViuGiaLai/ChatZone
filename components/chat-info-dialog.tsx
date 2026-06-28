"use client"

import { useState, useEffect } from "react"
import type { Chat } from "@/lib/chat"
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { ScrollArea } from "@/components/ui/scroll-area"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Users, Plus, Check, X } from "lucide-react"
import { getAllUsersAction } from "@/app/actions"
import type { User } from "@/lib/auth"
import { cn } from "@/lib/utils"

interface ChatInfoDialogProps {
  chat: Chat
  onClose: () => void
  onChatUpdated?: (chat: Chat) => void
}

export function ChatInfoDialog({ chat, onClose, onChatUpdated }: ChatInfoDialogProps) {
  const [users, setUsers] = useState<Record<string, Omit<User, "password">>>({})
  const [showAddMembers, setShowAddMembers] = useState(false)
  const [selectedUsers, setSelectedUsers] = useState<string[]>([])
  const [searchQuery, setSearchQuery] = useState("")
  const [adding, setAdding] = useState(false)

  useEffect(() => {
    async function loadUsers() {
      const result = await getAllUsersAction()
      if (result.success) {
        const usersMap: Record<string, Omit<User, "password">> = {}
        result.users.forEach((user) => {
          usersMap[user.id] = user
        })
        setUsers(usersMap)
      }
    }

    loadUsers()
  }, [])

  const nonMembers = Object.values(users).filter(
    (u) => !chat.members.includes(u.id) &&
      u.username?.toLowerCase().includes(searchQuery.toLowerCase())
  )

  const toggleUser = (id: string) => {
    setSelectedUsers((prev) =>
      prev.includes(id) ? prev.filter((uid) => uid !== id) : [...prev, id]
    )
  }

  const handleAddMembers = async () => {
    if (selectedUsers.length === 0) return
    setAdding(true)
    try {
      const res = await fetch(`/api/chats/${chat.id}/members`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ members: selectedUsers }),
      })
      if (res.ok) {
        const updatedChat: Chat = {
          ...chat,
          members: [...chat.members, ...selectedUsers],
        }
        onChatUpdated?.(updatedChat)
        setShowAddMembers(false)
        setSelectedUsers([])
      }
    } finally {
      setAdding(false)
    }
  }

  return (
    <Dialog open={true} onOpenChange={onClose}>
      <DialogContent className="bg-gray-900 border-gray-800 text-white">
        <DialogHeader>
          <DialogTitle>{chat.name}</DialogTitle>
        </DialogHeader>

        <div className="space-y-4">
          <div>
            <h3 className="text-sm font-medium text-gray-400 mb-2">Chat Type</h3>
            <div className="flex items-center space-x-2 text-white">
              {chat.isGroup ? (
                <>
                  <Users className="h-4 w-4" />
                  <span>Group Chat</span>
                </>
              ) : (
                <span>Direct Message</span>
              )}
            </div>
          </div>

          <div>
            <h3 className="text-sm font-medium text-gray-400 mb-2">Created</h3>
            <p className="text-white">
              {new Date(chat.createdAt).toLocaleDateString()} at {new Date(chat.createdAt).toLocaleTimeString()}
            </p>
          </div>

          <div>
            <div className="flex items-center justify-between mb-2">
              <h3 className="text-sm font-medium text-gray-400">Members ({chat.members.length})</h3>
              {chat.isGroup && !showAddMembers && (
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => setShowAddMembers(true)}
                  className="text-blue-400 hover:text-blue-300 h-7 px-2"
                >
                  <Plus className="h-4 w-4 mr-1" />
                  Add
                </Button>
              )}
            </div>

            {showAddMembers && (
              <div className="mb-3 p-3 rounded-lg bg-gray-800 border border-gray-700 space-y-2">
                <div className="flex items-center gap-2">
                  <Input
                    placeholder="Search users..."
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    className="h-8 bg-gray-700 border-gray-600 text-sm"
                  />
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => {
                      setShowAddMembers(false)
                      setSelectedUsers([])
                      setSearchQuery("")
                    }}
                    className="h-8 w-8 p-0"
                  >
                    <X className="h-4 w-4" />
                  </Button>
                </div>
                <ScrollArea className="h-32">
                  <div className="space-y-1">
                    {nonMembers.length === 0 ? (
                      <p className="text-xs text-gray-500 text-center py-2">No users found</p>
                    ) : (
                      nonMembers.map((u) => (
                        <button
                          key={u.id}
                          onClick={() => toggleUser(u.id)}
                          className={cn(
                            "flex items-center gap-2 w-full p-2 rounded-md text-left text-sm transition-colors",
                            selectedUsers.includes(u.id)
                              ? "bg-blue-600/30 text-blue-300"
                              : "hover:bg-gray-700 text-gray-300"
                          )}
                        >
                          <div className={cn(
                            "h-4 w-4 rounded border flex items-center justify-center",
                            selectedUsers.includes(u.id)
                              ? "bg-blue-500 border-blue-500"
                              : "border-gray-500"
                          )}>
                            {selectedUsers.includes(u.id) && <Check className="h-3 w-3" />}
                          </div>
                          <div className="h-6 w-6 rounded-full bg-gradient-to-r from-purple-600 to-blue-600 flex items-center justify-center text-white text-xs font-bold flex-shrink-0">
                            {u.username?.charAt(0).toUpperCase() || "?"}
                          </div>
                          <span>{u.username}</span>
                        </button>
                      ))
                    )}
                  </div>
                </ScrollArea>
                <Button
                  size="sm"
                  onClick={handleAddMembers}
                  disabled={selectedUsers.length === 0 || adding}
                  className="w-full bg-blue-600 hover:bg-blue-700 text-white"
                >
                  {adding ? "Adding..." : `Add ${selectedUsers.length} member${selectedUsers.length !== 1 ? "s" : ""}`}
                </Button>
              </div>
            )}

            <ScrollArea className="h-40">
              <div className="space-y-2">
                {chat.members.map((memberId) => {
                  const user = users[memberId]
                  return (
                    <div key={memberId} className="flex items-center space-x-3 p-2 rounded-md">
                      <div className="h-8 w-8 rounded-full bg-gradient-to-r from-purple-600 to-blue-600 flex items-center justify-center text-white text-xs font-bold">
                        {user?.username?.charAt(0).toUpperCase() || "?"}
                      </div>
                      <div>
                        <p className="text-sm font-medium text-white">
                          {user?.username || "Unknown User"}
                          {memberId === chat.createdBy && <span className="ml-2 text-xs text-gray-400">(Creator)</span>}
                        </p>
                      </div>
                    </div>
                  )
                })}
              </div>
            </ScrollArea>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  )
}
