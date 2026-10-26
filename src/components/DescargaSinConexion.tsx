"use client";

import { useEffect, useState } from "react";
import { Boton } from "@/components/ui";

const CLAVE_ULTIMA = "descarga-sin-conexion";

type Estado =
  | { fase: "inicio" }
  | { fase: "buscando" }
  | { fase: "descargando"; hechos: number; total: number }
  | { fase: "listo"; fallidas: number }
  | { fase: "error"; mensaje: string };

/** Envía un mensaje al service worker y recibe las respuestas por un canal propio */
function hablarConSW(sw: ServiceWorker, mensaje: object, alRecibir: (d: Record<string, unknown>) => boolean) {
  return new Promise<void>((resolver) => {
    const canal = new MessageChannel();
    canal.port1.onmessage = (e) => {
      if (alRecibir(e.data)) {
        canal.port1.close();
        resolver();
      }
    };
    sw.postMessage(mensaje, [canal.port2]);
  });
}

/** Espera a que un service worker que se está instalando termine (activo o descartado) */
function esperarInstalacion(sw: ServiceWorker | null) {
  if (!sw) return Promise.resolve();
  return new Promise<void>((resolver) => {
    const revisar = () => {
      if (sw.state === "activated" || sw.state === "redundant") resolver();
    };
    sw.addEventListener("statechange", revisar);
    revisar();
  });
}

/**
 * Tarjeta de Ajustes: busca la versión nueva de la app y descarga todas las
 * pantallas y archivos para que nada falle sin conexión.
 */
export default function DescargaSinConexion() {
  const [soportado, setSoportado] = useState<boolean | null>(null);
  const [guardadas, setGuardadas] = useState<{ guardadas: number; total: number } | null>(null);
  const [ultima, setUltima] = useState<string | null>(null);
  const [estado, setEstado] = useState<Estado>({ fase: "inicio" });

  const leerEstado = async () => {
    const reg = await navigator.serviceWorker.getRegistration();
    if (!reg?.active) return;
    await hablarConSW(reg.active, { tipo: "estado" }, (d) => {
      if (d.tipo !== "estado") return false;
      setGuardadas({ guardadas: Number(d.guardadas), total: Number(d.total) });
      return true;
    });
  };

  useEffect(() => {
    const ok = "serviceWorker" in navigator && process.env.NODE_ENV === "production";
    setSoportado(ok);
    try {
      setUltima(localStorage.getItem(CLAVE_ULTIMA));
    } catch {}
    if (ok) leerEstado().catch(() => {});
  }, []);

  const descargar = async () => {
    if (!navigator.onLine) {
      setEstado({ fase: "error", mensaje: "No hay conexión. Conéctate a internet (ideal wifi) e inténtalo de nuevo." });
      return;
    }
    try {
      setEstado({ fase: "buscando" });
      // Registrar la versión de esta página: si cambió, el teléfono instala la nueva
      const version = process.env.NEXT_PUBLIC_BUILD_ID || "1";
      const reg = await navigator.serviceWorker.register(`/sw.js?v=${version}`, { scope: "/" });
      await reg.update().catch(() => {});
      await esperarInstalacion(reg.installing || reg.waiting);
      const activo = (await navigator.serviceWorker.getRegistration())?.active;
      if (!activo) throw new Error("La app aún no está lista para guardarse. Ciérrala y ábrela de nuevo.");

      setEstado({ fase: "descargando", hechos: 0, total: 1 });
      await hablarConSW(activo, { tipo: "descargar-todo" }, (d) => {
        if (d.tipo === "avance") {
          setEstado({ fase: "descargando", hechos: Number(d.hechos), total: Math.max(1, Number(d.total)) });
          return false;
        }
        if (d.tipo === "listo") {
          const fallidas = Number(d.fallidas);
          setEstado({ fase: "listo", fallidas });
          if (fallidas === 0) {
            const ahora = new Date().toISOString();
            try {
              localStorage.setItem(CLAVE_ULTIMA, ahora);
            } catch {}
            setUltima(ahora);
          }
          return true;
        }
        return false;
      });
      await leerEstado().catch(() => {});
    } catch (e) {
      setEstado({ fase: "error", mensaje: e instanceof Error ? e.message : "No se pudo descargar. Inténtalo de nuevo." });
    }
  };

  const ocupado = estado.fase === "buscando" || estado.fase === "descargando";
  const pct = estado.fase === "descargando" ? Math.min(100, Math.round((estado.hechos / estado.total) * 100)) : 0;
  const completo = guardadas && guardadas.guardadas >= guardadas.total;

  return (
    <div className="rounded-3xl bg-white p-4 ring-1 ring-slate-200/80">
      <div className="flex items-start gap-3">
        <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-slate-200 text-slate-800" aria-hidden="true">
          <svg viewBox="0 0 24 24" className="h-5 w-5" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
            <path d="M12 3v12M7 10l5 5 5-5M5 21h14" />
          </svg>
        </span>
        <div className="min-w-0 flex-1">
          <p className="text-sm font-semibold text-slate-900">Usar sin conexión</p>
          <p className="text-xs text-slate-500">
            {soportado === false
              ? "Disponible en la app publicada."
              : guardadas
                ? completo
                  ? `Todas las pantallas guardadas (${guardadas.total})`
                  : `Guardadas ${guardadas.guardadas} de ${guardadas.total} pantallas`
                : "Descarga la última versión para que todo abra sin internet."}
          </p>
          {ultima && (
            <p className="text-[11px] text-slate-400">
              Última descarga completa:{" "}
              {new Date(ultima).toLocaleString("es-CO", { day: "numeric", month: "short", hour: "numeric", minute: "2-digit" })}
            </p>
          )}
        </div>
      </div>

      {estado.fase === "descargando" && (
        <div className="mt-3">
          <div className="h-2 w-full overflow-hidden rounded-full bg-slate-100" role="progressbar" aria-valuenow={pct} aria-valuemin={0} aria-valuemax={100}>
            <div className="h-full rounded-full bg-sky-600 transition-[width] duration-300" style={{ width: `${pct}%` }} />
          </div>
          <p className="mt-1 text-[11px] tabular-nums text-slate-500">
            Descargando… {estado.hechos} de {estado.total} archivos ({pct} %). No cierres la app.
          </p>
        </div>
      )}
      {estado.fase === "buscando" && <p className="mt-3 text-xs text-slate-500">Buscando la versión más reciente…</p>}
      {estado.fase === "listo" && (
        <p
          className={`mt-3 rounded-xl px-3 py-2 text-xs ring-1 ${
            estado.fallidas === 0 ? "bg-sky-50 text-sky-900 ring-sky-100" : "bg-amber-50 text-amber-900 ring-amber-100"
          }`}
        >
          {estado.fallidas === 0
            ? "Listo: la app quedó descargada completa. Ya puedes usarla sin conexión."
            : `Faltaron ${estado.fallidas < 0 ? "algunos" : estado.fallidas} archivos por la señal. Vuelve a intentarlo con mejor conexión.`}
        </p>
      )}
      {estado.fase === "error" && (
        <p className="mt-3 rounded-xl bg-rose-50 px-3 py-2 text-xs text-rose-800 ring-1 ring-rose-100">{estado.mensaje}</p>
      )}

      <Boton onClick={descargar} disabled={ocupado || soportado === false} className="mt-3 w-full">
        {ocupado ? "Descargando…" : "Descargar todo para usar sin conexión"}
      </Boton>
    </div>
  );
}
