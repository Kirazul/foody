"use client"

import { useEffect, useMemo, useRef, useState } from "react"
import { cn } from "@/lib/utils"
import { Shimmer } from "@/components/foody/shimmer"

interface ScrambleTextProps {
  text?: string
  isLoading?: boolean
  showShimmer?: boolean
}

const messages = [
  "foody is thinking...",
  "recognizing the dish...",
  "retrieving nutrition context...",
  "preparing recipe guidance...",
  "almost there"
]
const finishedMessage = "Done"
const chars = "abcdefghijklmnopqrstuvwxyz"
const totalFrames = 30

export function ScrambleText({ text, isLoading, showShimmer = true }: ScrambleTextProps) {
  const [currentIndex, setCurrentIndex] = useState(0)
  const [displayedText, setDisplayedText] = useState("")
  const frameRef = useRef(0)
  const [isScrambling, setIsScrambling] = useState(false)
  const fromTextRef = useRef("")
  const toTextRef = useRef("")
  const targetText = useMemo(() => (!isLoading ? text || finishedMessage : text || messages[currentIndex]), [isLoading, text, currentIndex])

  useEffect(() => {
    setDisplayedText(targetText || "")
  }, [])

  useEffect(() => {
    if (isLoading && !text) {
      const interval = setInterval(() => setCurrentIndex((prev) => (prev + 1) % messages.length), 3500)
      return () => clearInterval(interval)
    }
  }, [isLoading, text])

  useEffect(() => {
    let animationFrameId: number
    const scrambleLoop = () => {
      frameRef.current += 1
      const maxLength = Math.max(fromTextRef.current.length, toTextRef.current.length)
      let result = ""
      for (let index = 0; index < maxLength; index += 1) {
        const progress = frameRef.current / totalFrames
        const charProgress = progress * maxLength
        if (index < charProgress - 2) result += toTextRef.current[index] || ""
        else if (index < charProgress) result += chars[Math.floor(Math.random() * chars.length)]
        else result += fromTextRef.current[index] || ""
      }
      setDisplayedText(result)
      if (frameRef.current >= totalFrames) {
        setDisplayedText(toTextRef.current)
        setIsScrambling(false)
      } else {
        animationFrameId = requestAnimationFrame(scrambleLoop)
      }
    }
    if (isScrambling) animationFrameId = requestAnimationFrame(scrambleLoop)
    return () => cancelAnimationFrame(animationFrameId)
  }, [isScrambling])

  const prevTargetText = useRef(targetText)
  useEffect(() => {
    if (targetText !== prevTargetText.current && targetText && prevTargetText.current) {
      fromTextRef.current = prevTargetText.current
      toTextRef.current = targetText
      frameRef.current = 0
      setIsScrambling(true)
    } else if (!prevTargetText.current && targetText) {
      setDisplayedText(targetText)
    }
    prevTargetText.current = targetText
  }, [targetText])

  if (isLoading && showShimmer) return <Shimmer className="tracking-tight">{displayedText}</Shimmer>
  return <span className={cn("tracking-tight")}>{displayedText}</span>
}
