"use client";

import { useState } from "react";

export interface SerieGrafica {
  nombre: string;
  color: string;
}

export interface GrupoGrafica {
  /** Etiqueta corta en el eje (p. ej. "Ago") */
  etiqueta: string;
  /** Etiqueta larga para el detalle (p. ej. "Agosto 2026") */
  detalle?: string;
  valores: number[];
}

/** Escala "bonita" para el eje: 1, 2, 2.5, 5 × 10^n */
function maximoRedondo(max: number): number {
  if (max <= 0) return 1;
  const exp = Math.pow(10, Math.floor(Math.log10(max)));
  for (const m of [1, 2, 2.5, 5, 10]) if (m * exp >= max) return m * exp;
  return 10 * exp;
}

const compacto = (n: number) =>
  Math.abs(n) >= 1_000_000
    ? `${(n / 1_000_000).toLocaleString("es-CO", { maximumFractionDigits: 1 })} M`
    : Math.abs(n) >= 10_000
      ? `${Math.round(n / 1000).toLocaleString("es-CO")} mil`
      : n.toLocaleString("es-CO", { maximumFractionDigits: 1 });

/**
 * Barras verticales por grupo (meses). Una o varias series lado a lado.
 * Al tocar una columna se muestra su valor arriba; por defecto el último grupo.
 */
export function BarrasVerticales({
  grupos,
  series,
  formato = compacto,
  alto = 150,
}: {
  grupos: GrupoGrafica[];
  series: SerieGrafica[];
  formato?: (n: number) => string;
  alto?: number;
}) {
  const [sel, setSel] = useState(grupos.length - 1);
  const actual = grupos[Math.min(sel, grupos.length - 1)];
  const max = maximoRedondo(Math.max(0, ...grupos.flatMap((g) => g.valores)));
  const vacio = grupos.every((g) => g.valores.every((v) => !v));
  const lineas = [1, 0.5, 0];

  return (
    <div className="min-w-0">
      {/* Detalle del grupo seleccionado */}
      <div className="mb-3 flex min-h-[44px] flex-wrap items-end gap-x-5 gap-y-1">
        <p className="w-full text-xs font-medium text-slate-500">{actual?.detalle ?? actual?.etiqueta}</p>
        {series.map((s, i) => (
          <div key={s.nombre} className="flex items-center gap-1.5">
            <span className="h-2.5 w-2.5 rounded-[3px]" style={{ backgroundColor: s.color }} aria-hidden="true" />
            {series.length > 1 && <span className="text-xs text-slate-500">{s.nombre}</span>}
            <span className="text-lg font-bold tabular-nums text-slate-900">{formato(actual?.valores[i] ?? 0)}</span>
          </div>
        ))}
      </div>

      <div className="relative flex gap-2">
        {/* Eje Y */}
        <div className="relative w-9 shrink-0" style={{ height: alto }} aria-hidden="true">
          {lineas.map((f) => (
            <span
              key={f}
              className="absolute right-0 -translate-y-1/2 text-[10px] tabular-nums text-slate-400"
              style={{ top: `${(1 - f) * 100}%` }}
            >
              {formato(max * f)}
            </span>
          ))}
        </div>

        <div className="relative min-w-0 flex-1">
          {/* Cuadrícula */}
          <div className="pointer-events-none absolute inset-x-0 top-0" style={{ height: alto }} aria-hidden="true">
            {lineas.map((f) => (
              <div
                key={f}
                className={`absolute inset-x-0 border-t ${f === 0 ? "border-slate-300" : "border-dashed border-slate-200"}`}
                style={{ top: `${(1 - f) * 100}%` }}
              />
            ))}
          </div>

          <div className="relative flex" role="list">
            {grupos.map((g, gi) => {
              const activo = gi === sel;
              return (
                <button
                  key={g.etiqueta + gi}
                  type="button"
                  role="listitem"
                  onClick={() => setSel(gi)}
                  aria-label={`${g.detalle ?? g.etiqueta}: ${series.map((s, i) => `${s.nombre} ${formato(g.valores[i] ?? 0)}`).join(", ")}`}
                  className={`flex min-w-0 flex-1 flex-col items-center rounded-lg transition ${activo ? "bg-slate-100/70" : ""}`}
                >
                  <div className="flex w-full items-end justify-center gap-[2px] px-1" style={{ height: alto }}>
                    {series.map((s, i) => {
                      const v = g.valores[i] ?? 0;
                      const h = v > 0 ? Math.max(3, (v / max) * alto) : 0;
                      return (
                        <div
                          key={s.nombre}
                          className="w-full max-w-[22px] rounded-t-[4px] transition-[height,opacity] duration-500"
                          style={{ height: h, backgroundColor: s.color, opacity: activo || sel < 0 ? 1 : 0.55 }}
                        />
                      );
                    })}
                  </div>
                  <span className={`mt-1.5 text-[11px] ${activo ? "font-semibold text-slate-900" : "text-slate-500"}`}>
                    {g.etiqueta}
                  </span>
                </button>
              );
            })}
          </div>

          {vacio && (
            <p className="absolute inset-x-0 top-0 flex items-center justify-center text-sm text-slate-400" style={{ height: alto }}>
              Sin registros aún
            </p>
          )}
        </div>
      </div>
    </div>
  );
}

/** Barras horizontales con nombre, barra y valor (para categorías). */
export function BarrasHorizontales({
  filas,
  formato = compacto,
  total,
}: {
  filas: { nombre: string; valor: number; color: string; detalle?: string }[];
  formato?: (n: number) => string;
  /** Si se da, muestra también el porcentaje sobre este total */
  total?: number;
}) {
  const max = Math.max(1, ...filas.map((f) => f.valor));
  return (
    <ul className="space-y-3">
      {filas.map((f) => (
        <li key={f.nombre} className="min-w-0">
          <div className="mb-1 flex items-baseline gap-2 text-sm">
            <span className="min-w-0 flex-1 truncate text-slate-700">{f.nombre}</span>
            {f.detalle && <span className="shrink-0 text-xs text-slate-400">{f.detalle}</span>}
            <span className="shrink-0 font-semibold tabular-nums text-slate-900">{formato(f.valor)}</span>
            {total ? (
              <span className="w-10 shrink-0 text-right text-xs tabular-nums text-slate-500">
                {Math.round((f.valor / total) * 100)} %
              </span>
            ) : null}
          </div>
          <div className="h-2.5 w-full overflow-hidden rounded-full bg-slate-100">
            <div
              className="h-full rounded-full transition-[width] duration-500"
              style={{ width: `${f.valor > 0 ? Math.max(2, (f.valor / max) * 100) : 0}%`, backgroundColor: f.color }}
            />
          </div>
        </li>
      ))}
    </ul>
  );
}
