/*
 * Arma y entrega el PDF con la contabilidad de un lote (se usa desde
 * Contabilidad y desde la ficha del lote en Engorde).
 */

import {
  calcularInventario,
  codigoDe,
  diasEntre,
  factorKg,
  formatoFecha,
  hoy,
  leerCerdas,
  leerHistorial,
  leerMovimientos,
  leerProductos,
  nombreLote,
  sumarDias,
  type Alimento,
  type GastoLote,
  type Lote,
} from "@/lib/datos";
import { leerConfig } from "@/lib/config";
import type { MovimientoLotePdf } from "@/lib/pdfLote";
import { cargarLogoJpeg, entregarPdf } from "@/lib/pdfFicha";
import { generarPdfLote } from "@/lib/pdfLote";
import { nombreGranjaActual } from "@/lib/sincronizar";

/** El lote viene de un parto: se puede agregar la contabilidad de su madre */
export const loteTieneMadre = (lote: Lote) => Boolean(lote.origen?.cerdaId && leerCerdas().some((c) => c.id === lote.origen!.cerdaId));

export async function exportarContabilidadLote(lote: Lote, opciones: { incluirMadre?: boolean } = {}) {
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
  const madre = opciones.incluirMadre ? contabilidadMadre(lote) : null;
  if (madre) movimientos.push(...madre.movimientos);
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
    notaMadre: madre?.nota,
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

/*
 * Contabilidad de la madre del lote: del destete anterior al parto hasta el
 * destete siguiente (o hoy si aún no se desteta). Incluye:
 *  - alimento estimado día a día según su estado (mismas reglas del consumo de
 *    cerdas en Ajustes) valorado al último precio de compra del producto;
 *  - genética de las inseminaciones del periodo;
 *  - otros gastos de Contabilidad registrados a nombre de la cerda.
 */
function contabilidadMadre(lote: Lote): { movimientos: MovimientoLotePdf[]; nota: string } | null {
  const cerdaId = lote.origen?.cerdaId;
  if (!cerdaId) return null;
  const historial = leerHistorial(cerdaId)
    .filter((h) => h && typeof h.fecha === "string")
    .sort((a, b) => b.fecha.localeCompare(a.fecha));
  const parto = historial.find((h) => h.tipo === "Parto" && String((h as { codigoParto?: unknown }).codigoParto ?? "") === String(lote.origen?.codigoParto ?? ""));
  const fechaParto = parto?.fecha ?? lote.fechaIngreso;
  const desteteAntes = historial.find((h) => h.tipo === "Destete" && h.fecha < fechaParto);
  const desteteDespues = [...historial].reverse().find((h) => h.tipo === "Destete" && h.fecha > fechaParto);
  const cerda = leerCerdas().find((c) => c.id === cerdaId) as { fecha?: string } | undefined;
  const primero = historial[historial.length - 1]?.fecha;
  const desde = desteteAntes?.fecha ?? cerda?.fecha ?? primero ?? fechaParto;
  const hasta = desteteDespues?.fecha ?? hoy();
  const enPeriodo = (f: string) => f >= desde && f <= hasta;
  const movimientos: MovimientoLotePdf[] = [];

  // Alimento estimado día a día
  const reglas = leerConfig().consumoCerdas;
  const productos = leerProductos();
  const inventario = calcularInventario();
  const precioKg = (codigo: string) => {
    const conCodigo = productos.filter((p) => codigoDe(p) === codigo);
    const p = conCodigo.find((x) => x.unidad === "bultos") ?? conCodigo[0];
    const item = p ? inventario.find((i) => i.producto.id === p.id) : undefined;
    return item && item.ultimoPrecio > 0 ? item.ultimoPrecio / factorKg(item.producto) : 0;
  };
  const precioG = precioKg(reglas.codigoGestacion);
  const precioL = precioKg(reglas.codigoLactancia);
  const asc = [...historial].reverse();
  let kgG = 0;
  let kgL = 0;
  // El día del destete final ya es del ciclo siguiente (no se cuenta dos veces)
  const ultimoDia = desteteDespues ? sumarDias(hasta, -1) : hasta;
  for (let f = desde; f <= ultimoDia; f = sumarDias(f, 1)) {
    let ultimo: (typeof historial)[number] | undefined;
    for (const h of asc) if (h.fecha <= f) ultimo = h;
    if (ultimo?.tipo === "Baja") continue;
    if (ultimo?.tipo === "Parto") kgL += reglas.lactancia;
    else if (ultimo?.tipo === "Inseminación" && diasEntre(ultimo.fecha, f) >= reglas.diaCambio) kgL += reglas.preparto;
    else kgG += reglas.gestacion;
  }
  const kgTxt = (n: number) => `${numero(n)} kg`;
  if (kgG > 0) movimientos.push({ fecha: hasta, fechaDesde: desde, concepto: `Alimento gestación (estimado) · ${kgTxt(kgG)}`, categoria: "Madre · alimento", tipo: "costo", valor: Math.round(kgG * precioG) });
  if (kgL > 0) movimientos.push({ fecha: hasta, fechaDesde: desde, concepto: `Alimento lactancia (estimado) · ${kgTxt(kgL)}`, categoria: "Madre · alimento", tipo: "costo", valor: Math.round(kgL * precioL) });

  // Genética de las inseminaciones del periodo
  for (const h of historial) {
    const valor = Number((h as { valorGenetica?: unknown }).valorGenetica) || 0;
    if (h.tipo === "Inseminación" && valor > 0 && enPeriodo(h.fecha)) {
      movimientos.push({ fecha: h.fecha, concepto: `Genética · inseminación`, categoria: "Madre · genética", tipo: "costo", valor });
    }
  }

  // Otros gastos de Contabilidad a nombre de la cerda (la genética ya va arriba)
  for (const m of leerMovimientos()) {
    if (m.tipo === "gasto" && m.cerdaId === cerdaId && m.categoria !== "Genética" && enPeriodo(m.fecha)) {
      movimientos.push({ fecha: m.fecha, concepto: m.descripcion || m.categoria, categoria: "Madre · otros gastos", tipo: "costo", valor: m.monto });
    }
  }

  const sinPrecio = (kgG > 0 && precioG === 0) || (kgL > 0 && precioL === 0);
  const nota =
    `Incluye la contabilidad de la madre (cerda ${cerdaId}) del ${formatoFecha(desde, true)} al ${formatoFecha(hasta, true)}` +
    `${desteteAntes ? " (del destete anterior" : " (desde su llegada"}${desteteDespues ? " al destete de esta camada)" : " hasta hoy; aún sin destete)"}. ` +
    `El alimento es estimado según las reglas de consumo de cerdas y el último precio de compra.` +
    (sinPrecio ? " Hay alimento sin precio de compra: se valoró en $0." : "");
  return { movimientos, nota };
}
