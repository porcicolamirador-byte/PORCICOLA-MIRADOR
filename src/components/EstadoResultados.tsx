"use client";

/**
 * Estado de resultados (vista profesional de Contabilidad): los movimientos
 * agrupados por clase contable, del ingreso a la utilidad neta.
 * Base de caja: cuenta lo que se cobró y se pagó (lo comprado a crédito entra con cada abono).
 */

import { useState } from "react";
import { formatoPesos, type Movimiento } from "@/lib/datos";

type Clase = "costo" | "operacion" | "otros";

/** Clase contable de cada categoría de gasto */
const CLASE_GASTO: Record<string, Clase> = {
  Alimento: "costo",
  Genética: "costo",
  "Genética / semen": "costo",
  "Medicamentos y vacunas": "costo",
  Insumos: "costo",
  Bioseguridad: "costo",
  "Mano de obra": "operacion",
  "Servicios (agua, luz)": "operacion",
  Mantenimiento: "operacion",
  Transporte: "operacion",
  "Gastos generales": "operacion",
  "Otros gastos": "operacion",
  Pérdidas: "otros",
};
const claseDe = (categoria: string): Clase => CLASE_GASTO[categoria] ?? "operacion";
/** Genética y Genética / semen van en una sola línea */
const lineaDe = (categoria: string) => (categoria === "Genética / semen" ? "Genética" : categoria);

export interface Resultados {
  ingresos: [string, number][];
  costos: [string, number][];
  operacion: [string, number][];
  otros: [string, number][];
  totalIngresos: number;
  totalCostos: number;
  totalOperacion: number;
  totalOtros: number;
  utilidadBruta: number;
  utilidadOperacional: number;
  utilidadNeta: number;
}

export function calcularResultados(movs: Movimiento[]): Resultados {
  const sumar = (lista: Movimiento[]) => {
    const acc = new Map<string, number>();
    for (const m of lista) acc.set(lineaDe(m.categoria || "Otros"), (acc.get(lineaDe(m.categoria || "Otros")) ?? 0) + m.monto);
    return [...acc.entries()].sort((a, b) => b[1] - a[1]);
  };
  const total = (l: [string, number][]) => l.reduce((s, [, v]) => s + v, 0);
  const gastos = movs.filter((m) => m.tipo === "gasto");
  const ingresos = sumar(movs.filter((m) => m.tipo === "ingreso"));
  const costos = sumar(gastos.filter((m) => claseDe(m.categoria) === "costo"));
  const operacion = sumar(gastos.filter((m) => claseDe(m.categoria) === "operacion"));
  const otros = sumar(gastos.filter((m) => claseDe(m.categoria) === "otros"));
  const totalIngresos = total(ingresos);
  const totalCostos = total(costos);
  const totalOperacion = total(operacion);
  const totalOtros = total(otros);
  const utilidadBruta = totalIngresos - totalCostos;
  const utilidadOperacional = utilidadBruta - totalOperacion;
  return {
    ingresos,
    costos,
    operacion,
    otros,
    totalIngresos,
    totalCostos,
    totalOperacion,
    totalOtros,
    utilidadBruta,
    utilidadOperacional,
    utilidadNeta: utilidadOperacional - totalOtros,
  };
}

const pct = (v: number, base: number) => (base > 0 ? `${Math.round((v / base) * 100)} %` : "");
const signo = (v: number) => (v < 0 ? "text-rose-600" : "text-slate-900");

function Grupo({ titulo, lineas, total, base, menos }: { titulo: string; lineas: [string, number][]; total: number; base: number; menos?: boolean }) {
  return (
    <div className="px-3.5 py-2.5">
      <div className="flex items-baseline justify-between gap-2">
        <p className="text-[11px] font-semibold uppercase tracking-wider text-slate-500">
          {menos && <span className="mr-1 text-slate-400">(−)</span>}
          {titulo}
        </p>
        <p className="text-[13px] font-semibold tabular-nums text-slate-900">{formatoPesos(total)}</p>
      </div>
      {lineas.length === 0 ? (
        <p className="mt-1 text-xs text-slate-400">Sin movimientos</p>
      ) : (
        <ul className="mt-1 flex flex-col gap-0.5">
          {lineas.map(([nombre, v]) => (
            <li key={nombre} className="flex items-baseline justify-between gap-2 pl-3 text-[13px]">
              <span className="min-w-0 truncate text-slate-600">{nombre}</span>
              <span className="shrink-0 tabular-nums text-slate-700">
                {formatoPesos(v)}
                <span className="ml-1.5 inline-block w-9 text-right text-[11px] text-slate-400">{pct(v, base)}</span>
              </span>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

function Resultado({ titulo, valor, base, fuerte }: { titulo: string; valor: number; base: number; fuerte?: boolean }) {
  return (
    <div className={`flex items-baseline justify-between gap-2 px-3.5 py-2 ${fuerte ? "bg-sky-900 text-white" : "bg-slate-50"}`}>
      <p className={`text-[12px] font-bold uppercase tracking-wide ${fuerte ? "text-white" : "text-slate-700"}`}>
        <span className={`mr-1 ${fuerte ? "text-sky-200" : "text-slate-400"}`}>=</span>
        {titulo}
      </p>
      <p className={`text-[15px] font-bold tabular-nums ${fuerte ? (valor < 0 ? "text-rose-200" : "text-white") : signo(valor)}`}>
        {formatoPesos(valor)}
        {base > 0 && <span className={`ml-1.5 text-[11px] font-medium ${fuerte ? "text-sky-200" : "text-slate-400"}`}>{pct(valor, base)}</span>}
      </p>
    </div>
  );
}

/** Estado de resultados de un periodo */
export function TablaResultados({ r }: { r: Resultados }) {
  const base = r.totalIngresos;
  return (
    <div className="divide-y divide-slate-100">
      <Grupo titulo="Ingresos operacionales" lineas={r.ingresos} total={r.totalIngresos} base={base} />
      <Grupo titulo="Costos de producción" lineas={r.costos} total={r.totalCostos} base={base} menos />
      <Resultado titulo="Utilidad bruta" valor={r.utilidadBruta} base={base} />
      <Grupo titulo="Gastos de operación" lineas={r.operacion} total={r.totalOperacion} base={base} menos />
      <Resultado titulo="Utilidad operacional" valor={r.utilidadOperacional} base={base} />
      {(r.totalOtros > 0 || r.otros.length > 0) && <Grupo titulo="Otros egresos" lineas={r.otros} total={r.totalOtros} base={base} menos />}
      <Resultado titulo="Utilidad neta" valor={r.utilidadNeta} base={base} fuerte />
    </div>
  );
}

/** Tarjeta: el mes con su estado de resultados y el acumulado de la granja */
export default function EstadoResultados({
  mesTexto,
  onAnterior,
  onSiguiente,
  delMes,
  mesAnterior,
  acumulado,
}: {
  mesTexto: string;
  onAnterior: () => void;
  onSiguiente: () => void;
  delMes: Resultados;
  mesAnterior: Resultados;
  acumulado: Resultados;
}) {
  const [vista, setVista] = useState<"mes" | "acumulado">("mes");
  const r = vista === "mes" ? delMes : acumulado;
  const cambio = delMes.utilidadNeta - mesAnterior.utilidadNeta;
  const hayAnterior = mesAnterior.totalIngresos > 0 || mesAnterior.totalCostos + mesAnterior.totalOperacion + mesAnterior.totalOtros > 0;

  return (
    <section className="flex flex-col gap-2.5">
      {/* Indicadores del mes */}
      <div className="overflow-hidden rounded-2xl bg-white ring-1 ring-slate-200">
        <div className="flex items-center justify-between border-b border-slate-100 px-1.5 py-1">
          <button type="button" onClick={onAnterior} aria-label="Mes anterior" className="flex h-8 w-8 items-center justify-center rounded-lg text-lg text-slate-500 active:bg-slate-100">
            ‹
          </button>
          <span className="text-sm font-semibold capitalize text-slate-900">{mesTexto}</span>
          <button type="button" onClick={onSiguiente} aria-label="Mes siguiente" className="flex h-8 w-8 items-center justify-center rounded-lg text-lg text-slate-500 active:bg-slate-100">
            ›
          </button>
        </div>
        <div className="grid grid-cols-2 divide-x divide-y divide-slate-100">
          {[
            { t: "Ingresos", v: formatoPesos(delMes.totalIngresos), c: "text-sky-700" },
            { t: "Costos y gastos", v: formatoPesos(delMes.totalCostos + delMes.totalOperacion + delMes.totalOtros), c: "text-slate-900" },
            { t: "Utilidad neta", v: formatoPesos(delMes.utilidadNeta), c: delMes.utilidadNeta < 0 ? "text-rose-600" : "text-sky-700" },
            {
              t: "Margen neto",
              v: delMes.totalIngresos > 0 ? `${Math.round((delMes.utilidadNeta / delMes.totalIngresos) * 100)} %` : "—",
              c: delMes.utilidadNeta < 0 ? "text-rose-600" : "text-slate-900",
            },
          ].map((x) => (
            <div key={x.t} className="min-w-0 px-3 py-2.5">
              <p className="text-[10px] font-medium uppercase tracking-wide text-slate-400">{x.t}</p>
              <p className={`truncate text-[16px] font-bold tabular-nums ${x.c}`}>{x.v}</p>
            </div>
          ))}
        </div>
        {hayAnterior && (
          <p className="border-t border-slate-100 bg-slate-50 px-3 py-1.5 text-center text-[11px] text-slate-500">
            Utilidad vs. mes anterior:{" "}
            <span className={`font-semibold tabular-nums ${cambio < 0 ? "text-rose-600" : "text-sky-700"}`}>
              {cambio >= 0 ? "+" : "−"}
              {formatoPesos(Math.abs(cambio))}
            </span>
          </p>
        )}
      </div>

      {/* Estado de resultados */}
      <div className="overflow-hidden rounded-2xl bg-white ring-1 ring-slate-200">
        <div className="flex items-center justify-between gap-2 border-b border-slate-100 px-3.5 py-2">
          <div className="min-w-0">
            <p className="text-sm font-semibold text-slate-900">Estado de resultados</p>
            <p className="text-[11px] text-slate-400">{vista === "mes" ? mesTexto : "Desde el primer movimiento"} · base de caja</p>
          </div>
          <div className="flex shrink-0 rounded-lg bg-slate-100 p-0.5 text-[11px] font-semibold">
            {(["mes", "acumulado"] as const).map((v) => (
              <button
                key={v}
                type="button"
                onClick={() => setVista(v)}
                className={`rounded-md px-2.5 py-1 ${vista === v ? "bg-white text-slate-900 shadow-sm" : "text-slate-500"}`}
              >
                {v === "mes" ? "Mes" : "Acumulado"}
              </button>
            ))}
          </div>
        </div>
        <TablaResultados r={r} />
      </div>
    </section>
  );
}

/** Título de un grupo de la vista profesional */
export function TituloGrupo({ numero, titulo, texto }: { numero: string; titulo: string; texto: string }) {
  return (
    <div className="mt-2 flex items-start gap-2.5 px-1">
      <span className="mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded-md bg-sky-900 text-[10px] font-bold text-white">{numero}</span>
      <div className="min-w-0">
        <p className="text-[13px] font-bold uppercase tracking-wide text-slate-800">{titulo}</p>
        <p className="text-[11px] text-slate-500">{texto}</p>
      </div>
    </div>
  );
}
