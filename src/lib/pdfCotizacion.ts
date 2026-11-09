/**
 * Cotización de lechones en PDF (estilo clásico: encabezado azul, cliente,
 * detalle del lote, totales, condiciones y nota de IVA). Sin firma.
 */

import { ANCHO, anchoAprox, ensamblarPdf, Lienzo, partir, type LogoJpeg, type RGB } from "@/lib/pdfFicha";

const AZUL: RGB = [12, 74, 110];
const AZUL_TEXTO: RGB = [3, 105, 161];
const CELESTE: RGB = [186, 230, 253];
const P900: RGB = [15, 23, 42];
const P700: RGB = [51, 65, 85];
const P500: RGB = [100, 116, 139];
const P400: RGB = [148, 163, 184];
const P200: RGB = [226, 232, 240];
const P100: RGB = [241, 245, 249];
const P50: RGB = [248, 250, 252];
const BLANCO: RGB = [255, 255, 255];

export interface DatosPdfCotizacion {
  empresa: { razonSocial: string; nit: string; direccion: string; municipio: string; telefonos: string; correo: string };
  numero: string;
  fecha: string;
  validaHasta: string;
  validezDias: number;
  cliente: { nombre: string; documento?: string; telefono?: string; ubicacion?: string };
  lote: string;
  descripcion: string;
  detalle: string;
  cantidad: number;
  edadDias: number;
  pesoPromedio?: string;
  valorUnitario: string;
  subtotal: string;
  descuentoTexto?: string;
  descuento?: string;
  total: string;
  condiciones: string;
  observaciones?: string;
  notaIva: string;
  logo?: LogoJpeg | null;
}

const der = (L: Lienzo, x: number, y: number, t: string, tam: number, c: RGB, negrita = false) => L.texto(x - anchoAprox(t, tam, negrita), y, t, tam, c, negrita);

export function generarPdfCotizacion(d: DatosPdfCotizacion): Blob {
  const M = 40;
  const DER = ANCHO - M;
  const UTIL = ANCHO - 2 * M;
  const L = new Lienzo();

  // Marca de agua primero, para que quede debajo de todo
  if (d.logo) {
    const lado = 320;
    L.marcaAgua((ANCHO - lado) / 2, 330, lado, lado);
  }

  // Encabezado
  L.rect(0, 0, ANCHO, 112, AZUL);
  if (d.logo) {
    L.rect(M, 22, 66, 66, BLANCO, 12);
    L.imagen(M + 6, 28, 54, 54);
  }
  const xt = d.logo ? M + 80 : M;
  // Nombre de la asociación grande (en dos líneas si es largo) y el tipo de documento pequeño
  const palabras = d.empresa.razonSocial.split(" ");
  const corte = palabras.length > 3 ? palabras.length - 2 : palabras.length;
  const linea1 = palabras.slice(0, corte).join(" ");
  const linea2 = palabras.slice(corte).join(" ");
  L.texto(xt, linea2 ? 42 : 52, linea1, 15, BLANCO, true);
  if (linea2) L.texto(xt, 60, linea2, 15, BLANCO, true);
  L.texto(xt, 78, "Cotización de lechones", 9.5, CELESTE, true);
  L.texto(xt, 91, `NIT ${d.empresa.nit}`, 8.5, [224, 242, 254]);
  der(L, DER, 40, "COTIZACIÓN", 8, CELESTE, true);
  der(L, DER, 58, `N.º ${d.numero}`, 13, BLANCO, true);
  der(L, DER, 74, `Fecha: ${d.fecha}`, 8.5, [224, 242, 254]);
  der(L, DER, 87, `Válida hasta: ${d.validaHasta} (${d.validezDias} días)`, 8.5, [224, 242, 254]);

  let y = 132;

  // Cliente y lote
  const caja = (x: number, w: number, titulo: string, lineas: { t: string; negrita?: boolean }[], alto = 22 + lineas.length * 13) => {
    L.rect(x, y, w, alto, P50, 8);
    L.texto(x + 12, y + 16, titulo, 7.5, AZUL_TEXTO, true);
    lineas.forEach((l, i) => L.texto(x + 12, y + 31 + i * 13, l.t, 9.5, l.negrita ? P900 : P700, l.negrita));
    return alto;
  };
  const wCaja = (UTIL - 10) / 2;
  const cli = [
    { t: d.cliente.nombre, negrita: true },
    ...(d.cliente.documento ? [{ t: d.cliente.documento }] : []),
    ...(d.cliente.telefono ? [{ t: `Tel. ${d.cliente.telefono}` }] : []),
    ...(d.cliente.ubicacion ? [{ t: d.cliente.ubicacion }] : []),
  ];
  // Vendedor: los datos de la asociación
  const vend = [
    ...partir(d.empresa.razonSocial, 36).map((t) => ({ t, negrita: true })),
    { t: `NIT ${d.empresa.nit}` },
    { t: `${d.empresa.direccion}, ${d.empresa.municipio}` },
    { t: `Tel. ${d.empresa.telefonos}` },
    { t: d.empresa.correo },
  ];
  // Las dos cajas con la misma altura
  const alto = 22 + Math.max(cli.length, vend.length) * 13;
  caja(M, wCaja, "CLIENTE", cli, alto);
  caja(M + wCaja + 10, wCaja, "VENDEDOR", vend, alto);
  y += alto + 20;

  // Tabla
  const cols = [
    { t: "Descripción", x: M + 10, der: false },
    { t: "Edad", x: M + 270, der: true },
    { t: "Cant.", x: M + 320, der: true },
    { t: "Valor unit.", x: M + 410, der: true },
    { t: "Total", x: DER - 10, der: true },
  ];
  L.rect(M, y, UTIL, 24, AZUL, 4);
  for (const c of cols) {
    if (c.der) der(L, c.x, y + 16, c.t, 8.5, BLANCO, true);
    else L.texto(c.x, y + 16, c.t, 8.5, BLANCO, true);
  }
  y += 24;
  L.rect(M, y, UTIL, 40, P100);
  L.texto(M + 10, y + 17, d.descripcion, 10, P900, true);
  L.texto(M + 10, y + 31, d.detalle, 8.5, P500);
  der(L, M + 270, y + 24, `${d.edadDias} días`, 9.5, P700);
  der(L, M + 320, y + 24, String(d.cantidad), 9.5, P700);
  der(L, M + 410, y + 24, d.valorUnitario, 9.5, P700);
  der(L, DER - 10, y + 24, d.subtotal, 9.5, P900, true);
  y += 40;
  L.linea(M, DER, y, P200, 0.6);
  y += 16;

  // Totales
  const xTot = M + UTIL * 0.5;
  const filaTot = (t: string, v: string) => {
    L.texto(xTot + 10, y, t, 9.5, P700);
    der(L, DER - 10, y, v, 9.5, P900);
    y += 17;
  };
  filaTot("Subtotal", d.subtotal);
  if (d.descuento) filaTot(d.descuentoTexto ?? "Descuento", `-${d.descuento}`);
  filaTot("IVA (excluido)", "$0");
  L.rect(xTot, y - 8, DER - xTot, 28, AZUL, 4);
  L.texto(xTot + 10, y + 10, "TOTAL", 11, BLANCO, true);
  der(L, DER - 10, y + 10, d.total, 13, BLANCO, true);
  y += 42;

  // Textos
  const bloque = (titulo: string, texto: string) => {
    if (!texto.trim()) return;
    L.texto(M, y, titulo.toUpperCase(), 7.5, AZUL_TEXTO, true);
    y += 7;
    L.linea(M, DER, y, P200, 0.6);
    y += 14;
    for (const l of partir(texto, 100).slice(0, 7)) {
      L.texto(M, y, l, 9, P700);
      y += 12.5;
    }
    y += 10;
  };
  bloque("Condiciones", d.condiciones);
  if (d.observaciones) bloque("Observaciones", d.observaciones);
  bloque("Impuestos", d.notaIva);

  // Pie con los datos de la empresa
  L.rect(0, 790, ANCHO, 52, P100);
  L.texto(M, 808, `${d.empresa.razonSocial} · NIT ${d.empresa.nit}`, 8, P700, true);
  L.texto(M, 821, `${d.empresa.direccion}, ${d.empresa.municipio} · Tel. ${d.empresa.telefonos} · ${d.empresa.correo}`, 7.5, P500);
  der(L, DER, 808, `Cotización ${d.numero}`, 7.5, P400);
  return ensamblarPdf([L], d.logo);
}
