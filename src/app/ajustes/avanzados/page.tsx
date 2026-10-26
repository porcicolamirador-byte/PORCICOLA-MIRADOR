"use client";

import { useEffect, useState, type FormEvent, type ReactNode } from "react";
import { useRouter } from "next/navigation";
import ModuloPage from "@/components/ModuloPage";
import { Boton, Interruptor } from "@/components/ui";
import { avisar, confirmar } from "@/components/Dialogo";
import { ajustesDesbloqueados, bloquearAjustes } from "@/lib/acceso";
import {
  ALIMENTACION_POR_DEFECTO,
  CONFIG_POR_DEFECTO,
  ETAPAS_ALIMENTACION,
  guardarConfig,
  leerConfig,
  type AlimentacionEstandar,
  type ConfigGranja,
  type ProductosEtapa,
} from "@/lib/config";
import { clavesDeLaApp, codigoDe, leerCorrales, leerProductos, notificarCambio, useVersionDatos } from "@/lib/datos";
import CatalogoProductos from "@/components/CatalogoProductos";
import CatalogoCorrales from "@/components/CatalogoCorrales";
import { activarFaceId, desactivarFaceId, faceIdActivo, faceIdDisponible } from "@/lib/faceid";

/**
 * Sección oculta de ajustes: solo se abre después de ingresar el código
 * en Ajustes. Sin código válido, regresa a Ajustes.
 */
export default function AjustesAvanzadosPage() {
  const router = useRouter();
  const [permitido, setPermitido] = useState<boolean | null>(null);
  const [config, setConfig] = useState<ConfigGranja>(CONFIG_POR_DEFECTO);
  const [abierto, setAbierto] = useState<string | null>(null);
  const alternar = (id: string) => setAbierto((a) => (a === id ? null : id));
  const version = useVersionDatos();
  const productos = version < 0 ? 0 : leerProductos().length;
  const corrales = version < 0 ? 0 : leerCorrales().length;
  const [faceId, setFaceId] = useState<{ disponible: boolean; activo: boolean; ofrecer: boolean }>({ disponible: false, activo: false, ofrecer: false });

  useEffect(() => {
    faceIdDisponible().then((disponible) => {
      setFaceId({ disponible, activo: faceIdActivo(), ofrecer: disponible && !faceIdActivo() });
    });
  }, []);

  const noOfrecerMas = () => {
    setFaceId((f) => ({ ...f, ofrecer: false }));
  };

  // Se llama directamente desde el toque: el iPhone muestra Face ID
  const encenderFaceId = () => {
    activarFaceId().then(async (ok) => {
      if (ok) {
        noOfrecerMas();
        setFaceId((f) => ({ ...f, activo: true }));
        await avisar({ titulo: "Face ID activado", mensaje: "La próxima vez entrarás a los ajustes con tu rostro. El código sigue funcionando." });
      } else {
        await avisar({ titulo: "No se activó Face ID", mensaje: "Se canceló o el teléfono no lo permitió. Puedes seguir entrando con el código." });
      }
    });
  };

  const apagarFaceId = async () => {
    if (!(await confirmar({ titulo: "Desactivar Face ID", mensaje: "Para entrar a los ajustes se pedirá solo el código.", aceptar: "Desactivar" }))) return;
    desactivarFaceId();
    setFaceId((f) => ({ ...f, activo: false }));
  };

  useEffect(() => {
    const ok = ajustesDesbloqueados();
    setPermitido(ok);
    if (ok) setConfig(leerConfig());
    else router.replace("/ajustes");
  }, [router]);

  const borrarTodo = async () => {
    if (!(await confirmar({ titulo: "Borrar todos los datos", mensaje: "Se borrará toda la información de la granja guardada en este dispositivo.", aceptar: "Continuar", destructivo: true }))) return;
    if (!(await confirmar({ titulo: "¿Estás seguro?", mensaje: "Esta acción no se puede deshacer. Te recomendamos exportar un respaldo antes desde Ajustes.", aceptar: "Borrar todo", destructivo: true }))) return;
    for (const k of clavesDeLaApp()) localStorage.removeItem(k);
    notificarCambio();
    setConfig(leerConfig());
    await avisar({ titulo: "Datos borrados", mensaje: "Se borró la información de la granja en este teléfono." });
  };

  const bloquear = () => {
    bloquearAjustes();
    router.replace("/ajustes");
  };

  const guardar = (cambios: Partial<ConfigGranja>) => {
    setConfig(guardarConfig(cambios));
    notificarCambio(); // las tareas del dashboard se recalculan con el nuevo rango
  };

  if (!permitido) {
    return (
      <ModuloPage titulo="Ajustes" subtitulo="Sección protegida" icono="🔒" tono="slate" volverA="/ajustes">
        <div className="h-40 animate-pulse rounded-3xl bg-slate-100" />
      </ModuloPage>
    );
  }

  return (
    <ModuloPage
      titulo="Ajustes avanzados"
      subtitulo="Sección protegida con código"
      icono="🔓"
      tono="slate"
      volverA="/ajustes"
      accion={
        <Boton variante="secundario" onClick={bloquear} className="px-3.5">
          Bloquear
        </Boton>
      }
    >
      {faceId.ofrecer && (
        <div className="rounded-2xl bg-sky-50 p-4 ring-1 ring-sky-100">
          <p className="text-[15px] font-semibold text-sky-950">¿Entrar con Face ID la próxima vez?</p>
          <p className="mt-0.5 text-xs text-sky-900/80">Así no tendrás que escribir el código cada vez. Si Face ID falla, se pedirá el código.</p>
          <div className="mt-3 grid grid-cols-2 gap-2">
            <Boton variante="secundario" onClick={noOfrecerMas}>
              Ahora no
            </Boton>
            <Boton onClick={encenderFaceId}>Activar Face ID</Boton>
          </div>
        </div>
      )}

      <Grupo titulo="Acceso">
        <li>
          <label className={`flex w-full items-center gap-3 px-4 py-3 ${faceId.disponible ? "cursor-pointer" : "opacity-50"}`}>
            <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-slate-100 text-base" aria-hidden="true">
              🙂
            </span>
            <span className="min-w-0 flex-1">
              <span className="block text-[15px] font-medium text-slate-900">Entrar con Face ID</span>
              <span className="block text-xs text-slate-500">
                {!faceId.disponible ? "No disponible en este teléfono" : faceId.activo ? "Activado en este teléfono" : "Desactivado: se pide el código"}
              </span>
            </span>
            {faceId.disponible && (
              <Interruptor activo={faceId.activo} onCambiar={(v) => (v ? encenderFaceId() : apagarFaceId())} />
            )}
          </label>
        </li>
      </Grupo>

      <Grupo titulo="Claves">
        <Desplegable icono="🔐" titulo="Clave de ajustes" resumen={config.claveAjustesActiva ? "Activa" : "Solo la primera vez"} abierto={abierto === "ajustes"} onAlternar={() => alternar("ajustes")}>
          <ActivarClave
            activa={config.claveAjustesActiva}
            donde="al entrar a los ajustes protegidos"
            textoDesactivada="Desactivada: solo se pide la primera vez en este teléfono"
            onCambiar={(v) => guardar({ claveAjustesActiva: v })}
          />
          <CambiarClave
            titulo="Clave de ajustes"
            descripcion="Es el código que se pide para abrir esta sección."
            icono="🔐"
            actual={config.claveAjustes}
            onGuardar={(clave) => guardar({ claveAjustes: clave })}
          />
        </Desplegable>
        <Desplegable icono="🗑️" titulo="Clave de eliminación" resumen={config.claveEliminarActiva ? "Activa" : "Desactivada"} abierto={abierto === "eliminar"} onAlternar={() => alternar("eliminar")}>
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
        <Desplegable icono="🧾" titulo="Clave de facturas" resumen={config.claveFacturasActiva ? "Activa" : "Desactivada"} abierto={abierto === "facturas"} onAlternar={() => alternar("facturas")}>
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
        <Desplegable icono="🐷" titulo="Clave de lotes" resumen={config.claveLotesActiva ? "Activa" : "Desactivada"} abierto={abierto === "lotes"} onAlternar={() => alternar("lotes")}>
          <ActivarClave
            activa={config.claveLotesActiva}
            donde="Engorde al eliminar un lote"
            onCambiar={(v) => guardar({ claveLotesActiva: v })}
          />
          <CambiarClave
            titulo="Clave de lotes"
            descripcion="Se pide en Engorde para eliminar un lote. Tiene 3 números."
            icono="🐷"
            longitud={3}
            actual={config.claveLotes}
            onGuardar={(clave) => guardar({ claveLotes: clave })}
          />
        </Desplegable>
      </Grupo>

      <Grupo titulo="Granja">
        <Desplegable
          icono="🍼"
          titulo="Días de destete"
          resumen={`${config.desteteMin} a ${config.desteteMax} d`}
          abierto={abierto === "destete"}
          onAlternar={() => alternar("destete")}
        >
          <DiasDestete min={config.desteteMin} max={config.desteteMax} onGuardar={(min, max) => guardar({ desteteMin: min, desteteMax: max })} />
        </Desplegable>
        <Desplegable
          icono="🏠"
          titulo="Parideras"
          resumen={config.parideras ? String(config.parideras) : "Sin definir"}
          abierto={abierto === "parideras"}
          onAlternar={() => alternar("parideras")}
        >
          <Parideras actual={config.parideras} onGuardar={(n) => guardar({ parideras: n })} />
        </Desplegable>
        <Desplegable
          icono="🥣"
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
          icono="🏚️"
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
            <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-slate-100 text-base" aria-hidden="true">
              📉
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
        <Desplegable icono="📦" titulo="Productos de bodega" resumen={`${productos}`} abierto={abierto === "productos"} onAlternar={() => alternar("productos")}>
          <CatalogoProductos incrustado />
        </Desplegable>
      </Grupo>

      <Grupo titulo="Datos">
        <li>
          <button type="button" onClick={borrarTodo} className="flex w-full items-center gap-3 px-4 py-3 text-left active:bg-rose-50">
            <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-rose-50 text-base" aria-hidden="true">
              🗑️
            </span>
            <span className="min-w-0 flex-1">
              <span className="block text-[15px] font-medium text-rose-600">Borrar todos los datos</span>
              <span className="block text-xs text-slate-500">Toda la información de la granja en este teléfono</span>
            </span>
          </button>
        </li>
      </Grupo>

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
function Desplegable({
  icono,
  titulo,
  resumen,
  abierto,
  onAlternar,
  children,
}: {
  icono: string;
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
        <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-slate-100 text-base" aria-hidden="true">
          {icono}
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

