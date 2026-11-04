/*
 * Cantidad de jaulas (filas × jaulas por fila) común a todas las granjas.
 * Se guarda como un elemento especial ("_config") dentro del mapa de jaulas,
 * que ya se sincroniza igual para todas las granjas.
 */
import { CLAVE_JAULAS } from "@/lib/sincronizar";
import { guardarConRegistro } from "@/lib/log";
import { leerConfig, type ConfigJaulas, JAULAS_POR_DEFECTO } from "@/lib/config";

const ID_CONFIG = "_config";

function leerLista(): Record<string, unknown>[] {
  try {
    const v = JSON.parse(localStorage.getItem(CLAVE_JAULAS) || "[]");
    return Array.isArray(v) ? v : [];
  } catch {
    return [];
  }
}

const valido = (n: unknown, max: number) => typeof n === "number" && Number.isInteger(n) && n >= 1 && n <= max;

export function leerFormaJaulas(): ConfigJaulas {
  if (typeof window === "undefined") return JAULAS_POR_DEFECTO;
  const c = leerLista().find((e) => e && e.id === ID_CONFIG) as { jaulas?: ConfigJaulas } | undefined;
  const j = c?.jaulas;
  if (j && valido(j.gestacion?.filas, 4) && valido(j.gestacion?.porFila, 40) && valido(j.lactancia?.filas, 4) && valido(j.lactancia?.porFila, 40)) return j;
  // Antes se guardaba por granja: se usa ese valor hasta que se guarde el común
  return leerConfig().jaulas;
}

export function guardarFormaJaulas(j: ConfigJaulas) {
  const lista = leerLista().filter((e) => !(e && e.id === ID_CONFIG));
  guardarConRegistro(CLAVE_JAULAS, [...lista, { id: ID_CONFIG, jaulas: j, fecha: new Date().toISOString() }]);
}
