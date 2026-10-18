"use client";

import { useEffect, type ReactNode } from "react";

/**
 * Cuadro rectangular centrado con encabezado verde (mismo estilo que la ficha
 * y el formulario de la cerda). El contenido se desplaza solo hacia arriba y
 * abajo; el desplazamiento lateral queda bloqueado.
 */
export default function Modal({
  abierta,
  titulo,
  subtitulo,
  etiqueta,
  icono,
  onCerrar,
  children,
}: {
  abierta: boolean;
  titulo: string;
  subtitulo?: string;
  /** Texto pequeño en mayúsculas sobre el título */
  etiqueta?: string;
  icono?: ReactNode;
  onCerrar: () => void;
  children: ReactNode;
}) {
  useEffect(() => {
    if (!abierta) return;
    const alPresionar = (e: KeyboardEvent) => e.key === "Escape" && onCerrar();
    window.addEventListener("keydown", alPresionar);
    const html = document.documentElement;
    const antes = { body: document.body.style.overflow, html: html.style.overflowX };
    document.body.style.overflow = "hidden";
    html.style.overflowX = "hidden";
    return () => {
      window.removeEventListener("keydown", alPresionar);
      document.body.style.overflow = antes.body;
      html.style.overflowX = antes.html;
    };
  }, [abierta, onCerrar]);

  if (!abierta) return null;

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-label={titulo}
      className="fixed inset-0 z-[70] flex items-center justify-center overflow-hidden p-4"
      style={{
        paddingTop: "calc(env(safe-area-inset-top) + 1rem)",
        paddingBottom: "calc(env(safe-area-inset-bottom) + 1rem)",
        touchAction: "pan-y",
      }}
    >
      <button
        type="button"
        aria-label="Cerrar"
        onClick={onCerrar}
        className="modal-fondo absolute inset-0 bg-slate-950/45 backdrop-blur-[2px]"
      />

      <div className="modal-caja relative flex max-h-full w-full min-w-0 max-w-md flex-col overflow-hidden rounded-[28px] bg-white text-slate-900 shadow-2xl">
        <div className="relative shrink-0 overflow-hidden bg-emerald-900 px-5 py-5 text-white">
          <div
            aria-hidden="true"
            className="pointer-events-none absolute inset-0 opacity-60"
            style={{
              backgroundImage:
                "repeating-linear-gradient(90deg, rgba(255,255,255,0.05) 0 10px, transparent 10px 26px)",
            }}
          />
          <button
            type="button"
            onClick={onCerrar}
            aria-label="Cerrar"
            className="absolute right-3 top-3 z-20 flex h-11 w-11 touch-manipulation items-center justify-center rounded-full bg-white/15 text-white transition hover:bg-white/25 active:bg-white/30"
          >
            <svg viewBox="0 0 24 24" className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth={2.4} strokeLinecap="round" aria-hidden="true">
              <path d="M6 6l12 12M18 6 6 18" />
            </svg>
          </button>
          <div className="relative flex items-center gap-4 pr-12">
            {icono && (
              <span className="flex h-14 w-14 shrink-0 items-center justify-center rounded-2xl bg-white/15 text-3xl" aria-hidden="true">
                {icono}
              </span>
            )}
            <div className="min-w-0">
              {etiqueta && <p className="text-xs font-medium uppercase tracking-[0.18em] text-emerald-200/90">{etiqueta}</p>}
              <p className="mt-0.5 truncate text-xl font-bold">{titulo}</p>
              {subtitulo && <p className="truncate text-xs text-emerald-100/90">{subtitulo}</p>}
            </div>
          </div>
        </div>

        <div
          className="min-w-0 flex-1 overflow-y-auto overflow-x-hidden overscroll-contain px-5 pb-5 pt-4"
          style={{ touchAction: "pan-y" }}
        >
          {children}
        </div>
      </div>

      <style>{`
        .modal-fondo { animation: modal-fade 200ms ease-out both; }
        .modal-caja { animation: modal-entrar 260ms cubic-bezier(0.2, 0.8, 0.2, 1) both; }
        @keyframes modal-fade { from { opacity: 0 } to { opacity: 1 } }
        @keyframes modal-entrar { from { transform: scale(0.96); opacity: 0 } to { transform: none; opacity: 1 } }
        @media (prefers-reduced-motion: reduce) { .modal-fondo, .modal-caja { animation: none; } }
      `}</style>
    </div>
  );
}
