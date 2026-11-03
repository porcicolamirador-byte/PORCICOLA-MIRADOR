"use client";

/*
 * Lista para elegir una opción con el estilo de la app (en lugar de la lista
 * del navegador): un botón que muestra lo elegido y abre una ventana con las opciones.
 */

import { useState } from "react";
import Modal from "@/components/Modal";

export interface OpcionSelector {
  valor: string;
  texto: string;
  detalle?: string;
}

export default function SelectorApp({
  valor,
  opciones,
  onCambiar,
  titulo,
  etiqueta,
  className = "",
}: {
  valor: string;
  opciones: OpcionSelector[];
  onCambiar: (v: string) => void;
  /** Título de la ventana */
  titulo: string;
  /** Texto pequeño arriba del título de la ventana */
  etiqueta?: string;
  className?: string;
}) {
  const [abierta, setAbierta] = useState(false);
  const actual = opciones.find((o) => o.valor === valor) ?? opciones[0];

  return (
    <>
      <button
        type="button"
        onClick={() => setAbierta(true)}
        aria-haspopup="dialog"
        aria-label={`${titulo}: ${actual?.texto ?? ""}`}
        className={`flex h-10 min-w-0 items-center gap-1.5 rounded-xl border border-slate-200 bg-slate-50 px-3 text-left text-sm text-slate-800 transition active:bg-slate-100 ${className}`}
      >
        <span className="min-w-0 flex-1 truncate">{actual?.texto ?? "Elegir"}</span>
        <svg viewBox="0 0 20 20" className="h-4 w-4 shrink-0 text-slate-400" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
          <path d="M5 8l5 5 5-5" />
        </svg>
      </button>
      {abierta && (
        <Modal abierta etiqueta={etiqueta} titulo={titulo} onCerrar={() => setAbierta(false)}>
          <ul className="-mx-1 flex flex-col">
            {opciones.map((o) => {
              const elegida = o.valor === valor;
              return (
                <li key={o.valor}>
                  <button
                    type="button"
                    onClick={() => {
                      onCambiar(o.valor);
                      setAbierta(false);
                    }}
                    className={`flex w-full items-center gap-3 rounded-xl px-3 py-3 text-left transition active:bg-slate-100 ${elegida ? "bg-sky-50" : ""}`}
                  >
                    <span className="min-w-0 flex-1">
                      <span className={`block truncate text-[15px] ${elegida ? "font-semibold text-sky-900" : "text-slate-800"}`}>{o.texto}</span>
                      {o.detalle && <span className="block truncate text-xs text-slate-500">{o.detalle}</span>}
                    </span>
                    {elegida && (
                      <svg viewBox="0 0 20 20" className="h-5 w-5 shrink-0 text-sky-600" fill="none" stroke="currentColor" strokeWidth={2.4} strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                        <path d="m4.5 10.5 3.5 3.5 7.5-8" />
                      </svg>
                    )}
                  </button>
                </li>
              );
            })}
          </ul>
        </Modal>
      )}
    </>
  );
}
