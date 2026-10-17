/*
 * Configuración de la granja editable desde la sección oculta de Ajustes:
 * claves y rango de días para el destete. Se guarda en este dispositivo.
 */

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
}

export const CLAVE_CONFIG = "config-granja";

export const CONFIG_POR_DEFECTO: ConfigGranja = {
  claveAjustes: "0030",
  claveEliminar: "0030",
  claveFacturas: "0030",
  desteteMin: 21,
  desteteMax: 28,
  parideras: 0,
};

const esClave = (v: unknown): v is string => typeof v === "string" && /^\d{4}$/.test(v);
const esDia = (v: unknown): v is number => typeof v === "number" && Number.isInteger(v) && v >= 1 && v <= 90;

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
