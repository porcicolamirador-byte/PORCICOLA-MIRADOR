"use client";

import { useCallback, useEffect, useState, useSyncExternalStore, type ReactNode } from "react";
import { usePathname } from "next/navigation";
import Image from "next/image";
import {
  actualizarPerfil,
  cerrarSesionNube,
  crearPrimerAdministrador,
  entrarConPin,
  ErrorNube,
  EVENTO_SESION,
  hayUsuariosEnLaNube,
  perfilGuardado,
  type PerfilNube,
} from "@/lib/nube";
import { bloqueoActivo, estaDesbloqueada, marcarDesbloqueada, olvidarPinLocal, pinLocalCorrecto, recordarPinLocal, tocarDesbloqueo } from "@/lib/bloqueo";
import { sincronizar } from "@/lib/sincronizar";
import { CLAVE_FACEID_APP, desactivarFaceId, faceIdActivo, verificarFaceId } from "@/lib/faceid";

/*
 * Puerta de entrada de la app: nadie ve los datos sin haber iniciado sesión.
 * - Primera vez en el teléfono: usuario + PIN (necesita internet).
 * - Si aún no hay usuarios en la nube: se crea el administrador.
 * - Después: se abre con Face ID (o con el PIN, también sin internet).
 */

const sinSuscripcion = () => () => {};
const suscribirSesion = (cb: () => void) => {
  window.addEventListener(EVENTO_SESION, cb);
  window.addEventListener("storage", cb);
  return () => {
    window.removeEventListener(EVENTO_SESION, cb);
    window.removeEventListener("storage", cb);
  };
};
const leerSesionTexto = () => {
  try {
    return (localStorage.getItem("nube-sesion") ? "1" : "0") + (localStorage.getItem("nube-perfil") ?? "");
  } catch {
    return "0";
  }
};

/** Cierra la sesión en este teléfono (también quita Face ID y el PIN guardado) */
export function salirDeLaApp() {
  cerrarSesionNube();
  olvidarPinLocal();
  desactivarFaceId(CLAVE_FACEID_APP);
  window.location.replace("/dashboard");
}

export default function PuertaAcceso({ children }: { children: ReactNode }) {
  const ruta = usePathname();
  const cliente = useSyncExternalStore(sinSuscripcion, () => true, () => false);
  const textoSesion = useSyncExternalStore(suscribirSesion, leerSesionTexto, () => "");
  const conSesion = textoSesion.startsWith("1");
  // Sin bloqueo (por defecto) la app abre directo; con bloqueo pide Face ID o PIN
  const [abierta, setAbierta] = useState(() => (typeof window === "undefined" ? false : !bloqueoActivo() || estaDesbloqueada()));

  // Bloquea otra vez si la app estuvo un rato en segundo plano
  useEffect(() => {
    const cambio = () => {
      if (document.visibilityState === "hidden") tocarDesbloqueo();
      else if (bloqueoActivo() && !estaDesbloqueada()) setAbierta(false);
    };
    document.addEventListener("visibilitychange", cambio);
    return () => document.removeEventListener("visibilitychange", cambio);
  }, []);

  // Mientras la app está abierta y en pantalla, el desbloqueo sigue vigente
  useEffect(() => {
    if (!abierta) return;
    const t = setInterval(() => {
      if (document.visibilityState === "visible") tocarDesbloqueo();
    }, 60_000);
    return () => clearInterval(t);
  }, [abierta]);

  // Sincronización con la nube mientras la app está abierta
  useEffect(() => {
    if (!conSesion || !abierta) return;
    void sincronizar();
    const t = setInterval(() => {
      if (document.visibilityState === "visible") void sincronizar();
    }, 30_000);
    const alVolver = () => {
      if (document.visibilityState === "visible") void sincronizar();
    };
    const conInternet = () => void sincronizar();
    document.addEventListener("visibilitychange", alVolver);
    window.addEventListener("online", conInternet);
    return () => {
      clearInterval(t);
      document.removeEventListener("visibilitychange", alVolver);
      window.removeEventListener("online", conInternet);
    };
  }, [conSesion, abierta]);

  // Con internet, se revisa que el usuario siga activo y con los mismos permisos
  useEffect(() => {
    if (conSesion && navigator.onLine) void actualizarPerfil();
  }, [conSesion]);

  const alEntrar = useCallback(async (pinUsado?: { usuario: string; pin: string }) => {
    if (pinUsado) await recordarPinLocal(pinUsado.usuario, pinUsado.pin);
    marcarDesbloqueada();
    setAbierta(true);
  }, []);

  // La pantalla de bienvenida no se bloquea
  if (ruta === "/") return <>{children}</>;
  if (!cliente) return <div className="fixed inset-0" style={{ backgroundColor: "var(--page-bg, #000)" }} />;

  if (!conSesion) return <PantallaEntrar onEntrar={alEntrar} />;
  if (!abierta) return <PantallaDesbloquear perfil={perfilGuardado()} onAbrir={() => void alEntrar()} />;

  return <>{children}</>;
}

/* ───────────── Piezas de las pantallas ───────────── */

function Marco({ children }: { children: ReactNode }) {
  return (
    <div
      className="fixed inset-0 z-[90] flex flex-col overflow-y-auto bg-white"
      style={{ paddingTop: "max(env(safe-area-inset-top), 24px)", paddingBottom: "max(env(safe-area-inset-bottom), 20px)" }}
    >
      <div className="mx-auto flex w-full max-w-sm flex-1 flex-col px-6">
        {/* Círculo siempre blanco (también en modo oscuro) para que el logo se vea */}
        <div className="logo-caja mx-auto mt-6 flex h-32 w-32 items-center justify-center overflow-hidden rounded-full bg-white shadow-lg">
          <Image src="/images/logo.png" alt="El Mirador" width={1254} height={1254} priority className="h-auto w-[104px]" />
        </div>
        {children}
      </div>
    </div>
  );
}

/** Teclado numérico de 4 dígitos al estilo del iPhone */
function TecladoPin({ titulo, ayuda, error, ocupado, onCompleto }: { titulo: string; ayuda?: string; error?: string; ocupado?: boolean; onCompleto: (pin: string) => void }) {
  const [pin, setPin] = useState("");
  const [sacudir, setSacudir] = useState(false);

  useEffect(() => {
    if (!error) return;
    setPin("");
    setSacudir(true);
    const t = setTimeout(() => setSacudir(false), 400);
    return () => clearTimeout(t);
  }, [error]);

  const tocar = (d: string) => {
    if (ocupado) return;
    const nuevo = (pin + d).slice(0, 4);
    setPin(nuevo);
    if (nuevo.length === 4) setTimeout(() => onCompleto(nuevo), 120);
  };

  return (
    <div className="flex flex-col items-center">
      <p className="text-[15px] font-medium text-slate-900">{titulo}</p>
      {ayuda && <p className="mt-0.5 text-center text-xs text-slate-500">{ayuda}</p>}
      <div className={`mt-4 flex gap-4 ${sacudir ? "pin-sacudir" : ""}`} aria-label={`${pin.length} de 4 números`}>
        {[0, 1, 2, 3].map((i) => (
          <span key={i} className={`h-3.5 w-3.5 rounded-full ring-1 ring-slate-400 ${i < pin.length ? "bg-sky-600 ring-sky-600" : ""}`} />
        ))}
      </div>
      <p className="mt-2 h-5 text-center text-[13px] font-medium text-red-600">{error}</p>
      <div className="mt-2 grid grid-cols-3 gap-x-6 gap-y-3">
        {["1", "2", "3", "4", "5", "6", "7", "8", "9", "", "0", "⌫"].map((d, i) =>
          d === "" ? (
            <span key={i} />
          ) : (
            <button
              key={i}
              type="button"
              disabled={ocupado}
              onClick={() => (d === "⌫" ? setPin((p) => p.slice(0, -1)) : tocar(d))}
              aria-label={d === "⌫" ? "Borrar" : d}
              className={`flex h-[68px] w-[68px] items-center justify-center rounded-full text-[28px] font-normal text-slate-900 transition active:scale-95 disabled:opacity-50 ${
                d === "⌫" ? "text-xl" : "bg-slate-100 active:bg-slate-200"
              }`}
            >
              {d}
            </button>
          ),
        )}
      </div>
    </div>
  );
}

const claseCampo =
  "h-12 w-full rounded-xl border border-slate-200 bg-slate-50 px-3.5 text-base text-slate-900 outline-none placeholder:text-slate-400 focus:ring-2 focus:ring-sky-200";

const limpiarUsuario = (v: string) => v.toLowerCase().replace(/[^a-z0-9._-]/g, "").slice(0, 30);

/* ───────────── Iniciar sesión / crear administrador ───────────── */

function PantallaEntrar({ onEntrar }: { onEntrar: (pin: { usuario: string; pin: string }) => void }) {
  const [hayUsuarios, setHayUsuarios] = useState<boolean | null>(null);
  const [sinInternet, setSinInternet] = useState(false);
  const [usuario, setUsuario] = useState("");
  const [paso, setPaso] = useState<"usuario" | "pin">("usuario");
  const [error, setError] = useState("");
  const [ocupado, setOcupado] = useState(false);

  const revisar = useCallback(() => {
    setSinInternet(false);
    hayUsuariosEnLaNube()
      .then(setHayUsuarios)
      .catch(() => setSinInternet(true));
  }, []);
  useEffect(revisar, [revisar]);

  if (sinInternet) {
    return (
      <Marco>
        <h1 className="mt-6 text-center text-xl font-bold text-slate-900">Se necesita internet</h1>
        <p className="mt-2 text-center text-sm text-slate-500">
          La primera vez en este teléfono hay que iniciar sesión con internet. Después la app funciona sin conexión.
        </p>
        <button type="button" onClick={revisar} className="mt-6 h-12 w-full rounded-xl bg-sky-900 font-semibold text-white active:scale-[0.99]">
          Reintentar
        </button>
      </Marco>
    );
  }
  if (hayUsuarios === null) return <Marco>{null}</Marco>;
  if (!hayUsuarios) return <CrearAdministrador onEntrar={onEntrar} />;

  const entrar = async (pin: string) => {
    setOcupado(true);
    setError("");
    try {
      await entrarConPin(usuario, pin);
      onEntrar({ usuario, pin });
    } catch (e) {
      setError(e instanceof ErrorNube ? (e.estado === 0 ? "Sin conexión. Intenta de nuevo." : e.message) : "No se pudo entrar");
    } finally {
      setOcupado(false);
    }
  };

  return (
    <Marco>
      <h1 className="mt-5 text-center text-xl font-bold text-slate-900">Porcícola El Mirador</h1>
      {paso === "usuario" ? (
        <form
          className="mt-6 flex flex-col gap-3"
          onSubmit={(e) => {
            e.preventDefault();
            if (usuario.length >= 3) setPaso("pin");
          }}
        >
          <label>
            <span className="mb-1 block text-[13px] font-medium text-slate-700">Usuario</span>
            <input
              value={usuario}
              onChange={(e) => setUsuario(limpiarUsuario(e.target.value))}
              autoCapitalize="none"
              autoCorrect="off"
              autoComplete="username"
              spellCheck={false}
              placeholder="Tu usuario"
              className={claseCampo}
              autoFocus
            />
          </label>
          <button
            type="submit"
            disabled={usuario.length < 3}
            className="mt-1 h-12 w-full rounded-xl bg-sky-900 font-semibold text-white transition active:scale-[0.99] disabled:opacity-50"
          >
            Continuar
          </button>
          <p className="text-center text-xs text-slate-500">El administrador de la granja te da tu usuario y tu PIN.</p>
        </form>
      ) : (
        <div className="mt-5">
          <TecladoPin titulo={`Hola, ${usuario}`} ayuda="Escribe tu PIN de 4 números" error={error} ocupado={ocupado} onCompleto={entrar} />
          <button
            type="button"
            onClick={() => {
              setPaso("usuario");
              setError("");
            }}
            className="mx-auto mt-4 block text-sm font-medium text-sky-700"
          >
            Cambiar de usuario
          </button>
        </div>
      )}
    </Marco>
  );
}

function CrearAdministrador({ onEntrar }: { onEntrar: (pin: { usuario: string; pin: string }) => void }) {
  const [nombre, setNombre] = useState("");
  const [usuario, setUsuario] = useState("");
  const [paso, setPaso] = useState<"datos" | "pin" | "repetir">("datos");
  const [pin, setPin] = useState("");
  const [error, setError] = useState("");
  const [ocupado, setOcupado] = useState(false);

  const crear = async (repetido: string) => {
    if (repetido !== pin) {
      setError("Los PIN no coinciden");
      setPaso("pin");
      return;
    }
    setOcupado(true);
    setError("");
    try {
      await crearPrimerAdministrador(usuario, nombre.trim(), pin);
      onEntrar({ usuario, pin });
    } catch (e) {
      setError(e instanceof ErrorNube ? e.message : "No se pudo crear");
      setPaso("pin");
    } finally {
      setOcupado(false);
    }
  };

  return (
    <Marco>
      <h1 className="mt-5 text-center text-xl font-bold text-slate-900">Configura el administrador</h1>
      <p className="mt-1 text-center text-sm text-slate-500">Eres la primera persona en entrar. Esta cuenta podrá crear los demás usuarios y darles permisos.</p>
      {paso === "datos" ? (
        <form
          className="mt-5 flex flex-col gap-3"
          onSubmit={(e) => {
            e.preventDefault();
            if (nombre.trim() && usuario.length >= 3) setPaso("pin");
          }}
        >
          <label>
            <span className="mb-1 block text-[13px] font-medium text-slate-700">Tu nombre</span>
            <input value={nombre} onChange={(e) => setNombre(e.target.value.slice(0, 60))} placeholder="Ej. Duvan Pérez" className={claseCampo} autoFocus />
          </label>
          <label>
            <span className="mb-1 block text-[13px] font-medium text-slate-700">Usuario</span>
            <input
              value={usuario}
              onChange={(e) => setUsuario(limpiarUsuario(e.target.value))}
              autoCapitalize="none"
              autoCorrect="off"
              spellCheck={false}
              placeholder="Ej. duvan"
              className={claseCampo}
            />
            <span className="mt-1 block text-[11px] text-slate-500">Minúsculas, números, punto o guion. Mínimo 3.</span>
          </label>
          <button
            type="submit"
            disabled={!nombre.trim() || usuario.length < 3}
            className="mt-1 h-12 w-full rounded-xl bg-sky-900 font-semibold text-white transition active:scale-[0.99] disabled:opacity-50"
          >
            Continuar
          </button>
        </form>
      ) : (
        <div className="mt-5">
          <TecladoPin
            key={paso}
            titulo={paso === "pin" ? "Elige tu PIN" : "Repite tu PIN"}
            ayuda="4 números que usarás para entrar"
            error={error}
            ocupado={ocupado}
            onCompleto={(p) => {
              if (paso === "pin") {
                setPin(p);
                setError("");
                setPaso("repetir");
              } else void crear(p);
            }}
          />
          <button type="button" onClick={() => setPaso("datos")} className="mx-auto mt-4 block text-sm font-medium text-sky-700">
            Volver
          </button>
        </div>
      )}
    </Marco>
  );
}

/* ───────────── Desbloquear (Face ID o PIN) ───────────── */

function PantallaDesbloquear({ perfil, onAbrir }: { perfil: PerfilNube | null; onAbrir: () => void }) {
  const conFaceId = faceIdActivo(CLAVE_FACEID_APP);
  const [usarPin, setUsarPin] = useState(!conFaceId);
  const [error, setError] = useState("");
  const [aviso, setAviso] = useState("");
  const [ocupado, setOcupado] = useState(false);

  const conRostro = () => {
    setAviso("");
    // Se llama directamente desde el toque: el iPhone solo muestra Face ID así
    verificarFaceId(CLAVE_FACEID_APP).then((ok) => {
      if (ok) onAbrir();
      else setAviso("Face ID no se abrió. Puedes usar tu PIN.");
    });
  };

  const conPin = async (pin: string) => {
    setOcupado(true);
    setError("");
    const ok = await pinLocalCorrecto(pin);
    setOcupado(false);
    if (ok) onAbrir();
    else setError("PIN incorrecto");
  };

  return (
    <Marco>
      <h1 className="mt-5 text-center text-xl font-bold text-slate-900">Hola{perfil?.nombre ? `, ${perfil.nombre.split(" ")[0]}` : ""}</h1>
      <p className="mt-0.5 text-center text-sm text-slate-500">{perfil?.usuario ? `@${perfil.usuario}` : ""}</p>

      {!usarPin ? (
        <div className="mt-10 flex flex-col items-center gap-4">
          <button
            type="button"
            onClick={conRostro}
            className="flex h-24 w-24 items-center justify-center rounded-3xl bg-slate-100 text-slate-800 transition active:scale-95"
            aria-label="Entrar con Face ID"
          >
            <svg viewBox="0 0 24 24" className="h-12 w-12" fill="none" stroke="currentColor" strokeWidth={1.6} strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
              <path d="M4 8V6a2 2 0 0 1 2-2h2M16 4h2a2 2 0 0 1 2 2v2M20 16v2a2 2 0 0 1-2 2h-2M8 20H6a2 2 0 0 1-2-2v-2" />
              <path d="M9 9.5v1M15 9.5v1M12 9.5V13h-1M9.5 16a3.5 3.5 0 0 0 5 0" />
            </svg>
          </button>
          <p className="text-[15px] font-medium text-slate-900">Toca para entrar con Face ID</p>
          {aviso && <p className="text-center text-[13px] text-amber-700">{aviso}</p>}
          <button type="button" onClick={() => setUsarPin(true)} className="text-sm font-medium text-sky-700">
            Usar PIN
          </button>
        </div>
      ) : (
        <div className="mt-6">
          <TecladoPin titulo="Escribe tu PIN" error={error} ocupado={ocupado} onCompleto={conPin} />
          {conFaceId && (
            <button type="button" onClick={() => setUsarPin(false)} className="mx-auto mt-4 block text-sm font-medium text-sky-700">
              Usar Face ID
            </button>
          )}
        </div>
      )}

      <button type="button" onClick={salirDeLaApp} className="mx-auto mt-auto block pt-8 text-xs font-medium text-slate-500">
        Entrar con otro usuario
      </button>
    </Marco>
  );
}
