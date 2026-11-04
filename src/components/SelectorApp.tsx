"use client";

/*
 * Lista para elegir una opción con el estilo de la app (en lugar de la lista
 * del navegador): un botón que muestra lo elegido y abre una ventana con las opciones.
 */

import { useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import Modal from "@/components/Modal";

export interface OpcionSelector {
  valor: string;
  texto: string;
  detalle?: string;
  deshabilitado?: boolean;
}

export default function SelectorApp({
  valor,
  opciones,
  onCambiar,
  titulo,
  etiqueta,
  className = "",
  placeholder,
  deshabilitado = false,
  claseBoton,
}: {
  valor: string;
  opciones: OpcionSelector[];
  onCambiar: (v: string) => void;
  /** Título de la ventana */
  titulo: string;
  /** Texto pequeño arriba del título de la ventana */
  etiqueta?: string;
  className?: string;
  /** Texto cuando no hay nada elegido (si no, se muestra la primera opción) */
  placeholder?: string;
  deshabilitado?: boolean;
  /** Reemplaza el estilo del botón (para que se vea como los demás campos) */
  claseBoton?: string;
}) {
  const [abierta, setAbierta] = useState(false);
  const [montado, setMontado] = useState(false);
  useEffect(() => setMontado(true), []);
  const actual = opciones.find((o) => o.valor === valor) ?? (placeholder === undefined ? opciones[0] : undefined);
  const texto = actual?.texto ?? placeholder ?? "Elegir";
  const vacio = !actual;

  return (
    <>
      <button
        type="button"
        onClick={() => !deshabilitado && setAbierta(true)}
        disabled={deshabilitado}
        aria-haspopup="dialog"
        aria-label={`${titulo}: ${texto}`}
        className={`${claseBoton ?? "h-10 rounded-xl border border-slate-200 bg-slate-50 px-3 text-sm text-slate-800"} flex min-w-0 items-center gap-1.5 text-left transition active:bg-slate-100 disabled:opacity-60 ${className}`}
      >
        <span className={`min-w-0 flex-1 truncate ${vacio ? "text-slate-400" : ""}`}>{texto}</span>
        <svg viewBox="0 0 20 20" className="h-4 w-4 shrink-0 text-slate-400" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
          <path d="M5 8l5 5 5-5" />
        </svg>
      </button>
      {abierta && montado && createPortal(
        <Modal abierta etiqueta={etiqueta} titulo={titulo} onCerrar={() => setAbierta(false)}>
          <Rueda
            opciones={opciones}
            valor={valor}
            onElegir={(v) => {
              onCambiar(v);
              setAbierta(false);
            }}
          />
        </Modal>,
        document.body
      )}
    </>
  );
}

const FILA = 48;
const VISIBLES = 5;

/**
 * Rueda para deslizar con el dedo entre las opciones (como la del iPhone):
 * la opción que queda en el centro es la marcada; "Elegir" la confirma.
 * Tocar una opción también la elige de una vez.
 */
function Rueda({ opciones, valor, onElegir }: { opciones: OpcionSelector[]; valor: string; onElegir: (v: string) => void }) {
  const caja = useRef<HTMLDivElement>(null);
  const inicial = Math.max(0, opciones.findIndex((o) => o.valor === valor && !o.deshabilitado));
  const [indice, setIndice] = useState(inicial);
  const espera = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);

  useEffect(() => {
    if (caja.current) caja.current.scrollTop = inicial * FILA;
    return () => clearTimeout(espera.current);
    // Solo al abrir
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const alDeslizar = () => {
    const el = caja.current;
    if (!el) return;
    const i = Math.min(opciones.length - 1, Math.max(0, Math.round(el.scrollTop / FILA)));
    if (i !== indice) {
      setIndice(i);
      try {
        navigator.vibrate?.(5);
      } catch {
        // sin vibración
      }
    }
    // Al soltar, si quedó en una opción deshabilitada, pasa a la siguiente disponible
    clearTimeout(espera.current);
    espera.current = setTimeout(() => {
      if (!opciones[i]?.deshabilitado) return;
      const j = [...opciones.keys()].filter((k) => !opciones[k].deshabilitado).sort((x, y) => Math.abs(x - i) - Math.abs(y - i))[0];
      if (j !== undefined) el.scrollTo({ top: j * FILA, behavior: "smooth" });
    }, 160);
  };

  const marcada = opciones[indice];
  const relleno = ((VISIBLES - 1) / 2) * FILA;

  return (
    <div>
      <div className="relative -mx-1" style={{ height: VISIBLES * FILA }}>
        {/* Franja de la opción marcada */}
        <div className="pointer-events-none absolute inset-x-0 rounded-xl bg-sky-50 ring-1 ring-sky-100" style={{ top: relleno, height: FILA }} />
        <div
          ref={caja}
          onScroll={alDeslizar}
          role="listbox"
          aria-activedescendant={marcada ? `rueda-${indice}` : undefined}
          className="relative h-full snap-y snap-mandatory overflow-y-auto overscroll-contain [scrollbar-width:none] [&::-webkit-scrollbar]:hidden"
          style={{
            paddingTop: relleno,
            paddingBottom: relleno,
            touchAction: "pan-y",
            WebkitOverflowScrolling: "touch",
            maskImage: "linear-gradient(to bottom, transparent, #000 32%, #000 68%, transparent)",
            WebkitMaskImage: "linear-gradient(to bottom, transparent, #000 32%, #000 68%, transparent)",
          }}
        >
          {opciones.map((o, i) => {
            const centro = i === indice;
            return (
              <button
                key={o.valor}
                id={`rueda-${i}`}
                type="button"
                role="option"
                aria-selected={centro}
                disabled={o.deshabilitado}
                onClick={() => onElegir(o.valor)}
                className="flex w-full snap-center items-center justify-center gap-2 px-3 text-center disabled:opacity-35"
                style={{ height: FILA }}
              >
                <span className="min-w-0 truncate">
                  <span className={`text-[16px] transition ${centro ? "font-semibold text-sky-900" : "text-slate-500"}`}>{o.texto}</span>
                  {o.detalle && <span className="ml-1.5 text-xs text-slate-400">{o.detalle}</span>}
                </span>
              </button>
            );
          })}
        </div>
      </div>
      <button
        type="button"
        disabled={!marcada || marcada.deshabilitado}
        onClick={() => marcada && onElegir(marcada.valor)}
        className="mt-4 w-full rounded-2xl bg-sky-900 py-3 text-[15px] font-semibold text-white transition active:bg-sky-950 disabled:opacity-50"
      >
        Elegir{marcada ? ` · ${marcada.texto}` : ""}
      </button>
    </div>
  );
}
