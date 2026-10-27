// Utilidades compartidas por las funciones de acceso y de usuarios.
import { createClient, type SupabaseClient } from "npm:@supabase/supabase-js@2";

export const CORS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

export function json(cuerpo: unknown, estado = 200) {
  return new Response(JSON.stringify(cuerpo), { status: estado, headers: { ...CORS, "Content-Type": "application/json" } });
}

const URL_SUPABASE = Deno.env.get("SUPABASE_URL")!;

function llaveSecreta(): string {
  try {
    const nuevas = JSON.parse(Deno.env.get("SUPABASE_SECRET_KEYS") ?? "{}");
    if (nuevas.default) return nuevas.default;
  } catch {
    // sin llaves nuevas
  }
  return Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
}

function llavePublica(): string {
  try {
    const nuevas = JSON.parse(Deno.env.get("SUPABASE_PUBLISHABLE_KEYS") ?? "{}");
    if (nuevas.default) return nuevas.default;
  } catch {
    // sin llaves nuevas
  }
  return Deno.env.get("SUPABASE_ANON_KEY")!;
}

/** Cliente con permisos de administrador (solo en el servidor) */
export const admin: SupabaseClient = createClient(URL_SUPABASE, llaveSecreta(), {
  auth: { persistSession: false, autoRefreshToken: false },
});

/** Cliente público, para iniciar sesión como el usuario */
export const publico = () =>
  createClient(URL_SUPABASE, llavePublica(), { auth: { persistSession: false, autoRefreshToken: false } });

export const USUARIO_VALIDO = /^[a-z0-9._-]{3,30}$/;
/** PIN de 6 números (los nuevos y los que asigna el administrador) */
export const PIN_VALIDO = /^\d{6}$/;
/** Para entrar: 6 números; los administradores aún pueden usar su PIN anterior de 4 mientras lo cambian */
export const PIN_ENTRADA = /^(\d{4}|\d{6})$/;

export const correoDe = (usuario: string) => `${usuario}@usuarios.elmirador.app`;

/** Contraseña real del usuario: HMAC-SHA256(secreto, usuario:pin). El PIN nunca se guarda. */
export async function contrasenaDe(usuario: string, pin: string): Promise<string> {
  const { data: pepper, error } = await admin.rpc("obtener_pepper_pin");
  if (error || !pepper) throw new Error("No se pudo leer el secreto del PIN");
  const llave = await crypto.subtle.importKey("raw", new TextEncoder().encode(pepper as string), { name: "HMAC", hash: "SHA-256" }, false, ["sign"]);
  const firma = await crypto.subtle.sign("HMAC", llave, new TextEncoder().encode(`${usuario}:${pin}`));
  return Array.from(new Uint8Array(firma), (b) => b.toString(16).padStart(2, "0")).join("");
}

/** Usuario que hace la petición (por su token de sesión), o null */
export async function usuarioDeLaPeticion(req: Request) {
  const token = (req.headers.get("Authorization") ?? "").replace(/^Bearer\s+/i, "");
  if (!token) return null;
  const { data, error } = await admin.auth.getUser(token);
  if (error || !data.user) return null;
  const { data: perfil } = await admin.from("perfiles").select("*").eq("id", data.user.id).maybeSingle();
  return perfil && perfil.activo ? perfil : null;
}
