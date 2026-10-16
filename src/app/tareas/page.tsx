"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import ModuloPage from "@/components/ModuloPage";
import { Chevron, Chips, Insignia, Vacio } from "@/components/ui";
import { leerCerdas, useVersionDatos } from "@/lib/datos";
import { calcularTareasPendientes } from "@/utils/pendingTasks";

type Prioridad = "todas" | "critica" | "alta" | "media" | "baja";

const ORDEN: Record<string, number> = { critica: 0, alta: 1, media: 2, baja: 3 };
const ESTILO: Record<string, { texto: string; clase: string }> = {
  critica: { texto: "Crítica", clase: "bg-rose-50 text-rose-700 ring-rose-200" },
  alta: { texto: "Alta", clase: "bg-amber-50 text-amber-800 ring-amber-200" },
  media: { texto: "Media", clase: "bg-slate-100 text-slate-700 ring-slate-200" },
  baja: { texto: "Baja", clase: "bg-slate-100 text-slate-500 ring-slate-200" },
};

export default function TareasPage() {
  const router = useRouter();
  const version = useVersionDatos();
  const [filtro, setFiltro] = useState<Prioridad>("todas");

  const tareas = useMemo(() => {
    if (version < 0) return null;
    return calcularTareasPendientes(leerCerdas()).sort(
      (a, b) => (ORDEN[a.prioridad] ?? 9) - (ORDEN[b.prioridad] ?? 9)
    );
  }, [version]);

  const cuenta = (p: string) => tareas?.filter((t) => t.prioridad === p).length ?? 0;
  const visibles = tareas?.filter((t) => filtro === "todas" || t.prioridad === filtro) ?? [];

  return (
    <ModuloPage titulo="Tareas">
      <Chips
        opciones={[
          { valor: "todas", texto: `Todas${tareas ? ` (${tareas.length})` : ""}` },
          { valor: "critica", texto: `Críticas (${cuenta("critica")})` },
          { valor: "alta", texto: `Altas (${cuenta("alta")})` },
          { valor: "media", texto: `Medias (${cuenta("media")})` },
          { valor: "baja", texto: `Bajas (${cuenta("baja")})` },
        ]}
        valor={filtro}
        onChange={setFiltro}
      />

      {tareas === null ? (
        <div className="h-40 animate-pulse rounded-3xl bg-slate-100" />
      ) : visibles.length === 0 ? (
        <Vacio titulo="Todo al día" texto="No hay tareas pendientes con este filtro." />
      ) : (
        <ul className="divide-y divide-slate-100 overflow-hidden rounded-3xl bg-white ring-1 ring-slate-200/80">
          {visibles.map((t) => {
            const e = ESTILO[t.prioridad] ?? ESTILO.media;
            return (
              <li key={`${t.id}-${t.tipo}`}>
                <button
                  type="button"
                  onClick={() => router.push(`/cerda/${encodeURIComponent(t.id)}`)}
                  className="flex w-full items-center gap-3 px-4 py-3.5 text-left transition hover:bg-slate-50 active:bg-slate-100"
                >
                  <Insignia clase={e.clase}>{e.texto}</Insignia>
                  <span className="min-w-0 flex-1">
                    <span className="block truncate text-sm font-semibold text-slate-900">{t.tipo}</span>
                    <span className="block truncate text-xs text-slate-500">
                      Cerda {t.id} · {t.descripcion}
                    </span>
                  </span>
                  <Chevron />
                </button>
              </li>
            );
          })}
        </ul>
      )}
    </ModuloPage>
  );
}
