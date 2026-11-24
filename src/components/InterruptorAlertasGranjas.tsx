"use client";

/** Ajustes: ver y recibir las alertas de todas las granjas (cada usuario lo elige) */

import { useState } from "react";
import { Interruptor } from "@/components/ui";
import { avisar } from "@/components/Dialogo";
import { alertasDeTodasActivas, cambiarAlertasDeTodas } from "@/lib/alertasGranjas";

export default function InterruptorAlertasGranjas() {
  const [activo, setActivo] = useState(alertasDeTodasActivas);
  const [ocupado, setOcupado] = useState(false);

  const cambiar = async (valor: boolean) => {
    if (ocupado) return;
    setOcupado(true);
    setActivo(valor);
    try {
      await cambiarAlertasDeTodas(valor);
    } catch {
      setActivo(!valor);
      await avisar({ titulo: "Alertas de todas las granjas", mensaje: "No se pudo guardar. Revisa la conexión e intenta de nuevo." });
    } finally {
      setOcupado(false);
    }
  };

  return (
    <label className={`flex w-full cursor-pointer items-center gap-3 rounded-3xl bg-white p-4 ring-1 ring-slate-200/80 ${ocupado ? "opacity-70" : ""}`}>
      <span className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-xl ${activo ? "bg-sky-100 text-sky-800" : "bg-slate-200 text-slate-800"}`} aria-hidden="true">
        <svg viewBox="0 0 24 24" className="h-5 w-5" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
          <path d="M3 21h18M5 21V10l7-5 7 5v11" />
          <path d="M9 21v-6h6v6" />
        </svg>
      </span>
      <span className="min-w-0 flex-1">
        <span className="block text-sm font-semibold text-slate-900">Alertas de todas las granjas</span>
        <span className="block text-xs text-slate-500">
          {activo
            ? "Ves y recibes las alertas de todas tus granjas, no solo la abierta"
            : "Solo ves las alertas de la granja abierta"}
        </span>
      </span>
      <Interruptor activo={activo} onCambiar={(v) => void cambiar(v)} />
    </label>
  );
}
