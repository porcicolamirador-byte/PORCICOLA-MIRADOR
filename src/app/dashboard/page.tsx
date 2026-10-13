"use client";

import { useCallback, useEffect, useMemo, useState, type ReactNode } from "react";
import Image from "next/image";
import { usePathname, useRouter } from "next/navigation";
import {
  calcularTareasPendientes,
  cargarCerdasDeStorage,
  cargarHistorialDeCerda,
  type Cerda,
  type PendingTask,
} from "@/utils/pendingTasks";

/* ───────────────────────── Datos ───────────────────────── */

type EstadoHato = "Gestación" | "Lactancia" | "Vacías" | "En tratamiento" | "Sin registro";

// Orden y color fijos: el color sigue al estado, nunca a su posición.
const ESTADOS: { nombre: EstadoHato; color: string }[] = [
  { nombre: "Gestación", color: "#2a78d6" },
  { nombre: "Lactancia", color: "#eb6834" },
  { nombre: "Vacías", color: "#1baf7a" },
  { nombre: "En tratamiento", color: "#eda100" },
  { nombre: "Sin registro", color: "#e87ba4" },
];

const FUERA_DEL_HATO = ["Baja", "Vendida", "Muerta"];

function estadoDesdeUltimoRegistro(tipo?: string): EstadoHato | null {
  if (!tipo) return "Sin registro";
  if (FUERA_DEL_HATO.includes(tipo)) return null;
  switch (tipo) {
    case "Inseminación":
      return "Gestación";
    case "Parto":
      return "Lactancia";
    case "Destete":
    case "Celo":
    case "Aborto":
      return "Vacías";
    case "Tratamiento":
      return "En tratamiento";
    default:
      return "Sin registro";
  }
}

type LoteEngorde = { vivos?: number; activo?: boolean };

const ORDEN_PRIORIDAD: Record<string, number> = { critica: 0, alta: 1, media: 2, baja: 3 };

interface Resumen {
  activas: number;
  conteoEstados: Record<EstadoHato, number>;
  lechonesEngorde: number;
  lotesActivos: number;
  nacidos30: number;
  tareas: PendingTask[];
}

function calcularResumen(cerdas: Cerda[]): Resumen {
  const conteoEstados = Object.fromEntries(ESTADOS.map((e) => [e.nombre, 0])) as Record<
    EstadoHato,
    number
  >;
  let activas = 0;
  let nacidos30 = 0;
  const hace30 = Date.now() - 30 * 24 * 60 * 60 * 1000;

  for (const cerda of cerdas) {
    const historial = cargarHistorialDeCerda(cerda.id) as (Record<string, unknown> & {
      tipo?: string;
      fecha?: string;
    })[];
    const estado = estadoDesdeUltimoRegistro(historial[0]?.tipo);
    if (estado) {
      activas += 1;
      conteoEstados[estado] += 1;
    }
    for (const r of historial) {
      if (r.tipo === "Parto" && r.fecha && new Date(r.fecha).getTime() >= hace30) {
        nacidos30 += Number(r.vivos) || 0;
      }
    }
  }

  let lotes: LoteEngorde[] = [];
  try {
    const crudo = JSON.parse(localStorage.getItem("engorde-lotes") || "[]");
    lotes = Array.isArray(crudo) ? crudo : [];
  } catch {
    lotes = [];
  }
  const activos = lotes.filter((l) => l.activo !== false);

  const tareas = calcularTareasPendientes(cerdas).sort(
    (a, b) => (ORDEN_PRIORIDAD[a.prioridad] ?? 9) - (ORDEN_PRIORIDAD[b.prioridad] ?? 9)
  );

  return {
    activas,
    conteoEstados,
    lechonesEngorde: activos.reduce((s, l) => s + (Number(l.vivos) || 0), 0),
    lotesActivos: activos.length,
    nacidos30,
    tareas,
  };
}

/* ───────────────────────── Iconos ───────────────────────── */

function Icono({ children, className = "h-5 w-5" }: { children: ReactNode; className?: string }) {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={1.8}
      strokeLinecap="round"
      strokeLinejoin="round"
      className={className}
      aria-hidden="true"
    >
      {children}
    </svg>
  );
}

const I = {
  inicio: <path d="M3 10.5 12 3l9 7.5V20a1 1 0 0 1-1 1h-5v-6H9v6H4a1 1 0 0 1-1-1z" />,
  gestacion: (
    <>
      <rect x="3.5" y="5" width="17" height="15" rx="2" />
      <path d="M3.5 10h17M8 3v4M16 3v4" />
    </>
  ),
  engorde: <path d="M3 17l6-6 4 4 8-8M15 7h6v6" />,
  tratamientos: <path d="M3 12h4l2-4 4 8 2-4h6" />,
  bioseguridad: <path d="M12 3l8 3v6c0 5-3.5 8-8 9-4.5-1-8-4-8-9V6z" />,
  indicadores: <path d="M4 20h16M7 16v-5M12 16V7M17 16v-8" />,
  contabilidad: (
    <>
      <rect x="3" y="6" width="18" height="13" rx="2" />
      <path d="M3 10h18M16 15h2" />
    </>
  ),
  tareas: (
    <>
      <rect x="4" y="4" width="16" height="17" rx="2" />
      <path d="M9 3h6v3H9zM8.5 13l2.5 2.5 4.5-4.5" />
    </>
  ),
  ajustes: (
    <>
      <path d="M4 7h9M17 7h3M4 17h3M11 17h9" />
      <circle cx="15" cy="7" r="2" />
      <circle cx="9" cy="17" r="2" />
    </>
  ),
  chevron: <path d="M9 6l6 6-6 6" />,
  alerta: <path d="M12 4 2.5 20h19zM12 10v4M12 17h.01" />,
  reloj: (
    <>
      <circle cx="12" cy="12" r="8.5" />
      <path d="M12 7.5V12l3 2" />
    </>
  ),
  info: (
    <>
      <circle cx="12" cy="12" r="8.5" />
      <path d="M12 11v5M12 8h.01" />
    </>
  ),
  mas: <path d="M12 5v14M5 12h14" />,
};

/* ───────────────────────── Configuración de UI ───────────────────────── */

const PRIORIDAD_UI: Record<string, { etiqueta: string; clase: string; icono: ReactNode }> = {
  critica: { etiqueta: "Crítica", clase: "bg-rose-50 text-rose-700 ring-rose-200", icono: I.alerta },
  alta: { etiqueta: "Alta", clase: "bg-amber-50 text-amber-800 ring-amber-200", icono: I.reloj },
  media: { etiqueta: "Media", clase: "bg-slate-100 text-slate-700 ring-slate-200", icono: I.info },
  baja: { etiqueta: "Baja", clase: "bg-slate-100 text-slate-600 ring-slate-200", icono: I.info },
};

const MODULOS = [
  { nombre: "Gestación", detalle: "Partos e inseminación", ruta: "/gestacion", icono: I.gestacion, tono: "bg-emerald-50 text-emerald-700" },
  { nombre: "Engorde", detalle: "Lotes, peso y alimento", ruta: "/engorde", icono: I.engorde, tono: "bg-amber-50 text-amber-700" },
  { nombre: "Tratamientos", detalle: "Salud y medicamentos", ruta: "/tratamientos", icono: I.tratamientos, tono: "bg-rose-50 text-rose-700" },
  { nombre: "Bioseguridad", detalle: "Protocolos sanitarios", ruta: "/bioseguridad", icono: I.bioseguridad, tono: "bg-sky-50 text-sky-700" },
  { nombre: "Indicadores", detalle: "Rendimiento productivo", ruta: "/indicadores", icono: I.indicadores, tono: "bg-violet-50 text-violet-700" },
  { nombre: "Contabilidad", detalle: "Ingresos y gastos", ruta: "/contabilidad", icono: I.contabilidad, tono: "bg-stone-100 text-stone-700" },
];

const TABS = [
  { nombre: "Inicio", ruta: "/dashboard", icono: I.inicio },
  { nombre: "Producción", ruta: "/gestacion", icono: I.gestacion },
  { nombre: "Tareas", ruta: "/tareas", icono: I.tareas },
  { nombre: "Ajustes", ruta: "/ajustes", icono: I.ajustes },
];

/* ───────────────────────── Página ───────────────────────── */

export default function Dashboard() {
  const router = useRouter();
  const pathname = usePathname();

  const [resumen, setResumen] = useState<Resumen | null>(null);
  const [saludo, setSaludo] = useState("");
  const [fecha, setFecha] = useState("");

  const recargar = useCallback(() => {
    setResumen(calcularResumen(cargarCerdasDeStorage()));
  }, []);

  useEffect(() => {
    recargar();
    const ahora = new Date();
    const h = ahora.getHours();
    setSaludo(h < 12 ? "Buenos días" : h < 19 ? "Buenas tardes" : "Buenas noches");
    const texto = ahora.toLocaleDateString("es-CO", { weekday: "long", day: "numeric", month: "long" });
    setFecha(texto.charAt(0).toUpperCase() + texto.slice(1));

    window.addEventListener("storage", recargar);
    window.addEventListener("focus", recargar);
    return () => {
      window.removeEventListener("storage", recargar);
      window.removeEventListener("focus", recargar);
    };
  }, [recargar]);

  const porPrioridad = useMemo(() => {
    const c = { critica: 0, alta: 0, media: 0 };
    resumen?.tareas.forEach((t) => {
      if (t.prioridad in c) c[t.prioridad as keyof typeof c] += 1;
    });
    return c;
  }, [resumen]);

  const totalTareas = resumen?.tareas.length ?? 0;
  const hayCriticas = porPrioridad.critica > 0;

  return (
    <div className="min-h-dvh bg-[#f4f6f5] font-sans text-slate-900 antialiased">
      {/* Barra superior */}
      <header
        className="sticky top-0 z-30 border-b border-slate-200/70 bg-[#f4f6f5]/85 backdrop-blur-md"
        style={{ paddingTop: "env(safe-area-inset-top)" }}
      >
        <div className="mx-auto flex max-w-2xl items-center gap-3 px-4 py-3">
          <div className="flex h-10 w-10 shrink-0 items-center justify-center overflow-hidden rounded-xl bg-white ring-1 ring-slate-200">
            <Image src="/logo.png" alt="" width={40} height={40} className="h-9 w-9 object-contain" />
          </div>
          <div className="min-w-0 flex-1">
            <p className="truncate text-[15px] font-semibold leading-tight">El Mirador</p>
            <p className="truncate text-xs text-slate-500">{fecha || " "}</p>
          </div>
          <button
            type="button"
            onClick={() => router.push("/ajustes")}
            aria-label="Ajustes"
            className="flex h-10 w-10 items-center justify-center rounded-xl text-slate-600 transition hover:bg-white active:scale-95 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-600"
          >
            <Icono>{I.ajustes}</Icono>
          </button>
        </div>
      </header>

      <main className="mx-auto flex max-w-2xl flex-col gap-6 px-4 pb-32 pt-5">
        {/* Hoy */}
        <section
          aria-label="Resumen del día"
          className="relative overflow-hidden rounded-[28px] bg-emerald-900 p-5 text-white shadow-[0_12px_30px_-12px_rgba(6,78,59,0.6)]"
        >
          <div
            aria-hidden="true"
            className="pointer-events-none absolute inset-0 opacity-60"
            style={{
              backgroundImage:
                "repeating-linear-gradient(90deg, rgba(255,255,255,0.05) 0 10px, transparent 10px 26px)",
            }}
          />
          <div className="relative">
            <p className="text-sm text-emerald-100/90">{saludo || " "}</p>

            {resumen === null ? (
              <div className="mt-2 h-9 w-48 animate-pulse rounded-lg bg-white/15" />
            ) : (
              <p className="mt-1 text-[32px] font-semibold leading-tight tracking-tight tabular-nums">
                {totalTareas > 0
                  ? `${totalTareas} ${totalTareas === 1 ? "tarea pendiente" : "tareas pendientes"}`
                  : "Todo al día"}
              </p>
            )}

            {resumen !== null && totalTareas > 0 && (
              <ul className="mt-3 flex flex-wrap gap-2 text-xs font-medium">
                {porPrioridad.critica > 0 && (
                  <li className="flex items-center gap-1.5 rounded-full bg-rose-500/90 px-2.5 py-1">
                    <Icono className="h-3.5 w-3.5">{I.alerta}</Icono>
                    {porPrioridad.critica} {porPrioridad.critica === 1 ? "crítica" : "críticas"}
                  </li>
                )}
                {porPrioridad.alta > 0 && (
                  <li className="flex items-center gap-1.5 rounded-full bg-white/15 px-2.5 py-1">
                    <Icono className="h-3.5 w-3.5">{I.reloj}</Icono>
                    {porPrioridad.alta} {porPrioridad.alta === 1 ? "alta" : "altas"}
                  </li>
                )}
                {porPrioridad.media > 0 && (
                  <li className="flex items-center gap-1.5 rounded-full bg-white/15 px-2.5 py-1">
                    <Icono className="h-3.5 w-3.5">{I.info}</Icono>
                    {porPrioridad.media} {porPrioridad.media === 1 ? "media" : "medias"}
                  </li>
                )}
              </ul>
            )}

            {resumen !== null && totalTareas === 0 && (
              <p className="mt-1 text-sm text-emerald-100/90">No hay nada por atender en la granja.</p>
            )}

            {totalTareas > 0 && (
              <button
                type="button"
                onClick={() => router.push("/tareas")}
                className="mt-5 inline-flex items-center gap-1.5 rounded-full bg-white px-4 py-2.5 text-sm font-semibold text-emerald-900 transition active:scale-95 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white focus-visible:ring-offset-2 focus-visible:ring-offset-emerald-900"
              >
                {hayCriticas ? "Atender urgentes" : "Ver tareas"}
                <Icono className="h-4 w-4">{I.chevron}</Icono>
              </button>
            )}
          </div>
        </section>

        {/* Indicadores clave */}
        <section aria-labelledby="t-kpi">
          <h2 id="t-kpi" className="sr-only">
            Indicadores clave
          </h2>
          <div className="grid grid-cols-2 gap-3">
            <Kpi titulo="Cerdas activas" valor={resumen?.activas} detalle="En el hato" />
            <Kpi titulo="Gestantes" valor={resumen?.conteoEstados["Gestación"]} detalle="Servidas" />
            <Kpi
              titulo="Lactantes"
              valor={resumen?.conteoEstados["Lactancia"]}
              detalle={resumen ? `${resumen.nacidos30} lechones nacidos en 30 días` : ""}
            />
            <Kpi
              titulo="En engorde"
              valor={resumen?.lechonesEngorde}
              detalle={
                resumen ? `${resumen.lotesActivos} ${resumen.lotesActivos === 1 ? "lote activo" : "lotes activos"}` : ""
              }
            />
          </div>
        </section>

        {/* Hato vacío: guía de inicio */}
        {resumen !== null && resumen.activas === 0 && (
          <section className="flex items-center gap-4 rounded-3xl border border-dashed border-emerald-300 bg-white p-5">
            <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl bg-emerald-50 text-emerald-700">
              <Icono className="h-6 w-6">{I.mas}</Icono>
            </div>
            <div className="min-w-0 flex-1">
              <p className="font-semibold">Registra tu primera cerda</p>
              <p className="text-sm text-slate-500">Desde Gestación verás aquí el estado del hato y las tareas.</p>
            </div>
            <button
              type="button"
              onClick={() => router.push("/gestacion")}
              className="rounded-full bg-emerald-700 px-4 py-2 text-sm font-semibold text-white transition active:scale-95"
            >
              Empezar
            </button>
          </section>
        )}

        {/* Estado del hato */}
        {resumen !== null && resumen.activas > 0 && (
          <Tarjeta titulo="Estado del hato" accion={`${resumen.activas} cerdas`}>
            <EstadoHatoBarra conteo={resumen.conteoEstados} total={resumen.activas} />
          </Tarjeta>
        )}

        {/* Próximas tareas */}
        {resumen !== null && totalTareas > 0 && (
          <Tarjeta
            titulo="Próximas tareas"
            accion="Ver todas"
            onAccion={() => router.push("/tareas")}
            sinRelleno
          >
            <ul className="divide-y divide-slate-100">
              {resumen.tareas.slice(0, 4).map((t) => {
                const p = PRIORIDAD_UI[t.prioridad] ?? PRIORIDAD_UI.media;
                return (
                  <li key={`${t.id}-${t.tipo}`}>
                    <button
                      type="button"
                      onClick={() => router.push(`/cerda/${t.id}`)}
                      className="flex w-full items-center gap-3 px-4 py-3.5 text-left transition hover:bg-slate-50 active:bg-slate-100 focus-visible:bg-slate-50 focus-visible:outline-none"
                    >
                      <span
                        className={`inline-flex shrink-0 items-center gap-1 rounded-full px-2 py-0.5 text-[11px] font-semibold ring-1 ring-inset ${p.clase}`}
                      >
                        <Icono className="h-3 w-3">{p.icono}</Icono>
                        {p.etiqueta}
                      </span>
                      <span className="min-w-0 flex-1">
                        <span className="block truncate text-sm font-semibold">{t.tipo}</span>
                        <span className="block truncate text-xs text-slate-500">
                          Cerda {t.id} · {t.descripcion}
                        </span>
                      </span>
                      <Icono className="h-4 w-4 shrink-0 text-slate-400">{I.chevron}</Icono>
                    </button>
                  </li>
                );
              })}
            </ul>
          </Tarjeta>
        )}

        {/* Módulos */}
        <section aria-labelledby="t-mod">
          <h2 id="t-mod" className="mb-3 px-1 text-[13px] font-semibold uppercase tracking-wider text-slate-500">
            Módulos
          </h2>
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
            {MODULOS.map((m) => (
              <button
                key={m.nombre}
                type="button"
                onClick={() => router.push(m.ruta)}
                className="group flex flex-col items-start gap-3 rounded-3xl bg-white p-4 text-left ring-1 ring-slate-200/80 transition hover:shadow-md hover:ring-slate-300 active:scale-[0.98] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-600"
              >
                <span className={`flex h-10 w-10 items-center justify-center rounded-xl ${m.tono}`}>
                  <Icono>{m.icono}</Icono>
                </span>
                <span>
                  <span className="block text-sm font-semibold">{m.nombre}</span>
                  <span className="mt-0.5 block text-xs leading-snug text-slate-500">{m.detalle}</span>
                </span>
              </button>
            ))}
          </div>
        </section>
      </main>

      {/* Barra de navegación inferior */}
      <nav
        aria-label="Navegación principal"
        className="fixed inset-x-0 bottom-0 z-40 border-t border-slate-200 bg-white/90 backdrop-blur-md"
        style={{ paddingBottom: "env(safe-area-inset-bottom)" }}
      >
        <ul className="mx-auto flex max-w-2xl">
          {TABS.map((tab) => {
            const activo = pathname?.startsWith(tab.ruta);
            const insignia = tab.ruta === "/tareas" && totalTareas > 0 ? totalTareas : 0;
            return (
              <li key={tab.nombre} className="flex-1">
                <button
                  type="button"
                  onClick={() => router.push(tab.ruta)}
                  aria-current={activo ? "page" : undefined}
                  className={`relative flex w-full flex-col items-center gap-1 py-2.5 text-[11px] transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-emerald-600 ${
                    activo ? "font-semibold text-emerald-800" : "font-medium text-slate-500"
                  }`}
                >
                  <span
                    className={`relative flex h-8 w-14 items-center justify-center rounded-full transition ${
                      activo ? "bg-emerald-100" : ""
                    }`}
                  >
                    <Icono>{tab.icono}</Icono>
                    {insignia > 0 && (
                      <span
                        className={`absolute -right-0.5 -top-1 flex h-[18px] min-w-[18px] items-center justify-center rounded-full px-1 text-[10px] font-bold text-white ring-2 ring-white tabular-nums ${
                          hayCriticas ? "bg-rose-600" : "bg-emerald-700"
                        }`}
                      >
                        {insignia > 99 ? "99+" : insignia}
                      </span>
                    )}
                  </span>
                  {tab.nombre}
                </button>
              </li>
            );
          })}
        </ul>
      </nav>
    </div>
  );
}

/* ───────────────────────── Componentes ───────────────────────── */

function Kpi({ titulo, valor, detalle }: { titulo: string; valor?: number; detalle: string }) {
  return (
    <div className="rounded-3xl bg-white p-4 ring-1 ring-slate-200/80">
      <p className="text-xs font-medium text-slate-500">{titulo}</p>
      {valor === undefined ? (
        <div className="mt-2 h-8 w-12 animate-pulse rounded-md bg-slate-100" />
      ) : (
        <p className="mt-1 text-[28px] font-semibold leading-tight tracking-tight tabular-nums">{valor}</p>
      )}
      <p className="mt-0.5 min-h-4 text-[11px] leading-snug text-slate-500">{detalle}</p>
    </div>
  );
}

function Tarjeta({
  titulo,
  accion,
  onAccion,
  sinRelleno,
  children,
}: {
  titulo: string;
  accion?: string;
  onAccion?: () => void;
  sinRelleno?: boolean;
  children: ReactNode;
}) {
  return (
    <section className="overflow-hidden rounded-3xl bg-white ring-1 ring-slate-200/80">
      <div className="flex items-center justify-between px-4 pb-1 pt-4">
        <h2 className="text-[15px] font-semibold">{titulo}</h2>
        {accion &&
          (onAccion ? (
            <button
              type="button"
              onClick={onAccion}
              className="rounded-full px-2 py-1 text-sm font-medium text-emerald-700 hover:bg-emerald-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-600"
            >
              {accion}
            </button>
          ) : (
            <span className="text-sm text-slate-500 tabular-nums">{accion}</span>
          ))}
      </div>
      <div className={sinRelleno ? "pb-1" : "px-4 pb-4 pt-3"}>{children}</div>
    </section>
  );
}

function EstadoHatoBarra({ conteo, total }: { conteo: Record<EstadoHato, number>; total: number }) {
  const presentes = ESTADOS.filter((e) => conteo[e.nombre] > 0);
  return (
    <div>
      <div
        className="flex h-3 w-full gap-[2px] overflow-hidden rounded-full"
        role="img"
        aria-label={presentes.map((e) => `${e.nombre}: ${conteo[e.nombre]}`).join(", ")}
      >
        {presentes.map((e) => (
          <div
            key={e.nombre}
            title={`${e.nombre}: ${conteo[e.nombre]} (${Math.round((conteo[e.nombre] / total) * 100)}%)`}
            className="h-full first:rounded-l-full last:rounded-r-full"
            style={{ width: `${(conteo[e.nombre] / total) * 100}%`, backgroundColor: e.color }}
          />
        ))}
      </div>
      <ul className="mt-4 grid grid-cols-2 gap-x-4 gap-y-2.5">
        {presentes.map((e) => (
          <li key={e.nombre} className="flex items-center gap-2 text-sm">
            <span className="h-2.5 w-2.5 shrink-0 rounded-full" style={{ backgroundColor: e.color }} />
            <span className="flex-1 truncate text-slate-600">{e.nombre}</span>
            <span className="font-semibold tabular-nums">{conteo[e.nombre]}</span>
          </li>
        ))}
      </ul>
    </div>
  );
}
