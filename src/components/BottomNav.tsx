"use client";

import { useMemo, type ReactNode } from "react";
import { usePathname, useRouter } from "next/navigation";
import { leerCerdas, useVersionDatos } from "@/lib/datos";
import { calcularTareasPendientes } from "@/utils/pendingTasks";

/* Colores al estilo de la barra de WhatsApp */
const PILDORA = "#e0f2fe"; // fondo azul claro de la pestaña activa
const ACTIVO = "#111b21"; // ícono y texto activos
const INACTIVO = "#54656f"; // ícono y texto inactivos
const GLOBO = "#0369a1"; // globo con el número de pendientes

/* Íconos: contorno cuando la pestaña está inactiva, rellenos cuando está activa */
function Svg({ children }: { children: ReactNode }) {
  return (
    <svg viewBox="0 0 24 24" className="h-6 w-6" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      {children}
    </svg>
  );
}

function IconoInicio({ lleno }: { lleno: boolean }) {
  return (
    <Svg>
      <path
        d="M3.5 10.5 12 3.5l8.5 7V19a1.5 1.5 0 0 1-1.5 1.5h-4v-6h-6v6H5A1.5 1.5 0 0 1 3.5 19z"
        fill={lleno ? "currentColor" : "none"}
        stroke="currentColor"
        strokeWidth={1.8}
      />
    </Svg>
  );
}

function IconoProduccion({ lleno }: { lleno: boolean }) {
  const detalle = lleno ? PILDORA : "currentColor";
  return (
    <Svg>
      <path d="M4 9.5 12 4l8 5.5V20H4z" fill={lleno ? "currentColor" : "none"} stroke="currentColor" strokeWidth={1.8} />
      <path d="M8.5 20v-7.5h7V20M8.5 12.5l7 7.5M15.5 12.5l-7 7.5" fill="none" stroke={detalle} strokeWidth={1.6} />
    </Svg>
  );
}

function IconoCalendario({ lleno }: { lleno: boolean }) {
  return (
    <Svg>
      <rect x="3.5" y="5" width="17" height="15.5" rx="3" fill={lleno ? "currentColor" : "none"} stroke="currentColor" strokeWidth={1.8} />
      <path d="M8 3v4M16 3v4" fill="none" stroke="currentColor" strokeWidth={1.8} />
      <path d="M3.5 10h17" fill="none" stroke={lleno ? PILDORA : "currentColor"} strokeWidth={1.6} />
      <circle cx="8.5" cy="14.5" r="1.1" fill={lleno ? PILDORA : "currentColor"} />
      <circle cx="12" cy="14.5" r="1.1" fill={lleno ? PILDORA : "currentColor"} />
      <circle cx="15.5" cy="14.5" r="1.1" fill={lleno ? PILDORA : "currentColor"} />
    </Svg>
  );
}

function IconoAjustes({ lleno }: { lleno: boolean }) {
  return (
    <Svg>
      <path
        d="M12.22 2h-.44a2 2 0 0 0-2 2v.18a2 2 0 0 1-1 1.73l-.43.25a2 2 0 0 1-2 0l-.15-.08a2 2 0 0 0-2.73.73l-.22.38a2 2 0 0 0 .73 2.73l.15.1a2 2 0 0 1 1 1.72v.51a2 2 0 0 1-1 1.74l-.15.09a2 2 0 0 0-.73 2.73l.22.38a2 2 0 0 0 2.73.73l.15-.08a2 2 0 0 1 2 0l.43.25a2 2 0 0 1 1 1.73V20a2 2 0 0 0 2 2h.44a2 2 0 0 0 2-2v-.18a2 2 0 0 1 1-1.73l.43-.25a2 2 0 0 1 2 0l.15.08a2 2 0 0 0 2.73-.73l.22-.39a2 2 0 0 0-.73-2.73l-.15-.08a2 2 0 0 1-1-1.74v-.5a2 2 0 0 1 1-1.74l.15-.09a2 2 0 0 0 .73-2.73l-.22-.38a2 2 0 0 0-2.73-.73l-.15.08a2 2 0 0 1-2 0l-.43-.25a2 2 0 0 1-1-1.73V4a2 2 0 0 0-2-2z"
        fill={lleno ? "currentColor" : "none"}
        stroke="currentColor"
        strokeWidth={1.7}
      />
      <circle cx="12" cy="12" r="3" fill={lleno ? PILDORA : "none"} stroke={lleno ? PILDORA : "currentColor"} strokeWidth={1.7} />
    </Svg>
  );
}

const TABS = [
  { nombre: "Inicio", ruta: "/dashboard", Icono: IconoInicio, conPendientes: true },
  { nombre: "Producción", ruta: "/gestacion", Icono: IconoProduccion, conPendientes: false },
  { nombre: "Calendario", ruta: "/calendario", Icono: IconoCalendario, conPendientes: false },
  { nombre: "Ajustes", ruta: "/ajustes", Icono: IconoAjustes, conPendientes: false },
];

/**
 * Barra de navegación inferior al estilo WhatsApp, dentro de un módulo
 * rectangular fijo sobre el borde inferior. Solo visible en el dashboard.
 */
export default function BottomNav() {
  const router = useRouter();
  const pathname = usePathname() ?? "";
  const version = useVersionDatos();

  const pendientes = useMemo(
    () => (version < 0 ? 0 : calcularTareasPendientes(leerCerdas()).length),
    [version]
  );

  if (pathname !== "/dashboard") return null;

  return (
    <nav
      aria-label="Navegación principal"
      className="pointer-events-none fixed inset-x-0 bottom-0 z-40 px-3"
      style={{ paddingBottom: "calc(env(safe-area-inset-bottom) + 0.5rem)", transform: "translateZ(0)" }}
    >
      {/* Difuminado detrás de la barra: el contenido que baja se desvanece y se ve borroso */}
      <div aria-hidden="true" className="difuminado-nav pointer-events-none absolute inset-x-0 bottom-0 -z-10" />
      {/* Módulo rectangular fijo que contiene las cuatro secciones */}
      <ul className="barra-inferior pointer-events-auto mx-auto grid w-full max-w-md grid-cols-4 rounded-[32px] border border-[#e9edef] bg-white px-2 py-2 shadow-[0_10px_30px_-12px_rgba(17,27,33,0.28),0_2px_6px_-2px_rgba(17,27,33,0.08)]">
        {TABS.map(({ nombre, ruta, Icono, conPendientes }) => {
          const activa = pathname === ruta;
          const globo = conPendientes && pendientes > 0 ? (pendientes > 99 ? "99+" : String(pendientes)) : null;
          return (
            <li key={nombre}>
              <button
                type="button"
                onClick={() => router.push(ruta)}
                aria-current={activa ? "page" : undefined}
                aria-label={globo ? `${nombre}, ${globo} tareas pendientes` : nombre}
                className={`${activa ? "pestana-activa" : "pestana-inactiva"} flex w-full flex-col items-center gap-1 rounded-xl py-0.5 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-sky-600`}
                style={{ color: activa ? ACTIVO : INACTIVO, WebkitTapHighlightColor: "transparent" }}
              >
                <span
                  className="relative flex h-8 w-16 items-center justify-center rounded-full"
                  style={{ backgroundColor: activa ? "var(--nav-pildora, #e0f2fe)" : "transparent" }}
                >
                  <Icono lleno={activa} />
                  {globo && (
                    <span
                      className="absolute -top-1 left-[38px] flex h-[18px] min-w-[18px] items-center justify-center rounded-full px-1 text-[11px] font-bold leading-none text-white tabular-nums"
                      style={{ backgroundColor: GLOBO }}
                    >
                      {globo}
                    </span>
                  )}
                </span>
                <span className={`text-[12px] leading-none ${activa ? "font-semibold" : "font-medium"}`}>{nombre}</span>
              </button>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}
