/**
 * PDF de los movimientos de contabilidad de un periodo (semana o mes).
 * Usa el mismo generador sin librerías que la ficha de la cerda.
 */

import { ANCHO, anchoAprox, ensamblarPdf, Lienzo, type LogoJpeg, type RGB } from "@/lib/pdfFicha";

const AZUL: RGB = [12, 74, 110]; // sky-900, color de la app
const AZUL_CLARO: RGB = [224, 242, 254];
const AZUL_TEXTO: RGB = [3, 105, 161];
const ROJO_TEXTO: RGB = [225, 29, 72];
const PIZARRA_900: RGB = [15, 23, 42];
const PIZARRA_500: RGB = [100, 116, 139];
const PIZARRA_400: RGB = [148, 163, 184];
const PIZARRA_100: RGB = [241, 245, 249];
const PIZARRA_50: RGB = [248, 250, 252];
const BLANCO: RGB = [255, 255, 255];

export interface FilaMovimiento {
  fecha: string; // ya formateada
  descripcion: string;
  categoria: string;
  tipo: "ingreso" | "gasto";
  monto: number;
}

export interface DatosPdfContabilidad {
  granja: string;
  periodo: string; // p. ej. "Octubre 2026" o "Semana del 20 al 26 de oct."
  filas: FilaMovimiento[];
  fechaGeneracion: string;
  logo?: LogoJpeg | null;
}

const pesos = (v: number) => `$ ${Math.round(v).toLocaleString("es-CO")}`;

/** Recorta un texto para que quepa en un ancho dado */
function recortar(t: string, ancho: number, tam: number, negrita = false) {
  if (anchoAprox(t, tam, negrita) <= ancho) return t;
  let s = t;
  while (s.length > 1 && anchoAprox(s + "…", tam, negrita) > ancho) s = s.slice(0, -1);
  return s + "…";
}

export function generarPdfContabilidad(d: DatosPdfContabilidad): Blob {
  const M = 40;
  const ingresos = d.filas.filter((f) => f.tipo === "ingreso").reduce((s, f) => s + f.monto, 0);
  const gastos = d.filas.filter((f) => f.tipo === "gasto").reduce((s, f) => s + f.monto, 0);
  const balance = ingresos - gastos;

  // Columnas de la tabla
  const cFecha = M + 10;
  const cDesc = M + 78;
  const cCat = M + 318;
  const cValorDer = ANCHO - M - 10;
  const ALTO_FILA = 22;

  const paginas: Lienzo[] = [];
  let L = new Lienzo();
  let y = 0;

  const encabezadoTabla = () => {
    L.rect(M, y, ANCHO - 2 * M, 22, PIZARRA_50, 6);
    L.texto(cFecha, y + 14.5, "FECHA", 8, PIZARRA_500, true);
    L.texto(cDesc, y + 14.5, "DESCRIPCIÓN", 8, PIZARRA_500, true);
    L.texto(cCat, y + 14.5, "CATEGORÍA", 8, PIZARRA_500, true);
    L.texto(cValorDer - anchoAprox("VALOR", 8, true), y + 14.5, "VALOR", 8, PIZARRA_500, true);
    y += 26;
  };

  const nuevaPagina = (primera: boolean) => {
    L = new Lienzo();
    paginas.push(L);
    if (primera) {
      // Encabezado completo
      L.rect(0, 0, ANCHO, 118, AZUL);
      if (d.logo) {
        L.rect(M, 22, 74, 74, BLANCO, 14);
        L.imagen(M + 5, 27, 64, 64);
      }
      const xt = d.logo ? M + 92 : M;
      L.texto(xt, 44, `PORCÍCOLA ${d.granja}`.toUpperCase(), 9, [186, 230, 253], true);
      L.texto(xt, 72, "Movimientos de contabilidad", 22, BLANCO, true);
      L.texto(xt, 92, d.periodo, 10, [224, 242, 254]);

      // Resumen
      y = 140;
      const gap = 10;
      const w = (ANCHO - 2 * M - 2 * gap) / 3;
      [
        { t: "Ingresos", v: pesos(ingresos), c: AZUL_TEXTO, f: AZUL_CLARO },
        { t: "Gastos", v: pesos(gastos), c: PIZARRA_900, f: PIZARRA_50 },
        { t: "Balance", v: pesos(balance), c: balance >= 0 ? AZUL_TEXTO : ROJO_TEXTO, f: balance >= 0 ? AZUL_CLARO : [255, 241, 242] as RGB },
      ].forEach((x, i) => {
        const xx = M + i * (w + gap);
        L.rect(xx, y, w, 54, x.f, 10);
        L.texto(xx + 12, y + 26, recortar(x.v, w - 24, 16, true), 16, x.c, true);
        L.texto(xx + 12, y + 42, x.t, 9, PIZARRA_500);
      });
      y += 76;
      L.texto(M, y, `${d.filas.length} MOVIMIENTO${d.filas.length === 1 ? "" : "S"}`, 9, PIZARRA_400, true);
      y += 10;
    } else {
      L.texto(M, 40, `${d.granja} · ${d.periodo} (continuación)`, 9, PIZARRA_400, true);
      y = 52;
    }
    encabezadoTabla();
  };

  nuevaPagina(true);
  if (d.filas.length === 0) {
    L.texto(M + 10, y + 14, "No hay movimientos en este periodo.", 10, PIZARRA_500);
  }
  for (const f of d.filas) {
    if (y + ALTO_FILA > 790) nuevaPagina(false);
    const valor = `${f.tipo === "ingreso" ? "+" : "-"} ${pesos(f.monto)}`;
    L.texto(cFecha, y + 13, f.fecha, 9, PIZARRA_500);
    L.texto(cDesc, y + 13, recortar(f.descripcion || f.categoria, cCat - cDesc - 10, 9, true), 9, PIZARRA_900, true);
    L.texto(cCat, y + 13, recortar(f.categoria, cValorDer - cCat - 90, 9), 9, PIZARRA_500);
    L.texto(cValorDer - anchoAprox(valor, 9, true), y + 13, valor, 9, f.tipo === "ingreso" ? AZUL_TEXTO : PIZARRA_900, true);
    y += ALTO_FILA;
    L.linea(M, ANCHO - M, y - 4, PIZARRA_100);
  }

  // Pie en todas las páginas
  paginas.forEach((p, i) => {
    p.linea(M, ANCHO - M, 806, PIZARRA_100);
    p.texto(M, 822, `Porcícola ${d.granja} · Generado el ${d.fechaGeneracion}`, 8, PIZARRA_400);
    const pag = `Página ${i + 1} de ${paginas.length}`;
    p.texto(ANCHO - M - anchoAprox(pag, 8), 822, pag, 8, PIZARRA_400);
  });

  return ensamblarPdf(paginas, d.logo);
}
