// Administración de usuarios (solo administradores).
// Acciones:
//   { accion: "listar" }
//   { accion: "crear", usuario, nombre, pin, rol?, permisos? }
//   { accion: "actualizar", id, nombre?, rol?, permisos?, activo?, pin? }
//   { accion: "yo" }   → perfil del usuario que llama (cualquier usuario activo)
import { admin, contrasenaDe, correoDe, CORS, json, PIN_VALIDO, usuarioDeLaPeticion, USUARIO_VALIDO } from "../_compartido/comun.ts";

const PERMISOS = ["eliminar", "bodega", "ajustes", "contabilidad"] as const;
const limpiarPermisos = (p: unknown) => {
  const o = (p && typeof p === "object" ? p : {}) as Record<string, unknown>;
  return Object.fromEntries(PERMISOS.map((k) => [k, o[k] === true]));
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: CORS });
  if (req.method !== "POST") return json({ error: "Método no permitido" }, 405);

  const yo = await usuarioDeLaPeticion(req);
  if (!yo) return json({ error: "Sesión no válida" }, 401);

  let cuerpo: Record<string, unknown>;
  try {
    cuerpo = await req.json();
  } catch {
    return json({ error: "Petición no válida" }, 400);
  }
  const accion = String(cuerpo.accion ?? "");

  if (accion === "yo") {
    const { activo: _a, ...datos } = yo;
    return json({ perfil: datos });
  }
  if (yo.rol !== "admin") return json({ error: "Solo el administrador puede hacer esto" }, 403);

  try {
    if (accion === "listar") {
      const { data, error } = await admin.from("perfiles").select("id, usuario, nombre, rol, permisos, activo, creado_en").order("creado_en");
      if (error) throw error;
      return json({ usuarios: data });
    }

    if (accion === "crear") {
      const usuario = String(cuerpo.usuario ?? "").trim().toLowerCase();
      const pin = String(cuerpo.pin ?? "");
      const nombre = String(cuerpo.nombre ?? "").trim().slice(0, 60);
      const rol = cuerpo.rol === "admin" ? "admin" : "trabajador";
      if (!USUARIO_VALIDO.test(usuario)) return json({ error: "Usuario no válido (3 a 30 letras minúsculas, números, punto o guion)" }, 400);
      if (!PIN_VALIDO.test(pin)) return json({ error: "El PIN debe tener 4 números" }, 400);
      if (!nombre) return json({ error: "Escribe el nombre" }, 400);
      const { data: existe } = await admin.from("perfiles").select("id").eq("usuario", usuario).maybeSingle();
      if (existe) return json({ error: "Ese usuario ya existe" }, 409);
      const { data: creado, error } = await admin.auth.admin.createUser({
        email: correoDe(usuario),
        password: await contrasenaDe(usuario, pin),
        email_confirm: true,
        user_metadata: { usuario, nombre },
      });
      if (error || !creado.user) return json({ error: "No se pudo crear el usuario" }, 500);
      const { data: perfil, error: e2 } = await admin
        .from("perfiles")
        .insert({ id: creado.user.id, usuario, nombre, rol, permisos: limpiarPermisos(cuerpo.permisos) })
        .select("id, usuario, nombre, rol, permisos, activo, creado_en")
        .single();
      if (e2) {
        await admin.auth.admin.deleteUser(creado.user.id);
        return json({ error: "No se pudo crear el perfil" }, 500);
      }
      return json({ usuario: perfil });
    }

    if (accion === "actualizar") {
      const id = String(cuerpo.id ?? "");
      const { data: actual } = await admin.from("perfiles").select("*").eq("id", id).maybeSingle();
      if (!actual) return json({ error: "Usuario no encontrado" }, 404);

      const cambios: Record<string, unknown> = { actualizado_en: new Date().toISOString() };
      if (typeof cuerpo.nombre === "string" && cuerpo.nombre.trim()) cambios.nombre = cuerpo.nombre.trim().slice(0, 60);
      if (cuerpo.rol === "admin" || cuerpo.rol === "trabajador") cambios.rol = cuerpo.rol;
      if (cuerpo.permisos !== undefined) cambios.permisos = limpiarPermisos(cuerpo.permisos);
      if (typeof cuerpo.activo === "boolean") cambios.activo = cuerpo.activo;

      // El administrador no puede quitarse a sí mismo el rol ni desactivarse (quedaría sin acceso)
      if (id === yo.id && (cambios.rol === "trabajador" || cambios.activo === false)) {
        return json({ error: "No puedes quitarte el rol de administrador ni desactivarte" }, 400);
      }

      if (cuerpo.pin !== undefined) {
        const pin = String(cuerpo.pin);
        if (!PIN_VALIDO.test(pin)) return json({ error: "El PIN debe tener 4 números" }, 400);
        const { error } = await admin.auth.admin.updateUserById(id, { password: await contrasenaDe(actual.usuario, pin) });
        if (error) return json({ error: "No se pudo cambiar el PIN" }, 500);
        await admin.rpc("registrar_intento_pin", { p_usuario: actual.usuario, p_exito: true });
      }

      const { data: perfil, error } = await admin
        .from("perfiles")
        .update(cambios)
        .eq("id", id)
        .select("id, usuario, nombre, rol, permisos, activo, creado_en")
        .single();
      if (error) throw error;

      // Desactivado: se le bloquea en el servicio de autenticación para que no pueda renovar su sesión
      if (typeof cambios.activo === "boolean") {
        await admin.auth.admin.updateUserById(id, { ban_duration: cambios.activo ? "none" : "876000h" });
      }
      return json({ usuario: perfil });
    }

    return json({ error: "Acción desconocida" }, 400);
  } catch (e) {
    console.error(e);
    return json({ error: "Error del servidor" }, 500);
  }
});
