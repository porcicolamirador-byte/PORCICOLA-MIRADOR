"use client";

import { useEffect, useRef, useState } from "react";

/**
 * Cuadro con estilo de alerta nativa que pide un código numérico.
 * Llama a onValidar(codigo); si devuelve false muestra "Código incorrecto".
 */
export default function DialogoClave({
  abierto,
  titulo,
  mensaje,
  longitud = 4,
  aceptar = "Continuar",
  onValidar,
  onCerrar,
}: {
  abierto: boolean;
  titulo: string;
  mensaje?: string;
  longitud?: number;
  aceptar?: string;
  onValidar: (codigo: string) => boolean;
  onCerrar: () => void;
}) {
  const [codigo, setCodigo] = useState("");
  const [error, setError] = useState("");
  const [sacudir, setSacudir] = useState(false);
  const campo = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (!abierto) return;
    setCodigo("");
    setError("");
    const t = window.setTimeout(() => campo.current?.focus(), 50);
    return () => window.clearTimeout(t);
  }, [abierto]);

  if (!abierto) return null;

  const enviar = () => {
    if (onValidar(codigo)) {
      setCodigo("");
      setError("");
      return;
    }
    setError("Código incorrecto");
    setCodigo("");
    setSacudir(true);
    window.setTimeout(() => setSacudir(false), 400);
    campo.current?.focus();
  };

  return (
    <div role="alertdialog" aria-modal="true" aria-labelledby="clave-titulo" className="fixed inset-0 z-[95] flex items-center justify-center p-6">
      <div aria-hidden="true" className="clave-fondo absolute inset-0 bg-slate-950/40" onClick={onCerrar} />
      <div
        className={`clave-caja relative w-full max-w-[290px] overflow-hidden rounded-[18px] bg-white/95 text-center shadow-2xl backdrop-blur-xl ${
          sacudir ? "clave-sacudir" : ""
        }`}
      >
        <div className="px-5 pb-4 pt-5">
          <div className="mx-auto mb-2 flex h-11 w-11 items-center justify-center rounded-full bg-slate-100 text-slate-700" aria-hidden="true">
            <svg viewBox="0 0 24 24" className="h-5 w-5" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
              <rect x="5" y="11" width="14" height="10" rx="2" />
              <path d="M8 11V8a4 4 0 0 1 8 0v3" />
            </svg>
          </div>
          <h2 id="clave-titulo" className="text-[17px] font-semibold leading-snug text-slate-900">
            {titulo}
          </h2>
          {mensaje && <p className="mt-1.5 text-[13px] leading-snug text-slate-600">{mensaje}</p>}

          <input
            ref={campo}
            type="password"
            inputMode="numeric"
            pattern="[0-9]*"
            autoComplete="off"
            value={codigo}
            maxLength={longitud}
            onChange={(e) => {
              setCodigo(e.target.value.replace(/\D/g, "").slice(0, longitud));
              if (error) setError("");
            }}
            onKeyDown={(e) => {
              if (e.key === "Enter") enviar();
              if (e.key === "Escape") onCerrar();
            }}
            placeholder={"•".repeat(longitud)}
            aria-label="Código de confirmación"
            className={`mt-3 h-11 w-full rounded-xl border bg-slate-50 text-center text-xl tracking-[0.6em] text-slate-900 outline-none placeholder:text-slate-300 focus:bg-white focus:ring-2 ${
              error ? "border-red-400 focus:ring-red-200" : "border-slate-200 focus:ring-emerald-200"
            }`}
          />
          {error && <p className="mt-2 text-[13px] font-medium text-red-600">{error}</p>}
        </div>

        <div className="grid grid-cols-2 divide-x divide-slate-200 border-t border-slate-200">
          <button type="button" onClick={onCerrar} className="py-3 text-[17px] text-emerald-700 transition active:bg-slate-100">
            Cancelar
          </button>
          <button
            type="button"
            onClick={enviar}
            disabled={codigo.length === 0}
            className="py-3 text-[17px] font-semibold text-emerald-700 transition active:bg-slate-100 disabled:text-slate-300"
          >
            {aceptar}
          </button>
        </div>
      </div>
      <style>{`
        .clave-fondo { animation: clave-fade 160ms ease-out both; }
        .clave-caja { animation: clave-entrar 200ms cubic-bezier(0.2, 0.8, 0.2, 1) both; }
        .clave-sacudir { animation: clave-sacudir 360ms ease-in-out both; }
        @keyframes clave-fade { from { opacity: 0 } to { opacity: 1 } }
        @keyframes clave-entrar { from { transform: scale(1.12); opacity: 0 } to { transform: none; opacity: 1 } }
        @keyframes clave-sacudir {
          0%, 100% { transform: translateX(0) } 20% { transform: translateX(-10px) } 40% { transform: translateX(9px) }
          60% { transform: translateX(-6px) } 80% { transform: translateX(4px) }
        }
        @media (prefers-reduced-motion: reduce) { .clave-fondo, .clave-caja, .clave-sacudir { animation: none; } }
      `}</style>
    </div>
  );
}
