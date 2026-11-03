/**
 * PDF de las salidas de bodega a lotes: para qué lote salió cada producto,
 * de qué factura(s), cantidad, valor, fecha y hora. Mismo generador sin librerías.
 */

import { ANCHO, anchoAprox, ensamblarPdf, Lienzo, type LogoJpeg, type RGB } from "@/lib/pdfFicha";

const AZUL: RGB = [12, 74, 110];
const AZUL_TEXTO: RGB = [3, 105, 161];
const NARANJA: RGB = [194, 65, 12];
const P900: RGB = [15, 23, 42];
const P700: RGB = [51, 65, 85];
const P500: RGB = [100, 116, 139];
const P400: RGB = [148, 163, 184];
const P200: RGB = [226, 232, 240];
const P100: RGB = [241, 245, 249];
const P50: RGB = [248, 250, 252];
const BLANCO: RGB = [255, 255, 255];

export interface FilaSalidaPdf {
  fecha: string; // ya formateada, con hora
  lote: string;
  producto: string;
  cantidad: string;
  valor: number;
  facturas: { texto: string; cantidad: string; valor: number }[];
  sinFactura?: string;
}

export interface DatosPdfSalidas {
  granja: string;
  filtro: string; // p. ej. "Todos los productos · LP-01"
  filas: FilaSalidaPdf[];
  fechaGeneracion: string;
  logo?: LogoJpeg | null;
}

const pesos = (v: number) => `$ ${Math.round(v).toLocaleString("es-CO")}`;
function recortar(t: string, ancho: number, tam: number, negrita = false) {
  if (anchoAprox(t, tam, negrita) <= ancho) return t;
  let s = t;
  while (s.length > 1 && anchoAprox(s + "…", tam, negrita) > ancho) s = s.slice(0, -1);
  return s + "…";
}
const der = (L: Lienzo, x: number, y: number, t: string, tam: number, c: RGB, negrita = false) => L.texto(x - anchoAprox(t, tam, negrita), y, t, tam, c, negrita);

export function generarPdfSalidas(d: DatosPdfSalidas): Blob {
  const M = 40;
  const DER = ANCHO - M;
  const UTIL = ANCHO - 2 * M;
  const total = d.filas.reduce((s, f) => s + f.valor, 0);
  const paginas: Lienzo[] = [];
  let L = new Lienzo();
  let y = 0;

  const cFecha = M + 8;
  const cLote = M + 96;
  const cProd = M + 160;
  const cCant = M + 360;

  const encabezadoTabla = () => {
    L.rect(M, y - 12, UTIL, 18, P100, 4);
    L.texto(cFecha, y, "FECHA", 7, P500, true);
    L.texto(cLote, y, "LOTE", 7, P500, true);
    L.texto(cProd, y, "PRODUCTO / FACTURA", 7, P500, true);
    L.texto(cCant, y, "CANTIDAD", 7, P500, true);
    der(L, DER - 8, y, "VALOR", 7, P500, true);
    y += 18;
  };

  const nuevaPagina = (primera: boolean) => {
    L = new Lienzo();
    paginas.push(L);
    if (primera) {
      L.rect(0, 0, ANCHO, 96, AZUL);
      if (d.logo) {
        L.rect(M, 18, 60, 60, BLANCO, 12);
        L.imagen(M + 5, 23, 50, 50);
      }
      const xt = d.logo ? M + 74 : M;
      L.texto(xt, 38, `PORCÍCOLA ${d.granja}`.toUpperCase(), 8, [186, 230, 253], true);
      L.texto(xt, 62, "Salidas de bodega a lotes", 19, BLANCO, true);
      L.texto(xt, 79, d.filtro, 10, [224, 242, 254], true);
      der(L, DER, 38, `Generado el ${d.fechaGeneracion}`, 8, [186, 230, 253]);
      y = 114;
      const w = (UTIL - 10) / 2;
      [
        { t: "Salidas", v: String(d.filas.length) },
        { t: "Valor total", v: pesos(total) },
      ].forEach((x, i) => {
        const xx = M + i * (w + 10);
        L.rect(xx, y, w, 44, P50, 8);
        L.texto(xx + 12, y + 15, x.t.toUpperCase(), 7.5, P500, true);
        L.texto(xx + 12, y + 34, x.v, 14, i === 1 ? AZUL_TEXTO : P900, true);
      });
      y += 66;
    } else {
      L.texto(M, 40, `Salidas de bodega a lotes · ${d.filtro} (continuación)`, 9, P400, true);
      y = 60;
    }
    encabezadoTabla();
  };

  nuevaPagina(true);
  if (d.filas.length === 0) {
    L.texto(cFecha, y, "No hay salidas con este filtro.", 9, P500);
    y += 16;
  }
  for (const f of d.filas) {
    const alto = 16 + f.facturas.length * 12 + (f.sinFactura ? 12 : 0) + 4;
    if (y + alto > 790) {
      nuevaPagina(false);
    }
    L.texto(cFecha, y, recortar(f.fecha, cLote - cFecha - 6, 8), 8, P500);
    L.texto(cLote, y, recortar(f.lote, cProd - cLote - 6, 8, true), 8, AZUL_TEXTO, true);
    L.texto(cProd, y, recortar(f.producto, cCant - cProd - 8, 8.5, true), 8.5, P900, true);
    L.texto(cCant, y, f.cantidad, 8.5, P700);
    der(L, DER - 8, y, pesos(f.valor), 8.5, P900, true);
    y += 12;
    for (const fa of f.facturas) {
      L.texto(cProd + 8, y, recortar(`· ${fa.texto}`, cCant - cProd - 16, 7.5), 7.5, P500);
      L.texto(cCant, y, fa.cantidad, 7.5, P500);
      der(L, DER - 8, y, pesos(fa.valor), 7.5, P500);
      y += 12;
    }
    if (f.sinFactura) {
      L.texto(cProd + 8, y, `· ${f.sinFactura} sin factura de compra (sin valor)`, 7.5, NARANJA);
      y += 12;
    }
    L.linea(M, DER, y - 6, P100, 0.5);
    y += 4;
  }
  if (d.filas.length > 0) {
    if (y > 790) nuevaPagina(false);
    y += 4;
    L.texto(cFecha, y, "Total", 9, P900, true);
    der(L, DER - 8, y, pesos(total), 9.5, AZUL_TEXTO, true);
  }

  paginas.forEach((p, i) => {
    p.linea(M, DER, 806, P200, 0.6);
    p.texto(M, 822, `Porcícola ${d.granja} · Salidas a lotes · Cifras en pesos colombianos (COP)`, 7.5, P400);
    const pag = `Página ${i + 1} de ${paginas.length}`;
    p.texto(DER - anchoAprox(pag, 7.5), 822, pag, 7.5, P400);
  });
  return ensamblarPdf(paginas, d.logo);
}
