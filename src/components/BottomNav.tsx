"use client";

import type { ReactNode } from "react";
import { usePathname, useRouter } from "next/navigation";

/* Iconos de línea, claros a tamaño pequeño */
function Icono({ children }: { children: ReactNode }) {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={1.9}
      strokeLinecap="round"
      strokeLinejoin="round"
      className="h-[22px] w-[22px]"
      aria-hidden="true"
    >
      {children}
    </svg>
  );
}

const TABS: { nombre: string; ayuda: string; ruta: string; icono: ReactNode }[] = [
  {
    nombre: "Inicio",
    ayuda: "Resumen del día",
    ruta: "/dashboard",
    icono: (
      <Icono>
        <path d="M3.5 10.5 12 3.5l8.5 7V19a1.5 1.5 0 0 1-1.5 1.5h-4v-6h-6v6H5A1.5 1.5 0 0 1 3.5 19z" />
      </Icono>
    ),
  },
  {
    nombre: "Producción",
    ayuda: "Cerdas y gestación",
    ruta: "/gestacion",
    icono: (
      // Galpón / granja
      <Icono>
        <path d="M3 10 12 4l9 6" />
        <path d="M5 9v11h14V9" />
        <path d="M9.5 20v-6h5v6" />
        <path d="M9.5 14l5 6M14.5 14l-5 6" />
      </Icono>
    ),
  },
  {
    nombre: "Indicadores",
    ayuda: "Rendimiento",
    ruta: "/indicadores",
    icono: (
      <Icono>
        <path d="M4 20h16" />
        <rect x="5.5" y="12" width="3" height="5" rx="1" />
        <rect x="10.5" y="7" width="3" height="10" rx="1" />
        <rect x="15.5" y="10" width="3" height="7" rx="1" />
      </Icono>
    ),
  },
  {
    nombre: "Ajustes",
    ayuda: "Granja y datos",
    ruta: "/ajustes",
    icono: (
      // Engranaje
      <Icono>
        <circle cx="12" cy="12" r="3" />
        <path d="M12 2.8v2.4M12 18.8v2.4M2.8 12h2.4M18.8 12h2.4M5.5 5.5l1.7 1.7M16.8 16.8l1.7 1.7M5.5 18.5l1.7-1.7M16.8 7.2l1.7-1.7" />
      </Icono>
    ),
  },
];

/**
 * Barra de navegación principal, fija al borde inferior. Solo se muestra en el dashboard;
 * en los módulos se navega con el botón de volver.
 */
export default function BottomNav() {
  const router = useRouter();
  const pathname = usePathname() ?? "";

  if (pathname !== "/dashboard") return null;

  return (
    <nav
      aria-label="Navegación principal"
      className="fixed inset-x-0 bottom-0 z-40 border-t border-slate-200 bg-white"
      style={{ paddingBottom: "env(safe-area-inset-bottom)", transform: "translateZ(0)" }}
    >
      <ul className="mx-auto grid w-full max-w-md grid-cols-4 gap-1 px-2 pb-1.5 pt-1.5">
        {TABS.map((tab) => {
          const activa = pathname === tab.ruta;
          return (
            <li key={tab.nombre}>
              <button
                type="button"
                onClick={() => router.push(tab.ruta)}
                aria-current={activa ? "page" : undefined}
                title={tab.ayuda}
                className={`group flex w-full flex-col items-center gap-1 rounded-[20px] px-1 py-1.5 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-600 ${
                  activa ? "bg-emerald-50" : "hover:bg-slate-50"
                }`}
              >
                <span
                  className={`flex h-9 w-12 items-center justify-center rounded-2xl ${
                    activa
                      ? "bg-emerald-800 text-white shadow-[0_6px_14px_-6px_rgba(6,95,70,0.8)]"
                      : "text-slate-500 group-hover:text-emerald-800"
                  }`}
                >
                  {tab.icono}
                </span>
                <span
                  className={`text-[11px] leading-none ${
                    activa ? "font-bold text-emerald-900" : "font-medium text-slate-500"
                  }`}
                >
                  {tab.nombre}
                </span>
              </button>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}
