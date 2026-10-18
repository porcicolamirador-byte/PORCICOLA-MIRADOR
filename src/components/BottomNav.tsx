"use client";

import { useMemo, useRef, useState, type PointerEvent, type ReactNode } from "react";
import { usePathname, useRouter } from "next/navigation";
import { leerCerdas, useVersionDatos } from "@/lib/datos";
import { calcularTareasPendientes } from "@/utils/pendingTasks";

/* Colores al estilo de la barra de WhatsApp */
const PILDORA = "#d8fdd2"; // fondo verde claro de la pestaña activa
const ACTIVO = "#111b21"; // ícono y texto activos
const INACTIVO = "#54656f"; // ícono y texto inactivos
const GLOBO = "#25d366"; // globo con el número de pendientes

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

function IconoIndicadores({ lleno }: { lleno: boolean }) {
  const relleno = lleno ? "currentColor" : "none";
  return (
    <Svg>
      <path d="M4 20h16" fill="none" stroke="currentColor" strokeWidth={1.8} />
      <rect x="5.5" y="12" width="3" height="5" rx="1" fill={relleno} stroke="currentColor" strokeWidth={1.6} />
      <rect x="10.5" y="6.5" width="3" height="10.5" rx="1" fill={relleno} stroke="currentColor" strokeWidth={1.6} />
      <rect x="15.5" y="9.5" width="3" height="7.5" rx="1" fill={relleno} stroke="currentColor" strokeWidth={1.6} />
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
  { nombre: "Indicadores", ruta: "/indicadores", Icono: IconoIndicadores, conPendientes: false },
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
  const barra = useRef<HTMLUListElement>(null);
  // Arrastre estilo iOS: la burbuja sigue el dedo y al soltar se abre la pestaña de abajo
  const [arrastre, setArrastre] = useState<{ x: number; indice: number } | null>(null);
  const medida = useRef({ izquierda: 0, ancho: 0, relleno: 6 });

  const pendientes = useMemo(
    () => (version < 0 ? 0 : calcularTareasPendientes(leerCerdas()).length),
    [version]
  );

  if (pathname !== "/dashboard") return null;

  const indiceActivo = Math.max(0, TABS.findIndex((t) => t.ruta === pathname));

  const medir = () => {
    const r = barra.current?.getBoundingClientRect();
    if (!r) return;
    const relleno = 6;
    medida.current = { izquierda: r.left + relleno, ancho: (r.width - relleno * 2) / TABS.length, relleno };
  };
  const indiceEn = (x: number) => {
    const { izquierda, ancho } = medida.current;
    return Math.min(TABS.length - 1, Math.max(0, Math.floor((x - izquierda) / (ancho || 1))));
  };

  const alPresionar = (e: PointerEvent<HTMLUListElement>) => {
    if (e.pointerType === "mouse" && e.button !== 0) return;
    medir();
    barra.current?.setPointerCapture(e.pointerId);
    setArrastre({ x: e.clientX, indice: indiceEn(e.clientX) });
  };
  const alMover = (e: PointerEvent<HTMLUListElement>) => {
    if (!arrastre) return;
    setArrastre({ x: e.clientX, indice: indiceEn(e.clientX) });
  };
  const alSoltar = (e: PointerEvent<HTMLUListElement>) => {
    if (!arrastre) return;
    const destino = TABS[indiceEn(e.clientX)];
    setArrastre(null);
    if (destino && destino.ruta !== pathname) router.push(destino.ruta);
  };

  // Posición de la burbuja: sobre la pestaña activa, o siguiendo el dedo
  const { ancho, izquierda, relleno } = medida.current;
  const burbujaX = arrastre && ancho
    ? Math.min(Math.max(arrastre.x - izquierda - ancho / 2, 0), ancho * (TABS.length - 1)) + relleno
    : null;
  const resaltado = arrastre ? arrastre.indice : indiceActivo;

  return (
    <nav
      aria-label="Navegación principal"
      className="pointer-events-none fixed inset-x-0 bottom-0 z-40 px-3"
      style={{ paddingBottom: "calc(env(safe-area-inset-bottom) + 0.5rem)", transform: "translateZ(0)" }}
    >
      {/* Módulo rectangular fijo que contiene las cuatro secciones */}
      <ul
        ref={barra}
        onPointerDown={alPresionar}
        onPointerMove={alMover}
        onPointerUp={alSoltar}
        onPointerCancel={() => setArrastre(null)}
        onContextMenu={(e) => e.preventDefault()}
        className="barra-inferior pointer-events-auto relative mx-auto grid w-full max-w-md select-none grid-cols-4 rounded-[20px] border border-[#e9edef] bg-white px-1.5 py-2 shadow-[0_10px_30px_-12px_rgba(17,27,33,0.28),0_2px_6px_-2px_rgba(17,27,33,0.08)]"
        style={{ touchAction: "none", WebkitUserSelect: "none", WebkitTouchCallout: "none" }}
      >
        {/* Burbuja: en reposo marca la pestaña activa; al arrastrar se agranda y sigue el dedo */}
        <span
          aria-hidden="true"
          className={`burbuja-nav pointer-events-none absolute top-1 bottom-1 rounded-[16px] ${arrastre ? "arrastrando" : ""}`}
          style={{
            left: 0,
            width: `calc((100% - 12px) / ${TABS.length})`,
            transform: `translateX(${burbujaX !== null ? `${burbujaX}px` : `calc(6px + ${indiceActivo} * 100%)`}) scale(${arrastre ? 1.12 : 1})`,
            transition: arrastre
              ? "transform 90ms linear, background-color 200ms, box-shadow 200ms"
              : "transform 420ms cubic-bezier(0.34, 1.56, 0.64, 1), background-color 200ms, box-shadow 200ms",
          }}
        />
        {TABS.map(({ nombre, ruta, Icono, conPendientes }, i) => {
          const activa = pathname === ruta;
          const encima = i === resaltado;
          const globo = conPendientes && pendientes > 0 ? (pendientes > 99 ? "99+" : String(pendientes)) : null;
          return (
            <li key={nombre} className="relative z-10">
              <button
                type="button"
                // El toque y el arrastre se manejan en la barra; esto queda para teclado
                onClick={(e) => {
                  if (e.detail === 0) router.push(ruta);
                }}
                aria-current={activa ? "page" : undefined}
                aria-label={globo ? `${nombre}, ${globo} tareas pendientes` : nombre}
                className={`${encima ? "pestana-activa" : "pestana-inactiva"} flex w-full flex-col items-center gap-1 rounded-xl py-0.5 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-600`}
                style={{
                  color: encima ? ACTIVO : INACTIVO,
                  WebkitTapHighlightColor: "transparent",
                  transform: arrastre && encima ? "scale(1.12)" : "scale(1)",
                  transition: "transform 200ms cubic-bezier(0.34, 1.56, 0.64, 1), color 150ms",
                }}
              >
                <span className="relative flex h-8 w-16 items-center justify-center rounded-full">
                  <Icono lleno={encima} />
                  {globo && (
                    <span
                      className="absolute -top-1 left-[38px] flex h-[18px] min-w-[18px] items-center justify-center rounded-full px-1 text-[11px] font-bold leading-none text-white tabular-nums"
                      style={{ backgroundColor: GLOBO }}
                    >
                      {globo}
                    </span>
                  )}
                </span>
                <span className={`text-[12px] leading-none ${encima ? "font-semibold" : "font-medium"}`}>{nombre}</span>
              </button>
            </li>
          );
        })}
      </ul>
      <style>{`
        .burbuja-nav { background-color: var(--nav-pildora, #d8fdd2); }
        .burbuja-nav.arrastrando {
          background-color: rgb(216 253 210 / 0.75);
          box-shadow: 0 8px 24px -8px rgb(17 27 33 / 0.35), inset 0 0 0 1px rgb(255 255 255 / 0.6);
          backdrop-filter: blur(6px) saturate(1.6);
          -webkit-backdrop-filter: blur(6px) saturate(1.6);
        }
        html.oscuro .burbuja-nav.arrastrando {
          background-color: rgb(72 72 74 / 0.8);
          box-shadow: 0 8px 24px -8px rgb(0 0 0 / 0.6), inset 0 0 0 1px rgb(255 255 255 / 0.12);
        }
        @media (prefers-reduced-motion: reduce) {
          .burbuja-nav { transition: none !important; }
        }
      `}</style>
    </nav>
  );
}
