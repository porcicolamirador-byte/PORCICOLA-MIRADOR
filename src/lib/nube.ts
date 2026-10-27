/*
 * Conexión con la base de datos en la nube (Supabase).
 * Se usa fetch directo (sin librerías): funciones de acceso, renovación de la
 * sesión y la API de datos. La sesión queda guardada en este teléfono.
 *
 * La URL y la llave publicable son públicas por diseño: la seguridad la dan
 * el inicio de sesión y las reglas de acceso (RLS) de la base de datos.
 */

export const NUBE_URL = "https://nfcroczfghddbndwgbab.supabase.co";
export const NUBE_LLAVE = "sb_publishable_vtvrwisDhsm2Vj2vdFhMEw_iHlHZIFu";

const CLAVE_SESION = "nube-sesion";
const CLAVE_PERFIL = "nube-perfil";

export interface SesionNube {
  access_token: string;
  refresh_token: string;
  /** Segundos desde 1970 en que vence el token de acceso */
  expires_at?: number;
  user_id: string;
}

export type PermisoNube = "eliminar" | "bodega" | "ajustes" | "contabilidad";

export interface PerfilNube {
  id: string;
  usuario: string;
  nombre: string;
  rol: "admin" | "trabajador";
  permisos: Partial<Record<PermisoNube, boolean>>;
  /** Granjas a las que entra (null o vacío de campo = todas, incluidas las nuevas) */
  granjas?: string[] | null;
  activo?: boolean;
  creado_en?: string;
}

export class ErrorNube extends Error {
  constructor(
    mensaje: string,
    public estado = 0,
  ) {
    super(mensaje);
  }
}

/* ───────────── Sesión guardada ───────────── */

function leerJson<T>(clave: string): T | null {
  try {
    const v = localStorage.getItem(clave);
    return v ? (JSON.parse(v) as T) : null;
  } catch {
    return null;
  }
}

export const sesionGuardada = () => leerJson<SesionNube>(CLAVE_SESION);
export const perfilGuardado = () => leerJson<PerfilNube>(CLAVE_PERFIL);

function guardarSesion(sesion: SesionNube | null, perfil?: PerfilNube | null) {
  try {
    if (sesion) localStorage.setItem(CLAVE_SESION, JSON.stringify(sesion));
    else localStorage.removeItem(CLAVE_SESION);
    if (perfil !== undefined) {
      if (perfil) localStorage.setItem(CLAVE_PERFIL, JSON.stringify(perfil));
      else localStorage.removeItem(CLAVE_PERFIL);
    }
  } catch {
    // sin almacenamiento
  }
  try {
    window.dispatchEvent(new Event(EVENTO_SESION));
  } catch {}
}

/** Se emite en window cada vez que cambia la sesión o el perfil guardado */
export const EVENTO_SESION = "nube-sesion";

export function cerrarSesionNube() {
  const s = sesionGuardada();
  guardarSesion(null, null);
  if (s) {
    // Avisa al servidor; si no hay internet no importa, el token vence solo
    fetch(`${NUBE_URL}/auth/v1/logout?scope=local`, {
      method: "POST",
      headers: { apikey: NUBE_LLAVE, Authorization: `Bearer ${s.access_token}` },
    }).catch(() => {});
  }
}

/* ───────────── Peticiones ───────────── */

async function pedir(url: string, init: RequestInit & { tiempo?: number } = {}) {
  const control = new AbortController();
  const t = setTimeout(() => control.abort(), init.tiempo ?? 15000);
  try {
    return await fetch(url, { ...init, signal: control.signal });
  } catch {
    throw new ErrorNube("Sin conexión con la nube", 0);
  } finally {
    clearTimeout(t);
  }
}

async function leerRespuesta<T>(r: Response): Promise<T> {
  const texto = await r.text();
  const datos = texto ? JSON.parse(texto) : null;
  if (!r.ok) throw new ErrorNube((datos && (datos.error || datos.message || datos.msg)) || `Error ${r.status}`, r.status);
  return datos as T;
}

let renovando: Promise<SesionNube | null> | null = null;

/** Token de acceso vigente (lo renueva si está por vencer) */
export async function tokenVigente(): Promise<string | null> {
  const s = sesionGuardada();
  if (!s) return null;
  const vence = (s.expires_at ?? 0) * 1000;
  if (vence - Date.now() > 60_000) return s.access_token;
  renovando ??= (async () => {
    try {
      const r = await pedir(`${NUBE_URL}/auth/v1/token?grant_type=refresh_token`, {
        method: "POST",
        headers: { apikey: NUBE_LLAVE, "Content-Type": "application/json" },
        body: JSON.stringify({ refresh_token: s.refresh_token }),
      });
      if (r.status === 400 || r.status === 401 || r.status === 403) {
        // Sesión revocada (usuario desactivado o cerrada en otro lado)
        guardarSesion(null, null);
        return null;
      }
      const d = await leerRespuesta<{ access_token: string; refresh_token: string; expires_at?: number; user: { id: string } }>(r);
      const nueva: SesionNube = { access_token: d.access_token, refresh_token: d.refresh_token, expires_at: d.expires_at, user_id: d.user.id };
      guardarSesion(nueva);
      return nueva;
    } finally {
      renovando = null;
    }
  })();
  const nueva = await renovando;
  return nueva?.access_token ?? null;
}

/** Llama a una función del servidor (acceso, usuarios…) */
export async function llamarFuncion<T>(nombre: string, cuerpo: Record<string, unknown>, conSesion = true): Promise<T> {
  const token = conSesion ? await tokenVigente() : null;
  if (conSesion && !token) throw new ErrorNube("Inicia sesión", 401);
  const r = await pedir(`${NUBE_URL}/functions/v1/${nombre}`, {
    method: "POST",
    headers: {
      apikey: NUBE_LLAVE,
      "Content-Type": "application/json",
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
    },
    body: JSON.stringify(cuerpo),
  });
  return leerRespuesta<T>(r);
}

/** API de datos (tablas) con la sesión del usuario */
export async function api<T>(ruta: string, init: RequestInit = {}): Promise<T> {
  const token = await tokenVigente();
  if (!token) throw new ErrorNube("Inicia sesión", 401);
  const r = await pedir(`${NUBE_URL}/rest/v1/${ruta}`, {
    ...init,
    headers: {
      apikey: NUBE_LLAVE,
      Authorization: `Bearer ${token}`,
      "Content-Type": "application/json",
      ...(init.headers ?? {}),
    },
  });
  return leerRespuesta<T>(r);
}

/* ───────────── Acceso con usuario y PIN ───────────── */

interface RespuestaAcceso {
  sesion: SesionNube;
  perfil: PerfilNube;
}

/** Si ya existe algún usuario (si no, el primero que entre crea el administrador) */
export async function hayUsuariosEnLaNube(): Promise<boolean> {
  const r = await llamarFuncion<{ hayUsuarios: boolean }>("acceso", { accion: "estado" }, false);
  return r.hayUsuarios;
}

export async function entrarConPin(usuario: string, pin: string): Promise<PerfilNube> {
  const r = await llamarFuncion<RespuestaAcceso>("acceso", { accion: "entrar", usuario: usuario.trim().toLowerCase(), pin }, false);
  guardarSesion(r.sesion, r.perfil);
  return r.perfil;
}

export async function crearPrimerAdministrador(usuario: string, nombre: string, pin: string): Promise<PerfilNube> {
  const r = await llamarFuncion<RespuestaAcceso>("acceso", { accion: "crear-admin", usuario: usuario.trim().toLowerCase(), nombre, pin }, false);
  guardarSesion(r.sesion, r.perfil);
  return r.perfil;
}

/** Vuelve a leer el perfil del servidor (rol y permisos actualizados) */
export async function actualizarPerfil(): Promise<PerfilNube | null> {
  try {
    const r = await llamarFuncion<{ perfil: PerfilNube }>("usuarios", { accion: "yo" });
    guardarSesion(sesionGuardada(), r.perfil);
    return r.perfil;
  } catch (e) {
    if (e instanceof ErrorNube && e.estado === 401) guardarSesion(null, null);
    return perfilGuardado();
  }
}

/** ¿El usuario de este teléfono puede hacer algo? (el administrador puede todo) */
/** ¿Este usuario puede entrar a la granja? (admin y "todas" → siempre) */
export function puedeVerGranja(id: string, perfil = perfilGuardado()): boolean {
  if (!perfil) return true;
  return perfil.rol === "admin" || !Array.isArray(perfil.granjas) || perfil.granjas.includes(id);
}
/** Solo quien tiene acceso a todas las granjas puede crear granjas nuevas */
export function puedeCrearGranjas(perfil = perfilGuardado()): boolean {
  return !!perfil && (perfil.rol === "admin" || !Array.isArray(perfil.granjas));
}

export function puede(permiso: PermisoNube): boolean {
  const p = perfilGuardado();
  return !!p && (p.rol === "admin" || p.permisos?.[permiso] === true);
}

/* ───────────── Administración de usuarios ───────────── */

export const listarUsuarios = () => llamarFuncion<{ usuarios: PerfilNube[] }>("usuarios", { accion: "listar" }).then((r) => r.usuarios);

export const crearUsuario = (datos: { usuario: string; nombre: string; pin: string; rol?: PerfilNube["rol"]; permisos?: PerfilNube["permisos"]; granjas?: string[] | null }) =>
  llamarFuncion<{ usuario: PerfilNube }>("usuarios", { accion: "crear", ...datos }).then((r) => r.usuario);

export const actualizarUsuario = (
  id: string,
  cambios: Partial<Pick<PerfilNube, "nombre" | "rol" | "permisos" | "activo" | "granjas">> & { pin?: string },
) => llamarFuncion<{ usuario: PerfilNube }>("usuarios", { accion: "actualizar", id, ...cambios }).then((r) => r.usuario);

/** Borra un usuario para siempre (solo administrador). Sus registros se conservan. */
/** Borra todos los datos de la granja en la nube (solo administrador, con su PIN) */
export const reiniciarBaseNube = (pin: string) => llamarFuncion<{ generacion: number }>("usuarios", { accion: "reiniciar", pin }).then((r) => r.generacion);
export const eliminarUsuario = (id: string) => llamarFuncion<{ eliminado: string; usuario: string }>("usuarios", { accion: "eliminar", id });

export interface ConsumoNube {
  base_bytes: number;
  datos_bytes: number;
  registro_bytes: number;
  documentos: number;
  borrados: number;
  registro: number;
  usuarios: number;
  usuarios_activos: number;
  por_coleccion: Record<string, number>;
  ultimo_cambio: string | null;
}

/** Espacio y registros que ocupa la granja en la nube (solo administrador) */
export const consumoNube = () => api<ConsumoNube>("rpc/consumo_nube", { method: "POST", body: "{}" });
