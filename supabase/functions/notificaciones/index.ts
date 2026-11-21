// Notificaciones de la app (Web Push) con las alertas de cada granja.
// Acciones:
//   { accion: "prueba" }      → con sesión: manda 3 notificaciones de prueba (cada 15 s) a los teléfonos del usuario
//   { accion: "diario" }      → programada (7:30 a. m.): "Tienes alertas por atender en …" si hay alertas
// Las programadas llevan el encabezado x-cron con el secreto guardado en push_config.
import webpush from "npm:web-push@3.6.7";
import mqtt from "npm:mqtt@5.10.1";
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

/* ───────── TEMPORAL: aviso de temperatura de la granja (ESP32 por EMQX) ─────────
 * Cada minuto (pg_cron) se lee granja/temperatura y se compara con los rangos que
 * el administrador pone en Ajustes (temperatura_config): mínima, límite y crítica.
 * Se avisa una sola vez al cambiar de estado (baja, normal, alta, crítica), con 0,5 °C de margen
 * para volver; al volver a lo normal también llega aviso (al bajar de la crítica, no).
 * Para quitarlo: borrar este bloque y la acción "temperatura", y las migraciones 0016 a 0019. */
const MARGEN = 0.5;
const fmt = (v: number) => `${Number(v.toFixed(1)).toString().replace(".", ",")} °C`;

function leerTemperatura(cfg: { url: string; usuario: string | null; clave: string | null }): Promise<number | null> {
  return new Promise((resolver) => {
    let listo = false;
    const cliente = mqtt.connect(cfg.url, {
      username: cfg.usuario || undefined,
      password: cfg.clave || undefined,
      clientId: `servidor-alertas-${crypto.randomUUID().slice(0, 8)}`,
      connectTimeout: 10000,
      reconnectPeriod: 0,
      clean: true,
    });
    const fin = (v: number | null) => {
      if (listo) return;
      listo = true;
      clearTimeout(limite);
      try {
        cliente.end(true);
      } catch {
        // ya cerrado
      }
      resolver(v);
    };
    const limite = setTimeout(() => fin(null), 20000);
    cliente.on("connect", () => cliente.subscribe("granja/temperatura"));
    cliente.on("message", (_tema: string, msg: Uint8Array) => {
      const n = Number(new TextDecoder().decode(msg).trim().replace(",", "."));
      if (Number.isFinite(n)) fin(n);
    });
    cliente.on("error", (e: Error) => {
      console.error("mqtt", e.message);
      fin(null);
    });
  });
}

async function temperatura() {
  const { data: cfg } = await admin.from("mqtt_servidor").select("url, usuario, clave").eq("id", 1).maybeSingle();
  if (!cfg?.url) return { omitido: "sin conexión configurada" };
  const t = await leerTemperatura(cfg);
  if (t === null) return { omitido: "sin lectura" };
  const { data: rangos } = await admin.from("temperatura_config").select("minima, limite, critica").eq("id", 1).maybeSingle();
  const MIN = Number(rangos?.minima ?? 22);
  const LIM = Number(rangos?.limite ?? 27.5);
  const CRI = Number(rangos?.critica ?? 29);
  const { data: est } = await admin.from("temperatura_alerta").select("estado").eq("id", 1).maybeSingle();
  const previo = (est?.estado as string) ?? "normal";
  const altas = ["alta", "critica"];
  let nuevo = "normal";
  if (t > CRI || (previo === "critica" && t > CRI - MARGEN)) nuevo = "critica";
  else if (t > LIM || (altas.includes(previo) && t > LIM - MARGEN)) nuevo = "alta";
  else if (t < MIN || (previo === "baja" && t < MIN + MARGEN)) nuevo = "baja";
  let enviados = 0;
  // Al bajar de la crítica (pero seguir sobre el límite) no se avisa
  if (nuevo !== previo && !(nuevo === "alta" && previo === "critica")) {
    const g = `${t.toFixed(1).replace(".", ",")} °C`;
    const base = { tag: "temperatura-granja", url: "/monitoreo" };
    const aviso: Aviso =
      nuevo === "critica"
        ? { ...base, title: `🚨 Alerta crítica · Temperatura ${g}`, body: `Se superaron los ${fmt(CRI)} críticos.` }
        : nuevo === "alta"
            ? { ...base, title: `Temperatura Límite ${g}`, body: `La granja superó el límite de ${fmt(LIM)}.` }
            : nuevo === "baja"
              ? { ...base, title: `Temperatura baja ${g}`, body: `La granja bajó de la mínima de ${fmt(MIN)}.` }
              : {
                  ...base,
                  title: `Temperatura normal ${g}`,
                  body: altas.includes(previo) ? `La granja volvió a estar por debajo de ${fmt(LIM)}.` : `La granja volvió a estar por encima de ${fmt(MIN)}.`,
                };
    const { data: perfiles } = await admin.from("perfiles").select("id").eq("activo", true);
    const activos = new Set((perfiles ?? []).map((p: { id: string }) => p.id));
    const { data: subs } = await admin.from("suscripciones_push").select("id, usuario_id, endpoint, p256dh, auth");
    for (const s of (subs ?? []) as Suscripcion[]) if (activos.has(s.usuario_id) && (await enviar(s, aviso))) enviados++;
  }
  await admin.from("temperatura_alerta").upsert({ id: 1, estado: nuevo, temperatura: t, actualizado_en: new Date().toISOString() });
  // El historial de 7 días (temperatura_lecturas) lo guarda pg_cron cada 5 minutos desde esta fila
  return { temperatura: t, estado: nuevo, enviados };
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

    if (accion === "temperatura") {
      if (req.headers.get("x-cron") !== config.cron_secreto) return json({ error: "No autorizado" }, 401);
      return json(await temperatura());
    }

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
