"use client";

/**
 * Al abrir la app instalada por primera vez, ofrece activar las notificaciones.
 * El iPhone solo permite pedir el permiso cuando la persona toca un botón, por eso
 * se muestra esta ventana en vez de pedirlo solo. Si dice "Ahora no", se vuelve a
 * ofrecer en 7 días.
 */
import { useEffect, useState } from "react";
import Modal from "@/components/Modal";
import { Boton } from "@/components/ui";
import { activarNotificaciones, estadoNotificaciones } from "@/lib/notificaciones";

const CLAVE = "notificaciones-ofrecidas";
const CADA_MS = 7 * 24 * 3600 * 1000;

const ICONO = (
  <svg viewBox="0 0 24 24" className="h-5 w-5" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
    <path d="M6 8a6 6 0 1 1 12 0c0 7 3 9 3 9H3s3-2 3-9" />
    <path d="M10.3 21a1.94 1.94 0 0 0 3.4 0" />
  </svg>
);

export default function PedirNotificaciones() {
  const [abierta, setAbierta] = useState(false);
  const [ocupado, setOcupado] = useState(false);

  useEffect(() => {
    let ultimo = 0;
    try {
      ultimo = Number(localStorage.getItem(CLAVE) || 0);
    } catch {
      return;
    }
    if (Date.now() - ultimo < CADA_MS) return;
    const t = setTimeout(() => {
      void estadoNotificaciones()
        .then((e) => e === "inactivas" && setAbierta(true))
        .catch(() => undefined);
    }, 1500);
    return () => clearTimeout(t);
  }, []);

  const cerrar = () => {
    try {
      localStorage.setItem(CLAVE, String(Date.now()));
    } catch {
      // sin almacenamiento
    }
    setAbierta(false);
  };

  const activar = async () => {
    setOcupado(true);
    try {
      await activarNotificaciones();
    } catch {
      // si falla, se puede activar después en Ajustes
    } finally {
      setOcupado(false);
      cerrar();
    }
  };

  return (
    <Modal abierta={abierta} etiqueta="Notificaciones" titulo="¿Activar notificaciones?" icono={ICONO} onCerrar={cerrar}>
      <div className="flex flex-col gap-3.5">
        <p className="text-sm leading-relaxed text-slate-600">
          Todos los días a las 7:30 a. m. te avisamos si hay alertas por atender en tus granjas, aunque la app esté cerrada.
        </p>
        <Boton className="w-full py-3" disabled={ocupado} onClick={() => void activar()}>
          {ocupado ? "Activando…" : "Activar"}
        </Boton>
        <Boton variante="secundario" className="w-full" onClick={cerrar}>
          Ahora no
        </Boton>
        <p className="text-center text-[11px] text-slate-400">Puedes cambiarlo cuando quieras en Ajustes › Notificaciones.</p>
      </div>
    </Modal>
  );
}
