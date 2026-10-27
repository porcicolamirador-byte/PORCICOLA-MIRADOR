"use client";

/*
 * Pago de una factura de Bodega: método (contado / crédito), saldo y abonos.
 * Se usa en el detalle de la factura (Bodega) y en Contabilidad → Facturas a crédito.
 * Cada abono se registra como gasto en Contabilidad (si la factura lo indica).
 */

import { useState } from "react";
import { Boton, Campo, Entrada, EntradaPesos, Insignia, SeccionDesplegable } from "@/components/ui";
import { avisar, confirmar } from "@/components/Dialogo";
import { puede } from "@/lib/nube";
import {
  formatoFecha,
  formatoPesos,
  guardarFacturas,
  guardarMovimientos,
  hoy,
  leerFacturas,
  leerMovimientos,
  nuevoId,
  totalFactura,
  type AbonoFactura,
  type CategoriaBodega,
  type Factura,
  type ProductoBodega,
} from "@/lib/datos";

const num = (v: string) => {
  const n = Number(String(v).replace(",", "."));
  return Number.isFinite(n) ? n : 0;
};

/** Categoría de Contabilidad según el tipo de producto */
export const CATEGORIA_GASTO: Record<CategoriaBodega, string> = {
  Alimento: "Alimento",
  Medicamentos: "Medicamentos y vacunas",
  Vacunas: "Medicamentos y vacunas",
  Limpieza: "Otros gastos",
  Otros: "Otros gastos",
};

/** Pago de una factura de Bodega */
export default function PagoFactura({ factura: f, productos }: { factura: Factura; productos: ProductoBodega[] }) {
  const primero = productos.find((p) => p.id === f.lineas[0]?.productoId);
  return (
    <PagoCredito
      credito={f.pago === "credito"}
      total={totalFactura(f)}
      abonos={f.abonos ?? []}
      conGasto={f.registrarGasto ?? Boolean(f.movimientoId)}
      categoria={primero ? CATEGORIA_GASTO[primero.categoria] : "Otros gastos"}
      descripcionAbono={`Abono factura ${f.numero}${f.proveedor ? ` · ${f.proveedor}` : ""}`}
      onAbonos={(abonos) => guardarFacturas(leerFacturas().map((x) => (x.id === f.id ? { ...x, abonos } : x)))}
    />
  );
}

/**
 * Pago a crédito (o de contado, solo informativo): saldo, abonos y pagar saldo.
 * Cada abono se registra como gasto en Contabilidad si `conGasto`.
 */
export function PagoCredito({
  credito,
  total,
  abonos,
  conGasto,
  categoria,
  descripcionAbono,
  onAbonos,
}: {
  credito: boolean;
  total: number;
  abonos: AbonoFactura[];
  conGasto: boolean;
  categoria: string;
  descripcionAbono: string;
  onAbonos: (abonos: AbonoFactura[]) => void;
}) {
  const abonado = abonos.reduce((s, a) => s + (Number(a.monto) || 0), 0);
  const saldo = credito ? Math.max(0, total - abonado) : 0;
  const [abonando, setAbonando] = useState(false);
  const [montoAbono, setMontoAbono] = useState("");
  const [fechaAbono, setFechaAbono] = useState(hoy());
  const [errorAbono, setErrorAbono] = useState("");

  const conPermiso = () => {
    if (puede("bodega") || puede("contabilidad")) return true;
    void avisar({ titulo: "Sin permiso", mensaje: "Tu usuario no tiene permiso para registrar pagos a crédito. Pídeselo al administrador." });
    return false;
  };

  const abonar = (monto: number, fecha: string) => {
    if (!conPermiso()) return;
    if (!(monto > 0)) return setErrorAbono("Escribe el valor del abono.");
    if (monto > saldo + 0.5) return setErrorAbono(`El abono no puede ser mayor que el saldo (${formatoPesos(saldo)}).`);
    let movimientoId: string | undefined;
    if (conGasto) {
      movimientoId = nuevoId();
      guardarMovimientos([...leerMovimientos(), { id: movimientoId, fecha, tipo: "gasto", categoria, descripcion: descripcionAbono, monto }]);
    }
    onAbonos([...abonos, { id: nuevoId(), fecha, monto, movimientoId }]);
    setAbonando(false);
    setMontoAbono("");
    setFechaAbono(hoy());
    setErrorAbono("");
  };

  const pagarSaldo = async () => {
    if (!conPermiso()) return;
    if (!(await confirmar({ titulo: "Pagar saldo", mensaje: `Se registrará un pago de ${formatoPesos(saldo)} con fecha de hoy y quedará pagada.`, aceptar: "Pagar" }))) return;
    abonar(saldo, hoy());
  };

  const eliminarAbono = async (id: string) => {
    if (!conPermiso()) return;
    const a = abonos.find((x) => x.id === id);
    if (!a) return;
    if (!(await confirmar({ titulo: "Eliminar abono", mensaje: `Se quitará el abono de ${formatoPesos(a.monto)}${a.movimientoId ? " y su gasto en Contabilidad" : ""}.`, aceptar: "Eliminar", destructivo: true }))) return;
    onAbonos(abonos.filter((x) => x.id !== id));
    if (a.movimientoId) guardarMovimientos(leerMovimientos().filter((m) => m.id !== a.movimientoId));
  };


  return (
    <section className="overflow-hidden rounded-2xl bg-white ring-1 ring-slate-200/80">
      <div className="flex items-center justify-between gap-2 px-3.5 pt-3">
        <div>
          <p className="text-[11px] font-semibold uppercase tracking-wider text-slate-400">Método de pago</p>
          <p className="text-sm font-semibold text-slate-900">{credito ? "Crédito" : "Contado"}</p>
        </div>
        <Insignia clase={credito ? (saldo > 0 ? "bg-orange-50 text-orange-700 ring-orange-200" : "bg-sky-50 text-sky-700 ring-sky-200") : "bg-sky-50 text-sky-700 ring-sky-200"}>
          {credito ? (saldo > 0 ? "Con saldo" : "Pagada") : "Pagada"}
        </Insignia>
      </div>
      {credito && (
        <div className="px-3.5 pt-2.5">
          <div className="h-1.5 w-full overflow-hidden rounded-full bg-slate-100">
            <div className="h-full rounded-full bg-sky-500" style={{ width: `${total > 0 ? Math.min(100, (abonado / total) * 100) : 100}%` }} />
          </div>
          <div className="mt-1.5 flex justify-between text-xs">
            <span className="text-slate-500">
              Abonado <b className="text-slate-800 tabular-nums">{formatoPesos(abonado)}</b>
            </span>
            <span className="text-slate-500">
              Saldo <b className={`tabular-nums ${saldo > 0 ? "text-orange-600" : "text-sky-700"}`}>{formatoPesos(saldo)}</b>
            </span>
          </div>
        </div>
      )}
      {credito && abonando && (
        <form
          onSubmit={(e) => {
            e.preventDefault();
            abonar(num(montoAbono), fechaAbono);
          }}
          className="mx-3.5 mt-3 flex flex-col gap-2.5 rounded-xl bg-slate-50 p-3 ring-1 ring-slate-200"
        >
          <div className="grid grid-cols-2 gap-2">
            <Campo etiqueta="Valor del abono">
              <EntradaPesos value={montoAbono} onChange={(v) => { setMontoAbono(v); setErrorAbono(""); }} />
            </Campo>
            <Campo etiqueta="Fecha">
              <Entrada type="date" value={fechaAbono} onChange={setFechaAbono} required />
            </Campo>
          </div>
          {errorAbono && <p className="text-xs font-medium text-rose-600">{errorAbono}</p>}
          <div className="grid grid-cols-2 gap-2">
            <Boton variante="secundario" onClick={() => { setAbonando(false); setErrorAbono(""); }}>Cancelar</Boton>
            <Boton type="submit">Guardar abono</Boton>
          </div>
        </form>
      )}
      <div className="flex flex-wrap gap-2 px-3.5 py-3">
        {credito && saldo > 0 && !abonando && (
          <>
            <Boton onClick={() => conPermiso() && setAbonando(true)} className="flex-1">Registrar abono</Boton>
            <Boton variante="secundario" onClick={() => void pagarSaldo()} className="flex-1">Pagar saldo</Boton>
          </>
        )}
        {!credito && <p className="w-full text-center text-[11px] text-slate-400">Pagada de contado · el método de pago no se puede cambiar</p>}
        {credito && saldo <= 0 && <p className="w-full text-center text-[11px] text-sky-700">Crédito pagado por completo</p>}
      </div>
      {credito && abonos.length > 0 && (
        <div className="border-t border-slate-100 p-2">
          <SeccionDesplegable titulo="Abonos" cantidad={abonos.length}>
            <ul className="divide-y divide-slate-100 bg-white">
              {[...abonos].sort((a, b) => b.fecha.localeCompare(a.fecha)).map((a) => (
                <li key={a.id} className="flex items-center gap-3 px-3.5 py-2.5">
                  <div className="min-w-0 flex-1">
                    <p className="text-sm font-semibold tabular-nums text-slate-900">{formatoPesos(a.monto)}</p>
                    <p className="text-[11px] text-slate-500">{formatoFecha(a.fecha, true)}</p>
                  </div>
                  <button type="button" onClick={() => void eliminarAbono(a.id)} className="shrink-0 rounded-full px-2.5 py-1 text-xs font-medium text-rose-600 active:bg-rose-50">
                    Eliminar
                  </button>
                </li>
              ))}
            </ul>
          </SeccionDesplegable>
        </div>
      )}
    </section>
  );
}
