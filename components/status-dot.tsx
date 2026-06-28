"use client"

import { cn } from "@/lib/utils"

interface StatusDotProps {
  isOnline?: boolean
  lastSeen?: string
  className?: string
}

export function StatusDot({ isOnline, lastSeen, className }: StatusDotProps) {
  const isRecent = lastSeen && (Date.now() - new Date(lastSeen).getTime()) < 5 * 60 * 1000
  const showOnline = isOnline || isRecent

  return (
    <span
      className={cn(
        "absolute bottom-0 right-0 h-3 w-3 rounded-full border-2 border-gray-900",
        showOnline ? "bg-green-500" : "bg-gray-500",
        className
      )}
    />
  )
}
