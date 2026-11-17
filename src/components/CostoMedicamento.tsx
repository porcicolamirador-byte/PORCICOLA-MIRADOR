"use client";

/*
 * Formulario corto para elegir un medicamento o vacuna de Gastos de producción,
 * la cantidad aplicada por animal y ver cuánto vale (se suma al lote).
 */

import { useEffect, useMemo, useState } from "react";
import SelectorApp from "@/components/SelectorApp";
import { Campo, CLASE_SELECTOR, Entrada } from "@/components/ui";
import { calcularInventario, convertirUnidad, formatoPesos, leerProductos, medicamentosRegistrados } from "@/lib/datos";

export interface ResultadoMedicamento {
  gastoId: string;
  nombre: string;
  cantidadAnimal: number;
  unidadDosis: string;
  animales: number;
  /** En la unidad de compra */
  cantidadUsada: number;
  costo: number;
  texto: string;
  /** Si sale de la existencia de Bodega (facturas): producto y cantidad en su unidad */
  salida?: { productoId: string; cantidad: number };
}

/** Unidad de dosis según la unidad del producto de bodega */
const unidadDe = (u: string) => (u === "ml" ? "ml" : u === "litros" ? "Litro" : u === "dosis" ? "Dosis" : u);

const fmtN = (n: number) => (Math.round(n * 100) / 100).toLocaleString("es-CO");

export default function CostoMedicamento({
  animales,
  dias = 1,
  sugerir,
  onCambiar,
  opcionIngresar = false,
  onProducto,
  ocultarDosis = false,
}: {
  animales: number;
  dias?: number;
  /** Palabra para elegir de una vez el medicamento (por ejemplo "hierro") */
  sugerir?: string;
  /** null = sin medicamento elegido; "otro" = aplicado sin costo; "ingresar" = producto que no está en la lista */
  onCambiar: (r: ResultadoMedicamento | "otro" | "ingresar" | null) => void;
  /** Agrega al final la opción para ingresar un producto que no está */
  opcionIngresar?: boolean;
  /** Avisa qué producto de Bioseguridad quedó elegido (o null) */
  onProducto?: (productoId: string | null) => void;
  /** Solo elegir el producto (sin cantidad por animal ni costo) */
  ocultarDosis?: boolean;
}) {
  const meds = useMemo(() => medicamentosRegistrados(), []);
  // Medicamentos y vacunas de Bioseguridad (gavetas): una opción por producto con todo lo disponible.
  // Se descuenta de la compra más antigua que aún tenga.
  // Todos los medicamentos y vacunas de Bioseguridad, siempre: lo comprado en Gastos de producción
  // (de la compra más antigua que alcance) y lo que entró por facturas de Bodega
  const gavetas = useMemo(() => {
    const inventario = calcularInventario();
    return leerProductos()
      .filter((p) => p.activo !== false && (p.categoria === "Medicamentos" || p.categoria === "Vacunas"))
      .map((p) => {
        const orden = meds.filter((m) => m.productoId === p.id).sort((a, b) => a.fecha.localeCompare(b.fecha));
        const item = inventario.find((i) => i.producto.id === p.id);
        const enBodega = Math.max(0, item?.disponible ?? 0);
        const precioBodega = item?.ultimoPrecio ?? 0;
        const unidad = orden[0]?.unidad ?? unidadDe(p.unidad);
        const disponible = orden.reduce((t, m) => t + m.restante, 0) + enBodega;
        return { valor: `prod:${p.id}`, productoId: p.id, nombre: p.nombre, unidad, disponible, orden, enBodega, precioBodega };
      })
      .sort((a, b) => Number(b.disponible > 0) - Number(a.disponible > 0) || a.nombre.localeCompare(b.nombre, "es"));
  }, [meds]);
  const sueltos = meds.filter((m) => !m.productoId);
  const [medId, setMedId] = useState(() => {
    if (!sugerir) return "";
    const s = sugerir.toLowerCase();
    return gavetas.find((g) => g.nombre.toLowerCase().includes(s) && g.disponible > 0)?.valor ?? sueltos.find((m) => m.nombre.toLowerCase().includes(s))?.id ?? "";
  });
  const [porAnimal, setPorAnimal] = useState("");
  const [unidadDosis, setUnidadDosis] = useState("");
  const gaveta = gavetas.find((g) => g.valor === medId);
  // De dónde sale esta aplicación: la compra más antigua que alcance; si no, la bodega; si no, la compra con algo
  const fuente = (() => {
    if (!gaveta) return undefined;
    const c = Number(porAnimal.replace(",", ".")) || 0;
    const uSel = unidadDosis || gaveta.unidad;
    const necesario = c > 0 ? convertirUnidad(c * animales * Math.max(1, dias), uSel, gaveta.unidad) : 0;
    const compra = gaveta.orden.find((m) => m.restante >= necesario && m.restante > 0);
    if (compra) return { tipo: "compra" as const, compra };
    if (gaveta.enBodega > 0 && gaveta.precioBodega > 0) return { tipo: "bodega" as const };
    const conAlgo = gaveta.orden.find((m) => m.restante > 0) ?? gaveta.orden[gaveta.orden.length - 1];
    return conAlgo ? { tipo: "compra" as const, compra: conAlgo } : undefined;
  })();
  const med = gaveta
    ? fuente?.tipo === "compra"
      ? { ...fuente.compra, nombre: gaveta.nombre }
      : fuente?.tipo === "bodega"
        ? { id: "", nombre: gaveta.nombre, unidad: gaveta.unidad, valorUnitario: gaveta.precioBodega, restante: gaveta.enBodega }
        : undefined
    : meds.find((m) => m.id === medId);
  const sinExistencia = Boolean(gaveta && !med);
  useEffect(() => {
    onProducto?.(gaveta?.productoId ?? null);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [gaveta?.productoId]);
  const unidades = med ? (med.unidad === "ml" || med.unidad === "Litro" ? ["ml", "Litro"] : [med.unidad]) : [];
  const u = unidadDosis && unidades.includes(unidadDosis) ? unidadDosis : med?.unidad ?? "";
  const cant = Number(porAnimal.replace(",", ".")) || 0;
  const nDias = Math.max(1, dias);
  const usado = med && cant > 0 ? convertirUnidad(cant * animales * nDias, u, med.unidad) : 0;
  const costo = med && usado > 0 ? Math.round(usado * med.valorUnitario) : 0;

  useEffect(() => {
    if (medId === "OTRO") return onCambiar("otro");
    if (medId === "INGRESAR") return onCambiar("ingresar");
    if (!med || !(cant > 0) || !(usado > 0)) return onCambiar(null);
    onCambiar({
      ...(fuente?.tipo === "bodega" && gaveta ? { salida: { productoId: gaveta.productoId, cantidad: Math.round(usado * 1000) / 1000 } } : {}),
      gastoId: med.id,
      nombre: med.nombre,
      cantidadAnimal: cant,
      unidadDosis: u,
      animales,
      cantidadUsada: usado,
      costo,
      texto: `${fmtN(cant)} ${u} × ${animales} ${animales === 1 ? "animal" : "animales"}${nDias > 1 ? ` × ${nDias} días` : ""} · ${formatoPesos(costo)}`,
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [medId, med?.id, fuente?.tipo, cant, u, animales, nDias]);

  return (
    <div className="flex flex-col gap-3">
      <Campo etiqueta="Medicamento aplicado *">
        <SelectorApp
          valor={medId}
          onCambiar={(v) => {
            setMedId(v);
            setUnidadDosis("");
          }}
          titulo="Medicamento aplicado"
          placeholder={meds.length ? "Elige el medicamento o vacuna" : "Sin medicamentos ni vacunas registrados"}
          opciones={[
            ...gavetas.map((g) => ({
              valor: g.valor,
              texto: g.nombre,
              detalle: g.disponible > 0 ? `disponible ${fmtN(g.disponible)} ${g.unidad}` : "sin existencia",
            })),
            ...sueltos.map((m) => ({ valor: m.id, texto: `${m.nombre} · ${formatoPesos(m.valorUnitario)}/${m.unidad}`, detalle: `quedan ${fmtN(m.restante)} ${m.unidad}` })),
            { valor: "OTRO", texto: "Otro (sin costo)" },
            ...(opcionIngresar ? [{ valor: "INGRESAR", texto: "➕ Ingresar producto (no está en la lista)" }] : []),
          ]}
          className="w-full"
          claseBoton={CLASE_SELECTOR}
        />
      </Campo>
      {!ocultarDosis && sinExistencia && (
        <p className="rounded-xl bg-amber-50 px-3 py-2.5 text-xs font-medium text-amber-800 ring-1 ring-amber-100">
          {gaveta?.nombre} no tiene existencia. Regístralo en Bioseguridad o ingrésalo con su valor.
        </p>
      )}
      {med && !ocultarDosis && (
        <>
          <div className="grid grid-cols-2 gap-3">
            <Campo etiqueta="Cantidad por animal *">
              <Entrada type="number" inputMode="decimal" value={porAnimal} onChange={(v) => setPorAnimal(v.slice(0, 8))} />
            </Campo>
            <Campo etiqueta="Unidad">
              <div className={`grid gap-1 rounded-2xl bg-slate-100 p-1 ${unidades.length > 1 ? "grid-cols-2" : "grid-cols-1"}`} role="radiogroup" aria-label="Unidad">
                {unidades.map((x) => (
                  <button
                    key={x}
                    type="button"
                    role="radio"
                    aria-checked={u === x}
                    onClick={() => setUnidadDosis(x)}
                    className={`rounded-xl py-2 text-sm font-semibold transition ${u === x ? "bg-white text-slate-900 shadow-sm" : "text-slate-500"}`}
                  >
                    {x}
                  </button>
                ))}
              </div>
            </Campo>
          </div>
          {cant > 0 && (
            <div className="flex flex-col gap-1 rounded-2xl bg-sky-50 px-4 py-3 ring-1 ring-sky-100">
              <div className="flex items-center justify-between text-sm text-sky-900">
                <span>
                  {fmtN(cant)} {u} × {animales} {animales === 1 ? "animal" : "animales"}
                  {nDias > 1 ? ` × ${nDias} días` : ""}
                </span>
                <span className="font-semibold tabular-nums">
                  {fmtN(usado)} {med.unidad}
                </span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-sm text-sky-900">Costo que se suma al lote</span>
                <span className="text-lg font-bold tabular-nums text-sky-900">{formatoPesos(costo)}</span>
              </div>
              {usado > (gaveta ? gaveta.disponible : med.restante) + 1e-9 && (
                <p className="text-xs font-medium text-amber-700">
                  Solo hay {fmtN(gaveta ? gaveta.disponible : med.restante)} {med.unidad} disponibles{gaveta ? "" : " de esta compra"}.
                </p>
              )}
            </div>
          )}
        </>
      )}
    </div>
  );
}
