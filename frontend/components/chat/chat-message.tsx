"use client"

import { useEffect, useMemo, useRef, useState } from "react"
import { ChevronDown, ChevronUp, ImageIcon, Sparkles, X } from "lucide-react"
import { LuCheck, LuCopy, LuRefreshCw, LuTrash2, LuVolume2, LuVolumeX } from "react-icons/lu"
import { Button } from "@/components/ui/button"
import { ThinkingAnimation } from "@/components/foody/thinking-animation"
import { cn } from "@/lib/utils"
import type { AttachmentPreview, ChatMessage as ChatMessageType, Citation, Prediction } from "@/lib/types"

interface ChatMessageProps {
  message: ChatMessageType
  index: number
  modelName?: string
  onRegenerate?: (index: number) => void
  onDelete?: (index: number) => void
  hideActions?: boolean
  isLastMessage?: boolean
}

function cleanUserText(content: string) {
  return content.replace(/^\[Image attached\]\s*/i, "").trim()
}

function confidencePercent(prediction?: Prediction | null) {
  if (typeof prediction?.confidence !== "number") return null
  return Math.round(prediction.confidence * 100)
}

function confidenceTone(percent: number | null) {
  if (percent === null) return { label: "Unknown confidence", ring: "#71717a", text: "text-muted-foreground" }
  if (percent >= 80) return { label: "High confidence", ring: "#22c55e", text: "text-emerald-400" }
  if (percent >= 45) return { label: "Likely match", ring: "#f59e0b", text: "text-amber-400" }
  return { label: "Low confidence", ring: "#fb7185", text: "text-rose-400" }
}

function ImageLightbox({ url, onClose }: { url: string | null; onClose: () => void }) {
  if (!url) return null
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/90 backdrop-blur-sm" onClick={onClose}>
      <div className="relative max-w-[90vw] max-h-[90vh]">
        <img src={url} alt="Uploaded food" className="max-w-full max-h-[90vh] object-contain rounded-lg" onClick={(event) => event.stopPropagation()} />
        <button onClick={onClose} className="absolute top-4 right-4 p-2 bg-black/50 rounded-full text-white hover:scale-110 transition-transform backdrop-blur-sm" title="Close">
          <X className="h-5 w-5" />
        </button>
      </div>
    </div>
  )
}

interface TableData {
  headers: string[]
  alignments: ("left" | "center" | "right")[]
  rows: string[][]
}

function renderInlineText(text: string) {
  const tokens: React.ReactNode[] = []
  let cursor = 0
  const inlineRegex = /(\*\*([^*]+)\*\*|\*([^*]+)\*|`([^`]+)`|\[(\d+)\])/g
  
  let match
  while ((match = inlineRegex.exec(text)) !== null) {
    const matchIndex = match.index
    if (matchIndex > cursor) {
      tokens.push(text.slice(cursor, matchIndex))
    }
    
    const [_, , boldVal, italicVal, codeVal, citeVal] = match
    
    if (boldVal !== undefined) {
      tokens.push(<strong key={matchIndex} className="font-semibold text-foreground">{boldVal}</strong>)
    } else if (italicVal !== undefined) {
      tokens.push(<em key={matchIndex} className="italic text-muted-foreground">{italicVal}</em>)
    } else if (codeVal !== undefined) {
      tokens.push(
        <code key={matchIndex} className="px-1.5 py-0.5 rounded bg-muted font-mono text-xs text-foreground font-semibold border border-border/60">
          {codeVal}
        </code>
      )
    } else if (citeVal !== undefined) {
      tokens.push(
        <sup key={matchIndex} className="text-[10px] font-bold text-primary select-none px-0.5 hover:underline cursor-pointer" title={`Source [${citeVal}]`}>
          [{citeVal}]
        </sup>
      )
    }
    
    cursor = inlineRegex.lastIndex
  }
  
  if (cursor < text.length) {
    tokens.push(text.slice(cursor))
  }
  
  return tokens.length > 0 ? tokens : text
}

function AssistantText({ content, isStreaming }: { content: string; isStreaming?: boolean }) {
  const [displayedText, setDisplayedText] = useState(() => {
    return isStreaming ? "" : content
  })
  
  const targetTextRef = useRef(content)
  const isStreamingRef = useRef(isStreaming)
  
  targetTextRef.current = content
  isStreamingRef.current = isStreaming

  useEffect(() => {
    if (!isStreaming && displayedText === content) {
      return
    }

    const intervalId = setInterval(() => {
      setDisplayedText((current) => {
        const target = targetTextRef.current
        if (current === target) {
          return current
        }
        const gap = target.length - current.length
        if (gap <= 0) return current
        const step = Math.max(1, Math.min(8, Math.floor(gap / 3)))
        return current + target.slice(current.length, current.length + step)
      })
    }, 15)

    return () => clearInterval(intervalId)
  }, [isStreaming])

  // Sync content immediately if not streaming
  useEffect(() => {
    if (!isStreaming) {
      setDisplayedText(content)
    }
  }, [isStreaming, content])

  if (!displayedText && isStreaming) {
    return <ThinkingAnimation isLoading showElapsed />
  }

  const lines = displayedText.split("\n")
  const blocks: React.ReactNode[] = []
  
  let currentBlockType: "paragraph" | "bullet" | "numbered" | "table" | "code" | null = null
  let listItems: string[] = []
  let tableData: TableData | null = null
  let codeContent: string[] = []
  let codeLang = ""

  const flushCurrentBlock = (index: number) => {
    const isLast = index >= lines.length - 1
    const showCursor = isStreaming && isLast

    if (currentBlockType === "paragraph" && listItems.length > 0) {
      blocks.push(
        <p key={`p-${index}`} className="whitespace-pre-wrap break-words leading-relaxed text-foreground/95 my-2">
          {renderInlineText(listItems.join("\n"))}
          {showCursor && <span className="ml-0.5 inline-block h-4 w-1.5 animate-pulse rounded-full bg-primary align-[-2px]" />}
        </p>
      )
      listItems = []
    } else if (currentBlockType === "bullet" && listItems.length > 0) {
      blocks.push(
        <ul key={`ul-${index}`} className="list-disc list-inside space-y-1.5 my-2.5 pl-1.5 text-foreground/95">
          {listItems.map((item, idx) => {
            const isLastItem = idx === listItems.length - 1
            return (
              <li key={idx} className="leading-relaxed">
                {renderInlineText(item)}
                {showCursor && isLastItem && <span className="ml-0.5 inline-block h-4 w-1.5 animate-pulse rounded-full bg-primary align-[-2px]" />}
              </li>
            )
          })}
        </ul>
      )
      listItems = []
    } else if (currentBlockType === "numbered" && listItems.length > 0) {
      blocks.push(
        <ol key={`ol-${index}`} className="list-decimal list-inside space-y-1.5 my-2.5 pl-1.5 text-foreground/95">
          {listItems.map((item, idx) => {
            const isLastItem = idx === listItems.length - 1
            return (
              <li key={idx} className="leading-relaxed">
                {renderInlineText(item)}
                {showCursor && isLastItem && <span className="ml-0.5 inline-block h-4 w-1.5 animate-pulse rounded-full bg-primary align-[-2px]" />}
              </li>
            )
          })}
        </ol>
      )
      listItems = []
    } else if (currentBlockType === "table" && tableData && tableData.headers.length > 0) {
      const currentTable = tableData
      blocks.push(
        <div key={`table-${index}`} className="my-4 w-full overflow-x-auto rounded-2xl border border-border/85 bg-card shadow-sm">
          <table className="min-w-full divide-y divide-border/60 text-xs text-left">
            <thead className="bg-muted/80">
              <tr>
                {currentTable.headers.map((h, idx) => (
                  <th
                    key={idx}
                    className="px-4 py-3 font-semibold text-foreground/90 border-r border-border/40 last:border-r-0"
                    style={{ textAlign: currentTable.alignments[idx] || "left" }}
                  >
                    {renderInlineText(h)}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-border/40">
              {currentTable.rows.map((row, rowIdx) => (
                <tr key={rowIdx} className="hover:bg-muted/30 transition-colors duration-150">
                  {row.map((cell, cellIdx) => (
                    <td
                      key={cellIdx}
                      className="px-4 py-2.5 text-foreground/80 border-r border-border/30 last:border-r-0"
                      style={{ textAlign: currentTable.alignments[cellIdx] || "left" }}
                    >
                      {renderInlineText(cell)}
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )
      tableData = null
    }
  }

  for (let i = 0; i < lines.length; i += 1) {
    const line = lines[i]
    const trimmed = line.trim()

    // 1. Handle Code Block
    if (trimmed.startsWith("```")) {
      if (currentBlockType === "code") {
        blocks.push(
          <pre key={`code-${i}`} className="max-w-full overflow-x-auto rounded-2xl border border-border bg-muted/50 p-4 text-xs leading-5 text-foreground font-mono scrollbar-hide my-3">
            {codeLang && <div className="text-[10px] uppercase font-semibold text-muted-foreground mb-1.5">{codeLang}</div>}
            <code>{codeContent.join("\n")}</code>
          </pre>
        )
        codeContent = []
        codeLang = ""
        currentBlockType = null
      } else {
        flushCurrentBlock(i)
        currentBlockType = "code"
        codeLang = trimmed.slice(3).trim()
      }
      continue
    }

    if (currentBlockType === "code") {
      codeContent.push(line)
      continue
    }

    // 2. Handle Table Line
    if (trimmed.startsWith("|")) {
      if (currentBlockType !== "table") {
        flushCurrentBlock(i)
        currentBlockType = "table"
        tableData = { headers: [], alignments: [], rows: [] }
      }

      const cells = line.split("|")
        .map((c) => c.trim())
        .filter((_, idx, arr) => idx > 0 && idx < arr.length - 1)

      const isSeparator = cells.every((c) => c.match(/^:?-+:?$/))

      if (isSeparator) {
        if (tableData) {
          tableData.alignments = cells.map((c) => {
            const left = c.startsWith(":")
            const right = c.endsWith(":")
            if (left && right) return "center"
            if (right) return "right"
            return "left"
          })
        }
      } else if (tableData) {
        if (tableData.headers.length === 0) {
          tableData.headers = cells
        } else {
          tableData.rows.push(cells)
        }
      }
      continue
    }

    if (currentBlockType === "table") {
      flushCurrentBlock(i)
      currentBlockType = null
    }

    // 3. Handle Header
    const headerMatch = line.match(/^(#{1,6})\s+(.*)$/)
    if (headerMatch) {
      flushCurrentBlock(i)
      const level = headerMatch[1].length
      const titleText = headerMatch[2].trim()
      const headerClasses = [
        "",
        "text-3xl font-bold tracking-tight text-foreground mt-6 mb-3",
        "text-2xl font-bold tracking-tight text-foreground mt-5 mb-2.5",
        "text-xl font-bold tracking-tight text-foreground mt-4 mb-2",
        "text-lg font-bold text-foreground mt-3 mb-1.5",
        "text-base font-bold text-foreground mt-2 mb-1",
        "text-sm font-bold text-muted-foreground mt-1 mb-1"
      ][level] || "text-xl font-bold mt-4 mb-2"

      const Tag = `h${level}` as keyof JSX.IntrinsicElements
      blocks.push(
        <Tag key={`h-${i}`} className={headerClasses}>
          {renderInlineText(titleText)}
        </Tag>
      )
      continue
    }

    // 4. Handle Unordered List
    const bulletMatch = line.match(/^([*\-•])\s+(.*)$/)
    if (bulletMatch) {
      if (currentBlockType !== "bullet") {
        flushCurrentBlock(i)
        currentBlockType = "bullet"
      }
      listItems.push(bulletMatch[2])
      continue
    }

    // 5. Handle Ordered List
    const numberedMatch = line.match(/^(\d+)\.\s+(.*)$/)
    if (numberedMatch) {
      if (currentBlockType !== "numbered") {
        flushCurrentBlock(i)
        currentBlockType = "numbered"
      }
      listItems.push(numberedMatch[2])
      continue
    }

    // 6. Handle Paragraph or Blank Line
    if (trimmed === "") {
      flushCurrentBlock(i)
      currentBlockType = null
    } else {
      if (currentBlockType !== "paragraph") {
        flushCurrentBlock(i)
        currentBlockType = "paragraph"
      }
      listItems.push(line)
    }
  }

  flushCurrentBlock(lines.length)

  return (
    <div className="space-y-1.5 text-sm leading-relaxed text-foreground/90">
      {blocks}
    </div>
  )
}

function VisionDishCard({ prediction, citations, stages, attachment, onImageClick }: { prediction?: Prediction | null; citations?: Citation[]; stages?: string[]; attachment?: AttachmentPreview; onImageClick?: (url: string) => void }) {
  if (!prediction?.dish_name) return null
  const percent = confidencePercent(prediction)
  const tone = confidenceTone(percent)
  const alternatives = prediction.top_predictions?.slice(1, 4) || []
  const confidenceDegrees = Math.round(((percent || 0) / 100) * 360)

  return (
    <div className="mb-5 overflow-hidden rounded-[2rem] border border-border/70 bg-card shadow-[0_28px_100px_rgba(0,0,0,0.22)]">
      <div className="grid min-h-[260px] md:grid-cols-[245px_1fr]">
        <button type="button" onClick={() => attachment?.url && onImageClick?.(attachment.url)} className="group relative min-h-[240px] overflow-hidden bg-muted text-left md:min-h-full" disabled={!attachment?.url}>
          {attachment?.url ? (
            <img src={attachment.url} alt={attachment.name} className="absolute inset-0 h-full w-full object-cover transition duration-500 group-hover:scale-105" />
          ) : (
            <div className="absolute inset-0 flex items-center justify-center bg-[radial-gradient(circle_at_center,hsl(var(--primary)/0.16),transparent_60%)]">
              <ImageIcon className="h-14 w-14 text-muted-foreground" />
            </div>
          )}
        </button>

        <div className="relative overflow-hidden p-5 sm:p-6">
          <div className="absolute -right-24 -top-24 h-64 w-64 rounded-full bg-primary/10 blur-3xl" />
          <div className="absolute -bottom-28 left-8 h-56 w-56 rounded-full bg-emerald-500/10 blur-3xl" />
          <div className="relative flex min-h-full flex-col">
            <div className="flex items-start justify-between gap-4">
              <div className="min-w-0">
                <div className="flex items-center gap-2 text-[11px] font-medium uppercase tracking-[0.18em] text-muted-foreground">
                  <Sparkles className="h-3.5 w-3.5" />
                  Food vision
                </div>
                <h3 className="mt-3 text-4xl font-black tracking-[-0.05em] text-foreground sm:text-5xl">{prediction.dish_name}</h3>
                <p className="mt-2 text-sm text-muted-foreground">Food-101 class: <span className="font-medium text-foreground">{prediction.class_name}</span></p>
              </div>
              <div className="relative flex h-24 w-24 shrink-0 items-center justify-center rounded-full" style={{ background: `conic-gradient(${tone.ring} ${confidenceDegrees}deg, hsl(var(--muted)) 0deg)` }}>
                <div className="flex h-[84px] w-[84px] flex-col items-center justify-center rounded-full bg-card text-center shadow-inner">
                  <span className="text-3xl font-black tabular-nums text-foreground">{percent ?? "--"}</span>
                  <span className="text-[9px] uppercase tracking-[0.18em] text-muted-foreground">score</span>
                </div>
              </div>
            </div>

            <div className="mt-5">
              <div className="flex items-center justify-between gap-3 text-xs">
                <span className={cn("font-semibold", tone.text)}>{tone.label}</span>
                <span className="truncate text-muted-foreground">{prediction.model || "EfficientNetB3 Food-101"}</span>
              </div>
              <div className="mt-2 h-2 overflow-hidden rounded-full bg-muted">
                <div className="h-full rounded-full transition-all duration-700" style={{ width: `${percent || 0}%`, background: `linear-gradient(90deg, ${tone.ring}, hsl(var(--primary)))` }} />
              </div>
            </div>

            {alternatives.length > 0 && (
              <div className="mt-5 rounded-3xl border border-border/70 bg-background/45 p-3 backdrop-blur-sm">
                <p className="mb-2 text-[10px] font-semibold uppercase tracking-[0.18em] text-muted-foreground">Other possible reads</p>
                <div className="grid gap-2 sm:grid-cols-3">
                  {alternatives.map((item) => (
                    <div key={item.class_name} className="rounded-2xl bg-muted/60 px-3 py-2">
                      <p className="truncate text-xs font-semibold text-foreground">{item.dish_name}</p>
                      <p className="mt-0.5 text-[11px] text-muted-foreground">{Math.round(item.confidence * 100)}% match</p>
                    </div>
                  ))}
                </div>
              </div>
            )}

            <div className="mt-auto grid gap-2 pt-5 sm:grid-cols-3">
              <div className="rounded-3xl bg-muted/55 p-3">
                <p className="text-[10px] uppercase tracking-wider text-muted-foreground">Vision model</p>
                <p className="mt-1 truncate text-sm font-bold text-foreground">EfficientNetB3</p>
              </div>
              <div className="rounded-3xl bg-muted/55 p-3">
                <p className="text-[10px] uppercase tracking-wider text-muted-foreground">RAG context</p>
                <p className="mt-1 text-sm font-bold text-foreground">{citations?.length || 0} chunks</p>
              </div>
              <div className="rounded-3xl bg-muted/55 p-3">
                <p className="text-[10px] uppercase tracking-wider text-muted-foreground">Generation</p>
                <p className="mt-1 text-sm font-bold text-foreground">Streaming</p>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}

function Citations({ citations }: { citations?: Citation[] }) {
  const [open, setOpen] = useState(false)
  if (!citations?.length) return null
  return (
    <div className="mt-4">
      <button type="button" onClick={() => setOpen((value) => !value)} className="flex items-center gap-2 text-xs text-muted-foreground transition hover:text-foreground">
        {open ? <ChevronUp className="h-3.5 w-3.5" /> : <ChevronDown className="h-3.5 w-3.5" />}
        {citations.length} Foody RAG sources
      </button>
      {open && (
        <div className="mt-2 space-y-2">
          {citations.slice(0, 4).map((citation, index) => (
            <div key={citation.id || index} className="rounded-xl border border-border bg-muted/30 p-3">
              <p className="text-xs font-medium text-foreground">[{index + 1}] {citation.title}</p>
              <p className="mt-1 line-clamp-3 text-xs leading-5 text-muted-foreground">{citation.text}</p>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}

export function ChatMessage({ message, index, modelName = "Foody RAG", onRegenerate, onDelete, hideActions = false, isLastMessage = false }: ChatMessageProps) {
  const [copied, setCopied] = useState(false)
  const [isSpeaking, setIsSpeaking] = useState(false)
  const [viewingImage, setViewingImage] = useState<string | null>(null)

  const handleCopy = async () => {
    await navigator.clipboard.writeText(message.content)
    setCopied(true)
    setTimeout(() => setCopied(false), 1600)
  }

  const handleTextToSpeech = () => {
    if (isSpeaking) {
      window.speechSynthesis.cancel()
      setIsSpeaking(false)
      return
    }
    if (!message.content) return
    const utterance = new SpeechSynthesisUtterance(message.content)
    utterance.onend = () => setIsSpeaking(false)
    utterance.onerror = () => setIsSpeaking(false)
    window.speechSynthesis.speak(utterance)
    setIsSpeaking(true)
  }

  if (message.role === "user") {
    const text = cleanUserText(message.content)
    return (
      <div className="mx-auto w-full max-w-3xl px-0 pt-3 pb-1.5">
        <div className="flex flex-col items-end gap-2 group relative">
          {message.attachment?.url && (
            <button type="button" onClick={() => setViewingImage(message.attachment?.url || null)} className="flex flex-col items-end gap-1">
              <img src={message.attachment.url} alt={message.attachment.name} className="w-[150px] h-[150px] rounded-xl object-cover border border-border/50 shadow-sm" />
            </button>
          )}
          {text && (
            <div className="max-w-[80%]">
              <div className="flex flex-col items-end gap-2 w-full">
                <div className="group/bubble relative rounded-2xl bg-secondary border border-border/40 px-3 py-1.5 text-sm font-normal text-foreground max-w-full text-left break-words">
                  {text}
                  <div className="absolute -bottom-6 right-0 flex items-center gap-1 opacity-0 group-hover/bubble:opacity-100 transition-opacity text-muted-foreground">
                    <Button variant="ghost" size="icon" onClick={handleCopy} className="h-6 w-6 hover:bg-muted/50" title={copied ? "Copied" : "Copy"}>
                      {copied ? <LuCheck className="h-3.5 w-3.5" /> : <LuCopy className="h-3.5 w-3.5" />}
                    </Button>
                    {onDelete && (
                      <Button variant="ghost" size="icon" onClick={() => onDelete(index)} className="h-6 w-6 hover:bg-destructive/10 hover:text-destructive" title="Delete message">
                        <LuTrash2 className="h-3.5 w-3.5" />
                      </Button>
                    )}
                  </div>
                </div>
              </div>
            </div>
          )}
        </div>
        <ImageLightbox url={viewingImage} onClose={() => setViewingImage(null)} />
      </div>
    )
  }

  const showActions = !message.isStreaming && !hideActions

  return (
    <div className="mx-auto w-full max-w-3xl px-0 pt-3 pb-1.5">
      <div className="group flex w-full flex-col is-assistant">
        <VisionDishCard prediction={message.prediction} citations={message.citations} stages={message.stages} attachment={message.attachment} onImageClick={setViewingImage} />
        <div className="flex w-fit max-w-full flex-col overflow-hidden text-sm break-words overflow-x-auto text-foreground">
          <AssistantText content={message.content} isStreaming={message.isStreaming} />
        </div>
        <Citations citations={message.citations} />
        {showActions && (
          <div className={cn("flex items-center -ml-2 -space-x-1 pt-2 text-foreground/50", !isLastMessage && "md:opacity-0 md:group-hover:opacity-100 transition-opacity")}>
            <Button size="icon-sm" type="button" variant="ghost" onClick={handleCopy} title={copied ? "Copied" : "Copy"}>
              {copied ? <LuCheck className="h-4 w-4" /> : <LuCopy className="h-4 w-4" />}
            </Button>
            {onRegenerate && (
              <Button size="icon-sm" type="button" variant="ghost" onClick={() => onRegenerate(index)} title="Regenerate response">
                <LuRefreshCw className="h-4 w-4" />
              </Button>
            )}
            <Button size="icon-sm" type="button" variant="ghost" onClick={handleTextToSpeech} title={isSpeaking ? "Stop speaking" : "Read aloud"}>
              {isSpeaking ? <LuVolumeX className="h-4 w-4 text-primary" /> : <LuVolume2 className="h-4 w-4" />}
            </Button>
            {onDelete && (
              <Button size="icon-sm" type="button" variant="ghost" onClick={() => onDelete(index)} title="Delete response">
                <LuTrash2 className="h-4 w-4" />
              </Button>
            )}
            {message.prediction ? <ImageIcon className="ml-2 h-4 w-4 text-muted-foreground" /> : null}
          </div>
        )}
      </div>
      <ImageLightbox url={viewingImage} onClose={() => setViewingImage(null)} />
    </div>
  )
}
