/*
 * Arma y entrega el PDF con la contabilidad de un lote (se usa desde
 * Contabilidad y desde la ficha del lote en Engorde).
 */

import { formatoFecha, hoy, leerMovimientos, nombreLote, type Lote } from "@/lib/datos";
import { cargarLogoJpeg, entregarPdf } from "@/lib/pdfFicha";
import { generarPdfLote } from "@/lib/pdfLote";
import { nombreGranjaActual } from "@/lib/sincronizar";

export async function exportarContabilidadLote(lote: Lote) {
  const logo = await cargarLogoJpeg("/images/logo.png");
  const ingresos = leerMovimientos().filter((m) => m.tipo === "ingreso" && m.loteId === lote.id);
  const conPrecio = lote.alimento.filter((a) => Number(a.costo) > 0);
  const movimientos = [
    ...conPrecio.map((a) => ({
      fecha: a.fecha,
      concepto: a.producto ? `${a.cantidad ?? ""} ${a.unidad ?? ""} ${a.producto}`.replace(/\s+/g, " ").trim() : `Alimento ${a.kg} kg`,
      categoria: "Alimento",
      tipo: "costo" as const,
      valor: Number(a.costo) || 0,
    })),
    ...(lote.gastos ?? []).map((g) => ({
      fecha: g.fecha,
      concepto: `${g.descripcion}${g.cantidad ? ` (${g.cantidad})` : ""}`,
      categoria: g.categoria,
      tipo: "costo" as const,
      valor: g.valor,
    })),
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
