/*
 * Acceso a la sección oculta de Ajustes.
 * El código se compara en el teléfono: sirve para evitar cambios por
 * accidente, no como seguridad fuerte (quien tenga el código fuente lo ve).
 */

/** Código para abrir los ajustes avanzados */
export const CODIGO_AJUSTES = "0030";

const CLAVE_SESION = "ajustes-avanzados-hasta";
/** Tiempo que la sección queda abierta tras ingresar el código */
const DURACION_MS = 15 * 60 * 1000;

export function codigoValido(codigo: string): boolean {
  return codigo.trim() === CODIGO_AJUSTES;
}

export function desbloquearAjustes() {
  try {
    sessionStorage.setItem(CLAVE_SESION, String(Date.now() + DURACION_MS));
  } catch {}
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
