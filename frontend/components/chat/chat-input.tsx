"use client"

import type React from "react"
import { ChangeEvent, FormEvent, useEffect, useRef, useState } from "react"
import { ArrowUp, ImageIcon, Plus, Square, X } from "lucide-react"
import { RiAttachment2, RiSparkling2Line } from "react-icons/ri"
import { Button } from "@/components/ui/button"
import { Textarea } from "@/components/ui/textarea"
import { cn } from "@/lib/utils"
import type { AttachmentPreview } from "@/lib/types"

interface ChatInputProps {
  onSend: (content: string, attachment?: AttachmentPreview | null) => void
  isBusy: boolean
  hasMessages?: boolean
  activeModel?: string
  visionModel?: string
  onStopGeneration?: () => void
}

const compressImage = async (file: File): Promise<string> => {
  return new Promise((resolve, reject) => {
    const reader = new FileReader()
    reader.readAsDataURL(file)
    reader.onload = (event) => {
      const img = new Image()
      img.src = event.target?.result as string
      img.onload = () => {
        const canvas = document.createElement("canvas")
        const maxSize = 1536
        let { width, height } = img
        if (width > height && width > maxSize) {
          height *= maxSize / width
          width = maxSize
        } else if (height > maxSize) {
          width *= maxSize / height
          height = maxSize
        }
        canvas.width = width
        canvas.height = height
        canvas.getContext("2d")?.drawImage(img, 0, 0, width, height)
        resolve(canvas.toDataURL("image/jpeg", 0.86))
      }
      img.onerror = reject
    }
    reader.onerror = reject
  })
}

function dataUrlToFile(dataUrl: string, fileName: string): File {
  const [header, data] = dataUrl.split(",")
  const mime = header.match(/:(.*?);/)?.[1] || "image/jpeg"
  const binary = atob(data)
  const array = new Uint8Array(binary.length)
  for (let index = 0; index < binary.length; index += 1) array[index] = binary.charCodeAt(index)
  return new File([array], fileName.replace(/\.[^.]+$/, ".jpg"), { type: mime })
}

export function ChatInput({ onSend, isBusy, hasMessages = false, activeModel = "Foody RAG", visionModel = "EfficientNetB3", onStopGeneration }: ChatInputProps) {
  const [input, setInput] = useState("")
  const [attachment, setAttachment] = useState<AttachmentPreview | null>(null)
  const [addMenuOpen, setAddMenuOpen] = useState(false)
  const [previewImage, setPreviewImage] = useState<AttachmentPreview | null>(null)
  const [isDragging, setIsDragging] = useState(false)
  const textareaRef = useRef<HTMLTextAreaElement>(null)
  const fileInputRef = useRef<HTMLInputElement>(null)
  const canSubmit = (input.trim().length > 0 || attachment) && !isBusy

  useEffect(() => {
    const textarea = textareaRef.current
    if (!textarea) return
    textarea.style.height = "0px"
    textarea.style.height = `${Math.min(textarea.scrollHeight, 180)}px`
  }, [input])

  const attachFile = async (file: File) => {
    if (!file.type.startsWith("image/")) return
    const url = await compressImage(file)
    setAttachment({ name: file.name, url, type: "image/jpeg", file: dataUrlToFile(url, file.name) })
    setAddMenuOpen(false)
  }

  const handleFileChange = async (event: ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0]
    if (file) await attachFile(file)
    if (fileInputRef.current) fileInputRef.current.value = ""
  }

  const submit = () => {
    if (!canSubmit) return
    onSend(input.trim(), attachment)
    setInput("")
    setAttachment(null)
    setAddMenuOpen(false)
    textareaRef.current?.focus()
  }

  const handleSubmit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    submit()
  }

  const handleDrop = async (event: React.DragEvent<HTMLDivElement>) => {
    event.preventDefault()
    setIsDragging(false)
    const file = Array.from(event.dataTransfer.files).find((item) => item.type.startsWith("image/"))
    if (file) await attachFile(file)
  }

  return (
    <div className="relative w-full">
      <div className="w-full px-3 sm:px-4 relative">
        <div className="w-full bg-muted border border-border rounded-3xl overflow-visible transition-colors">
          <form onSubmit={handleSubmit} className="relative w-full">
            <div
              className={cn("relative w-full border-0 px-4 pt-2.5 pb-1 sm:px-4 rounded-2xl transition-all duration-200 bg-transparent shadow-none", isDragging && "bg-primary/5")}
              onDragOver={(event) => {
                event.preventDefault()
                setIsDragging(true)
              }}
              onDragLeave={() => setIsDragging(false)}
              onDrop={handleDrop}
              onPaste={async (event) => {
                const file = Array.from(event.clipboardData.files).find((item) => item.type.startsWith("image/"))
                if (file) await attachFile(file)
              }}
            >
              {isDragging && (
                <div className="fixed inset-0 z-[100] flex items-center justify-center bg-background/70 backdrop-blur-md">
                  <div className="flex flex-col items-center gap-6 text-center">
                    <div className="flex h-16 w-16 items-center justify-center rounded-3xl border border-border bg-card text-primary shadow-lg">
                      <ImageIcon className="h-7 w-7" />
                    </div>
                    <div>
                      <p className="text-xl font-semibold text-foreground">Add a food image</p>
                      <p className="text-base text-muted-foreground mt-1">Drop it here for EfficientNetB3 recognition</p>
                    </div>
                  </div>
                </div>
              )}

              {attachment && (
                <div className="mb-3 flex flex-wrap gap-1.5 max-h-[120px] overflow-y-auto scrollbar-hide">
                  <div className="relative group">
                    <button type="button" className="relative rounded-xl overflow-hidden border border-border bg-card cursor-pointer" onClick={() => setPreviewImage(attachment)}>
                      <img src={attachment.url} alt={attachment.name} className="w-12 h-12 object-cover" />
                    </button>
                    <button
                      type="button"
                      onClick={() => setAttachment(null)}
                      className="absolute top-0.5 right-0.5 h-4 w-4 rounded-full bg-background/80 backdrop-blur-sm flex items-center justify-center hover:bg-background transition-colors opacity-100 sm:opacity-0 sm:group-hover:opacity-100"
                      aria-label="Remove image"
                    >
                      <X className="h-2.5 w-2.5" />
                    </button>
                  </div>
                </div>
              )}

              <div className="flex flex-wrap items-center gap-1.5">
                <Textarea
                  ref={textareaRef}
                  value={input}
                  onChange={(event) => setInput(event.target.value)}
                  onKeyDown={(event) => {
                    if (event.key === "Enter" && !event.shiftKey) {
                      event.preventDefault()
                      submit()
                    }
                  }}
                  placeholder={attachment ? "Ask anything about this image..." : "Ask Foody anything..."}
                  className="min-h-[28px] max-h-[180px] flex-1 resize-none border-0 bg-transparent px-0 text-sm leading-tight focus-visible:ring-0 focus-visible:border-transparent shadow-none overflow-y-auto text-foreground placeholder:text-muted-foreground scrollbar-hide"
                />
              </div>

              <div className="mt-3 flex flex-wrap items-center gap-1 text-foreground">
                <div className="flex items-center gap-1 -ml-2">
                  <input id="file-upload" ref={fileInputRef} type="file" className="hidden" onChange={handleFileChange} accept="image/*" />
                  <div className="relative">
                    <Button
                      type="button"
                      variant="ghost"
                      size="icon"
                      className="h-8 w-8 min-h-[36px] min-w-[36px] rounded-full text-foreground transition-all hover:bg-transparent hover:scale-105 active:scale-95"
                      aria-label="Add content"
                      onClick={() => setAddMenuOpen((open) => !open)}
                    >
                      <Plus className="h-4 w-4" />
                    </Button>
                    {addMenuOpen && (
                      <div className="absolute bottom-full left-0 z-50 mb-2 w-48 overflow-hidden rounded-xl border border-border bg-card shadow-none">
                        <button type="button" onClick={() => fileInputRef.current?.click()} className="flex w-full items-center gap-3 px-3 py-2.5 text-sm transition-colors hover:bg-accent">
                          <RiAttachment2 className="h-4 w-4" />
                          <span>Upload image</span>
                        </button>
                        <div className="px-3 pb-2 text-[11px] leading-snug text-muted-foreground">Food images trigger EfficientNetB3. Text-only chat does not run vision.</div>
                      </div>
                    )}
                  </div>
                </div>

                <div className="ml-auto flex items-center gap-2 -mr-2">
                  {isBusy ? (
                    <Button type="button" size="icon" onClick={onStopGeneration} className="h-9 w-9 rounded-full border border-primary bg-primary text-primary-foreground hover:bg-primary/90" aria-label="Stop generation">
                      <Square className="h-3.5 w-3.5 fill-current" />
                    </Button>
                  ) : (
                    <Button
                      type="submit"
                      size="icon"
                      disabled={!canSubmit}
                      className={cn("h-9 w-9 rounded-full border transition-all duration-200", canSubmit ? "border-primary bg-primary text-primary-foreground hover:bg-primary/90" : "border-border bg-muted/30 text-muted-foreground opacity-50 cursor-not-allowed")}
                      aria-label="Send message"
                    >
                      <ArrowUp className="h-4 w-4" />
                    </Button>
                  )}
                </div>
              </div>
            </div>
          </form>
        </div>
        {hasMessages && <p className="text-center text-[10px] text-muted-foreground/60 px-4 mt-2 pb-2">Foody can make mistakes. Check allergens, cooking temperatures, and portions.</p>}
        <div className={hasMessages ? "h-2 sm:h-1" : "h-3"} />
      </div>

      {previewImage && (
        <div className="fixed inset-0 z-[99999] flex items-center justify-center bg-black/80 backdrop-blur-sm" onClick={() => setPreviewImage(null)}>
          <div className="relative w-[95vw] max-w-4xl" onClick={(event) => event.stopPropagation()}>
            <button onClick={() => setPreviewImage(null)} className="absolute right-2 top-2 z-10 h-8 w-8 rounded-full bg-background/80 backdrop-blur-sm flex items-center justify-center hover:bg-background transition-colors" aria-label="Close preview">
              <X className="h-4 w-4" />
            </button>
            <img src={previewImage.url} alt={previewImage.name} className="max-h-[90vh] w-full object-contain rounded-xl" />
          </div>
        </div>
      )}
    </div>
  )
}
