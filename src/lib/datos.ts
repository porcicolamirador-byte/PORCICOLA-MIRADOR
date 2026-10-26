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
  secuenciaLotes: "engorde-secuencia-lotes",
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
  if (borrar.length) guardarLotes(lotes.filter((l) => !borrar.includes(l)));
  return borrar;
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
              },
            ],
          }
        : l,
    ),
  );
  return true;
}

/** Elimina una salida de Bodega y, si era consumo de un lote, también su registro de alimento */
/** Borra un consumo de alimento de un lote; si salió de bodega, el producto vuelve al inventario */
export function eliminarConsumoLote(loteId: string, indice: number) {
  const lote = leerLotes().find((l) => l.id === loteId);
  const registro = lote?.alimento[indice];
  if (!lote || !registro) return;
  if (registro.salidaId) guardarSalidas(leerSalidas().filter((s) => s.id !== registro.salidaId));
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
  eliminarConsumoLote(loteId, indice);
  return registrarConsumoLote({ loteId, productoId: datos.productoId, cantidad: datos.cantidad, fecha: datos.fecha, hora: datos.hora });
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

export function nombreCerda(c: CerdaDatos): string {
  return typeof c.nombre === "string" && c.nombre.trim() ? `${c.id} · ${c.nombre}` : c.id;
}
