"use client";

/*
 * Formulario corto para elegir un medicamento o vacuna de Gastos de producción,
 * la cantidad aplicada por animal y ver cuánto vale (se suma al lote).
 */

import { useEffect, useMemo, useState } from "react";
import SelectorApp from "@/components/SelectorApp";
import { Campo, CLASE_SELECTOR, Entrada } from "@/components/ui";
import { convertirUnidad, formatoPesos, medicamentosRegistrados } from "@/lib/datos";

export interface ResultadoMedicamento {
  gastoId: string;
  nombre: string;
  cantidadAnimal: number;
  unidadDosis: string;
  animales: number;
  /** En la unidad de compra */
  cantidadUsada: number;
  costo: number;
  texto: string;
}

const fmtN = (n: number) => (Math.round(n * 100) / 100).toLocaleString("es-CO");

export default function CostoMedicamento({
  animales,
  dias = 1,
  sugerir,
  onCambiar,
}: {
  animales: number;
  dias?: number;
  /** Palabra para elegir de una vez el medicamento (por ejemplo "hierro") */
  sugerir?: string;
  /** null = sin medicamento elegido; "otro" = aplicado sin costo */
  onCambiar: (r: ResultadoMedicamento | "otro" | null) => void;
}) {
  const meds = useMemo(() => medicamentosRegistrados(), []);
  const [medId, setMedId] = useState(() => (sugerir ? meds.find((m) => m.nombre.toLowerCase().includes(sugerir.toLowerCase()))?.id ?? "" : ""));
  const [porAnimal, setPorAnimal] = useState("");
  const [unidadDosis, setUnidadDosis] = useState("");
  const med = meds.find((m) => m.id === medId);
  const unidades = med ? (med.unidad === "Dosis" ? ["Dosis"] : ["ml", "Litro"]) : [];
  const u = unidadDosis && unidades.includes(unidadDosis) ? unidadDosis : med?.unidad ?? "";
  const cant = Number(porAnimal.replace(",", ".")) || 0;
  const nDias = Math.max(1, dias);
  const usado = med && cant > 0 ? convertirUnidad(cant * animales * nDias, u, med.unidad) : 0;
  const costo = med && usado > 0 ? Math.round(usado * med.valorUnitario) : 0;

  useEffect(() => {
    if (medId === "OTRO") return onCambiar("otro");
    if (!med || !(cant > 0) || !(usado > 0)) return onCambiar(null);
    onCambiar({
      gastoId: med.id,
      nombre: med.nombre,
      cantidadAnimal: cant,
      unidadDosis: u,
      animales,
      cantidadUsada: usado,
      costo,
      texto: `${fmtN(cant)} ${u} × ${animales} ${animales === 1 ? "animal" : "animales"}${nDias > 1 ? ` × ${nDias} días` : ""} · ${formatoPesos(costo)}`,
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [medId, cant, u, animales, nDias]);

  return (
    <div className="flex flex-col gap-3">
      <Campo etiqueta="Medicamento aplicado *">
        <SelectorApp
          valor={medId}
          onCambiar={(v) => {
            setMedId(v);
            setUnidadDosis("");
          }}
          titulo="Medicamento aplicado"
          placeholder={meds.length ? "Elige el medicamento" : "Sin medicamentos en Gastos de producción"}
          opciones={[
            ...meds.map((m) => ({ valor: m.id, texto: `${m.nombre} · ${formatoPesos(m.valorUnitario)}/${m.unidad}`, detalle: `quedan ${fmtN(m.restante)} ${m.unidad}` })),
            { valor: "OTRO", texto: "Otro (sin costo)" },
          ]}
          className="w-full"
          claseBoton={CLASE_SELECTOR}
        />
      </Campo>
      {med && (
        <>
          <div className="grid grid-cols-2 gap-3">
            <Campo etiqueta="Cantidad por animal *">
              <Entrada type="number" inputMode="decimal" value={porAnimal} onChange={(v) => setPorAnimal(v.slice(0, 8))} />
            </Campo>
            <Campo etiqueta="Unidad">
              <div className={`grid gap-1 rounded-2xl bg-slate-100 p-1 ${unidades.length > 1 ? "grid-cols-2" : "grid-cols-1"}`} role="radiogroup" aria-label="Unidad">
                {unidades.map((x) => (
                  <button
                    key={x}
                    type="button"
                    role="radio"
                    aria-checked={u === x}
                    onClick={() => setUnidadDosis(x)}
                    className={`rounded-xl py-2 text-sm font-semibold transition ${u === x ? "bg-white text-slate-900 shadow-sm" : "text-slate-500"}`}
                  >
                    {x}
                  </button>
                ))}
              </div>
            </Campo>
          </div>
          {cant > 0 && (
            <div className="flex flex-col gap-1 rounded-2xl bg-sky-50 px-4 py-3 ring-1 ring-sky-100">
              <div className="flex items-center justify-between text-sm text-sky-900">
                <span>
                  {fmtN(cant)} {u} × {animales} {animales === 1 ? "animal" : "animales"}
                  {nDias > 1 ? ` × ${nDias} días` : ""}
                </span>
                <span className="font-semibold tabular-nums">
                  {fmtN(usado)} {med.unidad}
                </span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-sm text-sky-900">Costo que se suma al lote</span>
                <span className="text-lg font-bold tabular-nums text-sky-900">{formatoPesos(costo)}</span>
              </div>
              {usado > med.restante + 1e-9 && (
                <p className="text-xs font-medium text-amber-700">
                  Solo quedan {fmtN(med.restante)} {med.unidad} de esta compra.
                </p>
              )}
            </div>
          )}
        </>
      )}
    </div>
  );
}
