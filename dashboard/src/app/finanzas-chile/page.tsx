"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import ChatPanel from "@/components/ChatPanel";

type Indicador = { nombre: string; valor: string; movimiento: string };
type Punto = { titulo: string; resumen: string; categoria: string };
type Report = {
  fecha: string;
  titular_del_dia: string;
  indicadores_clave?: Indicador[];
  puntos_clave?: Punto[];
  contexto_global?: string;
  que_mirar_hoy?: string;
  veredicto?: string;
  _meta?: { generated_at?: string; transcript_used?: boolean; episode_title?: string; episode_url?: string };
};

export default function FinanzasChilePage() {
  const [report, setReport] = useState<Report | null>(null);
  const [dates, setDates] = useState<string[]>([]);
  const [selected, setSelected] = useState<string>("");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  const load = async (date?: string) => {
    setLoading(true);
    setError(null);
    try {
      const url = date ? `/api/finanzas-chile?date=${date}` : `/api/finanzas-chile`;
      const res = await fetch(url);
      if (!res.ok) {
        const j = await res.json().catch(() => ({}));
        throw new Error(j.message || `HTTP ${res.status}`);
      }
      setReport(await res.json());
    } catch (e) {
      setError((e as Error).message);
      setReport(null);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetch("/api/finanzas-chile?list=1")
      .then((r) => r.json())
      .then((j) => setDates(j.dates || []))
      .catch(() => setDates([]));
    load();
  }, []);

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 p-6">
      <div className="max-w-4xl mx-auto">
        <header className="flex items-center justify-between mb-6">
          <div>
            <h1 className="text-2xl font-bold">Finanzas Chile Daily</h1>
            <p className="text-sm text-slate-400">Resumen del podcast Primer Click — Diario Financiero</p>
          </div>
          <Link href="/" className="text-sm text-blue-400 hover:underline">← Finance.ia</Link>
        </header>

        <div className="flex gap-2 mb-4 items-center">
          <select
            value={selected}
            onChange={(e) => { setSelected(e.target.value); load(e.target.value || undefined); }}
            className="bg-slate-800 border border-slate-700 rounded px-2 py-1 text-sm"
          >
            <option value="">Último disponible</option>
            {dates.map((d) => <option key={d} value={d}>{d}</option>)}
          </select>
          <button
            onClick={() => load(selected || undefined)}
            className="text-sm bg-slate-800 border border-slate-700 hover:bg-slate-700 rounded px-3 py-1"
          >
            Recargar
          </button>
        </div>

        {loading && <p className="text-slate-400">Cargando...</p>}

        {error && (
          <div className="bg-red-900/30 border border-red-700 rounded p-4 my-4">
            <p className="font-semibold">Sin reporte disponible</p>
            <p className="text-sm text-slate-300 mt-1">{error}</p>
            <p className="text-xs text-slate-400 mt-2">El cron diario corre 10am Chile (después que abre la bolsa).</p>
          </div>
        )}

        {report && !loading && (
          <article className="space-y-6">
            <section className="bg-slate-900 border border-slate-800 rounded-lg p-5">
              <p className="text-xs text-slate-500 uppercase tracking-wide">{report.fecha}</p>
              <h2 className="text-xl font-bold mt-1">{report.titular_del_dia}</h2>
              {report._meta?.episode_title && (
                <p className="text-xs text-slate-500 mt-2">
                  Episodio: {report._meta.episode_url ? (
                    <a href={report._meta.episode_url} target="_blank" rel="noreferrer" className="text-blue-400 hover:underline">{report._meta.episode_title}</a>
                  ) : report._meta.episode_title}
                </p>
              )}
            </section>

            {report.indicadores_clave && report.indicadores_clave.length > 0 && (
              <section>
                <h3 className="text-lg font-semibold mb-3">Indicadores clave</h3>
                <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
                  {report.indicadores_clave.map((ind, i) => (
                    <div key={i} className="bg-slate-900 border border-slate-800 rounded p-3">
                      <p className="text-xs text-slate-400">{ind.nombre}</p>
                      <p className="text-lg font-semibold mt-1">{ind.valor}</p>
                      <p className="text-xs text-slate-500 mt-1">{ind.movimiento}</p>
                    </div>
                  ))}
                </div>
              </section>
            )}

            {report.puntos_clave && report.puntos_clave.length > 0 && (
              <section>
                <h3 className="text-lg font-semibold mb-3">Puntos clave</h3>
                <ol className="space-y-3">
                  {report.puntos_clave.map((p, i) => (
                    <li key={i} className="bg-slate-900 border border-slate-800 rounded p-4">
                      <div className="flex justify-between items-start gap-3">
                        <h4 className="font-semibold">{i + 1}. {p.titulo}</h4>
                        <span className="text-xs text-slate-500 shrink-0 bg-slate-800 px-2 py-0.5 rounded">{p.categoria}</span>
                      </div>
                      <p className="text-slate-300 mt-2 text-sm">{p.resumen}</p>
                    </li>
                  ))}
                </ol>
              </section>
            )}

            {report.contexto_global && (
              <section className="bg-slate-900 border border-slate-800 rounded p-4">
                <h3 className="text-lg font-semibold mb-2">Contexto global</h3>
                <p className="text-sm text-slate-200">{report.contexto_global}</p>
              </section>
            )}

            {report.que_mirar_hoy && (
              <section className="bg-amber-950/30 border border-amber-900 rounded p-4">
                <h3 className="text-lg font-semibold mb-2">Qué mirar hoy</h3>
                <p className="text-sm text-slate-200">{report.que_mirar_hoy}</p>
              </section>
            )}

            {report.veredicto && (
              <section className="bg-slate-900 border border-slate-800 rounded p-4">
                <h3 className="text-lg font-semibold mb-2">Veredicto</h3>
                <p className="text-sm italic text-slate-300">{report.veredicto}</p>
              </section>
            )}

            {report._meta && (
              <footer className="text-xs text-slate-500 pt-4 border-t border-slate-800">
                Generado: {report._meta.generated_at} · Transcripción: {report._meta.transcript_used ? "sí" : "no"}
              </footer>
            )}

            <ChatPanel
              context={report}
              topic="finanzas-chile"
              placeholder="Pregunta sobre el día financiero..."
              starterQuestions={[
                "¿Qué significa estanflación y cómo me afecta?",
                "¿Por qué importa la decisión de Powell?",
                "¿Cómo me afecta el alza del petróleo en Chile?",
                "Resume en una frase qué pasó hoy",
              ]}
            />
          </article>
        )}
      </div>
    </div>
  );
}
