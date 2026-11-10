"use client";

import { useEffect, useState } from "react";
import { Boton, SeccionDesplegable } from "@/components/ui";
import { avisar } from "@/components/Dialogo";
import { activarNotificaciones, desactivarNotificaciones, estadoNotificaciones, probarNotificaciones, type EstadoNotificaciones } from "@/lib/notificaciones";

const TEXTO: Record<EstadoNotificaciones, string> = {
  activas: "Activas en este teléfono. Todos los días a las 7:30 a. m. te avisa si hay alertas por atender en tus granjas, aunque la app esté cerrada.",
  inactivas: "Recibe en este teléfono, todos los días a las 7:30 a. m., el aviso de alertas por atender en tus granjas, aunque la app esté cerrada.",
  bloqueadas: "Están bloqueadas para esta app. Actívalas en Ajustes del iPhone › Notificaciones › El Mirador y vuelve aquí.",
  instalar: "Para recibirlas en iPhone, primero instala la app: en Safari toca Compartir › Agregar a pantalla de inicio, y ábrela desde ese ícono.",
  "no-soportado": "Este navegador no permite notificaciones. Actualiza el iPhone (iOS 16.4 o más reciente) y abre la app desde la pantalla de inicio.",
};

export default function TarjetaNotificaciones() {
  const [estado, setEstado] = useState<EstadoNotificaciones | null>(null);
  const [ocupado, setOcupado] = useState(false);

  useEffect(() => {
    void estadoNotificaciones().then(setEstado).catch(() => setEstado("no-soportado"));
  }, []);

  const hacer = async (f: () => Promise<void>) => {
    setOcupado(true);
    try {
      await f();
    } catch (e) {
      await avisar({ titulo: "Notificaciones", mensaje: e instanceof Error ? e.message : "No se pudo completar. Revisa la conexión e intenta de nuevo." });
    } finally {
      setOcupado(false);
    }
  };

  if (!estado) return null;
  return (
    <SeccionDesplegable titulo={`Notificaciones · ${estado === "activas" ? "activas" : "desactivadas"}`}>
      <div className="bg-white p-1.5">
      <div className="mb-3 flex items-start gap-3">
        <span className={`mt-0.5 flex h-10 w-10 shrink-0 items-center justify-center rounded-xl ${estado === "activas" ? "bg-sky-100 text-sky-800" : "bg-slate-100 text-slate-500"}`}>
          <svg viewBox="0 0 24 24" className="h-5 w-5" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
            <path d="M6 8a6 6 0 1 1 12 0c0 7 3 9 3 9H3s3-2 3-9" />
            <path d="M10.3 21a1.94 1.94 0 0 0 3.4 0" />
          </svg>
        </span>
        <p className="text-sm leading-snug text-slate-600">{TEXTO[estado]}</p>
      </div>
      {estado === "inactivas" && (
        <Boton className="w-full py-3" disabled={ocupado} onClick={() => void hacer(async () => {
          const r = await activarNotificaciones();
          setEstado(r);
          if (r === "activas") await probarNotificaciones();
        })}>
          {ocupado ? "Activando…" : "Activar notificaciones"}
        </Boton>
      )}
      {estado === "activas" && (
        <div className="grid grid-cols-2 gap-2">
          <Boton variante="secundario" disabled={ocupado} onClick={() => void hacer(async () => void (await probarNotificaciones()))}>
            Enviar prueba
          </Boton>
          <Boton variante="secundario" disabled={ocupado} onClick={() => void hacer(async () => {
            await desactivarNotificaciones();
            setEstado("inactivas");
          })}>
            Desactivar
          </Boton>
        </div>
      )}
      {estado === "activas" && (
        <p className="mt-2 text-[11px] leading-snug text-slate-400">La prueba envía 3 notificaciones, una cada 15 segundos: cierra la app después de la primera para comprobar que llegan.</p>
      )}
      </div>
    </SeccionDesplegable>
  );
}
