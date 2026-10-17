"use client";

import type { ReactNode } from "react";
import { useRouter } from "next/navigation";
import PageShell from "@/components/PageShell";

export const TONOS = {
  emerald: "bg-emerald-100 text-emerald-800",
  amber: "bg-amber-100 text-amber-800",
  rose: "bg-rose-100 text-rose-800",
  sky: "bg-sky-100 text-sky-800",
  violet: "bg-violet-100 text-violet-800",
  stone: "bg-stone-200 text-stone-800",
  slate: "bg-slate-200 text-slate-800",
  orange: "bg-orange-100 text-orange-800",
  teal: "bg-teal-100 text-teal-800",
  pink: "bg-pink-100 text-pink-800",
} as const;

/**
 * Marco común de los módulos: fondo blanco (también en la isla dinámica),
 * botón de volver, título y acción opcional.
 */
export default function ModuloPage({
  titulo,
  subtitulo,
  icono,
  tono = "emerald",
  accion,
  volverA = "/dashboard",
  children,
}: {
  titulo: string;
  subtitulo?: string;
  icono?: string;
  tono?: keyof typeof TONOS;
  accion?: ReactNode;
  volverA?: string;
  children: ReactNode;
}) {
  const router = useRouter();

  return (
    <PageShell bgColor="#ffffff">
      <div className="mx-auto flex w-full max-w-xl flex-col gap-4 pb-10">
        <header className="flex items-center gap-3">
          <button
            type="button"
            onClick={() => (window.history.length > 1 ? router.back() : router.push(volverA))}
            aria-label="Volver"
            className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-slate-100 text-slate-700 transition hover:bg-slate-200 active:scale-95"
          >
            <svg viewBox="0 0 24 24" className="h-5 w-5" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
              <path d="M15 6l-6 6 6 6" />
            </svg>
          </button>
          {icono && (
            <span className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-xl text-xl ${TONOS[tono]}`} aria-hidden="true">
              {icono}
            </span>
          )}
          <div className="min-w-0 flex-1">
            <h1 className="truncate text-xl font-bold leading-tight text-slate-950">{titulo}</h1>
            {subtitulo && <p className="truncate text-xs text-slate-500">{subtitulo}</p>}
          </div>
          {accion}
        </header>

        {children}
      </div>
    </PageShell>
  );
}
