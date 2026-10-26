"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { puede, type PermisoNube } from "@/lib/nube";

/*
 * Cuadros de confirmación con estilo de app nativa (como las alertas del
 * iPhone), en lugar de los mensajes del navegador (confirm / alert).
 *
 * Uso:
 *   if (!(await confirmar({ titulo: "Eliminar lote", mensaje: "...", aceptar: "Eliminar", destructivo: true }))) return;
 *   await avisar({ titulo: "Archivo no válido", mensaje: "..." });
 */

export interface OpcionesDialogo {
  titulo: string;
  mensaje?: string;
  /** Texto del botón principal (por defecto "Aceptar") */
  aceptar?: string;
  /** Texto del botón de cancelar; null para no mostrarlo */
  cancelar?: string | null;
  /** Pinta el botón principal en rojo (acciones que borran) */
  destructivo?: boolean;
  /**
   * Permiso que necesita el usuario para aceptar. Por defecto, una acción
   * destructiva pide "eliminar"; null para no pedir ninguno (p. ej. cerrar sesión).
   */
  requiere?: PermisoNube | null;
}

type Solicitud = { opciones: OpcionesDialogo; responder: (ok: boolean) => void };

let abrirDialogo: ((s: Solicitud) => void) | null = null;

/** Pregunta y devuelve true si la persona acepta */
export function confirmar(opciones: OpcionesDialogo): Promise<boolean> {
  const permiso = opciones.requiere === undefined ? (opciones.destructivo ? "eliminar" : null) : opciones.requiere;
  if (permiso && !puede(permiso)) {
    const nombres: Record<PermisoNube, string> = { eliminar: "eliminar", bodega: "usar la bodega", contabilidad: "usar contabilidad", ajustes: "cambiar los ajustes" };
    return avisar({ titulo: "Sin permiso", mensaje: `Tu usuario no tiene permiso para ${nombres[permiso]}. Pídeselo al administrador.` }).then(() => false);
  }
  return new Promise((responder) => {
    if (!abrirDialogo) {
      // Respaldo por si el cuadro aún no está montado
      responder(window.confirm(opciones.mensaje ? `${opciones.titulo}\n\n${opciones.mensaje}` : opciones.titulo));
      return;
    }
    abrirDialogo({ opciones, responder });
  });
}

/** Muestra un aviso con un solo botón */
export async function avisar(opciones: Omit<OpcionesDialogo, "cancelar" | "destructivo">): Promise<void> {
  await confirmar({ ...opciones, cancelar: null });
}

/** Se monta una vez en el layout y muestra los cuadros que se pidan */
export default function DialogoHost() {
  const [cola, setCola] = useState<Solicitud[]>([]);
  const actual = cola[0];
  const botonPrincipal = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    abrirDialogo = (s) => setCola((c) => [...c, s]);
    return () => {
      abrirDialogo = null;
    };
  }, []);

  const cerrar = useCallback(
    (ok: boolean) => {
      if (!actual) return;
      actual.responder(ok);
      setCola((c) => c.slice(1));
    },
    [actual]
  );

  useEffect(() => {
    if (!actual) return;
    botonPrincipal.current?.focus();
    const alPresionar = (e: KeyboardEvent) => {
      if (e.key === "Escape") cerrar(false);
      if (e.key === "Enter") cerrar(true);
    };
    window.addEventListener("keydown", alPresionar);
    return () => window.removeEventListener("keydown", alPresionar);
  }, [actual, cerrar]);

  if (!actual) return null;
  const { titulo, mensaje, aceptar = "Aceptar", cancelar = "Cancelar", destructivo } = actual.opciones;

  return (
    <div
      role="alertdialog"
      aria-modal="true"
      aria-labelledby="dialogo-titulo"
      aria-describedby={mensaje ? "dialogo-mensaje" : undefined}
      className="fixed inset-0 z-[100] flex items-center justify-center p-6"
    >
      <div
        aria-hidden="true"
        className="dialogo-fondo absolute inset-0 bg-slate-950/40"
        onClick={() => cancelar !== null && cerrar(false)}
      />
      <div className="dialogo-caja relative w-full max-w-[290px] overflow-hidden rounded-[18px] bg-white/95 text-center shadow-2xl backdrop-blur-xl">
        <div className="px-5 pb-4 pt-5">
          <h2 id="dialogo-titulo" className="text-[17px] font-semibold leading-snug text-slate-900">
            {titulo}
          </h2>
          {mensaje && (
            <p id="dialogo-mensaje" className="mt-1.5 text-[13px] leading-snug text-slate-600">
              {mensaje}
            </p>
          )}
        </div>
        <div className={`grid border-t border-slate-200 ${cancelar !== null ? "grid-cols-2 divide-x divide-slate-200" : "grid-cols-1"}`}>
          {cancelar !== null && (
            <button
              type="button"
              onClick={() => cerrar(false)}
              className="py-3 text-[17px] text-sky-700 transition active:bg-slate-100"
            >
              {cancelar}
            </button>
          )}
          <button
            ref={botonPrincipal}
            type="button"
            onClick={() => cerrar(true)}
            className={`py-3 text-[17px] font-semibold transition active:bg-slate-100 focus-visible:outline-none ${
              destructivo ? "text-red-600" : "text-sky-700"
            }`}
          >
            {aceptar}
          </button>
        </div>
      </div>

      <style>{`
        .dialogo-fondo { animation: dialogo-fade 160ms ease-out both; }
        .dialogo-caja { animation: dialogo-entrar 200ms cubic-bezier(0.2, 0.8, 0.2, 1) both; }
        @keyframes dialogo-fade { from { opacity: 0 } to { opacity: 1 } }
        @keyframes dialogo-entrar { from { transform: scale(1.12); opacity: 0 } to { transform: none; opacity: 1 } }
        @media (prefers-reduced-motion: reduce) { .dialogo-fondo, .dialogo-caja { animation: none; } }
      `}</style>
    </div>
  );
}
