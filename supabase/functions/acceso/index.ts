// Inicio de sesión con usuario + PIN de 4 dígitos.
// Acciones:
//   { accion: "estado" }                              → { hayUsuarios }
//   { accion: "entrar", usuario, pin }                → sesión de Supabase
//   { accion: "crear-admin", usuario, nombre, pin }   → crea el primer administrador (solo si no hay usuarios)
import { admin, contrasenaDe, correoDe, CORS, json, PIN_ENTRADA, PIN_VALIDO, publico, USUARIO_VALIDO } from "../_compartido/comun.ts";

async function entrar(usuario: string, pin: string) {
  const supa = publico();
  const { data, error } = await supa.auth.signInWithPassword({ email: correoDe(usuario), password: await contrasenaDe(usuario, pin) });
  if (error || !data.session) return null;
  return data.session;
}

const sesionPublica = (s: { access_token: string; refresh_token: string; expires_at?: number; user: { id: string } }) => ({
  access_token: s.access_token,
  refresh_token: s.refresh_token,
  expires_at: s.expires_at,
  user_id: s.user.id,
});

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: CORS });
  if (req.method !== "POST") return json({ error: "Método no permitido" }, 405);

  let cuerpo: Record<string, unknown>;
  try {
    cuerpo = await req.json();
  } catch {
    return json({ error: "Petición no válida" }, 400);
  }
  const accion = String(cuerpo.accion ?? "");

  try {
    if (accion === "estado") {
      const { count } = await admin.from("perfiles").select("id", { count: "exact", head: true });
      return json({ hayUsuarios: (count ?? 0) > 0 });
    }

    const usuario = String(cuerpo.usuario ?? "").trim().toLowerCase();
    const pin = String(cuerpo.pin ?? "");
    if (!USUARIO_VALIDO.test(usuario)) return json({ error: "Usuario no válido (3 a 30 letras minúsculas, números, punto o guion)" }, 400);
    if (!PIN_ENTRADA.test(pin)) return json({ error: "El PIN debe tener 6 números" }, 400);

    if (accion === "crear-admin") {
      if (!PIN_VALIDO.test(pin)) return json({ error: "El PIN debe tener 6 números" }, 400);
      const { count } = await admin.from("perfiles").select("id", { count: "exact", head: true });
      if ((count ?? 0) > 0) return json({ error: "Ya existe un administrador" }, 409);
      const nombre = String(cuerpo.nombre ?? "").trim().slice(0, 60) || usuario;
      const { data: creado, error } = await admin.auth.admin.createUser({
        email: correoDe(usuario),
        password: await contrasenaDe(usuario, pin),
        email_confirm: true,
        user_metadata: { usuario, nombre },
      });
      if (error || !creado.user) return json({ error: "No se pudo crear el administrador" }, 500);
      const { error: e2 } = await admin.from("perfiles").insert({ id: creado.user.id, usuario, nombre, rol: "admin" });
      if (e2) {
        await admin.auth.admin.deleteUser(creado.user.id);
        return json({ error: "No se pudo crear el perfil" }, 500);
      }
      const sesion = await entrar(usuario, pin);
      return sesion ? json({ sesion: sesionPublica(sesion), perfil: { id: creado.user.id, usuario, nombre, rol: "admin", permisos: {} } }) : json({ error: "Creado, pero no se pudo iniciar sesión" }, 500);
    }

    if (accion === "entrar") {
      const { data: bloqueo } = await admin.rpc("bloqueo_pin", { p_usuario: usuario });
      if (bloqueo) return json({ error: "Demasiados intentos. Espera unos minutos.", bloqueadoHasta: bloqueo }, 429);

      const { data: perfil } = await admin.from("perfiles").select("id, usuario, nombre, rol, permisos, granjas, pin_actualizado, activo").eq("usuario", usuario).maybeSingle();
      // Los PIN de 4 números ya no sirven, salvo para un administrador que aún no lo cambia
      if (pin.length === 4 && perfil && perfil.rol !== "admin") {
        return json({ error: "Ahora el PIN es de 6 números. Pídele al administrador tu PIN nuevo." }, 401);
      }
      const sesion = perfil?.activo ? await entrar(usuario, pin) : null;
      if (!sesion) {
        const { data: hasta } = await admin.rpc("registrar_intento_pin", { p_usuario: usuario, p_exito: false });
        return json({ error: hasta ? "Demasiados intentos. Espera 15 minutos." : "Usuario o PIN incorrecto" }, hasta ? 429 : 401);
      }
      await admin.rpc("registrar_intento_pin", { p_usuario: usuario, p_exito: true });
      const { activo: _a, ...datos } = perfil!;
      return json({ sesion: sesionPublica(sesion), perfil: datos });
    }

    return json({ error: "Acción desconocida" }, 400);
  } catch (e) {
    console.error(e);
    return json({ error: "Error del servidor" }, 500);
  }
});
