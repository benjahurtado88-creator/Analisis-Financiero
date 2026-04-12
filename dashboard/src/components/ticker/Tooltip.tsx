"use client"

import { useState } from "react"
import { cn } from "@/lib/utils"

interface TooltipProps {
  term: string
  definition: string
  example: string
  children?: React.ReactNode
  className?: string
}

export function FinancialTooltip({ term, definition, example, children, className }: TooltipProps) {
  const [visible, setVisible] = useState(false)

  return (
    <span className="relative inline-block">
      <span
        className={cn(
          "cursor-help border-b border-dashed border-zinc-400 text-inherit",
          className
        )}
        onMouseEnter={() => setVisible(true)}
        onMouseLeave={() => setVisible(false)}
      >
        {children ?? term}
      </span>
      {visible && (
        <span className="absolute bottom-full left-1/2 z-50 mb-2 w-64 -translate-x-1/2 rounded-lg border border-zinc-200 bg-white p-3 shadow-lg">
          <span className="block text-xs font-semibold text-zinc-800">{term}</span>
          <span className="mt-1 block text-xs text-zinc-600">{definition}</span>
          <span className="mt-1.5 block rounded bg-zinc-50 px-2 py-1 text-xs italic text-zinc-500">
            Ej: {example}
          </span>
        </span>
      )}
    </span>
  )
}
