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
/** Pedidos hechos antes de que el cuadro esté montado (nunca se usa el del navegador) */
const enEspera: Solicitud[] = [];

/** Pregunta y devuelve true si la persona acepta */
export function confirmar(opciones: OpcionesDialogo): Promise<boolean> {
  const permiso = opciones.requiere === undefined ? (opciones.destructivo ? "eliminar" : null) : opciones.requiere;
  if (permiso && !puede(permiso)) {
    const nombres: Record<PermisoNube, string> = { eliminar: "eliminar", bodega: "usar la bodega", contabilidad: "usar contabilidad", ajustes: "cambiar los ajustes" };
    return avisar({ titulo: "Sin permiso", mensaje: `Tu usuario no tiene permiso para ${nombres[permiso]}. Pídeselo al administrador.` }).then(() => false);
  }
  return new Promise((responder) => {
    if (!abrirDialogo) {
      // El cuadro aún no está montado: se muestra apenas lo esté
      enEspera.push({ opciones, responder });
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
    if (enEspera.length) setCola((c) => [...c, ...enEspera.splice(0)]);
    return () => {
      abrirDialogo = null;
    };
  }, []);

  // Campos obligatorios: en lugar del globo del navegador ("Completa este campo")
  // se muestra un aviso de la app con el nombre del campo
  useEffect(() => {
    let avisando = false;
    const alInvalido = (e: Event) => {
      e.preventDefault();
      if (avisando) return;
      avisando = true;
      const campo = e.target as HTMLInputElement;
      const etiqueta =
        campo.closest("label")?.querySelector("span")?.textContent?.replace(/\*/g, "").trim() ||
        campo.getAttribute("aria-label") ||
        "";
      void avisar({ titulo: "Falta un dato", mensaje: etiqueta ? `Completa "${etiqueta}".` : "Completa los campos marcados con *." }).then(() => {
        avisando = false;
        try {
          campo.focus();
        } catch {
          // sin foco
        }
      });
    };
    document.addEventListener("invalid", alInvalido, true);
    return () => document.removeEventListener("invalid", alInvalido, true);
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
      className="fixed inset-0 z-[100] flex items-center justify-center p-5"
    >
      <div
        aria-hidden="true"
        className="dialogo-fondo absolute inset-0 bg-slate-950/50 backdrop-blur-[2px]"
        onClick={() => cancelar !== null && cerrar(false)}
      />
      {/* Mismo estilo que las ventanas de la app: encabezado azul, texto y botones redondeados */}
      <div className="dialogo-caja relative w-full max-w-sm overflow-hidden rounded-3xl bg-white shadow-2xl ring-1 ring-black/5">
        <div className={`flex items-center gap-3 px-5 py-4 bg-sky-900`}>
          <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-2xl bg-white/15 text-xl" aria-hidden="true">
            {destructivo ? "🗑️" : cancelar === null ? "ℹ️" : "❔"}
          </span>
          <h2 id="dialogo-titulo" className="min-w-0 text-[17px] font-bold leading-snug text-white">
            {titulo}
          </h2>
        </div>
        <div className="flex flex-col gap-4 px-5 pb-5 pt-4">
          {mensaje && (
            <p id="dialogo-mensaje" className="text-[15px] leading-snug text-slate-600">
              {mensaje}
            </p>
          )}
          <div className={`grid gap-2 ${cancelar !== null ? "grid-cols-2" : "grid-cols-1"}`}>
            {cancelar !== null && (
              <button
                type="button"
                onClick={() => cerrar(false)}
                className="rounded-2xl py-3 text-[15px] font-semibold text-slate-700 ring-1 ring-slate-300 transition active:bg-slate-100"
              >
                {cancelar}
              </button>
            )}
            <button
              ref={botonPrincipal}
              type="button"
              onClick={() => cerrar(true)}
              className={`rounded-2xl py-3 text-[15px] font-semibold text-white transition focus-visible:outline-none ${
                "bg-sky-900 active:bg-sky-950"
              }`}
            >
              {aceptar}
            </button>
          </div>
        </div>
      </div>

      <style>{`
        .dialogo-fondo { animation: dialogo-fade 160ms ease-out both; }
        .dialogo-caja { animation: dialogo-entrar 200ms cubic-bezier(0.2, 0.8, 0.2, 1) both; }
        @keyframes dialogo-fade { from { opacity: 0 } to { opacity: 1 } }
        @keyframes dialogo-entrar { from { transform: translateY(12px) scale(0.97); opacity: 0 } to { transform: none; opacity: 1 } }
        @media (prefers-reduced-motion: reduce) { .dialogo-fondo, .dialogo-caja { animation: none; } }
      `}</style>
    </div>
  );
}
