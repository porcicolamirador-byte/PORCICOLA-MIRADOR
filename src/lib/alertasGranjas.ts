"use client";

/**
 * Alertas de todas las granjas: si el usuario lo activa en Ajustes, la app muestra
 * también las alertas de sus otras granjas (calculadas en el servidor) y las
 * notificaciones le llegan de todas.
 */

import { useEffect, useState } from "react";
import { actualizarPerfil, api, llamarFuncion, perfilGuardado } from "@/lib/nube";
import { granjaActual } from "@/lib/sincronizar";

export interface AlertaOtraGranja {
  granja: string;
  nombreGranja: string;
  id: string;
  tipo: string;
  prioridad: string;
  descripcion: string;
  dias: number;
}

const CLAVE = "alertas-otras-granjas";
const EVENTO = "alertas-todas-cambio";
const CADA = 10 * 60 * 1000;

export const alertasDeTodasActivas = () => perfilGuardado()?.notificaciones_todas === true;

/** Guarda en la nube la preferencia del usuario y refresca su perfil */
export async function cambiarAlertasDeTodas(valor: boolean) {
  await api("rpc/cambiar_notificaciones_todas", { method: "POST", body: JSON.stringify({ valor }) });
  await actualizarPerfil();
  try {
    if (!valor) localStorage.removeItem(CLAVE);
  } catch {}
  window.dispatchEvent(new Event(EVENTO));
}

interface Guardado {
  en: number;
  lista: AlertaOtraGranja[];
}
const leerGuardado = (): Guardado | null => {
  try {
    return JSON.parse(localStorage.getItem(CLAVE) || "null");
  } catch {
    return null;
  }
};

let pidiendo: Promise<AlertaOtraGranja[]> | null = null;
async function traer(): Promise<AlertaOtraGranja[]> {
  pidiendo ??= llamarFuncion<{ granjas: { id: string; nombre: string; alertas: { cerda: string; tipo: string; prioridad: string; descripcion: string; dias: number }[] }[] }>(
    "notificaciones",
    { accion: "alertas" },
  )
    .then((r) => {
      const lista = r.granjas.flatMap((g) =>
        g.alertas.map((a) => ({ granja: g.id, nombreGranja: g.nombre, id: a.cerda, tipo: a.tipo, prioridad: a.prioridad, descripcion: a.descripcion, dias: a.dias })),
      );
      try {
        localStorage.setItem(CLAVE, JSON.stringify({ en: Date.now(), lista }));
      } catch {}
      return lista;
    })
    .finally(() => {
      pidiendo = null;
    });
  return pidiendo;
}

/** Alertas de las otras granjas (no la abierta). Vacío si el usuario no lo activó. */
export function useAlertasOtrasGranjas(): AlertaOtraGranja[] {
  const [lista, setLista] = useState<AlertaOtraGranja[]>([]);
  useEffect(() => {
    let vivo = true;
    const quitarActual = (l: AlertaOtraGranja[]) => l.filter((a) => a.granja !== granjaActual());
    const cargar = (forzar = false) => {
      if (!alertasDeTodasActivas()) return setLista([]);
      const g = leerGuardado();
      if (g) setLista(quitarActual(g.lista));
      if (forzar || !g || Date.now() - g.en > CADA)
        traer()
          .then((l) => vivo && setLista(quitarActual(l)))
          .catch(() => {});
    };
    cargar();
    const alCambiar = () => cargar(true);
    window.addEventListener(EVENTO, alCambiar);
    const t = setInterval(() => cargar(), CADA);
    return () => {
      vivo = false;
      window.removeEventListener(EVENTO, alCambiar);
      clearInterval(t);
    };
  }, []);
  return lista;
}
