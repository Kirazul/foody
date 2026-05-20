"use client"

import { MessageCircle, PanelLeftClose, Pencil, Search, Settings, Trash2 } from "lucide-react"
import { Button } from "@/components/ui/button"
import type { ConversationSummary } from "@/lib/types"
import { cn } from "@/lib/utils"

interface SidebarProps {
  isOpen: boolean
  conversations: ConversationSummary[]
  activeConversationId: string
  onToggle: () => void
  onNewChat: () => void
  onSelectConversation: (id: string) => void
  onDeleteConversation: (id: string) => void
  onSettingsClick: () => void
}

export function Sidebar({ isOpen, conversations, activeConversationId, onToggle, onNewChat, onSelectConversation, onDeleteConversation, onSettingsClick }: SidebarProps) {
  return (
    <>
      {isOpen && <div className="fixed inset-0 z-40 bg-black/50 md:hidden" onClick={onToggle} />}
      <aside
        className={cn(
          "fixed inset-y-0 left-0 z-50 flex flex-col transition-all duration-200 ease-out",
          "h-[100dvh] modern-sidebar",
          "md:relative md:translate-x-0",
          isOpen ? "w-[280px] translate-x-0 md:w-60" : "-translate-x-full md:w-0 md:opacity-0 md:pointer-events-none"
        )}
        style={{ background: "hsl(var(--card))" }}
        aria-hidden={!isOpen}
        data-state={isOpen ? "open" : "closed"}
      >
        <div className="flex items-center justify-between px-4 pt-4 py-1 border-border/20">
          <button onClick={onNewChat} className="flex items-center gap-1.5">
            <h1 className="text-lg font-extrabold tracking-tighter bg-gradient-to-r from-primary to-primary/60 bg-clip-text text-transparent">foody</h1>
          </button>
          <Button variant="ghost" size="icon" className="h-7 w-7 md:flex transition-colors hover:bg-accent" onClick={onToggle} aria-label="Close sidebar">
            <PanelLeftClose className="h-4 w-4" />
          </Button>
        </div>

        <div className="flex flex-col gap-1 px-1 py-1.5">
          <Button variant="ghost" className="w-full rounded-xl justify-start gap-2 h-8 text-xs font-normal text-muted-foreground hover:bg-muted/50 transition-colors" onClick={onNewChat}>
            <Pencil className="h-3.5 w-3.5" />
            New Chat
          </Button>
          <Button variant="ghost" size="sm" className="w-full rounded-xl h-8 gap-2 justify-start text-xs font-normal text-muted-foreground relative group hover:bg-muted/50">
            <Search className="h-3.5 w-3.5" />
            Search
            <kbd className="pointer-events-none absolute right-2 top-2 hidden h-5 select-none items-center gap-0.5 rounded border bg-muted px-1 font-mono text-[9px] font-medium text-muted-foreground opacity-0 group-hover:opacity-100 transition-opacity sm:flex">
              <span className="text-[10px]">⌘</span>K
            </kbd>
          </Button>
        </div>

        <div className="flex-1 min-h-0 overflow-y-auto px-1.5 scrollbar-hide">
          <div className="flex flex-col gap-2 pb-4">
            <div className="space-y-0.5">
              <button className="group flex w-full items-center justify-between px-1.5 py-1 text-[10px] font-medium text-muted-foreground hover:text-foreground">
                <span>Chats</span>
              </button>
              {conversations.length === 0 ? (
                <div className="px-2 py-3 text-center text-[10px] text-muted-foreground">No chats yet</div>
              ) : (
                conversations.map((conversation) => (
                  <div key={conversation.id} className="group relative">
                    <button
                      onClick={() => onSelectConversation(conversation.id)}
                      className={cn(
                        "flex w-full items-center gap-1 px-1.5 py-1 rounded-md hover:bg-muted/50 transition-colors text-left",
                        activeConversationId === conversation.id && "bg-muted/60"
                      )}
                    >
                      <MessageCircle className="h-3 w-3 shrink-0 text-muted-foreground" />
                      <span className="text-[11px] truncate flex-1 text-muted-foreground">{conversation.title || "New chat"}</span>
                    </button>
                    <div className="absolute right-0.5 top-1/2 flex -translate-y-1/2 opacity-0 group-hover:opacity-100 bg-background/80 rounded p-0.5">
                      <Button variant="ghost" size="icon" className="h-5 w-5 hover:bg-muted" onClick={() => onDeleteConversation(conversation.id)} title="Delete">
                        <Trash2 className="h-3 w-3 text-muted-foreground hover:text-destructive" />
                      </Button>
                    </div>
                  </div>
                ))
              )}
            </div>
          </div>
        </div>

        <div className="border-t border-border/30 p-2">
          <button onClick={onSettingsClick} className="flex w-full items-center gap-2 rounded-xl px-2 py-2 text-left text-xs text-muted-foreground transition hover:bg-muted/50 hover:text-foreground">
            <div className="flex h-8 w-8 items-center justify-center rounded-full bg-primary/10 text-primary">F</div>
            <div className="min-w-0 flex-1">
              <p className="truncate font-medium text-foreground">Foody</p>
              <p className="truncate text-[10px]">Settings and models</p>
            </div>
            <Settings className="h-3.5 w-3.5" />
          </button>
        </div>
      </aside>
    </>
  )
}
