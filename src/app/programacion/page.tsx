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
  calcularPlan,
  calcularProgramacion,
  type Evento,
  type PlanProgramacion,
} from "@/lib/programacion";

function estadoFecha(e: Evento, fechaHoy: string): { texto: string; clase: string } {
  const fin = e.hasta ?? e.fecha;
  const dIni = diasEntre(fechaHoy, e.fecha);
  const dFin = diasEntre(fechaHoy, fin);
  if (dFin < 0) return { texto: `Vencido hace ${-dFin} d`, clase: "bg-red-50 text-red-700 ring-red-200" };
  if (dIni <= 0) return { texto: e.hasta ? "Ahora" : "Hoy", clase: "bg-sky-600 text-white ring-sky-600" };
  if (dIni === 1) return { texto: "Mañana", clase: "bg-amber-50 text-amber-800 ring-amber-200" };
  return { texto: `En ${dIni} d`, clase: "bg-slate-100 text-slate-700 ring-slate-200" };
}

type Vista = "cerdas" | "inseminacion" | "agenda" | "calculadora";

const MESES = ["Enero", "Febrero", "Marzo", "Abril", "Mayo", "Junio", "Julio", "Agosto", "Septiembre", "Octubre", "Noviembre", "Diciembre"];
const nombreMes = (mes: string) => `${MESES[Number(mes.slice(5, 7)) - 1]} ${mes.slice(0, 4)}`;

const CHIP_ESTADO: Record<string, string> = {
  Gestación: "bg-sky-50 text-sky-700",
  Lactancia: "bg-orange-50 text-orange-700",
  Vacía: "bg-sky-50 text-sky-700",
  "En celo": "bg-pink-50 text-pink-700",
  "En tratamiento": "bg-amber-50 text-amber-800",
  "Sin registro": "bg-slate-100 text-slate-600",
};

/** Texto corto de cuánto falta para una fecha */
function cuando(fecha: string, fechaHoy: string, hasta?: string) {
  const d = diasEntre(fechaHoy, fecha);
  const dFin = hasta ? diasEntre(fechaHoy, hasta) : d;
  if (dFin < 0) return { texto: `Atrasada ${-dFin} d`, clase: "bg-red-50 text-red-700" };
  if (d <= 0) return { texto: hasta ? "Ahora" : "Hoy", clase: "bg-sky-600 text-white" };
  if (d === 1) return { texto: "Mañana", clase: "bg-amber-50 text-amber-800" };
  return { texto: `En ${d} d`, clase: "bg-slate-100 text-slate-700" };
}

export default function ProgramacionPage() {
  const router = useRouter();
  const version = useVersionDatos();
  const [vista, setVista] = useState<Vista>("cerdas");
  const fechaHoy = hoy();

  const eventos = useMemo(() => (version < 0 ? null : calcularProgramacion(hoy())), [version]);
  const plan = useMemo(() => (version < 0 ? null : calcularPlan(hoy())), [version]);

  const activos = (eventos ?? []).filter((e) => diasEntre(fechaHoy, e.hasta ?? e.fecha) >= -7);
  const iaSemana = (plan?.tarjetas ?? []).filter((t) => t.ia && !t.ia.sinCupo && diasEntre(fechaHoy, t.ia.recomendada) <= 7).length;
  const abrir = (id: string) => router.push(`/cerda/${encodeURIComponent(id)}`);

  return (
    <ModuloPage titulo="Programación" subtitulo="Motor de ayuda para inseminación y parto" icono="🐖" tono="pink">
      <div className="grid grid-cols-3 gap-2">
        <Dato titulo="Cerdas" valor={plan ? plan.tarjetas.length : "–"} detalle="en el hato" />
        <Dato titulo="Inseminar" valor={plan ? iaSemana : "–"} detalle="próx. 7 días" />
        <Dato
          titulo="Parideras"
          valor={plan ? (plan.parideras > 0 ? `${plan.ocupadasHoy}/${plan.parideras}` : plan.ocupadasHoy) : "–"}
          detalle={plan && plan.parideras > 0 ? "ocupadas hoy" : "ocupadas · sin total"}
        />
      </div>

      <Chips
        opciones={[
          { valor: "cerdas", texto: "🐖 Cerdas" },
          { valor: "inseminacion", texto: "💉 Plan IA" },
          { valor: "agenda", texto: "📅 Agenda" },
          { valor: "calculadora", texto: "🧮 Calculadora" },
        ]}
        valor={vista}
        onChange={setVista}
      />

      {plan === null || eventos === null ? (
        <div className="h-40 animate-pulse rounded-3xl bg-slate-100" />
      ) : vista === "cerdas" ? (
        plan.tarjetas.length === 0 ? (
          <Vacio titulo="Sin cerdas" texto="Registra cerdas en Gestación para ver su programación." />
        ) : (
          <TarjetasCerdas plan={plan} fechaHoy={fechaHoy} onAbrir={abrir} />
        )
      ) : vista === "inseminacion" ? (
        <PlanInseminacion plan={plan} fechaHoy={fechaHoy} onAbrir={abrir} />
      ) : vista === "calculadora" ? (
        <Calculadora />
      ) : activos.length === 0 ? (
        <Vacio titulo="Nada programado" texto="Registra celos, inseminaciones y partos en la ficha de cada cerda." />
      ) : (
        <Agenda eventos={activos.filter((e) => diasEntre(fechaHoy, e.fecha) <= 30)} fechaHoy={fechaHoy} onAbrir={abrir} />
      )}

    </ModuloPage>
  );
}

/* ───────────── Tarjetas por cerda ───────────── */

function TarjetasCerdas({ plan, fechaHoy, onAbrir }: { plan: PlanProgramacion; fechaHoy: string; onAbrir: (id: string) => void }) {
  return (
    <div className="grid grid-cols-2 gap-2">
      {plan.tarjetas.map((t) => {
        const fecha = t.ia?.recomendada ?? t.accion.fecha;
        const chip = t.accion.fecha ? cuando(t.accion.fecha, fechaHoy, t.accion.hasta) : null;
        return (
          <button
            key={t.cerdaId}
            type="button"
            onClick={() => onAbrir(t.cerdaId)}
            className="flex min-w-0 flex-col rounded-2xl bg-white p-3 text-left ring-1 ring-slate-200/80 transition active:scale-[0.98] active:bg-slate-50"
          >
            <div className="flex items-start justify-between gap-1">
              <span className="min-w-0 truncate text-[15px] font-bold text-slate-900">{t.nombre.replace(/^Cerda /, "")}</span>
              <span className="text-lg leading-none" aria-hidden="true">{t.accion.icono}</span>
            </div>
            <span className={`mt-1 self-start rounded-full px-2 py-0.5 text-[10px] font-semibold ${CHIP_ESTADO[t.estado] ?? CHIP_ESTADO["Sin registro"]}`}>
              {t.estado}
            </span>

            <div className="mt-2 rounded-xl bg-pink-50/70 px-2 py-1.5">
              <p className="text-[10px] font-medium uppercase tracking-wide text-pink-700/80">Último celo</p>
              <p className="text-xs font-semibold text-slate-800">{t.ultimoCelo ? formatoFecha(t.ultimoCelo, true) : "Sin registro"}</p>
            </div>

            <p className="mt-2 text-xs font-semibold text-slate-800">{t.accion.titulo}</p>
            <p className="text-[11px] leading-snug text-slate-500">
              {t.accion.fecha
                ? `${formatoFecha(t.accion.fecha)}${t.accion.hasta && t.accion.hasta !== t.accion.fecha ? ` – ${formatoFecha(t.accion.hasta)}` : ""}`
                : t.accion.detalle}
            </p>
            {t.ia && t.estado !== "En celo" && (
              <p className="mt-1 text-[11px] leading-snug text-sky-700">
                IA {t.ia.sinCupo ? "sin paridera libre" : `sugerida ${formatoFecha(fecha)}`}
              </p>
            )}
            {t.paridera && t.estado === "Gestación" && (
              <p className="mt-1 text-[11px] leading-snug text-violet-700">Parto {formatoFecha(t.paridera.parto)}</p>
            )}
            {chip && (
              <span className={`mt-2 self-start rounded-full px-2 py-0.5 text-[10px] font-semibold ${chip.clase}`}>{chip.texto}</span>
            )}
          </button>
        );
      })}
    </div>
  );
}

/* ───────────── Plan de inseminación mensual ───────────── */

function PlanInseminacion({ plan, fechaHoy, onAbrir }: { plan: PlanProgramacion; fechaHoy: string; onAbrir: (id: string) => void }) {
  const candidatas = plan.tarjetas.filter((t) => t.ia);
  const sinTotal = plan.parideras === 0;

  return (
    <div className="flex flex-col gap-4">
      <Tarjeta titulo="Capacidad de parideras">
        {sinTotal ? (
          <p className="text-sm text-slate-600">
            Configura cuántas parideras tienes en <b>Ajustes → Ajustes avanzados</b> para que el motor reparta las inseminaciones sin
            pasarse de la capacidad.
          </p>
        ) : (
          <div className="grid grid-cols-2 gap-2">
            <Dato titulo="Parideras" valor={plan.parideras} detalle={`${plan.ocupadasHoy} ocupadas hoy`} />
            <Dato titulo="Meta mensual" valor={`≈ ${plan.capacidadMes}`} detalle="inseminaciones / partos" />
          </div>
        )}
        {!sinTotal && (
          <p className="mt-2 text-[11px] text-slate-500">
            Cada cerda ocupa una paridera {plan.diasCicloParidera} días: {ANTES_PARTO_MATERNIDAD} antes del parto más la lactancia.
          </p>
        )}
      </Tarjeta>

      <section>
        <h2 className="mb-2 px-1 text-[11px] font-semibold uppercase tracking-wider text-slate-400">Proyección mensual</h2>
        <ul className="divide-y divide-slate-100 overflow-hidden rounded-3xl bg-white ring-1 ring-slate-200/80">
          {plan.meses.map((m) => {
            const lleno = !sinTotal && m.picoParideras >= plan.parideras;
            const falta = !sinTotal ? Math.max(0, plan.capacidadMes - m.inseminaciones) : 0;
            return (
              <li key={m.mes} className="px-4 py-3">
                <div className="flex items-center justify-between gap-2">
                  <p className="text-sm font-semibold text-slate-900">{nombreMes(m.mes)}</p>
                  <p className="text-xs text-slate-500">
                    <b className="text-sky-700">{m.inseminaciones}</b> IA · <b className="text-sky-700">{m.partos}</b> partos
                  </p>
                </div>
                {!sinTotal && (
                  <>
                    <div className="mt-2 h-2 w-full overflow-hidden rounded-full bg-slate-100">
                      <div
                        className={`h-full rounded-full ${lleno ? "bg-rose-500" : "bg-violet-500"}`}
                        style={{ width: `${Math.min(100, (m.picoParideras / plan.parideras) * 100)}%` }}
                      />
                    </div>
                    <p className="mt-1 text-[11px] text-slate-500">
                      Parideras: pico {m.picoParideras} de {plan.parideras}
                      {lleno ? " · llenas" : ""}
                      {falta > 0 && m.mes >= fechaHoy.slice(0, 7) ? ` · faltan ${falta} IA para la meta` : ""}
                    </p>
                  </>
                )}
              </li>
            );
          })}
        </ul>
      </section>

      <section>
        <h2 className="mb-2 px-1 text-[11px] font-semibold uppercase tracking-wider text-slate-400">
          Más cercanas a inseminación · {candidatas.length}
        </h2>
        {candidatas.length === 0 ? (
          <Vacio titulo="Sin candidatas" texto="No hay cerdas vacías, en celo o lactando por ahora." />
        ) : (
          <ul className="divide-y divide-slate-100 overflow-hidden rounded-3xl bg-white ring-1 ring-slate-200/80">
            {candidatas.map((t) => {
              const ia = t.ia!;
              const chip = cuando(ia.recomendada, fechaHoy);
              return (
                <li key={t.cerdaId}>
                  <button
                    type="button"
                    onClick={() => onAbrir(t.cerdaId)}
                    className="flex w-full items-center gap-3 px-4 py-3 text-left active:bg-slate-50"
                  >
                    <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl bg-sky-100 text-xl" aria-hidden="true">
                      {t.accion.icono}
                    </span>
                    <span className="min-w-0 flex-1">
                      <span className="block truncate text-sm font-semibold text-slate-900">{t.nombre}</span>
                      <span className="block truncate text-[11px] text-slate-500">
                        {t.accion.titulo} · ventana {formatoFecha(ia.desde)} – {formatoFecha(ia.hasta)}
                      </span>
                      {ia.sinCupo ? (
                        <span className="block text-[11px] font-medium text-rose-600">Sin paridera libre en los próximos 60 días</span>
                      ) : (
                        <span className="block truncate text-[11px] text-slate-600">
                          IA {formatoFecha(ia.recomendada)} → paridera {formatoFecha(ia.entradaParidera)} → parto {formatoFecha(ia.parto)}
                        </span>
                      )}
                      {ia.corrimiento > 0 && (
                        <span className="block text-[11px] font-medium text-amber-700">
                          Corrida {ia.corrimiento} d para tener paridera libre
                        </span>
                      )}
                    </span>
                    <span className={`shrink-0 rounded-full px-2 py-0.5 text-[11px] font-semibold ${chip.clase}`}>{chip.texto}</span>
                  </button>
                </li>
              );
            })}
          </ul>
        )}
      </section>
    </div>
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
        { icono: "🏠", titulo: "Entrar a paridera", desde: sumarDias(parto, -ANTES_PARTO_MATERNIDAD) },
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
                  p.destacado ? "bg-sky-100" : "bg-slate-100"
                }`}
              >
                {p.icono}
              </span>
              <div
                className={`min-w-0 flex-1 rounded-2xl px-3.5 py-2.5 ${
                  p.destacado ? "bg-sky-50 ring-1 ring-sky-100" : "bg-slate-50"
                }`}
              >
                <p className={`text-sm font-semibold ${p.destacado ? "text-sky-900" : "text-slate-900"}`}>{p.titulo}</p>
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
