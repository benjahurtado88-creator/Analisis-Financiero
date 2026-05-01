"use client";

import { useEffect, useState } from "react";
import Link from "next/link";

type KeyPoint = { titulo: string; resumen: string; fuente: string; url: string };
type Tool = { nombre: string; que_es: string; por_que_importa: string };
type Report = {
  fecha: string;
  titular_del_dia: string;
  puntos_clave?: KeyPoint[];
  herramientas_destacadas?: Tool[];
  aplicacion_practica?: string;
  veredicto?: string;
  _meta?: { generated_at?: string; transcript_used?: boolean; sources_collected?: Record<string, unknown> };
};

export default function AINewsPage() {
  const [report, setReport] = useState<Report | null>(null);
  const [dates, setDates] = useState<string[]>([]);
  const [selected, setSelected] = useState<string>("");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  const load = async (date?: string) => {
    setLoading(true);
    setError(null);
    try {
      const url = date ? `/api/ai-news?date=${date}` : `/api/ai-news`;
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
    fetch("/api/ai-news?list=1")
      .then((r) => r.json())
      .then((j) => setDates(j.dates || []))
      .catch(() => setDates([]));
    load();
  }, []);

  const onPickDate = (d: string) => {
    setSelected(d);
    load(d);
  };

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 p-6">
      <div className="max-w-4xl mx-auto">
        <header className="flex items-center justify-between mb-6">
          <div>
            <h1 className="text-2xl font-bold">AI Daily</h1>
            <p className="text-sm text-slate-400">Resumen diario filtrado de las fuentes top de IA</p>
          </div>
          <Link href="/" className="text-sm text-blue-400 hover:underline">← Finance.ia</Link>
        </header>

        <div className="flex gap-2 mb-4 items-center">
          <select
            value={selected}
            onChange={(e) => onPickDate(e.target.value)}
            className="bg-slate-800 border border-slate-700 rounded px-2 py-1 text-sm"
          >
            <option value="">Último disponible</option>
            {dates.map((d) => (
              <option key={d} value={d}>{d}</option>
            ))}
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
            <p className="text-xs text-slate-400 mt-2">El cron diario corre 8am Chile. Si no se ha generado hoy, verás el último disponible al elegirlo del selector.</p>
          </div>
        )}

        {report && !loading && (
          <article className="space-y-6">
            <section className="bg-slate-900 border border-slate-800 rounded-lg p-5">
              <p className="text-xs text-slate-500 uppercase tracking-wide">{report.fecha}</p>
              <h2 className="text-xl font-bold mt-1">{report.titular_del_dia}</h2>
            </section>

            {report.puntos_clave && report.puntos_clave.length > 0 && (
              <section>
                <h3 className="text-lg font-semibold mb-3">Puntos clave</h3>
                <ol className="space-y-3">
                  {report.puntos_clave.map((p, i) => (
                    <li key={i} className="bg-slate-900 border border-slate-800 rounded p-4">
                      <div className="flex justify-between items-start gap-3">
                        <h4 className="font-semibold">{i + 1}. {p.titulo}</h4>
                        <span className="text-xs text-slate-500 shrink-0">{p.fuente}</span>
                      </div>
                      <p className="text-slate-300 mt-2 text-sm">{p.resumen}</p>
                      {p.url && (
                        <a href={p.url} target="_blank" rel="noreferrer" className="text-blue-400 text-xs hover:underline mt-2 inline-block">
                          Ver fuente →
                        </a>
                      )}
                    </li>
                  ))}
                </ol>
              </section>
            )}

            {report.herramientas_destacadas && report.herramientas_destacadas.length > 0 && (
              <section>
                <h3 className="text-lg font-semibold mb-3">Herramientas destacadas</h3>
                <ul className="grid sm:grid-cols-2 gap-3">
                  {report.herramientas_destacadas.map((t, i) => (
                    <li key={i} className="bg-slate-900 border border-slate-800 rounded p-3">
                      <p className="font-semibold">{t.nombre}</p>
                      <p className="text-xs text-slate-400 mt-1">{t.que_es}</p>
                      <p className="text-xs text-slate-300 mt-1 italic">{t.por_que_importa}</p>
                    </li>
                  ))}
                </ul>
              </section>
            )}

            {report.aplicacion_practica && (
              <section className="bg-blue-950/30 border border-blue-900 rounded p-4">
                <h3 className="text-lg font-semibold mb-2">Aplicación práctica</h3>
                <p className="text-sm text-slate-200">{report.aplicacion_practica}</p>
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
          </article>
        )}
      </div>
    </div>
  );
}
