/*
 * Sincronización con la nube.
 *
 * La app sigue guardando todo en el teléfono (funciona sin internet). Cada
 * cambio se anota en una cola; cuando hay conexión se sube a la tabla
 * "documentos" y se bajan los cambios que hicieron los demás teléfonos.
 *
 * Cada elemento guardado es un documento (colección + id):
 *  - listas con id (cerdas, lotes, facturas…): un documento por elemento
 *  - historial de cada cerda: un documento por registro
 *  - valores sueltos (configuración, checklist): un documento "valor"
 * Si dos teléfonos cambian el mismo elemento, queda el último que se sube.
 *
 * Granjas: cada granja tiene sus datos aparte. La principal (El Mirador) usa los
 * nombres de colección de siempre; las demás los guardan como "g:<id>:<clave>".
 * En el teléfono solo está "en vivo" la granja elegida; las otras quedan
 * guardadas aparte y se cambian con cambiarGranja().
 */

import { api, perfilGuardado, sesionGuardada } from "@/lib/nube";

/* ───────────── Qué se sincroniza ───────────── */

const LISTAS = new Set([
  "cerdas",
  "engorde-lotes",
  "tratamientos",
  "contabilidad-movimientos",
  "monitoreo-lecturas",
  "bioseguridad-visitas",
  "bodega-productos",
  "bodega-facturas",
  "bodega-salidas",
  "corrales",
]);
const VALORES = new Set(["config-granja", "ajustes", "bioseguridad-checks"]);
/** Lista de granjas: es común a todas (no se separa por granja) */
export const CLAVE_GRANJAS = "granjas";
const ID_VALOR = "valor";

const esHistorial = (clave: string) => clave.startsWith("historial-");
export const seSincroniza = (clave: string) => clave === CLAVE_GRANJAS || LISTAS.has(clave) || VALORES.has(clave) || esHistorial(clave);

/* ───────────── Granjas ───────────── */

export const GRANJA_PRINCIPAL = "mirador";
const CLAVE_GRANJA_ACTUAL = "granja-actual";
export interface Granja {
  id: string;
  nombre: string;
  creada?: string;
}

export function granjaActual(): string {
  try {
    return localStorage.getItem(CLAVE_GRANJA_ACTUAL) || GRANJA_PRINCIPAL;
  } catch {
    return GRANJA_PRINCIPAL;
  }
}

/** Todas las granjas (la principal siempre primero) */
export function leerGranjas(): Granja[] {
  const otras = leerJson<Granja[]>(CLAVE_GRANJAS, []).filter((g) => g && g.id && g.id !== GRANJA_PRINCIPAL);
  return [{ id: GRANJA_PRINCIPAL, nombre: "El Mirador" }, ...otras];
}
export const nombreGranjaActual = () => leerGranjas().find((g) => g.id === granjaActual())?.nombre ?? "El Mirador";

/** Nombre de la colección en la nube para una clave del teléfono */
function remota(clave: string, granja = granjaActual()) {
  if (clave === CLAVE_GRANJAS || granja === GRANJA_PRINCIPAL) return clave;
  return `g:${granja}:${clave}`;
}
/** Clave del teléfono para una colección de la nube (null si es de otra granja) */
function local(coleccion: string, granja = granjaActual()): string | null {
  if (coleccion === CLAVE_GRANJAS) return coleccion;
  const m = /^g:([^:]+):(.+)$/.exec(coleccion);
  if (m) return m[1] === granja ? m[2] : null;
  return granja === GRANJA_PRINCIPAL ? coleccion : null;
}

type Obj = Record<string, unknown>;

/** Huella corta y estable para elementos sin id */
function huella(texto: string) {
  let h = 2166136261;
  for (let i = 0; i < texto.length; i++) h = Math.imul(h ^ texto.charCodeAt(i), 16777619);
  return `h${(h >>> 0).toString(36)}${texto.length.toString(36)}`;
}
const idDe = (o: Obj) => (typeof o?.id === "string" || typeof o?.id === "number" ? String(o.id) : huella(JSON.stringify(o)));

/* ───────────── Cola de cambios pendientes ───────────── */

const CLAVE_COLA = "sync-pendientes";
const CLAVE_META = "sync-meta";

interface Pendiente {
  coleccion: string;
  id: string;
  datos: unknown;
  borrado: boolean;
}
interface Meta {
  /** Fecha del último cambio bajado de la nube (granja principal, formato anterior) */
  cursor: string | null;
  /** Fecha del último cambio bajado, por granja */
  cursores?: Record<string, string | null>;
  /** Usuario con el que se inicializó este teléfono */
  usuarioId?: string;
  /** Última sincronización completa */
  ultima?: string;
  /** Hasta qué entrada del registro de actividad ya se subió */
  logSubido?: string;
  /** Ya se empezó en blanco en este teléfono (no se vuelve a borrar) */
  inicializado?: boolean;
  /** Generación de la base: si en la nube cambia, la base se reinició y se borra lo local */
  generacion?: number;
}

function leerJson<T>(clave: string, porDefecto: T): T {
  try {
    const v = localStorage.getItem(clave);
    return v ? (JSON.parse(v) as T) : porDefecto;
  } catch {
    return porDefecto;
  }
}
const leerCola = () => leerJson<Record<string, Pendiente>>(CLAVE_COLA, {});
const guardarCola = (c: Record<string, Pendiente>) => localStorage.setItem(CLAVE_COLA, JSON.stringify(c));
export const leerMeta = () => leerJson<Meta>(CLAVE_META, { cursor: null });
const guardarMeta = (m: Meta) => localStorage.setItem(CLAVE_META, JSON.stringify(m));
const llave = (coleccion: string, id: string) => `${coleccion}|${id}`;

export const pendientesPorSubir = () => Object.keys(leerCola()).length;

let aplicandoRemoto = false;

/**
 * Se llama cada vez que la app guarda algo: compara lo que había con lo nuevo
 * y anota en la cola los documentos que cambiaron.
 */
export function capturarCambio(clave: string, antes: unknown, despues: unknown) {
  if (aplicandoRemoto || typeof window === "undefined" || !seSincroniza(clave)) return;
  try {
    const cola = leerCola();
    const coleccion = remota(clave);
    const poner = (id: string, datos: unknown, borrado: boolean) => {
      cola[llave(coleccion, id)] = { coleccion, id, datos: borrado ? null : datos, borrado };
    };
    if (VALORES.has(clave)) {
      if (JSON.stringify(antes ?? null) !== JSON.stringify(despues ?? null)) poner(ID_VALOR, despues ?? null, despues === null || despues === undefined);
    } else {
      const a = Array.isArray(antes) ? (antes as Obj[]) : [];
      const d = Array.isArray(despues) ? (despues as Obj[]) : [];
      const mapaA = new Map(a.map((o) => [idDe(o), JSON.stringify(o)]));
      const idsD = new Set<string>();
      for (const o of d) {
        const id = idDe(o);
        idsD.add(id);
        if (mapaA.get(id) !== JSON.stringify(o)) poner(id, o, false);
      }
      for (const id of mapaA.keys()) if (!idsD.has(id)) poner(id, null, true);
    }
    guardarCola(cola);
    programarSubida();
  } catch {
    // la sincronización nunca debe impedir guardar
  }
}

/**
 * El historial de una cerda se guarda como lista sin ids. Antes de guardarlo
 * se le pone un id a cada registro (conservando el que ya tenía si es el mismo
 * registro), para poder sincronizar registro por registro.
 */
export function prepararHistorial(antes: unknown, despues: unknown): unknown {
  if (!Array.isArray(despues)) return despues;
  const sinId = (o: Obj) => {
    const { id: _id, ...resto } = o ?? {};
    return JSON.stringify(resto);
  };
  const libres = new Map<string, string[]>();
  for (const o of (Array.isArray(antes) ? antes : []) as Obj[]) {
    if (o && typeof o.id === "string") libres.set(sinId(o), [...(libres.get(sinId(o)) ?? []), o.id]);
  }
  const usados = new Set((despues as Obj[]).filter((o) => o && typeof o.id === "string").map((o) => o.id as string));
  return (despues as Obj[]).map((o) => {
    if (!o || typeof o !== "object" || typeof o.id === "string") return o;
    const candidatos = (libres.get(sinId(o)) ?? []).filter((id) => !usados.has(id));
    const id = candidatos[0] ?? `r${Date.now().toString(36)}${Math.random().toString(36).slice(2, 8)}`;
    usados.add(id);
    return { ...o, id };
  });
}

/* ───────────── Aplicar lo que llega de la nube ───────────── */

interface Documento {
  coleccion: string;
  id: string;
  datos: unknown;
  borrado: boolean;
  actualizado_en: string;
}

function ordenarHistorial(lista: Obj[]) {
  return [...lista].sort((a, b) => String(b.fecha ?? "").localeCompare(String(a.fecha ?? "")));
}

function aplicarDocumentos(docs: Documento[]) {
  if (!docs.length) return;
  const cola = leerCola();
  const porClave = new Map<string, Documento[]>();
  for (const d of docs) {
    const clave = local(d.coleccion);
    if (!clave || !seSincroniza(clave)) continue;
    // Si este teléfono tiene un cambio sin subir del mismo elemento, se respeta el local
    if (cola[llave(d.coleccion, d.id)]) continue;
    porClave.set(clave, [...(porClave.get(clave) ?? []), d]);
  }
  aplicandoRemoto = true;
  try {
    for (const [clave, lista] of porClave) {
      if (VALORES.has(clave)) {
        const ultimo = lista[lista.length - 1];
        if (ultimo.borrado || ultimo.datos === null) localStorage.removeItem(clave);
        else localStorage.setItem(clave, JSON.stringify(ultimo.datos));
        continue;
      }
      let actual = leerJson<Obj[]>(clave, []);
      if (!Array.isArray(actual)) actual = [];
      const indice = new Map(actual.map((o, i) => [idDe(o), i]));
      const borrar = new Set<string>();
      for (const d of lista) {
        const i = indice.get(d.id);
        if (d.borrado) {
          borrar.add(d.id);
        } else if (i !== undefined) {
          actual[i] = d.datos as Obj;
          borrar.delete(d.id);
        } else {
          indice.set(d.id, actual.length);
          actual.push(d.datos as Obj);
          borrar.delete(d.id);
        }
      }
      let resultado = actual.filter((o) => !borrar.has(idDe(o)));
      if (esHistorial(clave)) resultado = ordenarHistorial(resultado);
      if (resultado.length === 0 && esHistorial(clave)) localStorage.removeItem(clave);
      else localStorage.setItem(clave, JSON.stringify(resultado));
    }
  } finally {
    aplicandoRemoto = false;
  }
  // Avisa a las pantallas (useVersionDatos y las que escuchan "storage")
  window.dispatchEvent(new Event("storage"));
  window.dispatchEvent(new Event(EVENTO_SYNC));
}

/* ───────────── Subir y bajar ───────────── */

export const EVENTO_SYNC = "sync-estado";
export type EstadoSync = "sin-sesion" | "sin-conexion" | "sincronizando" | "al-dia" | "pendiente" | "error";
let estado: EstadoSync = "pendiente";
let ultimoError = "";
export const estadoSync = () => estado;
export const errorSync = () => ultimoError;
function ponerEstado(e: EstadoSync, error = "") {
  estado = e;
  ultimoError = error;
  try {
    window.dispatchEvent(new Event(EVENTO_SYNC));
  } catch {}
}

async function subir() {
  const cola = leerCola();
  const items = Object.values(cola);
  if (!items.length) return;
  const enviar = async (lote: Pendiente[]) =>
    api("documentos?on_conflict=coleccion,id", {
      method: "POST",
      headers: { Prefer: "resolution=merge-duplicates,return=minimal" },
      body: JSON.stringify(lote.map(({ coleccion, id, datos, borrado }) => ({ coleccion, id, datos, borrado }))),
    });
  const quitar = (lote: Pendiente[]) => {
    const c = leerCola();
    for (const p of lote) {
      const k = llave(p.coleccion, p.id);
      // Solo se quita si no cambió otra vez mientras se subía
      if (JSON.stringify(c[k]) === JSON.stringify(p)) delete c[k];
    }
    guardarCola(c);
  };
  for (let i = 0; i < items.length; i += 200) {
    const lote = items.slice(i, i + 200);
    try {
      await enviar(lote);
      quitar(lote);
    } catch (e) {
      const estadoHttp = (e as { estado?: number }).estado ?? 0;
      if (estadoHttp === 0 || estadoHttp === 401) throw e;
      // Algún elemento fue rechazado (p. ej. borrar sin permiso): se suben uno por uno
      const rechazados: Pendiente[] = [];
      for (const p of lote) {
        try {
          await enviar([p]);
        } catch (e2) {
          if (((e2 as { estado?: number }).estado ?? 0) === 0) throw e2;
          rechazados.push(p);
        }
      }
      quitar(lote);
      // Lo rechazado se vuelve a traer de la nube para deshacer el cambio local
      if (rechazados.length) await restaurarDesdeNube(rechazados);
    }
  }
}

async function restaurarDesdeNube(items: Pendiente[]) {
  const docs: Documento[] = [];
  for (const p of items) {
    const r = await api<Documento[]>(
      `documentos?select=coleccion,id,datos,borrado,actualizado_en&coleccion=eq.${encodeURIComponent(p.coleccion)}&id=eq.${encodeURIComponent(p.id)}`,
    );
    docs.push(...(r.length ? r : [{ coleccion: p.coleccion, id: p.id, datos: null, borrado: true, actualizado_en: "" }]));
  }
  aplicarDocumentos(docs);
  ultimoError = "Algunos cambios no se guardaron en la nube porque tu usuario no tiene permiso.";
}

/** Milisegundos de una fecha de la nube (Safari no lee bien 6 decimales de segundo) */
const ms = (iso: string) => new Date(iso.replace(/(\.\d{3})\d+/, "$1")).getTime();

async function bajar() {
  const granja = granjaActual();
  const meta = leerMeta();
  let cursor = (meta.cursores ?? {})[granja] ?? (granja === GRANJA_PRINCIPAL ? meta.cursor : null);
  // Solo se baja la granja elegida (y la lista de granjas)
  const deLaGranja = granja === GRANJA_PRINCIPAL ? "&coleccion=not.like.g:*" : `&or=(coleccion.like.g:${granja}:*,coleccion.eq.${CLAVE_GRANJAS})`;
  for (;;) {
    // Se repasan 2 minutos hacia atrás por si algún cambio se guardó con una hora anterior
    const desde = cursor ? new Date(ms(cursor) - 120_000).toISOString() : null;
    const filtro = (desde ? `&actualizado_en=gte.${encodeURIComponent(desde)}` : "") + deLaGranja;
    const docs = await api<Documento[]>(`documentos?select=coleccion,id,datos,borrado,actualizado_en${filtro}&order=actualizado_en.asc&limit=1000`);
    aplicarDocumentos(docs);
    const ultimo = docs[docs.length - 1]?.actualizado_en ?? cursor;
    const avanzo = !!ultimo && (!cursor || ms(ultimo) > ms(cursor));
    if (avanzo) cursor = ultimo;
    const m = leerMeta();
    guardarMeta({ ...m, cursores: { ...(m.cursores ?? {}), [granja]: cursor } });
    if (docs.length < 1000 || !avanzo) break;
  }
}

/* Registro de actividad: se sube lo nuevo de este teléfono */
async function subirRegistro() {
  const meta = leerMeta();
  const log = leerJson<{ id: string; fecha: string; accion: string; modulo: string; detalle: string; granja?: string }[]>("registro-actividad", []);
  const nuevos = meta.logSubido ? log.filter((e) => e.fecha > meta.logSubido!) : log;
  if (!nuevos.length) return;
  const lote = nuevos.slice(0, 500).map(({ id, fecha, accion, modulo, detalle, granja }) => ({ id, fecha, accion, modulo, detalle, granja: granja ?? null }));
  await api("registro_actividad?on_conflict=id", {
    method: "POST",
    headers: { Prefer: "resolution=ignore-duplicates,return=minimal" },
    body: JSON.stringify(lote),
  });
  const masReciente = lote.reduce((m, e) => (e.fecha > m ? e.fecha : m), meta.logSubido ?? "");
  guardarMeta({ ...leerMeta(), logSubido: masReciente });
}

/* Claves de datos de la granja en este teléfono (para empezar en blanco) */
function clavesLocales(): string[] {
  const out: string[] = [];
  for (let i = 0; i < localStorage.length; i++) {
    const k = localStorage.key(i);
    if (k && k !== CLAVE_GRANJAS && (seSincroniza(k) || k === "engorde-secuencia-lotes" || k === "bodega-articulos")) out.push(k);
  }
  return out;
}

let enCurso: Promise<void> | null = null;

/** Sube lo pendiente y baja lo nuevo. Se puede llamar seguido: no se encima. */
export function sincronizar(): Promise<void> {
  if (enCurso) return enCurso;
  const p = ejecutarSincronizacion();
  enCurso = p;
  // Se libera al terminar (aunque termine al instante, p. ej. sin internet)
  void p.finally(() => {
    if (enCurso === p) enCurso = null;
  });
  return p;
}

function ejecutarSincronizacion(): Promise<void> {
  return (async () => {
    try {
      const sesion = sesionGuardada();
      if (!sesion) return ponerEstado("sin-sesion");
      if (typeof navigator !== "undefined" && !navigator.onLine) return ponerEstado("sin-conexion");
      ponerEstado("sincronizando");

      // Si el administrador reinició la base, este teléfono también queda en blanco
      const meta0 = leerMeta();
      const filas = await api<{ generacion: number }[]>("reinicio?select=generacion&id=eq.1").catch(() => null);
      const remota = filas?.[0] ? Number(filas[0].generacion) : null;
      if (remota !== null) {
        if (meta0.inicializado && meta0.generacion !== undefined && meta0.generacion !== remota) borrarTodoLocal(remota);
        else if (meta0.generacion !== remota) guardarMeta({ ...meta0, generacion: remota });
      }

      // Primera vez en este teléfono: se empieza en blanco con lo que hay en la nube
      const meta = leerMeta();
      if (!meta.inicializado) {
        aplicandoRemoto = true;
        try {
          for (const k of clavesLocales()) localStorage.removeItem(k);
          localStorage.removeItem(CLAVE_COLA);
          localStorage.removeItem("registro-actividad");
        } finally {
          aplicandoRemoto = false;
        }
        guardarMeta({ cursor: null, usuarioId: perfilGuardado()?.id ?? sesion.user_id, logSubido: new Date().toISOString(), inicializado: true, generacion: remota ?? undefined });
        window.dispatchEvent(new Event("storage"));
      }

      await subir();
      await bajar();
      await subirRegistro().catch(() => {});
      guardarMeta({ ...leerMeta(), ultima: new Date().toISOString() });
      if (ultimoError && Object.keys(leerCola()).length === 0) ponerEstado("al-dia", ultimoError);
      else ponerEstado(Object.keys(leerCola()).length ? "pendiente" : "al-dia");
    } catch (e) {
      const est = (e as { estado?: number }).estado ?? 0;
      ponerEstado(est === 0 ? "sin-conexion" : "error", (e as Error).message);
    }
  })();
}

let temporizador: ReturnType<typeof setTimeout> | null = null;
/** Después de un cambio local, sube en unos segundos (agrupa varios cambios seguidos) */
export function programarSubida(ms = 2500) {
  if (typeof window === "undefined") return;
  if (temporizador) clearTimeout(temporizador);
  temporizador = setTimeout(() => {
    temporizador = null;
    void sincronizar();
  }, ms);
}

/**
 * Reemplaza el valor de una clave registrando el cambio para la nube
 * (restaurar un respaldo, borrar todos los datos…).
 */
export function reemplazarClave(clave: string, valor: unknown | null) {
  const antes = leerJson<unknown>(clave, null);
  if (valor === null) localStorage.removeItem(clave);
  else localStorage.setItem(clave, JSON.stringify(valor));
  capturarCambio(clave, antes, valor === null ? (Array.isArray(antes) ? [] : null) : valor);
}

/**
 * Deja este teléfono en blanco después de un reinicio de la base: borra los
 * datos de todas las granjas, lo pendiente por subir y el registro, y vuelve a
 * la granja principal. La sesión, el PIN y el Face ID se conservan.
 */
export function borrarTodoLocal(generacion: number) {
  aplicandoRemoto = true;
  try {
    const borrar: string[] = [];
    for (let i = 0; i < localStorage.length; i++) {
      const k = localStorage.key(i);
      if (k && k.startsWith("granja-guardada:")) borrar.push(k);
    }
    for (const k of [...clavesLocales(), ...borrar, CLAVE_GRANJAS, CLAVE_GRANJA_ACTUAL, CLAVE_COLA, "registro-actividad"]) localStorage.removeItem(k);
  } finally {
    aplicandoRemoto = false;
  }
  guardarMeta({ cursor: null, usuarioId: leerMeta().usuarioId, logSubido: new Date().toISOString(), inicializado: true, generacion });
  window.dispatchEvent(new Event("storage"));
}

/** Borra el estado de sincronización (al cerrar sesión no hace falta: los datos son de la granja) */
export function reiniciarSincronizacion() {
  localStorage.removeItem(CLAVE_META);
  localStorage.removeItem(CLAVE_COLA);
}

/* ───────────── Crear y cambiar de granja ───────────── */

const prefijoGuardado = (granja: string) => `granja-guardada:${granja}:`;

/** Crea una granja nueva (en blanco) y la devuelve */
export function crearGranja(nombre: string): Granja {
  const limpio = nombre.trim().slice(0, 40);
  const granja: Granja = { id: `${Date.now().toString(36)}${Math.random().toString(36).slice(2, 6)}`, nombre: limpio, creada: new Date().toISOString() };
  const otras = leerJson<Granja[]>(CLAVE_GRANJAS, []);
  reemplazarClave(CLAVE_GRANJAS, [...otras, granja]);
  return granja;
}

/**
 * Cambia la granja en uso: guarda aparte los datos de la actual y pone "en vivo"
 * los de la elegida (lo que haya guardado en este teléfono). Después hay que
 * sincronizar para traer lo último de la nube.
 */
export function cambiarGranja(id: string) {
  const actual = granjaActual();
  if (id === actual) return;
  aplicandoRemoto = true;
  try {
    // 1. Guardar aparte la granja actual
    for (const k of clavesLocales()) {
      const v = localStorage.getItem(k);
      if (v !== null) localStorage.setItem(prefijoGuardado(actual) + k, v);
      localStorage.removeItem(k);
    }
    // 2. Poner en vivo la elegida
    const prefijo = prefijoGuardado(id);
    const guardadas: string[] = [];
    for (let i = 0; i < localStorage.length; i++) {
      const k = localStorage.key(i);
      if (k && k.startsWith(prefijo)) guardadas.push(k);
    }
    for (const k of guardadas) {
      localStorage.setItem(k.slice(prefijo.length), localStorage.getItem(k) ?? "");
      localStorage.removeItem(k);
    }
    localStorage.setItem(CLAVE_GRANJA_ACTUAL, id);
  } finally {
    aplicandoRemoto = false;
  }
  window.dispatchEvent(new Event("storage"));
}
