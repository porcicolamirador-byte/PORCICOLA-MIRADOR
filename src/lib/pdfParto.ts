/**
 * Reporte de un parto en PDF: número de parto de la cerda, datos del parto,
 * camada, madre y observaciones. Mismo generador sin librerías.
 */

import { ANCHO, anchoAprox, ensamblarPdf, Lienzo, partir, type LogoJpeg, type RGB } from "@/lib/pdfFicha";

const AZUL: RGB = [12, 74, 110];
const AZUL_TEXTO: RGB = [3, 105, 161];
const VERDE: RGB = [21, 128, 61];
const ROJO: RGB = [190, 18, 60];
const P900: RGB = [15, 23, 42];
const P700: RGB = [51, 65, 85];
const P500: RGB = [100, 116, 139];
const P400: RGB = [148, 163, 184];
const P200: RGB = [226, 232, 240];
const P50: RGB = [248, 250, 252];
const BLANCO: RGB = [255, 255, 255];

export interface DatosPdfParto {
  granja: string;
  cerda: string;
  numeroParto: number;
  codigoParto: string;
  fecha: string; // formateada
  hora: string;
  tipoParto: string;
  asistidoPor: string;
  diasGestacion: string;
  fechaIA: string;
  genetica: string;
  vivos: number;
  muertos: number;
  momias: number;
  pesoPromedio: string;
  pesoCamada: string;
  pesoCerda: string;
  estadoSalud: string;
  lote: string;
  destete: string;
  observaciones: string;
  observacionesLechones: string;
  fechaGeneracion: string;
  logo?: LogoJpeg | null;
}

const der = (L: Lienzo, x: number, y: number, t: string, tam: number, c: RGB, negrita = false) => L.texto(x - anchoAprox(t, tam, negrita), y, t, tam, c, negrita);

export function generarPdfParto(d: DatosPdfParto): Blob {
  const M = 40;
  const DER = ANCHO - M;
  const UTIL = ANCHO - 2 * M;
  const L = new Lienzo();

  // Encabezado
  L.rect(0, 0, ANCHO, 104, AZUL);
  if (d.logo) {
    L.rect(M, 20, 62, 62, BLANCO, 12);
    L.imagen(M + 6, 26, 50, 50);
  }
  const xt = d.logo ? M + 76 : M;
  L.texto(xt, 38, `PORCÍCOLA ${d.granja}`.toUpperCase(), 8, [186, 230, 253], true);
  L.texto(xt, 64, `Reporte de parto N.º ${d.numeroParto}`, 20, BLANCO, true);
  L.texto(xt, 83, `Cerda ${d.cerda} · ${d.codigoParto}`, 10.5, [224, 242, 254], true);
  der(L, DER, 38, `Generado el ${d.fechaGeneracion}`, 8, [186, 230, 253]);

  let y = 124;

  // Camada en recuadros
  const total = d.vivos + d.muertos + d.momias;
  const tiles = [
    { t: "Nacidos", v: String(total), c: P900 },
    { t: "Vivos", v: String(d.vivos), c: VERDE },
    { t: "Muertos", v: String(d.muertos), c: d.muertos > 0 ? ROJO : P900 },
    { t: "Momias", v: String(d.momias), c: d.momias > 0 ? ROJO : P900 },
  ];
  const gap = 8;
  const wt = (UTIL - gap * 3) / 4;
  tiles.forEach((x, i) => {
    const xx = M + i * (wt + gap);
    L.rect(xx, y, wt, 50, P50, 8);
    L.texto(xx + 12, y + 16, x.t.toUpperCase(), 7.5, P500, true);
    L.texto(xx + 12, y + 39, x.v, 18, x.c, true);
  });
  y += 70;

  // Secciones de datos en dos columnas
  const seccion = (titulo: string, filas: [string, string][]) => {
    L.texto(M, y, titulo.toUpperCase(), 8, AZUL_TEXTO, true);
    y += 8;
    L.linea(M, DER, y, P200, 0.6);
    y += 16;
    const mitad = Math.ceil(filas.length / 2);
    const w = UTIL / 2;
    filas.forEach(([k, v], i) => {
      const col = i < mitad ? 0 : 1;
      const fila = i < mitad ? i : i - mitad;
      const xx = M + col * w;
      const yy = y + fila * 30;
      L.texto(xx, yy, k, 7.5, P500);
      L.texto(xx, yy + 13, v || "—", 10.5, P900, true);
    });
    y += mitad * 30 + 10;
  };

  seccion("Datos del parto", [
    ["Fecha", d.fecha],
    ["Hora de inicio", d.hora],
    ["Tipo de parto", d.tipoParto],
    ["Asistido por", d.asistidoPor],
    ["Inseminación", d.fechaIA],
    ["Días de gestación", d.diasGestacion],
  ]);
  seccion("Camada", [
    ["Peso promedio", d.pesoPromedio],
    ["Peso estimado de la camada (vivos)", d.pesoCamada],
    ["Lote de engorde", d.lote],
    ["Destete sugerido", d.destete],
  ]);
  seccion("Madre", [
    ["Cerda", d.cerda],
    ["Genética", d.genetica],
    ["Peso de la cerda", d.pesoCerda],
    ["Estado de salud", d.estadoSalud],
  ]);

  const nota = (titulo: string, texto: string) => {
    L.texto(M, y, titulo.toUpperCase(), 8, AZUL_TEXTO, true);
    y += 8;
    L.linea(M, DER, y, P200, 0.6);
    y += 16;
    const lineas = partir(texto || "—", 95).slice(0, 8);
    for (const l of lineas) {
      L.texto(M, y, l, 9.5, P700);
      y += 13;
    }
    y += 10;
  };
  nota("Observaciones del parto", d.observaciones);
  nota("Observaciones de los lechones", d.observacionesLechones);

  // Logo de la granja como marca de agua en el centro de la hoja
  if (d.logo) {
    const lado = 340;
    L.marcaAgua((ANCHO - lado) / 2, 300, lado, lado);
  }

  L.linea(M, DER, 806, P200, 0.6);
  L.texto(M, 822, `Porcícola ${d.granja} · Reporte de parto · Cerda ${d.cerda} · parto N.º ${d.numeroParto}`, 7.5, P400);
  return ensamblarPdf([L], d.logo);
}
