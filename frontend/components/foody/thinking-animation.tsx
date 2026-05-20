"use client"

import { useEffect, useRef, useState } from "react"
import { ChatMatrix } from "@/components/foody/chat-matrix"
import { ScrambleText } from "@/components/foody/scramble-text"

interface Props {
  text?: string
  isLoading?: boolean
  showShimmer?: boolean
  matrixSize?: number
  dotSize?: number
  gap?: number
  showElapsed?: boolean
}

export function ThinkingAnimation({ text, isLoading, showShimmer = true, matrixSize = 5, dotSize = 1.5, gap = 1.5, showElapsed = false }: Props) {
  const [elapsedMs, setElapsedMs] = useState(0)
  const startRef = useRef<number | null>(null)

  useEffect(() => {
    if (!isLoading || !showElapsed) {
      startRef.current = null
      setElapsedMs(0)
      return
    }
    if (startRef.current === null) startRef.current = Date.now()
    const interval = setInterval(() => {
      if (startRef.current !== null) setElapsedMs(Date.now() - startRef.current)
    }, 100)
    return () => clearInterval(interval)
  }, [isLoading, showElapsed])

  const elapsedLabel = showElapsed && isLoading && elapsedMs >= 1000 ? `${(elapsedMs / 1000).toFixed(1)}s` : null
  return (
    <div className="flex flex-col gap-2">
      <div className="flex items-center text-inherit overflow-hidden">
        {isLoading && (
          <div className="shrink-0 mr-2.5">
            <ChatMatrix size={matrixSize} dotSize={dotSize} gap={gap} />
          </div>
        )}
        <span>
          <ScrambleText text={text} isLoading={isLoading} showShimmer={showShimmer} />
        </span>
        {elapsedLabel && <span className="ml-2 shrink-0 text-[11px] font-mono text-muted-foreground/70">{elapsedLabel}</span>}
      </div>
    </div>
  )
}
