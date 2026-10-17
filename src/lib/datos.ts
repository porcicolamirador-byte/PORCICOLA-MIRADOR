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
  bodega: "bodega-articulos",
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
  }));
}
export const guardarLotes = (l: Lote[]) => escribir(CLAVES.lotes, l);

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
