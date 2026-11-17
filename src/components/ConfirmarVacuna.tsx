"use client";

/*
 * Confirmar la aplicación de una vacuna a la camada (RespiSure-ONE, Fostera Gold PCV…),
 * como el hierro: se elige el producto de Bioseguridad y se calcula su costo,
 * o se ingresa el producto aplicado con su valor (y se elige si va a Contabilidad).
 */

import { useState } from "react";
import Modal from "@/components/Modal";
import { Boton, Campo, CLASE_SELECTOR, Entrada, EntradaPesos } from "@/components/ui";
import SelectorApp from "@/components/SelectorApp";
import CostoMedicamento, { type ResultadoMedicamento } from "@/components/CostoMedicamento";
import {
  confirmarVacunaParto,
  FACTURA_GENERAL,
  formatoPesos,
  hoy,
  leerProductos,
  loteDelParto,
  nombreLote,
  registrarGastoProduccion,
  registrarTratamientoLote,
} from "@/lib/datos";

const unidadGasto = (u: string) => (u === "ml" ? "ml" : u === "litros" ? "Litro" : "Dosis");

export default function ConfirmarVacuna({
  cerdaId,
  codigoParto,
  vacuna,
  nombre,
  onCerrar,
}: {
  cerdaId: string;
  codigoParto: string;
  /** Clave de la vacuna (respisure, fostera) */
  vacuna: string;
  /** Nombre de la vacuna, p. ej. "RespiSure-ONE" */
  nombre: string;
  onCerrar: () => void;
}) {
  const lote = loteDelParto(codigoParto);
  const animales = lote?.vivos ?? 0;
  const [modo, setModo] = useState<"bodega" | "ingresar">("bodega");
  const [med, setMed] = useState<ResultadoMedicamento | "otro" | null>(null);
  // Ingresar el producto aplicado
  const productos = leerProductos()
    .filter((p) => p.activo !== false && (p.categoria === "Vacunas" || p.categoria === "Medicamentos"))
    .sort((a, b) => a.nombre.localeCompare(b.nombre, "es"));
  const clave = nombre.toLowerCase().split(/[\s-]/)[0];
  const [productoId, setProductoId] = useState(() => productos.find((p) => p.nombre.toLowerCase().includes(clave))?.id ?? "");
  const [cantidad, setCantidad] = useState("");
  const [valor, setValor] = useState("");
  const [contable, setContable] = useState(true);
  const producto = productos.find((p) => p.id === productoId);
  const cantidadNum = Number(cantidad.replace(",", ".")) || 0;
  const monto = Number(valor.replace(/\D/g, "")) || 0;
  const puedeIngresar = Boolean(producto && cantidadNum > 0 && monto > 0 && animales > 0);

  const confirmarBodega = () => {
    if (!lote) return;
    if (med && med !== "otro") {
      const tratamientoId = registrarTratamientoLote(lote.id, med, `Vacuna ${nombre}`);
      confirmarVacunaParto(cerdaId, codigoParto, vacuna, { costo: med.costo, nota: `${med.nombre} · ${med.texto}`, tratamientoId });
    } else {
      confirmarVacunaParto(cerdaId, codigoParto, vacuna);
    }
    onCerrar();
  };

  const confirmarIngresado = () => {
    if (!lote || !producto) return;
    const unidad = unidadGasto(producto.unidad);
    const [nom, marca] = producto.nombre.split(" · ");
    // Con Contabilidad: queda como compra de Gastos de producción (en su gaveta) y se usa toda en esta aplicación
    let gastoId = "";
    if (contable) {
      const id = registrarGastoProduccion({
        descripcion: nom,
        marca: marca ?? "",
        cantidad,
        unidad,
        valor: monto,
        categoria: "Medicamentos y vacunas",
        fecha: hoy(),
        pago: "contado",
        factura: FACTURA_GENERAL,
        productoId: producto.id,
      });
      if (!id) return;
      gastoId = id;
    }
    const texto = `${cantidadNum.toLocaleString("es-CO")} ${unidad} × ${animales} animales · ${formatoPesos(monto)}${contable ? "" : " · sin contabilidad"}`;
    const tratamientoId = registrarTratamientoLote(
      lote.id,
      { gastoId, nombre: producto.nombre, cantidadAnimal: cantidadNum / animales, unidadDosis: unidad, animales, cantidadUsada: cantidadNum, costo: monto },
      `Vacuna ${nombre}`,
    );
    confirmarVacunaParto(cerdaId, codigoParto, vacuna, { costo: monto, nota: `${producto.nombre} · ${texto}`, tratamientoId });
    onCerrar();
  };

  return (
    <Modal
      abierta
      etiqueta="Sanidad de la camada"
      titulo={`Vacuna ${nombre}`}
      subtitulo={lote ? `${nombreLote(lote)} · cerda ${cerdaId}` : `Camada ${codigoParto}`}
      icono="💉"
      onCerrar={onCerrar}
    >
      {!lote ? (
        <p className="rounded-xl bg-rose-50 px-3 py-3 text-sm text-rose-700 ring-1 ring-rose-100">No se encontró el lote de esta camada en la granja actual.</p>
      ) : (
        <div className="flex flex-col gap-3">
          <p className="text-sm text-slate-600">
            Confirma que hoy se aplicó {nombre} a los <b>{animales}</b> lechones de este lote. Quedará registrado en el lote con la fecha y la hora.
          </p>
          <div className="grid grid-cols-2 gap-1 rounded-2xl bg-slate-100 p-1" role="radiogroup" aria-label="Producto">
            {(["bodega", "ingresar"] as const).map((m) => (
              <button
                key={m}
                type="button"
                role="radio"
                aria-checked={modo === m}
                onClick={() => setModo(m)}
                className={`rounded-xl py-2 text-sm font-semibold transition ${modo === m ? "bg-white text-slate-900 shadow-sm" : "text-slate-500"}`}
              >
                {m === "bodega" ? "De Bioseguridad" : "Ingresar producto"}
              </button>
            ))}
          </div>

          {modo === "bodega" ? (
            <>
              <CostoMedicamento key={lote.id} animales={animales} sugerir={clave} onCambiar={setMed} />
              <Boton disabled={!med} onClick={confirmarBodega} className="w-full py-3">
                Confirmar aplicación
              </Boton>
            </>
          ) : (
            <>
              <Campo etiqueta="Producto aplicado *">
                <SelectorApp
                  valor={productoId}
                  onCambiar={setProductoId}
                  titulo="Producto aplicado"
                  placeholder="Elige el producto"
                  buscar
                  opciones={productos.map((p) => ({ valor: p.id, texto: p.nombre }))}
                  className="w-full"
                  claseBoton={CLASE_SELECTOR}
                />
              </Campo>
              <div className="grid grid-cols-2 gap-3">
                <Campo etiqueta={`Cantidad total${producto ? ` (${unidadGasto(producto.unidad)})` : ""} *`}>
                  <Entrada type="number" inputMode="decimal" value={cantidad} onChange={(v) => setCantidad(v.slice(0, 10))} />
                </Campo>
                <Campo etiqueta="Valor total *">
                  <EntradaPesos value={valor} onChange={setValor} />
                </Campo>
              </div>
              <button
                type="button"
                role="switch"
                aria-checked={contable}
                onClick={() => setContable((c) => !c)}
                className="flex items-center justify-between gap-3 rounded-2xl bg-slate-50 px-3.5 py-3 text-left ring-1 ring-slate-200"
              >
                <span className="min-w-0">
                  <span className="block text-sm font-semibold text-slate-900">Agregar a Contabilidad</span>
                  <span className="block text-xs text-slate-500">
                    {contable ? "Se registra como gasto (factura general) y entra a la gaveta del producto." : "Solo se suma al costo del lote; no va a Contabilidad."}
                  </span>
                </span>
                <span className={`relative h-6 w-11 shrink-0 rounded-full transition ${contable ? "bg-sky-600" : "bg-slate-300"}`} aria-hidden="true">
                  <span className={`absolute top-0.5 h-5 w-5 rounded-full bg-white shadow transition ${contable ? "left-[22px]" : "left-0.5"}`} />
                </span>
              </button>
              {monto > 0 && (
                <div className="flex items-center justify-between rounded-2xl bg-sky-50 px-4 py-2.5 ring-1 ring-sky-100">
                  <span className="text-sm text-sky-900">Costo que se suma al lote</span>
                  <span className="text-lg font-bold tabular-nums text-sky-900">{formatoPesos(monto)}</span>
                </div>
              )}
              <Boton disabled={!puedeIngresar} onClick={confirmarIngresado} className="w-full py-3">
                Confirmar aplicación
              </Boton>
            </>
          )}
          <Boton variante="secundario" onClick={onCerrar} className="w-full">
            Cancelar
          </Boton>
        </div>
      )}
    </Modal>
  );
}
