import type React from "react"
import { cn } from "@/lib/utils"

export function Shimmer({ className, children }: { className?: string; children: React.ReactNode }) {
  return (
    <span
      className={cn(
        "bg-[linear-gradient(110deg,hsl(var(--muted-foreground))_0%,hsl(var(--foreground))_35%,hsl(var(--muted-foreground))_70%)] bg-[length:200%_100%] bg-clip-text text-transparent animate-shimmer",
        className
      )}
    >
      {children}
    </span>
  )
}
