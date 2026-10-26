"use client";

import { useEffect, useMemo, useState, type ReactNode } from "react";
import { useRouter } from "next/navigation";
import Header from "@/components/Header";
import SummaryCard from "@/components/SummaryCard";
import PageShell from "@/components/PageShell";
import BottomNav from "@/components/BottomNav";
import {
  cargarCerdasDeStorage,
  calcularTareasPendientes,
  type Cerda,
} from "@/utils/pendingTasks";

// Color de la página: pinta el fondo y la zona de la isla dinámica del iPhone.
const COLOR_PAGINA = "#ffffff";

// Cada módulo tiene su propio tono para que se reconozcan de un vistazo,
// sin salirse de la familia verde/tierra de la granja.
const modulos = [
  {
    nombre: "Gestación",
    descripcion: "Control de partos e inseminación",
    ruta: "/gestacion",
    icon: "🐖",
    tile: "bg-slate-100 text-slate-700",
    card: "bg-white border-slate-200",
  },
  {
    nombre: "Engorde",
    descripcion: "Peso y alimentación",
    ruta: "/engorde",
    icon: "🐷",
    tile: "bg-slate-100 text-slate-700",
    card: "bg-white border-slate-200",
  },
  {
    nombre: "Monitoreo",
    descripcion: "Temperatura y humedad",
    ruta: "/monitoreo",
    icon: "🌡️",
    tile: "bg-slate-100 text-slate-700",
    card: "bg-white border-slate-200",
  },
  {
    nombre: "Tratamientos",
    descripcion: "Salud y medicamentos",
    ruta: "/tratamientos",
    icon: "🩺",
    tile: "bg-slate-100 text-slate-700",
    card: "bg-white border-slate-200",
  },
  {
    nombre: "Bodega",
    descripcion: "Inventario de insumos",
    ruta: "/bodega",
    icon: "📦",
    tile: "bg-slate-100 text-slate-700",
    card: "bg-white border-slate-200",
  },
  {
    nombre: "Bioseguridad",
    descripcion: "Protocolos sanitarios",
    ruta: "/bioseguridad",
    icon: "🛡️",
    tile: "bg-slate-100 text-slate-700",
    card: "bg-white border-slate-200",
  },
  {
    nombre: "Indicadores",
    descripcion: "Estadísticas y rendimiento",
    ruta: "/indicadores",
    icon: "📊",
    tile: "bg-slate-100 text-slate-700",
    card: "bg-white border-slate-200",
  },
  {
    nombre: "Contabilidad",
    descripcion: "Ingresos y gastos",
    ruta: "/contabilidad",
    icon: "💼",
    tile: "bg-slate-100 text-slate-700",
    card: "bg-white border-slate-200",
  },
  {
    nombre: "Programación",
    descripcion: "Inseminación y partos",
    ruta: "/programacion",
    icon: "🐖",
    tile: "bg-slate-100 text-slate-700",
    card: "bg-white border-slate-200",
  },
];

/* Íconos de línea de los módulos (estilo gris minimal) */
const TRAZOS: Record<string, ReactNode> = {
  Gestación: (
    <>
      <path d="M5 12.5c0-3.6 3.1-6 7-6 1.7 0 3.2.4 4.4 1.2l1.9-1.4.4 2.6c.8.9 1.3 2 1.3 3.3v.3h1.5v2H20c-.5 1.5-1.6 2.6-3 3.2V20h-2.2v-1.6H9.2V20H7v-2.2c-1.2-.9-2-2.2-2-3.8" />
      <circle cx="16.5" cy="11" r=".6" fill="currentColor" />
      <path d="M5 12.5H3.5" />
    </>
  ),
  Engorde: (
    <>
      <path d="M6 7h12l2 13H4z" />
      <path d="M9 7a3 3 0 0 1 6 0" />
      <path d="M12 12v3l1.5 1" />
    </>
  ),
  Monitoreo: (
    <>
      <path d="M14 14.8V5a2 2 0 1 0-4 0v9.8a4 4 0 1 0 4 0z" />
      <path d="M12 9v7" />
    </>
  ),
  Tratamientos: <path d="m18 2 4 4M17 7l3-3M19 9 8.5 19.5a2.1 2.1 0 0 1-3-3L16 6M9 11l4 4M5 19l-3 3M14 4l6 6" />,
  Bodega: (
    <>
      <path d="M21 8 12 3 3 8v8l9 5 9-5z" />
      <path d="m3 8 9 5 9-5M12 13v8" />
    </>
  ),
  Bioseguridad: (
    <>
      <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z" />
      <path d="m9 12 2 2 4-4" />
    </>
  ),
  Indicadores: (
    <>
      <path d="M3 3v18h18" />
      <path d="M7 16v-4M11 16V8M15 16v-6M19 16V5" />
    </>
  ),
  Contabilidad: (
    <>
      <rect x="2.5" y="6" width="19" height="13" rx="2.5" />
      <path d="M16 12.5h2M2.5 10h19" />
      <path d="M6 6V4.5h11V6" />
    </>
  ),
  Programación: (
    <>
      <rect x="3" y="4" width="18" height="17" rx="2.5" />
      <path d="M16 2v4M8 2v4M3 10h18" />
      <path d="M12 13v3l2 1.2" />
    </>
  ),
};

function IconoModulo({ nombre, className }: { nombre: string; className?: string }) {
  return (
    <svg
      viewBox="0 0 24 24"
      className={className}
      fill="none"
      stroke="currentColor"
      strokeWidth={1.8}
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      {TRAZOS[nombre]}
    </svg>
  );
}

function obtenerEstadoActual(historial: unknown[]) {
  if (!Array.isArray(historial) || historial.length === 0) {
    return "Activa";
  }

  const ultimo = historial[0] as { tipo?: string };

  switch (ultimo.tipo) {
    case "Inseminación":
      return "Gestación";
    case "Parto":
      return "Lactancia";
    case "Destete":
      return "Próxima a Celo";
    case "Aborto":
      return "Aborto";
    case "Baja":
      return "Baja";
    case "Celo":
      return "Celo";
    case "Tratamiento":
      return "Tratamiento";
    default:
      return "Activa";
  }
}

function obtenerCerdasCriticas(datos: Cerda[]) {
  const tareasCriticas = calcularTareasPendientes(datos).filter(
    (tarea) => tarea.prioridad === "critica"
  );
  return Array.from(new Set(tareasCriticas.map((tarea) => tarea.id)));
}

export default function Dashboard() {
  const router = useRouter();

  // Se carga en el cliente después de montar (el servidor no tiene localStorage)
  const [cerdas, setCerdas] = useState<Cerda[]>([]);

  // Saludo según la hora (se calcula en el cliente para no desfasar el HTML del servidor)
  const [saludo, setSaludo] = useState("Hola");
  useEffect(() => {
    const hora = new Date().getHours();
    setSaludo(hora < 12 ? "Buenos días" : hora < 19 ? "Buenas tardes" : "Buenas noches");
  }, []);

  const pendingTasks = useMemo(() => calcularTareasPendientes(cerdas), [cerdas]);
  const pendientes = pendingTasks.length;
  const cerdasCriticas = useMemo(() => obtenerCerdasCriticas(cerdas), [cerdas]);

  useEffect(() => {
    const handleStorage = () => {
      setCerdas(cargarCerdasDeStorage());
    };

    const handleFocus = () => {
      setCerdas(cargarCerdasDeStorage());
    };

    setCerdas(cargarCerdasDeStorage());

    window.addEventListener("storage", handleStorage);
    window.addEventListener("focus", handleFocus);
    return () => {
      window.removeEventListener("storage", handleStorage);
      window.removeEventListener("focus", handleFocus);
    };
  }, []);

  const totalCerdos = cerdas.length;
  const gestantes = useMemo(() => {
    return cerdas.reduce((count, cerda) => {
      let historial: unknown[] = [];
      try {
        historial = JSON.parse(localStorage.getItem(`historial-${cerda.id}`) || "[]");
      } catch {
        historial = [];
      }
      return obtenerEstadoActual(historial) === "Gestación" ? count + 1 : count;
    }, 0);
  }, [cerdas]);

  const resumen = [
    {
      nombre: "Total cerdos",
      valor: totalCerdos,
      detalle: "",
      icon: "🐖",
      iconBg: "bg-sky-50 text-sky-700",
    },
    {
      nombre: "Gestantes en producción",
      valor: gestantes,
      detalle: "",
      icon: "🐷",
      iconBg: "bg-gray-100 text-gray-700",
    },
  ];

  const hayCriticas = cerdasCriticas.length > 0;
  const [destacado, ...otrosModulos] = modulos;

  return (
    <PageShell bgColor={COLOR_PAGINA} className="flex flex-col">
      <div className="mx-auto flex max-w-xl flex-1 flex-col gap-5 pb-44">
        <Header
          title="El Mirador"
          bgColor={COLOR_PAGINA}
        />

        {/* Parte del día: compacto, una sola franja */}
        <section
          aria-label="Estado del día"
          className="relative flex items-center gap-3 overflow-hidden rounded-2xl bg-sky-900 px-4 py-3 text-white shadow-md"
        >

          <span
            aria-hidden="true"
            className={`relative flex h-9 w-9 shrink-0 items-center justify-center rounded-xl text-sm font-bold tabular-nums ${
              hayCriticas ? "bg-rose-500 text-white" : "bg-white/15 text-white"
            }`}
          >
            {pendientes > 0 ? pendientes : "✓"}
          </span>

          <div className="relative min-w-0 flex-1">
            <p className="truncate text-[15px] font-semibold leading-tight">
              {pendientes > 0
                ? `${pendientes === 1 ? "Tarea pendiente" : "Tareas pendientes"}`
                : "Todo al día"}
            </p>
            <p className="truncate text-xs text-sky-100/90">
              {hayCriticas
                ? `${cerdasCriticas.length} ${cerdasCriticas.length === 1 ? "urgente" : "urgentes"} · ${saludo}`
                : pendientes > 0
                ? `Ninguna urgente · ${saludo}`
                : `${saludo} · nada por atender`}
            </p>
          </div>

          {pendientes > 0 && (
            <button
              type="button"
              onClick={() => router.push("/tareas")}
              className="relative shrink-0 rounded-full bg-white px-3.5 py-1.5 text-xs font-semibold text-sky-900 transition active:scale-95 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white focus-visible:ring-offset-2 focus-visible:ring-offset-sky-900"
            >
              Ver
            </button>
          )}
        </section>

        <section>
          <div className="mb-2 flex items-center justify-between">
            <h2 className="text-base font-semibold text-slate-950">Resumen rápido</h2>
            <span className="text-xs text-slate-500">Actualizado hoy</span>
          </div>

          <div className="grid grid-cols-2 gap-2">
            {resumen.map((item) => (
              <SummaryCard
                key={item.nombre}
                nombre={item.nombre}
                valor={item.valor}
                detalle={item.detalle}
                icon={item.icon}
                iconBg={item.iconBg}
                bgColor={COLOR_PAGINA}
              />
            ))}
          </div>
        </section>

        <section>
          <h2 className="mb-3 text-base font-semibold text-slate-950">Módulos</h2>

          <div className="grid grid-cols-2 gap-2.5">
            {/* Gestación: el módulo de uso diario ocupa todo el ancho */}
            <button
              type="button"
              onClick={() => router.push(destacado.ruta)}
              className={`col-span-2 flex items-center justify-between gap-3 rounded-3xl border px-4 py-4 text-left shadow-sm transition active:scale-[0.98] hover:shadow-md focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-sky-600 ${destacado.card}`}
            >
              <div className="flex items-center gap-3">
                <div className={`flex h-14 w-14 items-center justify-center rounded-2xl text-3xl ${destacado.tile}`}>
                  <IconoModulo nombre={destacado.nombre} className="h-7 w-7" />
                </div>
                <div>
                  <p className="text-base font-bold text-slate-950">{destacado.nombre}</p>
                  <p className="mt-0.5 text-xs text-slate-500">{destacado.descripcion}</p>
                </div>
              </div>
              <div className="text-right">
                <p className="text-2xl font-bold leading-none text-sky-800">{gestantes}</p>
                <p className="mt-1 text-[11px] text-slate-500">
                  {gestantes === 1 ? "gestante" : "gestantes"}
                </p>
              </div>
            </button>

            {otrosModulos.map((modulo) => (
              <button
                key={modulo.nombre}
                type="button"
                onClick={() => router.push(modulo.ruta)}
                className={`flex flex-col items-start gap-3 rounded-3xl border px-3.5 py-3.5 text-left shadow-sm transition active:scale-[0.97] hover:shadow-md focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-sky-600 ${modulo.card}`}
              >
                <div className={`flex h-11 w-11 items-center justify-center rounded-2xl text-2xl ${modulo.tile}`}>
                  <IconoModulo nombre={modulo.nombre} className="h-6 w-6" />
                </div>
                <div>
                  <p className="text-sm font-semibold text-slate-950">{modulo.nombre}</p>
                  <p className="mt-0.5 text-xs leading-snug text-slate-500">{modulo.descripcion}</p>
                </div>
              </button>
            ))}
          </div>
        </section>
      </div>

      <BottomNav />

      {pendientes > 0 && (
        <button
          type="button"
          onClick={() => router.push('/tareas')}
          style={{ bottom: "calc(env(safe-area-inset-bottom) + 6.5rem)" }}
          className={`fixed right-4 z-50 flex h-14 w-14 items-center justify-center rounded-full text-white shadow-2xl transition active:scale-95 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-offset-2 ${
            hayCriticas
              ? 'bg-rose-600 hover:bg-rose-700 focus-visible:ring-rose-600'
              : 'bg-sky-600 hover:bg-sky-700 focus-visible:ring-sky-600'
          }`}
          aria-label={`Ver alertas pendientes: ${pendientes}${hayCriticas ? ", hay urgentes" : ""}`}
        >
          {/* Anillo que late: rojo e intenso si hay algo urgente; verde y suave si no */}
          {hayCriticas ? (
            <span
              aria-hidden="true"
              className="pointer-events-none absolute inset-0 rounded-full bg-rose-500/50 motion-safe:animate-ping"
            />
          ) : (
            <span aria-hidden="true" className="latido-suave pointer-events-none absolute inset-0 rounded-full bg-sky-400/30" />
          )}
          <span className="relative text-xl">🕣</span>
          <span className="pointer-events-none absolute -right-1 top-0.5 flex h-5 min-w-[1.25rem] items-center justify-center rounded-full bg-white px-1 text-[10px] font-bold text-slate-900 shadow-sm">
            {pendientes}
          </span>
        </button>
      )}

    </PageShell>
  );
}
