"use client"

import { useEffect, useRef, useState, useMemo } from "react"
import { BookOpen, ChevronLeft, X, Copy, Check, Maximize2, Minimize2 } from "lucide-react"
import { cn } from "@/lib/utils"
import { getApiUrl } from "@/lib/api"
import { parseNotebook, extractStages, type ParsedNotebook, type NotebookCell, type CellOutput, type StageEntry } from "@/lib/notebook-parser"
import Prism from "prismjs"
import "prismjs/components/prism-python"

interface NotebookViewerProps {
  open: boolean
  onOpenChange: (open: boolean) => void
}

/* ── ANSI strip ── */
function stripAnsi(text: string): string {
  return text.replace(/\x1b\[[0-9;]*m/g, "")
}

/* ── Inline markdown: **bold**, `code`, *italic* ── */
function renderInline(text: string): React.ReactNode {
  const parts: React.ReactNode[] = []
  let cursor = 0
  const regex = /(\*\*([^*]+)\*\*|`([^`]+)`|\*([^*]+)\*)/g
  let match
  while ((match = regex.exec(text)) !== null) {
    if (match.index > cursor) parts.push(text.slice(cursor, match.index))
    const [, , bold, code, italic] = match
    if (bold) parts.push(<strong key={match.index} className="font-semibold text-foreground">{bold}</strong>)
    if (code) parts.push(<code key={match.index} className="px-1.5 py-0.5 rounded-md bg-muted font-mono text-[11px] text-primary border border-border/40">{code}</code>)
    if (italic) parts.push(<em key={match.index} className="italic text-foreground/80">{italic}</em>)
    cursor = regex.lastIndex
  }
  if (cursor < text.length) parts.push(text.slice(cursor))
  return parts.length > 0 ? parts : text
}

/* ── Markdown cell renderer ── */
function MarkdownRenderer({ source }: { source: string }) {
  const lines = source.split("\n")
  const blocks: React.ReactNode[] = []
  let listItems: React.ReactNode[] = []

  const flushList = (key: string) => {
    if (listItems.length > 0) {
      blocks.push(<ul key={key} className="list-disc list-inside space-y-1 my-2 pl-1">{listItems}</ul>)
      listItems = []
    }
  }

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i]
    const h1 = line.match(/^#\s+(.+)/)
    const h2 = line.match(/^##\s+(.+)/)
    const h3 = line.match(/^###\s+(.+)/)
    const li = line.match(/^[-*]\s+(.+)/)

    if (h1) {
      flushList(`list-before-${i}`)
      blocks.push(
        <h1 key={i} className="text-2xl font-black tracking-tight text-foreground mt-10 mb-3 pb-3 border-b border-primary/20 flex items-center gap-3">
          <span className="inline-flex h-8 w-1 rounded-full bg-primary" />
          {renderInline(h1[1])}
        </h1>
      )
    } else if (h2) {
      flushList(`list-before-${i}`)
      blocks.push(<h2 key={i} className="text-xl font-bold tracking-tight text-foreground mt-7 mb-2">{renderInline(h2[1])}</h2>)
    } else if (h3) {
      flushList(`list-before-${i}`)
      blocks.push(<h3 key={i} className="text-base font-bold text-foreground mt-5 mb-1.5">{renderInline(h3[1])}</h3>)
    } else if (li) {
      listItems.push(<li key={i} className="text-sm text-foreground/85">{renderInline(li[1])}</li>)
    } else if (line.trim() === "") {
      flushList(`list-at-${i}`)
    } else {
      flushList(`list-before-${i}`)
      blocks.push(<p key={i} className="text-sm leading-relaxed text-foreground/85 my-1.5">{renderInline(line)}</p>)
    }
  }
  flushList("list-end")
  return <div>{blocks}</div>
}

/* ── Copy button ── */
function CopyButton({ text }: { text: string }) {
  const [copied, setCopied] = useState(false)
  const handleCopy = () => {
    navigator.clipboard.writeText(text)
    setCopied(true)
    setTimeout(() => setCopied(false), 1500)
  }
  return (
    <button
      onClick={handleCopy}
      className="flex items-center gap-1 rounded-lg px-2 py-1 text-[10px] font-medium text-muted-foreground transition hover:bg-muted hover:text-foreground"
      title="Copy code"
    >
      {copied ? <Check className="h-3 w-3 text-green-500" /> : <Copy className="h-3 w-3" />}
      {copied ? "Copied" : "Copy"}
    </button>
  )
}

/* ── Code cell with Prism syntax highlighting ── */
function CodeBlock({ source, executionCount }: { source: string; executionCount: number | null }) {
  const highlightedLines = useMemo(() => {
    try {
      return Prism.highlight(source, Prism.languages.python, "python").split("\n")
    } catch {
      return source.split("\n")
    }
  }, [source])

  return (
    <div className="relative rounded-2xl border border-border/60 overflow-hidden my-3 shadow-sm">
      <div className="flex items-center justify-between px-4 py-2 border-b border-border/40 bg-muted/40">
        <div className="flex items-center gap-2">
          {executionCount !== null && (
            <span className="inline-flex items-center justify-center rounded-md bg-primary/10 px-2 py-0.5 font-mono text-[10px] font-bold text-primary">
              In [{executionCount}]
            </span>
          )}
          <span className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">Python</span>
        </div>
        <CopyButton text={source} />
      </div>
      <div className="overflow-x-auto overflow-y-hidden scrollbar-hide bg-[hsl(var(--muted)/0.25)]">
        <table className="w-full border-collapse">
          <tbody>
            {highlightedLines.map((html, i) => (
              <tr key={i} className="hover:bg-muted/30 transition-colors">
                <td className="select-none w-10 text-right pr-4 pl-4 py-0 text-muted-foreground/35 text-[10px] font-mono leading-5 align-top border-r border-border/20">
                  {i + 1}
                </td>
                <td className="pl-4 pr-4 py-0 font-mono text-xs leading-5 whitespace-pre text-foreground/90">
                  <span dangerouslySetInnerHTML={{ __html: html }} />
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  )
}

/* ── Output renderers ── */
function OutputBlock({ output, executionCount }: { output: CellOutput; executionCount: number | null }) {
  if (output.outputType === "image") {
    return (
      <div className="my-3 rounded-2xl border border-border/50 overflow-hidden bg-card shadow-sm">
        <img src={output.content} alt="Notebook output" className="max-w-full h-auto" loading="lazy" />
      </div>
    )
  }
  if (output.outputType === "error") {
    return (
      <div className="my-2 rounded-2xl border border-destructive/30 overflow-hidden">
        <div className="px-4 py-1.5 bg-destructive/10 border-b border-destructive/20">
          <span className="text-[10px] font-semibold uppercase tracking-wider text-destructive">Error</span>
        </div>
        <pre className="p-4 text-xs font-mono text-destructive/90 overflow-hidden whitespace-pre-wrap bg-destructive/5">
          {stripAnsi(output.content)}
        </pre>
      </div>
    )
  }
  if (output.outputType === "html") {
    return (
      <div className="my-2 rounded-2xl border border-border/50 bg-card overflow-hidden">
        <div className="p-4 text-xs overflow-x-auto scrollbar-hide overflow-y-hidden [&_table]:w-full [&_table]:border-collapse [&_td]:border [&_td]:border-border/40 [&_td]:px-3 [&_td]:py-1.5 [&_th]:border [&_th]:border-border/40 [&_th]:px-3 [&_th]:py-1.5 [&_th]:bg-muted/40 [&_th]:font-semibold" dangerouslySetInnerHTML={{ __html: output.content }} />
      </div>
    )
  }
  if (!output.content.trim()) return null
  return (
    <div className="my-2 rounded-2xl border border-border/40 overflow-hidden">
      <div className="flex items-center px-4 py-1.5 bg-muted/30 border-b border-border/30">
        {executionCount !== null && (
          <span className="inline-flex items-center justify-center rounded-md bg-muted px-2 py-0.5 font-mono text-[10px] font-bold text-muted-foreground mr-2">
            Out [{executionCount}]
          </span>
        )}
        <span className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">Output</span>
      </div>
      <pre className="p-4 text-xs font-mono text-foreground/80 overflow-hidden whitespace-pre-wrap bg-muted/10">
        {output.content}
      </pre>
    </div>
  )
}

/* ── Single cell ── */
function CellRenderer({ cell }: { cell: NotebookCell }) {
  if (cell.type === "markdown") {
    return (
      <div id={`cell-${cell.index}`} className="py-1">
        <MarkdownRenderer source={cell.source} />
      </div>
    )
  }
  return (
    <div id={`cell-${cell.index}`} className="py-1">
      <CodeBlock source={cell.source} executionCount={cell.executionCount} />
      {cell.outputs.map((output, i) => (
        <OutputBlock key={i} output={output} executionCount={cell.executionCount} />
      ))}
    </div>
  )
}

/* ── Main viewer component ── */
export function NotebookViewer({ open, onOpenChange }: NotebookViewerProps) {
  const [notebook, setNotebook] = useState<ParsedNotebook | null>(null)
  const [stages, setStages] = useState<StageEntry[]>([])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState("")
  const [showSidebar, setShowSidebar] = useState(true)
  const [activeStage, setActiveStage] = useState(0)
  const [isMaximized, setIsMaximized] = useState(false)
  const contentRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (!open) return
    setLoading(true)
    setError("")
    fetch(`${getApiUrl()}/notebook`)
      .then((res) => {
        if (!res.ok) throw new Error(`Failed to load notebook (${res.status})`)
        return res.json()
      })
      .then((raw) => {
        const parsed = parseNotebook(raw)
        setNotebook(parsed)
        setStages(extractStages(parsed.cells))
      })
      .catch((err) => setError(err instanceof Error ? err.message : "Failed to load notebook"))
      .finally(() => setLoading(false))
  }, [open])

  useEffect(() => {
    if (!open || !contentRef.current || stages.length === 0) return
    const container = contentRef.current
    const observer = new IntersectionObserver(
      (entries) => {
        for (const entry of entries) {
          if (entry.isIntersecting) {
            const idx = parseInt(entry.target.id.replace("cell-", ""), 10)
            const stageIdx = stages.findIndex((s, i) => {
              const next = stages[i + 1]
              return idx >= s.cellIndex && (!next || idx < next.cellIndex)
            })
            if (stageIdx >= 0) setActiveStage(stageIdx)
          }
        }
      },
      { root: container, rootMargin: "-10% 0px -80% 0px", threshold: 0 }
    )
    const cells = container.querySelectorAll("[id^='cell-']")
    cells.forEach((el) => observer.observe(el))
    return () => observer.disconnect()
  }, [open, notebook, stages])

  if (!open) return null

  const scrollToStage = (cellIndex: number) => {
    const el = document.getElementById(`cell-${cellIndex}`)
    if (el) el.scrollIntoView({ behavior: "smooth", block: "start" })
  }

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/50 backdrop-blur-sm animate-in fade-in duration-200">
      <div className={cn(
        "w-full border-none bg-transparent p-0 text-foreground shadow-none animate-in zoom-in-95 duration-200 transition-all",
        isMaximized
          ? "h-[100dvh] max-w-full"
          : "h-[100dvh] max-w-full sm:h-[88vh] sm:max-h-[860px] sm:max-w-[1200px] sm:rounded-3xl"
      )}>
        <div className={cn(
          "relative flex h-full w-full flex-col overflow-hidden bg-background lg:flex-row",
          !isMaximized && "sm:rounded-3xl sm:border sm:border-border/40 sm:shadow-2xl"
        )}>

          {/* Top-right controls */}
          <div className="absolute right-4 top-4 z-50 flex items-center gap-1">
            <button
              className="inline-flex h-8 w-8 items-center justify-center rounded-full text-muted-foreground transition hover:bg-muted/50 hover:text-foreground focus-visible:outline-none"
              aria-label={isMaximized ? "Exit full page" : "Full page"}
              title={isMaximized ? "Exit full page" : "Full page"}
              onClick={() => setIsMaximized(!isMaximized)}
            >
              {isMaximized ? <Minimize2 className="h-4 w-4" /> : <Maximize2 className="h-4 w-4" />}
            </button>
            <button
              className="inline-flex h-8 w-8 items-center justify-center rounded-full text-muted-foreground transition hover:bg-muted/50 hover:text-foreground focus-visible:outline-none"
              aria-label="Close notebook"
              onClick={() => onOpenChange(false)}
            >
              <X className="h-4 w-4" />
            </button>
          </div>

          {/* Sidebar TOC */}
          <aside className={cn(
            "flex w-full flex-col bg-background pt-10 px-3 pb-3 overflow-y-auto scrollbar-hide lg:w-[270px] lg:border-r lg:border-border/40 lg:flex lg:bg-muted/10 lg:p-3",
            !showSidebar && "hidden"
          )}>
            <div className="mb-4 mt-1 px-2">
              <div className="flex items-center gap-3">
                <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-primary/10 text-primary border border-primary/20">
                  <BookOpen className="h-5 w-5" />
                </div>
                <div className="flex-1 min-w-0">
                  <p className="truncate text-sm font-bold text-foreground">Training Notebook</p>
                  <p className="truncate text-[11px] text-muted-foreground">Food-101 · 93 cells · 13 stages</p>
                </div>
              </div>
            </div>

            <p className="px-2 mb-2 text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">Stages</p>

            <nav className="flex-1 overflow-y-auto scrollbar-hide">
              <div className="space-y-0.5">
                {stages.map((stage, i) => (
                  <button
                    key={i}
                    type="button"
                    onClick={() => {
                      scrollToStage(stage.cellIndex)
                      setActiveStage(i)
                      if (window.innerWidth < 1024) setShowSidebar(false)
                    }}
                    className={cn(
                      "group flex w-full items-center gap-2.5 rounded-xl px-2.5 py-2 text-left text-xs font-medium transition-all",
                      activeStage === i
                        ? "bg-primary/10 text-primary shadow-sm"
                        : "text-muted-foreground hover:bg-muted/50 hover:text-foreground"
                    )}
                  >
                    <span className={cn(
                      "flex h-6 w-6 shrink-0 items-center justify-center rounded-lg text-[10px] font-bold transition-colors",
                      activeStage === i ? "bg-primary text-primary-foreground" : "bg-muted text-muted-foreground"
                    )}>
                      {i + 1}
                    </span>
                    <span className="flex-1 truncate leading-tight">{stage.title.replace(/^Stage\s+\d+:\s*/i, "")}</span>
                  </button>
                ))}
              </div>
            </nav>

            <div className="mt-3 rounded-xl border border-border/40 bg-muted/20 p-3">
              <p className="text-[10px] font-semibold text-muted-foreground mb-1">Champion Model</p>
              <p className="text-xs font-bold text-primary">EfficientNetB3</p>
              <p className="text-[10px] text-muted-foreground">84.03% accuracy · Food-101</p>
            </div>
          </aside>

          {/* Content */}
          <section className={cn("flex-1 overflow-hidden bg-background", showSidebar && "hidden lg:flex lg:flex-col")}>
            <button type="button" onClick={() => setShowSidebar(true)} className="flex items-center gap-2 px-6 py-4 text-sm font-medium text-muted-foreground hover:text-foreground lg:hidden">
              <ChevronLeft className="h-4 w-4" />
              <span>Table of Contents</span>
            </button>

            <div ref={contentRef} className="h-full overflow-y-auto overflow-x-hidden scrollbar-hide p-5 lg:p-8">
              {loading && (
                <div className="flex flex-col items-center justify-center h-full gap-4">
                  <div className="h-12 w-12 rounded-full border-4 border-muted border-t-primary animate-spin" />
                  <p className="text-sm font-medium text-muted-foreground">Loading training notebook...</p>
                  <p className="text-xs text-muted-foreground/60">93 cells · this may take a moment</p>
                </div>
              )}

              {error && (
                <div className="flex flex-col items-center justify-center h-full gap-4">
                  <div className="rounded-2xl border border-destructive/30 bg-destructive/10 px-8 py-6 text-center max-w-md">
                    <p className="text-sm font-medium text-destructive mb-1">Could not load notebook</p>
                    <p className="text-xs text-destructive/70">{error}</p>
                    <p className="text-xs text-muted-foreground mt-3">Make sure the backend is running at {getApiUrl()}</p>
                  </div>
                </div>
              )}

              {notebook && !loading && (
                <div className="max-w-3xl mx-auto">
                  {notebook.cells.map((cell) => (
                    <CellRenderer key={cell.index} cell={cell} />
                  ))}
                  <div className="h-20" />
                </div>
              )}
            </div>
          </section>
        </div>
      </div>
    </div>
  )
}
