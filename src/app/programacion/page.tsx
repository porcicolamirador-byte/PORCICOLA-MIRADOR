"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import ModuloPage from "@/components/ModuloPage";
import { Campo, Chevron, Chips, Dato, Entrada, Tarjeta, Vacio } from "@/components/ui";
import { leerConfig } from "@/lib/config";
import { diasEntre, formatoFecha, hoy, leerAjustes, sumarDias, useVersionDatos } from "@/lib/datos";
import {
  ANTES_PARTO_MATERNIDAD,
  CELO_TRAS_DESTETE,
  CONFIRMAR_GESTACION,
  ESTILO,
  REPETICION_CELO,
  calcularProgramacion,
  type Evento,
} from "@/lib/programacion";

function estadoFecha(e: Evento, fechaHoy: string): { texto: string; clase: string } {
  const fin = e.hasta ?? e.fecha;
  const dIni = diasEntre(fechaHoy, e.fecha);
  const dFin = diasEntre(fechaHoy, fin);
  if (dFin < 0) return { texto: `Vencido hace ${-dFin} d`, clase: "bg-red-50 text-red-700 ring-red-200" };
  if (dIni <= 0) return { texto: e.hasta ? "Ahora" : "Hoy", clase: "bg-emerald-600 text-white ring-emerald-600" };
  if (dIni === 1) return { texto: "Mañana", clase: "bg-amber-50 text-amber-800 ring-amber-200" };
  return { texto: `En ${dIni} d`, clase: "bg-slate-100 text-slate-700 ring-slate-200" };
}

type Vista = "agenda" | "inseminacion" | "partos" | "calculadora";

export default function ProgramacionPage() {
  const router = useRouter();
  const version = useVersionDatos();
  const [vista, setVista] = useState<Vista>("agenda");
  const fechaHoy = hoy();

  const eventos = useMemo(() => (version < 0 ? null : calcularProgramacion(hoy())), [version]);

  const activos = (eventos ?? []).filter((e) => diasEntre(fechaHoy, e.hasta ?? e.fecha) >= -7);
  const ahora = activos.filter((e) => diasEntre(fechaHoy, e.fecha) <= 0);
  const proximos7 = activos.filter((e) => {
    const d = diasEntre(fechaHoy, e.fecha);
    return d > 0 && d <= 7;
  });
  const deInseminacion = activos.filter((e) => ["inseminar", "vigilar", "repeticion", "confirmar"].includes(e.clase));
  const dePartos = activos.filter((e) => ["maternidad", "parto", "destete"].includes(e.clase));
  const partos30 = (eventos ?? []).filter((e) => e.clase === "parto" && diasEntre(fechaHoy, e.fecha) >= 0 && diasEntre(fechaHoy, e.fecha) <= 30);

  const lista = vista === "inseminacion" ? deInseminacion : vista === "partos" ? dePartos : activos.filter((e) => diasEntre(fechaHoy, e.fecha) <= 30);

  return (
    <ModuloPage titulo="Programación" subtitulo="Motor de ayuda para inseminación y parto" icono="🐖" tono="pink">
      <div className="grid grid-cols-3 gap-2">
        <Dato titulo="Para hoy" valor={eventos ? ahora.length : "–"} detalle="acciones" />
        <Dato titulo="Próx. 7 días" valor={eventos ? proximos7.length : "–"} detalle="acciones" />
        <Dato titulo="Partos 30 d" valor={eventos ? partos30.length : "–"} detalle="estimados" />
      </div>

      <Chips
        opciones={[
          { valor: "agenda", texto: "Agenda" },
          { valor: "inseminacion", texto: "💉 Inseminación" },
          { valor: "partos", texto: "🐷 Partos" },
          { valor: "calculadora", texto: "🧮 Calculadora" },
        ]}
        valor={vista}
        onChange={setVista}
      />

      {vista === "calculadora" ? (
        <Calculadora />
      ) : eventos === null ? (
        <div className="h-40 animate-pulse rounded-3xl bg-slate-100" />
      ) : lista.length === 0 ? (
        <Vacio
          titulo="Nada programado"
          texto={
            vista === "agenda"
              ? "No hay acciones en los próximos 30 días. Registra celos, inseminaciones y partos en la ficha de cada cerda."
              : "No hay acciones de este tipo por ahora."
          }
        />
      ) : (
        <Agenda eventos={lista} fechaHoy={fechaHoy} onAbrir={(id) => router.push(`/cerda/${encodeURIComponent(id)}`)} />
      )}

      <p className="px-1 text-[11px] leading-relaxed text-slate-400">
        Cálculos de referencia: repetición de celo 18–24 días tras la IA, confirmación 25–35 días, gestación{" "}
        {eventos ? leerAjustes().diasGestacion : 114} días, maternidad {ANTES_PARTO_MATERNIDAD} días antes del parto,
        destete según Ajustes avanzados y celo 3–7 días tras el destete.
      </p>
    </ModuloPage>
  );
}

function Agenda({ eventos, fechaHoy, onAbrir }: { eventos: Evento[]; fechaHoy: string; onAbrir: (id: string) => void }) {
  // Agrupa por "Vencidos", "Hoy", "Esta semana" y "Más adelante"
  const grupos: { titulo: string; items: Evento[] }[] = [
    { titulo: "Atrasados", items: [] },
    { titulo: "Ahora", items: [] },
    { titulo: "Próximos 7 días", items: [] },
    { titulo: "Más adelante", items: [] },
  ];
  for (const e of eventos) {
    const dFin = diasEntre(fechaHoy, e.hasta ?? e.fecha);
    const dIni = diasEntre(fechaHoy, e.fecha);
    if (dFin < 0) grupos[0].items.push(e);
    else if (dIni <= 0) grupos[1].items.push(e);
    else if (dIni <= 7) grupos[2].items.push(e);
    else grupos[3].items.push(e);
  }

  return (
    <div className="flex flex-col gap-4">
      {grupos
        .filter((g) => g.items.length)
        .map((g) => (
          <section key={g.titulo}>
            <h2 className="mb-2 px-1 text-[11px] font-semibold uppercase tracking-wider text-slate-400">
              {g.titulo} · {g.items.length}
            </h2>
            <ul className="divide-y divide-slate-100 overflow-hidden rounded-3xl bg-white ring-1 ring-slate-200/80">
              {g.items.map((e, i) => {
                const est = ESTILO[e.clase];
                const chip = estadoFecha(e, fechaHoy);
                const d = new Date(`${e.fecha}T00:00:00`);
                return (
                  <li key={`${e.cerdaId}-${e.clase}-${i}`}>
                    <button
                      type="button"
                      onClick={() => onAbrir(e.cerdaId)}
                      className="flex w-full items-center gap-3 px-4 py-3 text-left transition hover:bg-slate-50 active:bg-slate-100"
                    >
                      <span className={`flex h-11 w-11 shrink-0 flex-col items-center justify-center rounded-2xl ${est.fondo}`}>
                        <span className="text-[10px] font-semibold uppercase leading-none text-slate-500">
                          {d.toLocaleDateString("es-CO", { month: "short" }).replace(".", "")}
                        </span>
                        <span className="text-base font-bold leading-tight text-slate-900 tabular-nums">{d.getDate()}</span>
                      </span>
                      <span className="min-w-0 flex-1">
                        <span className={`flex items-center gap-1.5 text-sm font-semibold ${est.texto}`}>
                          <span aria-hidden="true">{est.icono}</span>
                          <span className="truncate">{e.titulo}</span>
                        </span>
                        <span className="block truncate text-xs font-medium text-slate-800">{e.nombre}</span>
                        <span className="block truncate text-[11px] text-slate-500">
                          {e.detalle}
                          {e.hasta ? ` · hasta ${formatoFecha(e.hasta)}` : ""}
                        </span>
                      </span>
                      <span className={`shrink-0 rounded-full px-2 py-0.5 text-[11px] font-semibold ring-1 ring-inset ${chip.clase}`}>
                        {chip.texto}
                      </span>
                      <Chevron />
                    </button>
                  </li>
                );
              })}
            </ul>
          </section>
        ))}
    </div>
  );
}

/** Calculadora del ciclo completo a partir de una fecha de inseminación */
function Calculadora() {
  const [fecha, setFecha] = useState(hoy());
  const { diasGestacion } = leerAjustes();
  const { desteteMin, desteteMax } = leerConfig();

  const parto = fecha ? sumarDias(fecha, diasGestacion) : "";
  const pasos = fecha
    ? [
        { icono: "💉", titulo: "Inseminación", desde: fecha },
        { icono: "🔁", titulo: "Revisar repetición de celo", desde: sumarDias(fecha, REPETICION_CELO[0]), hasta: sumarDias(fecha, REPETICION_CELO[1]) },
        { icono: "✅", titulo: "Confirmar gestación", desde: sumarDias(fecha, CONFIRMAR_GESTACION[0]), hasta: sumarDias(fecha, CONFIRMAR_GESTACION[1]) },
        { icono: "🏠", titulo: "Trasladar a maternidad", desde: sumarDias(parto, -ANTES_PARTO_MATERNIDAD) },
        { icono: "🐷", titulo: `Parto estimado (día ${diasGestacion})`, desde: parto, destacado: true },
        { icono: "🍼", titulo: "Destete", desde: sumarDias(parto, desteteMin), hasta: sumarDias(parto, desteteMax) },
        {
          icono: "🔥",
          titulo: "Próximo celo",
          desde: sumarDias(parto, desteteMin + CELO_TRAS_DESTETE[0]),
          hasta: sumarDias(parto, desteteMax + CELO_TRAS_DESTETE[1]),
        },
      ]
    : [];

  return (
    <Tarjeta titulo="Calculadora del ciclo">
      <Campo etiqueta="Fecha de inseminación">
        <Entrada type="date" value={fecha} onChange={setFecha} />
      </Campo>
      {pasos.length > 0 && (
        <ol className="relative mt-4 flex flex-col gap-2.5 before:absolute before:bottom-3 before:left-[19px] before:top-3 before:w-0.5 before:bg-slate-100">
          {pasos.map((p) => (
            <li key={p.titulo} className="relative flex items-center gap-3">
              <span
                aria-hidden="true"
                className={`relative z-10 flex h-10 w-10 shrink-0 items-center justify-center rounded-2xl text-lg ring-4 ring-white ${
                  p.destacado ? "bg-emerald-100" : "bg-slate-100"
                }`}
              >
                {p.icono}
              </span>
              <div
                className={`min-w-0 flex-1 rounded-2xl px-3.5 py-2.5 ${
                  p.destacado ? "bg-emerald-50 ring-1 ring-emerald-100" : "bg-slate-50"
                }`}
              >
                <p className={`text-sm font-semibold ${p.destacado ? "text-emerald-900" : "text-slate-900"}`}>{p.titulo}</p>
                <p className="text-xs text-slate-600">
                  {formatoFecha(p.desde, true)}
                  {p.hasta ? ` – ${formatoFecha(p.hasta, true)}` : ""}
                </p>
              </div>
            </li>
          ))}
        </ol>
      )}
    </Tarjeta>
  );
}
