/*
 * Configuración de la granja editable desde la sección oculta de Ajustes:
 * claves y rango de días para el destete. Se guarda en este dispositivo.
 */

import { registrarCambio } from "@/lib/log";
import { capturarCambio } from "@/lib/sincronizar";

/** Alimentación estándar: kilos de alimento por cerdo en cada etapa */
export interface AlimentacionEstandar {
  preiniciadorCerdos: number;
  iniciacionCerdos: number;
  levante: number;
  engorde: number;
}

export const ETAPAS_ALIMENTACION: { clave: keyof AlimentacionEstandar; nombre: string }[] = [
  { clave: "preiniciadorCerdos", nombre: "Preiniciador cerdos" },
  { clave: "iniciacionCerdos", nombre: "Iniciación cerdos" },
  { clave: "levante", nombre: "Etapa levante" },
  { clave: "engorde", nombre: "Etapa engorde" },
];

/** Códigos de productos de bodega unidos a cada etapa (para el consumo establecido) */
export type ProductosEtapa = Record<keyof AlimentacionEstandar, string[]>;

export const PRODUCTOS_ETAPA_POR_DEFECTO: ProductosEtapa = {
  preiniciadorCerdos: [],
  iniciacionCerdos: [],
  levante: [],
  engorde: [],
};

export const ALIMENTACION_POR_DEFECTO: AlimentacionEstandar = {
  preiniciadorCerdos: 10,
  iniciacionCerdos: 20,
  levante: 100,
  engorde: 100,
};

/** Consumo aproximado de las cerdas (kg por cerda al día) y alimento de cada regla */
export interface ConsumoCerdas {
  /** Gestación y cerdas vacías: alimento de gestación */
  gestacion: number;
  /** Desde el día de cambio hasta el parto: alimento de lactancia */
  preparto: number;
  /** Del parto al destete: alimento de lactancia */
  lactancia: number;
  /** Día de gestación en que pasa al alimento de lactancia */
  diaCambio: number;
  /** Códigos de bodega del alimento de cada tipo */
  codigoGestacion: string;
  codigoLactancia: string;
  /** Descontar cada día de bodega el alimento estimado (gestación y lactancia) */
  descontarGestacion: boolean;
  /** Primer día que se descuenta (AAAA-MM-DD); vacío = desde hoy */
  descuentoDesde: string;
}

export const CONSUMO_CERDAS_POR_DEFECTO: ConsumoCerdas = {
  gestacion: 2,
  preparto: 2,
  lactancia: 4,
  diaCambio: 100,
  codigoGestacion: "CG-01",
  codigoLactancia: "CL-01",
  descontarGestacion: true,
  descuentoDesde: "",
};

function leerConsumoCerdas(v: unknown): ConsumoCerdas {
  const o = (v && typeof v === "object" ? v : {}) as Partial<Record<keyof ConsumoCerdas, unknown>>;
  const r = { ...CONSUMO_CERDAS_POR_DEFECTO };
  for (const k of ["gestacion", "preparto", "lactancia"] as const) {
    const x = o[k];
    if (typeof x === "number" && Number.isFinite(x) && x >= 0 && x <= 50) r[k] = x;
  }
  if (typeof o.diaCambio === "number" && Number.isInteger(o.diaCambio) && o.diaCambio >= 1 && o.diaCambio <= 120) r.diaCambio = o.diaCambio;
  for (const k of ["codigoGestacion", "codigoLactancia"] as const) {
    const x = o[k];
    if (typeof x === "string" && x.trim()) r[k] = x.trim().toUpperCase();
  }
  r.descontarGestacion = o.descontarGestacion !== false;
  if (typeof o.descuentoDesde === "string" && /^\d{4}-\d{2}-\d{2}$/.test(o.descuentoDesde)) r.descuentoDesde = o.descuentoDesde;
  return r;
}

export interface ConfigGranja {
  /** Código para abrir los ajustes avanzados */
  claveAjustes: string;
  /** Clave para eliminar una cerda en Gestación */
  claveEliminar: string;
  /** Clave para cargar una factura en Bodega */
  claveFacturas: string;
  /** Clave para eliminar un lote en Engorde */
  claveLotes: string;
  /** Si cada clave se pide o no (desactivada = la acción no pide clave) */
  /** Desactivada = la clave de ajustes solo se pide la primera vez en este teléfono */
  claveAjustesActiva: boolean;
  /** Las claves ya usan los valores por defecto nuevos (0000) */
  clavesV2?: boolean;
  claveEliminarActiva: boolean;
  claveFacturasActiva: boolean;
  claveLotesActiva: boolean;
  /** Días después del parto: inicio y fin de la ventana de destete */
  desteteMin: number;
  desteteMax: number;
  /** Número de parideras (jaulas de maternidad). 0 = sin configurar */
  parideras: number;
  /** Kilos de alimento por cerdo en cada etapa */
  alimentacion: AlimentacionEstandar;
  /** Productos de bodega (por código) unidos a cada etapa de alimentación */
  productosEtapa: ProductosEtapa;
  /** Consumo aproximado de alimento de las cerdas */
  consumoCerdas: ConsumoCerdas;
  /** Permite usar productos de bodega sin existencia (el inventario puede quedar negativo) */
  permitirSinInventario: boolean;
}

export const CLAVE_CONFIG = "config-granja";

export const CONFIG_POR_DEFECTO: ConfigGranja = {
  claveAjustes: "0030",
  claveEliminar: "0000",
  claveFacturas: "0000",
  claveLotes: "0000",
  claveAjustesActiva: true,
  claveEliminarActiva: true,
  claveFacturasActiva: true,
  claveLotesActiva: true,
  desteteMin: 21,
  desteteMax: 28,
  parideras: 0,
  alimentacion: ALIMENTACION_POR_DEFECTO,
  productosEtapa: PRODUCTOS_ETAPA_POR_DEFECTO,
  consumoCerdas: CONSUMO_CERDAS_POR_DEFECTO,
  permitirSinInventario: false,
};

const esClave = (v: unknown): v is string => typeof v === "string" && /^\d{4}$/.test(v);
const esDia = (v: unknown): v is number => typeof v === "number" && Number.isInteger(v) && v >= 1 && v <= 90;

const esKilos = (v: unknown): v is number => typeof v === "number" && Number.isFinite(v) && v >= 0 && v <= 10000;

function leerAlimentacion(a: unknown): AlimentacionEstandar {
  const o = (a && typeof a === "object" ? a : {}) as Partial<Record<keyof AlimentacionEstandar, unknown>>;
  const r = { ...ALIMENTACION_POR_DEFECTO };
  for (const { clave } of ETAPAS_ALIMENTACION) {
    const v = o[clave];
    if (esKilos(v)) r[clave] = v;
  }
  return r;
}

function leerProductosEtapa(p: unknown): ProductosEtapa {
  const o = (p && typeof p === "object" ? p : {}) as Partial<Record<keyof AlimentacionEstandar, unknown>>;
  const r = { ...PRODUCTOS_ETAPA_POR_DEFECTO };
  for (const { clave } of ETAPAS_ALIMENTACION) {
    const v = o[clave];
    if (Array.isArray(v)) {
      r[clave] = [...new Set(v.filter((c): c is string => typeof c === "string" && !!c.trim()).map((c) => c.trim().toUpperCase()))];
    }
  }
  return r;
}

export function leerConfig(): ConfigGranja {
  if (typeof window === "undefined") return CONFIG_POR_DEFECTO;
  try {
    const c = JSON.parse(localStorage.getItem(CLAVE_CONFIG) || "{}") as Partial<ConfigGranja>;
    const min = esDia(c.desteteMin) ? c.desteteMin : CONFIG_POR_DEFECTO.desteteMin;
    const max = esDia(c.desteteMax) && c.desteteMax > min ? c.desteteMax : Math.max(min + 1, CONFIG_POR_DEFECTO.desteteMax);
    return {
      claveAjustes: esClave(c.claveAjustes) ? c.claveAjustes : CONFIG_POR_DEFECTO.claveAjustes,
      // Las claves que seguían en el valor por defecto anterior (0030) pasan a 0000
      claveEliminar: esClave(c.claveEliminar) && !(!c.clavesV2 && c.claveEliminar === "0030") ? c.claveEliminar : CONFIG_POR_DEFECTO.claveEliminar,
      claveFacturas: esClave(c.claveFacturas) && !(!c.clavesV2 && c.claveFacturas === "0030") ? c.claveFacturas : CONFIG_POR_DEFECTO.claveFacturas,
      clavesV2: true,
      claveAjustesActiva: c.claveAjustesActiva !== false,
      claveEliminarActiva: c.claveEliminarActiva !== false,
      claveFacturasActiva: c.claveFacturasActiva !== false,
      claveLotesActiva: c.claveLotesActiva !== false,
      claveLotes: esClave(c.claveLotes) ? c.claveLotes : CONFIG_POR_DEFECTO.claveLotes,
      desteteMin: min,
      desteteMax: max,
      parideras:
        typeof c.parideras === "number" && Number.isInteger(c.parideras) && c.parideras >= 0 && c.parideras <= 500
          ? c.parideras
          : CONFIG_POR_DEFECTO.parideras,
      alimentacion: leerAlimentacion(c.alimentacion),
      productosEtapa: leerProductosEtapa(c.productosEtapa),
      consumoCerdas: leerConsumoCerdas(c.consumoCerdas),
      permitirSinInventario: c.permitirSinInventario === true,
    };
  } catch {
    return CONFIG_POR_DEFECTO;
  }
}

export function guardarConfig(cambios: Partial<ConfigGranja>) {
  const antes = leerConfig();
  const nueva = { ...antes, ...cambios };
  localStorage.setItem(CLAVE_CONFIG, JSON.stringify(nueva));
  registrarCambio(CLAVE_CONFIG, antes, nueva);
  capturarCambio(CLAVE_CONFIG, antes, nueva);
  return nueva;
}
