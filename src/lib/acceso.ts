/*
 * Acceso a la sección de ajustes protegidos.
 * Ya no se pide código: entra el administrador o quien tenga el permiso
 * "Ajustes protegidos" (se da en Ajustes protegidos → Usuarios). La nube
 * hace cumplir los permisos aunque alguien intente saltarse la app.
 */

import { puede } from "@/lib/nube";

/** Si el usuario de este teléfono puede entrar a los ajustes protegidos */
export function ajustesDesbloqueados(): boolean {
  return puede("ajustes");
}

/** Se conservan por compatibilidad; el acceso depende solo del permiso */
export function desbloquearAjustes() {}
export function bloquearAjustes() {}
