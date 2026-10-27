/*
 * Arma y entrega el PDF con la contabilidad de un lote (se usa desde
 * Contabilidad y desde la ficha del lote en Engorde).
 */

import { formatoFecha, hoy, leerMovimientos, nombreLote, type Alimento, type GastoLote, type Lote } from "@/lib/datos";
import type { MovimientoLotePdf } from "@/lib/pdfLote";
import { cargarLogoJpeg, entregarPdf } from "@/lib/pdfFicha";
import { generarPdfLote } from "@/lib/pdfLote";
import { nombreGranjaActual } from "@/lib/sincronizar";

export async function exportarContabilidadLote(lote: Lote) {
  const logo = await cargarLogoJpeg("/images/logo.png");
  const ingresos = leerMovimientos().filter((m) => m.tipo === "ingreso" && m.loteId === lote.id);
  const conPrecio = lote.alimento.filter((a) => Number(a.costo) > 0);
  const movimientos = [
    ...agruparAlimento(conPrecio),
    ...agruparGastos(lote.gastos ?? []),
    ...ingresos.map((m) => ({
      fecha: m.fecha,
      concepto: m.descripcion.replace(` · ${nombreLote(lote)}`, "") || m.categoria,
      categoria: m.categoria,
      tipo: "ingreso" as const,
      valor: m.monto,
    })),
  ];
  const blob = generarPdfLote({
    granja: nombreGranjaActual(),
    codigo: lote.codigo ?? "Lote",
    nombre: lote.nombre && lote.nombre !== lote.codigo ? lote.nombre : `${lote.cantidadInicial} animales`,
    estado: lote.activo ? "Activo" : "Cerrado",
    fechaIngreso: lote.fechaIngreso,
    fechaCorte: lote.activo ? hoy() : lote.fechaSalida || hoy(),
    animalesIniciales: lote.cantidadInicial,
    animalesVivos: lote.vivos,
    kgAlimento: conPrecio.reduce((s, a) => s + (Number(a.kg) || 0), 0),
    registrosSinPrecio: lote.alimento.length - conPrecio.length,
    movimientos,
    fechaGeneracion: formatoFecha(hoy()),
    logo,
  });
  await entregarPdf(blob, `contabilidad-${(lote.codigo ?? "lote").toLowerCase()}-${hoy()}.pdf`);
}

const numero = (n: number) => (Math.round(n * 100) / 100).toLocaleString("es-CO");
const clave = (t: string) => t.trim().toLowerCase().replace(/\s+/g, " ");
const plural = (u: string, n: number) => (n > 1 && u.length > 2 && !/s$/i.test(u) ? `${u}s` : u);
const sufijo = (n: number) => (n > 1 ? ` · ${n} registros` : "");

interface Grupo<T> {
  items: T[];
  desde: string;
  hasta: string;
}

function agrupar<T extends { fecha: string }>(lista: T[], llave: (x: T) => string) {
  const grupos = new Map<string, Grupo<T>>();
  for (const x of lista) {
    const k = llave(x);
    const g = grupos.get(k);
    if (!g) grupos.set(k, { items: [x], desde: x.fecha, hasta: x.fecha });
    else {
      g.items.push(x);
      if (x.fecha < g.desde) g.desde = x.fecha;
      if (x.fecha > g.hasta) g.hasta = x.fecha;
    }
  }
  return [...grupos.values()];
}

/** Junta el alimento del mismo producto: suma cantidades, kilos y valor */
function agruparAlimento(lista: Alimento[]): MovimientoLotePdf[] {
  return agrupar(lista, (a) => `${a.productoId || clave(a.producto ?? "alimento")}|${clave(a.unidad ?? "")}`).map((g) => {
    const p = g.items[0];
    const valor = g.items.reduce((s, a) => s + (Number(a.costo) || 0), 0);
    const kg = g.items.reduce((s, a) => s + (Number(a.kg) || 0), 0);
    const cantidad = g.items.reduce((s, a) => s + (Number(a.cantidad) || 0), 0);
    const concepto = p.producto
      ? `${cantidad > 0 ? `${numero(cantidad)} ${plural(p.unidad ?? "", cantidad)} ` : ""}${p.producto}`.replace(/\s+/g, " ").trim()
      : `Alimento ${numero(kg)} kg`;
    return { fecha: g.hasta, fechaDesde: g.desde, concepto: concepto + sufijo(g.items.length), categoria: "Alimento", tipo: "costo" as const, valor };
  });
}

/** Junta los otros gastos con la misma descripción y categoría */
function agruparGastos(lista: GastoLote[]): MovimientoLotePdf[] {
  return agrupar(lista, (g) => `${clave(g.descripcion)}|${clave(g.categoria)}`).map((g) => {
    const p = g.items[0];
    const valor = g.items.reduce((s, x) => s + (Number(x.valor) || 0), 0);
    // Cantidades escritas como "2 frascos": se suman si todas tienen la misma unidad
    const partes = g.items.map((x) => /^\s*(\d+(?:[.,]\d+)?)\s*(.*)$/.exec(x.cantidad ?? ""));
    let cantidad = "";
    if (partes.every((m) => m) && new Set(partes.map((m) => clave(m![2]))).size === 1) {
      const total = partes.reduce((s, m) => s + Number(m![1].replace(",", ".")), 0);
      cantidad = `${numero(total)} ${partes[0]![2]}`.trim();
    } else if (g.items.length === 1 && p.cantidad) cantidad = p.cantidad;
    return {
      fecha: g.hasta,
      fechaDesde: g.desde,
      concepto: `${p.descripcion}${cantidad ? ` (${cantidad})` : ""}${sufijo(g.items.length)}`,
      categoria: p.categoria,
      tipo: "costo" as const,
      valor,
    };
  });
}
