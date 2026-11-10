/**
 * Notificaciones de la app (Web Push): llegan aunque la app esté cerrada.
 * En iPhone solo funcionan con la app instalada en la pantalla de inicio (iOS 16.4+).
 */
import { api, llamarFuncion, perfilGuardado } from "@/lib/nube";

/** Llave pública del servidor (es pública por diseño) */
const VAPID_PUBLICA = "BHoabt8GRTpyYPt1LELP04aOM5rjjcH37OChS7Bhb7j2WGvh48FQAYAY6iwJAtrp3Z5NQsbFyb-XlDCgmdX2yC4";

export type EstadoNotificaciones = "no-soportado" | "instalar" | "bloqueadas" | "activas" | "inactivas";

const esIOS = () => /iphone|ipad|ipod/i.test(navigator.userAgent);
const instalada = () =>
  window.matchMedia?.("(display-mode: standalone)").matches || (navigator as Navigator & { standalone?: boolean }).standalone === true;

function llaveBytes(base64url: string): Uint8Array {
  const b64 = (base64url + "=".repeat((4 - (base64url.length % 4)) % 4)).replace(/-/g, "+").replace(/_/g, "/");
  const bin = atob(b64);
  return Uint8Array.from(bin, (c) => c.charCodeAt(0));
}

async function registro() {
  return navigator.serviceWorker.ready;
}

export async function estadoNotificaciones(): Promise<EstadoNotificaciones> {
  if (typeof window === "undefined") return "no-soportado";
  const soporta = "serviceWorker" in navigator && "PushManager" in window && "Notification" in window;
  if (!soporta) return esIOS() && !instalada() ? "instalar" : "no-soportado";
  if (Notification.permission === "denied") return "bloqueadas";
  const sub = await (await registro()).pushManager.getSubscription();
  return sub && Notification.permission === "granted" ? "activas" : "inactivas";
}

/** Pide el permiso, suscribe este teléfono y lo guarda en la nube */
export async function activarNotificaciones(): Promise<EstadoNotificaciones> {
  const permiso = await Notification.requestPermission();
  if (permiso !== "granted") return permiso === "denied" ? "bloqueadas" : "inactivas";
  const reg = await registro();
  const sub =
    (await reg.pushManager.getSubscription()) ??
    (await reg.pushManager.subscribe({ userVisibleOnly: true, applicationServerKey: llaveBytes(VAPID_PUBLICA) as BufferSource }));
  const j = sub.toJSON() as { endpoint: string; keys: { p256dh: string; auth: string } };
  const perfil = perfilGuardado();
  await api("suscripciones_push?on_conflict=endpoint", {
    method: "POST",
    headers: { Prefer: "resolution=merge-duplicates,return=minimal" },
    body: JSON.stringify({ usuario_id: perfil?.id, endpoint: j.endpoint, p256dh: j.keys.p256dh, auth: j.keys.auth, dispositivo: navigator.userAgent.slice(0, 200) }),
  });
  return "activas";
}

export async function desactivarNotificaciones() {
  const sub = await (await registro()).pushManager.getSubscription();
  if (!sub) return;
  await api(`suscripciones_push?endpoint=eq.${encodeURIComponent(sub.endpoint)}`, { method: "DELETE", headers: { Prefer: "return=minimal" } }).catch(() => undefined);
  await sub.unsubscribe();
}

export const probarNotificaciones = () => llamarFuncion<{ enviados: number }>("notificaciones", { accion: "prueba" });
