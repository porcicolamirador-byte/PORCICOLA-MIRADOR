"use client";

import { registrarLog } from "@/lib/log";
import { useRef, useState, type ChangeEvent, useEffect } from "react";
import { useRouter } from "next/navigation";
import ModuloPage from "@/components/ModuloPage";
import { Boton, Chevron, Tarjeta, Interruptor } from "@/components/ui";
import DialogoClave from "@/components/DialogoClave";
import { codigoValido, desbloquearAjustes, entradaLibre } from "@/lib/acceso";
import { aplicarTema, temaGuardado } from "@/lib/tema";
import DescargaSinConexion from "@/components/DescargaSinConexion";
import { faceIdActivo, motivoFalloFaceId, verificarFaceId } from "@/lib/faceid";
import {
  clavesDeLaApp,
  hoy,
  leerCerdas,
  leerLotes,
  leerMovimientos,
  notificarCambio,
  useVersionDatos,
} from "@/lib/datos";
import { avisar as mostrarAviso, confirmar } from "@/components/Dialogo";
import { perfilGuardado, puede, type PerfilNube } from "@/lib/nube";
import { EVENTO_SYNC, errorSync, estadoSync, leerMeta, pendientesPorSubir, reemplazarClave, sincronizar, type EstadoSync } from "@/lib/sincronizar";
import { salirDeLaApp } from "@/components/PuertaAcceso";

export default function AjustesPage() {
  const version = useVersionDatos();
  const cargado = version >= 0;
  const [mensaje, setMensaje] = useState("");
  const archivo = useRef<HTMLInputElement>(null);
  const router = useRouter();
  const [pedirCodigo, setPedirCodigo] = useState(false);

  // La app abre en oscuro: se parte de ahí para que el interruptor no cambie al cargar
  const [oscuro, setOscuro] = useState(true);
  useEffect(() => setOscuro(temaGuardado() === "oscuro"), []);
  const [conFaceId, setConFaceId] = useState(false);
  const [avisoFaceId, setAvisoFaceId] = useState("");
  useEffect(() => setConFaceId(faceIdActivo()), []);

  // Con Face ID activo se pide el rostro; si falla o se cancela, se pide el código
  const [perfil, setPerfil] = useState<PerfilNube | null>(null);
  useEffect(() => setPerfil(perfilGuardado()), []);

  const cerrarSesion = async () => {
    if (!(await confirmar({ titulo: "Cerrar sesión", mensaje: "Para volver a entrar en este teléfono se pedirá tu usuario y tu PIN (con internet).", aceptar: "Cerrar sesión", destructivo: true, requiere: null }))) return;
    registrarLog([{ accion: "Sistema", modulo: "Sesión", detalle: "Cerró sesión en este teléfono" }]);
    salirDeLaApp();
  };

  const entrar = () => {
    // Solo el administrador o quien tenga el permiso entra a los ajustes protegidos
    if (!puede("ajustes")) {
      void mostrarAviso({ titulo: "Sin permiso", mensaje: "Tu usuario no tiene acceso a los ajustes protegidos. Pídeselo al administrador." });
      return;
    }
    if (entradaLibre()) {
      desbloquearAjustes();
      return router.push("/ajustes/avanzados");
    }
    if (!faceIdActivo()) return setPedirCodigo(true);
    verificarFaceId().then((ok) => {
      if (!ok) {
        setAvisoFaceId(`Face ID no se abrió (${motivoFalloFaceId()}). Ingresa el código.`);
        return setPedirCodigo(true);
      }
      desbloquearAjustes();
      router.push("/ajustes/avanzados");
    });
  };

  const validarCodigo = (codigo: string) => {
    if (!codigoValido(codigo)) return false;
    desbloquearAjustes();
    setPedirCodigo(false);
    setAvisoFaceId("");
    router.push("/ajustes/avanzados");
    return true;
  };

  const resumen = cargado
    ? { cerdas: leerCerdas().length, lotes: leerLotes().length, movimientos: leerMovimientos().length }
    : null;

  const avisar = (texto: string) => {
    setMensaje(texto);
    window.setTimeout(() => setMensaje(""), 3000);
  };

  const exportar = () => {
    const datos: Record<string, unknown> = {};
    for (const k of clavesDeLaApp()) {
      try {
        datos[k] = JSON.parse(localStorage.getItem(k) || "null");
      } catch {
        datos[k] = localStorage.getItem(k);
      }
    }
    const blob = new Blob([JSON.stringify({ app: "porcicola-mirador", fecha: hoy(), datos }, null, 2)], {
      type: "application/json",
    });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `respaldo-el-mirador-${hoy()}.json`;
    document.body.appendChild(a);
    a.click();
    a.remove();
    URL.revokeObjectURL(url);
    avisar("Respaldo exportado");
  };

  const importar = async (e: ChangeEvent<HTMLInputElement>) => {
    const f = e.target.files?.[0];
    e.target.value = "";
    if (!f) return;
    try {
      const json = JSON.parse(await f.text()) as { app?: string; datos?: Record<string, unknown> };
      if (json.app !== "porcicola-mirador" || !json.datos) throw new Error("formato");
      if (!(await confirmar({ titulo: "Restaurar respaldo", mensaje: "Se reemplazarán los datos actuales por los del respaldo.", aceptar: "Restaurar", destructivo: true, requiere: "ajustes" }))) return;
      // Se reemplaza aquí y en la nube (los demás teléfonos lo reciben al sincronizar)
      for (const k of clavesDeLaApp()) if (!(k in json.datos)) reemplazarClave(k, null);
      for (const [k, v] of Object.entries(json.datos)) reemplazarClave(k, v);
      registrarLog([{ accion: "Sistema", modulo: "Datos", detalle: `Respaldo restaurado: ${f.name}` }]);
      notificarCambio();
      avisar("Respaldo restaurado");
    } catch {
      await mostrarAviso({ titulo: "Archivo no válido", mensaje: "El archivo no es un respaldo de El Mirador." });
    }
  };


  return (
    <ModuloPage titulo="Ajustes" subtitulo="Respaldo de los datos" icono="⚙️" tono="slate">
      {perfil && <EstadoNube />}
      {perfil && (
        <div className="flex items-center gap-3 rounded-3xl bg-white p-4 ring-1 ring-slate-200/80">
          <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-sky-100 text-base font-bold text-sky-800" aria-hidden="true">
            {perfil.nombre.trim().charAt(0).toUpperCase()}
          </span>
          <span className="min-w-0 flex-1">
            <span className="block truncate text-sm font-semibold text-slate-900">{perfil.nombre}</span>
            <span className="block truncate text-xs text-slate-500">
              @{perfil.usuario} · {perfil.rol === "admin" ? "Administrador" : "Trabajador"}
            </span>
          </span>
          <button type="button" onClick={cerrarSesion} className="shrink-0 rounded-full px-3 py-1.5 text-xs font-semibold text-rose-600 ring-1 ring-rose-200 active:bg-rose-50">
            Cerrar sesión
          </button>
        </div>
      )}
      <Tarjeta titulo="Datos">
        <p className="mb-3 text-sm text-slate-500">
          Los datos se guardan en este teléfono y en la nube
          {resumen ? ` · ${resumen.cerdas} cerdas, ${resumen.lotes} lotes, ${resumen.movimientos} movimientos` : ""}.
          Exporta un respaldo con frecuencia.
        </p>
        <div className="grid grid-cols-2 gap-2">
          <Boton variante="secundario" onClick={exportar} disabled={!cargado}>Exportar respaldo</Boton>
          <Boton variante="secundario" onClick={() => archivo.current?.click()} disabled={!cargado}>Importar respaldo</Boton>
        </div>
        <input ref={archivo} type="file" accept="application/json,.json" onChange={importar} className="hidden" />
      </Tarjeta>

      {/* Descargar la app completa para usarla sin conexión */}
      <DescargaSinConexion />

      {/* Apariencia: modo oscuro */}
      <label className="flex w-full cursor-pointer items-center gap-3 rounded-3xl bg-white p-4 ring-1 ring-slate-200/80">
        <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-slate-200 text-slate-800" aria-hidden="true">
          <svg viewBox="0 0 24 24" className="h-5 w-5" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
            <circle cx="12" cy="12" r="4" />
            <path d="M12 2v2M12 20v2M4.9 4.9l1.4 1.4M17.7 17.7l1.4 1.4M2 12h2M20 12h2M4.9 19.1l1.4-1.4M17.7 6.3l1.4-1.4" />
          </svg>
        </span>
        <span className="min-w-0 flex-1">
          <span className="block text-sm font-semibold text-slate-900">Modo claro</span>
          <span className="block text-xs text-slate-500">
            {oscuro ? "La app abre siempre en modo oscuro" : "Activo hasta que cierres la app"}
          </span>
        </span>
        <Interruptor
          activo={!oscuro}
          onCambiar={(claro) => {
            aplicarTema(!claro);
            setOscuro(!claro);
          }}
        />
      </label>

      {/* Módulo que abre la sección oculta (pide código) */}
      <button
        type="button"
        onClick={entrar}
        className="flex w-full items-center gap-3 rounded-3xl bg-white p-4 text-left ring-1 ring-slate-200/80 transition hover:shadow-md active:scale-[0.99]"
      >
        <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-slate-200 text-slate-800" aria-hidden="true">
          <svg viewBox="0 0 24 24" className="h-5 w-5" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
            <rect x="5" y="11" width="14" height="10" rx="2" />
            <path d="M8 11V8a4 4 0 0 1 8 0v3" />
          </svg>
        </span>
        <span className="min-w-0 flex-1">
          <span className="block text-sm font-semibold text-slate-900">Ajustes</span>
          <span className="block text-xs text-slate-500">{conFaceId ? "Entra con Face ID o con el código" : "Requiere código de confirmación"}</span>
        </span>
        <Chevron />
      </button>

      <p className="text-center text-xs text-slate-400">Porcícola El Mirador · versión 2.0.0</p>

      <DialogoClave
        abierto={pedirCodigo}
        titulo="Código de confirmación"
        mensaje={avisoFaceId || "Ingresa el código para abrir los ajustes."}
        onValidar={validarCodigo}
        onCerrar={() => {
          setPedirCodigo(false);
          setAvisoFaceId("");
        }}
      />

      {mensaje && (
        <div
          role="status"
          className="fixed left-1/2 z-50 -translate-x-1/2 rounded-full bg-slate-900 px-4 py-2 text-sm font-medium text-white shadow-lg"
          style={{ bottom: "calc(env(safe-area-inset-bottom) + 1.5rem)" }}
        >
          {mensaje}
        </div>
      )}
    </ModuloPage>
  );
}

const TEXTO_ESTADO: Record<EstadoSync, { t: string; c: string }> = {
  "al-dia": { t: "Sincronizado", c: "bg-sky-500" },
  sincronizando: { t: "Sincronizando…", c: "bg-sky-400 animate-pulse" },
  pendiente: { t: "Cambios por subir", c: "bg-orange-500" },
  "sin-conexion": { t: "Sin conexión: se guardará al volver internet", c: "bg-slate-400" },
  error: { t: "No se pudo sincronizar", c: "bg-red-500" },
  "sin-sesion": { t: "Sin sesión", c: "bg-slate-400" },
};

function haceCuanto(iso?: string) {
  if (!iso) return "nunca";
  const min = Math.round((Date.now() - new Date(iso).getTime()) / 60000);
  if (min < 1) return "hace un momento";
  if (min < 60) return `hace ${min} min`;
  const h = Math.round(min / 60);
  if (h < 24) return `hace ${h} h`;
  return new Date(iso).toLocaleDateString("es-CO", { day: "numeric", month: "short" });
}

/** Estado de la sincronización con la nube */
function EstadoNube() {
  const [, setTic] = useState(0);
  useEffect(() => {
    const f = () => setTic((n) => n + 1);
    window.addEventListener(EVENTO_SYNC, f);
    const t = setInterval(f, 30_000);
    return () => {
      window.removeEventListener(EVENTO_SYNC, f);
      clearInterval(t);
    };
  }, []);
  const estado = estadoSync();
  const info = TEXTO_ESTADO[estado];
  const pendientes = pendientesPorSubir();
  const error = errorSync();
  return (
    <div className="rounded-3xl bg-white p-4 ring-1 ring-slate-200/80">
      <div className="flex items-center gap-3">
        <span className={`h-2.5 w-2.5 shrink-0 rounded-full ${info.c}`} aria-hidden="true" />
        <span className="min-w-0 flex-1">
          <span className="block text-sm font-semibold text-slate-900">Nube · {info.t}</span>
          <span className="block text-xs text-slate-500">
            Última vez {haceCuanto(leerMeta().ultima)}
            {pendientes ? ` · ${pendientes} cambio${pendientes === 1 ? "" : "s"} por subir` : ""}
          </span>
        </span>
        <button
          type="button"
          onClick={() => void sincronizar()}
          disabled={estado === "sincronizando"}
          className="shrink-0 rounded-full px-3 py-1.5 text-xs font-semibold text-sky-700 ring-1 ring-sky-200 active:bg-sky-50 disabled:opacity-50"
        >
          Sincronizar
        </button>
      </div>
      {error && estado !== "sincronizando" && <p className="mt-2 text-xs text-amber-700">{error}</p>}
    </div>
  );
}
