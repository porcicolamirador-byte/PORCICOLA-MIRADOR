"use client";

import { useCallback, useEffect, useState, useSyncExternalStore, type FormEvent } from "react";
import { useRouter } from "next/navigation";
import ModuloPage from "@/components/ModuloPage";
import Modal from "@/components/Modal";
import { Boton, Campo, Entrada, IconoMas, Interruptor } from "@/components/ui";
import { avisar, confirmar } from "@/components/Dialogo";
import { ajustesDesbloqueados } from "@/lib/acceso";
import { actualizarUsuario, crearUsuario, eliminarUsuario, ErrorNube, listarUsuarios, perfilGuardado, type PerfilNube, type PermisoNube } from "@/lib/nube";
import { registrarLog } from "@/lib/log";
import { leerConfig } from "@/lib/config";
import DialogoClave from "@/components/DialogoClave";

const sinSuscripcion = () => () => {};

const PERMISOS: { clave: PermisoNube; nombre: string; detalle: string }[] = [
  { clave: "eliminar", nombre: "Eliminar", detalle: "Borrar cerdas, lotes, registros, facturas…" },
  { clave: "bodega", nombre: "Bodega", detalle: "Cargar facturas y registrar salidas" },
  { clave: "contabilidad", nombre: "Contabilidad", detalle: "Ver y registrar ingresos y gastos" },
  { clave: "ajustes", nombre: "Ajustes protegidos", detalle: "Entrar a esta sección" },
];

const icono = (
  <svg viewBox="0 0 24 24" className="h-5 w-5" fill="none" stroke="currentColor" strokeWidth={1.8} strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
    <circle cx="9" cy="8" r="3.5" />
    <path d="M2.5 20a6.5 6.5 0 0 1 13 0M16 4.5a3.5 3.5 0 0 1 0 7M18 14.5a6.5 6.5 0 0 1 3.5 5.5" />
  </svg>
);

function resumenPermisos(u: PerfilNube) {
  if (u.rol === "admin") return "Todos los permisos";
  const lista = PERMISOS.filter((p) => u.permisos?.[p.clave]).map((p) => p.nombre);
  return lista.length ? lista.join(" · ") : "Solo registrar datos";
}

const mensajeDe = (e: unknown) => (e instanceof ErrorNube ? (e.estado === 0 ? "Sin conexión. Se necesita internet para administrar usuarios." : e.message) : "Ocurrió un error");

export default function UsuariosPage() {
  const router = useRouter();
  const cliente = useSyncExternalStore(sinSuscripcion, () => true, () => false);
  const yo = cliente ? perfilGuardado() : null;
  const permitido = cliente && ajustesDesbloqueados() && yo?.rol === "admin";
  const [usuarios, setUsuarios] = useState<PerfilNube[] | null>(null);
  const [error, setError] = useState("");
  const [editando, setEditando] = useState<PerfilNube | "nuevo" | null>(null);

  useEffect(() => {
    if (!ajustesDesbloqueados()) router.replace("/ajustes");
  }, [router]);

  const cargar = useCallback(() => {
    setError("");
    listarUsuarios()
      .then(setUsuarios)
      .catch((e) => setError(mensajeDe(e)));
  }, []);
  useEffect(() => {
    if (permitido) cargar();
  }, [permitido, cargar]);

  const activos = usuarios?.filter((u) => u.activo !== false) ?? [];
  const inactivos = usuarios?.filter((u) => u.activo === false) ?? [];

  return (
    <ModuloPage
      titulo="Usuarios"
      subtitulo="Acceso y permisos"
      icono={icono}
      tono="slate"
      volverA="/ajustes/avanzados"
      accion={
        permitido ? (
          <Boton onClick={() => setEditando("nuevo")} className="px-3.5">
            <IconoMas /> Usuario
          </Boton>
        ) : undefined
      }
    >
      {cliente && !permitido && (
        <p className="rounded-2xl bg-white px-4 py-6 text-center text-sm text-slate-500 ring-1 ring-slate-200">Solo el administrador puede ver esta sección.</p>
      )}
      {permitido && (
        <>
          {error && (
            <div className="rounded-2xl bg-amber-50 px-4 py-3 text-sm text-amber-900 ring-1 ring-amber-100">
              {error}
              <button type="button" onClick={cargar} className="ml-2 font-semibold text-sky-700">
                Reintentar
              </button>
            </div>
          )}
          {usuarios === null && !error && <div className="h-40 animate-pulse rounded-3xl bg-slate-100" />}
          {usuarios && (
            <>
              <ListaUsuarios titulo={`Activos · ${activos.length}`} usuarios={activos} yoId={yo?.id} onElegir={setEditando} />
              {inactivos.length > 0 && <ListaUsuarios titulo={`Desactivados · ${inactivos.length}`} usuarios={inactivos} yoId={yo?.id} onElegir={setEditando} />}
              <p className="px-1 text-xs text-slate-500">
                Cada persona entra con su usuario y PIN de 4 números la primera vez en su teléfono; después puede usar Face ID. Tras 5 PIN incorrectos el usuario queda bloqueado 15 minutos.
              </p>
            </>
          )}
        </>
      )}

      {editando && (
        <EditorUsuario
          usuario={editando === "nuevo" ? null : editando}
          esYo={editando !== "nuevo" && editando.id === yo?.id}
          onCerrar={() => setEditando(null)}
          onGuardado={(u, nuevo) => {
            setUsuarios((lista) => (nuevo ? [...(lista ?? []), u] : (lista ?? []).map((x) => (x.id === u.id ? u : x))));
            setEditando(null);
          }}
          onEliminado={(id) => {
            setUsuarios((lista) => (lista ?? []).filter((x) => x.id !== id));
            setEditando(null);
          }}
        />
      )}
    </ModuloPage>
  );
}

function ListaUsuarios({ titulo, usuarios, yoId, onElegir }: { titulo: string; usuarios: PerfilNube[]; yoId?: string; onElegir: (u: PerfilNube) => void }) {
  return (
    <section>
      <h2 className="mb-1.5 px-1 text-[11px] font-semibold uppercase tracking-wider text-slate-400">{titulo}</h2>
      <ul className="divide-y divide-slate-100 overflow-hidden rounded-2xl bg-white ring-1 ring-slate-200/80">
        {usuarios.map((u) => (
          <li key={u.id}>
            <button type="button" onClick={() => onElegir(u)} className={`flex w-full items-center gap-3 px-4 py-3 text-left active:bg-slate-50 ${u.activo === false ? "opacity-60" : ""}`}>
              <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-slate-100 text-sm font-bold text-slate-700" aria-hidden="true">
                {u.nombre.trim().charAt(0).toUpperCase()}
              </span>
              <span className="min-w-0 flex-1">
                <span className="flex items-center gap-1.5">
                  <span className="truncate text-[15px] font-semibold text-slate-900">{u.nombre}</span>
                  {u.id === yoId && <span className="shrink-0 text-[11px] text-slate-500">(tú)</span>}
                </span>
                <span className="block truncate text-xs text-slate-500">
                  @{u.usuario} · {resumenPermisos(u)}
                </span>
              </span>
              <span
                className={`shrink-0 rounded-full px-2 py-0.5 text-[11px] font-semibold ${u.rol === "admin" ? "bg-sky-100 text-sky-800" : "bg-slate-100 text-slate-600"}`}
              >
                {u.rol === "admin" ? "Admin" : "Usuario"}
              </span>
            </button>
          </li>
        ))}
      </ul>
    </section>
  );
}

const limpiarUsuario = (v: string) => v.toLowerCase().replace(/[^a-z0-9._-]/g, "").slice(0, 30);
const soloPin = (v: string) => v.replace(/\D/g, "").slice(0, 4);

function EditorUsuario({
  usuario,
  esYo,
  onCerrar,
  onGuardado,
  onEliminado,
}: {
  usuario: PerfilNube | null;
  esYo: boolean;
  onCerrar: () => void;
  onGuardado: (u: PerfilNube, nuevo: boolean) => void;
  onEliminado: (id: string) => void;
}) {
  const nuevo = !usuario;
  const [pedirClave, setPedirClave] = useState(false);

  // Eliminar para siempre: confirmación y, si está activa, la clave de eliminación
  const pedirEliminar = async () => {
    if (!usuario) return;
    const ok = await confirmar({
      titulo: `Eliminar a ${usuario.nombre}`,
      mensaje: `Se borrará el usuario @${usuario.usuario} para siempre y no podrá volver a entrar. Lo que registró en la granja se conserva. Si solo quieres quitarle el acceso por un tiempo, mejor desactívalo.`,
      aceptar: "Eliminar",
      destructivo: true,
    });
    if (!ok) return;
    if (leerConfig().claveEliminarActiva) setPedirClave(true);
    else void eliminar();
  };

  const eliminar = async () => {
    if (!usuario) return;
    setOcupado(true);
    setError("");
    try {
      await eliminarUsuario(usuario.id);
      registrarLog([{ accion: "Eliminación", modulo: "Usuarios", detalle: `Usuario @${usuario.usuario} (${usuario.nombre}) eliminado` }]);
      onEliminado(usuario.id);
    } catch (err) {
      setError(mensajeDe(err));
    } finally {
      setOcupado(false);
    }
  };
  const [nombre, setNombre] = useState(usuario?.nombre ?? "");
  const [nombreUsuario, setNombreUsuario] = useState(usuario?.usuario ?? "");
  const [rol, setRol] = useState<PerfilNube["rol"]>(usuario?.rol ?? "trabajador");
  const [permisos, setPermisos] = useState<PerfilNube["permisos"]>(usuario?.permisos ?? {});
  const [activo, setActivo] = useState(usuario?.activo !== false);
  const [pin, setPin] = useState("");
  const [error, setError] = useState("");
  const [ocupado, setOcupado] = useState(false);

  const guardar = async (e: FormEvent) => {
    e.preventDefault();
    setError("");
    if (!nombre.trim()) return setError("Escribe el nombre.");
    if (nuevo && nombreUsuario.length < 3) return setError("El usuario debe tener al menos 3 caracteres.");
    if ((nuevo || pin) && !/^\d{4}$/.test(pin)) return setError("El PIN debe tener 4 números.");
    if (!nuevo && usuario && usuario.activo !== false && !activo) {
      const ok = await confirmar({
        titulo: `Desactivar a ${usuario.nombre}`,
        mensaje: "No podrá entrar a la app en ningún teléfono. Sus registros se conservan y puedes reactivarlo cuando quieras.",
        aceptar: "Desactivar",
        destructivo: true,
        requiere: null,
      });
      if (!ok) return;
    }
    setOcupado(true);
    try {
      if (nuevo) {
        const u = await crearUsuario({ usuario: nombreUsuario, nombre: nombre.trim(), pin, rol, permisos });
        registrarLog([{ accion: "Creación", modulo: "Usuarios", detalle: `Usuario @${u.usuario} (${u.nombre}) · ${u.rol === "admin" ? "administrador" : "usuario"}` }]);
        onGuardado(u, true);
        await avisar({ titulo: "Usuario creado", mensaje: `Comparte con ${u.nombre} su usuario "${u.usuario}" y su PIN. Podrá entrar desde su teléfono.` });
      } else {
        const u = await actualizarUsuario(usuario!.id, {
          nombre: nombre.trim(),
          rol,
          permisos,
          activo,
          ...(pin ? { pin } : {}),
        });
        const cambios = [
          usuario!.rol !== rol ? `rol ${rol === "admin" ? "administrador" : "usuario"}` : "",
          JSON.stringify(usuario!.permisos ?? {}) !== JSON.stringify(u.permisos ?? {}) ? `permisos: ${resumenPermisos(u)}` : "",
          usuario!.activo !== false && !activo ? "desactivado" : "",
          usuario!.activo === false && activo ? "reactivado" : "",
          pin ? "PIN cambiado" : "",
          usuario!.nombre !== u.nombre ? `nombre ${u.nombre}` : "",
        ].filter(Boolean);
        if (cambios.length) registrarLog([{ accion: "Modificación", modulo: "Usuarios", detalle: `@${u.usuario}: ${cambios.join(", ")}` }]);
        onGuardado(u, false);
      }
    } catch (err) {
      setError(mensajeDe(err));
    } finally {
      setOcupado(false);
    }
  };

  return (
    <>
    <Modal abierta etiqueta="Usuarios" titulo={nuevo ? "Nuevo usuario" : usuario!.nombre} subtitulo={nuevo ? undefined : `@${usuario!.usuario}`} icono={icono} onCerrar={onCerrar}>
      <form onSubmit={guardar} className="flex flex-col gap-3.5">
        <Campo etiqueta="Nombre">
          <Entrada value={nombre} onChange={(v) => setNombre(v.slice(0, 60))} placeholder="Ej. Juan Gómez" />
        </Campo>
        {nuevo && (
          <Campo etiqueta="Usuario">
            <Entrada value={nombreUsuario} onChange={(v) => setNombreUsuario(limpiarUsuario(v))} placeholder="Ej. juan" />
          </Campo>
        )}
        <Campo etiqueta={nuevo ? "PIN (4 números)" : "Nuevo PIN (déjalo vacío para no cambiarlo)"}>
          <Entrada type="password" inputMode="numeric" value={pin} onChange={(v) => setPin(soloPin(v))} placeholder="••••" />
        </Campo>

        <div>
          <span className="mb-1.5 block text-[13px] font-medium text-slate-700">Rol</span>
          <div className="grid grid-cols-2 gap-2">
            {(["trabajador", "admin"] as const).map((r) => (
              <button
                key={r}
                type="button"
                disabled={esYo && r === "trabajador"}
                onClick={() => setRol(r)}
                aria-pressed={rol === r}
                className={`h-11 rounded-xl text-sm font-semibold ring-1 transition disabled:opacity-40 ${
                  rol === r ? "bg-sky-900 text-white ring-sky-900" : "bg-white text-slate-700 ring-slate-200"
                }`}
              >
                {r === "admin" ? "Administrador" : "Usuario"}
              </button>
            ))}
          </div>
        </div>

        {rol === "trabajador" ? (
          <div>
            <span className="mb-1.5 block text-[13px] font-medium text-slate-700">Permisos</span>
            <ul className="divide-y divide-slate-100 overflow-hidden rounded-2xl bg-white ring-1 ring-slate-200">
              {PERMISOS.map((p) => (
                <li key={p.clave}>
                  <label className="flex cursor-pointer items-center gap-3 px-3.5 py-2.5">
                    <span className="min-w-0 flex-1">
                      <span className="block text-[15px] font-medium text-slate-900">{p.nombre}</span>
                      <span className="block text-xs text-slate-500">{p.detalle}</span>
                    </span>
                    <Interruptor activo={!!permisos[p.clave]} onCambiar={(v) => setPermisos((x) => ({ ...x, [p.clave]: v }))} />
                  </label>
                </li>
              ))}
            </ul>
            <p className="mt-1.5 px-1 text-[11px] text-slate-500">Sin permisos extra, un usuario puede ver y registrar datos (partos, alimento, pesajes…), pero no borrar.</p>
          </div>
        ) : (
          <p className="rounded-xl bg-sky-50 px-3 py-2.5 text-xs text-sky-900 ring-1 ring-sky-100">El administrador tiene todos los permisos y puede administrar usuarios.</p>
        )}

        {!nuevo && !esYo && (
          <label className="flex cursor-pointer items-center gap-3 rounded-2xl bg-white px-3.5 py-3 ring-1 ring-slate-200">
            <span className="min-w-0 flex-1">
              <span className="block text-[15px] font-medium text-slate-900">Usuario activo</span>
              <span className="block text-xs text-slate-500">{activo ? "Puede entrar a la app" : "No puede entrar en ningún teléfono"}</span>
            </span>
            <Interruptor activo={activo} onCambiar={setActivo} />
          </label>
        )}

        {error && <p className="text-sm font-medium text-rose-600">{error}</p>}
        <div className="mt-1 grid grid-cols-2 gap-2">
          <Boton variante="secundario" onClick={onCerrar}>
            Cancelar
          </Boton>
          <Boton type="submit" disabled={ocupado}>
            {ocupado ? "Guardando…" : nuevo ? "Crear" : "Guardar"}
          </Boton>
        </div>
        {!nuevo && !esYo && (
          <Boton variante="suave" onClick={() => void pedirEliminar()} disabled={ocupado} className="w-full text-rose-600">
            Eliminar usuario
          </Boton>
        )}
      </form>
    </Modal>
      <DialogoClave
        abierto={pedirClave}
        titulo="Clave de eliminación"
        mensaje={`Ingresa la clave para eliminar a ${usuario?.nombre ?? ""}.`}
        aceptar="Eliminar"
        onValidar={(codigo) => {
          if (codigo !== leerConfig().claveEliminar) return false;
          setPedirClave(false);
          void eliminar();
          return true;
        }}
        onCerrar={() => setPedirClave(false)}
      />
    </>
  );
}
