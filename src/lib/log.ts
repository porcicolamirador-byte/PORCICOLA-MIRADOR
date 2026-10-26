/*
 * Registro de actividad (log): guarda en este teléfono cada creación,
 * cambio y eliminación que se hace en la app, con fecha y hora.
 * Los cambios se detectan comparando lo que había guardado con lo nuevo,
 * así que cualquier pantalla que guarde datos queda registrada.
 */

import { capturarCambio, prepararHistorial } from "@/lib/sincronizar";

export type AccionLog = "Creación" | "Modificación" | "Eliminación" | "Sistema";

export interface EntradaLog {
  id: string;
  /** Fecha y hora ISO */
  fecha: string;
  accion: AccionLog;
  modulo: string;
  detalle: string;
  /** Nombre del usuario que lo hizo (si había sesión) */
  usuario?: string;
}

export const CLAVE_LOG = "registro-actividad";
const MAXIMO = 3000;

/** Claves que no se registran (contadores internos, preferencias de vista…) */
const IGNORAR = new Set([CLAVE_LOG, "engorde-secuencia-lotes", "last-new-registro", "gestacion-vista", "bodega-minimo-0", "faceid-disponible"]);

export function leerLog(): EntradaLog[] {
  if (typeof window === "undefined") return [];
  try {
    const v = JSON.parse(localStorage.getItem(CLAVE_LOG) || "[]");
    return Array.isArray(v) ? v : [];
  } catch {
    return [];
  }
}

export function vaciarLog() {
  try {
    localStorage.removeItem(CLAVE_LOG);
  } catch {}
}

const nuevoIdLog = () => `${Date.now().toString(36)}${Math.random().toString(36).slice(2, 7)}`;

let silencio = 0;
/** Ejecuta fn sin registrar cambios automáticos (para dejar una sola entrada propia) */
export function sinRegistro<T>(fn: () => T): T {
  silencio++;
  try {
    return fn();
  } finally {
    silencio--;
  }
}

function usuarioActual(): string {
  try {
    const p = JSON.parse(localStorage.getItem("nube-perfil") || "null");
    return p?.nombre ? String(p.nombre) : "";
  } catch {
    return "";
  }
}

/** Agrega entradas al registro (las más recientes primero) */
export function registrarLog(entradas: { accion: AccionLog; modulo: string; detalle: string }[]) {
  if (typeof window === "undefined" || entradas.length === 0) return;
  try {
    const fecha = new Date().toISOString();
    const usuario = usuarioActual();
    const nuevas = entradas.map((e) => ({ id: nuevoIdLog(), fecha, ...e, ...(usuario ? { usuario } : {}) }));
    localStorage.setItem(CLAVE_LOG, JSON.stringify([...nuevas.reverse(), ...leerLog()].slice(0, MAXIMO)));
  } catch {
    // sin espacio o sin almacenamiento: el registro no debe impedir guardar los datos
  }
}

/* ───────────── Descripción de cada tipo de dato ───────────── */

type Obj = Record<string, unknown>;
const txt = (v: unknown) => (v === undefined || v === null ? "" : String(v));
const num = (v: unknown) => (Number(v) || 0).toLocaleString("es-CO", { maximumFractionDigits: 2 });
const pesos = (v: unknown) => `$${Math.round(Number(v) || 0).toLocaleString("es-CO")}`;
const fechaCorta = (f: unknown) => {
  const m = /^(\d{4})-(\d{2})-(\d{2})/.exec(txt(f));
  return m ? `${m[3]}/${m[2]}/${m[1]}` : "";
};

function leerCrudo(clave: string): unknown {
  try {
    const c = localStorage.getItem(clave);
    return c === null ? null : JSON.parse(c);
  } catch {
    return null;
  }
}

function nombreProducto(id: unknown, conUnidad = false): string {
  const lista = leerCrudo("bodega-productos");
  const p = Array.isArray(lista) ? (lista as Obj[]).find((x) => x.id === id) : undefined;
  if (p) return `${conUnidad ? `${txt(p.unidad)} ` : ""}${p.codigo ? `${txt(p.codigo)} ` : ""}${txt(p.nombre)}`.trim();
  if (conUnidad && txt(id).startsWith("pre-")) return `bultos ${nombreProducto(id)}`;
  const pre: Record<string, string> = {
    "pre-PR-01": "PR-01 Preiniciación Cerdos",
    "pre-IN-01": "IN-01 Iniciación Cerdos",
    "pre-ML-01": "ML-01 Maxi lechones 337",
    "pre-MC-01": "MC-01 Maxi Cerdos 337 Fin.",
  };
  return pre[txt(id)] ?? "producto";
}

const nombreLote = (l: Obj) => {
  const codigo = txt(l.codigo);
  const nombre = txt(l.nombre);
  return codigo ? (nombre && nombre !== codigo ? `${codigo} · ${nombre}` : codigo) : nombre || "lote";
};

interface Coleccion {
  modulo: string;
  /** Identifica un elemento para saber si es el mismo antes y después */
  idDe?: (o: Obj) => string;
  describir: (o: Obj) => string;
  /** Detalle de lo que cambió en un elemento (si no se da, se dice "modificado") */
  cambios?: (antes: Obj, despues: Obj) => { accion: AccionLog; detalle: string }[];
}

function cambiosLote(a: Obj, d: Obj): { accion: AccionLog; detalle: string }[] {
  const n = nombreLote(d);
  const out: { accion: AccionLog; detalle: string }[] = [];
  const lista = (o: Obj, k: string) => (Array.isArray(o[k]) ? (o[k] as Obj[]) : []);
  const comparar = (k: string, que: string, describir: (x: Obj) => string) => {
    const antes = lista(a, k).map((x) => JSON.stringify(x));
    const despues = lista(d, k).map((x) => JSON.stringify(x));
    const nuevos = lista(d, k).filter((_, i) => !antes.includes(despues[i]));
    const quitados = lista(a, k).filter((_, i) => !despues.includes(antes[i]));
    if (nuevos.length === 1 && quitados.length === 1) {
      out.push({ accion: "Modificación", detalle: `${que} editado en ${n}: ${describir(quitados[0])} → ${describir(nuevos[0])}` });
      return;
    }
    for (const x of nuevos) out.push({ accion: "Creación", detalle: `${que} en ${n}: ${describir(x)}` });
    for (const x of quitados) out.push({ accion: "Eliminación", detalle: `${que} borrado de ${n}: ${describir(x)}` });
  };
  comparar("alimento", "Alimento", (x) =>
    `${x.producto ? `${num(x.cantidad)} ${txt(x.unidad)} ${txt(x.producto)}` : `${num(x.kg)} kg`} (${fechaCorta(x.fecha)}${x.hora ? ` ${txt(x.hora)}` : ""})`,
  );
  comparar("pesajes", "Pesaje", (x) => `${num(x.pesoPromedio)} kg promedio (${fechaCorta(x.fecha)})`);
  comparar("mortalidad", "Muerte", (x) => `${num(x.cantidad)} animal(es)${x.causa ? ` · ${txt(x.causa)}` : ""} (${fechaCorta(x.fecha)})`);
  if (a.activo !== d.activo) out.push({ accion: "Modificación", detalle: d.activo ? `${n} reabierto` : `${n} cerrado (venta)` });
  if (a.corralId !== d.corralId) {
    const corrales = leerCrudo("corrales");
    const c = Array.isArray(corrales) ? (corrales as Obj[]).find((x) => x.id === d.corralId) : undefined;
    out.push({ accion: "Modificación", detalle: `Corral de ${n}: ${c ? txt(c.codigo) : "cambiado"}` });
  }
  const resto = (o: Obj) => {
    const { alimento: _a, pesajes: _p, mortalidad: _m, activo: _ac, corralId: _c, vivos: _v, fechaSalida: _f, ...r } = o;
    return JSON.stringify(r);
  };
  if (out.length === 0 && resto(a) !== resto(d)) out.push({ accion: "Modificación", detalle: `${n} modificado` });
  return out;
}

const describirRegistroCerda = (cerdaId: string) => (r: Obj) => {
  const tipo = txt(r.tipo) || "Registro";
  const extra = r.tipo === "Parto" && r.codigoParto ? ` ${txt(r.codigoParto)}` : "";
  return `${tipo}${extra} de la cerda ${cerdaId}${r.fecha ? ` (${fechaCorta(r.fecha)})` : ""}`;
};

function coleccionDe(clave: string): Coleccion | null {
  if (clave.startsWith("historial-")) {
    const cerdaId = clave.slice("historial-".length);
    return { modulo: "Cerdas", idDe: (o) => JSON.stringify(o), describir: describirRegistroCerda(cerdaId) };
  }
  switch (clave) {
    case "cerdas":
      return { modulo: "Gestación", idDe: (o) => txt(o.id), describir: (o) => `Cerda ${txt(o.id)}${o.raza ? ` · ${txt(o.raza)}` : ""}` };
    case "engorde-lotes":
      return { modulo: "Engorde", idDe: (o) => txt(o.id), describir: (o) => `Lote ${nombreLote(o)} (${num(o.cantidadInicial)} animales)`, cambios: cambiosLote };
    case "bodega-facturas":
      return {
        modulo: "Bodega",
        idDe: (o) => txt(o.id),
        describir: (o) => {
          const lineas = Array.isArray(o.lineas) ? (o.lineas as Obj[]) : [];
          const total = lineas.reduce((s, l) => s + (Number(l.cantidad) || 0) * (Number(l.valorUnitario) || 0), 0);
          return `Factura ${txt(o.numero)}${o.proveedor ? ` · ${txt(o.proveedor)}` : ""} · ${lineas.length} producto(s) · ${pesos(total)}`;
        },
      };
    case "bodega-salidas":
      return {
        modulo: "Bodega",
        idDe: (o) => txt(o.id),
        describir: (o) => `Salida de ${num(o.cantidad)} ${nombreProducto(o.productoId, true)}${o.nota ? ` → ${txt(o.nota)}` : ""} (${fechaCorta(o.fecha)})`,
      };
    case "bodega-productos":
      return { modulo: "Bodega", idDe: (o) => txt(o.id), describir: (o) => `Producto ${`${txt(o.codigo)} ${txt(o.nombre)}`.trim()}${o.activo === false ? " (inactivo)" : ""}` };
    case "corrales":
      return { modulo: "Corrales", idDe: (o) => txt(o.id), describir: (o) => `Corral ${txt(o.codigo)} · ${txt(o.zona)}` };
    case "tratamientos":
      return { modulo: "Tratamientos", idDe: (o) => txt(o.id), describir: (o) => `${txt(o.tipo) || "Tratamiento"} ${txt(o.medicamento)} (${fechaCorta(o.fecha)})` };
    case "contabilidad-movimientos":
      return {
        modulo: "Contabilidad",
        idDe: (o) => txt(o.id),
        describir: (o) => `${o.tipo === "ingreso" ? "Ingreso" : "Gasto"} ${pesos(o.monto)} · ${txt(o.descripcion) || txt(o.categoria)} (${fechaCorta(o.fecha)})`,
      };
    case "monitoreo-lecturas":
      return { modulo: "Monitoreo", idDe: (o) => txt(o.id) || JSON.stringify(o), describir: (o) => `Lectura ${txt(o.zona)} (${fechaCorta(o.fecha)})` };
    case "bioseguridad-visitas":
      return { modulo: "Bioseguridad", idDe: (o) => txt(o.id) || JSON.stringify(o), describir: (o) => `Visita ${txt(o.nombre) || txt(o.visitante)} (${fechaCorta(o.fecha)})` };
    default:
      return null;
  }
}

const ETIQUETAS_CONFIG: Record<string, string> = {
  claveAjustes: "Clave de ajustes cambiada",
  claveEliminar: "Clave de eliminación cambiada",
  claveFacturas: "Clave de facturas cambiada",
  claveLotes: "Clave de lotes cambiada",
  claveAjustesActiva: "Clave de ajustes",
  claveEliminarActiva: "Clave de eliminación",
  claveFacturasActiva: "Clave de facturas",
  claveLotesActiva: "Clave de lotes",
  desteteMin: "Días de destete",
  desteteMax: "Días de destete",
  parideras: "Parideras",
  alimentacion: "Kilos de alimentación estándar",
  productosEtapa: "Productos de alimentación estándar",
  permitirSinInventario: "Usar productos sin inventario",
};

function describirConfig(antes: Obj, despues: Obj): { accion: AccionLog; detalle: string }[] {
  const vistos = new Set<string>();
  const out: { accion: AccionLog; detalle: string }[] = [];
  for (const k of new Set([...Object.keys(antes), ...Object.keys(despues)])) {
    if (JSON.stringify(antes[k]) === JSON.stringify(despues[k])) continue;
    const etiqueta = ETIQUETAS_CONFIG[k] ?? k;
    if (vistos.has(etiqueta)) continue;
    vistos.add(etiqueta);
    let detalle = etiqueta;
    if (k.endsWith("Activa")) detalle = `${etiqueta}: ${despues[k] === false ? "desactivada" : "activada"}`;
    else if (k === "permitirSinInventario") detalle = `${etiqueta}: ${despues[k] ? "activado" : "desactivado"}`;
    else if (k === "parideras") detalle = `${etiqueta}: ${num(despues[k])}`;
    else if (k === "desteteMin" || k === "desteteMax") detalle = `${etiqueta}: ${num(despues.desteteMin)} a ${num(despues.desteteMax)}`;
    out.push({ accion: "Modificación", detalle });
  }
  return out;
}

/** Compara lo que había con lo nuevo y registra lo que cambió */
export function registrarCambio(clave: string, antes: unknown, despues: unknown) {
  if (silencio > 0 || IGNORAR.has(clave) || typeof window === "undefined") return;
  try {
    if (JSON.stringify(antes ?? null) === JSON.stringify(despues ?? null)) return;
    if (clave === "config-granja") {
      registrarLog(describirConfig((antes as Obj) ?? {}, (despues as Obj) ?? {}).map((e) => ({ ...e, modulo: "Ajustes" })));
      return;
    }
    const col = coleccionDe(clave);
    if (!col) {
      registrarLog([{ accion: despues === null ? "Eliminación" : "Modificación", modulo: "Datos", detalle: `Cambio en ${clave}` }]);
      return;
    }
    const a = Array.isArray(antes) ? (antes as Obj[]) : [];
    const d = Array.isArray(despues) ? (despues as Obj[]) : [];
    const idDe = col.idDe ?? ((o: Obj) => JSON.stringify(o));
    const mapaA = new Map(a.map((o) => [idDe(o), o]));
    const mapaD = new Map(d.map((o) => [idDe(o), o]));
    const creados = d.filter((o) => !mapaA.has(idDe(o)));
    const borrados = a.filter((o) => !mapaD.has(idDe(o)));
    const entradas: { accion: AccionLog; modulo: string; detalle: string }[] = [];

    // Registros de cerda sin id: un borrado + una creación del mismo tipo es una edición
    if (clave.startsWith("historial-") && creados.length === 1 && borrados.length === 1 && creados[0].tipo === borrados[0].tipo) {
      entradas.push({ accion: "Modificación", modulo: col.modulo, detalle: `${col.describir(creados[0])} editado` });
    } else {
      for (const o of creados) entradas.push({ accion: "Creación", modulo: col.modulo, detalle: col.describir(o) });
      for (const o of borrados) entradas.push({ accion: "Eliminación", modulo: col.modulo, detalle: col.describir(o) });
    }
    for (const o of d) {
      const previo = mapaA.get(idDe(o));
      if (!previo || JSON.stringify(previo) === JSON.stringify(o)) continue;
      const cambios = col.cambios ? col.cambios(previo, o) : [{ accion: "Modificación" as AccionLog, detalle: `${col.describir(o)} modificado` }];
      for (const c of cambios) entradas.push({ ...c, modulo: col.modulo });
    }
    registrarLog(entradas);
  } catch {
    // el registro nunca debe impedir guardar
  }
}

/** Guarda un valor en el almacenamiento y registra el cambio */
export function guardarConRegistro(clave: string, valor: unknown) {
  const antes = leerCrudo(clave);
  // Cada registro del historial lleva su id para poder sincronizarlo por separado
  const final = clave.startsWith("historial-") ? prepararHistorial(antes, valor) : valor;
  localStorage.setItem(clave, JSON.stringify(final));
  registrarCambio(clave, antes, final);
  capturarCambio(clave, antes, final);
}

/** Borra una clave del almacenamiento y registra lo que se eliminó */
export function borrarConRegistro(clave: string) {
  const antes = leerCrudo(clave);
  localStorage.removeItem(clave);
  if (antes !== null) {
    registrarCambio(clave, antes, Array.isArray(antes) ? [] : null);
    capturarCambio(clave, antes, Array.isArray(antes) ? [] : null);
  }
}
