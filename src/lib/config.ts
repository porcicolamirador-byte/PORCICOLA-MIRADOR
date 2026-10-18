/*
 * Configuración de la granja editable desde la sección oculta de Ajustes:
 * claves y rango de días para el destete. Se guarda en este dispositivo.
 */

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

export const ALIMENTACION_POR_DEFECTO: AlimentacionEstandar = {
  preiniciadorCerdos: 10,
  iniciacionCerdos: 20,
  levante: 100,
  engorde: 100,
};

export interface ConfigGranja {
  /** Código para abrir los ajustes avanzados */
  claveAjustes: string;
  /** Clave para eliminar una cerda en Gestación */
  claveEliminar: string;
  /** Clave para cargar una factura en Bodega */
  claveFacturas: string;
  /** Días después del parto: inicio y fin de la ventana de destete */
  desteteMin: number;
  desteteMax: number;
  /** Número de parideras (jaulas de maternidad). 0 = sin configurar */
  parideras: number;
  /** Kilos de alimento por cerdo en cada etapa */
  alimentacion: AlimentacionEstandar;
  /** Permite usar productos de bodega sin existencia (el inventario puede quedar negativo) */
  permitirSinInventario: boolean;
}

export const CLAVE_CONFIG = "config-granja";

export const CONFIG_POR_DEFECTO: ConfigGranja = {
  claveAjustes: "0030",
  claveEliminar: "0030",
  claveFacturas: "0030",
  desteteMin: 21,
  desteteMax: 28,
  parideras: 0,
  alimentacion: ALIMENTACION_POR_DEFECTO,
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

export function leerConfig(): ConfigGranja {
  if (typeof window === "undefined") return CONFIG_POR_DEFECTO;
  try {
    const c = JSON.parse(localStorage.getItem(CLAVE_CONFIG) || "{}") as Partial<ConfigGranja>;
    const min = esDia(c.desteteMin) ? c.desteteMin : CONFIG_POR_DEFECTO.desteteMin;
    const max = esDia(c.desteteMax) && c.desteteMax > min ? c.desteteMax : Math.max(min + 1, CONFIG_POR_DEFECTO.desteteMax);
    return {
      claveAjustes: esClave(c.claveAjustes) ? c.claveAjustes : CONFIG_POR_DEFECTO.claveAjustes,
      claveEliminar: esClave(c.claveEliminar) ? c.claveEliminar : CONFIG_POR_DEFECTO.claveEliminar,
      claveFacturas: esClave(c.claveFacturas) ? c.claveFacturas : CONFIG_POR_DEFECTO.claveFacturas,
      desteteMin: min,
      desteteMax: max,
      parideras:
        typeof c.parideras === "number" && Number.isInteger(c.parideras) && c.parideras >= 0 && c.parideras <= 500
          ? c.parideras
          : CONFIG_POR_DEFECTO.parideras,
      alimentacion: leerAlimentacion(c.alimentacion),
      permitirSinInventario: c.permitirSinInventario === true,
    };
  } catch {
    return CONFIG_POR_DEFECTO;
  }
}

export function guardarConfig(cambios: Partial<ConfigGranja>) {
  const nueva = { ...leerConfig(), ...cambios };
  localStorage.setItem(CLAVE_CONFIG, JSON.stringify(nueva));
  return nueva;
}
