"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
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


  const hayCriticas = cerdasCriticas.length > 0;

  return (
    <PageShell bgColor={COLOR_PAGINA} className="flex flex-col">
      <div className="mx-auto flex w-full max-w-xl flex-1 flex-col gap-7 pb-44">
        {/* Encabezado: saludo, nombre y logo, sin cajas */}
        <header className="flex items-center justify-between gap-3 pt-1">
          <div className="min-w-0">
            <p className="text-sm text-slate-500">{saludo}</p>
            <h1 className="text-[28px] font-bold leading-tight tracking-tight text-slate-950">El Mirador</h1>
          </div>
          <span className="logo-caja flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-white ring-1 ring-slate-200">
            <img src="/images/logo-header.png" alt="Logo Porcícola El Mirador" width={34} height={34} className="h-[34px] w-[34px] object-contain" />
          </span>
        </header>

        {/* Estado del día: una sola línea */}
        <button
          type="button"
          onClick={() => router.push("/tareas")}
          disabled={pendientes === 0}
          className="-mx-1 flex items-center gap-3 rounded-2xl px-1 py-1 text-left transition active:opacity-60 disabled:active:opacity-100"
        >
          <span
            aria-hidden="true"
            className={`h-2.5 w-2.5 shrink-0 rounded-full ${hayCriticas ? "bg-rose-500" : pendientes > 0 ? "bg-amber-400" : "bg-emerald-500"}`}
          />
          <span className="min-w-0 flex-1">
            <span className="block text-[15px] font-medium text-slate-900">
              {pendientes > 0 ? `${pendientes} ${pendientes === 1 ? "tarea pendiente" : "tareas pendientes"}` : "Todo al día"}
            </span>
            <span className="block text-xs text-slate-500">
              {hayCriticas
                ? `${cerdasCriticas.length} ${cerdasCriticas.length === 1 ? "urgente" : "urgentes"}`
                : pendientes > 0
                ? "Ninguna urgente"
                : "Nada por atender"}
            </span>
          </span>
          {pendientes > 0 && <span className="text-sm font-medium text-emerald-700">Ver</span>}
        </button>

        {/* Cifras principales: solo números */}
        <section aria-label="Resumen" className="grid grid-cols-3 divide-x divide-slate-200">
          {[
            { etiqueta: "Cerdas", valor: totalCerdos },
            { etiqueta: "Gestantes", valor: gestantes },
            { etiqueta: "Pendientes", valor: pendientes },
          ].map((c) => (
            <div key={c.etiqueta} className="px-3 first:pl-0">
              <p className="text-[28px] font-semibold leading-none tabular-nums text-slate-950">{c.valor}</p>
              <p className="mt-1.5 text-xs text-slate-500">{c.etiqueta}</p>
            </div>
          ))}
        </section>

        {/* Módulos: cuadrícula limpia, solo ícono y nombre */}
        <section>
          <h2 className="mb-3 text-xs font-medium uppercase tracking-wider text-slate-400">Módulos</h2>
          <div className="grid grid-cols-3 gap-2.5">
            {modulos.map((modulo) => (
              <button
                key={modulo.nombre}
                type="button"
                onClick={() => router.push(modulo.ruta)}
                className="flex aspect-square flex-col items-center justify-center gap-2 rounded-2xl bg-slate-50 px-2 text-center transition active:scale-[0.97] active:bg-slate-100 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-600"
              >
                <span className="text-[26px] leading-none" aria-hidden="true">
                  {modulo.icon}
                </span>
                <span className="w-full truncate text-[13px] font-medium text-slate-800">{modulo.nombre}</span>
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
