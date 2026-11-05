import { useSyncExternalStore } from "react";
import { guardarConRegistro, registrarLog, sinRegistro } from "@/lib/log";
import type { Cerda, Registro } from "@/utils/pendingTasks";
import { CLAVE_PRESTAMOS, granjaActual, leerGranjas } from "@/lib/sincronizar";

/* ═════════════════════ Claves de almacenamiento ═════════════════════
 * Todo se guarda en el navegador (localStorage). Las claves "cerdas",
 * "historial-<id>" y "engorde-lotes" ya las usa el dashboard.
 */
export const CLAVES = {
  cerdas: "cerdas",
  historial: (id: string) => `historial-${id}`,
  lotes: "engorde-lotes",
  secuenciaLotes: "engorde-secuencia-lotes",
  tratamientos: "tratamientos",
  bioChecks: "bioseguridad-checks",
  bioVisitas: "bioseguridad-visitas",
  movimientos: "contabilidad-movimientos",
  cuentasPagar: "contabilidad-cuentas-pagar",
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
  /** Inseminación: fechas de la 1.ª y 2.ª confirmación de gestación */
  confirmacion1?: string;
  confirmacion2?: string;
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
  /** Cantidad que salió sin existencia (con "permitir sin inventario"); se valoró al último precio */
  sinExistencia?: number;
  /** Precio por unidad usado para lo que salió sin existencia (se corrige al llegar la factura) */
  precioProvisional?: number;
  /** Gasto provisional en Contabilidad (como pagado en efectivo) por lo que salió sin existencia */
  movProvisionalId?: string;
}
/** Aplicación sanitaria registrada en el lote */
export interface AplicacionLote {
  id: string;
  fecha: string;
  hora?: string;
  tipo: "Hierro" | string;
  nota?: string;
  /** Medicamento aplicado desde Tratamientos: su costo se suma al lote */
  costo?: number;
  tratamientoId?: string;
}
/** Otro gasto de un lote (medicamento, vacuna, insumo…); se registra también en Contabilidad */
export interface GastoLote {
  id: string;
  fecha: string;
  hora?: string;
  descripcion: string;
  /** Cantidad escrita libremente, p. ej. "2 frascos" */
  cantidad?: string;
  valor: number;
  categoria: string;
  /** Gasto creado en Contabilidad (de contado) */
  movimientoId?: string;
  /** A crédito: cuenta por pagar en Contabilidad (cada abono es un gasto) */
  cuentaId?: string;
}

export interface Lote {
  id: string;
  /** Código consecutivo del lote: LP-00, LP-01, … */
  codigo?: string;
  nombre: string;
  fechaIngreso: string;
  cantidadInicial: number;
  vivos: number;
  pesoInicial: number;
  pesajes: Pesaje[];
  mortalidad: Mortalidad[];
  alimento: Alimento[];
  /** Otros gastos del lote (medicamentos, vacunas, insumos…) */
  gastos?: GastoLote[];
  /** Aplicaciones sanitarias del lote (p. ej. hierro a los lechones) */
  aplicaciones?: AplicacionLote[];
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
  /** Medicamento de Gastos de producción (id del gasto) y su costo */
  gastoId?: string;
  cantidadAnimal?: number;
  unidadDosis?: string;
  animales?: number;
  /** Cantidad usada en la unidad de compra (para saber cuánto queda) */
  cantidadUsada?: number;
  costo?: number;
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
  /** Lote de engorde al que corresponde (p. ej. el ingreso por su venta) */
  loteId?: string;
  /** "produccion": registrado desde Bodega → Gastos de producción */
  origen?: "produccion";
  /** Gastos de producción: unidad de medida (ml, Dosis, Litro), cantidad en número y valor por unidad */
  unidad?: string;
  cantidadNum?: number;
  valorUnitario?: number;
  /** Cantidad escrita libremente (gastos de producción), p. ej. "3 frascos" */
  cantidad?: string;
  /** Cerda a la que corresponde el gasto (p. ej. la genética de una inseminación) */
  cerdaId?: string;
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
  guardarConRegistro(clave, valor);
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
const numeroLote = (codigo?: string) => {
  const m = /^LP-(\d+)$/.exec(codigo ?? "");
  return m ? Number(m[1]) : -1;
};
const formatoCodigoLote = (n: number) => `LP-${String(n).padStart(2, "0")}`;
function leerSecuenciaLotes(): number {
  const n = Number(typeof window === "undefined" ? 0 : localStorage.getItem(CLAVES.secuenciaLotes));
  return Number.isInteger(n) && n > 0 ? n : 0;
}

/** Próximo número de la secuencia (no reutiliza números de lotes eliminados) */
function proximoNumeroLote(lotes: Lote[]): number {
  return Math.max(leerSecuenciaLotes(), ...lotes.map((l) => numeroLote(l.codigo) + 1), 0);
}

/** Código que recibirá el próximo lote (solo para mostrarlo) */
export const siguienteCodigoLote = () => formatoCodigoLote(proximoNumeroLote(leerLotes()));

/** Reserva el próximo código de la secuencia */
export function tomarCodigoLote(): string {
  const n = proximoNumeroLote(leerLotes());
  localStorage.setItem(CLAVES.secuenciaLotes, String(n + 1));
  return formatoCodigoLote(n);
}

/** Nombre para mostrar: "LP-03" o "LP-03 · Lote P-12" */
export function nombreLote(l: Pick<Lote, "codigo" | "nombre">): string {
  const nombre = (l.nombre ?? "").trim();
  if (!l.codigo) return nombre || "Lote";
  return !nombre || nombre === l.codigo ? l.codigo : `${l.codigo} · ${nombre}`;
}

export function leerLotes(): Lote[] {
  const lotes = leerLotesSinCodigo();
  // Los lotes creados antes de la secuencia reciben su código por orden de ingreso
  const sinCodigo = lotes.filter((l) => !l.codigo);
  if (sinCodigo.length && typeof window !== "undefined") {
    let n = Math.max(leerSecuenciaLotes(), ...lotes.map((l) => numeroLote(l.codigo) + 1), 0);
    const orden = [...sinCodigo].sort((a, b) => a.fechaIngreso.localeCompare(b.fechaIngreso));
    for (const l of orden) l.codigo = formatoCodigoLote(n++);
    try {
      localStorage.setItem(CLAVES.lotes, JSON.stringify(lotes));
      localStorage.setItem(CLAVES.secuenciaLotes, String(n));
    } catch {
      // sin almacenamiento: los códigos se recalculan la próxima vez
    }
  }
  return lotes;
}

function leerLotesSinCodigo(): Lote[] {
  return leer<Partial<Lote>[]>(CLAVES.lotes, []).map((l) => ({
    id: l.id ?? nuevoId(),
    codigo: typeof l.codigo === "string" && l.codigo ? l.codigo : undefined,
    nombre: l.origen && l.nombre?.startsWith("Camada ") ? `Lote ${l.nombre.slice(7)}` : (l.nombre ?? "Lote"),
    fechaIngreso: l.fechaIngreso ?? hoy(),
    cantidadInicial: Number(l.cantidadInicial) || Number(l.vivos) || 0,
    vivos: Number(l.vivos) || 0,
    pesoInicial: Number(l.pesoInicial) || 0,
    pesajes: Array.isArray(l.pesajes) ? l.pesajes : [],
    mortalidad: Array.isArray(l.mortalidad) ? l.mortalidad : [],
    alimento: Array.isArray(l.alimento) ? l.alimento : [],
    gastos: Array.isArray(l.gastos) ? l.gastos : [],
    aplicaciones: Array.isArray(l.aplicaciones) ? l.aplicaciones : undefined,
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
    codigo: tomarCodigoLote(),
    nombre: `Lote ${datos.codigoParto}`,
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

/** Lotes creados automáticamente desde un parto (por código de parto) */
export const lotesDeParto = (codigoParto: string) => leerLotes().filter((l) => l.origen?.codigoParto === codigoParto);

/**
 * Borra los lotes automáticos de los partos indicados (o de todos los partos
 * de una cerda). Devuelve los lotes borrados.
 */
export function eliminarLotesDePartos(filtro: { codigos?: string[]; cerdaId?: string }): Lote[] {
  const lotes = leerLotes();
  const borrar = lotes.filter(
    (l) => l.origen && ((filtro.codigos && filtro.codigos.includes(l.origen.codigoParto)) || (filtro.cerdaId && l.origen.cerdaId === filtro.cerdaId)),
  );
  for (const l of borrar) eliminarLoteCompleto(l.id);
  return borrar;
}

/** Lo que se devuelve al eliminar un lote (para avisar antes) */
export function resumenEliminarLote(loteId: string) {
  const lote = leerLotes().find((l) => l.id === loteId);
  if (!lote) return null;
  const salidas = new Set([...lote.alimento.map((a) => a.salidaId).filter(Boolean), ...leerSalidas().filter((s) => s.loteId === loteId).map((s) => s.id)]);
  const productos = new Map<string, { nombre: string; unidad: string; cantidad: number }>();
  const porId = new Map(leerProductos().map((p) => [p.id, p]));
  for (const sd of leerSalidas()) {
    if (!salidas.has(sd.id)) continue;
    const p = porId.get(sd.productoId);
    const k = sd.productoId;
    const x = productos.get(k) ?? { nombre: p?.nombre ?? "Producto", unidad: p?.unidad ?? "", cantidad: 0 };
    x.cantidad += Number(sd.cantidad) || 0;
    productos.set(k, x);
  }
  const gastos = (lote.gastos ?? []).reduce((t, g) => t + (Number(g.valor) || 0), 0);
  const provisional = lote.alimento.reduce((t, a) => {
    const m = a.movProvisionalId ? leerMovimientos().find((x) => x.id === a.movProvisionalId) : undefined;
    return t + (m?.monto ?? 0);
  }, 0);
  const ingresos = leerMovimientos().filter((m) => m.loteId === loteId && m.tipo === "ingreso").length;
  return { lote, productos: [...productos.values()], gastos, provisional, ingresos };
}

/**
 * Elimina un lote y deshace lo que registró en Bodega y Contabilidad:
 * el alimento vuelve al inventario (se borran sus salidas), se quitan los
 * gastos del lote (de contado o a crédito, con sus abonos) y los gastos
 * provisionales de lo que salió sin existencia. Los ingresos del lote se
 * conservan en Contabilidad pero quedan sin lote.
 */
export function eliminarLoteCompleto(loteId: string) {
  const lote = leerLotes().find((l) => l.id === loteId);
  if (!lote) return;
  // 1) Bodega: el alimento vuelve a la existencia
  const salidas = new Set([...lote.alimento.map((a) => a.salidaId).filter(Boolean), ...leerSalidas().filter((s) => s.loteId === loteId).map((s) => s.id)]);
  if (salidas.size) guardarSalidas(leerSalidas().filter((s) => !salidas.has(s.id)));
  // 2) Contabilidad: gastos del lote, créditos con sus abonos y gastos provisionales
  const quitar = new Set<string>();
  const cuentas = new Set<string>();
  for (const g of lote.gastos ?? []) {
    if (g.movimientoId) quitar.add(g.movimientoId);
    if (g.cuentaId) cuentas.add(g.cuentaId);
  }
  for (const a of lote.alimento) if (a.movProvisionalId) quitar.add(a.movProvisionalId);
  if (cuentas.size) {
    for (const c of leerCuentasPorPagar()) if (cuentas.has(c.id)) for (const ab of c.abonos) if (ab.movimientoId) quitar.add(ab.movimientoId);
    guardarCuentasPorPagar(leerCuentasPorPagar().filter((c) => !cuentas.has(c.id)));
  }
  const movs = leerMovimientos();
  const nuevos = movs
    .filter((m) => !quitar.has(m.id))
    .map((m) => (m.loteId === loteId ? { ...m, loteId: undefined, descripcion: m.descripcion } : m));
  if (nuevos.length !== movs.length || movs.some((m) => m.loteId === loteId)) guardarMovimientos(nuevos);
  // 3) El lote
  guardarLotes(leerLotes().filter((l) => l.id !== loteId));
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
  /** Código compartido: productos con el mismo código usan un solo inventario */
  codigo?: string;
  /** Kilos que trae cada unidad (para bultos; 40 por defecto) */
  kgPorUnidad?: number;
  /** false = desactivado (no aparece en Bodega, facturas ni consumos) */
  activo?: boolean;
  /** Producto de la lista fija de la granja (no se puede eliminar) */
  preestablecido?: boolean;
}

/** Productos preestablecidos de la granja */
export const PRODUCTOS_PREESTABLECIDOS: ProductoBodega[] = [
  { id: "pre-PR-01", codigo: "PR-01", nombre: "Preiniciación Cerdos", categoria: "Alimento", unidad: "bultos", kgPorUnidad: 40, minimo: 0, activo: true, preestablecido: true },
  { id: "pre-IN-01", codigo: "IN-01", nombre: "Iniciación Cerdos", categoria: "Alimento", unidad: "bultos", kgPorUnidad: 40, minimo: 0, activo: true, preestablecido: true },
  { id: "pre-ML-01", codigo: "ML-01", nombre: "Maxi lechones 337", categoria: "Alimento", unidad: "bultos", kgPorUnidad: 40, minimo: 0, activo: true, preestablecido: true },
  { id: "pre-MC-01", codigo: "MC-01", nombre: "Maxi Cerdos 337 Fin.", categoria: "Alimento", unidad: "bultos", kgPorUnidad: 40, minimo: 0, activo: true, preestablecido: true },
  { id: "pre-CG-01", codigo: "CG-01", nombre: "Maxi Cerdas Gestación", categoria: "Alimento", unidad: "bultos", kgPorUnidad: 40, minimo: 0, activo: true, preestablecido: true },
  { id: "pre-CL-01", codigo: "CL-01", nombre: "Maxi Cerdas Lactancia", categoria: "Alimento", unidad: "bultos", kgPorUnidad: 40, minimo: 0, activo: true, preestablecido: true },
];
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
  /** id del gasto creado en Contabilidad, si se registró (de contado) */
  movimientoId?: string;
  /** Método de pago; sin valor = de contado (facturas anteriores) */
  pago?: "contado" | "credito";
  /** Si los pagos se registran como gasto en Contabilidad */
  registrarGasto?: boolean;
  /** Abonos de una factura a crédito */
  abonos?: AbonoFactura[];
}
export interface AbonoFactura {
  id: string;
  fecha: string;
  monto: number;
  nota?: string;
  /** Gasto creado en Contabilidad por este abono */
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

/** Todos los productos (los preestablecidos siempre están, activos o no) */
export function leerProductos(): ProductoBodega[] {
  let guardados = leer<ProductoBodega[]>(CLAVES.productos, []);
  // Una sola vez: los preestablecidos guardados con el mínimo anterior (2) pasan a 0
  if (typeof window !== "undefined" && !localStorage.getItem("bodega-minimo-0")) {
    guardados = guardados.map((g) => (g.id?.startsWith("pre-") && g.minimo === 2 ? { ...g, minimo: 0 } : g));
    try {
      if (localStorage.getItem(CLAVES.productos) !== null) localStorage.setItem(CLAVES.productos, JSON.stringify(guardados));
      localStorage.setItem("bodega-minimo-0", "1");
    } catch {
      // sin almacenamiento
    }
  }
  const faltan = PRODUCTOS_PREESTABLECIDOS.filter((pre) => !guardados.some((g) => g.id === pre.id));
  return [
    ...guardados.map((g) => {
      const pre = PRODUCTOS_PREESTABLECIDOS.find((x) => x.id === g.id);
      // Los preestablecidos conservan nombre, código y unidad de la lista
      return pre ? { ...g, nombre: pre.nombre, codigo: pre.codigo, unidad: pre.unidad, categoria: pre.categoria, preestablecido: true } : g;
    }),
    ...faltan,
  ];
}
/** Solo los productos activos */
export const leerProductosActivos = () => leerProductos().filter((p) => p.activo !== false);
/** Código normalizado (vacío = el producto no comparte inventario) */
export const codigoDe = (p: ProductoBodega) => (p.codigo ?? "").trim().toUpperCase();
/** Kilos por unidad del producto: kg = 1, bultos = kgPorUnidad (40), otras unidades = 1 */
export const factorKg = (p: ProductoBodega) => (p.unidad === "bultos" ? Number(p.kgPorUnidad) || KG_POR_BULTO : 1);
export const guardarProductos = (p: ProductoBodega[]) => escribir(CLAVES.productos, p);
export function leerFacturas(): Factura[] {
  return leer<Factura[]>(CLAVES.facturas, []).map((f) => ({
    ...f,
    lineas: Array.isArray(f.lineas) ? f.lineas : [],
    abonos: Array.isArray(f.abonos) ? f.abonos : undefined,
  }));
}
export const guardarFacturas = (f: Factura[]) => escribir(CLAVES.facturas, f);
export const leerSalidas = () => leer<SalidaBodega[]>(CLAVES.salidas, []);
export const guardarSalidas = (s: SalidaBodega[]) => escribir(CLAVES.salidas, s);

export const totalFactura = (f: Factura) =>
  f.lineas.reduce((s, l) => s + (Number(l.cantidad) || 0) * (Number(l.valorUnitario) || 0), 0);
/** Gasto registrado a crédito en Contabilidad: se paga con abonos (cada abono es un gasto) */
export interface CuentaPorPagar {
  id: string;
  fecha: string;
  descripcion: string;
  categoria: string;
  total: number;
  abonos: AbonoFactura[];
  /** Compra de Gastos de producción a crédito (Bodega) */
  origen?: "produccion";
  cantidad?: string;
  unidad?: string;
  cantidadNum?: number;
  valorUnitario?: number;
}
export const leerCuentasPorPagar = () =>
  leer<CuentaPorPagar[]>(CLAVES.cuentasPagar, []).map((c) => ({ ...c, abonos: Array.isArray(c.abonos) ? c.abonos : [] }));
export const guardarCuentasPorPagar = (c: CuentaPorPagar[]) => escribir(CLAVES.cuentasPagar, c);
export const saldoCuenta = (c: CuentaPorPagar) => Math.max(0, (Number(c.total) || 0) - c.abonos.reduce((s, a) => s + (Number(a.monto) || 0), 0));

/** Lo abonado a una factura a crédito */
export const abonadoFactura = (f: Factura) => (f.abonos ?? []).reduce((s, a) => s + (Number(a.monto) || 0), 0);
/** Lo que falta por pagar (0 en las de contado) */
export const saldoFactura = (f: Factura) => (f.pago === "credito" ? Math.max(0, totalFactura(f) - abonadoFactura(f)) : 0);

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
  /** Existencia propia. En un subproducto (kilos de un bulto) es lo consumido, en negativo */
  existencia: number;
  /** Lo que se puede usar: en un subproducto, lo que queda del producto principal en esta unidad */
  disponible: number;
  /** Si es subproducto (kilos que se descuentan del bulto con el mismo código) */
  subproducto?: { principal: string };
  /** Se compró alguna vez y ahora está en el mínimo o por debajo (va a "Por reponer") */
  bajoMinimo: boolean;
  /** Nunca ha tenido entradas: no cuenta como agotado ni por reponer */
  sinCompras: boolean;
  movimientos: MovimientoInventario[];
  /** Valor unitario de la compra más reciente con precio (0 si no hay) */
  ultimoPrecio: number;
}

/** De qué factura salió cada salida de bodega (primero lo que entró primero) */
export interface TrazaSalida {
  salida: SalidaBodega;
  producto: ProductoBodega;
  lote?: Lote;
  /** Partes de la salida por factura, en la unidad del producto */
  partes: { factura: Factura; cantidad: number; valor: number }[];
  /** Lo que salió sin compra registrada (sin factura) */
  sinFactura: number;
  valor: number;
}

/**
 * Reparte cada salida entre las facturas con el método "primero en entrar,
 * primero en salir": si una salida se lleva lo último de una factura y sigue
 * con la siguiente, aparecen las dos. Los productos con el mismo código
 * comparten las facturas (todo se cuenta en kilos o en la unidad común).
 */
export function trazabilidadSalidas(): TrazaSalida[] {
  const productos = leerProductos();
  const porId = new Map(productos.map((p) => [p.id, p]));
  const grupoDe = (p: ProductoBodega) => codigoDe(p) || `#${p.id}`;
  const lotes = new Map(leerLotes().map((l) => [l.id, l]));
  // Entradas por grupo, en orden de llegada
  const entradas = new Map<string, { factura: Factura; base: number; precioBase: number }[]>();
  const facturas = [...leerFacturas()].sort((a, b) => a.fecha.localeCompare(b.fecha) || (a.id < b.id ? -1 : 1));
  for (const f of facturas) {
    for (const l of f.lineas) {
      const p = porId.get(l.productoId);
      if (!p) continue;
      const k = grupoDe(p);
      const fk = factorKg(p);
      const base = (Number(l.cantidad) || 0) * fk;
      if (base <= 0) continue;
      entradas.set(k, [...(entradas.get(k) ?? []), { factura: f, base, precioBase: (Number(l.valorUnitario) || 0) / fk }]);
    }
  }
  const restante = new Map<string, { factura: Factura; base: number; precioBase: number }[]>();
  for (const [k, v] of entradas) restante.set(k, v.map((e) => ({ ...e })));
  const salidas = [...leerSalidas()].sort((a, b) => `${a.fecha} ${a.hora ?? "00:00"}`.localeCompare(`${b.fecha} ${b.hora ?? "00:00"}`) || (a.id < b.id ? -1 : 1));
  const resultado: TrazaSalida[] = [];
  for (const sd of salidas) {
    const p = porId.get(sd.productoId);
    if (!p) continue;
    const fk = factorKg(p);
    let falta = (Number(sd.cantidad) || 0) * fk;
    const cola = restante.get(grupoDe(p)) ?? [];
    const partes: TrazaSalida["partes"] = [];
    for (const e of cola) {
      if (falta <= 1e-9) break;
      if (e.base <= 1e-9) continue;
      const toma = Math.min(e.base, falta);
      e.base -= toma;
      falta -= toma;
      const previa = partes.find((x) => x.factura.id === e.factura.id);
      if (previa) {
        previa.cantidad += toma / fk;
        previa.valor += toma * e.precioBase;
      } else partes.push({ factura: e.factura, cantidad: toma / fk, valor: toma * e.precioBase });
    }
    resultado.push({
      salida: sd,
      producto: p,
      lote: sd.loteId ? lotes.get(sd.loteId) : undefined,
      partes,
      sinFactura: Math.max(0, falta / fk),
      valor: partes.reduce((t, x) => t + x.valor, 0),
    });
  }
  return resultado.reverse();
}

/**
 * Existencias calculadas: entradas por facturas menos salidas registradas.
 * Los productos con el mismo código comparten inventario: todo se suma en
 * kilos (o en la unidad común) y se muestra en la unidad de cada producto.
 * Ej.: 10 bultos de 40 kg y una salida de 20 kg del producto en kilos → 9,5 bultos.
 */
export function calcularInventario(opciones: { incluirInactivos?: boolean; excluirSalida?: string } = {}): ExistenciaProducto[] {
  const facturas = leerFacturas();
  const salidas = leerSalidas().filter((s) => !opciones.excluirSalida || s.id !== opciones.excluirSalida);
  const productos = leerProductos();
  const grupoDe = (p: ProductoBodega) => codigoDe(p) || `#${p.id}`;
  const porId = new Map(productos.map((p) => [p.id, p]));

  // Movimientos de cada grupo, en la unidad base (kilos para bultos/kg)
  type Base = MovimientoInventario & { base: number; origen: ProductoBodega; precioBase?: number };
  const grupos = new Map<string, Base[]>();
  const agregar = (p: ProductoBodega, m: Base) => {
    const k = grupoDe(p);
    grupos.set(k, [...(grupos.get(k) ?? []), m]);
  };
  for (const f of facturas) {
    for (const l of f.lineas) {
      const p = porId.get(l.productoId);
      if (!p) continue;
      const cantidad = Number(l.cantidad) || 0;
      const valor = Number(l.valorUnitario) || 0;
      agregar(p, {
        fecha: f.fecha,
        tipo: "entrada",
        cantidad,
        base: cantidad * factorKg(p),
        detalle: `Factura ${f.numero}${f.proveedor ? ` · ${f.proveedor}` : ""}`,
        facturaId: f.id,
        origen: p,
        precioBase: valor > 0 ? valor / factorKg(p) : undefined,
      });
    }
  }
  for (const sd of salidas) {
    const p = porId.get(sd.productoId);
    if (!p) continue;
    const cantidad = Number(sd.cantidad) || 0;
    agregar(p, {
      fecha: sd.fecha,
      hora: sd.hora,
      tipo: "salida",
      cantidad,
      base: cantidad * factorKg(p),
      detalle: sd.nota || "Salida",
      salidaId: sd.id,
      origen: p,
    });
  }

  // Préstamos entre granjas: salen de la que presta y entran a la que recibe (y al revés al devolver)
  const granja = granjaActual();
  const productoPorCodigo = (codigo: string) =>
    productos.find((p) => codigoDe(p) === codigo && p.unidad === "bultos") ?? productos.find((p) => codigoDe(p) === codigo);
  for (const pr of leerPrestamos()) {
    if (pr.de !== granja && pr.a !== granja) continue;
    const p = productoPorCodigo(pr.codigo);
    if (!p) continue;
    const presto = pr.de === granja;
    const cantidad = Number(pr.cantidad) || 0;
    agregar(p, {
      fecha: pr.fecha,
      hora: pr.hora,
      tipo: presto ? "salida" : "entrada",
      cantidad,
      base: cantidad * factorKg(p),
      detalle: presto ? `Préstamo a ${pr.aNombre}` : `Préstamo de ${pr.deNombre}`,
      origen: p,
      precioBase: !presto && pr.valorUnitario > 0 ? pr.valorUnitario / factorKg(p) : undefined,
    });
    for (const d of pr.devoluciones ?? []) {
      const c = Number(d.cantidad) || 0;
      agregar(p, {
        fecha: d.fecha,
        hora: d.hora,
        tipo: presto ? "entrada" : "salida",
        cantidad: c,
        base: c * factorKg(p),
        detalle: presto ? `Devolución de ${pr.aNombre}` : `Devolución a ${pr.deNombre}`,
        origen: p,
      });
    }
  }

  return productos
    .filter((p) => opciones.incluirInactivos || p.activo !== false)
    .map((producto) => {
      const f = factorKg(producto);
      const lista = grupos.get(grupoDe(producto)) ?? [];
      // Último precio de compra, pasado a la unidad de este producto
      let ultimoPrecio = 0;
      let fechaPrecio = "";
      for (const m of lista) {
        if (m.precioBase !== undefined && m.fecha >= fechaPrecio) {
          ultimoPrecio = m.precioBase * f;
          fechaPrecio = m.fecha;
        }
      }
      // Subproducto: producto en kilos cuyo código pertenece a un producto en bultos
      const principal = producto.unidad === "kg" ? productos.find((o) => o.id !== producto.id && o.unidad === "bultos" && grupoDe(o) === grupoDe(producto)) : undefined;
      const propios = principal ? lista.filter((m) => m.origen.id === producto.id) : lista;
      const movimientos: MovimientoInventario[] = propios.map((m) => ({
        fecha: m.fecha,
        hora: m.hora,
        tipo: m.tipo,
        cantidad: m.base / f,
        detalle: m.origen.id === producto.id ? m.detalle : `${m.detalle} · ${fmtNum(m.cantidad)} ${m.origen.unidad} de ${m.origen.nombre}`,
        facturaId: m.facturaId,
        salidaId: m.salidaId,
      }));
      movimientos.sort((a, b) => b.fecha.localeCompare(a.fecha) || (b.hora ?? "").localeCompare(a.hora ?? ""));
      const neto = (l: typeof lista) => l.reduce((s, m) => s + (m.tipo === "entrada" ? m.base : -m.base), 0) / f;
      const disponible = neto(lista);
      const sinCompras = !lista.some((m) => m.tipo === "entrada");
      if (principal) {
        return { producto, existencia: neto(propios), disponible, subproducto: { principal: principal.nombre }, bajoMinimo: false, sinCompras, movimientos, ultimoPrecio };
      }
      return { producto, existencia: disponible, disponible, bajoMinimo: !sinCompras && disponible <= producto.minimo, sinCompras, movimientos, ultimoPrecio };
    });
}
const fmtNum = (n: number) => n.toLocaleString("es-CO", { maximumFractionDigits: 2 });

/**
 * Pasa los artículos del formato anterior de Bodega al catálogo nuevo:
 * cada artículo se vuelve un producto y su existencia queda como
 * "saldo inicial". Se ejecuta una sola vez.
 */
/* ───────────── Gasto de genética (contado o crédito) ───────────── */

/** Enlace del gasto de una genética con Contabilidad: movimiento (contado) o cuenta por pagar (crédito) */
export interface GastoGenetica {
  movimientoId?: string;
  cuentaId?: string;
}

export function registrarGastoGenetica(d: { fecha: string; descripcion: string; monto: number; cerdaId: string; pago: "contado" | "credito" }): GastoGenetica {
  if (d.pago === "credito") {
    const cuentaId = nuevoId();
    guardarCuentasPorPagar([...leerCuentasPorPagar(), { id: cuentaId, fecha: d.fecha, descripcion: d.descripcion, categoria: "Genética", total: d.monto, abonos: [] }]);
    return { cuentaId };
  }
  const movimientoId = nuevoId();
  guardarMovimientos([
    ...leerMovimientos(),
    { id: movimientoId, fecha: d.fecha, tipo: "gasto", categoria: "Genética", descripcion: d.descripcion, monto: d.monto, cerdaId: d.cerdaId },
  ]);
  return { movimientoId };
}

export function actualizarGastoGenetica(g: GastoGenetica, cambios: { monto?: number; descripcion?: string; fecha?: string; categoria?: string; sinCerda?: boolean }) {
  if (g.movimientoId) {
    guardarMovimientos(
      leerMovimientos().map((m) => {
        if (m.id !== g.movimientoId) return m;
        const n = { ...m, ...(cambios.monto !== undefined ? { monto: cambios.monto } : {}), ...(cambios.descripcion ? { descripcion: cambios.descripcion } : {}), ...(cambios.fecha ? { fecha: cambios.fecha } : {}), ...(cambios.categoria ? { categoria: cambios.categoria } : {}) };
        if (cambios.sinCerda) delete n.cerdaId;
        return n;
      })
    );
  }
  if (g.cuentaId) {
    guardarCuentasPorPagar(
      leerCuentasPorPagar().map((c) =>
        c.id === g.cuentaId
          ? { ...c, ...(cambios.monto !== undefined ? { total: cambios.monto } : {}), ...(cambios.descripcion ? { descripcion: cambios.descripcion } : {}), ...(cambios.fecha ? { fecha: cambios.fecha } : {}), ...(cambios.categoria ? { categoria: cambios.categoria } : {}) }
          : c
      )
    );
  }
}

/** Quita el gasto de una genética de Contabilidad (y los abonos si era a crédito) */
export function quitarGastoGenetica(g: GastoGenetica) {
  const quitar = new Set<string>();
  if (g.movimientoId) quitar.add(g.movimientoId);
  if (g.cuentaId) {
    const cuenta = leerCuentasPorPagar().find((c) => c.id === g.cuentaId);
    for (const a of cuenta?.abonos ?? []) if (a.movimientoId) quitar.add(a.movimientoId);
    guardarCuentasPorPagar(leerCuentasPorPagar().filter((c) => c.id !== g.cuentaId));
  }
  if (quitar.size) guardarMovimientos(leerMovimientos().filter((m) => !quitar.has(m.id)));
}

/* ───────────── Genética comprada que no se usó ───────────── */

/** Días que dura la genética comprada: después pasa sola a Pérdidas en Contabilidad */
export const DIAS_VENCE_GENETICA = 10;

export interface GeneticaPerdida {
  genetica: string;
  valor: number;
  /** Fecha de compra */
  fecha: string;
  /** Día en que pasó a pérdida */
  vencio: string;
  movimientoId?: string;
  cuentaId?: string;
}

/**
 * Genética comprada sin inseminación después de DIAS_VENCE_GENETICA días: se daña.
 * El gasto pasa a la categoría "Pérdidas" (deja de ser costo de la cerda) y en la
 * cerda queda el registro "Genética no usada". Devuelve cuántas vencieron.
 */
export function vencerGeneticasPendientes(): number {
  const cerdas = leerCerdas();
  const hoyIso = hoy();
  const vencidas = cerdas.filter((c) => {
    const g = (c as { geneticaPendiente?: { fecha?: string } }).geneticaPendiente;
    return g?.fecha && diasEntre(g.fecha, hoyIso) >= DIAS_VENCE_GENETICA;
  });
  if (vencidas.length === 0) return 0;
  const movs = leerMovimientos();
  let cambioMovs = false;
  const nuevas = cerdas.map((c) => {
    const g = (c as { geneticaPendiente?: { genetica: string; valor: number; fecha: string; movimientoId?: string } }).geneticaPendiente;
    if (!g?.fecha || diasEntre(g.fecha, hoyIso) < DIAS_VENCE_GENETICA) return c;
    const vencio = sumarDias(g.fecha, DIAS_VENCE_GENETICA);
    if (g.movimientoId) {
      const m = movs.find((x) => x.id === g.movimientoId);
      if (m) {
        m.categoria = "Pérdidas";
        m.descripcion = `Genética ${g.genetica} no usada (se dañó) · cerda ${c.id}`;
        delete m.cerdaId;
        cambioMovs = true;
      }
    }
    const cuentaId = (g as { cuentaId?: string }).cuentaId;
    if (cuentaId) actualizarGastoGenetica({ cuentaId }, { categoria: "Pérdidas", descripcion: `Genética ${g.genetica} no usada (se dañó) · cerda ${c.id}` });
    const { geneticaPendiente: _g, ...resto } = c as Record<string, unknown>;
    const previas = (c as unknown as { geneticasPerdidas?: unknown }).geneticasPerdidas;
    const perdidas = Array.isArray(previas) ? (previas as GeneticaPerdida[]) : [];
    return { ...resto, geneticasPerdidas: [...perdidas, { genetica: g.genetica, valor: g.valor, fecha: g.fecha, vencio, movimientoId: g.movimientoId, cuentaId }] } as unknown as CerdaDatos;
  });
  if (cambioMovs) guardarMovimientos(movs);
  guardarCerdas(nuevas);
  return vencidas.length;
}

/* ───────────── Préstamos de bultos entre granjas ───────────── */

export interface DevolucionPrestamo {
  id: string;
  fecha: string;
  hora?: string;
  cantidad: number;
}
/** Préstamo de una bodega a otra (común a todas las granjas) */
export interface PrestamoBodega {
  id: string;
  de: string;
  deNombre: string;
  a: string;
  aNombre: string;
  codigo: string;
  nombre: string;
  unidad: string;
  cantidad: number;
  /** Último precio de la granja que presta (para valorar lo recibido) */
  valorUnitario: number;
  fecha: string;
  hora?: string;
  devoluciones: DevolucionPrestamo[];
}
export function leerPrestamos(): PrestamoBodega[] {
  const v = leer<PrestamoBodega[]>(CLAVE_PRESTAMOS, []);
  return Array.isArray(v) ? v.filter((p) => p && p.id && p.de && p.a && p.codigo) : [];
}
const guardarPrestamos = (l: PrestamoBodega[]) => escribir(CLAVE_PRESTAMOS, l);
export const pendientePrestamo = (p: PrestamoBodega) =>
  Math.max(0, (Number(p.cantidad) || 0) - (p.devoluciones ?? []).reduce((s, d) => s + (Number(d.cantidad) || 0), 0));
const nombreGranja = (id: string) => leerGranjas().find((g) => g.id === id)?.nombre ?? id;

/** Presta a otra granja: sale de esta bodega y entra a la otra */
export function prestarProducto(productoId: string, aGranja: string, cantidad: number): string | null {
  const item = calcularInventario().find((i) => i.producto.id === productoId);
  if (!item) return "Producto no encontrado";
  const codigo = codigoDe(item.producto);
  if (!codigo) return "El producto necesita un código para prestarlo (así lo reconoce la otra granja)";
  if (!(cantidad > 0)) return "Escribe una cantidad mayor que cero";
  if (cantidad > item.disponible + 1e-9) return `Solo hay ${fmtNum(item.disponible)} ${item.producto.unidad} en bodega`;
  const de = granjaActual();
  if (aGranja === de) return "Elige otra granja";
  guardarPrestamos([
    ...leerPrestamos(),
    {
      id: nuevoId(),
      de,
      deNombre: nombreGranja(de),
      a: aGranja,
      aNombre: nombreGranja(aGranja),
      codigo,
      nombre: item.producto.nombre,
      unidad: item.producto.unidad,
      cantidad,
      valorUnitario: item.ultimoPrecio || 0,
      fecha: hoy(),
      hora: horaActual(),
      devoluciones: [],
    },
  ]);
  return null;
}

/** Devuelve (todo o parte) de un préstamo recibido, según lo que haya en esta bodega */
export function devolverPrestamo(prestamoId: string, cantidad: number): string | null {
  const lista = leerPrestamos();
  const pr = lista.find((p) => p.id === prestamoId);
  if (!pr || pr.a !== granjaActual()) return "Préstamo no encontrado";
  const falta = pendientePrestamo(pr);
  if (!(cantidad > 0)) return "Escribe una cantidad mayor que cero";
  if (cantidad > falta + 1e-9) return `Solo se deben ${fmtNum(falta)} ${pr.unidad}`;
  const item = calcularInventario().find((i) => codigoDe(i.producto) === pr.codigo && !i.subproducto);
  if (!item || cantidad > item.disponible + 1e-9) return `No hay suficiente ${pr.nombre} en bodega para devolver`;
  guardarPrestamos(
    lista.map((p) => (p.id === prestamoId ? { ...p, devoluciones: [...(p.devoluciones ?? []), { id: nuevoId(), fecha: hoy(), hora: horaActual(), cantidad }] } : p))
  );
  return null;
}

/** Kilos que trae cada bulto de alimento */
export const KG_POR_BULTO = 40;
export const kgDeCantidad = (cantidad: number, unidad: string, kgPorUnidad?: number) =>
  unidad === "bultos" ? cantidad * (Number(kgPorUnidad) || KG_POR_BULTO) : unidad === "kg" ? cantidad : 0;

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
  // Sin existencia y sin precio de ninguna factura: "Sin valor de referencia", no se registra
  if (datos.cantidad > Math.max(0, item.disponible) + 1e-9 && !(item.ultimoPrecio > 0)) return false;
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
      nota: `${nombreLote(lote)}${corral ? ` · corral ${corral.codigo}` : ""}`,
      loteId: lote.id,
    },
  ]);
  const costo = item.ultimoPrecio ? Math.round(item.ultimoPrecio * datos.cantidad) : 0;
  // Lo que sale sin existencia se valora al último precio y queda pendiente de la próxima factura
  const faltante = Math.max(0, datos.cantidad - Math.max(0, item.disponible));
  // Mientras llega la factura, lo que salió sin existencia se registra como gasto pagado en efectivo
  let movProvisionalId: string | undefined;
  const montoProvisional = Math.round(faltante * (item.ultimoPrecio || 0));
  if (faltante > 1e-9 && montoProvisional > 0) {
    movProvisionalId = nuevoId();
    guardarMovimientos([
      ...leerMovimientos(),
      {
        id: movProvisionalId,
        fecha: datos.fecha,
        tipo: "gasto",
        categoria: categoriaContable(p.categoria),
        descripcion: `Sin existencia · ${fmtNum(faltante)} ${p.unidad} ${p.nombre} · ${nombreLote(lote)}`,
        monto: montoProvisional,
      },
    ]);
  }
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
                kg: kgDeCantidad(datos.cantidad, p.unidad, p.kgPorUnidad),
                costo: costo || undefined,
                productoId: p.id,
                producto: p.nombre,
                cantidad: datos.cantidad,
                unidad: p.unidad,
                salidaId,
                ...(faltante > 1e-9 ? { sinExistencia: faltante, precioProvisional: item.ultimoPrecio || 0, movProvisionalId } : {}),
              },
            ],
          }
        : l,
    ),
  );
  return true;
}

/**
 * Al ingresar una factura: lo que había salido sin existencia de esos productos
 * se vuelve a valorar con el precio de la factura, solo si el precio cambió.
 * Se reparte la cantidad de la factura en orden (primero lo más antiguo).
 * Devuelve cuántos registros de alimento se corrigieron.
 */
/** Categoría de Contabilidad según el tipo de producto de bodega */
const categoriaContable = (c: CategoriaBodega) =>
  c === "Alimento" ? "Alimento" : c === "Medicamentos" || c === "Vacunas" ? "Medicamentos y vacunas" : "Otros gastos";

export function recontabilizarSinExistencia(factura: Factura): number {
  const productos = leerProductos();
  const porId = new Map(productos.map((p) => [p.id, p]));
  const grupoDe = (p: ProductoBodega) => codigoDe(p) || `#${p.id}`;
  // Cantidad y precio (en la unidad base) que trae la factura, por grupo
  const llega = new Map<string, { base: number; precioBase: number }>();
  for (const l of factura.lineas) {
    const p = porId.get(l.productoId);
    if (!p) continue;
    const fk = factorKg(p);
    const k = grupoDe(p);
    const previo = llega.get(k);
    const base = (Number(l.cantidad) || 0) * fk;
    if (base <= 0) continue;
    llega.set(k, { base: (previo?.base ?? 0) + base, precioBase: (Number(l.valorUnitario) || 0) / fk });
  }
  if (llega.size === 0) return 0;

  const lotes = leerLotes();
  const pendientes: { loteId: string; i: number; fecha: string; hora: string }[] = [];
  for (const l of lotes)
    l.alimento.forEach((a, i) => {
      const p = a.productoId ? porId.get(a.productoId) : undefined;
      if (p && (a.sinExistencia ?? 0) > 1e-9 && llega.has(grupoDe(p))) pendientes.push({ loteId: l.id, i, fecha: a.fecha, hora: a.hora ?? "" });
    });
  if (pendientes.length === 0) return 0;
  pendientes.sort((x, y) => `${x.fecha} ${x.hora}`.localeCompare(`${y.fecha} ${y.hora}`));

  let corregidos = 0;
  const cambios = new Map<string, Map<number, Alimento>>();
  const ajustesProvisionales = new Map<string, { quitar: number; borrar: boolean }>();
  for (const pe of pendientes) {
    const lote = lotes.find((l) => l.id === pe.loteId)!;
    const a = lote.alimento[pe.i];
    const p = porId.get(a.productoId!)!;
    const fk = factorKg(p);
    const g = llega.get(grupoDe(p))!;
    if (g.base <= 1e-9) continue;
    const faltaBase = (a.sinExistencia ?? 0) * fk;
    const tomaBase = Math.min(faltaBase, g.base);
    g.base -= tomaBase;
    const toma = tomaBase / fk;
    const precioNuevo = g.precioBase * fk;
    const precioViejo = a.precioProvisional ?? 0;
    const resto = Math.max(0, (a.sinExistencia ?? 0) - toma);
    const nuevo: Alimento = {
      ...a,
      sinExistencia: resto > 1e-9 ? resto : undefined,
      precioProvisional: resto > 1e-9 ? precioViejo : undefined,
      movProvisionalId: resto > 1e-9 ? a.movProvisionalId : undefined,
    };
    // El gasto provisional (efectivo) de lo que ya cubre la factura se quita: la factura lo
    // contabiliza como corresponde (de contado o a crédito, con sus abonos)
    if (a.movProvisionalId) ajustesProvisionales.set(a.movProvisionalId, { quitar: Math.round(toma * precioViejo), borrar: resto <= 1e-9 });
    if (Math.abs(precioNuevo - precioViejo) >= 0.5) {
      nuevo.costo = Math.max(0, Math.round((Number(a.costo) || 0) - toma * precioViejo + toma * precioNuevo)) || undefined;
      corregidos++;
    }
    if (!cambios.has(lote.id)) cambios.set(lote.id, new Map());
    cambios.get(lote.id)!.set(pe.i, nuevo);
  }
  if (cambios.size) {
    guardarLotes(leerLotes().map((l) => (cambios.has(l.id) ? { ...l, alimento: l.alimento.map((a, i) => cambios.get(l.id)!.get(i) ?? a) } : l)));
  }
  if (ajustesProvisionales.size) {
    guardarMovimientos(
      leerMovimientos()
        .map((m) => {
          const aj = ajustesProvisionales.get(m.id);
          if (!aj) return m;
          if (aj.borrar) return null;
          return { ...m, monto: Math.max(0, m.monto - aj.quitar) };
        })
        .filter((m): m is Movimiento => !!m && m.monto > 0),
    );
  }
  if (corregidos) {
    registrarLog([
      {
        accion: "Modificación",
        modulo: "Engorde",
        detalle: `Factura ${factura.numero}: ${corregidos} consumo(s) sin existencia revalorado(s) con el precio nuevo`,
      },
    ]);
  }
  return corregidos;
}

/** Elimina una salida de Bodega y, si era consumo de un lote, también su registro de alimento */
/** Borra un consumo de alimento de un lote; si salió de bodega, el producto vuelve al inventario */
export function eliminarConsumoLote(loteId: string, indice: number) {
  const lote = leerLotes().find((l) => l.id === loteId);
  const registro = lote?.alimento[indice];
  if (!lote || !registro) return;
  if (registro.salidaId) guardarSalidas(leerSalidas().filter((s) => s.id !== registro.salidaId));
  if (registro.movProvisionalId) guardarMovimientos(leerMovimientos().filter((m) => m.id !== registro.movProvisionalId));
  guardarLotes(leerLotes().map((l) => (l.id === loteId ? { ...l, alimento: l.alimento.filter((_, i) => i !== indice) } : l)));
}

/**
 * Corrige un consumo de alimento. Si era de bodega, se devuelve lo descontado
 * y se vuelve a descontar con los datos nuevos (producto, cantidad, fecha y hora).
 * Los registros antiguos sin producto solo cambian fecha, hora y kilos.
 */
export function editarConsumoLote(
  loteId: string,
  indice: number,
  datos: { productoId?: string; cantidad: number; fecha: string; hora?: string },
) {
  const lote = leerLotes().find((l) => l.id === loteId);
  const registro = lote?.alimento[indice];
  if (!lote || !registro) return false;
  if (!datos.productoId) {
    guardarLotes(
      leerLotes().map((l) =>
        l.id === loteId
          ? { ...l, alimento: l.alimento.map((a, i) => (i === indice ? { ...a, fecha: datos.fecha, hora: datos.hora, kg: datos.cantidad } : a)) }
          : l,
      ),
    );
    return true;
  }
  const antes = `${registro.cantidad ?? registro.kg} ${registro.unidad ?? "kg"} ${registro.producto ?? ""}`.trim();
  // Una sola entrada en el registro de actividad para la corrección
  const ok = sinRegistro(() => {
    eliminarConsumoLote(loteId, indice);
    return registrarConsumoLote({ loteId, productoId: datos.productoId!, cantidad: datos.cantidad, fecha: datos.fecha, hora: datos.hora });
  });
  const nuevo = leerProductos().find((p) => p.id === datos.productoId);
  registrarLog([
    {
      accion: "Modificación",
      modulo: "Engorde",
      detalle: `Alimento editado en ${nombreLote(lote)}: ${antes} → ${datos.cantidad} ${nuevo?.unidad ?? ""} ${nuevo?.nombre ?? ""}`.replace(/\s+/g, " ").trim(),
    },
  ]);
  return ok;
}

/** Categorías para Bodega → Gastos de producción */
/** Categorías de Gastos de producción (texto en pantalla → categoría en Contabilidad) */
export const CATEGORIAS_GASTO_PRODUCCION = [
  { texto: "Vacunas/Medicamentos", categoria: "Medicamentos y vacunas" },
  { texto: "Bioseguridad", categoria: "Bioseguridad" },
  { texto: "Insumos", categoria: "Insumos" },
  { texto: "Servicios", categoria: "Servicios (agua, luz)" },
  { texto: "Mano de obra", categoria: "Mano de obra" },
  { texto: "Transporte", categoria: "Transporte" },
  { texto: "Otro gasto", categoria: "Otros gastos" },
];
/** Unidades para vacunas y medicamentos (el valor se divide por unidad para el plan vacunal) */
export const UNIDADES_VACUNA = ["ml", "Dosis", "Litro"] as const;
export const textoCategoriaProduccion = (c: string) => CATEGORIAS_GASTO_PRODUCCION.find((x) => x.categoria === c)?.texto ?? c;

/** Convierte una cantidad entre ml y Litro (las dosis no se convierten) */
export function convertirUnidad(cantidad: number, de: string, a: string): number {
  if (de === a) return cantidad;
  if (de === "ml" && a === "Litro") return cantidad / 1000;
  if (de === "Litro" && a === "ml") return cantidad * 1000;
  return NaN;
}

/** Medicamentos y vacunas comprados en Gastos de producción, con su valor por unidad y lo que queda */
export function medicamentosRegistrados() {
  const usados = new Map<string, number>();
  for (const t of leerTratamientos()) if (t.gastoId) usados.set(t.gastoId, (usados.get(t.gastoId) ?? 0) + (Number(t.cantidadUsada) || 0));
  return leerGastosProduccion()
    .filter((m) => m.categoria === "Medicamentos y vacunas" && m.unidad && (m.cantidadNum ?? 0) > 0 && (m.valorUnitario ?? 0) > 0)
    .map((m) => {
      const usado = usados.get(m.id) ?? 0;
      return {
        id: m.id,
        nombre: (m.descripcion || "").replace(/\s*\([^)]*\)\s*$/, "") || m.descripcion,
        fecha: m.fecha,
        unidad: m.unidad as string,
        cantidad: m.cantidadNum as number,
        valorUnitario: m.valorUnitario as number,
        usado,
        restante: Math.max(0, (m.cantidadNum as number) - usado),
      };
    });
}

/** Gastos registrados desde Bodega → Gastos de producción (más recientes primero) */
export interface GastoProduccion {
  id: string;
  fecha: string;
  categoria: string;
  descripcion: string;
  monto: number;
  cantidad?: string;
  unidad?: string;
  cantidadNum?: number;
  valorUnitario?: number;
  pago: "contado" | "credito";
  /** Solo a crédito: lo que falta por pagar */
  saldo?: number;
}
export const leerGastosProduccion = (): GastoProduccion[] =>
  [
    ...leerMovimientos()
      .filter((m) => m.origen === "produccion")
      .map((m) => ({ id: m.id, fecha: m.fecha, categoria: m.categoria, descripcion: m.descripcion, monto: m.monto, cantidad: m.cantidad, unidad: m.unidad, cantidadNum: m.cantidadNum, valorUnitario: m.valorUnitario, pago: "contado" as const })),
    ...leerCuentasPorPagar()
      .filter((c) => c.origen === "produccion")
      .map((c) => ({ id: c.id, fecha: c.fecha, categoria: c.categoria, descripcion: c.descripcion, monto: c.total, cantidad: c.cantidad, unidad: c.unidad, cantidadNum: c.cantidadNum, valorUnitario: c.valorUnitario, pago: "credito" as const, saldo: saldoCuenta(c) })),
  ].sort((a, b) => b.fecha.localeCompare(a.fecha));

/** Elimina un gasto de producción (de contado o a crédito con sus abonos) */
export function eliminarGastoProduccion(id: string) {
  const cuenta = leerCuentasPorPagar().find((c) => c.id === id);
  if (cuenta) {
    const quitar = new Set(cuenta.abonos.map((a) => a.movimientoId).filter(Boolean));
    if (quitar.size) guardarMovimientos(leerMovimientos().filter((m) => !quitar.has(m.id)));
    guardarCuentasPorPagar(leerCuentasPorPagar().filter((c) => c.id !== id));
    return;
  }
  guardarMovimientos(leerMovimientos().filter((m) => m.id !== id));
}

/** Registra un gasto de producción: queda como gasto en la contabilidad general */
export function registrarGastoProduccion(datos: { descripcion: string; cantidad?: string; unidad?: string; valor: number; categoria: string; fecha: string; pago: "contado" | "credito" }) {
  const descripcion = datos.descripcion.trim().slice(0, 80);
  if (!descripcion || !(datos.valor > 0)) return false;
  const cantidadNum = Number(String(datos.cantidad ?? "").replace(",", ".")) || 0;
  const unidad = datos.unidad?.trim() || undefined;
  const cantidad = cantidadNum > 0 ? `${fmtNum(cantidadNum)}${unidad ? ` ${unidad}` : ""}` : datos.cantidad?.trim().slice(0, 40) || undefined;
  const extra = {
    ...(cantidad ? { cantidad } : {}),
    ...(cantidadNum > 0 ? { cantidadNum, valorUnitario: Math.round((datos.valor / cantidadNum) * 100) / 100 } : {}),
    ...(unidad ? { unidad } : {}),
  };
  // A crédito: queda en "Por pagar a crédito" y entra al balance cuando se abona o paga
  if (datos.pago === "credito") {
    guardarCuentasPorPagar([
      ...leerCuentasPorPagar(),
      { id: nuevoId(), fecha: datos.fecha, descripcion: cantidad ? `${descripcion} (${cantidad})` : descripcion, categoria: datos.categoria, total: Math.round(datos.valor), abonos: [], origen: "produccion", ...extra },
    ]);
    return true;
  }
  guardarMovimientos([
    ...leerMovimientos(),
    {
      id: nuevoId(),
      fecha: datos.fecha,
      tipo: "gasto",
      categoria: datos.categoria,
      descripcion: cantidad ? `${descripcion} (${cantidad})` : descripcion,
      monto: Math.round(datos.valor),
      origen: "produccion",
      ...(cantidad ? { cantidad } : {}),
      ...(cantidadNum > 0 ? { cantidadNum, valorUnitario: Math.round((datos.valor / cantidadNum) * 100) / 100 } : {}),
      ...(unidad ? { unidad } : {}),
    },
  ]);
  return true;
}

/** Categorías de Contabilidad para los gastos de un lote */
export const CATEGORIAS_GASTO_LOTE = ["Medicamentos y vacunas", "Insumos", "Mano de obra", "Mantenimiento", "Otros gastos"];
/** Nombre corto que se muestra en la lista (en Contabilidad queda con su nombre completo) */
export const textoCategoriaLote = (c: string) => (c === "Medicamentos y vacunas" ? "Medicamentos/Vacunas" : c);

/** Registra otro gasto del lote y lo suma como gasto en Contabilidad */
export function registrarGastoLote(
  loteId: string,
  datos: { descripcion: string; cantidad?: string; valor: number; categoria: string; fecha: string; hora?: string; pago?: "contado" | "credito" },
): boolean {
  const lote = leerLotes().find((l) => l.id === loteId);
  if (!lote || !datos.descripcion.trim() || !(datos.valor > 0)) return false;
  const descripcion = datos.descripcion.trim().slice(0, 80);
  const cantidad = datos.cantidad?.trim().slice(0, 40) || undefined;
  const texto = `${descripcion}${cantidad ? ` (${cantidad})` : ""} · ${nombreLote(lote)}`;
  let movimientoId: string | undefined;
  let cuentaId: string | undefined;
  if (datos.pago === "credito") {
    // A crédito: queda por pagar en Contabilidad; el costo del lote se cuenta igual
    cuentaId = nuevoId();
    guardarCuentasPorPagar([
      ...leerCuentasPorPagar(),
      { id: cuentaId, fecha: datos.fecha, descripcion: texto, categoria: datos.categoria, total: Math.round(datos.valor), abonos: [] },
    ]);
  } else {
    movimientoId = nuevoId();
    guardarMovimientos([
      ...leerMovimientos(),
      { id: movimientoId, fecha: datos.fecha, tipo: "gasto", categoria: datos.categoria, descripcion: texto, monto: Math.round(datos.valor) },
    ]);
  }
  const gasto: GastoLote = {
    id: nuevoId(),
    fecha: datos.fecha,
    hora: datos.hora || horaActual(),
    descripcion,
    cantidad,
    valor: Math.round(datos.valor),
    categoria: datos.categoria,
    movimientoId,
    cuentaId,
  };
  guardarLotes(leerLotes().map((l) => (l.id === loteId ? { ...l, gastos: [...(l.gastos ?? []), gasto] } : l)));
  return true;
}

/** Borra un gasto del lote y su gasto en Contabilidad */
export function eliminarGastoLote(loteId: string, gastoId: string) {
  const lote = leerLotes().find((l) => l.id === loteId);
  const gasto = lote?.gastos?.find((g) => g.id === gastoId);
  if (!lote || !gasto) return;
  const quitar = new Set<string>(gasto.movimientoId ? [gasto.movimientoId] : []);
  if (gasto.cuentaId) {
    const cuenta = leerCuentasPorPagar().find((c) => c.id === gasto.cuentaId);
    for (const a of cuenta?.abonos ?? []) if (a.movimientoId) quitar.add(a.movimientoId);
    guardarCuentasPorPagar(leerCuentasPorPagar().filter((c) => c.id !== gasto.cuentaId));
  }
  if (quitar.size) guardarMovimientos(leerMovimientos().filter((m) => !quitar.has(m.id)));
  guardarLotes(leerLotes().map((l) => (l.id === loteId ? { ...l, gastos: (l.gastos ?? []).filter((g) => g.id !== gastoId) } : l)));
}

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

/** Suma meses de calendario (31 ene + 1 mes = 28/29 feb) */
export function sumarMeses(fecha: string, meses: number): string {
  const [a, m, d] = fecha.split("-").map(Number);
  const destino = new Date(a, (m || 1) - 1 + meses, 1);
  const ultimo = new Date(destino.getFullYear(), destino.getMonth() + 1, 0).getDate();
  destino.setDate(Math.min(d || 1, ultimo));
  return `${destino.getFullYear()}-${String(destino.getMonth() + 1).padStart(2, "0")}-${String(destino.getDate()).padStart(2, "0")}`;
}

/** Salida aproximada de un lote: 5 meses exactos desde el parto (solo lotes que vienen de un parto) */
export const MESES_HASTA_SALIDA = 5;
export const salidaEstimadaLote = (l: Lote) => (l.origen && l.fechaIngreso ? sumarMeses(l.fechaIngreso, MESES_HASTA_SALIDA) : undefined);

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
  Vacía: "bg-violet-50 text-violet-700 ring-violet-200",
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

/** Lote creado con un parto (por su código) */
export const loteDelParto = (codigoParto: string) => leerLotes().find((l) => l.origen?.codigoParto === codigoParto);
/** ¿Ya se aplicó el hierro a la camada de ese lote? */
export const hierroAplicado = (l: Lote) => (l.aplicaciones ?? []).find((a) => a.tipo === "Hierro");
/** Registra en el lote la aplicación de hierro (una sola vez) */
export function registrarHierro(loteId: string, extra?: { costo?: number; nota?: string; tratamientoId?: string }): boolean {
  const lote = leerLotes().find((l) => l.id === loteId);
  if (!lote || hierroAplicado(lote)) return false;
  const aplicacion: AplicacionLote = { id: nuevoId(), fecha: hoy(), hora: horaActual(), tipo: "Hierro", ...(extra ?? {}) };
  guardarLotes(leerLotes().map((l) => (l.id === loteId ? { ...l, aplicaciones: [...(l.aplicaciones ?? []), aplicacion] } : l)));
  return true;
}

/** Guarda en Tratamientos un medicamento aplicado a un lote (para saber cuánto queda y su retiro) */
export function registrarTratamientoLote(loteId: string, r: { gastoId: string; nombre: string; cantidadAnimal: number; unidadDosis: string; animales: number; cantidadUsada: number; costo: number }, motivo?: string): string {
  const id = nuevoId();
  guardarTratamientos([
    ...leerTratamientos(),
    {
      id,
      tipo: "Tratamiento",
      fecha: hoy(),
      objetivo: "lote",
      objetivoId: loteId,
      medicamento: r.nombre,
      dosis: `${(Math.round(r.cantidadAnimal * 100) / 100).toLocaleString("es-CO")} ${r.unidadDosis} por animal × ${r.animales}`,
      dias: 1,
      retiroDias: 0,
      ...(motivo ? { motivo } : {}),
      gastoId: r.gastoId,
      cantidadAnimal: r.cantidadAnimal,
      unidadDosis: r.unidadDosis,
      animales: r.animales,
      cantidadUsada: r.cantidadUsada,
      costo: r.costo,
    },
  ]);
  return id;
}

/** Agrega al lote un medicamento aplicado (desde Tratamientos), con su costo */
export function agregarAplicacionLote(loteId: string, aplicacion: AplicacionLote) {
  guardarLotes(leerLotes().map((l) => (l.id === loteId ? { ...l, aplicaciones: [...(l.aplicaciones ?? []), aplicacion] } : l)));
}
/** Quita del lote lo que se aplicó con un tratamiento */
export function quitarAplicacionesDeTratamiento(tratamientoId: string) {
  const lotes = leerLotes();
  if (!lotes.some((l) => (l.aplicaciones ?? []).some((a) => a.tratamientoId === tratamientoId))) return;
  guardarLotes(lotes.map((l) => ({ ...l, aplicaciones: (l.aplicaciones ?? []).filter((a) => a.tratamientoId !== tratamientoId) })));
}

/** Cambia la fecha (y hora) de una aplicación del lote */
export function editarAplicacion(loteId: string, aplicacionId: string, cambios: { fecha: string; hora?: string }) {
  guardarLotes(
    leerLotes().map((l) =>
      l.id === loteId ? { ...l, aplicaciones: (l.aplicaciones ?? []).map((a) => (a.id === aplicacionId ? { ...a, ...cambios } : a)) } : l,
    ),
  );
}
/** Borra una aplicación del lote (si era el hierro, vuelve la alerta) */
export function eliminarAplicacion(loteId: string, aplicacionId: string) {
  // Si venía de un tratamiento con medicamento, ese registro también se quita (vuelve lo usado)
  const ap = leerLotes().find((l) => l.id === loteId)?.aplicaciones?.find((a) => a.id === aplicacionId);
  if (ap?.tratamientoId) guardarTratamientos(leerTratamientos().filter((t) => t.id !== ap.tratamientoId));
  guardarLotes(leerLotes().map((l) => (l.id === loteId ? { ...l, aplicaciones: (l.aplicaciones ?? []).filter((a) => a.id !== aplicacionId) } : l)));
}

/** Marca la 1.ª o 2.ª confirmación de gestación en la última inseminación de la cerda */
export function confirmarGestacion(cerdaId: string, etapa: 1 | 2): boolean {
  const historial = leerHistorial(cerdaId);
  const i = historial.findIndex((r) => r.tipo === "Inseminación");
  if (i < 0) return false;
  const campo = etapa === 1 ? "confirmacion1" : "confirmacion2";
  const nuevo = historial.map((r, k) => (k === i ? { ...r, [campo]: hoy() } : r));
  escribir(CLAVES.historial(cerdaId), nuevo);
  return true;
}

export function nombreCerda(c: CerdaDatos): string {
  return typeof c.nombre === "string" && c.nombre.trim() ? `${c.id} · ${c.nombre}` : c.id;
}
