/**
 * Generador de PDF mínimo (sin librerías externas) para la ficha de una cerda.
 * Usa las fuentes estándar Helvetica con codificación WinAnsi (acentos y ñ OK).
 */

export type RGB = [number, number, number];

export const ANCHO = 595; // A4 en puntos
export const ALTO = 842;

const VERDE: RGB = [6, 78, 59];
const VERDE_CLARO: RGB = [236, 253, 245];
const VERDE_TEXTO: RGB = [6, 95, 70];
const PIZARRA_900: RGB = [15, 23, 42];
const PIZARRA_500: RGB = [100, 116, 139];
const PIZARRA_400: RGB = [148, 163, 184];
const PIZARRA_100: RGB = [241, 245, 249];
const PIZARRA_50: RGB = [248, 250, 252];
const AMBAR: RGB = [252, 211, 77];
const AMBAR_TEXTO: RGB = [69, 26, 3];
const AMBAR_CLARO: RGB = [255, 251, 235];
const BLANCO: RGB = [255, 255, 255];

// Caracteres Unicode que existen en WinAnsi con otro código
const WIN_ANSI: Record<number, number> = {
  0x20ac: 0x80, 0x2026: 0x85, 0x2018: 0x91, 0x2019: 0x92, 0x201c: 0x93,
  0x201d: 0x94, 0x2022: 0x95, 0x2013: 0x96, 0x2014: 0x97,
};

/** Convierte texto a una cadena literal PDF (descarta emojis y símbolos no soportados) */
function cadena(texto: string): string {
  let salida = "";
  for (const ch of texto) {
    const cp = ch.codePointAt(0) ?? 63;
    const b = cp < 256 ? cp : WIN_ANSI[cp];
    if (b === undefined) continue;
    const c = String.fromCharCode(b);
    salida += c === "\\" || c === "(" || c === ")" ? `\\${c}` : c;
  }
  return `(${salida.trim()})`;
}

const color = ([r, g, b]: RGB) => `${(r / 255).toFixed(3)} ${(g / 255).toFixed(3)} ${(b / 255).toFixed(3)}`;
const n = (v: number) => v.toFixed(2);

export class Lienzo {
  ops: string[] = [];

  /** Rectángulo relleno (y medido desde arriba), con esquinas redondeadas opcionales */
  rect(x: number, y: number, w: number, h: number, relleno: RGB, radio = 0) {
    const yb = ALTO - y - h;
    this.ops.push(`${color(relleno)} rg`);
    if (!radio) {
      this.ops.push(`${n(x)} ${n(yb)} ${n(w)} ${n(h)} re f`);
      return;
    }
    const r = Math.min(radio, w / 2, h / 2);
    const k = r * 0.5523;
    const x2 = x + w;
    const y2 = yb + h;
    this.ops.push(
      [
        `${n(x + r)} ${n(yb)} m`,
        `${n(x2 - r)} ${n(yb)} l`,
        `${n(x2 - r + k)} ${n(yb)} ${n(x2)} ${n(yb + r - k)} ${n(x2)} ${n(yb + r)} c`,
        `${n(x2)} ${n(y2 - r)} l`,
        `${n(x2)} ${n(y2 - r + k)} ${n(x2 - r + k)} ${n(y2)} ${n(x2 - r)} ${n(y2)} c`,
        `${n(x + r)} ${n(y2)} l`,
        `${n(x + r - k)} ${n(y2)} ${n(x)} ${n(y2 - r + k)} ${n(x)} ${n(y2 - r)} c`,
        `${n(x)} ${n(yb + r)} l`,
        `${n(x)} ${n(yb + r - k)} ${n(x + r - k)} ${n(yb)} ${n(x + r)} ${n(yb)} c`,
        "f",
      ].join("\n")
    );
  }

  /** Texto con su línea base en y (medido desde arriba) */
  texto(x: number, y: number, t: string, tam: number, c: RGB, negrita = false) {
    this.ops.push(`BT /${negrita ? "F2" : "F1"} ${tam} Tf ${color(c)} rg ${n(x)} ${n(ALTO - y)} Td ${cadena(t)} Tj ET`);
  }

  linea(x1: number, x2: number, y: number, c: RGB, grosor = 0.8) {
    this.ops.push(`${color(c)} RG ${grosor} w ${n(x1)} ${n(ALTO - y)} m ${n(x2)} ${n(ALTO - y)} l S`);
  }

  imagen(x: number, y: number, w: number, h: number) {
    this.ops.push(`q ${n(w)} 0 0 ${n(h)} ${n(x)} ${n(ALTO - y - h)} cm /Im1 Do Q`);
  }
}

/** Ancho aproximado de un texto en Helvetica (suficiente para maquetar) */
export function anchoAprox(t: string, tam: number, negrita = false) {
  return t.length * tam * (negrita ? 0.58 : 0.52);
}

/** Parte un texto en líneas de como máximo `max` caracteres */
export function partir(texto: string, max: number): string[] {
  const lineas: string[] = [];
  for (const parrafo of texto.split(/\r?\n/)) {
    let actual = "";
    for (const palabra of parrafo.split(/\s+/)) {
      if (!palabra) continue;
      if ((actual + " " + palabra).trim().length > max) {
        if (actual) lineas.push(actual);
        actual = palabra;
      } else {
        actual = (actual + " " + palabra).trim();
      }
    }
    lineas.push(actual);
  }
  return lineas;
}

export interface LogoJpeg {
  datos: string; // bytes JPEG como cadena binaria
  ancho: number;
  alto: number;
}

/** Convierte una imagen (p. ej. el logo PNG) a JPEG sobre fondo blanco para incrustarla */
export function cargarLogoJpeg(src: string, lado = 240): Promise<LogoJpeg | null> {
  return new Promise((resolve) => {
    const img = new Image();
    img.onload = () => {
      try {
        const canvas = document.createElement("canvas");
        canvas.width = lado;
        canvas.height = lado;
        const ctx = canvas.getContext("2d");
        if (!ctx) return resolve(null);
        ctx.fillStyle = "#ffffff";
        ctx.fillRect(0, 0, lado, lado);
        const escala = Math.min(lado / img.width, lado / img.height);
        const w = img.width * escala;
        const h = img.height * escala;
        ctx.drawImage(img, (lado - w) / 2, (lado - h) / 2, w, h);
        const base64 = canvas.toDataURL("image/jpeg", 0.9).split(",")[1] ?? "";
        resolve({ datos: atob(base64), ancho: lado, alto: lado });
      } catch {
        resolve(null);
      }
    };
    img.onerror = () => resolve(null);
    img.src = src;
  });
}

export interface DatosFicha {
  id: string;
  raza: string;
  estado: string;
  granja: string;
  generales: { etiqueta: string; valor: string }[];
  cifras: { titulo: string; valor: string; destacado?: boolean }[];
  /** Opcional: si no se envía, el PDF no incluye esta sección */
  caracteristicas?: string;
  fechaGeneracion: string;
  logo?: LogoJpeg | null;
}

/** Arma el PDF de la ficha y lo devuelve como Blob */
export function generarPdfFicha(d: DatosFicha): Blob {
  const L = new Lienzo();
  const M = 40; // margen

  // Encabezado
  L.rect(0, 0, ANCHO, 118, VERDE);
  if (d.logo) {
    L.rect(M, 22, 74, 74, BLANCO, 14);
    L.imagen(M + 5, 27, 64, 64);
  }
  const xt = d.logo ? M + 92 : M;
  L.texto(xt, 44, d.granja.toUpperCase(), 9, [167, 243, 208], true);
  L.texto(xt, 72, "Ficha de la cerda", 24, BLANCO, true);
  L.texto(xt, 92, `Generada el ${d.fechaGeneracion}`, 9, [209, 250, 229]);

  // Arete + raza + estado
  const anchoArete = Math.max(78, anchoAprox(d.id, 20, true) + 32);
  L.rect(M, 140, anchoArete, 48, AMBAR, 10);
  L.rect(M + anchoArete / 2 - 3, 145, 6, 6, [255, 251, 235], 3);
  L.texto(M + 16, 176, d.id, 20, AMBAR_TEXTO, true);
  const xr = M + anchoArete + 16;
  L.texto(xr, 160, d.raza || "Sin raza", 16, PIZARRA_900, true);
  const anchoEstado = anchoAprox(d.estado, 9, true) + 20;
  L.rect(xr, 168, anchoEstado, 18, VERDE_CLARO, 9);
  L.texto(xr + 10, 180.5, d.estado, 9, VERDE_TEXTO, true);

  // Datos generales
  let y = 222;
  L.texto(M, y, "DATOS GENERALES", 9, PIZARRA_400, true);
  y += 10;
  for (const f of d.generales) {
    L.texto(M + 12, y + 17, f.etiqueta, 10, PIZARRA_500);
    L.texto(M + 220, y + 17, f.valor, 10, PIZARRA_900, true);
    y += 26;
    L.linea(M, ANCHO - M, y, PIZARRA_100);
  }

  // Registro reproductivo
  y += 26;
  L.texto(M, y, "REGISTRO REPRODUCTIVO", 9, PIZARRA_400, true);
  y += 10;
  const gap = 10;
  const w = (ANCHO - 2 * M - 2 * gap) / 3;
  const h = 52;
  d.cifras.forEach((c, i) => {
    const col = i % 3;
    const fila = Math.floor(i / 3);
    const x = M + col * (w + gap);
    const yy = y + fila * (h + gap);
    L.rect(x, yy, w, h, c.destacado ? VERDE_CLARO : PIZARRA_50, 10);
    L.texto(x + 12, yy + 25, c.valor, 18, c.destacado ? VERDE_TEXTO : PIZARRA_900, true);
    L.texto(x + 12, yy + 41, c.titulo, 9, PIZARRA_500);
  });
  y += Math.ceil(d.cifras.length / 3) * (h + gap) + 20;

  // Características (solo si se envían)
  if (d.caracteristicas !== undefined) {
    L.texto(M, y, "CARACTERÍSTICAS", 9, PIZARRA_400, true);
    y += 10;
    const lineas = partir(d.caracteristicas || "Sin observaciones registradas.", 92).slice(0, 14);
    const altoCaja = lineas.length * 14 + 20;
    L.rect(M, y, ANCHO - 2 * M, altoCaja, AMBAR_CLARO, 10);
    lineas.forEach((l, i) => L.texto(M + 14, y + 22 + i * 14, l, 10, [51, 65, 85]));
  }

  // Pie
  L.linea(M, ANCHO - M, 806, PIZARRA_100);
  L.texto(M, 822, `${d.granja} · Gestión de producción porcina`, 8, PIZARRA_400);
  L.texto(ANCHO - M - 150, 822, `Cerda ${d.id} · ${d.fechaGeneracion}`, 8, PIZARRA_400);

  return ensamblarPdf([L], d.logo);
}

/** Arma el archivo PDF con una o varias páginas (cada Lienzo es una página) */
export function ensamblarPdf(paginas: Lienzo[], logo?: LogoJpeg | null): Blob {
  // 1 catálogo, 2 páginas, 3-4 fuentes, 5 logo, desde 6: página + contenido
  const objetos: string[] = [];
  const kids = paginas.map((_, i) => `${6 + i * 2} 0 R`).join(" ");
  objetos[1] = "<< /Type /Catalog /Pages 2 0 R >>";
  objetos[2] = `<< /Type /Pages /Kids [${kids}] /Count ${paginas.length} >>`;
  objetos[3] = "<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica /Encoding /WinAnsiEncoding >>";
  objetos[4] = "<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica-Bold /Encoding /WinAnsiEncoding >>";
  objetos[5] = logo
    ? `<< /Type /XObject /Subtype /Image /Width ${logo.ancho} /Height ${logo.alto} ` +
      `/ColorSpace /DeviceRGB /BitsPerComponent 8 /Filter /DCTDecode /Length ${logo.datos.length} >>\n` +
      `stream\n${logo.datos}\nendstream`
    : "<< >>";
  paginas.forEach((pag, i) => {
    const contenido = pag.ops.join("\n");
    objetos[6 + i * 2] =
      `<< /Type /Page /Parent 2 0 R /MediaBox [0 0 ${ANCHO} ${ALTO}] ` +
      `/Resources << /Font << /F1 3 0 R /F2 4 0 R >>${logo ? " /XObject << /Im1 5 0 R >>" : ""} >> /Contents ${7 + i * 2} 0 R >>`;
    objetos[7 + i * 2] = `<< /Length ${contenido.length} >>\nstream\n${contenido}\nendstream`;
  });

  let pdf = "%PDF-1.4\n%\xE2\xE3\xCF\xD3\n";
  const offsets: number[] = [];
  for (let i = 1; i < objetos.length; i++) {
    offsets[i] = pdf.length;
    pdf += `${i} 0 obj\n${objetos[i]}\nendobj\n`;
  }
  const xref = pdf.length;
  pdf += `xref\n0 ${objetos.length}\n0000000000 65535 f \n`;
  for (let i = 1; i < objetos.length; i++) pdf += `${String(offsets[i]).padStart(10, "0")} 00000 n \n`;
  pdf += `trailer\n<< /Size ${objetos.length} /Root 1 0 R >>\nstartxref\n${xref}\n%%EOF`;

  const bytes = new Uint8Array(pdf.length);
  for (let i = 0; i < pdf.length; i++) bytes[i] = pdf.charCodeAt(i) & 0xff;
  return new Blob([bytes], { type: "application/pdf" });
}

/**
 * Entrega el PDF: en el teléfono abre el menú Compartir (Guardar en Archivos,
 * WhatsApp, correo…); si no está disponible, lo descarga.
 */
export async function entregarPdf(blob: Blob, nombre: string) {
  const archivo = new File([blob], nombre, { type: "application/pdf" });
  const nav = navigator as Navigator & { canShare?: (d: ShareData) => boolean };
  if (nav.share && nav.canShare?.({ files: [archivo] })) {
    try {
      await nav.share({ files: [archivo], title: nombre });
      return;
    } catch (e) {
      if ((e as Error)?.name === "AbortError") return; // el usuario cerró el menú
    }
  }
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = nombre;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 4000);
}
