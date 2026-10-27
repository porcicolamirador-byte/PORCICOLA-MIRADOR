/*
 * Bloqueo de la app en este teléfono (opcional, como en WhatsApp).
 * Por defecto, después de iniciar sesión una vez la app abre directo.
 * Si se activa "Pedir Face ID al abrir", se pide el rostro; si falla, el PIN,
 * que se comprueba contra un resumen (PBKDF2) guardado aquí, así funciona sin
 * internet. El PIN nunca se guarda tal cual.
 */

const CLAVE_PIN = "app-pin-local";
const CLAVE_ABIERTA = "app-desbloqueada";
/** "1" si en este teléfono se pidió bloquear la app con Face ID (apagado por defecto, como WhatsApp) */
const CLAVE_BLOQUEO = "app-bloqueo";

export function bloqueoActivo(): boolean {
  try {
    return localStorage.getItem(CLAVE_BLOQUEO) === "1";
  } catch {
    return false;
  }
}

export function ponerBloqueo(activo: boolean) {
  try {
    if (activo) localStorage.setItem(CLAVE_BLOQUEO, "1");
    else localStorage.removeItem(CLAVE_BLOQUEO);
  } catch {}
}
/** Al volver a la app después de este tiempo en segundo plano, se pide Face ID otra vez */
export const BLOQUEO_TRAS_MS = 5 * 60 * 1000;

interface PinLocal {
  usuario: string;
  sal: string;
  resumen: string;
  /** Cantidad de números del PIN (4 los anteriores, 6 los nuevos) */
  largo?: number;
}

const aHex = (b: ArrayBuffer | Uint8Array) => Array.from(new Uint8Array(b), (x) => x.toString(16).padStart(2, "0")).join("");

async function resumir(pin: string, sal: string) {
  const base = await crypto.subtle.importKey("raw", new TextEncoder().encode(pin), "PBKDF2", false, ["deriveBits"]);
  const bits = await crypto.subtle.deriveBits({ name: "PBKDF2", salt: new TextEncoder().encode(sal), iterations: 150_000, hash: "SHA-256" }, base, 256);
  return aHex(bits);
}

/** Se llama tras entrar con PIN en el servidor: deja el PIN listo para desbloquear sin internet */
export async function recordarPinLocal(usuario: string, pin: string) {
  try {
    const sal = `${usuario}:${aHex(crypto.getRandomValues(new Uint8Array(16)))}`;
    const dato: PinLocal = { usuario, sal, resumen: await resumir(pin, sal), largo: pin.length };
    localStorage.setItem(CLAVE_PIN, JSON.stringify(dato));
  } catch {
    // sin almacenamiento: se pedirá iniciar sesión de nuevo
  }
}

export async function pinLocalCorrecto(pin: string): Promise<boolean> {
  try {
    const dato = JSON.parse(localStorage.getItem(CLAVE_PIN) || "null") as PinLocal | null;
    if (!dato) return false;
    return (await resumir(pin, dato.sal)) === dato.resumen;
  } catch {
    return false;
  }
}

/** Números del PIN guardado en este teléfono (6 por defecto) */
export function largoPinLocal(): number {
  try {
    const dato = JSON.parse(localStorage.getItem(CLAVE_PIN) || "null") as PinLocal | null;
    return dato ? (dato.largo ?? 4) : 6;
  } catch {
    return 6;
  }
}
export const hayPinLocal = () => {
  try {
    return localStorage.getItem(CLAVE_PIN) !== null;
  } catch {
    return false;
  }
};

/*
 * Confirmar una acción con el PIN propio (eliminar, facturas, lotes…).
 * Funciona sin internet; 5 intentos fallidos bloquean 15 minutos.
 */
const CLAVE_FALLOS = "pin-accion-fallos";
export async function verificarPinPropio(pin: string): Promise<"ok" | "incorrecto" | "bloqueado" | "sin-pin"> {
  let f = { n: 0, hasta: 0 };
  try {
    f = { ...f, ...JSON.parse(localStorage.getItem(CLAVE_FALLOS) || "{}") };
  } catch {}
  if (f.hasta > Date.now()) return "bloqueado";
  if (!hayPinLocal()) return "sin-pin";
  if (await pinLocalCorrecto(pin)) {
    try {
      localStorage.removeItem(CLAVE_FALLOS);
    } catch {}
    return "ok";
  }
  const n = f.n + 1;
  const nuevo = n >= 5 ? { n: 0, hasta: Date.now() + 15 * 60 * 1000 } : { n, hasta: 0 };
  try {
    localStorage.setItem(CLAVE_FALLOS, JSON.stringify(nuevo));
  } catch {}
  return n >= 5 ? "bloqueado" : "incorrecto";
}
export const mensajePin = (r: "incorrecto" | "bloqueado" | "sin-pin") =>
  r === "bloqueado" ? "Demasiados intentos. Espera 15 minutos." : r === "sin-pin" ? "Vuelve a iniciar sesión en este teléfono." : "PIN incorrecto";

export function olvidarPinLocal() {
  try {
    localStorage.removeItem(CLAVE_PIN);
    localStorage.removeItem(CLAVE_BLOQUEO);
    sessionStorage.removeItem(CLAVE_ABIERTA);
  } catch {}
}

/** Marca la app como desbloqueada (hasta que pase un rato en segundo plano o se cierre) */
export function marcarDesbloqueada() {
  try {
    sessionStorage.setItem(CLAVE_ABIERTA, String(Date.now()));
  } catch {}
}

/** Actualiza la hora de la última actividad (mientras la app está en pantalla) */
export function tocarDesbloqueo() {
  try {
    if (sessionStorage.getItem(CLAVE_ABIERTA)) sessionStorage.setItem(CLAVE_ABIERTA, String(Date.now()));
  } catch {}
}

export function estaDesbloqueada(): boolean {
  try {
    const t = Number(sessionStorage.getItem(CLAVE_ABIERTA));
    return Number.isFinite(t) && t > 0 && Date.now() - t < BLOQUEO_TRAS_MS;
  } catch {
    return false;
  }
}
