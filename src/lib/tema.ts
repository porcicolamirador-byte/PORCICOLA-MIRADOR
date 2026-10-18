/*
 * Modo oscuro (estilo WhatsApp). La preferencia se guarda en este teléfono
 * y se aplica con la clase "oscuro" en <html>. Un script en el layout la
 * aplica antes de pintar la pantalla para que no se vea un destello blanco.
 */

export const CLAVE_TEMA = "tema";
export const FONDO_CLARO = "#ffffff";
export const FONDO_OSCURO = "#000000";
export const EVENTO_TEMA = "tema-cambio";

export function esOscuro(): boolean {
  return typeof document !== "undefined" && document.documentElement.classList.contains("oscuro");
}

export function temaGuardado(): "oscuro" | "claro" {
  try {
    return localStorage.getItem(CLAVE_TEMA) === "oscuro" ? "oscuro" : "claro";
  } catch {
    return "claro";
  }
}

/** Activa o desactiva el modo oscuro y avisa a la app */
export function aplicarTema(oscuro: boolean) {
  try {
    localStorage.setItem(CLAVE_TEMA, oscuro ? "oscuro" : "claro");
  } catch {}
  const root = document.documentElement;
  root.classList.toggle("oscuro", oscuro);
  const fondo = oscuro ? FONDO_OSCURO : FONDO_CLARO;
  root.style.backgroundColor = fondo;
  root.style.setProperty("--page-bg", fondo);
  root.style.setProperty("--page-fg", oscuro ? "#f2f2f7" : "#111827");
  document.body.style.backgroundColor = fondo;
  document.querySelectorAll<HTMLMetaElement>('meta[name="theme-color"]').forEach((m) => (m.content = fondo));
  window.dispatchEvent(new Event(EVENTO_TEMA));
}

/** Script que corre antes de pintar (se inserta en el <head>) */
export const SCRIPT_TEMA = `(function(){try{if(localStorage.getItem("${CLAVE_TEMA}")==="oscuro"){var r=document.documentElement;r.classList.add("oscuro");r.style.backgroundColor="${FONDO_OSCURO}";r.style.setProperty("--page-bg","${FONDO_OSCURO}");r.style.setProperty("--page-fg","#f2f2f7");var m=document.querySelectorAll('meta[name="theme-color"]');for(var i=0;i<m.length;i++)m[i].content="${FONDO_OSCURO}";}}catch(e){}})();`;
