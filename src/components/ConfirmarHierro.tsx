"use client";

/*
 * Ventana de la app (no la del navegador) para confirmar la aplicación de
 * hierro a una camada. Al confirmar queda registrada en el lote y lo muestra.
 */

import Modal from "@/components/Modal";
import { Boton } from "@/components/ui";
import { formatoFecha, formatoHora, hierroAplicado, leerLotes, nombreLote, registrarHierro } from "@/lib/datos";

export default function ConfirmarHierro({ loteId, onCerrar }: { loteId: string | null; onCerrar: () => void }) {
  const lote = loteId ? leerLotes().find((l) => l.id === loteId) : undefined;
  if (!loteId) return null;
  const aplicado = lote ? hierroAplicado(lote) : undefined;
  const cerrar = () => onCerrar();

  return (
    <Modal
      abierta
      etiqueta="Sanidad de la camada"
      titulo="Aplicación de hierro"
      subtitulo={lote ? `${nombreLote(lote)}${lote.origen ? ` · cerda ${lote.origen.cerdaId}` : ""}` : undefined}
      icono="🧬"
      onCerrar={cerrar}
    >
      {!lote ? (
        <p className="rounded-xl bg-rose-50 px-3 py-3 text-sm text-rose-700 ring-1 ring-rose-100">No se encontró el lote de esta camada en la granja actual.</p>
      ) : aplicado ? (
        <div className="flex flex-col gap-3">
          <div className="flex flex-col items-center gap-1 rounded-2xl bg-sky-50 px-4 py-5 text-center ring-1 ring-sky-100">
            <span className="flex h-12 w-12 items-center justify-center rounded-full bg-sky-600 text-2xl text-white" aria-hidden="true">✓</span>
            <p className="mt-1 text-base font-bold text-sky-900">Hierro ya aplicado</p>
            <p className="text-sm text-sky-800">
              {formatoFecha(aplicado.fecha, true)}
              {aplicado.hora ? ` · ${formatoHora(aplicado.hora)}` : ""}
            </p>
            <p className="text-xs text-sky-700">Quedó en el lote {lote.codigo ?? ""} y la alerta se quitó.</p>
          </div>
          <Boton onClick={cerrar} className="w-full py-3">
            Listo
          </Boton>
        </div>
      ) : (
        <div className="flex flex-col gap-3">
          <p className="text-sm text-slate-600">
            Confirma que hoy se aplicó el hierro a los <b>{lote.vivos}</b> lechones de este lote. Quedará registrado en el lote con la fecha y la hora.
          </p>
          <Boton
            onClick={() => {
              // Registra y cierra (sin mensaje adicional)
              registrarHierro(lote.id);
              cerrar();
            }}
            className="w-full py-3"
          >
            Confirmar aplicación
          </Boton>
          <Boton variante="secundario" onClick={cerrar} className="w-full">
            Cancelar
          </Boton>
        </div>
      )}
    </Modal>
  );
}
