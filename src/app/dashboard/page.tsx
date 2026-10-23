"use client";

import { useEffect, useMemo, useState } from "react";
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
    tile: "bg-emerald-100 text-emerald-800",
    card: "bg-white border-emerald-200",
  },
  {
    nombre: "Engorde",
    descripcion: "Peso y alimentación",
    ruta: "/engorde",
    icon: "🐷",
    tile: "bg-amber-100 text-amber-800",
    card: "bg-white border-amber-200",
  },
  {
    nombre: "Monitoreo",
    descripcion: "Temperatura y humedad",
    ruta: "/monitoreo",
    icon: "🌡️",
    tile: "bg-orange-100 text-orange-800",
    card: "bg-white border-orange-200",
  },
  {
    nombre: "Tratamientos",
    descripcion: "Salud y medicamentos",
    ruta: "/tratamientos",
    icon: "🩺",
    tile: "bg-rose-100 text-rose-800",
    card: "bg-white border-rose-200",
  },
  {
    nombre: "Bodega",
    descripcion: "Inventario de insumos",
    ruta: "/bodega",
    icon: "📦",
    tile: "bg-teal-100 text-teal-800",
    card: "bg-white border-teal-200",
  },
  {
    nombre: "Bioseguridad",
    descripcion: "Protocolos sanitarios",
    ruta: "/bioseguridad",
    icon: "🛡️",
    tile: "bg-sky-100 text-sky-800",
    card: "bg-white border-sky-200",
  },
  {
    nombre: "Indicadores",
    descripcion: "Estadísticas y rendimiento",
    ruta: "/indicadores",
    icon: "📊",
    tile: "bg-violet-100 text-violet-800",
    card: "bg-white border-violet-200",
  },
  {
    nombre: "Contabilidad",
    descripcion: "Ingresos y gastos",
    ruta: "/contabilidad",
    icon: "💼",
    tile: "bg-stone-200 text-stone-800",
    card: "bg-white border-stone-300",
  },
  {
    nombre: "Programación",
    descripcion: "Inseminación y partos",
    ruta: "/programacion",
    icon: "🐖",
    tile: "bg-pink-100 text-pink-800",
    card: "bg-white border-pink-200",
  },
];

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
      iconBg: "bg-emerald-50 text-emerald-700",
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
          className="relative flex items-center gap-3 overflow-hidden rounded-2xl bg-emerald-900 px-4 py-3 text-white shadow-md"
        >
          <div
            aria-hidden="true"
            className="pointer-events-none absolute inset-0"
            style={{
              backgroundImage:
                "repeating-linear-gradient(90deg, rgba(255,255,255,0.05) 0 10px, transparent 10px 26px)",
            }}
          />

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
            <p className="truncate text-xs text-emerald-100/90">
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
              className="relative shrink-0 rounded-full bg-white px-3.5 py-1.5 text-xs font-semibold text-emerald-900 transition active:scale-95 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white focus-visible:ring-offset-2 focus-visible:ring-offset-emerald-900"
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
              className={`col-span-2 flex items-center justify-between gap-3 rounded-3xl border px-4 py-4 text-left shadow-sm transition active:scale-[0.98] hover:shadow-md focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-600 ${destacado.card}`}
            >
              <div className="flex items-center gap-3">
                <div className={`flex h-14 w-14 items-center justify-center rounded-2xl text-3xl ${destacado.tile}`}>
                  {destacado.icon}
                </div>
                <div>
                  <p className="text-base font-bold text-slate-950">{destacado.nombre}</p>
                  <p className="mt-0.5 text-xs text-slate-500">{destacado.descripcion}</p>
                </div>
              </div>
              <div className="text-right">
                <p className="text-2xl font-bold leading-none text-emerald-800">{gestantes}</p>
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
                className={`flex flex-col items-start gap-3 rounded-3xl border px-3.5 py-3.5 text-left shadow-sm transition active:scale-[0.97] hover:shadow-md focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-600 ${modulo.card}`}
              >
                <div className={`flex h-11 w-11 items-center justify-center rounded-2xl text-2xl ${modulo.tile}`}>
                  {modulo.icon}
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
              : 'bg-emerald-600 hover:bg-emerald-700 focus-visible:ring-emerald-600'
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
            <span aria-hidden="true" className="latido-suave pointer-events-none absolute inset-0 rounded-full bg-emerald-400/30" />
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
