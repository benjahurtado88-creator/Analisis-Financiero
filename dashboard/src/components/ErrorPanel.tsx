"use client"

import { useState } from "react"
import { AlertCircle, Wrench, Copy, Check, X } from "lucide-react"
import { cn } from "@/lib/utils"

interface ErrorPanelProps {
  title?: string
  error: string
  onDismiss?: () => void
  className?: string
}

const PROMPT_TEMPLATE = (error: string, comment: string) => `Estoy atascado con este error. NO intentes solucionarlo todavía.
Error:
${error}
${comment ? `\nContexto adicional:\n${comment}\n` : ""}
Lo que ya he intentado:
(describe aquí si aplica)

Paso 1: Enumera todas las posibles causas raíz (sé exhaustivo, incluye suposiciones que podrías estar haciendo)
Paso 2: Ordénalas según probabilidad
Paso 3: Para las 2 causas más probables, explica POR QUÉ ocurre el error a nivel mecánico
Paso 4: Solo entonces propone una solución — elige UN enfoque, el más simple primero
Paso 5: Si no estás seguro, busca en la web antes de adivinar`

export function ErrorPanel({ title = "Error", error, onDismiss, className }: ErrorPanelProps) {
  const [showModal, setShowModal] = useState(false)
  const [comment, setComment]     = useState("")
  const [copied, setCopied]       = useState(false)

  async function handleCopy() {
    await navigator.clipboard.writeText(PROMPT_TEMPLATE(error, comment))
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
  }

  return (
    <>
      {/* Banner de error */}
      <div className={cn(
        "rounded-xl border border-red-200 bg-red-50 p-4",
        className
      )}>
        <div className="flex items-start gap-3">
          <AlertCircle size={16} className="flex-shrink-0 text-red-500 mt-0.5" />
          <div className="flex-1 min-w-0">
            <p className="text-sm font-semibold text-red-700">{title}</p>
            <pre className="mt-1 whitespace-pre-wrap break-all text-xs text-red-600 font-mono leading-relaxed">
              {error}
            </pre>
          </div>
          <div className="flex items-center gap-2 flex-shrink-0">
            {/* Botón revisar */}
            <button
              onClick={() => setShowModal(true)}
              className="flex items-center gap-1.5 rounded-lg border border-red-300 bg-white px-2.5 py-1.5 text-xs font-semibold text-red-700 hover:bg-red-50 transition-colors"
            >
              <Wrench size={12} />
              Revisar y arreglar
            </button>
            {/* Botón cerrar */}
            {onDismiss && (
              <button onClick={onDismiss} className="text-red-400 hover:text-red-600">
                <X size={14} />
              </button>
            )}
          </div>
        </div>
      </div>

      {/* Modal */}
      {showModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 px-4">
          <div className="w-full max-w-lg rounded-2xl bg-white shadow-xl flex flex-col max-h-[90vh]">

            {/* Header */}
            <div className="flex items-center justify-between px-5 pt-5 pb-3 flex-shrink-0">
              <div className="flex items-center gap-2">
                <Wrench size={16} className="text-zinc-600" />
                <h2 className="text-base font-semibold text-zinc-800">Preparar para Claude</h2>
              </div>
              <button onClick={() => setShowModal(false)}>
                <X size={16} className="text-zinc-400" />
              </button>
            </div>

            <div className="overflow-y-auto px-5 pb-2 flex-1 space-y-4">
              {/* Error (solo lectura) */}
              <div>
                <p className="mb-1.5 text-xs font-semibold text-zinc-500 uppercase tracking-wide">Error detectado</p>
                <pre className="rounded-lg bg-red-50 border border-red-100 p-3 text-xs text-red-700 font-mono whitespace-pre-wrap break-all max-h-36 overflow-y-auto">
                  {error}
                </pre>
              </div>

              {/* Comentario opcional */}
              <div>
                <p className="mb-1.5 text-xs font-semibold text-zinc-500 uppercase tracking-wide">
                  Tu contexto <span className="font-normal normal-case text-zinc-400">(opcional)</span>
                </p>
                <textarea
                  value={comment}
                  onChange={e => setComment(e.target.value)}
                  placeholder="Ej: esto pasó después de cambiar el modelo, o siempre falla cuando selecciono crypto..."
                  rows={3}
                  className="w-full rounded-xl border border-zinc-200 px-3 py-2 text-sm text-zinc-700 placeholder:text-zinc-400 focus:outline-none focus:border-zinc-400 resize-none"
                />
              </div>

              {/* Preview del prompt */}
              <div>
                <p className="mb-1.5 text-xs font-semibold text-zinc-500 uppercase tracking-wide">Prompt listo para copiar</p>
                <pre className="rounded-lg bg-zinc-50 border border-zinc-100 p-3 text-xs text-zinc-500 font-mono whitespace-pre-wrap max-h-40 overflow-y-auto">
                  {PROMPT_TEMPLATE(error, comment)}
                </pre>
              </div>
            </div>

            {/* Botón copiar */}
            <div className="px-5 py-4 flex-shrink-0 border-t border-zinc-100">
              <button
                onClick={handleCopy}
                className={cn(
                  "w-full flex items-center justify-center gap-2 rounded-xl py-2.5 text-sm font-semibold transition-all",
                  copied
                    ? "bg-emerald-500 text-white"
                    : "bg-zinc-900 text-white hover:bg-zinc-700"
                )}
              >
                {copied ? <Check size={14} /> : <Copy size={14} />}
                {copied ? "¡Copiado! Pégalo en Claude" : "Copiar prompt para Claude"}
              </button>
              <p className="mt-2 text-center text-xs text-zinc-400">
                Pega este texto directamente en el chat de Claude Code
              </p>
            </div>
          </div>
        </div>
      )}
    </>
  )
}
