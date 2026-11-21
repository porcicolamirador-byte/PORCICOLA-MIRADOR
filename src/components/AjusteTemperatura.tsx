"use client";

/**
 * Rangos de las alertas de temperatura de la granja (solo el administrador los cambia).
 * El servidor los usa cada minuto para mandar las notificaciones:
 * baja (por debajo de la mínima), límite (por encima) y crítica (por encima de la crítica).
 */

import { useEffect, useState, type FormEvent } from "react";
import { api } from "@/lib/nube";
import { Boton } from "@/components/ui";
import { avisar } from "@/components/Dialogo";

export interface RangosTemperatura {
  minima: number;
  limite: number;
  critica: number;
}
export const RANGOS_POR_DEFECTO: RangosTemperatura = { minima: 22, limite: 27.5, critica: 29 };

export async function leerRangosTemperatura(): Promise<RangosTemperatura> {
  const filas = await api<{ minima: number | string; limite: number | string; critica: number | string }[]>(
    "temperatura_config?id=eq.1&select=minima,limite,critica",
  );
  const f = filas[0];
  return f ? { minima: Number(f.minima), limite: Number(f.limite), critica: Number(f.critica) } : RANGOS_POR_DEFECTO;
}

/** Rangos guardados (o los de por defecto mientras cargan o sin conexión) */
export function useRangosTemperatura() {
  const [rangos, setRangos] = useState<RangosTemperatura>(RANGOS_POR_DEFECTO);
  useEffect(() => {
    let vivo = true;
    leerRangosTemperatura()
      .then((r) => vivo && setRangos(r))
      .catch(() => {});
    return () => {
      vivo = false;
    };
  }, []);
  return rangos;
}

export const gradosTexto = (v: number) => `${String(Number(v.toFixed(1))).replace(".", ",")} °C`;
const aTexto = (v: number) => String(Number(v.toFixed(1))).replace(".", ",");
const aNumero = (s: string) => Number(s.replace(",", "."));

export default function AjusteTemperatura() {
  const [guardado, setGuardado] = useState<RangosTemperatura | null>(null);
  const [valores, setValores] = useState({ minima: "", limite: "", critica: "" });
  const [cargando, setCargando] = useState(true);
  const [guardando, setGuardando] = useState(false);
  const [error, setError] = useState("");

  const poner = (r: RangosTemperatura) => setValores({ minima: aTexto(r.minima), limite: aTexto(r.limite), critica: aTexto(r.critica) });

  useEffect(() => {
    leerRangosTemperatura()
      .then((r) => {
        setGuardado(r);
        poner(r);
      })
      .catch(() => setError("No se pudieron leer los rangos. Revisa la conexión."))
      .finally(() => setCargando(false));
  }, []);

  const min = aNumero(valores.minima);
  const lim = aNumero(valores.limite);
  const cri = aNumero(valores.critica);
  const numeros = [min, lim, cri].every((v) => Number.isFinite(v) && v >= 0 && v <= 50) && [valores.minima, valores.limite, valores.critica].every((v) => v.trim() !== "");
  const valido = numeros && min < lim && lim < cri;
  const sinCambios = !!guardado && min === guardado.minima && lim === guardado.limite && cri === guardado.critica;

  const enviar = async (e: FormEvent) => {
    e.preventDefault();
    if (!valido) return setError("La mínima debe ser menor que el límite y el límite menor que la crítica (entre 0 y 50 °C).");
    setGuardando(true);
    setError("");
    try {
      const r = { minima: Number(min.toFixed(1)), limite: Number(lim.toFixed(1)), critica: Number(cri.toFixed(1)) };
      await api("temperatura_config?id=eq.1", {
        method: "PATCH",
        headers: { Prefer: "return=minimal" },
        body: JSON.stringify({ ...r, actualizado_en: new Date().toISOString() }),
      });
      setGuardado(r);
      poner(r);
      await avisar({
        titulo: "Alertas de temperatura actualizadas",
        mensaje: `Baja: menos de ${gradosTexto(r.minima)} · Límite: más de ${gradosTexto(r.limite)} · Crítica: más de ${gradosTexto(r.critica)}.`,
      });
    } catch {
      setError("No se pudo guardar. Solo el administrador puede cambiar estos rangos.");
    } finally {
      setGuardando(false);
    }
  };

  const campo =
    "h-12 w-full rounded-xl border border-slate-200 bg-slate-50 px-2 text-center text-xl font-semibold tabular-nums text-slate-900 outline-none focus:bg-white focus:ring-2 focus:ring-sky-200";
  const filas: { clave: keyof typeof valores; titulo: string; texto: string; punto: string }[] = [
    { clave: "minima", titulo: "Mínima", texto: "Alerta si baja de", punto: "bg-sky-500" },
    { clave: "limite", titulo: "Límite", texto: "Alerta si pasa de", punto: "bg-orange-500" },
    { clave: "critica", titulo: "Crítica", texto: "Alerta crítica si pasa de", punto: "bg-red-600" },
  ];

  if (cargando) return <p className="text-sm text-slate-400">Cargando rangos…</p>;

  return (
    <form onSubmit={enviar} className="flex flex-col gap-3">
      <div className="grid grid-cols-3 gap-2">
        {filas.map((f) => (
          <label key={f.clave} className="min-w-0">
            <span className="mb-1 flex items-center gap-1.5 text-[13px] font-medium text-slate-700">
              <span aria-hidden="true" className={`h-2 w-2 shrink-0 rounded-full ${f.punto}`} />
              {f.titulo}
            </span>
            <input
              type="text"
              inputMode="decimal"
              value={valores[f.clave]}
              onChange={(e) => {
                setValores((v) => ({ ...v, [f.clave]: e.target.value.replace(/[^\d.,]/g, "").slice(0, 4) }));
                setError("");
              }}
              className={campo}
              aria-label={`${f.titulo} en °C`}
            />
            <span className="mt-1 block text-center text-[11px] text-slate-400">°C</span>
          </label>
        ))}
      </div>
      <ul className="flex flex-col gap-1.5 rounded-xl bg-white px-3 py-2.5 text-[13px] text-slate-600 ring-1 ring-slate-100">
        {valido ? (
          <>
            <li>
              <b className="text-sky-700">Baja:</b> si baja de {gradosTexto(min)}.
            </li>
            <li>
              <b className="text-orange-600">Límite:</b> si pasa de {gradosTexto(lim)}.
            </li>
            <li>
              <b className="text-red-600">Crítica:</b> si pasa de {gradosTexto(cri)}, y otro aviso cuando vuelva a bajar de esa temperatura.
            </li>
            <li className="text-slate-500">También te avisa cuando vuelve a lo normal. Para volver se usa medio grado de margen.</li>
          </>
        ) : (
          <li>Revisa los valores: la mínima debe ser menor que el límite y el límite menor que la crítica.</li>
        )}
      </ul>
      {error && <p className="text-sm font-medium text-rose-600">{error}</p>}
      <div className="grid grid-cols-2 gap-2">
        <Boton
          variante="secundario"
          onClick={() => {
            poner(RANGOS_POR_DEFECTO);
            setError("");
          }}
        >
          Usar 22 · 27,5 · 29
        </Boton>
        <Boton type="submit" disabled={!valido || sinCambios || guardando}>
          {guardando ? "Guardando…" : "Guardar"}
        </Boton>
      </div>
    </form>
  );
}
