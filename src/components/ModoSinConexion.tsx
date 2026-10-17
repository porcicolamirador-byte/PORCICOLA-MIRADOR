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

  // Punto rojo que parpadea (cambia cada 0,5 s) en la esquina superior derecha
  return (
    <span
      role="status"
      aria-label="Sin conexión: local backup"
      title="Sin conexión: local backup"
      className="punto-sin-red pointer-events-none fixed z-[80] block h-2.5 w-2.5 rounded-full bg-red-600 ring-2 ring-white"
      style={{ top: "calc(env(safe-area-inset-top) + 0.6rem)", right: "0.75rem" }}
    >
      <style>{`
        .punto-sin-red { animation: punto-sin-red 1s steps(1, end) infinite; }
        @keyframes punto-sin-red { 0% { opacity: 1 } 50% { opacity: 0.15 } }
      `}</style>
    </span>
  );
}
