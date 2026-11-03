/**
 * Otros formatos del reporte contable del lote (mismos datos que pdfLote):
 *  - "ejecutivo": una página de resumen con la composición de los costos en barras.
 *  - "clasico": estilo libro contable, en blanco y negro, para imprimir.
 *  - "animal": todo expresado por animal (costo por categoría y por cabeza).
 */

import { ANCHO, anchoAprox, ensamblarPdf, Lienzo, partir, type RGB } from "@/lib/pdfFicha";
import type { DatosPdfLote, MovimientoLotePdf } from "@/lib/pdfLote";

const AZUL: RGB = [12, 74, 110];
const AZUL_MEDIO: RGB = [2, 132, 199];
const AZUL_CLARO: RGB = [240, 249, 255];
const AZUL_TEXTO: RGB = [3, 105, 161];
const NARANJA: RGB = [234, 88, 12];
const ROJO: RGB = [190, 18, 60];
const VERDE: RGB = [21, 128, 61];
const NEGRO: RGB = [17, 17, 17];
const G700: RGB = [64, 64, 64];
const G500: RGB = [115, 115, 115];
const G300: RGB = [212, 212, 212];
const G100: RGB = [245, 245, 245];
const P900: RGB = [15, 23, 42];
const P500: RGB = [100, 116, 139];
const P400: RGB = [148, 163, 184];
const P200: RGB = [226, 232, 240];
const P100: RGB = [241, 245, 249];
const P50: RGB = [248, 250, 252];
const BLANCO: RGB = [255, 255, 255];
/** Colores de las barras por categoría */
const PALETA: RGB[] = [AZUL, AZUL_MEDIO, [14, 165, 233], NARANJA, [251, 146, 60], [100, 116, 139], [148, 163, 184]];

export type FormatoReporteLote = "estandar" | "ejecutivo" | "clasico" | "animal";

export const FORMATOS_REPORTE_LOTE: { valor: FormatoReporteLote; nombre: string; detalle: string }[] = [
  { valor: "estandar", nombre: "Estándar", detalle: "Estado de resultados, indicadores y detalle" },
  { valor: "ejecutivo", nombre: "Ejecutivo", detalle: "Una página con la composición de costos en barras" },
  { valor: "clasico", nombre: "Libro contable", detalle: "Blanco y negro, tipo libro, para imprimir" },
  { valor: "animal", nombre: "Por animal", detalle: "Costo de cada categoría por cabeza" },
];

const M = 44;
const DER = ANCHO - M;
const UTIL = ANCHO - 2 * M;

const pesos = (v: number) => `${v < 0 ? "-" : ""}$ ${Math.abs(Math.round(v)).toLocaleString("es-CO")}`;
const fecha = (iso: string) => {
  const [a, m, d] = iso.split("-");
  return a && m && d ? `${d}/${m}/${a}` : iso;
};
const fechaMov = (m: MovimientoLotePdf) =>
  m.fechaDesde && m.fechaDesde !== m.fecha ? `${fecha(m.fechaDesde).slice(0, 5)}–${fecha(m.fecha).slice(0, 5)}` : fecha(m.fecha);
const dias = (desde: string, hasta: string) => {
  const [a1, m1, d1] = desde.split("-").map(Number);
  const [a2, m2, d2] = hasta.split("-").map(Number);
  return Math.max(0, Math.round((Date.UTC(a2, m2 - 1, d2) - Date.UTC(a1, m1 - 1, d1)) / 86400000));
};
const pct = (v: number) => `${v.toLocaleString("es-CO", { maximumFractionDigits: 1 })} %`;
function recortar(t: string, ancho: number, tam: number, negrita = false) {
  if (anchoAprox(t, tam, negrita) <= ancho) return t;
  let s = t;
  while (s.length > 1 && anchoAprox(s + "…", tam, negrita) > ancho) s = s.slice(0, -1);
  return s + "…";
}
const der = (L: Lienzo, x: number, y: number, t: string, tam: number, c: RGB, negrita = false) => L.texto(x - anchoAprox(t, tam, negrita), y, t, tam, c, negrita);
const centro = (L: Lienzo, x: number, y: number, t: string, tam: number, c: RGB, negrita = false) =>
  L.texto(x - anchoAprox(t, tam, negrita) / 2, y, t, tam, c, negrita);

function cifras(d: DatosPdfLote) {
  const ingresos = d.movimientos.filter((m) => m.tipo === "ingreso");
  const costos = d.movimientos.filter((m) => m.tipo === "costo");
  const totalIngresos = ingresos.reduce((s, m) => s + m.valor, 0);
  const totalCostos = costos.reduce((s, m) => s + m.valor, 0);
  const porCat = (lista: MovimientoLotePdf[]) => {
    const mapa = new Map<string, number>();
    for (const m of lista) mapa.set(m.categoria, (mapa.get(m.categoria) ?? 0) + m.valor);
    return [...mapa.entries()].sort((a, b) => b[1] - a[1]);
  };
  const costoMadre = costos.filter((m) => m.categoria.startsWith("Madre")).reduce((s, m) => s + m.valor, 0);
  return {
    ingresos,
    costos,
    totalIngresos,
    totalCostos,
    utilidad: totalIngresos - totalCostos,
    ingresosPorCat: porCat(ingresos),
    costosPorCat: porCat(costos),
    costoMadre,
    costoLote: totalCostos - costoMadre,
    animales: Math.max(0, d.animalesVivos),
  };
}

function pies(paginas: Lienzo[], d: DatosPdfLote, color: RGB) {
  paginas.forEach((p, i) => {
    p.linea(M, DER, 806, P200, 0.6);
    p.texto(M, 822, `Porcícola ${d.granja} · Reporte contable ${d.codigo} · Generado el ${d.fechaGeneracion}`, 7.5, color);
    der(p, DER, 822, `Página ${i + 1} de ${paginas.length}`, 7.5, color);
  });
}

/** Tabla de movimientos (se usa en el ejecutivo y en el clásico) */
function tablaMovimientos(
  paginas: Lienzo[],
  inicio: { L: Lienzo; y: number },
  d: DatosPdfLote,
  estilo: { fondoEncabezado: RGB; texto: RGB; tenue: RGB; linea: RGB; ingreso: RGB },
  nuevaPagina: () => { L: Lienzo; y: number },
) {
  let { L, y } = inicio;
  const encabezado = () => {
    L.rect(M, y - 12, UTIL, 18, estilo.fondoEncabezado, 3);
    L.texto(M + 8, y, "FECHA", 7, estilo.tenue, true);
    L.texto(M + 78, y, "CONCEPTO", 7, estilo.tenue, true);
    L.texto(M + 300, y, "CATEGORÍA", 7, estilo.tenue, true);
    der(L, DER - 8, y, "VALOR", 7, estilo.tenue, true);
    y += 16;
  };
  encabezado();
  const orden = [...d.movimientos].sort((a, b) => a.fecha.localeCompare(b.fecha));
  for (const m of orden) {
    if (y > 785) {
      ({ L, y } = nuevaPagina());
      encabezado();
    }
    L.texto(M + 8, y, fechaMov(m), 8, estilo.tenue);
    L.texto(M + 78, y, recortar(m.concepto, 214, 8), 8, estilo.texto);
    L.texto(M + 300, y, recortar(m.categoria, DER - M - 300 - 90, 8), 8, estilo.tenue);
    der(L, DER - 8, y, m.tipo === "ingreso" ? pesos(m.valor) : `(${pesos(m.valor)})`, 8, m.tipo === "ingreso" ? estilo.ingreso : estilo.texto, true);
    L.linea(M, DER, y + 5, estilo.linea, 0.4);
    y += 14;
  }
  if (orden.length === 0) {
    L.texto(M + 8, y, "No hay movimientos registrados para este lote.", 8.5, estilo.tenue);
    y += 14;
  }
  return { L, y };
}

/* ═════════════ Ejecutivo: una página, composición de costos ═════════════ */

function ejecutivo(d: DatosPdfLote): Blob {
  const c = cifras(d);
  const paginas: Lienzo[] = [];
  let L = new Lienzo();
  paginas.push(L);

  // Encabezado claro con franja lateral
  L.rect(0, 0, 8, 842, AZUL);
  if (d.logo) {
    L.rect(M, 30, 52, 52, BLANCO, 10);
    L.imagen(M + 3, 33, 46, 46);
  }
  const xt = d.logo ? M + 64 : M;
  L.texto(xt, 46, `PORCÍCOLA ${d.granja}`.toUpperCase(), 8, AZUL_TEXTO, true);
  L.texto(xt, 68, `Resumen ejecutivo · lote ${d.codigo}`, 18, P900, true);
  L.texto(xt, 83, `${d.nombre} · ${fecha(d.fechaIngreso)} – ${fecha(d.fechaCorte)} · ${dias(d.fechaIngreso, d.fechaCorte)} días · ${d.animalesVivos} de ${d.animalesIniciales} animales`, 8.5, P500);
  der(L, DER, 46, d.estado.toUpperCase(), 8, d.estado === "Activo" ? VERDE : P500, true);

  // Resultado grande
  let y = 112;
  L.rect(M, y, UTIL, 78, c.utilidad >= 0 ? AZUL_CLARO : [255, 241, 242], 12);
  L.texto(M + 16, y + 22, c.utilidad >= 0 ? "UTILIDAD DEL LOTE" : "PÉRDIDA DEL LOTE", 8, P500, true);
  L.texto(M + 16, y + 54, pesos(c.utilidad), 28, c.utilidad >= 0 ? AZUL_TEXTO : ROJO, true);
  const cols = [
    { t: "Ingresos", v: pesos(c.totalIngresos) },
    { t: "Costos", v: pesos(c.totalCostos) },
    { t: "Por animal", v: c.animales ? pesos(c.utilidad / c.animales) : "–" },
  ];
  cols.forEach((x, i) => {
    const xx = M + UTIL - 3 * 104 + i * 104;
    L.texto(xx, y + 30, x.t.toUpperCase(), 7, P500, true);
    L.texto(xx, y + 48, recortar(x.v, 98, 11, true), 11, P900, true);
  });
  y += 100;

  // Composición de los costos (barra apilada + leyenda)
  L.texto(M, y, "COMPOSICIÓN DE LOS COSTOS", 8, AZUL_TEXTO, true);
  y += 12;
  const total = c.totalCostos || 1;
  let xb = M;
  c.costosPorCat.forEach(([, v], i) => {
    const w = (v / total) * UTIL;
    if (w > 0.5) L.rect(xb, y, w, 16, PALETA[i % PALETA.length]);
    xb += w;
  });
  if (c.costosPorCat.length === 0) L.rect(M, y, UTIL, 16, P100, 4);
  y += 30;
  c.costosPorCat.forEach(([cat, v], i) => {
    L.rect(M, y - 7, 8, 8, PALETA[i % PALETA.length], 2);
    L.texto(M + 14, y, recortar(cat, 220, 9), 9, P900);
    der(L, M + 330, y, pct((v / total) * 100), 9, P500);
    der(L, DER, y, pesos(v), 9, P900, true);
    y += 15;
  });

  // Lote vs madre
  if (c.costosPorCat.some(([cat]) => cat.startsWith("Madre"))) {
    y += 8;
    L.texto(M, y, "LOTE Y MADRE", 8, AZUL_TEXTO, true);
    y += 12;
    const wl = (c.costoLote / total) * UTIL;
    L.rect(M, y, Math.max(0.5, wl), 12, AZUL, 0);
    L.rect(M + wl, y, Math.max(0.5, UTIL - wl), 12, NARANJA, 0);
    y += 26;
    L.texto(M, y, `Lote ${pesos(c.costoLote)} (${pct((c.costoLote / total) * 100)})`, 9, AZUL, true);
    der(L, DER, y, `Madre ${pesos(c.costoMadre)} (${pct((c.costoMadre / total) * 100)})`, 9, NARANJA, true);
    y += 16;
  }
  if (d.notaMadre) {
    for (const l of partir(d.notaMadre, 110)) {
      L.texto(M, y, l, 7.5, P500);
      y += 10;
    }
  }

  // Detalle
  y += 12;
  L.texto(M, y, `DETALLE (${d.movimientos.length})`, 8, AZUL_TEXTO, true);
  y += 16;
  const nueva = () => {
    L = new Lienzo();
    paginas.push(L);
    L.rect(0, 0, 8, 842, AZUL);
    L.texto(M, 40, `Resumen ejecutivo · lote ${d.codigo} (continuación)`, 9, P500, true);
    return { L, y: 64 };
  };
  ({ L, y } = tablaMovimientos(paginas, { L, y }, d, { fondoEncabezado: P100, texto: P900, tenue: P500, linea: P100, ingreso: AZUL_TEXTO }, nueva));
  pies(paginas, d, P400);
  return ensamblarPdf(paginas, d.logo);
}

/* ═════════════ Libro contable: blanco y negro ═════════════ */

function clasico(d: DatosPdfLote): Blob {
  const c = cifras(d);
  const paginas: Lienzo[] = [];
  let L = new Lienzo();
  paginas.push(L);

  // Encabezado centrado, sin color de fondo
  if (d.logo) L.imagen(ANCHO / 2 - 24, 26, 48, 48);
  let y = d.logo ? 92 : 50;
  centro(L, ANCHO / 2, y, `PORCÍCOLA ${d.granja}`.toUpperCase(), 9, G700, true);
  y += 20;
  centro(L, ANCHO / 2, y, `ESTADO DE RESULTADOS · LOTE ${d.codigo}`, 15, NEGRO, true);
  y += 15;
  centro(L, ANCHO / 2, y, `${d.nombre} · Del ${fecha(d.fechaIngreso)} al ${fecha(d.fechaCorte)} · Cifras en pesos colombianos`, 8.5, G500);
  y += 14;
  L.linea(M, DER, y, NEGRO, 1.2);
  L.linea(M, DER, y + 2.5, NEGRO, 0.5);
  y += 26;

  const fila = (t: string, v: string, o: { negrita?: boolean; sangria?: number; subrayar?: boolean } = {}) => {
    L.texto(M + (o.sangria ?? 0), y, t, 9.5, NEGRO, o.negrita);
    der(L, DER, y, v, 9.5, NEGRO, o.negrita);
    if (o.subrayar) L.linea(DER - 110, DER, y + 4, NEGRO, 0.6);
    y += 16;
  };
  fila("INGRESOS", "", { negrita: true });
  if (c.ingresosPorCat.length === 0) fila("Sin ingresos registrados", pesos(0), { sangria: 16 });
  c.ingresosPorCat.forEach(([cat, v]) => fila(cat, pesos(v), { sangria: 16 }));
  fila("Total ingresos", pesos(c.totalIngresos), { negrita: true, subrayar: true });
  y += 6;
  fila("COSTOS DE PRODUCCIÓN", "", { negrita: true });
  if (c.costosPorCat.length === 0) fila("Sin costos registrados", pesos(0), { sangria: 16 });
  c.costosPorCat.forEach(([cat, v]) => fila(cat, `(${pesos(v)})`, { sangria: 16 }));
  fila("Total costos", `(${pesos(c.totalCostos)})`, { negrita: true, subrayar: true });
  y += 6;
  L.linea(M, DER, y - 10, NEGRO, 0.8);
  fila(c.utilidad >= 0 ? "UTILIDAD NETA DEL LOTE" : "PÉRDIDA NETA DEL LOTE", pesos(c.utilidad), { negrita: true });
  L.linea(DER - 110, DER, y - 11, NEGRO, 0.6);
  L.linea(DER - 110, DER, y - 9, NEGRO, 0.6);
  y += 10;

  // Datos del lote en dos columnas
  const datos: [string, string][] = [
    ["Estado", d.estado],
    ["Duración", `${dias(d.fechaIngreso, d.fechaCorte)} días`],
    ["Animales", `${d.animalesVivos} de ${d.animalesIniciales}`],
    ["Costo por animal", c.animales ? pesos(c.totalCostos / c.animales) : "–"],
    ["Costo del lote", pesos(c.costoLote)],
    ["Costo de la madre", pesos(c.costoMadre)],
  ];
  datos.forEach(([t, v], i) => {
    const col = i % 2;
    const x = M + col * (UTIL / 2 + 8);
    if (col === 0 && i > 0) y += 14;
    L.texto(x, y, t, 8.5, G500);
    der(L, x + UTIL / 2 - 8, y, v, 8.5, NEGRO, true);
  });
  y += 12;
  L.linea(M, DER, y, G300, 0.5);
  y += 14;
  if (d.notaMadre) {
    for (const l of partir(d.notaMadre, 110)) {
      L.texto(M, y, l, 7.5, G500);
      y += 10;
    }
    y += 4;
  }

  L.texto(M, y + 4, "LIBRO DE MOVIMIENTOS", 9, NEGRO, true);
  y += 20;
  const nueva = () => {
    L = new Lienzo();
    paginas.push(L);
    centro(L, ANCHO / 2, 40, `LOTE ${d.codigo} · LIBRO DE MOVIMIENTOS (CONTINUACIÓN)`, 9, G700, true);
    return { L, y: 64 };
  };
  ({ L, y } = tablaMovimientos(paginas, { L, y }, d, { fondoEncabezado: G100, texto: NEGRO, tenue: G700, linea: G300, ingreso: NEGRO }, nueva));

  // Firmas
  if (y < 740) {
    y = Math.max(y + 40, 720);
    [M, M + UTIL / 2 + 20].forEach((x, i) => {
      L.linea(x, x + UTIL / 2 - 20, y, NEGRO, 0.6);
      L.texto(x, y + 12, i === 0 ? "Elaboró" : "Revisó", 8, G500);
    });
  }
  pies(paginas, d, G500);
  return ensamblarPdf(paginas, d.logo);
}

/* ═════════════ Por animal ═════════════ */

function porAnimal(d: DatosPdfLote): Blob {
  const c = cifras(d);
  const n = c.animales || 1;
  const paginas: Lienzo[] = [];
  const L = new Lienzo();
  paginas.push(L);

  L.rect(0, 0, ANCHO, 104, AZUL);
  if (d.logo) {
    L.rect(M, 22, 60, 60, BLANCO, 12);
    L.imagen(M + 5, 27, 50, 50);
  }
  const xt = d.logo ? M + 74 : M;
  L.texto(xt, 40, `PORCÍCOLA ${d.granja}`.toUpperCase(), 8, [186, 230, 253], true);
  L.texto(xt, 64, `Costo por animal · lote ${d.codigo}`, 19, BLANCO, true);
  L.texto(xt, 81, `${d.nombre} · ${d.animalesVivos} animales vivos de ${d.animalesIniciales} · ${dias(d.fechaIngreso, d.fechaCorte)} días`, 9, [224, 242, 254]);

  // Tres cifras por cabeza
  let y = 124;
  const w = (UTIL - 20) / 3;
  [
    { t: "Costo por animal", v: pesos(c.totalCostos / n), col: P900 },
    { t: "Ingreso por animal", v: pesos(c.totalIngresos / n), col: AZUL_TEXTO },
    { t: "Resultado por animal", v: pesos(c.utilidad / n), col: c.utilidad >= 0 ? AZUL_TEXTO : ROJO },
  ].forEach((x, i) => {
    const xx = M + i * (w + 10);
    L.rect(xx, y, w, 58, P50, 10);
    L.texto(xx + 12, y + 20, x.t.toUpperCase(), 7.5, P500, true);
    L.texto(xx + 12, y + 44, recortar(x.v, w - 24, 17, true), 17, x.col, true);
  });
  y += 84;

  // Tabla por categoría
  L.texto(M, y, "COSTO POR CABEZA, POR CATEGORÍA", 8, AZUL_TEXTO, true);
  y += 14;
  L.rect(M, y - 11, UTIL, 18, P100, 4);
  L.texto(M + 8, y + 1, "CATEGORÍA", 7, P500, true);
  der(L, M + 290, y + 1, "TOTAL", 7, P500, true);
  der(L, M + 390, y + 1, "% DEL COSTO", 7, P500, true);
  der(L, DER - 8, y + 1, "POR ANIMAL", 7, P500, true);
  y += 20;
  const max = Math.max(1, ...c.costosPorCat.map(([, v]) => v));
  c.costosPorCat.forEach(([cat, v], i) => {
    L.texto(M + 8, y, recortar(cat, 170, 9), 9, P900);
    der(L, M + 290, y, pesos(v), 9, P500);
    der(L, M + 390, y, pct((v / (c.totalCostos || 1)) * 100), 9, P500);
    der(L, DER - 8, y, pesos(v / n), 9.5, P900, true);
    // barrita bajo la fila
    if (v > 0) L.rect(M + 8, y + 4, Math.max(2, (v / max) * 180), 3, PALETA[i % PALETA.length], 1.5);
    y += 22;
  });
  L.linea(M, DER, y - 8, P900, 0.8);
  L.texto(M + 8, y + 4, "Total", 9.5, P900, true);
  der(L, M + 290, y + 4, pesos(c.totalCostos), 9.5, P900, true);
  der(L, DER - 8, y + 4, pesos(c.totalCostos / n), 10.5, P900, true);
  y += 28;

  if (c.ingresosPorCat.length) {
    L.texto(M, y, "INGRESOS POR CABEZA", 8, AZUL_TEXTO, true);
    y += 16;
    c.ingresosPorCat.forEach(([cat, v]) => {
      L.texto(M + 8, y, cat, 9, P900);
      der(L, M + 290, y, pesos(v), 9, P500);
      der(L, DER - 8, y, pesos(v / n), 9.5, AZUL_TEXTO, true);
      y += 18;
    });
    y += 6;
  }
  if (c.costoMadre > 0) {
    L.rect(M, y, UTIL, 40, [255, 247, 237], 8);
    L.texto(M + 12, y + 16, "Lote por animal", 8, P500);
    L.texto(M + 12, y + 31, pesos(c.costoLote / n), 11, AZUL, true);
    L.texto(M + UTIL / 2, y + 16, "Madre por animal", 8, P500);
    L.texto(M + UTIL / 2, y + 31, pesos(c.costoMadre / n), 11, NARANJA, true);
    y += 54;
  }
  if (d.notaMadre) {
    for (const l of partir(d.notaMadre, 110)) {
      L.texto(M, y, l, 7.5, P500);
      y += 10;
    }
  }
  if (!c.animales) L.texto(M, y + 10, "El lote no tiene animales vivos: los valores por animal se calcularon sobre 1.", 8, P500);
  pies(paginas, d, P400);
  return ensamblarPdf(paginas, d.logo);
}

export function generarPdfLoteFormato(d: DatosPdfLote, formato: Exclude<FormatoReporteLote, "estandar">): Blob {
  return formato === "ejecutivo" ? ejecutivo(d) : formato === "clasico" ? clasico(d) : porAnimal(d);
}
