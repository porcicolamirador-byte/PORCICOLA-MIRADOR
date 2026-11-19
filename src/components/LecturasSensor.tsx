"use client";

/**
 * Historial del sensor ESP32: el servidor guarda una lectura cada 5 minutos
 * durante 7 días (las más viejas se borran solas). Aquí se ve por día:
 * gráfica, mínima / promedio / máxima y la lista de lecturas.
 */

import { useEffect, useMemo, useState } from "react";
import { api } from "@/lib/nube";

interface Fila {
  fecha: string;
  temperatura: number | string;
}
interface Punto {
  t: number; // milisegundos
  v: number; // °C
}

const ALTA = 27.5;
const BAJA = 22;
const diaLocal = (ms: number) => {
  const d = new Date(ms);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
};
const horaLocal = (ms: number) => new Date(ms).toLocaleTimeString("es-CO", { hour: "numeric", minute: "2-digit", hour12: true });
const grados = (v: number) => `${v.toFixed(1).replace(".", ",")}°`;
const colorDe = (v: number) => (v > ALTA ? "bg-red-50 text-red-700" : v < BAJA ? "bg-sky-50 text-sky-700" : "bg-orange-50 text-orange-800");

function nombreDia(dia: string) {
  const hoyD = diaLocal(Date.now());
  const ayer = diaLocal(Date.now() - 86400000);
  if (dia === hoyD) return "Hoy";
  if (dia === ayer) return "Ayer";
  const [a, m, d] = dia.split("-").map(Number);
  return new Date(a, m - 1, d).toLocaleDateString("es-CO", { weekday: "short", day: "numeric" }).replace(".", "");
}

async function cargar(): Promise<Punto[]> {
  const puntos: Punto[] = [];
  for (let desde = 0; desde < 5000; desde += 1000) {
    const filas = await api<Fila[]>(`temperatura_lecturas?select=fecha,temperatura&order=fecha.desc`, {
      headers: { Range: `${desde}-${desde + 999}`, "Range-Unit": "items" },
    });
    for (const f of filas) puntos.push({ t: new Date(f.fecha).getTime(), v: Number(f.temperatura) });
    if (filas.length < 1000) break;
  }
  return puntos;
}

/** Gráfica de la temperatura del día (0 a 24 h) con las franjas de 22 y 27,5 °C */
function Grafica({ puntos, dia }: { puntos: Punto[]; dia: string }) {
  const [a, m, d] = dia.split("-").map(Number);
  const inicio = new Date(a, m - 1, d).getTime();
  const W = 320;
  const H = 120;
  const vals = puntos.map((p) => p.v);
  const min = Math.floor(Math.min(BAJA - 1, ...vals));
  const max = Math.ceil(Math.max(ALTA + 1, ...vals));
  const x = (t: number) => ((t - inicio) / 86400000) * W;
  const y = (v: number) => H - ((v - min) / (max - min)) * H;
  // Se corta la línea si faltan lecturas por más de 20 minutos
  const orden = [...puntos].sort((p, q) => p.t - q.t);
  let ruta = "";
  orden.forEach((p, i) => {
    const salto = i === 0 || p.t - orden[i - 1].t > 20 * 60000;
    ruta += `${salto ? "M" : "L"}${x(p.t).toFixed(1)},${y(p.v).toFixed(1)}`;
  });
  return (
    <div className="rounded-2xl bg-slate-50 px-2 pb-1 pt-2 ring-1 ring-slate-200">
      <svg viewBox={`-26 -6 ${W + 32} ${H + 22}`} className="block h-auto w-full" role="img" aria-label="Temperatura del día">
        <rect x={0} y={y(ALTA)} width={W} height={y(BAJA) - y(ALTA)} className="fill-emerald-500/10" />
        {[ALTA, BAJA].map((v) => (
          <g key={v}>
            <line x1={0} x2={W} y1={y(v)} y2={y(v)} className={v === ALTA ? "stroke-red-400" : "stroke-sky-400"} strokeDasharray="3 3" strokeWidth={0.8} />
            <text x={-4} y={y(v) + 3} textAnchor="end" className="fill-slate-400 text-[8px] tabular-nums">
              {String(v).replace(".", ",")}
            </text>
          </g>
        ))}
        {[0, 6, 12, 18, 24].map((h) => (
          <text key={h} x={(h / 24) * W} y={H + 12} textAnchor="middle" className="fill-slate-400 text-[8px]">
            {h === 0 || h === 24 ? "12a" : h === 12 ? "12p" : h < 12 ? `${h}a` : `${h - 12}p`}
          </text>
        ))}
        <path d={ruta} fill="none" className="stroke-orange-500" strokeWidth={1.8} strokeLinejoin="round" strokeLinecap="round" />
      </svg>
    </div>
  );
}

export default function LecturasSensor() {
  const [puntos, setPuntos] = useState<Punto[] | null>(null);
  const [error, setError] = useState(false);
  const [dia, setDia] = useState(() => diaLocal(Date.now()));
  const [todas, setTodas] = useState(false);

  useEffect(() => {
    let vivo = true;
    const traer = () =>
      cargar()
        .then((p) => vivo && (setPuntos(p), setError(false)))
        .catch(() => vivo && setError(true));
    traer();
    const t = setInterval(traer, 5 * 60000);
    return () => {
      vivo = false;
      clearInterval(t);
    };
  }, []);

  const dias = useMemo(() => {
    const lista: string[] = [];
    for (let i = 6; i >= 0; i--) lista.push(diaLocal(Date.now() - i * 86400000));
    return lista;
  }, []);
  const delDia = useMemo(() => (puntos ?? []).filter((p) => diaLocal(p.t) === dia), [puntos, dia]);

  if (error && !puntos) return <p className="text-sm text-slate-500">No se pudo cargar el historial del sensor.</p>;
  if (!puntos) return <p className="text-sm text-slate-400">Cargando lecturas del sensor…</p>;
  if (puntos.length === 0)
    return <p className="text-sm text-slate-500">Aún no hay lecturas guardadas. El servidor guarda una cada 5 minutos mientras el sensor esté conectado.</p>;

  const vals = delDia.map((p) => p.v);
  const minimo = vals.length ? Math.min(...vals) : null;
  const maximo = vals.length ? Math.max(...vals) : null;
  const promedio = vals.length ? vals.reduce((s, v) => s + v, 0) / vals.length : null;
  const tMin = delDia.find((p) => p.v === minimo);
  const tMax = delDia.find((p) => p.v === maximo);
  const fuera = delDia.filter((p) => p.v > ALTA || p.v < BAJA).length;
  const lista = todas ? delDia : delDia.slice(0, 12);

  return (
    <div className="flex flex-col gap-3">
      {/* Días */}
      <div className="-mx-1 flex gap-1.5 overflow-x-auto px-1 pb-0.5">
        {dias.map((d) => {
          const hay = puntos.some((p) => diaLocal(p.t) === d);
          return (
            <button
              key={d}
              type="button"
              onClick={() => {
                setDia(d);
                setTodas(false);
              }}
              disabled={!hay}
              className={`shrink-0 rounded-full px-3 py-1.5 text-xs font-semibold capitalize transition ${
                d === dia ? "bg-slate-900 text-white" : hay ? "bg-slate-100 text-slate-700 active:bg-slate-200" : "bg-slate-50 text-slate-300"
              }`}
            >
              {nombreDia(d)}
            </button>
          );
        })}
      </div>

      {delDia.length === 0 ? (
        <p className="text-sm text-slate-500">Sin lecturas este día.</p>
      ) : (
        <>
          <div className="grid grid-cols-3 gap-2">
            {[
              { t: "Mínima", v: minimo!, h: tMin ? horaLocal(tMin.t) : "" },
              { t: "Promedio", v: promedio!, h: `${delDia.length} lecturas` },
              { t: "Máxima", v: maximo!, h: tMax ? horaLocal(tMax.t) : "" },
            ].map((x) => (
              <div key={x.t} className="rounded-2xl bg-white px-2.5 py-2 text-center ring-1 ring-slate-200">
                <p className="text-[10px] font-medium uppercase tracking-wide text-slate-400">{x.t}</p>
                <p className="text-lg font-bold tabular-nums text-slate-900">{grados(x.v)}</p>
                <p className="truncate text-[10px] text-slate-400">{x.h}</p>
              </div>
            ))}
          </div>
          <Grafica puntos={delDia} dia={dia} />
          {fuera > 0 && (
            <p className="rounded-xl bg-red-50 px-3 py-2 text-xs font-semibold text-red-700 ring-1 ring-red-100">
              {fuera} {fuera === 1 ? "lectura" : "lecturas"} fuera de 22 – 27,5 °C (≈ {fuera * 5} min)
            </p>
          )}
          <ul className="flex flex-col divide-y divide-slate-100">
            {lista.map((p) => (
              <li key={p.t} className="flex items-center gap-3 py-2">
                <span className={`flex h-8 w-14 shrink-0 items-center justify-center rounded-xl text-sm font-bold tabular-nums ${colorDe(p.v)}`}>{grados(p.v)}</span>
                <p className="min-w-0 flex-1 truncate text-sm text-slate-700">Sensor ESP32</p>
                <span className="shrink-0 text-xs tabular-nums text-slate-500">{horaLocal(p.t)}</span>
              </li>
            ))}
          </ul>
          {delDia.length > 12 && (
            <button type="button" onClick={() => setTodas((v) => !v)} className="self-center rounded-full px-3 py-1.5 text-xs font-semibold text-sky-700 active:bg-sky-50">
              {todas ? "Ver menos" : `Ver las ${delDia.length} lecturas del día`}
            </button>
          )}
        </>
      )}
      <p className="text-[11px] text-slate-400">Una lectura cada 5 minutos · se guardan 7 días y las más antiguas se borran solas.</p>
    </div>
  );
}
