"use client"

import { useEffect, useRef, useState } from "react"
import { BookOpen, Search, Settings2, Trash2, Utensils, X } from "lucide-react"
import { Button } from "@/components/ui/button"
import { ModelSelector } from "@/components/chat/model-selector"
import { SUPPORTED_FOODS, type SupportedFood } from "@/lib/supported-foods"

interface TopbarProps {
  onSettingsClick: () => void
  onClearChat: () => void
  onNotebookClick: () => void
  llmModel: string
  visionModel: string
  llmOptions: Array<{ id: string; name: string; description?: string }>
  visionOptions: Array<{ id: string; name: string; description?: string }>
  supportedFoods?: SupportedFood[]
  onLlmModelChange: (value: string) => void
  onVisionModelChange: (value: string) => void
}

function SupportedFoodsMenu({ foods }: { foods: SupportedFood[] }) {
  const [open, setOpen] = useState(false)
  const [query, setQuery] = useState("")
  const menuRef = useRef<HTMLDivElement>(null)
  const normalizedQuery = query.trim().toLowerCase()
  const filteredFoods = normalizedQuery ? foods.filter((food) => food.name.toLowerCase().includes(normalizedQuery) || food.id.includes(normalizedQuery)) : foods

  useEffect(() => {
    if (!open) return
    const handlePointerDown = (event: MouseEvent | TouchEvent) => {
      if (event.target instanceof Node && menuRef.current && !menuRef.current.contains(event.target)) {
        setOpen(false)
      }
    }
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") setOpen(false)
    }
    document.addEventListener("mousedown", handlePointerDown)
    document.addEventListener("touchstart", handlePointerDown)
    document.addEventListener("keydown", handleKeyDown)
    return () => {
      document.removeEventListener("mousedown", handlePointerDown)
      document.removeEventListener("touchstart", handlePointerDown)
      document.removeEventListener("keydown", handleKeyDown)
    }
  }, [open])

  return (
    <div ref={menuRef} className="relative">
      <Button
        variant="outline"
        size="sm"
        onClick={() => setOpen((current) => !current)}
        aria-label="Supported foods"
        aria-haspopup="dialog"
        aria-expanded={open}
        title="Supported foods"
        className="h-8 gap-1.5 rounded-xl border-border/60 bg-background/70 px-2.5 text-xs shadow-sm backdrop-blur"
      >
        <Utensils className="h-3.5 w-3.5" />
        <span className="hidden sm:inline">Foods</span>
        <span className="text-muted-foreground">{foods.length}</span>
      </Button>

      {open && (
        <div className="absolute right-0 top-full z-50 mt-2 w-[min(23rem,calc(100vw-1.5rem))] overflow-hidden rounded-3xl border border-border/70 bg-card/95 text-card-foreground shadow-2xl backdrop-blur-xl">
          <div className="flex items-start justify-between gap-3 border-b border-border/60 p-4">
            <div>
              <p className="text-sm font-semibold">Supported foods</p>
              <p className="mt-1 text-xs text-muted-foreground">Foody recognizes these Food-101 classes.</p>
            </div>
            <button type="button" onClick={() => setOpen(false)} className="rounded-full p-1 text-muted-foreground transition hover:bg-muted hover:text-foreground" aria-label="Close supported foods">
              <X className="h-4 w-4" />
            </button>
          </div>

          <div className="border-b border-border/60 p-3">
            <div className="flex h-9 items-center gap-2 rounded-2xl border border-border/60 bg-background px-3">
              <Search className="h-4 w-4 text-muted-foreground" />
              <input
                value={query}
                onChange={(event) => setQuery(event.target.value)}
                placeholder="Search foods..."
                className="h-full min-w-0 flex-1 bg-transparent text-sm outline-none placeholder:text-muted-foreground"
              />
            </div>
          </div>

          <div className="max-h-[min(28rem,65vh)] overflow-y-auto p-3 scrollbar-hide">
            {filteredFoods.length ? (
              <div className="grid gap-1.5 sm:grid-cols-2">
                {filteredFoods.map((food) => (
                  <div key={food.id} className="rounded-2xl border border-border/40 bg-muted/25 px-3 py-2 text-xs font-medium text-foreground/90">
                    {food.name}
                  </div>
                ))}
              </div>
            ) : (
              <div className="rounded-2xl border border-border/50 bg-muted/20 p-4 text-center text-sm text-muted-foreground">No supported foods match that search.</div>
            )}
          </div>
        </div>
      )}
    </div>
  )
}

export function Topbar({ onSettingsClick, onClearChat, onNotebookClick, llmModel, visionModel, llmOptions, visionOptions, supportedFoods, onLlmModelChange, onVisionModelChange }: TopbarProps) {
  const foods = supportedFoods?.length ? supportedFoods : SUPPORTED_FOODS

  return (
    <div suppressHydrationWarning className="sticky top-0 z-30 grid min-h-14 w-full grid-cols-[1fr_auto_1fr] items-center gap-3 bg-transparent px-3 py-2 md:px-4">
      <div />
      <div className="flex min-w-0 items-center justify-center gap-2">
        <ModelSelector label="Model" value={llmModel} options={llmOptions} onChange={onLlmModelChange} icon="llm" />
        <ModelSelector label="Vision" value={visionModel} options={visionOptions} onChange={onVisionModelChange} icon="vision" align="right" />
      </div>

      <div className="flex shrink-0 items-center justify-end gap-1">
        <SupportedFoodsMenu foods={foods} />
        <Button variant="ghost" size="icon-sm" onClick={onClearChat} aria-label="Clear chat" title="Clear chat" className="rounded-xl">
          <Trash2 className="h-4 w-4" />
        </Button>
        <Button variant="ghost" size="icon-sm" onClick={onNotebookClick} aria-label="Training notebook" title="Training notebook" className="rounded-xl">
          <BookOpen className="h-4 w-4" />
        </Button>
        <Button variant="ghost" size="icon-sm" onClick={onSettingsClick} aria-label="Settings" className="rounded-xl">
          <Settings2 className="h-4 w-4" />
        </Button>
      </div>
    </div>
  )
}
