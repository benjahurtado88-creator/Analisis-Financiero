import Link from "next/link"
import { ArrowLeft, AlertCircle } from "lucide-react"

export default function TickerNotFound() {
  return (
    <div className="min-h-screen bg-zinc-50 flex items-center justify-center px-4">
      <div className="absolute inset-0 -z-10 h-full w-full bg-[radial-gradient(#e5e7eb_1px,transparent_1px)] [background-size:32px_32px]" />
      <div className="w-full max-w-md">
        <div className="rounded-2xl border border-red-200 bg-red-50 p-6">
          <div className="flex items-center gap-3 mb-4">
            <AlertCircle className="text-red-500 flex-shrink-0" size={24} />
            <h1 className="text-lg font-bold text-red-700">Ticker no encontrado</h1>
          </div>
          <div className="space-y-2 text-sm text-red-600">
            <p><strong>Posibles causas:</strong></p>
            <ul className="list-disc pl-4 space-y-1">
              <li>El ticker no existe o está mal escrito</li>
              <li>El análisis aún no se ha ejecutado para este ticker</li>
              <li>El script Python falló al generar el JSON</li>
            </ul>
          </div>
          <div className="mt-4 rounded-xl bg-white border border-red-100 p-4 text-xs text-zinc-500 font-mono">
            <p className="font-semibold text-zinc-700 mb-1">Para diagnosticar, corre en terminal:</p>
            <p className="text-zinc-600">PYTHONUTF8=1 python analisis_maia.py [TICKER]</p>
          </div>
        </div>
        <div className="mt-4 flex gap-3">
          <Link href="/analyze" className="flex-1 flex items-center justify-center gap-2 rounded-xl bg-zinc-900 px-4 py-2.5 text-sm font-semibold text-white hover:bg-zinc-700 transition-colors">
            Intentar de nuevo
          </Link>
          <Link href="/" className="flex items-center gap-1.5 rounded-xl border border-zinc-200 bg-white px-4 py-2.5 text-sm font-semibold text-zinc-600 hover:bg-zinc-50 transition-colors">
            <ArrowLeft size={14} />
            Volver
          </Link>
        </div>
      </div>
    </div>
  )
}
