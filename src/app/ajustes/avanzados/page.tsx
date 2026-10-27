"use client";

import { leerLog } from "@/lib/log";
import { borrarTodoLocal } from "@/lib/sincronizar";
import { consumoNube, ErrorNube, perfilGuardado, reiniciarBaseNube, type ConsumoNube } from "@/lib/nube";
import Modal from "@/components/Modal";
import { useEffect, useState, useSyncExternalStore, type FormEvent, type ReactNode } from "react";
import { useRouter } from "next/navigation";
import ModuloPage from "@/components/ModuloPage";
import { Boton, Interruptor } from "@/components/ui";
import { avisar, confirmar } from "@/components/Dialogo";
import { ajustesDesbloqueados } from "@/lib/acceso";
import {
  ALIMENTACION_POR_DEFECTO,
  CONFIG_POR_DEFECTO,
  ETAPAS_ALIMENTACION,
  guardarConfig,
  leerConfig,
  type AlimentacionEstandar,
  type ConfigGranja,
  type ProductosEtapa,
  CONSUMO_CERDAS_POR_DEFECTO,
  type ConsumoCerdas,
} from "@/lib/config";
import { codigoDe, hoy, leerCorrales, leerProductos, notificarCambio, useVersionDatos } from "@/lib/datos";
import CatalogoProductos from "@/components/CatalogoProductos";
import CatalogoCorrales from "@/components/CatalogoCorrales";

/**
 * Ajustes protegidos: entra el administrador o quien tenga el permiso
 * "Ajustes protegidos". Sin permiso, regresa a Ajustes.
 */
const sinSuscripcion = () => () => {};

export default function AjustesAvanzadosPage() {
  const router = useRouter();
  // En el cliente el permiso y la configuración se leen al instante (sin pantalla intermedia)
  const cliente = useSyncExternalStore(sinSuscripcion, () => true, () => false);
  const permitido = cliente && ajustesDesbloqueados();
  const esAdmin = cliente && perfilGuardado()?.rol === "admin";
  const [config, setConfig] = useState<ConfigGranja>(() => (typeof window === "undefined" ? CONFIG_POR_DEFECTO : leerConfig()));
  const [abierto, setAbierto] = useState<string | null>(null);
  const alternar = (id: string) => setAbierto((a) => (a === id ? null : id));
  const version = useVersionDatos();
  void version; // vuelve a leer al cambiar los datos
  const productos = cliente ? leerProductos().length : 0;
  const corrales = cliente ? leerCorrales().length : 0;
  useEffect(() => {
    if (!ajustesDesbloqueados()) router.replace("/ajustes");
  }, [router]);

  const [reiniciar, setReiniciar] = useState(false);

  const guardar = (cambios: Partial<ConfigGranja>) => {
    setConfig(guardarConfig(cambios));
    notificarCambio(); // las tareas del dashboard se recalculan con el nuevo rango
  };

  if (!permitido) {
    return (
      <ModuloPage titulo="Ajustes avanzados" subtitulo="Según los permisos de tu usuario" icono={<IconoAjuste nombre="candado" className="h-5 w-5" />} tono="slate" volverA="/ajustes">
        {null}
      </ModuloPage>
    );
  }

  return (
    <ModuloPage
      titulo="Ajustes avanzados"
      subtitulo="Según los permisos de tu usuario"
      icono={<IconoAjuste nombre="candado" className="h-5 w-5" />}
      tono="slate"
      volverA="/ajustes"
    >
      {esAdmin && (
      <Grupo titulo="Acceso">
        {(
          <li>
            <button type="button" onClick={() => router.push("/ajustes/usuarios")} className="flex w-full items-center gap-3 px-4 py-3 text-left active:bg-slate-50">
              <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-slate-100 text-slate-700" aria-hidden="true">
                <IconoAjuste nombre="usuarios" />
              </span>
              <span className="min-w-0 flex-1">
                <span className="block text-[15px] font-medium text-slate-900">Usuarios</span>
                <span className="block text-xs text-slate-500">Crear usuarios, PIN y permisos</span>
              </span>
              <svg viewBox="0 0 24 24" aria-hidden="true" className="h-4 w-4 shrink-0 text-slate-400" fill="none" stroke="currentColor" strokeWidth={2.4} strokeLinecap="round" strokeLinejoin="round">
                <path d="m9 6 6 6-6 6" />
              </svg>
            </button>
          </li>
        )}
      </Grupo>
      )}

      {/* Solo el administrador ve y cambia las claves */}
      {esAdmin && (
      <Grupo titulo="Claves">
        <Desplegable icono="papelera" titulo="Clave de eliminación" resumen={config.claveEliminarActiva ? "Activa" : "Desactivada"} abierto={abierto === "eliminar"} onAlternar={() => alternar("eliminar")}>
          <ActivarClave
            activa={config.claveEliminarActiva}
            donde="Gestación al eliminar una cerda"
            onCambiar={(v) => guardar({ claveEliminarActiva: v })}
          />
          <CambiarClave
            titulo="Clave de eliminación"
            descripcion="Se pide en Gestación para eliminar una cerda."
            icono="🗑️"
            actual={config.claveEliminar}
            onGuardar={(clave) => guardar({ claveEliminar: clave })}
          />
        </Desplegable>
        <Desplegable icono="factura" titulo="Clave de facturas" resumen={config.claveFacturasActiva ? "Activa" : "Desactivada"} abierto={abierto === "facturas"} onAlternar={() => alternar("facturas")}>
          <ActivarClave
            activa={config.claveFacturasActiva}
            donde="Bodega al cargar una factura"
            onCambiar={(v) => guardar({ claveFacturasActiva: v })}
          />
          <CambiarClave
            titulo="Clave de facturas"
            descripcion="Se pide en Bodega para cargar una factura."
            icono="🧾"
            actual={config.claveFacturas}
            onGuardar={(clave) => guardar({ claveFacturas: clave })}
          />
        </Desplegable>
        <Desplegable icono="lote" titulo="Clave de lotes" resumen={config.claveLotesActiva ? "Activa" : "Desactivada"} abierto={abierto === "lotes"} onAlternar={() => alternar("lotes")}>
          <ActivarClave
            activa={config.claveLotesActiva}
            donde="Engorde al eliminar un lote"
            onCambiar={(v) => guardar({ claveLotesActiva: v })}
          />
          <CambiarClave
            titulo="Clave de lotes"
            descripcion="Se pide en Engorde para eliminar un lote."
            icono="🐷"
            actual={config.claveLotes}
            onGuardar={(clave) => guardar({ claveLotes: clave })}
          />
        </Desplegable>
      </Grupo>
      )}

      <Grupo titulo="Granja">
        <Desplegable
          icono="destete"
          titulo="Días de destete"
          resumen={`${config.desteteMin} a ${config.desteteMax} d`}
          abierto={abierto === "destete"}
          onAlternar={() => alternar("destete")}
        >
          <DiasDestete min={config.desteteMin} max={config.desteteMax} onGuardar={(min, max) => guardar({ desteteMin: min, desteteMax: max })} />
        </Desplegable>
        <Desplegable
          icono="paridera"
          titulo="Parideras"
          resumen={config.parideras ? String(config.parideras) : "Sin definir"}
          abierto={abierto === "parideras"}
          onAlternar={() => alternar("parideras")}
        >
          <Parideras actual={config.parideras} onGuardar={(n) => guardar({ parideras: n })} />
        </Desplegable>
        <Desplegable
          icono="alimento"
          titulo="Alimentación estándar"
          resumen={`${ETAPAS_ALIMENTACION.length} etapas`}
          abierto={abierto === "alimentacion"}
          onAlternar={() => alternar("alimentacion")}
        >
          <Alimentacion
            actual={config.alimentacion}
            productosActuales={config.productosEtapa}
            onGuardar={(a, productosEtapa) => guardar({ alimentacion: a, productosEtapa })}
          />
        </Desplegable>
        <Desplegable
          icono="alimento"
          titulo="Consumo de cerdas"
          resumen={`${config.consumoCerdas.gestacion} · ${config.consumoCerdas.preparto} · ${config.consumoCerdas.lactancia} kg`}
          abierto={abierto === "consumoCerdas"}
          onAlternar={() => alternar("consumoCerdas")}
        >
          <ConsumoCerdasAjuste actual={config.consumoCerdas} onGuardar={(c) => guardar({ consumoCerdas: c })} />
        </Desplegable>
        <Desplegable
          icono="corral"
          titulo="Corrales"
          resumen={corrales ? String(corrales) : "Ninguno"}
          abierto={abierto === "corrales"}
          onAlternar={() => alternar("corrales")}
        >
          <CatalogoCorrales />
        </Desplegable>
      </Grupo>

      <Grupo titulo="Bodega">
        <li>
          <label className="flex w-full cursor-pointer items-center gap-3 px-4 py-3">
            <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-slate-100 text-slate-700" aria-hidden="true">
              <IconoAjuste nombre="inventario" />
            </span>
            <span className="min-w-0 flex-1">
              <span className="block text-[15px] font-medium text-slate-900">Usar productos sin inventario</span>
              <span className="block text-xs text-slate-500">
                {config.permitirSinInventario ? "Activado: el inventario puede quedar en negativo" : "Desactivado: solo productos con existencia"}
              </span>
            </span>
            <Interruptor activo={config.permitirSinInventario} onCambiar={(v) => guardar({ permitirSinInventario: v })} />
          </label>
        </li>
        <Desplegable icono="productos" titulo="Productos de bodega" resumen={`${productos}`} abierto={abierto === "productos"} onAlternar={() => alternar("productos")}>
          <CatalogoProductos incrustado />
        </Desplegable>
      </Grupo>

      {esAdmin && (
        <Grupo titulo="Nube">
          <Desplegable icono="nube" titulo="Consumo de la base de datos" resumen="Plan gratuito" abierto={abierto === "consumo"} onAlternar={() => alternar("consumo")}>
            <ConsumoBase />
          </Desplegable>
        </Grupo>
      )}

      <Grupo titulo="Datos">
        <li>
          <button type="button" onClick={() => router.push("/ajustes/registro")} className="flex w-full items-center gap-3 px-4 py-3 text-left active:bg-slate-50">
            <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-slate-100 text-slate-700" aria-hidden="true">
              <IconoAjuste nombre="registro" />
            </span>
            <span className="min-w-0 flex-1">
              <span className="block text-[15px] font-medium text-slate-900">Registro de actividad</span>
              <span className="block text-xs text-slate-500">Creaciones, cambios y eliminaciones</span>
            </span>
            <span className="shrink-0 text-sm text-slate-500">{cliente ? leerLog().length : ""}</span>
            <svg viewBox="0 0 24 24" aria-hidden="true" className="h-4 w-4 shrink-0 text-slate-400" fill="none" stroke="currentColor" strokeWidth={2.4} strokeLinecap="round" strokeLinejoin="round">
              <path d="m9 6 6 6-6 6" />
            </svg>
          </button>
        </li>
        {esAdmin && (
        <li>
          <button type="button" onClick={() => setReiniciar(true)} className="flex w-full items-center gap-3 px-4 py-3 text-left active:bg-rose-50">
            <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-rose-50 text-rose-600" aria-hidden="true">
              <IconoAjuste nombre="papelera" />
            </span>
            <span className="min-w-0 flex-1">
              <span className="block text-[15px] font-medium text-rose-600">Borrar toda la base de datos</span>
              <span className="block text-xs text-slate-500">Todas las granjas, en la nube y en todos los teléfonos</span>
            </span>
          </button>
        </li>
        )}
      </Grupo>
      {reiniciar && <ReinicioBase onCerrar={() => setReiniciar(false)} />}

    </ModuloPage>
  );
}

/* ───────────────────────── Componentes ───────────────────────── */

const claseCampo =
  "h-11 w-full rounded-xl border border-slate-200 bg-slate-50 px-3 text-center text-xl tracking-[0.5em] text-slate-900 outline-none placeholder:text-slate-300 placeholder:tracking-[0.5em] focus:bg-white focus:ring-2 focus:ring-sky-200";

/** Las descripciones de ayuda ya no se muestran en pantalla */
function Encabezado(_props: { icono?: string; titulo?: string; descripcion: string }) {
  return null;
}

/** Fila que se despliega al tocarla; solo una abierta a la vez */
/** Iconos de línea gris (mismo estilo que el Dashboard) */
const TRAZOS_AJUSTES = {
  faceid: (
    <>
      <path d="M4 8V6a2 2 0 0 1 2-2h2M16 4h2a2 2 0 0 1 2 2v2M20 16v2a2 2 0 0 1-2 2h-2M8 20H6a2 2 0 0 1-2-2v-2" />
      <path d="M9 9.5v1M15 9.5v1M12 9.5V13h-1M9.5 16a3.5 3.5 0 0 0 5 0" />
    </>
  ),
  llave: (
    <>
      <circle cx="7.5" cy="15.5" r="3.5" />
      <path d="m10 13 9-9M16 7l2 2M14 9l2 2" />
    </>
  ),
  papelera: <path d="M4 7h16M10 11v6M14 11v6M5 7l1 12a2 2 0 0 0 2 2h8a2 2 0 0 0 2-2l1-12M9 7V4h6v3" />,
  factura: (
    <>
      <path d="M6 3h12v18l-3-2-3 2-3-2-3 2z" />
      <path d="M9 8h6M9 12h6M9 16h3" />
    </>
  ),
  lote: (
    <>
      <path d="M6 7h12l2 13H4z" />
      <path d="M9 7a3 3 0 0 1 6 0" />
      <path d="M12 12v3l1.5 1" />
    </>
  ),
  destete: (
    <>
      <path d="M9 3h6M10 3v3L8 9v10a2 2 0 0 0 2 2h4a2 2 0 0 0 2-2V9l-2-3V3" />
      <path d="M8 13h8" />
    </>
  ),
  paridera: (
    <>
      <path d="m3 11 9-7 9 7M5 10v10h14V10" />
      <path d="M10 20v-5h4v5" />
    </>
  ),
  alimento: (
    <>
      <path d="M3 11h18a9 9 0 0 1-18 0z" />
      <path d="M8 7c0-1 1-2 1-3M12 7c0-1 1-2 1-3M16 7c0-1 1-2 1-3" />
    </>
  ),
  corral: <path d="M4 21V7l2-3 2 3v14M16 21V7l2-3 2 3v14M8 10h8M8 16h8" />,
  inventario: (
    <>
      <path d="m3 7 6 6 4-4 8 8" />
      <path d="M21 11v6h-6" />
    </>
  ),
  productos: (
    <>
      <path d="M21 8 12 3 3 8v8l9 5 9-5z" />
      <path d="m3 8 9 5 9-5M12 13v8" />
    </>
  ),
  usuarios: (
    <>
      <circle cx="9" cy="8" r="3.5" />
      <path d="M2.5 20a6.5 6.5 0 0 1 13 0M16 4.5a3.5 3.5 0 0 1 0 7M18 14.5a6.5 6.5 0 0 1 3.5 5.5" />
    </>
  ),
  nube: (
    <>
      <path d="M7 18a4.5 4.5 0 0 1-.6-8.96A6 6 0 0 1 18 9.5a4 4 0 0 1-.5 7.97z" />
      <path d="M12 12v5M9.5 14.5 12 17l2.5-2.5" />
    </>
  ),
  registro: (
    <>
      <path d="M8 3h8a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2z" />
      <path d="M9.5 8h5M9.5 12h5M9.5 16h3" />
    </>
  ),
  candado: (
    <>
      <rect x="5" y="11" width="14" height="10" rx="2" />
      <path d="M8 11V8a4 4 0 0 1 8 0v3" />
    </>
  ),
} satisfies Record<string, ReactNode>;
type NombreIcono = keyof typeof TRAZOS_AJUSTES;

function IconoAjuste({ nombre, className = "h-[18px] w-[18px]" }: { nombre: NombreIcono; className?: string }) {
  return (
    <svg viewBox="0 0 24 24" className={className} fill="none" stroke="currentColor" strokeWidth={1.8} strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      {TRAZOS_AJUSTES[nombre]}
    </svg>
  );
}

function Desplegable({
  icono,
  titulo,
  resumen,
  abierto,
  onAlternar,
  children,
}: {
  icono: NombreIcono;
  titulo: string;
  resumen: string;
  abierto: boolean;
  onAlternar: () => void;
  children: ReactNode;
}) {
  return (
    <li>
      <button
        type="button"
        onClick={onAlternar}
        aria-expanded={abierto}
        className="flex w-full items-center gap-3 px-4 py-3 text-left active:bg-slate-50"
      >
        <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-slate-100 text-slate-700" aria-hidden="true">
          <IconoAjuste nombre={icono} />
        </span>
        <span className="min-w-0 flex-1 truncate text-[15px] font-medium text-slate-900">{titulo}</span>
        <span className="shrink-0 text-sm text-slate-500">{resumen}</span>
        <svg
          viewBox="0 0 24 24"
          aria-hidden="true"
          className={`h-4 w-4 shrink-0 text-slate-400 transition-transform ${abierto ? "rotate-90" : ""}`}
          fill="none"
          stroke="currentColor"
          strokeWidth={2.4}
          strokeLinecap="round"
          strokeLinejoin="round"
        >
          <path d="m9 6 6 6-6 6" />
        </svg>
      </button>
      {abierto && <div className="border-t border-slate-100 bg-slate-50/40 px-4 pb-4 pt-3">{children}</div>}
    </li>
  );
}

function Grupo({ titulo, children }: { titulo: string; children: ReactNode }) {
  return (
    <section>
      <h2 className="mb-1.5 px-1 text-[11px] font-semibold uppercase tracking-wider text-slate-400">{titulo}</h2>
      <ul className="divide-y divide-slate-100 overflow-hidden rounded-2xl bg-white ring-1 ring-slate-200/80">{children}</ul>
    </section>
  );
}

function Etiqueta({ children }: { children: ReactNode }) {
  return <span className="mb-1 block text-[13px] font-medium text-slate-700">{children}</span>;
}

/** Interruptor para pedir o no una clave */
function ActivarClave({
  activa,
  donde,
  textoDesactivada,
  onCambiar,
}: {
  activa: boolean;
  donde: string;
  textoDesactivada?: string;
  onCambiar: (v: boolean) => void;
}) {
  return (
    <label className="mb-3 flex cursor-pointer items-center gap-3 rounded-2xl bg-white px-3.5 py-3 ring-1 ring-slate-100">
      <span className="min-w-0 flex-1">
        <span className="block text-[15px] font-medium text-slate-900">Pedir clave</span>
        <span className="block text-xs text-slate-500">
          {activa ? `Activada: se pide ${donde.startsWith("al ") ? donde : `en ${donde}`}` : textoDesactivada ?? `Desactivada: no se pide en ${donde}`}
        </span>
      </span>
      <Interruptor activo={activa} onCambiar={onCambiar} />
    </label>
  );
}

function CambiarClave({
  titulo,
  descripcion,
  icono,
  actual,
  onGuardar,
  longitud = 4,
}: {
  titulo: string;
  descripcion: string;
  icono: string;
  actual: string;
  onGuardar: (clave: string) => void;
  longitud?: number;
}) {
  const [claveActual, setClaveActual] = useState("");
  const [nueva, setNueva] = useState("");
  const [repetir, setRepetir] = useState("");
  const [error, setError] = useState("");

  const solo4 = (v: string) => v.replace(/\D/g, "").slice(0, longitud);
  const puntos = "•".repeat(longitud);

  const enviar = async (e: FormEvent) => {
    e.preventDefault();
    if (claveActual !== actual) return setError("La clave actual no es correcta.");
    if (!new RegExp(`^\\d{${longitud}}$`).test(nueva)) return setError(`La nueva clave debe tener ${longitud} números.`);
    if (nueva !== repetir) return setError("Las claves nuevas no coinciden.");
    if (nueva === actual) return setError("La nueva clave es igual a la actual.");
    if (!(await confirmar({ titulo: `Cambiar ${titulo.toLowerCase()}`, mensaje: "A partir de ahora se pedirá la nueva clave.", aceptar: "Cambiar" }))) return;
    onGuardar(nueva);
    setClaveActual("");
    setNueva("");
    setRepetir("");
    setError("");
    await avisar({ titulo: "Clave actualizada", mensaje: `La ${titulo.toLowerCase()} se cambió correctamente.` });
  };

  return (
    <>
      <Encabezado icono={icono} titulo={titulo} descripcion={descripcion} />
      <form onSubmit={enviar} className="flex flex-col gap-3">
        <label>
          <Etiqueta>Clave actual</Etiqueta>
          <input
            type="password"
            inputMode="numeric"
            autoComplete="off"
            value={claveActual}
            onChange={(e) => {
              setClaveActual(solo4(e.target.value));
              setError("");
            }}
            placeholder={puntos}
            className={claseCampo}
          />
        </label>
        <div className="grid grid-cols-2 gap-3">
          <label>
            <Etiqueta>Nueva clave</Etiqueta>
            <input
              type="password"
              inputMode="numeric"
              autoComplete="off"
              value={nueva}
              onChange={(e) => {
                setNueva(solo4(e.target.value));
                setError("");
              }}
              placeholder={puntos}
              className={claseCampo}
            />
          </label>
          <label>
            <Etiqueta>Repetir</Etiqueta>
            <input
              type="password"
              inputMode="numeric"
              autoComplete="off"
              value={repetir}
              onChange={(e) => {
                setRepetir(solo4(e.target.value));
                setError("");
              }}
              placeholder={puntos}
              className={claseCampo}
            />
          </label>
        </div>
        {error && <p className="text-sm font-medium text-rose-600">{error}</p>}
        <Boton type="submit" className="w-full py-3" disabled={!claveActual || !nueva || !repetir}>
          Cambiar clave
        </Boton>
      </form>
    </>
  );
}

function DiasDestete({ min, max, onGuardar }: { min: number; max: number; onGuardar: (min: number, max: number) => void }) {
  const [desde, setDesde] = useState(String(min));
  const [hasta, setHasta] = useState(String(max));
  const [error, setError] = useState("");

  // Si cambian los valores guardados (al cargar), se actualizan los campos
  const [base, setBase] = useState(`${min}-${max}`);
  if (base !== `${min}-${max}`) {
    setBase(`${min}-${max}`);
    setDesde(String(min));
    setHasta(String(max));
  }

  const nMin = Number(desde);
  const nMax = Number(hasta);
  const valido = Number.isInteger(nMin) && Number.isInteger(nMax) && nMin >= 1 && nMax <= 90 && nMin < nMax;
  const sinCambios = nMin === min && nMax === max;

  const enviar = async (e: FormEvent) => {
    e.preventDefault();
    if (!valido) return setError("Escribe días enteros entre 1 y 90, y el primero menor que el segundo.");
    if (!(await confirmar({
      titulo: "Cambiar días de destete",
      mensaje: `El destete se calculará entre ${nMin} y ${nMax} días después del parto. Los registros ya guardados conservan su mensaje anterior.`,
      aceptar: "Guardar",
    }))) return;
    onGuardar(nMin, nMax);
    setError("");
    await avisar({ titulo: "Días de destete actualizados", mensaje: `Ahora: entre ${nMin} y ${nMax} días después del parto.` });
  };

  const restaurar = () => {
    setDesde(String(CONFIG_POR_DEFECTO.desteteMin));
    setHasta(String(CONFIG_POR_DEFECTO.desteteMax));
    setError("");
  };

  const campoDia =
    "h-12 w-full rounded-xl border border-slate-200 bg-slate-50 px-3 text-center text-xl font-semibold text-slate-900 outline-none focus:bg-white focus:ring-2 focus:ring-sky-200";

  return (
    <>
      <Encabezado
        icono="🍼"
        titulo="Días de destete"
        descripcion="Ventana para registrar el destete, la fecha sugerida tras cada parto y la tarea “Destete próximo”."
      />
      <form onSubmit={enviar} className="flex flex-col gap-3">
        <div className="grid grid-cols-[1fr_auto_1fr] items-end gap-2">
          <label>
            <Etiqueta>Desde (día)</Etiqueta>
            <input
              type="number"
              inputMode="numeric"
              min={1}
              max={89}
              value={desde}
              onChange={(e) => {
                setDesde(e.target.value.replace(/\D/g, "").slice(0, 2));
                setError("");
              }}
              className={campoDia}
            />
          </label>
          <span className="pb-3 text-sm font-medium text-slate-500">a</span>
          <label>
            <Etiqueta>Hasta (día)</Etiqueta>
            <input
              type="number"
              inputMode="numeric"
              min={2}
              max={90}
              value={hasta}
              onChange={(e) => {
                setHasta(e.target.value.replace(/\D/g, "").slice(0, 2));
                setError("");
              }}
              className={campoDia}
            />
          </label>
        </div>
        <p className="rounded-xl bg-sky-50 px-3 py-2 text-sm text-sky-900 ring-1 ring-sky-100">
          {valido
            ? `El destete se calcula entre ${nMin} y ${nMax} días después del parto.`
            : "Revisa los días: el primero debe ser menor que el segundo."}
        </p>
        {error && <p className="text-sm font-medium text-rose-600">{error}</p>}
        <div className="grid grid-cols-2 gap-2">
          <Boton variante="secundario" onClick={restaurar}>
            Usar 21 a 28
          </Boton>
          <Boton type="submit" disabled={!valido || sinCambios}>
            Guardar
          </Boton>
        </div>
      </form>
    </>
  );
}

function Parideras({ actual, onGuardar }: { actual: number; onGuardar: (n: number) => void }) {
  const [valor, setValor] = useState(actual ? String(actual) : "");
  const [base, setBase] = useState(actual);
  if (base !== actual) {
    setBase(actual);
    setValor(actual ? String(actual) : "");
  }
  const n = Number(valor);
  const valido = valor !== "" && Number.isInteger(n) && n >= 1 && n <= 500;

  const enviar = async (e: FormEvent) => {
    e.preventDefault();
    if (!valido) return;
    onGuardar(n);
    await avisar({
      titulo: "Parideras actualizadas",
      mensaje: `Programación repartirá las inseminaciones para no pasar de ${n} parideras.`,
    });
  };

  const cambiar = (d: number) => setValor(String(Math.min(500, Math.max(1, (Number(valor) || 0) + d))));
  const boton =
    "flex h-12 w-12 shrink-0 items-center justify-center rounded-xl bg-slate-100 text-2xl font-semibold text-slate-700 active:bg-slate-200";

  return (
    <>
      <Encabezado
        icono="🏠"
        titulo="Parideras"
        descripcion="Cantidad de parideras de la granja. Cada cerda ocupa una desde 15 días antes del parto hasta el destete."
      />
      <form onSubmit={enviar} className="flex flex-col gap-3">
        <div className="flex items-center gap-2">
          <button type="button" className={boton} onClick={() => cambiar(-1)} aria-label="Una menos">
            −
          </button>
          <input
            type="number"
            inputMode="numeric"
            min={1}
            max={500}
            placeholder="0"
            aria-label="Número de parideras"
            value={valor}
            onChange={(e) => setValor(e.target.value.replace(/\D/g, "").slice(0, 3))}
            className="h-12 w-full min-w-0 rounded-xl border border-slate-200 bg-slate-50 px-3 text-center text-xl font-semibold text-slate-900 outline-none focus:bg-white focus:ring-2 focus:ring-sky-200"
          />
          <button type="button" className={boton} onClick={() => cambiar(1)} aria-label="Una más">
            +
          </button>
        </div>
        {!actual && <p className="text-xs text-amber-700">Aún no está configurado: el motor no controla la capacidad.</p>}
        <Boton type="submit" disabled={!valido || n === actual}>
          Guardar
        </Boton>
      </form>
    </>
  );
}

function Alimentacion({
  actual,
  productosActuales,
  onGuardar,
}: {
  actual: AlimentacionEstandar;
  productosActuales: ProductosEtapa;
  onGuardar: (a: AlimentacionEstandar, productos: ProductosEtapa) => void;
}) {
  const aTexto = (a: AlimentacionEstandar) =>
    Object.fromEntries(ETAPAS_ALIMENTACION.map(({ clave }) => [clave, String(a[clave]).replace(".", ",")])) as Record<keyof AlimentacionEstandar, string>;
  const [valores, setValores] = useState(aTexto(actual));
  const [base, setBase] = useState(actual);
  const [unidos, setUnidos] = useState<ProductosEtapa>(productosActuales);
  const [baseUnidos, setBaseUnidos] = useState(productosActuales);
  if (base !== actual) {
    setBase(actual);
    setValores(aTexto(actual));
  }
  if (baseUnidos !== productosActuales) {
    setBaseUnidos(productosActuales);
    setUnidos(productosActuales);
  }

  // Productos de bodega con código (uno por código; se muestra el nombre del primero)
  const catalogo = [
    ...new Map(
      leerProductos()
        .filter((p) => codigoDe(p) && p.activo !== false)
        .sort((a, b) => Number(a.unidad === "kg") - Number(b.unidad === "kg"))
        .map((p) => [codigoDe(p), p.nombre] as const)
        .reverse(),
    ),
  ].sort((a, b) => a[0].localeCompare(b[0], "es", { numeric: true }));
  const nombreDe = (codigo: string) => catalogo.find(([c]) => c === codigo)?.[1];
  const alternarCodigo = (etapa: keyof AlimentacionEstandar, codigo: string) =>
    setUnidos((u) => ({ ...u, [etapa]: u[etapa].includes(codigo) ? u[etapa].filter((c) => c !== codigo) : [...u[etapa], codigo] }));

  const numeros = Object.fromEntries(
    ETAPAS_ALIMENTACION.map(({ clave }) => [clave, Number((valores[clave] || "0").replace(",", "."))]),
  ) as unknown as AlimentacionEstandar;
  const valido = ETAPAS_ALIMENTACION.every(({ clave }) => Number.isFinite(numeros[clave]) && numeros[clave] >= 0 && numeros[clave] <= 10000);
  const sinCambios = ETAPAS_ALIMENTACION.every(
    ({ clave }) => numeros[clave] === actual[clave] && [...unidos[clave]].sort().join() === [...productosActuales[clave]].sort().join(),
  );
  const total = ETAPAS_ALIMENTACION.reduce((s, { clave }) => s + (Number.isFinite(numeros[clave]) ? numeros[clave] : 0), 0);

  const enviar = async (e: FormEvent) => {
    e.preventDefault();
    if (!valido) return;
    onGuardar(numeros, unidos);
    await avisar({ titulo: "Alimentación actualizada", mensaje: "Se guardaron los kilos y los productos de cada etapa." });
  };

  return (
    <form onSubmit={enviar} className="flex flex-col gap-3">
      <ul className="divide-y divide-slate-100 overflow-hidden rounded-2xl bg-white ring-1 ring-slate-100">
        {ETAPAS_ALIMENTACION.map(({ clave, nombre }) => (
          <li key={clave} className="pb-2">
            <label className="flex items-center gap-3 px-3.5 pt-2">
              <span className="min-w-0 flex-1 text-sm text-slate-800">{nombre}</span>
              <input
                type="text"
                inputMode="decimal"
                value={valores[clave]}
                onChange={(e) => setValores((v) => ({ ...v, [clave]: e.target.value.replace(/[^\d.,]/g, "").slice(0, 7) }))}
                onFocus={(e) => e.target.select()}
                aria-label={`${nombre} en kilos`}
                className="h-10 w-20 shrink-0 rounded-lg border border-slate-200 bg-slate-50 px-2 text-right text-base font-semibold tabular-nums text-slate-900 outline-none focus:bg-white focus:ring-2 focus:ring-sky-200"
              />
              <span className="w-5 shrink-0 text-xs text-slate-500">kg</span>
            </label>
            <div className="flex flex-col gap-1.5 px-3.5 pt-2">
              {unidos[clave].map((c) => (
                <div key={c} className="flex items-center gap-2 rounded-xl bg-sky-50 py-1.5 pl-2.5 pr-1 ring-1 ring-sky-100">
                  <span className="shrink-0 rounded-md bg-white px-1.5 py-0.5 text-[11px] font-bold tabular-nums text-sky-800 ring-1 ring-sky-200">{c}</span>
                  <span className={`min-w-0 flex-1 truncate text-sm ${nombreDe(c) ? "text-slate-800" : "text-amber-700"}`}>
                    {nombreDe(c) ?? "Sin producto en bodega"}
                  </span>
                  <button
                    type="button"
                    onClick={() => alternarCodigo(clave, c)}
                    aria-label={`Quitar ${c} de ${nombre}`}
                    className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full text-slate-400 active:bg-sky-100"
                  >
                    <svg viewBox="0 0 20 20" className="h-3.5 w-3.5" fill="none" stroke="currentColor" strokeWidth={2.2} strokeLinecap="round" aria-hidden="true">
                      <path d="M5 5l10 10M15 5L5 15" />
                    </svg>
                  </button>
                </div>
              ))}
              {(() => {
                const libres = catalogo.filter(([c]) => !unidos[clave].includes(c));
                return (
                  <div className="relative">
                    <select
                      value=""
                      onChange={(e) => e.target.value && alternarCodigo(clave, e.target.value)}
                      disabled={libres.length === 0}
                      aria-label={`Unir producto a ${nombre}`}
                      className="h-10 w-full appearance-none rounded-xl border border-slate-200 bg-slate-50 pl-3 pr-9 text-sm text-slate-600 outline-none focus:ring-2 focus:ring-sky-200 disabled:opacity-60"
                    >
                      <option value="">
                        {catalogo.length === 0
                          ? "No hay productos con código"
                          : libres.length === 0
                            ? "Todos los productos están unidos"
                            : unidos[clave].length
                              ? "Agregar otro producto…"
                              : "Unir producto de bodega…"}
                      </option>
                      {libres.map(([c, n]) => (
                        <option key={c} value={c}>
                          {c} · {n}
                        </option>
                      ))}
                    </select>
                    <svg viewBox="0 0 20 20" className="pointer-events-none absolute right-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                      <path d="M5 8l5 5 5-5" />
                    </svg>
                  </div>
                );
              })()}
            </div>
          </li>
        ))}
        <li className="flex items-center justify-between bg-slate-50 px-3.5 py-2.5 text-sm">
          <span className="font-medium text-slate-600">Total por cerdo</span>
          <span className="font-bold tabular-nums text-slate-900">{total.toLocaleString("es-CO", { maximumFractionDigits: 1 })} kg</span>
        </li>
      </ul>
      {!valido && <p className="text-sm font-medium text-rose-600">Escribe kilos válidos (números entre 0 y 10.000).</p>}
      <div className="grid grid-cols-2 gap-2">
        <Boton variante="secundario" onClick={() => setValores(aTexto(ALIMENTACION_POR_DEFECTO))}>
          Valores por defecto
        </Boton>
        <Boton type="submit" disabled={!valido || sinCambios}>
          Guardar
        </Boton>
      </div>
    </form>
  );
}


/* ───────────── Reinicio total de la base de datos ───────────── */

function ReinicioBase({ onCerrar }: { onCerrar: () => void }) {
  const [texto, setTexto] = useState("");
  const [pin, setPin] = useState("");
  const [error, setError] = useState("");
  const [borrando, setBorrando] = useState(false);
  const listo = texto.trim().toUpperCase() === "BORRAR" && /^\d{4}$/.test(pin);

  const enviar = async (e: FormEvent) => {
    e.preventDefault();
    if (!listo || borrando) return;
    setBorrando(true);
    setError("");
    try {
      const generacion = await reiniciarBaseNube(pin);
      borrarTodoLocal(generacion);
      notificarCambio();
      onCerrar();
      await avisar({
        titulo: "Base de datos en blanco",
        mensaje: "Se borró toda la información. Los demás teléfonos quedarán en blanco apenas se abran con internet. Los usuarios y sus PIN se conservan.",
      });
      window.location.href = "/";
    } catch (err) {
      setError(err instanceof ErrorNube || err instanceof Error ? err.message : "No se pudo borrar. Revisa la conexión.");
      setBorrando(false);
    }
  };

  const campo =
    "block w-full rounded-xl bg-slate-50 px-3.5 py-2.5 text-base text-slate-900 ring-1 ring-slate-200 placeholder:text-slate-400 focus:bg-white focus:outline-none focus:ring-2 focus:ring-rose-500";

  return (
    <Modal abierta etiqueta="Zona de peligro" titulo="Borrar toda la base de datos" subtitulo="No se puede deshacer" icono="⚠️" onCerrar={borrando ? () => {} : onCerrar}>
      <form onSubmit={enviar} className="flex flex-col gap-3.5">
        <div className="rounded-xl bg-rose-50 px-3.5 py-3 text-[13px] leading-snug text-rose-800 ring-1 ring-rose-100">
          Se borrarán <b>todas las granjas</b>: cerdas, lotes, bodega, contabilidad, registros de actividad y lo eliminado. Quedará en blanco en la nube y en todos los teléfonos.
          <span className="mt-1.5 block text-rose-700">Se conservan los usuarios, sus PIN y permisos. Exporta un respaldo antes si lo necesitas.</span>
        </div>
        <label className="flex flex-col gap-1.5">
          <span className="text-sm font-medium text-slate-700">Escribe BORRAR para confirmar</span>
          <input value={texto} onChange={(e) => setTexto(e.target.value)} autoCapitalize="characters" autoComplete="off" placeholder="BORRAR" className={`${campo} uppercase`} />
        </label>
        <label className="flex flex-col gap-1.5">
          <span className="text-sm font-medium text-slate-700">Tu PIN de administrador</span>
          <input
            type="password"
            inputMode="numeric"
            autoComplete="off"
            maxLength={4}
            value={pin}
            onChange={(e) => setPin(e.target.value.replace(/\D/g, "").slice(0, 4))}
            placeholder="••••"
            className={`${campo} text-center tracking-[0.5em]`}
          />
        </label>
        {error && <p className="text-sm font-medium text-rose-600">{error}</p>}
        <button
          type="submit"
          disabled={!listo || borrando}
          className="mt-1 w-full rounded-2xl bg-rose-600 py-3 text-base font-semibold text-white shadow-sm active:bg-rose-700 disabled:opacity-40"
        >
          {borrando ? "Borrando…" : "Borrar todo"}
        </button>
      </form>
    </Modal>
  );
}

/* ───────────── Consumo aproximado de las cerdas ───────────── */

function ConsumoCerdasAjuste({ actual, onGuardar }: { actual: ConsumoCerdas; onGuardar: (c: ConsumoCerdas) => void }) {
  const aTexto = (c: ConsumoCerdas) => ({
    gestacion: String(c.gestacion).replace(".", ","),
    preparto: String(c.preparto).replace(".", ","),
    lactancia: String(c.lactancia).replace(".", ","),
    diaCambio: String(c.diaCambio),
  });
  const [valores, setValores] = useState(aTexto(actual));
  const [codigos, setCodigos] = useState({ codigoGestacion: actual.codigoGestacion, codigoLactancia: actual.codigoLactancia });
  const [descontar, setDescontar] = useState(actual.descontarGestacion);
  const [base, setBase] = useState(actual);
  if (base !== actual) {
    setBase(actual);
    setDescontar(actual.descontarGestacion);
    setValores(aTexto(actual));
    setCodigos({ codigoGestacion: actual.codigoGestacion, codigoLactancia: actual.codigoLactancia });
  }

  const catalogo = [
    ...new Map(
      leerProductos()
        .filter((p) => codigoDe(p) && p.activo !== false && p.categoria === "Alimento")
        .sort((a, b) => Number(a.unidad === "kg") - Number(b.unidad === "kg"))
        .map((p) => [codigoDe(p), p.nombre] as const)
        .reverse(),
    ),
  ].sort((a, b) => a[0].localeCompare(b[0], "es", { numeric: true }));

  const num = (t: string) => Number((t || "").replace(",", "."));
  const nueva: ConsumoCerdas = {
    gestacion: num(valores.gestacion),
    preparto: num(valores.preparto),
    lactancia: num(valores.lactancia),
    diaCambio: num(valores.diaCambio),
    ...codigos,
    descontarGestacion: descontar,
    // Al activarlo se empieza a descontar desde hoy (no se cobran días anteriores)
    descuentoDesde: descontar && !actual.descontarGestacion ? hoy() : actual.descuentoDesde,
  };
  const valido =
    [nueva.gestacion, nueva.preparto, nueva.lactancia].every((n) => Number.isFinite(n) && n >= 0 && n <= 50) &&
    Number.isInteger(nueva.diaCambio) && nueva.diaCambio >= 1 && nueva.diaCambio <= 120;
  const sinCambios = (Object.keys(nueva) as (keyof ConsumoCerdas)[]).every((k) => nueva[k] === actual[k]);

  const enviar = async (e: FormEvent) => {
    e.preventDefault();
    if (!valido) return;
    onGuardar(nueva);
    await avisar({ titulo: "Consumo actualizado", mensaje: "Bodega calculará el consumo aproximado de las cerdas con estas reglas." });
  };

  const campoKg = (k: "gestacion" | "preparto" | "lactancia", nombre: string, ayuda: string) => (
    <label className="flex items-center gap-3 px-3.5 py-2">
      <span className="min-w-0 flex-1">
        <span className="block text-sm text-slate-800">{nombre}</span>
        <span className="block text-[11px] text-slate-500">{ayuda}</span>
      </span>
      <input
        type="text"
        inputMode="decimal"
        value={valores[k]}
        onChange={(e) => setValores((v) => ({ ...v, [k]: e.target.value.replace(/[^\d.,]/g, "").slice(0, 5) }))}
        onFocus={(e) => e.target.select()}
        aria-label={`${nombre} en kilos por día`}
        className="h-10 w-16 shrink-0 rounded-lg border border-slate-200 bg-slate-50 px-2 text-right text-base font-semibold tabular-nums text-slate-900 outline-none focus:bg-white focus:ring-2 focus:ring-sky-200"
      />
      <span className="w-12 shrink-0 text-xs text-slate-500">kg/día</span>
    </label>
  );

  const selector = (k: "codigoGestacion" | "codigoLactancia", etiqueta: string) => (
    <label className="flex items-center gap-3 px-3.5 py-2">
      <span className="w-20 shrink-0 text-xs font-medium text-slate-500">{etiqueta}</span>
      <span className="relative min-w-0 flex-1">
        <select
          value={codigos[k]}
          onChange={(e) => setCodigos((c) => ({ ...c, [k]: e.target.value }))}
          className="h-10 w-full appearance-none rounded-xl border border-slate-200 bg-slate-50 pl-3 pr-9 text-sm text-slate-800 outline-none focus:ring-2 focus:ring-sky-200"
        >
          {!catalogo.some(([c]) => c === codigos[k]) && <option value={codigos[k]}>{codigos[k]} · sin producto en bodega</option>}
          {catalogo.map(([c, n]) => (
            <option key={c} value={c}>
              {c} · {n}
            </option>
          ))}
        </select>
        <svg viewBox="0 0 20 20" className="pointer-events-none absolute right-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
          <path d="M5 8l5 5 5-5" />
        </svg>
      </span>
    </label>
  );

  const titulo = "-mb-1 px-1 text-[11px] font-semibold uppercase tracking-wider text-slate-400";
  const caja = "divide-y divide-slate-100 overflow-hidden rounded-2xl bg-white ring-1 ring-slate-100";

  return (
    <form onSubmit={enviar} className="flex flex-col gap-3">
      <p className="text-xs text-slate-500">Es una estimación por cerda al día; Bodega la usa para calcular cuánto alimento se gasta y para cuántos días alcanza.</p>
      <p className={titulo}>Alimento de gestación</p>
      <div className={caja}>
        {selector("codigoGestacion", "Producto")}
        {campoKg("gestacion", "Gestación", "Cerdas en cualquier estado, menos pre-parto y lactancia")}
      </div>
      <p className={titulo}>Alimento de lactancia</p>
      <div className={caja}>
        {selector("codigoLactancia", "Producto")}
        <label className="flex items-center gap-3 px-3.5 py-2">
          <span className="min-w-0 flex-1">
            <span className="block text-sm text-slate-800">Cambio a lactancia</span>
            <span className="block text-[11px] text-slate-500">Día de gestación en que empieza</span>
          </span>
          <input
            type="text"
            inputMode="numeric"
            value={valores.diaCambio}
            onChange={(e) => setValores((v) => ({ ...v, diaCambio: e.target.value.replace(/\D/g, "").slice(0, 3) }))}
            onFocus={(e) => e.target.select()}
            aria-label="Día de gestación para pasar a lactancia"
            className="h-10 w-16 shrink-0 rounded-lg border border-slate-200 bg-slate-50 px-2 text-right text-base font-semibold tabular-nums text-slate-900 outline-none focus:bg-white focus:ring-2 focus:ring-sky-200"
          />
          <span className="w-12 shrink-0 text-xs text-slate-500">día</span>
        </label>
        {campoKg("preparto", "Pre-parto", `Del día ${valores.diaCambio || "—"} al parto`)}
        {campoKg("lactancia", "Lactancia", "Del parto al destete")}
      </div>
      <label className="flex items-center gap-3 rounded-2xl bg-white px-3.5 py-2.5 ring-1 ring-slate-100">
        <span className="min-w-0 flex-1">
          <span className="block text-sm text-slate-800">Descontar de bodega cada día</span>
          <span className="block text-[11px] text-slate-500">Saca sola la salida diaria de gestación y de lactancia</span>
        </span>
        <Interruptor activo={descontar} onCambiar={setDescontar} />
      </label>
      {!valido && <p className="text-sm font-medium text-rose-600">Escribe kilos entre 0 y 50 y un día entre 1 y 120.</p>}
      <div className="grid grid-cols-2 gap-2">
        <Boton
          variante="secundario"
          onClick={() => {
            setValores(aTexto(CONSUMO_CERDAS_POR_DEFECTO));
            setCodigos({ codigoGestacion: CONSUMO_CERDAS_POR_DEFECTO.codigoGestacion, codigoLactancia: CONSUMO_CERDAS_POR_DEFECTO.codigoLactancia });
          }}
        >
          Valores por defecto
        </Boton>
        <Boton type="submit" disabled={!valido || sinCambios}>
          Guardar
        </Boton>
      </div>
    </form>
  );
}

/* ───────────── Consumo de la base de datos en la nube ───────────── */

const LIMITE_GRATIS_MB = 500;
const NOMBRES_COLECCION: Record<string, string> = {
  cerdas: "Cerdas",
  historial: "Registros de cerdas",
  "engorde-lotes": "Lotes de engorde",
  tratamientos: "Tratamientos",
  "contabilidad-movimientos": "Movimientos contables",
  "contabilidad-cuentas-pagar": "Gastos a crédito",
  "monitoreo-lecturas": "Lecturas de monitoreo",
  "bioseguridad-visitas": "Visitas",
  "bodega-productos": "Productos de bodega",
  "bodega-facturas": "Facturas",
  "bodega-salidas": "Salidas de bodega",
  corrales: "Corrales",
  "config-granja": "Configuración",
  ajustes: "Ajustes",
  "bioseguridad-checks": "Checklist de bioseguridad",
  granjas: "Granjas adicionales",
};

const mb = (bytes: number) => bytes / (1024 * 1024);
const fmtMb = (bytes: number) => `${mb(bytes).toLocaleString("es-CO", { maximumFractionDigits: mb(bytes) < 10 ? 2 : 1 })} MB`;
const fmtN = (n: number) => n.toLocaleString("es-CO");

function ConsumoBase() {
  const [datos, setDatos] = useState<ConsumoNube | null>(null);
  const [error, setError] = useState("");
  const [cargando, setCargando] = useState(false);

  const cargar = () => {
    setCargando(true);
    setError("");
    consumoNube()
      .then(setDatos)
      .catch((e) => setError(e instanceof ErrorNube && e.estado === 0 ? "Sin conexión. Se necesita internet para ver el consumo." : "No se pudo leer el consumo."))
      .finally(() => setCargando(false));
  };
  useEffect(cargar, []);

  if (error)
    return (
      <p className="rounded-xl bg-amber-50 px-3 py-2.5 text-sm text-amber-900 ring-1 ring-amber-100">
        {error}{" "}
        <button type="button" onClick={cargar} className="font-semibold text-sky-700">
          Reintentar
        </button>
      </p>
    );
  if (!datos) return <div className="h-32 animate-pulse rounded-2xl bg-slate-100" />;

  const usado = mb(datos.base_bytes);
  const pct = Math.min(100, (usado / LIMITE_GRATIS_MB) * 100);
  const color = pct > 90 ? "bg-red-500" : pct > 75 ? "bg-orange-500" : "bg-sky-600";
  const colecciones = Object.entries(datos.por_coleccion).sort((a, b) => b[1] - a[1]);

  return (
    <div className="flex flex-col gap-3">
      <div className="rounded-2xl bg-white p-3.5 ring-1 ring-slate-100">
        <div className="flex items-baseline justify-between gap-2">
          <p className="text-lg font-bold tabular-nums text-slate-900">
            {fmtMb(datos.base_bytes)} <span className="text-sm font-medium text-slate-500">de {LIMITE_GRATIS_MB} MB</span>
          </p>
          <span className="text-sm font-bold tabular-nums text-sky-700">{pct < 1 ? pct.toFixed(1) : Math.round(pct)} %</span>
        </div>
        <div className="mt-1.5 h-2 overflow-hidden rounded-full bg-slate-100">
          <div className={`h-full rounded-full ${color}`} style={{ width: `${Math.max(pct, 0.8)}%` }} />
        </div>
        <p className="mt-1.5 text-[11px] text-slate-500">
          Incluye unos 10 MB que ocupa la base de datos vacía. Los datos de la granja ocupan {fmtMb(datos.datos_bytes + datos.registro_bytes)}.
        </p>
      </div>

      <div className="grid grid-cols-3 gap-1.5 text-center">
        {[
          { t: "Datos", v: fmtN(datos.documentos) },
          { t: "Registro", v: fmtN(datos.registro) },
          { t: "Usuarios", v: `${datos.usuarios_activos}/${datos.usuarios}` },
        ].map((x) => (
          <div key={x.t} className="rounded-xl bg-white px-2 py-2 ring-1 ring-slate-100">
            <p className="text-[10px] font-medium uppercase tracking-wide text-slate-400">{x.t}</p>
            <p className="text-[15px] font-bold tabular-nums text-slate-900">{x.v}</p>
          </div>
        ))}
      </div>

      {colecciones.length > 0 && (
        <ul className="divide-y divide-slate-100 overflow-hidden rounded-2xl bg-white ring-1 ring-slate-100">
          {colecciones.map(([c, n]) => (
            <li key={c} className="flex items-center justify-between px-3.5 py-2 text-sm">
              <span className="text-slate-700">{NOMBRES_COLECCION[c] ?? c}</span>
              <span className="font-semibold tabular-nums text-slate-900">{fmtN(n)}</span>
            </li>
          ))}
        </ul>
      )}

      <p className="px-1 text-[11px] leading-snug text-slate-500">
        Plan gratuito de Supabase: si la base pasa de 500 MB queda en solo lectura. Último cambio{" "}
        {datos.ultimo_cambio ? new Date(datos.ultimo_cambio.replace(/(\.\d{3})\d+/, "$1")).toLocaleString("es-CO", { dateStyle: "medium", timeStyle: "short" }) : "—"}.
        {datos.borrados ? ` ${fmtN(datos.borrados)} elementos borrados se guardan como marca para que los demás teléfonos también los borren.` : ""}
      </p>
      <Boton variante="secundario" onClick={cargar} disabled={cargando} className="w-full">
        {cargando ? "Actualizando…" : "Actualizar"}
      </Boton>
    </div>
  );
}
