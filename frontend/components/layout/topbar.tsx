"use client"

import { BookOpen, Settings2, Trash2 } from "lucide-react"
import { Button } from "@/components/ui/button"
import { ModelSelector } from "@/components/chat/model-selector"

interface TopbarProps {
  onSettingsClick: () => void
  onClearChat: () => void
  onNotebookClick: () => void
  llmModel: string
  visionModel: string
  llmOptions: Array<{ id: string; name: string; description?: string }>
  visionOptions: Array<{ id: string; name: string; description?: string }>
  onLlmModelChange: (value: string) => void
  onVisionModelChange: (value: string) => void
}

export function Topbar({ onSettingsClick, onClearChat, onNotebookClick, llmModel, visionModel, llmOptions, visionOptions, onLlmModelChange, onVisionModelChange }: TopbarProps) {
  return (
    <div suppressHydrationWarning className="sticky top-0 z-30 grid min-h-14 w-full grid-cols-[1fr_auto_1fr] items-center gap-3 bg-transparent px-3 py-2 md:px-4">
      <div />
      <div className="flex min-w-0 items-center justify-center gap-2">
        <ModelSelector label="Model" value={llmModel} options={llmOptions} onChange={onLlmModelChange} icon="llm" />
        <ModelSelector label="Vision" value={visionModel} options={visionOptions} onChange={onVisionModelChange} icon="vision" align="right" />
      </div>

      <div className="flex shrink-0 items-center justify-end gap-1">
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
