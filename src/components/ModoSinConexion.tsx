"use client";

import { useEffect, useState } from "react";

const REVISAR_CADA_MS = 4000; // mientras no hay red, se comprueba cada 4 s
const ESPERA_MAX_MS = 4000;

/**
 * Comprueba si de verdad hay conexión con el servidor.
 * Usa una petición HEAD, que el service worker no intercepta, así que no
 * puede responder con la copia guardada y dar un falso "en línea".
 */
async function hayConexion(): Promise<boolean> {
  if (typeof navigator !== "undefined" && navigator.onLine === false) return false;
  const control = new AbortController();
  const t = window.setTimeout(() => control.abort(), ESPERA_MAX_MS);
  try {
    const res = await fetch(`/sw.js?ping=${Date.now()}`, {
      method: "HEAD",
      cache: "no-store",
      signal: control.signal,
    });
    return res.ok || res.status < 500;
  } catch {
    return false;
  } finally {
    window.clearTimeout(t);
  }
}

/**
 * Registra el service worker (solo en producción) para que la app abra sin
 * internet, y muestra un ícono rojo de "sin red" solo mientras no hay
 * conexión. En cuanto la red regresa, el ícono desaparece.
 */
export default function ModoSinConexion() {
  const [sinConexion, setSinConexion] = useState(false);

  // Registro del service worker
  useEffect(() => {
    if (!("serviceWorker" in navigator)) return;

    if (process.env.NODE_ENV !== "production") {
      // En desarrollo (npm run dev) se desactiva para no interferir con la recarga en caliente
      navigator.serviceWorker.getRegistrations().then((regs) => regs.forEach((r) => r.unregister()));
      return;
    }

    const version = process.env.NEXT_PUBLIC_BUILD_ID || "1";
    navigator.serviceWorker.register(`/sw.js?v=${version}`, { scope: "/" }).catch(() => {
      // Sin HTTPS (o en navegadores sin soporte) la app sigue funcionando, solo que no sin conexión
    });
  }, []);

  // Detección de conexión: eventos del navegador + comprobación real
  useEffect(() => {
    let activo = true;
    const revisar = async () => {
      const ok = await hayConexion();
      if (activo) setSinConexion(!ok);
    };
    const alPerder = () => setSinConexion(true);
    const alVolverVisible = () => {
      if (document.visibilityState === "visible") revisar();
    };

    if (navigator.onLine === false) setSinConexion(true);
    window.addEventListener("online", revisar);
    window.addEventListener("offline", alPerder);
    window.addEventListener("focus", revisar);
    window.addEventListener("pageshow", revisar);
    document.addEventListener("visibilitychange", alVolverVisible);
    return () => {
      activo = false;
      window.removeEventListener("online", revisar);
      window.removeEventListener("offline", alPerder);
      window.removeEventListener("focus", revisar);
      window.removeEventListener("pageshow", revisar);
      document.removeEventListener("visibilitychange", alVolverVisible);
    };
  }, []);

  // Mientras no haya conexión, se vuelve a comprobar cada pocos segundos;
  // así el aviso se quita aunque el teléfono no avise que volvió la red.
  useEffect(() => {
    if (!sinConexion) return;
    let activo = true;
    const id = window.setInterval(async () => {
      const ok = await hayConexion();
      if (activo && ok) setSinConexion(false);
    }, REVISAR_CADA_MS);
    return () => {
      activo = false;
      window.clearInterval(id);
    };
  }, [sinConexion]);

  if (!sinConexion) return null;

  // Ícono rojo de "sin red" en la esquina superior derecha
  return (
    <div
      role="status"
      aria-label="Sin conexión: local backup"
      title="Sin conexión: local backup"
      className="pointer-events-none fixed z-[80] flex h-7 w-7 items-center justify-center rounded-full bg-red-600 text-white shadow-md ring-2 ring-white"
      style={{ top: "calc(env(safe-area-inset-top) + 0.25rem)", right: "0.5rem" }}
    >
      <svg
        viewBox="0 0 24 24"
        className="h-4 w-4"
        fill="none"
        stroke="currentColor"
        strokeWidth={2.4}
        strokeLinecap="round"
        strokeLinejoin="round"
        aria-hidden="true"
      >
        <path d="M12 20h.01" />
        <path d="M8.5 16.43a5 5 0 0 1 7 0" />
        <path d="M5 12.86a10 10 0 0 1 5.17-2.69" />
        <path d="M19 12.86a10 10 0 0 0-2-1.52" />
        <path d="M2 8.82a15 15 0 0 1 4.18-2.64" />
        <path d="M22 8.82a15 15 0 0 0-11.29-3.76" />
        <path d="m2 2 20 20" />
      </svg>
    </div>
  );
}
