"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import ModuloPage from "@/components/ModuloPage";
import { Chevron, Vacio } from "@/components/ui";
import { confirmarGestacion, leerCerdas, useVersionDatos } from "@/lib/datos";
import ConfirmarHierro from "@/components/ConfirmarHierro";
import { confirmar } from "@/components/Dialogo";
import { calcularTareasPendientes } from "@/utils/pendingTasks";
import { cambiarGranja, granjaActual, leerGranjas, sincronizar } from "@/lib/sincronizar";
import { puedeVerGranja } from "@/lib/nube";

type Prioridad = "todas" | "critica" | "alta" | "media" | "baja";

const ORDEN: Record<string, number> = { critica: 0, alta: 1, media: 2, baja: 3 };
const NIVELES = ["critica", "alta", "media", "baja"] as const;
const ESTILO: Record<string, { texto: string; plural: string; barra: string; punto: string; numero: string; activo: string }> = {
  critica: { texto: "Crítica", plural: "Críticas", barra: "bg-rose-500", punto: "bg-rose-500", numero: "text-rose-600", activo: "ring-rose-400 bg-rose-50" },
  alta: { texto: "Alta", plural: "Altas", barra: "bg-amber-500", punto: "bg-amber-500", numero: "text-amber-600", activo: "ring-amber-400 bg-amber-50" },
  media: { texto: "Media", plural: "Medias", barra: "bg-sky-500", punto: "bg-sky-500", numero: "text-sky-700", activo: "ring-sky-400 bg-sky-50" },
  baja: { texto: "Baja", plural: "Bajas", barra: "bg-slate-300", punto: "bg-slate-400", numero: "text-slate-600", activo: "ring-slate-400 bg-slate-100" },
};

export default function TareasPage() {
  const router = useRouter();
  const version = useVersionDatos();
  const [filtro, setFiltro] = useState<Prioridad>("todas");
  const [hierro, setHierro] = useState<string | null>(null);

  // Desde una notificación: abre la granja de la alerta
  useEffect(() => {
    const id = new URLSearchParams(window.location.search).get("granja");
    if (!id) return;
    if (id !== granjaActual() && puedeVerGranja(id) && leerGranjas().some((g) => g.id === id)) {
      cambiarGranja(id);
      void sincronizar();
      window.location.replace("/tareas");
      return;
    }
    window.history.replaceState(null, "", "/tareas");
  }, []);

  const tareas = useMemo(() => {
    if (version < 0) return null;
    return calcularTareasPendientes(leerCerdas()).sort(
      (a, b) => (ORDEN[a.prioridad] ?? 9) - (ORDEN[b.prioridad] ?? 9)
    );
  }, [version]);

  const cuenta = (p: string) => tareas?.filter((t) => t.prioridad === p).length ?? 0;
  const visibles = tareas?.filter((t) => filtro === "todas" || t.prioridad === filtro) ?? [];

  const confirmarG = async (id: string, etapa: 1 | 2) => {
    const ok = await confirmar({
      titulo: `${etapa}.ª confirmación`,
      mensaje: `¿La cerda ${id} sigue gestante? Se registrará la ${etapa}.ª confirmación de gestación con fecha de hoy.`,
      aceptar: "Confirmar",
    });
    if (ok) confirmarGestacion(id, etapa);
  };

  // Con "todas", la lista se agrupa por prioridad
  const grupos = NIVELES.map((n) => ({ nivel: n, items: visibles.filter((t) => t.prioridad === n) })).filter((g) => g.items.length > 0);

  return (
    <ModuloPage titulo="Tareas">
      {/* Resumen: total y un recuadro por prioridad (tocar filtra; tocar de nuevo quita el filtro) */}
      <section className="rounded-3xl bg-white p-3 ring-1 ring-slate-200/80">
        <div className="flex items-baseline justify-between px-1 pb-2.5">
          <p className="text-sm font-semibold text-slate-900">
            {tareas === null ? "Cargando…" : tareas.length === 0 ? "Todo al día" : `${tareas.length} ${tareas.length === 1 ? "tarea pendiente" : "tareas pendientes"}`}
          </p>
          {filtro !== "todas" && (
            <button type="button" onClick={() => setFiltro("todas")} className="text-xs font-semibold text-sky-700 active:opacity-70">
              Ver todas
            </button>
          )}
        </div>
        <div className="grid grid-cols-4 gap-1.5">
          {NIVELES.map((n) => {
            const e = ESTILO[n];
            const activo = filtro === n;
            return (
              <button
                key={n}
                type="button"
                onClick={() => setFiltro(activo ? "todas" : n)}
                aria-pressed={activo}
                className={`rounded-2xl px-1 py-2 text-center ring-1 transition active:scale-95 ${activo ? e.activo : "bg-slate-50 ring-slate-100"}`}
              >
                <span className={`block text-xl font-black leading-none tabular-nums ${cuenta(n) ? e.numero : "text-slate-300"}`}>{tareas ? cuenta(n) : "–"}</span>
                <span className="mt-1 flex items-center justify-center gap-1 text-[10px] font-semibold uppercase tracking-wide text-slate-500">
                  <span className={`h-1.5 w-1.5 rounded-full ${e.punto}`} aria-hidden="true" />
                  {e.plural}
                </span>
              </button>
            );
          })}
        </div>
      </section>

      {tareas === null ? (
        <div className="h-40 animate-pulse rounded-3xl bg-slate-100" />
      ) : visibles.length === 0 ? (
        <Vacio titulo="Todo al día" texto={filtro === "todas" ? "No hay tareas pendientes." : "No hay tareas con esta prioridad."} />
      ) : (
        <div className="flex flex-col gap-4">
          {grupos.map((g) => (
            <section key={g.nivel} className="flex flex-col gap-2">
              <h2 className="flex items-center gap-2 px-1 text-[11px] font-bold uppercase tracking-[0.14em] text-slate-500">
                <span className={`h-2 w-2 rounded-full ${ESTILO[g.nivel].punto}`} aria-hidden="true" />
                {ESTILO[g.nivel].plural}
                <span className="font-semibold text-slate-400">· {g.items.length}</span>
              </h2>
              <ul className="flex flex-col gap-2">
                {g.items.map((t) => {
                  const e = ESTILO[t.prioridad] ?? ESTILO.media;
                  const accion = t.hierroLote ? () => setHierro(t.hierroLote!) : t.confirmar ? () => confirmarG(t.id, t.confirmar!) : null;
                  return (
                    <li key={`${t.id}-${t.tipo}`} className="relative overflow-hidden rounded-2xl bg-white ring-1 ring-slate-200/80">
                      <span className={`absolute inset-y-0 left-0 w-1 ${e.barra}`} aria-hidden="true" />
                      <div className="flex items-center gap-3 py-2.5 pl-4 pr-2.5">
                        <button
                          type="button"
                          onClick={() =>
                            // La alerta de hierro lleva al lote de la camada; las demás, a la cerda
                            router.push(t.hierroLote ? `/engorde?lote=${encodeURIComponent(t.hierroLote)}` : `/cerda/${encodeURIComponent(t.id)}`)
                          }
                          className="flex min-w-0 flex-1 items-center gap-3 text-left active:opacity-70"
                        >
                          {/* ID de la cerda como arete */}
                          <span className="relative flex h-9 min-w-[2.75rem] shrink-0 items-center justify-center rounded-[10px] bg-gradient-to-b from-amber-200 to-amber-300 px-1.5 pt-1 shadow-sm ring-1 ring-amber-400/60">
                            <span aria-hidden="true" className="absolute left-1/2 top-[3px] h-1 w-1 -translate-x-1/2 rounded-full bg-white/90 ring-1 ring-amber-600/40" />
                            <span className="arete-id whitespace-nowrap text-[13px] font-black tabular-nums tracking-tight text-amber-950">{t.id}</span>
                          </span>
                          <span className="min-w-0 flex-1">
                            <span className="block truncate text-[15px] font-semibold leading-tight text-slate-900">{t.tipo}</span>
                            <span className="mt-0.5 block truncate text-xs text-slate-500">{t.descripcion}</span>
                          </span>
                        </button>
                        {accion ? (
                          <button
                            type="button"
                            onClick={accion}
                            className="shrink-0 rounded-full bg-sky-900 px-3.5 py-2 text-xs font-semibold text-white transition active:scale-95"
                          >
                            Confirmar
                          </button>
                        ) : (
                          <Chevron />
                        )}
                      </div>
                    </li>
                  );
                })}
              </ul>
            </section>
          ))}
        </div>
      )}
      <ConfirmarHierro loteId={hierro} onCerrar={() => setHierro(null)} />
    </ModuloPage>
  );
}
