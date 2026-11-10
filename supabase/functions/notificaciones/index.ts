// Notificaciones de la app (Web Push) con las alertas de cada granja.
// Acciones:
//   { accion: "prueba" }      → con sesión: manda 3 notificaciones de prueba (cada 15 s) a los teléfonos del usuario
//   { accion: "resumen" }     → programada (6 a. m.): resumen de alertas del día por granja
//   { accion: "urgentes" }    → programada (cada hora): alertas críticas nuevas, una sola vez por día
// Las programadas llevan el encabezado x-cron con el secreto guardado en push_config.
import webpush from "npm:web-push@3.6.7";
import { admin, CORS, json, usuarioDeLaPeticion } from "../_compartido/comun.ts";
import { alertasDeGranja, GRANJA_BASE, type Alerta, type Documento } from "./motor/alertas.ts";

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

const puedeVer = (p: Perfil, granja: string) => p.rol === "admin" || p.granjas === null || p.granjas.includes(granja);
const linea = (a: Alerta) => `• Cerda ${a.cerda} · ${a.tipo}`;

/** Fecha de hoy en Colombia (el motor ya deja Date en hora de Colombia) */
const hoyColombia = () => new Date().toISOString().slice(0, 10);

async function programada(accion: "resumen" | "urgentes") {
  const docs = await todosLosDocumentos();
  const granjas = granjasDe(docs);
  const { data: perfiles } = await admin.from("perfiles").select("id, rol, granjas, activo").eq("activo", true);
  const { data: subs } = await admin.from("suscripciones_push").select("id, usuario_id, endpoint, p256dh, auth");
  if (!subs?.length || !perfiles?.length) return { enviados: 0 };
  const porUsuario = new Map<string, Suscripcion[]>();
  for (const s of subs as Suscripcion[]) porUsuario.set(s.usuario_id, [...(porUsuario.get(s.usuario_id) ?? []), s]);

  // Alertas de cada granja (una sola vez)
  const alertas = new Map(granjas.map((g) => [g.id, alertasDeGranja(docs, g.id)]));
  const hoy = hoyColombia();

  // Urgentes: solo las críticas que no se hayan avisado hoy
  const nuevas = new Map<string, Alerta[]>();
  if (accion === "urgentes") {
    for (const g of granjas) {
      const criticas = (alertas.get(g.id) ?? []).filter((a) => a.prioridad === "critica");
      const lista: Alerta[] = [];
      for (const a of criticas) {
        const clave = `${hoy}:${g.id}:${a.cerda}:${a.tipo}`;
        const { error } = await admin.from("push_enviados").insert({ clave });
        if (!error) lista.push(a); // si ya existía, ya se avisó hoy
      }
      nuevas.set(g.id, lista);
    }
    await admin.from("push_enviados").delete().lt("enviado_en", new Date(Date.now() - 30 * 86400000).toISOString());
  }

  let enviados = 0;
  for (const p of perfiles as Perfil[]) {
    const suyas = porUsuario.get(p.id);
    if (!suyas?.length) continue;
    for (const g of granjas) {
      if (!puedeVer(p, g.id)) continue;
      const avisos: Aviso[] = [];
      if (accion === "resumen") {
        const lista = alertas.get(g.id) ?? [];
        if (!lista.length) continue;
        const orden = { critica: 0, alta: 1, media: 2, baja: 3 } as Record<string, number>;
        const ordenadas = [...lista].sort((a, b) => (orden[a.prioridad] ?? 9) - (orden[b.prioridad] ?? 9));
        const resto = ordenadas.length - 4;
        avisos.push({
          title: `${lista.length} ${lista.length === 1 ? "alerta" : "alertas"} hoy · ${g.nombre}`,
          body: ordenadas.slice(0, 4).map(linea).join("\n") + (resto > 0 ? `\ny ${resto} más` : ""),
          tag: `resumen-${g.id}`,
          url: `/tareas?granja=${encodeURIComponent(g.id)}`,
        });
      } else {
        for (const a of nuevas.get(g.id) ?? []) {
          avisos.push({ title: `⚠️ Cerda ${a.cerda} · ${a.tipo}`, body: `${g.nombre}: ${a.descripcion}`, tag: `urgente-${g.id}-${a.cerda}-${a.tipo}`, url: `/tareas?granja=${encodeURIComponent(g.id)}` });
        }
      }
      for (const aviso of avisos) for (const s of suyas) if (await enviar(s, aviso)) enviados++;
    }
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

    if (accion === "resumen" || accion === "urgentes") {
      if (req.headers.get("x-cron") !== config.cron_secreto) return json({ error: "No autorizado" }, 401);
      return json(await programada(accion));
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
