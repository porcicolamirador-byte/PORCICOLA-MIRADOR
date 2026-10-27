/**
 * PDF contable de un lote de engorde: estado de resultados, indicadores
 * financieros y detalle de movimientos. Solo información contable.
 */

import { ANCHO, anchoAprox, ensamblarPdf, Lienzo, partir, type LogoJpeg, type RGB } from "@/lib/pdfFicha";

const AZUL: RGB = [12, 74, 110];
const AZUL_CLARO: RGB = [240, 249, 255];
const AZUL_TEXTO: RGB = [3, 105, 161];
const ROJO_TEXTO: RGB = [190, 18, 60];
const ROJO_CLARO: RGB = [255, 241, 242];
const P900: RGB = [15, 23, 42];
const P700: RGB = [51, 65, 85];
const P500: RGB = [100, 116, 139];
const P400: RGB = [148, 163, 184];
const P200: RGB = [226, 232, 240];
const P100: RGB = [241, 245, 249];
const P50: RGB = [248, 250, 252];
const BLANCO: RGB = [255, 255, 255];

export interface MovimientoLotePdf {
  fecha: string; // AAAA-MM-DD
  /** Primer registro cuando la fila junta varios (se muestra como rango) */
  fechaDesde?: string;
  concepto: string;
  categoria: string;
  tipo: "ingreso" | "costo";
  valor: number;
}

export interface DatosPdfLote {
  granja: string;
  codigo: string;
  nombre: string;
  /** "Activo" o "Cerrado" */
  estado: string;
  fechaIngreso: string; // AAAA-MM-DD
  fechaCorte: string; // AAAA-MM-DD (hoy o fecha de cierre)
  animalesIniciales: number;
  animalesVivos: number;
  kgAlimento: number;
  registrosSinPrecio: number;
  /** Texto con el periodo de la madre cuando se incluye su contabilidad */
  notaMadre?: string;
  movimientos: MovimientoLotePdf[];
  fechaGeneracion: string; // ya formateada
  logo?: LogoJpeg | null;
}

const pesos = (v: number) => `${v < 0 ? "-" : ""}$ ${Math.abs(Math.round(v)).toLocaleString("es-CO")}`;
const fecha = (iso: string) => {
  const [a, m, d] = iso.split("-");
  return a && m && d ? `${d}/${m}/${a}` : iso;
};
const dias = (desde: string, hasta: string) => {
  const [a1, m1, d1] = desde.split("-").map(Number);
  const [a2, m2, d2] = hasta.split("-").map(Number);
  return Math.max(0, Math.round((Date.UTC(a2, m2 - 1, d2) - Date.UTC(a1, m1 - 1, d1)) / 86400000));
};

function recortar(t: string, ancho: number, tam: number, negrita = false) {
  if (anchoAprox(t, tam, negrita) <= ancho) return t;
  let s = t;
  while (s.length > 1 && anchoAprox(s + "…", tam, negrita) > ancho) s = s.slice(0, -1);
  return s + "…";
}

/** Texto alineado a la derecha en x */
const der = (L: Lienzo, x: number, y: number, t: string, tam: number, c: RGB, negrita = false) => L.texto(x - anchoAprox(t, tam, negrita), y, t, tam, c, negrita);

export function generarPdfLote(d: DatosPdfLote): Blob {
  const M = 44;
  const ANCHO_UTIL = ANCHO - 2 * M;
  const DER = ANCHO - M;

  const ingresos = d.movimientos.filter((m) => m.tipo === "ingreso");
  const costos = d.movimientos.filter((m) => m.tipo === "costo");
  const totalIngresos = ingresos.reduce((s, m) => s + m.valor, 0);
  const totalCostos = costos.reduce((s, m) => s + m.valor, 0);
  const utilidad = totalIngresos - totalCostos;
  const margen = totalIngresos > 0 ? (utilidad / totalIngresos) * 100 : null;
  const agrupar = (lista: MovimientoLotePdf[]) => {
    const mapa = new Map<string, number>();
    for (const m of lista) mapa.set(m.categoria, (mapa.get(m.categoria) ?? 0) + m.valor);
    return [...mapa.entries()].sort((a, b) => b[1] - a[1]);
  };
  const ingresosPorCat = agrupar(ingresos);
  const costosPorCat = agrupar(costos);
  const costoAlimento = costos.filter((m) => m.categoria === "Alimento").reduce((s, m) => s + m.valor, 0);

  const paginas: Lienzo[] = [];
  let L = new Lienzo();
  let y = 0;

  const titulo = (t: string) => {
    L.texto(M, y, t.toUpperCase(), 8, AZUL_TEXTO, true);
    L.linea(M, DER, y + 5, P200, 0.6);
    y += 18;
  };

  const nuevaPagina = () => {
    L = new Lienzo();
    paginas.push(L);
    L.rect(0, 0, ANCHO, 6, AZUL);
    L.texto(M, 34, `${d.codigo} · ${d.nombre}`, 10, P900, true);
    der(L, DER, 34, `Reporte contable lote ${d.codigo} (continuación)`, 8.5, P500);
    L.linea(M, DER, 44, P200, 0.6);
    y = 66;
  };

  /* ── Página 1: encabezado ── */
  paginas.push(L);
  L.rect(0, 0, ANCHO, 96, AZUL);
  if (d.logo) {
    L.rect(M, 18, 60, 60, BLANCO, 12);
    L.imagen(M + 5, 23, 50, 50);
  }
  const xt = d.logo ? M + 74 : M;
  L.texto(xt, 36, `PORCÍCOLA ${d.granja}`.toUpperCase(), 8, [186, 230, 253], true);
  L.texto(xt, 60, `Reporte contable lote ${d.codigo}`, 19, BLANCO, true);
  L.texto(xt, 77, d.nombre, 10, [224, 242, 254], true);
  der(L, DER, 36, `Generado el ${d.fechaGeneracion}`, 8, [186, 230, 253]);

  // Ficha del lote (solo datos que contextualizan las cifras)
  y = 116;
  const fichas = [
    { t: "Periodo", v: `${fecha(d.fechaIngreso)} – ${fecha(d.fechaCorte)}` },
    { t: "Duración", v: `${dias(d.fechaIngreso, d.fechaCorte)} días` },
    { t: "Estado", v: d.estado },
    { t: "Animales", v: `${d.animalesVivos} de ${d.animalesIniciales}` },
  ];
  // El periodo ocupa el doble de ancho
  const pesosCol = [2, 1, 1, 1];
  const unidad = ANCHO_UTIL / pesosCol.reduce((s, v) => s + v, 0);
  let xf = M;
  fichas.forEach((f, i) => {
    const wf = unidad * pesosCol[i];
    L.texto(xf, y, f.t.toUpperCase(), 7.5, P400, true);
    L.texto(xf, y + 13, recortar(f.v, wf - 8, 9.5, true), 9.5, P900, true);
    xf += wf;
  });
  y += 26;

  // Tarjetas resumen
  const gap = 10;
  const w = (ANCHO_UTIL - 2 * gap) / 3;
  const tarjetas = [
    { t: "Ingresos", v: pesos(totalIngresos), c: AZUL_TEXTO, f: AZUL_CLARO },
    { t: "Costos", v: pesos(totalCostos), c: P900, f: P50 },
    {
      t: margen === null ? "Resultado" : `Resultado · margen ${margen.toLocaleString("es-CO", { maximumFractionDigits: 1 })} %`,
      v: pesos(utilidad),
      c: utilidad >= 0 ? AZUL_TEXTO : ROJO_TEXTO,
      f: utilidad >= 0 ? AZUL_CLARO : ROJO_CLARO,
    },
  ];
  tarjetas.forEach((x, i) => {
    const xx = M + i * (w + gap);
    L.rect(xx, y, w, 44, x.f, 8);
    L.texto(xx + 10, y + 15, recortar(x.t, w - 20, 7.5, true).toUpperCase(), 7.5, P500, true);
    L.texto(xx + 10, y + 33, recortar(x.v, w - 20, 14, true), 14, x.c, true);
  });
  y += 64;

  /* ── Estado de resultados ── */
  titulo("Estado de resultados");
  const fila = (concepto: string, valor: string, opciones: { negrita?: boolean; sangria?: number; color?: RGB; fondo?: RGB; tam?: number } = {}) => {
    const tam = opciones.tam ?? 9;
    if (opciones.fondo) L.rect(M, y - 11, ANCHO_UTIL, 16, opciones.fondo, 4);
    L.texto(M + 8 + (opciones.sangria ?? 0), y, recortar(concepto, ANCHO_UTIL - 160, tam, opciones.negrita), tam, opciones.color ?? P700, opciones.negrita);
    der(L, DER - 8, y, valor, tam, opciones.color ?? P900, opciones.negrita);
    y += 15.5;
  };
  fila("Ingresos operacionales", "", { negrita: true, color: P900 });
  if (ingresosPorCat.length === 0) fila("Sin ingresos registrados", pesos(0), { sangria: 12, color: P500 });
  for (const [cat, v] of ingresosPorCat) fila(cat, pesos(v), { sangria: 12 });
  fila("Total ingresos", pesos(totalIngresos), { negrita: true, color: AZUL_TEXTO, fondo: AZUL_CLARO });
  y += 3;
  fila("Costos de producción", "", { negrita: true, color: P900 });
  if (costosPorCat.length === 0) fila("Sin costos registrados", pesos(0), { sangria: 12, color: P500 });
  for (const [cat, v] of costosPorCat) fila(cat, `(${pesos(v)})`, { sangria: 12 });
  fila("Total costos", `(${pesos(totalCostos)})`, { negrita: true, fondo: P100 });
  y += 6;
  L.linea(M, DER, y - 11, P900, 1);
  fila(utilidad >= 0 ? "Utilidad neta del lote" : "Pérdida neta del lote", pesos(utilidad), {
    negrita: true,
    tam: 10.5,
    color: utilidad >= 0 ? AZUL_TEXTO : ROJO_TEXTO,
  });
  L.linea(M, DER, y - 10, P900, 1);
  L.linea(M, DER, y - 8, P900, 1);
  y += 12;

  /* ── Indicadores financieros ── */
  titulo("Indicadores financieros");
  const porAnimal = (v: number) => (d.animalesVivos > 0 ? pesos(v / d.animalesVivos) : "–");
  const indicadores = [
    { t: "Costo por animal", v: porAnimal(totalCostos) },
    { t: "Ingreso por animal", v: porAnimal(totalIngresos) },
    { t: "Resultado por animal", v: porAnimal(utilidad) },
    { t: "Costo del alimento / kg", v: d.kgAlimento > 0 && costoAlimento > 0 ? pesos(costoAlimento / d.kgAlimento) : "–" },
    { t: "Participación del alimento", v: totalCostos > 0 ? `${((costoAlimento / totalCostos) * 100).toLocaleString("es-CO", { maximumFractionDigits: 1 })} %` : "–" },
    { t: "Margen sobre ingresos", v: margen === null ? "–" : `${margen.toLocaleString("es-CO", { maximumFractionDigits: 1 })} %` },
  ];
  const wi = (ANCHO_UTIL - 2 * gap) / 3;
  indicadores.forEach((x, i) => {
    const col = i % 3;
    const row = Math.floor(i / 3);
    const xx = M + col * (wi + gap);
    const yy = y + row * 38;
    L.rect(xx, yy - 10, wi, 32, P50, 6);
    L.texto(xx + 9, yy + 2, x.t, 7.5, P500);
    L.texto(xx + 9, yy + 16, recortar(x.v, wi - 18, 10.5, true), 10.5, P900, true);
  });
  y += 2 * 38 + 4;
  if (d.notaMadre) {
    for (const linea of partir(d.notaMadre, 110)) {
      L.texto(M, y, linea, 8, P500);
      y += 11;
    }
    y += 2;
  }
  if (d.registrosSinPrecio > 0) {
    L.texto(M, y, `Nota: ${d.registrosSinPrecio} consumo(s) de alimento sin precio de compra no están incluidos en los costos.`, 8, P500);
    y += 13;
  }
  y += 6;

  /* ── Detalle de movimientos ── */
  const encabezadoDetalle = () => {
    L.rect(M, y - 11, ANCHO_UTIL, 16, P100, 4);
    L.texto(M + 8, y, "FECHA", 7.5, P500, true);
    L.texto(M + 78, y, "CONCEPTO", 7.5, P500, true);
    L.texto(M + 300, y, "CATEGORÍA", 7.5, P500, true);
    der(L, DER - 8, y, "VALOR", 7.5, P500, true);
    y += 16;
  };
  if (y > 700) nuevaPagina();
  titulo(`Detalle de movimientos (${d.movimientos.length})`);
  encabezadoDetalle();
  const ordenados = [...d.movimientos].sort((a, b) => a.fecha.localeCompare(b.fecha));
  if (ordenados.length === 0) {
    L.texto(M + 8, y, "No hay movimientos registrados para este lote.", 9, P500);
    y += 18;
  }
  for (const m of ordenados) {
    if (y > 785) {
      nuevaPagina();
      encabezadoDetalle();
    }
    const valor = m.tipo === "ingreso" ? pesos(m.valor) : `(${pesos(m.valor)})`;
    const f = m.fechaDesde && m.fechaDesde !== m.fecha ? `${fecha(m.fechaDesde).slice(0, 5)}–${fecha(m.fecha).slice(0, 5)}` : fecha(m.fecha);
    L.texto(M + 8, y, f, 8.5, P500);
    L.texto(M + 78, y, recortar(m.concepto, 212, 8.5), 8.5, P900);
    L.texto(M + 300, y, recortar(m.categoria, DER - M - 300 - 100, 8.5), 8.5, P500);
    der(L, DER - 8, y, valor, 8.5, m.tipo === "ingreso" ? AZUL_TEXTO : P900, true);
    L.linea(M, DER, y + 5, P100, 0.5);
    y += 15;
  }
  if (ordenados.length > 0) {
    if (y > 790) nuevaPagina();
    y += 4;
    L.texto(M + 8, y, "Resultado del periodo", 9, P900, true);
    der(L, DER - 8, y, pesos(utilidad), 9, utilidad >= 0 ? AZUL_TEXTO : ROJO_TEXTO, true);
  }

  /* ── Pie de página ── */
  paginas.forEach((p, i) => {
    p.linea(M, DER, 806, P200, 0.6);
    p.texto(M, 822, `Porcícola ${d.granja} · Reporte contable ${d.codigo} · Cifras en pesos colombianos (COP)`, 7.5, P400);
    der(p, DER, 822, `Página ${i + 1} de ${paginas.length}`, 7.5, P400);
  });

  return ensamblarPdf(paginas, d.logo);
}
