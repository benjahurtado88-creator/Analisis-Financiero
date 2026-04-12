"use client"

import Link from "next/link"
import { usePathname } from "next/navigation"
import { cn } from "@/lib/utils"
import { TrendingUp, Search, BarChart3, FileText } from "lucide-react"

const NAV = [
  { href: "/",          label: "Reporte",      icon: FileText  },
  { href: "/analyze",   label: "Analizar",     icon: Search    },
  { href: "/portfolio", label: "Mi Portafolio", icon: BarChart3 },
]

export function NavBar() {
  const path = usePathname()

  return (
    <nav className="sticky top-0 z-40 border-b border-zinc-200 bg-white/90 backdrop-blur-sm">
      <div className="mx-auto flex max-w-5xl items-center justify-between px-4 py-3 sm:px-6">
        {/* Logo */}
        <Link href="/" className="flex items-center gap-2">
          <TrendingUp size={18} className="text-zinc-700" />
          <span className="text-base font-bold tracking-tight text-zinc-900">Finance.ia</span>
        </Link>

        {/* Links */}
        <div className="flex items-center gap-1">
          {NAV.map(({ href, label, icon: Icon }) => {
            const active = href === "/" ? path === "/" : path.startsWith(href)
            return (
              <Link
                key={href}
                href={href}
                className={cn(
                  "flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-sm font-medium transition-colors",
                  active
                    ? "bg-zinc-900 text-white"
                    : "text-zinc-500 hover:bg-zinc-100 hover:text-zinc-800"
                )}
              >
                <Icon size={14} />
                <span className="hidden sm:inline">{label}</span>
              </Link>
            )
          })}
        </div>
      </div>
    </nav>
  )
}
