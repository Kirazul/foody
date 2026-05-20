"use client"

import { useEffect, useRef, useState } from "react"
import { HiArrowDown } from "react-icons/hi"
import { Button } from "@/components/ui/button"
import { ChatMessage } from "@/components/chat/chat-message"
import type { ChatMessage as ChatMessageType } from "@/lib/types"

interface ChatMessagesProps {
  messages: ChatMessageType[]
  isGenerating?: boolean
  activeModel?: string
  onRegenerate?: (index: number) => void
  onDelete?: (index: number) => void
}

export function ChatMessages({ messages, isGenerating = false, activeModel = "Foody RAG", onRegenerate, onDelete }: ChatMessagesProps) {
  const [showScrollButton, setShowScrollButton] = useState(false)
  const [userScrolled, setUserScrolled] = useState(false)
  const viewportRef = useRef<HTMLDivElement>(null)
  const contentRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    const viewport = viewportRef.current
    if (!viewport) return
    const handleScroll = () => {
      const isNearBottom = viewport.scrollHeight - viewport.scrollTop - viewport.clientHeight < 150
      setShowScrollButton(!isNearBottom && viewport.scrollHeight > viewport.clientHeight + 50)
      if (isNearBottom) setUserScrolled(false)
    }
    const handleManualScroll = (event: WheelEvent | TouchEvent) => {
      if (event instanceof WheelEvent && event.deltaY < 0) setUserScrolled(true)
    }
    const resizeObserver = new ResizeObserver(handleScroll)
    resizeObserver.observe(viewport)
    if (contentRef.current) resizeObserver.observe(contentRef.current)
    viewport.addEventListener("scroll", handleScroll)
    viewport.addEventListener("wheel", handleManualScroll, { passive: true })
    viewport.addEventListener("touchmove", handleManualScroll, { passive: true })
    handleScroll()
    return () => {
      viewport.removeEventListener("scroll", handleScroll)
      viewport.removeEventListener("wheel", handleManualScroll)
      viewport.removeEventListener("touchmove", handleManualScroll)
      resizeObserver.disconnect()
    }
  }, [])

  useEffect(() => {
    if (!userScrolled && viewportRef.current) {
      viewportRef.current.scrollTo({ top: viewportRef.current.scrollHeight, behavior: isGenerating ? "auto" : "smooth" })
    }
  }, [messages, isGenerating, userScrolled])

  const scrollToBottom = () => {
    setUserScrolled(false)
    viewportRef.current?.scrollTo({ top: viewportRef.current.scrollHeight, behavior: "smooth" })
  }

  return (
    <div className="relative h-full flex">
      <div ref={viewportRef} className="h-full w-full overflow-y-auto scrollbar-hide">
        <div ref={contentRef} className="mx-auto w-full max-w-3xl px-4 py-6">
          {messages.map((message, index) => (
            <div key={message.id || index} id={`message-${message.id}`} className="scroll-mt-4">
              <ChatMessage
                message={message}
                index={index}
                modelName={activeModel}
                onRegenerate={message.role === "assistant" ? onRegenerate : undefined}
                onDelete={onDelete}
                hideActions={message.role === "assistant" && Boolean(message.isStreaming)}
                isLastMessage={index === messages.length - 1}
              />
            </div>
          ))}
        </div>
      </div>

      {showScrollButton && (
        <div className="absolute bottom-4 inset-x-0 flex justify-center z-10 pointer-events-none">
          <div className="flex w-full max-w-3xl justify-center px-4">
            <Button onClick={scrollToBottom} size="icon" className="h-8 w-8 rounded-full shadow-lg bg-primary hover:bg-primary/90 pointer-events-auto">
              <HiArrowDown className="h-4 w-4" />
            </Button>
          </div>
        </div>
      )}
    </div>
  )
}
