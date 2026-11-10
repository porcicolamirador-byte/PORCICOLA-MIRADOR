// Notificaciones de la app (Web Push) con las alertas de cada granja.
// Acciones:
//   { accion: "prueba" }      → con sesión: manda 3 notificaciones de prueba (cada 15 s) a los teléfonos del usuario
//   { accion: "diario" }      → programada (7:30 a. m.): "Tienes alertas por atender en …" si hay alertas
// Las programadas llevan el encabezado x-cron con el secreto guardado en push_config.
import webpush from "npm:web-push@3.6.7";
import { admin, CORS, json, usuarioDeLaPeticion } from "../_compartido/comun.ts";
import { alertasDeGranja, GRANJA_BASE, type Documento } from "./motor/alertas.ts";

interface Suscripcion {
  id: string;
  usuario_id: string;
  endpoint: string;
  p256dh: string;
  auth: string;
}
interface Perfil {
  id: string;
  rol: string;
  granjas: string[] | null;
  notificaciones_granjas: string[] | null;
  activo: boolean;
}
interface Aviso {
  title: string;
  body: string;
  tag: string;
  url: string;
}

async function configurar() {
  const { data, error } = await admin.from("push_config").select("vapid_publica, vapid_privada, cron_secreto").eq("id", 1).single();
  if (error || !data) throw new Error("Falta la configuración de notificaciones");
  webpush.setVapidDetails("https://porcicola-mirador.vercel.app", data.vapid_publica, data.vapid_privada);
  return data as { cron_secreto: string };
}

/** Envía a una suscripción; si el teléfono ya no la tiene (404/410), se borra */
async function enviar(s: Suscripcion, aviso: Aviso): Promise<boolean> {
  try {
    await webpush.sendNotification({ endpoint: s.endpoint, keys: { p256dh: s.p256dh, auth: s.auth } }, JSON.stringify(aviso), { TTL: 6 * 3600, urgency: "high" });
    return true;
  } catch (e) {
    const codigo = (e as { statusCode?: number }).statusCode;
    if (codigo === 404 || codigo === 410) await admin.from("suscripciones_push").delete().eq("id", s.id);
    else console.error("push", codigo, (e as Error).message);
    return false;
  }
}

async function todosLosDocumentos(): Promise<Documento[]> {
  const docs: Documento[] = [];
  for (let desde = 0; ; desde += 1000) {
    const { data, error } = await admin.from("documentos").select("coleccion, id, datos").eq("borrado", false).range(desde, desde + 999);
    if (error) throw error;
    docs.push(...(data as Documento[]));
    if (!data || data.length < 1000) break;
  }
  return docs;
}

/** Granjas existentes con su nombre */
function granjasDe(docs: Documento[]) {
  const lista = docs.filter((d) => d.coleccion === "granjas").map((d) => d.datos as { id: string; nombre?: string; eliminada?: boolean });
  const base = lista.find((g) => g.id === GRANJA_BASE);
  const granjas = [
    ...(base?.eliminada ? [] : [{ id: GRANJA_BASE, nombre: base?.nombre?.trim() || "El Mirador" }]),
    ...lista.filter((g) => g.id && g.id !== GRANJA_BASE && !g.eliminada).map((g) => ({ id: g.id, nombre: g.nombre?.trim() || "Granja" })),
  ];
  return granjas;
}

const NOMBRE_APP = "Porcícola El Mirador";
const puedeVer = (p: Perfil, granja: string) => p.rol === "admin" || p.granjas === null || p.granjas.includes(granja);
/** Granjas de las que el usuario recibe notificaciones (las suyas, filtradas por lo que eligió el administrador) */
const granjasANotificar = <G extends { id: string }>(p: Perfil, granjas: G[]) =>
  granjas.filter((g) => puedeVer(p, g.id) && (p.notificaciones_granjas === null || p.notificaciones_granjas.includes(g.id)));

const lista = (nombres: string[]) => (nombres.length <= 1 ? nombres.join("") : `${nombres.slice(0, -1).join(", ")} y ${nombres[nombres.length - 1]}`);

/** Aviso diario (7:30 a. m.): una sola notificación por usuario si hay alertas pendientes */
async function diario() {
  const docs = await todosLosDocumentos();
  const granjas = granjasDe(docs);
  const { data: perfiles } = await admin.from("perfiles").select("id, rol, granjas, notificaciones_granjas, activo").eq("activo", true);
  const { data: subs } = await admin.from("suscripciones_push").select("id, usuario_id, endpoint, p256dh, auth");
  if (!subs?.length || !perfiles?.length) return { enviados: 0 };
  const porUsuario = new Map<string, Suscripcion[]>();
  for (const s of subs as Suscripcion[]) porUsuario.set(s.usuario_id, [...(porUsuario.get(s.usuario_id) ?? []), s]);
  const alertas = new Map(granjas.map((g) => [g.id, alertasDeGranja(docs, g.id)]));

  let enviados = 0;
  for (const p of perfiles as Perfil[]) {
    const suyas = porUsuario.get(p.id);
    if (!suyas?.length) continue;
    const elegidas = granjasANotificar(p, granjas);
    const conAlertas = elegidas.filter((g) => (alertas.get(g.id)?.length ?? 0) > 0);
    if (!conAlertas.length) continue;
    // Si recibe de todas las granjas, el aviso habla de la app; si no, nombra sus granjas con alertas
    const todas = elegidas.length === granjas.length && granjas.length > 1;
    const donde = todas ? NOMBRE_APP : lista(conAlertas.map((g) => g.nombre));
    const detalle = conAlertas.map((g) => {
      const n = alertas.get(g.id)!.length;
      return `${g.nombre}: ${n} ${n === 1 ? "alerta" : "alertas"}`;
    });
    const aviso: Aviso = {
      title: `Tienes alertas por atender en ${donde}`,
      body: detalle.join(" · "),
      tag: "alertas-diarias",
      url: conAlertas.length === 1 ? `/tareas?granja=${encodeURIComponent(conAlertas[0].id)}` : "/tareas",
    };
    for (const s of suyas) if (await enviar(s, aviso)) enviados++;
  }
  return { enviados };
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: CORS });
  if (req.method !== "POST") return json({ error: "Método no permitido" }, 405);
  let cuerpo: Record<string, unknown> = {};
  try {
    cuerpo = await req.json();
  } catch {
    // sin cuerpo
  }
  const accion = String(cuerpo.accion ?? "");
  try {
    const config = await configurar();

    if (accion === "diario") {
      if (req.headers.get("x-cron") !== config.cron_secreto) return json({ error: "No autorizado" }, 401);
      return json(await diario());
    }

    const yo = await usuarioDeLaPeticion(req);
    if (!yo) return json({ error: "Sesión no válida" }, 401);

    if (accion === "prueba") {
      // 3 notificaciones, una cada 15 segundos, para probar con la app cerrada
      const { data: subs } = await admin.from("suscripciones_push").select("id, usuario_id, endpoint, p256dh, auth").eq("usuario_id", yo.id);
      const lista = (subs ?? []) as Suscripcion[];
      const mandar = async (n: number) => {
        for (const s of lista) {
          await enviar(s, {
            title: `Prueba ${n} de 3 ✅`,
            body: n === 1 ? "Cierra la app: en 15 segundos llega la siguiente." : n === 2 ? "Llegó con la app cerrada. Falta una más en 15 segundos." : "¡Listo! Así te llegarán las alertas de la granja.",
            tag: `prueba-${n}-${Date.now()}`,
            url: "/tareas",
          });
        }
      };
      await mandar(1);
      const espera = (ms: number) => new Promise((r) => setTimeout(r, ms));
      const resto = (async () => {
        await espera(15000);
        await mandar(2);
        await espera(15000);
        await mandar(3);
      })();
      (globalThis as unknown as { EdgeRuntime?: { waitUntil: (p: Promise<unknown>) => void } }).EdgeRuntime?.waitUntil(resto);
      return json({ enviados: lista.length, programadas: 2 });
    }
    return json({ error: "Acción desconocida" }, 400);
  } catch (e) {
    console.error(e);
    return json({ error: "Error del servidor" }, 500);
  }
});
