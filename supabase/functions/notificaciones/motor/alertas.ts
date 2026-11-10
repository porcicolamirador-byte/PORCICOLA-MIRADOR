/**
 * Alertas de una granja calculadas en el servidor con la MISMA lógica de la app.
 * Se arma un "teléfono" en memoria (localStorage) con los documentos de la nube
 * de esa granja y se llama a calcularTareasPendientes().
 */

const memoria = new Map<string, string>();
const g = globalThis as unknown as Record<string, unknown>;
g.localStorage = {
  getItem: (k: string) => memoria.get(k) ?? null,
  setItem: (k: string, v: string) => void memoria.set(k, String(v)),
  removeItem: (k: string) => void memoria.delete(k),
  clear: () => memoria.clear(),
  key: (i: number) => [...memoria.keys()][i] ?? null,
  get length() {
    return memoria.size;
  },
};
if (!g.window) g.window = globalThis;

// Hora de Colombia (UTC-5, sin horario de verano): "hoy" es el día de la granja
const DateReal = Date;
class DateColombia extends DateReal {
  constructor(...a: unknown[]) {
    if (a.length === 0) super(DateReal.now() - 5 * 3600 * 1000);
    else super(...(a as [string]));
  }
  static now() {
    return DateReal.now() - 5 * 3600 * 1000;
  }
}
g.Date = DateColombia;

const { calcularTareasPendientes } = await import("./pendingTasks.ts");
const { leerCerdas } = await import("./datos.ts");

export interface Documento {
  coleccion: string;
  id: string;
  datos: unknown;
}

const VALORES = new Set(["config-granja", "ajustes", "bioseguridad-checks", "consumo-cerdas-dia"]);
const GLOBALES = new Set(["granjas", "jaulas-mapa", "prestamos-bodega", "existencias-granjas"]);
export const GRANJA_BASE = "mirador";

/** Clave del teléfono para una colección (null si es de otra granja) */
function local(coleccion: string, granja: string): string | null {
  if (GLOBALES.has(coleccion)) return coleccion;
  const m = /^g:([^:]+):(.+)$/.exec(coleccion);
  if (m) return m[1] === granja ? m[2] : null;
  return granja === GRANJA_BASE ? coleccion : null;
}

export interface Alerta {
  cerda: string;
  tipo: string;
  prioridad: string;
  descripcion: string;
  dias: number;
}

export function alertasDeGranja(docs: Documento[], granja: string): Alerta[] {
  memoria.clear();
  const listas = new Map<string, unknown[]>();
  for (const d of docs) {
    const clave = local(d.coleccion, granja);
    if (!clave || d.datos == null) continue;
    if (VALORES.has(clave)) {
      memoria.set(clave, JSON.stringify(d.datos));
      continue;
    }
    listas.set(clave, [...(listas.get(clave) ?? []), d.datos]);
  }
  for (const [clave, lista] of listas) {
    const valor = clave.startsWith("historial-")
      ? [...lista].sort((a, b) => String((b as { fecha?: string }).fecha ?? "").localeCompare(String((a as { fecha?: string }).fecha ?? "")))
      : lista;
    memoria.set(clave, JSON.stringify(valor));
  }
  memoria.set("granja-actual", granja);
  return calcularTareasPendientes(leerCerdas()).map((t) => ({ cerda: t.id, tipo: t.tipo, prioridad: t.prioridad, descripcion: t.descripcion, dias: t.dias }));
}
