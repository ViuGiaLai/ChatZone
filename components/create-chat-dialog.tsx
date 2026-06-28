"use client"

import type React from "react"

import { useState, useEffect } from "react"
import { useRouter } from "next/navigation"
import { Button } from "@/components/ui/button"
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Checkbox } from "@/components/ui/checkbox"
import { ScrollArea } from "@/components/ui/scroll-area"
import { MessageSquarePlus, Users } from "lucide-react"
import type { Chat } from "@/lib/chat"
import type { User } from "@/lib/auth"

interface CreateChatDialogProps {
  onChatCreated: (chat: Chat) => void
  triggerClassName?: string
  triggerContent?: React.ReactNode
}

export function CreateChatDialog({ onChatCreated, triggerClassName, triggerContent }: CreateChatDialogProps) {
  const router = useRouter()
  const [open, setOpen] = useState(false)
  const [name, setName] = useState("")
  const [isGroup, setIsGroup] = useState(false)
  const [users, setUsers] = useState<Omit<User, "password">[]>([])
  const [selectedUsers, setSelectedUsers] = useState<string[]>([])
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [isLoadingUsers, setIsLoadingUsers] = useState(false)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    async function loadUsers() {
      if (!open) return

      setIsLoadingUsers(true)
      setError(null)

      try {
        const response = await fetch("/api/users")
        if (response.ok) {
          const data = await response.json()
          setUsers(data)
        } else {
          const errorText = await response.text()
          console.error("Failed to load users:", errorText)
          setError("Failed to load users")
        }
      } catch (error) {
        console.error("Error loading users:", error)
        setError("Error loading users")
      } finally {
        setIsLoadingUsers(false)
      }
    }

    if (open) {
      loadUsers()
    } else {
      // Reset form when dialog closes
      setName("")
      setIsGroup(false)
      setSelectedUsers([])
      setError(null)
    }
  }, [open])

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setError(null)

    if (!name || isSubmitting) return

    if (selectedUsers.length === 0) {
      setError("Please select at least one user")
      return
    }

    setIsSubmitting(true)

    try {
      const response = await fetch("/api/chats", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          name,
          isGroup,
          members: selectedUsers,
        }),
      })

      const responseData = await response.json()
      
      if (response.ok && responseData) {
        console.log('Chat creation response:', responseData)
        if (!responseData.id) {
          throw new Error('Invalid chat data received from server')
        }
        onChatCreated(responseData)
        setOpen(false)
        router.push(`/chat/${responseData.id}`)
      } else {
        console.error('Error response:', responseData)
        setError(responseData.error || "Failed to create chat")
      }
    } catch (error) {
      console.error("Error creating chat:", error)
      setError("An unexpected error occurred")
    } finally {
      setIsSubmitting(false)
    }
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button className={triggerClassName || "w-full bg-gradient-to-r from-purple-600 to-blue-600 hover:from-purple-700 hover:to-blue-700 text-white"}>
          {triggerContent ?? <><MessageSquarePlus className="h-5 w-5 mr-2" />New Chat</>}
        </Button>
      </DialogTrigger>
      <DialogContent className="bg-gray-900 border-gray-800 text-white">
        <DialogHeader>
          <DialogTitle>Create a new chat</DialogTitle>
        </DialogHeader>
        {error && (
          <div className="bg-red-900/20 border border-red-800 text-red-300 px-4 py-2 rounded-md mb-4">{error}</div>
        )}
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="name" className="text-gray-300">
              Chat Name
            </Label>
            <Input
              id="name"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="Enter chat name"
              required
              className="bg-gray-800 border-gray-700 text-white"
            />
          </div>

          <div className="flex items-center space-x-2">
            <Checkbox
              id="isGroup"
              checked={isGroup}
              onCheckedChange={(checked) => setIsGroup(checked as boolean)}
              className="border-gray-600 data-[state=checked]:bg-purple-600"
            />
            <Label htmlFor="isGroup" className="text-gray-300">
              <div className="flex items-center">
                <Users className="h-4 w-4 mr-2" />
                Create as group chat
              </div>
            </Label>
          </div>

          <div className="space-y-2">
            <Label className="text-gray-300">Select Users</Label>
            <ScrollArea className="h-40 border rounded-md border-gray-800 bg-gray-800 p-2">
              {isLoadingUsers ? (
                <div className="flex items-center justify-center h-full">
                  <div className="animate-spin rounded-full h-5 w-5 border-b-2 border-white"></div>
                </div>
              ) : users.length > 0 ? (
                <div className="space-y-2">
                  {users.map((user) => (
                    <div key={user.id} className="flex items-center space-x-2">
                      <Checkbox
                        id={`user-${user.id}`}
                        checked={selectedUsers.includes(user.id)}
                        onCheckedChange={(checked) => {
                          if (checked) {
                            setSelectedUsers([...selectedUsers, user.id])
                          } else {
                            setSelectedUsers(selectedUsers.filter((id) => id !== user.id))
                          }
                        }}
                        className="border-gray-600 data-[state=checked]:bg-purple-600"
                      />
                      <Label htmlFor={`user-${user.id}`} className="text-gray-300 cursor-pointer">
                        {user.username}
                      </Label>
                    </div>
                  ))}
                </div>
              ) : (
                <div className="flex items-center justify-center h-full">
                  <p className="text-gray-500">No users available</p>
                </div>
              )}
            </ScrollArea>
          </div>

          <Button
            type="submit"
            disabled={!name || isSubmitting || selectedUsers.length === 0}
            className="w-full bg-gradient-to-r from-purple-600 to-blue-600 hover:from-purple-700 hover:to-blue-700 text-white"
          >
            {isSubmitting ? "Creating..." : "Create Chat"}
          </Button>
        </form>
      </DialogContent>
    </Dialog>
  )
}
