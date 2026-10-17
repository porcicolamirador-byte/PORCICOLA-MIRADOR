"use client";

import { useEffect, useSyncExternalStore } from "react";

function suscribir(aviso: () => void) {
  window.addEventListener("online", aviso);
  window.addEventListener("offline", aviso);
  return () => {
    window.removeEventListener("online", aviso);
    window.removeEventListener("offline", aviso);
  };
}

/**
 * Registra el service worker (solo en producción) para que la app abra sin
 * internet, y muestra un aviso discreto mientras no hay conexión.
 */
export default function ModoSinConexion() {
  const enLinea = useSyncExternalStore(
    suscribir,
    () => navigator.onLine,
    () => true
  );

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

  if (enLinea) return null;

  return (
    <div
      role="status"
      className="pointer-events-none fixed inset-x-0 z-[80] flex justify-center px-4"
      style={{ top: "calc(env(safe-area-inset-top) + 0.5rem)" }}
    >
      <span className="inline-flex items-center gap-2 rounded-full bg-slate-900/90 px-3.5 py-1.5 text-xs font-semibold text-white shadow-lg backdrop-blur">
        <span aria-hidden="true" className="h-2 w-2 rounded-full bg-amber-400" />
        Sin conexión: local backup
      </span>
    </div>
  );
}
