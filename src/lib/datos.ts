import { useSyncExternalStore } from "react";
import type { Cerda, Registro } from "@/utils/pendingTasks";

/* ═════════════════════ Claves de almacenamiento ═════════════════════
 * Todo se guarda en el navegador (localStorage). Las claves "cerdas",
 * "historial-<id>" y "engorde-lotes" ya las usa el dashboard.
 */
export const CLAVES = {
  cerdas: "cerdas",
  historial: (id: string) => `historial-${id}`,
  lotes: "engorde-lotes",
  tratamientos: "tratamientos",
  bioChecks: "bioseguridad-checks",
  bioVisitas: "bioseguridad-visitas",
  movimientos: "contabilidad-movimientos",
  ajustes: "ajustes",
  lecturas: "monitoreo-lecturas",
  bodega: "bodega-articulos", // formato anterior (se migra al catálogo)
  productos: "bodega-productos",
  facturas: "bodega-facturas",
  salidas: "bodega-salidas",
  config: "config-granja",
  corrales: "corrales",
} as const;

/* ═════════════════════ Tipos ═════════════════════ */

export type TipoEvento =
  | "Inseminación"
  | "Confirmación de Gestación"
  | "Parto"
  | "Destete"
  | "Celo"
  | "Aborto"
  | "Tratamiento"
  | "Vacunación"
  | "Desparasitación"
  | "Parvo-Lepto"
  | "Baja"
  | "Vendida"
  | "Muerta";

export interface RegistroCerda extends Registro {
  id?: string;
  tipo: TipoEvento;
  fecha: string;
  vivos?: number;
  muertos?: number;
  momias?: number;
  destetados?: number;
  verraco?: string;
  notas?: string;
}

export interface CerdaDatos extends Cerda {
  nombre?: string;
  raza?: string;
  fechaNacimiento?: string;
  fechaIngreso?: string;
}

export interface Pesaje {
  fecha: string;
  pesoPromedio: number;
}
export interface Mortalidad {
  fecha: string;
  cantidad: number;
  causa?: string;
}
export interface Alimento {
  fecha: string;
  kg: number;
  costo?: number;
  /** Producto de bodega del que salió (si se registró desde el inventario) */
  productoId?: string;
  producto?: string;
  cantidad?: number;
  unidad?: string;
  salidaId?: string;
  /** Hora del consumo (HH:MM) */
  hora?: string;
}
export interface Lote {
  id: string;
  nombre: string;
  fechaIngreso: string;
  cantidadInicial: number;
  vivos: number;
  pesoInicial: number;
  pesajes: Pesaje[];
  mortalidad: Mortalidad[];
  alimento: Alimento[];
  activo: boolean;
  fechaSalida?: string;
  /** Corral donde están los animales (id de los corrales de Ajustes) */
  corralId?: string;
  /** Si el lote se creó automáticamente desde un parto */
  origen?: { cerdaId: string; codigoParto: string };
}

export type TipoTratamiento = "Tratamiento" | "Vacunación" | "Desparasitación";
export interface Tratamiento {
  id: string;
  tipo: TipoTratamiento;
  fecha: string;
  objetivo: "cerda" | "lote";
  objetivoId: string;
  medicamento: string;
  dosis: string;
  dias: number;
  retiroDias: number;
  motivo?: string;
}

export interface Visita {
  id: string;
  fecha: string;
  nombre: string;
  motivo: string;
  diasSinCerdos: number;
  duchaYRopa: boolean;
}

export interface Movimiento {
  id: string;
  fecha: string;
  tipo: "ingreso" | "gasto";
  categoria: string;
  descripcion: string;
  monto: number;
}

export type ZonaMonitoreo = "Maternidad" | "Gestación" | "Precebo" | "Engorde";
export interface Lectura {
  id: string;
  fecha: string; // YYYY-MM-DD
  hora: string; // HH:MM
  zona: ZonaMonitoreo;
  temperatura: number; // °C
  humedad?: number; // %
}

export type CategoriaBodega = "Alimento" | "Medicamentos" | "Vacunas" | "Limpieza" | "Otros";
export interface MovimientoBodega {
  fecha: string;
  tipo: "entrada" | "salida";
  cantidad: number;
  nota?: string;
}
export interface ArticuloBodega {
  id: string;
  nombre: string;
  categoria: CategoriaBodega;
  unidad: string;
  cantidad: number;
  minimo: number;
  movimientos: MovimientoBodega[];
}

export interface Ajustes {
  nombreGranja: string;
  responsable: string;
  diasGestacion: number;
  diasLactancia: number;
}

export const AJUSTES_POR_DEFECTO: Ajustes = {
  nombreGranja: "El Mirador",
  responsable: "",
  diasGestacion: 114,
  diasLactancia: 21,
};

/* ═════════════════════ Lectura / escritura ═════════════════════ */

function leer<T>(clave: string, porDefecto: T): T {
  if (typeof window === "undefined") return porDefecto;
  try {
    const crudo = localStorage.getItem(clave);
    if (crudo === null) return porDefecto;
    const valor = JSON.parse(crudo) as T;
    if (Array.isArray(porDefecto) && !Array.isArray(valor)) return porDefecto;
    return valor ?? porDefecto;
  } catch {
    return porDefecto;
  }
}

function escribir(clave: string, valor: unknown) {
  localStorage.setItem(clave, JSON.stringify(valor));
  notificarCambio();
}

/** Cerdas */
export const leerCerdas = () => leer<CerdaDatos[]>(CLAVES.cerdas, []);
export const guardarCerdas = (c: CerdaDatos[]) => escribir(CLAVES.cerdas, c);

/** Historial de una cerda: siempre ordenado del más reciente al más antiguo */
export const leerHistorial = (id: string) => leer<RegistroCerda[]>(CLAVES.historial(id), []);
export function guardarHistorial(id: string, h: RegistroCerda[]) {
  const ordenado = [...h].sort((a, b) => (b.fecha || "").localeCompare(a.fecha || ""));
  escribir(CLAVES.historial(id), ordenado);
}
export function agregarEvento(cerdaId: string, evento: RegistroCerda) {
  guardarHistorial(cerdaId, [{ ...evento, id: evento.id ?? nuevoId() }, ...leerHistorial(cerdaId)]);
}

/** Engorde */
export function leerLotes(): Lote[] {
  return leer<Partial<Lote>[]>(CLAVES.lotes, []).map((l) => ({
    id: l.id ?? nuevoId(),
    nombre: l.nombre ?? "Lote",
    fechaIngreso: l.fechaIngreso ?? hoy(),
    cantidadInicial: Number(l.cantidadInicial) || Number(l.vivos) || 0,
    vivos: Number(l.vivos) || 0,
    pesoInicial: Number(l.pesoInicial) || 0,
    pesajes: Array.isArray(l.pesajes) ? l.pesajes : [],
    mortalidad: Array.isArray(l.mortalidad) ? l.mortalidad : [],
    alimento: Array.isArray(l.alimento) ? l.alimento : [],
    activo: l.activo !== false,
    fechaSalida: l.fechaSalida,
    corralId: typeof l.corralId === "string" && l.corralId ? l.corralId : undefined,
    origen:
      l.origen && typeof l.origen.cerdaId === "string" && typeof l.origen.codigoParto === "string"
        ? l.origen
        : undefined,
  }));
}
export const guardarLotes = (l: Lote[]) => escribir(CLAVES.lotes, l);

/**
 * Crea (o actualiza) el lote de engorde de la camada de un parto con los
 * lechones nacidos vivos. Si ya existe un lote de ese parto, no lo duplica.
 */
export function crearLoteDesdeParto(datos: {
  cerdaId: string;
  codigoParto: string;
  fecha: string;
  vivos: number;
  pesoPromedio?: number;
}): Lote | null {
  const vivos = Math.max(0, Math.floor(Number(datos.vivos) || 0));
  if (vivos <= 0) return null;
  const lotes = leerLotes();
  const existente = lotes.find((l) => l.origen?.codigoParto === datos.codigoParto);
  if (existente) return existente;
  const lote: Lote = {
    id: nuevoId(),
    nombre: `Camada ${datos.codigoParto}`,
    fechaIngreso: datos.fecha,
    cantidadInicial: vivos,
    vivos,
    pesoInicial: Number(datos.pesoPromedio) || 0,
    pesajes: [],
    mortalidad: [],
    alimento: [],
    activo: true,
    origen: { cerdaId: datos.cerdaId, codigoParto: datos.codigoParto },
  };
  guardarLotes([...lotes, lote]);
  return lote;
}

/** Tratamientos */
export const leerTratamientos = () => leer<Tratamiento[]>(CLAVES.tratamientos, []);
export const guardarTratamientos = (t: Tratamiento[]) => escribir(CLAVES.tratamientos, t);

/** Bioseguridad: fecha (YYYY-MM-DD) -> ids de protocolos cumplidos */
export const leerChecks = () => leer<Record<string, string[]>>(CLAVES.bioChecks, {});
export const guardarChecks = (c: Record<string, string[]>) => escribir(CLAVES.bioChecks, c);
export const leerVisitas = () => leer<Visita[]>(CLAVES.bioVisitas, []);
export const guardarVisitas = (v: Visita[]) => escribir(CLAVES.bioVisitas, v);

/** Contabilidad */
export const leerMovimientos = () => leer<Movimiento[]>(CLAVES.movimientos, []);
export const guardarMovimientos = (m: Movimiento[]) => escribir(CLAVES.movimientos, m);

/** Monitoreo ambiental */
export const leerLecturas = () => leer<Lectura[]>(CLAVES.lecturas, []);
export const guardarLecturas = (l: Lectura[]) => escribir(CLAVES.lecturas, l);

/** Bodega */
export function leerArticulos(): ArticuloBodega[] {
  return leer<Partial<ArticuloBodega>[]>(CLAVES.bodega, []).map((a) => ({
    id: a.id ?? nuevoId(),
    nombre: a.nombre ?? "Artículo",
    categoria: a.categoria ?? "Otros",
    unidad: a.unidad ?? "unidades",
    cantidad: Number(a.cantidad) || 0,
    minimo: Number(a.minimo) || 0,
    movimientos: Array.isArray(a.movimientos) ? a.movimientos : [],
  }));
}
export const guardarArticulos = (a: ArticuloBodega[]) => escribir(CLAVES.bodega, a);

/* ───────────── Bodega por facturas ───────────── */

/** Producto del catálogo (se define en Ajustes avanzados) */
export interface ProductoBodega {
  id: string;
  nombre: string;
  categoria: CategoriaBodega;
  unidad: string;
  minimo: number;
}
export interface LineaFactura {
  productoId: string;
  cantidad: number;
  valorUnitario: number;
}
export interface Factura {
  id: string;
  numero: string;
  proveedor?: string;
  fecha: string;
  lineas: LineaFactura[];
  nota?: string;
  /** id del gasto creado en Contabilidad, si se registró */
  movimientoId?: string;
}
export interface SalidaBodega {
  id: string;
  productoId: string;
  fecha: string;
  cantidad: number;
  /** Hora de la salida (HH:MM) */
  hora?: string;
  nota?: string;
  /** Lote de engorde que consumió el producto */
  loteId?: string;
}

/* ═════════════════════ Corrales ═════════════════════ */

export type ZonaCorral = "Gestación" | "Maternidad" | "Precebo" | "Engorde" | "Cuarentena" | "Otro";
export interface Corral {
  id: string;
  /** Identificación visible del corral, p. ej. "G-01" */
  codigo: string;
  zona: ZonaCorral;
  /** Animales que caben (opcional) */
  capacidad?: number;
  nota?: string;
}
export const leerCorrales = () => leer<Corral[]>(CLAVES.corrales, []);
export const guardarCorrales = (c: Corral[]) => escribir(CLAVES.corrales, c);

export const leerProductos = () => leer<ProductoBodega[]>(CLAVES.productos, []);
export const guardarProductos = (p: ProductoBodega[]) => escribir(CLAVES.productos, p);
export function leerFacturas(): Factura[] {
  return leer<Factura[]>(CLAVES.facturas, []).map((f) => ({
    ...f,
    lineas: Array.isArray(f.lineas) ? f.lineas : [],
  }));
}
export const guardarFacturas = (f: Factura[]) => escribir(CLAVES.facturas, f);
export const leerSalidas = () => leer<SalidaBodega[]>(CLAVES.salidas, []);
export const guardarSalidas = (s: SalidaBodega[]) => escribir(CLAVES.salidas, s);

export const totalFactura = (f: Factura) =>
  f.lineas.reduce((s, l) => s + (Number(l.cantidad) || 0) * (Number(l.valorUnitario) || 0), 0);

export interface MovimientoInventario {
  fecha: string;
  hora?: string;
  tipo: "entrada" | "salida";
  cantidad: number;
  detalle: string;
  facturaId?: string;
  salidaId?: string;
}
export interface ExistenciaProducto {
  producto: ProductoBodega;
  existencia: number;
  bajoMinimo: boolean;
  movimientos: MovimientoInventario[];
  /** Valor unitario de la compra más reciente con precio (0 si no hay) */
  ultimoPrecio: number;
}

/** Existencias calculadas: entradas por facturas menos salidas registradas */
export function calcularInventario(): ExistenciaProducto[] {
  const facturas = leerFacturas();
  const salidas = leerSalidas();
  return leerProductos().map((producto) => {
    const movimientos: MovimientoInventario[] = [];
    let ultimoPrecio = 0;
    let fechaPrecio = "";
    for (const f of facturas) {
      for (const l of f.lineas) {
        if (l.productoId !== producto.id) continue;
        if (Number(l.valorUnitario) > 0 && f.fecha >= fechaPrecio) {
          ultimoPrecio = Number(l.valorUnitario);
          fechaPrecio = f.fecha;
        }
        movimientos.push({
          fecha: f.fecha,
          tipo: "entrada",
          cantidad: Number(l.cantidad) || 0,
          detalle: `Factura ${f.numero}${f.proveedor ? ` · ${f.proveedor}` : ""}`,
          facturaId: f.id,
        });
      }
    }
    for (const sd of salidas) {
      if (sd.productoId !== producto.id) continue;
      movimientos.push({ fecha: sd.fecha, hora: sd.hora, tipo: "salida", cantidad: Number(sd.cantidad) || 0, detalle: sd.nota || "Salida", salidaId: sd.id });
    }
    movimientos.sort((a, b) => b.fecha.localeCompare(a.fecha) || (b.hora ?? "").localeCompare(a.hora ?? ""));
    const existencia = movimientos.reduce((s, m) => s + (m.tipo === "entrada" ? m.cantidad : -m.cantidad), 0);
    return { producto, existencia, bajoMinimo: existencia <= producto.minimo, movimientos, ultimoPrecio };
  });
}

/**
 * Pasa los artículos del formato anterior de Bodega al catálogo nuevo:
 * cada artículo se vuelve un producto y su existencia queda como
 * "saldo inicial". Se ejecuta una sola vez.
 */
/** Kilos que trae cada bulto de alimento */
export const KG_POR_BULTO = 40;
export const kgDeCantidad = (cantidad: number, unidad: string) =>
  unidad === "bultos" ? cantidad * KG_POR_BULTO : unidad === "kg" ? cantidad : 0;

/**
 * Consumo de un producto de bodega por un lote de engorde: crea la salida en
 * Bodega y el registro de alimento en el lote (enlazados por salidaId).
 */
export function registrarConsumoLote(datos: { loteId: string; productoId: string; cantidad: number; fecha: string; hora?: string }) {
  const hora = datos.hora || horaActual();
  const item = calcularInventario().find((i) => i.producto.id === datos.productoId);
  const lote = leerLotes().find((l) => l.id === datos.loteId);
  if (!item || !lote) return false;
  const p = item.producto;
  const corral = lote.corralId ? leerCorrales().find((c) => c.id === lote.corralId) : undefined;
  const salidaId = nuevoId();
  guardarSalidas([
    ...leerSalidas(),
    {
      id: salidaId,
      productoId: p.id,
      fecha: datos.fecha,
      hora,
      cantidad: datos.cantidad,
      nota: `${lote.nombre}${corral ? ` · corral ${corral.codigo}` : ""}`,
      loteId: lote.id,
    },
  ]);
  const costo = item.ultimoPrecio ? Math.round(item.ultimoPrecio * datos.cantidad) : 0;
  guardarLotes(
    leerLotes().map((l) =>
      l.id === lote.id
        ? {
            ...l,
            alimento: [
              ...l.alimento,
              {
                fecha: datos.fecha,
                hora,
                kg: kgDeCantidad(datos.cantidad, p.unidad),
                costo: costo || undefined,
                productoId: p.id,
                producto: p.nombre,
                cantidad: datos.cantidad,
                unidad: p.unidad,
                salidaId,
              },
            ],
          }
        : l,
    ),
  );
  return true;
}

/** Elimina una salida de Bodega y, si era consumo de un lote, también su registro de alimento */
export function eliminarSalida(salidaId: string) {
  guardarSalidas(leerSalidas().filter((s) => s.id !== salidaId));
  const lotes = leerLotes();
  if (lotes.some((l) => l.alimento.some((a) => a.salidaId === salidaId))) {
    guardarLotes(lotes.map((l) => ({ ...l, alimento: l.alimento.filter((a) => a.salidaId !== salidaId) })));
  }
}

export function migrarBodegaAnterior(): boolean {
  if (typeof window === "undefined") return false;
  if (localStorage.getItem(CLAVES.productos) !== null) return false;
  const antiguos = leerArticulos();
  if (antiguos.length === 0) return false;
  const productos: ProductoBodega[] = antiguos.map((a) => ({
    id: a.id,
    nombre: a.nombre,
    categoria: a.categoria,
    unidad: a.unidad,
    minimo: a.minimo,
  }));
  const conSaldo = antiguos.filter((a) => a.cantidad > 0);
  localStorage.setItem(CLAVES.productos, JSON.stringify(productos));
  if (conSaldo.length) {
    const factura: Factura = {
      id: nuevoId(),
      numero: "SALDO INICIAL",
      fecha: hoy(),
      lineas: conSaldo.map((a) => ({ productoId: a.id, cantidad: a.cantidad, valorUnitario: 0 })),
      nota: "Existencias traídas de la bodega anterior",
    };
    localStorage.setItem(CLAVES.facturas, JSON.stringify([...leerFacturas(), factura]));
  }
  notificarCambio();
  return true;
}

/** Ajustes */
export const leerAjustes = (): Ajustes => ({
  ...AJUSTES_POR_DEFECTO,
  ...leer<Partial<Ajustes>>(CLAVES.ajustes, {}),
});
export const guardarAjustes = (a: Ajustes) => escribir(CLAVES.ajustes, a);

/** Claves de la app (para respaldo y borrado) */
export function clavesDeLaApp(): string[] {
  if (typeof window === "undefined") return [];
  const fijas: string[] = Object.values(CLAVES).filter((v): v is Exclude<typeof v, (id: string) => string> => typeof v === "string");
  const todas: string[] = [];
  for (let i = 0; i < localStorage.length; i++) {
    const k = localStorage.key(i);
    if (k && (fijas.includes(k) || k.startsWith("historial-"))) todas.push(k);
  }
  return todas;
}

/* ═════════════════════ Suscripción a cambios ═════════════════════
 * Las páginas leen los datos con useDatos(); se recalculan cuando
 * otra página guarda algo, cuando cambia otra pestaña o al volver a la app.
 */
let version = 0;
const oyentes = new Set<() => void>();

export function notificarCambio() {
  version += 1;
  oyentes.forEach((o) => o());
}

function suscribir(oyente: () => void) {
  if (oyentes.size === 0 && typeof window !== "undefined") {
    window.addEventListener("storage", notificarCambio);
    window.addEventListener("focus", notificarCambio);
  }
  oyentes.add(oyente);
  return () => {
    oyentes.delete(oyente);
    if (oyentes.size === 0 && typeof window !== "undefined") {
      window.removeEventListener("storage", notificarCambio);
      window.removeEventListener("focus", notificarCambio);
    }
  };
}

/**
 * Devuelve un número que cambia cada vez que los datos cambian.
 * En el servidor (y en el primer render) vale -1: todavía no hay datos.
 */
export function useVersionDatos() {
  return useSyncExternalStore(
    suscribir,
    () => version,
    () => -1
  );
}

/* ═════════════════════ Utilidades ═════════════════════ */

/** Fecha local de hoy en formato YYYY-MM-DD (no UTC) */
export function hoy(): string {
  const d = new Date();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const dia = String(d.getDate()).padStart(2, "0");
  return `${d.getFullYear()}-${m}-${dia}`;
}

/** Hora local actual en formato HH:MM (24 h) */
export function horaActual(): string {
  const d = new Date();
  return `${String(d.getHours()).padStart(2, "0")}:${String(d.getMinutes()).padStart(2, "0")}`;
}

/** Muestra "14:05" como "2:05 p. m." */
export function formatoHora(hora?: string): string {
  if (!hora || !/^\d{1,2}:\d{2}$/.test(hora)) return "";
  const [h, m] = hora.split(":").map(Number);
  return `${h % 12 || 12}:${String(m).padStart(2, "0")} ${h < 12 ? "a. m." : "p. m."}`;
}

export function sumarDias(fecha: string, dias: number): string {
  const [a, m, d] = fecha.split("-").map(Number);
  const f = new Date(a, (m || 1) - 1, d || 1);
  f.setDate(f.getDate() + dias);
  const mm = String(f.getMonth() + 1).padStart(2, "0");
  const dd = String(f.getDate()).padStart(2, "0");
  return `${f.getFullYear()}-${mm}-${dd}`;
}

export function diasEntre(desde: string, hasta: string): number {
  const a = new Date(`${desde}T00:00:00`).getTime();
  const b = new Date(`${hasta}T00:00:00`).getTime();
  return Math.round((b - a) / 86_400_000);
}

export function formatoFecha(fecha?: string, conAnio = false): string {
  if (!fecha) return "—";
  const d = new Date(`${fecha}T00:00:00`);
  if (Number.isNaN(d.getTime())) return fecha;
  return d.toLocaleDateString("es-CO", {
    day: "numeric",
    month: "short",
    ...(conAnio ? { year: "numeric" } : {}),
  });
}

export function formatoPesos(valor: number): string {
  return new Intl.NumberFormat("es-CO", {
    style: "currency",
    currency: "COP",
    maximumFractionDigits: 0,
  }).format(valor || 0);
}

/** id único que también funciona en http (sin crypto.randomUUID) */
export function nuevoId(): string {
  return `${Date.now().toString(36)}${Math.random().toString(36).slice(2, 8)}`;
}

/* ═════════════════════ Estado reproductivo ═════════════════════ */

export type EstadoCerda =
  | "Gestación"
  | "Lactancia"
  | "Vacía"
  | "En celo"
  | "En tratamiento"
  | "Sin registro"
  | "Fuera del hato";

export const COLOR_ESTADO: Record<EstadoCerda, string> = {
  Gestación: "bg-sky-50 text-sky-700 ring-sky-200",
  Lactancia: "bg-orange-50 text-orange-700 ring-orange-200",
  Vacía: "bg-emerald-50 text-emerald-700 ring-emerald-200",
  "En celo": "bg-pink-50 text-pink-700 ring-pink-200",
  "En tratamiento": "bg-amber-50 text-amber-800 ring-amber-200",
  "Sin registro": "bg-slate-100 text-slate-600 ring-slate-200",
  "Fuera del hato": "bg-slate-100 text-slate-400 ring-slate-200",
};

const EVENTOS_REPRODUCTIVOS: TipoEvento[] = [
  "Inseminación",
  "Confirmación de Gestación",
  "Parto",
  "Destete",
  "Celo",
  "Aborto",
];

export function estadoDeCerda(historial: RegistroCerda[]): EstadoCerda {
  const ultimo = historial[0];
  if (!ultimo) return "Sin registro";
  if (["Baja", "Vendida", "Muerta"].includes(ultimo.tipo)) return "Fuera del hato";
  if (ultimo.tipo === "Tratamiento") return "En tratamiento";
  const repro = historial.find((r) => EVENTOS_REPRODUCTIVOS.includes(r.tipo));
  switch (repro?.tipo) {
    case "Inseminación":
    case "Confirmación de Gestación":
      return "Gestación";
    case "Parto":
      return "Lactancia";
    case "Celo":
      return "En celo";
    case "Destete":
    case "Aborto":
      return "Vacía";
    default:
      return "Sin registro";
  }
}

export function nombreCerda(c: CerdaDatos): string {
  return typeof c.nombre === "string" && c.nombre.trim() ? `${c.id} · ${c.nombre}` : c.id;
}
