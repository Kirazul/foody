"use client"

import { Ban, Check, ChevronDown, Cpu, Search } from "lucide-react"
import { useEffect, useMemo, useRef, useState } from "react"
import { SiOpenai } from "react-icons/si"
import { RiBrain2Line, RiLeafLine, RiRestaurant2Line } from "react-icons/ri"
import { cn } from "@/lib/utils"

interface ModelSelectorProps {
  label: string
  value: string
  options: Array<{ id: string; name: string; description?: string }>
  onChange: (value: string) => void
  icon?: "llm" | "vision"
  shortcut?: string
  align?: "left" | "right"
}

function modelIcon(model: string, type: "llm" | "vision") {
  const value = model.toLowerCase()
  if (value === "none" || value === "off") return Ban
  if (type === "vision") return Cpu
  if (value.includes("gpt") || value.includes("openai") || value.includes("o1") || value.includes("o3") || value.includes("o4")) return SiOpenai
  if (value.includes("food") || value.includes("recipe")) return RiRestaurant2Line
  if (value.includes("green") || value.includes("eco")) return RiLeafLine
  return RiBrain2Line
}

function ModelLogo({ model, type, className }: { model: string; type: "llm" | "vision"; className?: string }) {
  const Icon = modelIcon(model, type)
  return (
    <span className={cn("flex size-5 shrink-0 items-center justify-center rounded-full border border-border bg-background text-foreground shadow-sm", className)}>
      <Icon className="size-3.5" />
    </span>
  )
}

export function ModelSelector({ label, value, options, onChange, icon = "llm", shortcut, align = "left" }: ModelSelectorProps) {
  const [open, setOpen] = useState(false)
  const [query, setQuery] = useState("")
  const ref = useRef<HTMLDivElement>(null)
  const selected = options.find((item) => item.id === value) || { id: value, name: value }
  const filteredOptions = useMemo(() => {
    const needle = query.trim().toLowerCase()
    if (!needle) return options
    return options.filter((option) => `${option.name} ${option.id} ${option.description || ""}`.toLowerCase().includes(needle))
  }, [options, query])

  useEffect(() => {
    const handleClick = (event: MouseEvent) => {
      if (ref.current && !ref.current.contains(event.target as Node)) setOpen(false)
    }
    document.addEventListener("mousedown", handleClick)
    return () => document.removeEventListener("mousedown", handleClick)
  }, [])

  useEffect(() => {
    if (!shortcut) return
    const handleKeyDown = (event: KeyboardEvent) => {
      if ((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === shortcut.toLowerCase()) {
        event.preventDefault()
        setOpen((current) => !current)
      }
    }
    document.addEventListener("keydown", handleKeyDown)
    return () => document.removeEventListener("keydown", handleKeyDown)
  }, [shortcut])

  return (
    <div ref={ref} className="relative min-w-0">
      <button
        type="button"
        onClick={() => setOpen((current) => !current)}
        className="group inline-flex h-9 max-w-[44vw] items-center gap-2 rounded-2xl border border-primary/20 bg-primary/10 px-2 text-sm text-primary transition hover:bg-primary/15 sm:max-w-none"
      >
        <ModelLogo model={selected.id || selected.name} type={icon} className="border-primary/25 bg-primary/10 text-primary" />
        <span className="max-w-[130px] truncate font-medium sm:max-w-[210px]">{selected.name}</span>
        {shortcut && (
          <kbd className="pointer-events-none hidden h-5 select-none items-center gap-1 rounded border bg-muted px-1.5 font-mono text-[10px] font-medium text-muted-foreground opacity-100 md:flex">
            <span className="text-xs">⌘</span>{shortcut}
          </kbd>
        )}
        <ChevronDown className={cn("h-3.5 w-3.5 text-primary/70 transition", open && "rotate-180")} />
      </button>
      {open && (
        <div className={cn("absolute top-full z-50 mt-2 w-[330px] overflow-hidden rounded-2xl border border-border bg-card shadow-none", align === "right" ? "right-0" : "left-0")}>
          <div className="flex items-center gap-2 border-b border-border px-3 py-2.5">
            <Search className="h-4 w-4 shrink-0 text-muted-foreground" />
            <input value={query} onChange={(event) => setQuery(event.target.value)} placeholder={`Search ${label.toLowerCase()}...`} className="min-w-0 flex-1 bg-transparent text-sm outline-none placeholder:text-muted-foreground" autoFocus />
          </div>
          <div className="max-h-80 overflow-y-auto p-1.5 scrollbar-hide">
            {filteredOptions.length === 0 ? (
              <div className="px-3 py-8 text-center text-sm text-muted-foreground">No model found.</div>
            ) : (
              filteredOptions.map((option) => {
                const isSelected = option.id === value
                return (
                  <button
                    key={option.id}
                    type="button"
                    onClick={() => {
                      onChange(option.id)
                      setOpen(false)
                      setQuery("")
                    }}
                    className={cn("flex w-full items-center gap-3 rounded-xl px-2.5 py-2 text-left transition-colors hover:bg-accent", isSelected && "bg-primary/10 text-primary")}
                  >
                    <ModelLogo model={option.id || option.name} type={icon} className={cn("size-7", isSelected && "border-primary/25 bg-primary/10 text-primary")} />
                    <span className="min-w-0 flex-1">
                      <span className={cn("block truncate text-sm font-medium text-foreground", isSelected && "text-primary")}>{option.name}</span>
                      {option.description && <span className="mt-0.5 block line-clamp-2 text-xs text-muted-foreground">{option.description}</span>}
                    </span>
                    {isSelected && <Check className="h-4 w-4 shrink-0 text-primary" />}
                  </button>
                )
              })
            )}
          </div>
        </div>
      )}
    </div>
  )
}
