/*
 * Modo oscuro (estilo WhatsApp), activo por defecto. Si se elige el modo
 * claro, la preferencia se guarda en este teléfono
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
    // Por defecto oscuro: solo es claro si se eligió así en Ajustes
    return localStorage.getItem(CLAVE_TEMA) === "claro" ? "claro" : "oscuro";
  } catch {
    return "oscuro";
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
export const SCRIPT_TEMA = `(function(){try{var t=null;try{t=localStorage.getItem("${CLAVE_TEMA}")}catch(e){}if(t!=="claro"){var r=document.documentElement;r.classList.add("oscuro");r.style.backgroundColor="${FONDO_OSCURO}";r.style.setProperty("--page-bg","${FONDO_OSCURO}");r.style.setProperty("--page-fg","#f2f2f7");var m=document.querySelectorAll('meta[name="theme-color"]');for(var i=0;i<m.length;i++)m[i].content="${FONDO_OSCURO}";}}catch(e){}})();`;
