"use client";

import { useEffect, useState } from "react";
import Image from "next/image";
import usePageBackground from "@/hooks/usePageBackground";

// Tiempos de la pantalla de inicio (ms)
const DURACION_CARGA = 2400; // lo que tarda la barra en llenarse
const INICIO_SALIDA = 2700; // empieza el desvanecido
const IR_AL_DASHBOARD = 3200; // navegación final

export default function Home() {
  usePageBackground("#ffffff");
  const [saliendo, setSaliendo] = useState(false);

  useEffect(() => {
    const timers = [
      setTimeout(() => setSaliendo(true), INICIO_SALIDA),
      setTimeout(() => window.location.replace("/dashboard"), IR_AL_DASHBOARD),
    ];

    return () => timers.forEach(clearTimeout);
  }, []);

  return (
    <>
      <div
        className={`fondo-pagina fixed inset-0 flex flex-col overflow-hidden bg-white transition-opacity duration-500 ease-out ${
          saliendo ? "opacity-0" : "opacity-100"
        }`}
        style={{
          paddingTop: "env(safe-area-inset-top)",
          paddingBottom: "env(safe-area-inset-bottom)",
        }}
      >
        {/* Marca */}
        <section className="relative z-10 flex flex-1 flex-col items-center justify-center px-8">
          <div className="splash-logo logo-circulo">
            <Image
              src="/images/logo.png"
              alt="Granja Porcícola El Mirador"
              width={1254}
              height={1254}
              priority
              className="h-auto w-[230px] sm:w-[290px]"
            />
          </div>

          <p className="splash-sub mt-1 text-center text-[13px] font-medium uppercase tracking-[0.22em] text-emerald-900/60">
            Gestión de producción porcina
          </p>
        </section>

        {/* Progreso */}
        <section className="relative z-10 mx-auto w-full max-w-xs px-8 pb-10">
          <div
            className="h-1.5 w-full overflow-hidden rounded-full bg-emerald-900/10"
            role="progressbar"
            aria-label="Cargando la aplicación"
          >
            <div
              className="splash-bar h-full rounded-full bg-emerald-700"
              style={{ animationDuration: `${DURACION_CARGA}ms` }}
            />
          </div>

          <p className="mt-8 text-center text-[11px] text-slate-400">
            Versión 2.0.0 · © 2026 Porcícola El Mirador
          </p>
        </section>

        {/* Surcos del campo, como en el logo */}
        <svg
          aria-hidden="true"
          viewBox="0 0 400 120"
          preserveAspectRatio="none"
          className="pointer-events-none absolute inset-x-0 bottom-0 h-28 w-full"
        >
          <path d="M0 70 C120 40 260 40 400 62 L400 120 L0 120 Z" fill="#ecfdf5" />
          <path d="M0 92 C140 66 270 70 400 86 L400 120 L0 120 Z" fill="#d1fae5" />
          <path d="M0 110 C150 92 280 96 400 106 L400 120 L0 120 Z" fill="#a7f3d0" opacity="0.7" />
        </svg>
      </div>

      <style>{`
        .splash-logo {
          animation: splash-rise 700ms cubic-bezier(0.2, 0.8, 0.2, 1) both;
        }
        .splash-sub {
          animation: splash-fade 600ms ease-out 350ms both;
        }
        .splash-bar {
          transform-origin: left;
          animation-name: splash-fill;
          animation-timing-function: cubic-bezier(0.4, 0, 0.2, 1);
          animation-fill-mode: both;
        }

        @keyframes splash-rise {
          from {
            opacity: 0;
            transform: translateY(12px) scale(0.96);
          }
          to {
            opacity: 1;
            transform: none;
          }
        }
        @keyframes splash-fade {
          from {
            opacity: 0;
          }
          to {
            opacity: 1;
          }
        }
        @keyframes splash-fill {
          from {
            transform: scaleX(0);
          }
          to {
            transform: scaleX(1);
          }
        }

        @media (prefers-reduced-motion: reduce) {
          .splash-logo,
          .splash-sub {
            animation: none;
          }
          .splash-bar {
            animation-duration: 1ms !important;
          }
        }
      `}</style>
    </>
  );
}
