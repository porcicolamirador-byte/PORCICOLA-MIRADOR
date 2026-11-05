"use client";

/*
 * Número de factura de una compra. Si aún no se tiene, "General" la guarda como
 * FEG-001, FEG-002… (consecutivo de la granja).
 */

import { Campo, Entrada } from "@/components/ui";
import { FACTURA_GENERAL, siguienteFacturaGeneral } from "@/lib/datos";

export default function CampoFactura({ valor, onCambiar, claseCampo }: { valor: string; onCambiar: (v: string) => void; claseCampo?: string }) {
  const general = valor === FACTURA_GENERAL;
  return (
    <Campo etiqueta="Número de factura *">
      <div className="flex items-stretch gap-2">
        <div className="min-w-0 flex-1">
          {general ? (
            <div className={claseCampo ?? "flex h-full items-center rounded-xl bg-slate-50 px-3.5 py-2.5 text-base text-slate-500 ring-1 ring-slate-200"}>
              {siguienteFacturaGeneral()}
            </div>
          ) : (
            <Entrada value={valor} onChange={(v) => onCambiar(v.toUpperCase().slice(0, 30))} placeholder="Ej. FE-1234" />
          )}
        </div>
        <button
          type="button"
          onClick={() => onCambiar(general ? "" : FACTURA_GENERAL)}
          aria-pressed={general}
          className={`shrink-0 rounded-xl px-3.5 text-sm font-semibold ring-1 transition ${general ? "bg-sky-900 text-white ring-sky-900" : "bg-white text-slate-600 ring-slate-200 active:bg-slate-50"}`}
        >
          General
        </button>
      </div>
    </Campo>
  );
}
