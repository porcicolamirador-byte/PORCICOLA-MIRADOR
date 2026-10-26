/*
 * Acceso a la sección oculta de Ajustes.
 * El código se compara en el teléfono: sirve para evitar cambios por
 * accidente, no como seguridad fuerte (quien tenga el código fuente lo ve).
 */

import { leerConfig } from "@/lib/config";

const CLAVE_SESION = "ajustes-avanzados-hasta";
/** Marca de que en este teléfono ya se ingresó la clave alguna vez */
const CLAVE_DISPOSITIVO = "ajustes-clave-ingresada";
/** Tiempo que la sección queda abierta tras ingresar el código */
const DURACION_MS = 15 * 60 * 1000;

export function codigoValido(codigo: string): boolean {
  return codigo.trim() === leerConfig().claveAjustes;
}

export function desbloquearAjustes() {
  try {
    sessionStorage.setItem(CLAVE_SESION, String(Date.now() + DURACION_MS));
    localStorage.setItem(CLAVE_DISPOSITIVO, "1");
  } catch {}
}

/**
 * Con la clave de ajustes desactivada, se entra sin clave si en este
 * teléfono ya se ingresó alguna vez (la primera vez siempre se pide).
 */
export function entradaLibre(): boolean {
  try {
    return !leerConfig().claveAjustesActiva && localStorage.getItem(CLAVE_DISPOSITIVO) === "1";
  } catch {
    return false;
  }
}

export function bloquearAjustes() {
  try {
    sessionStorage.removeItem(CLAVE_SESION);
  } catch {}
}

export function ajustesDesbloqueados(): boolean {
  try {
    const hasta = Number(sessionStorage.getItem(CLAVE_SESION));
    return Number.isFinite(hasta) && hasta > Date.now();
  } catch {
    return false;
  }
}
