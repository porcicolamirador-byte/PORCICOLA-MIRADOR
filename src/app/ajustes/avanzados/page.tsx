"use client";

import { useEffect, useState, type FormEvent, type ReactNode } from "react";
import { useRouter } from "next/navigation";
import ModuloPage from "@/components/ModuloPage";
import { Boton } from "@/components/ui";
import { avisar, confirmar } from "@/components/Dialogo";
import { ajustesDesbloqueados, bloquearAjustes } from "@/lib/acceso";
import { CONFIG_POR_DEFECTO, guardarConfig, leerConfig, type ConfigGranja } from "@/lib/config";
import { leerProductos, notificarCambio, useVersionDatos } from "@/lib/datos";
import CatalogoProductos from "@/components/CatalogoProductos";

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

  useEffect(() => {
    const ok = ajustesDesbloqueados();
    setPermitido(ok);
    if (ok) setConfig(leerConfig());
    else router.replace("/ajustes");
  }, [router]);

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
      <Grupo titulo="Claves">
        <Desplegable icono="🔐" titulo="Clave de ajustes" resumen="4 dígitos" abierto={abierto === "ajustes"} onAlternar={() => alternar("ajustes")}>
          <CambiarClave
            titulo="Clave de ajustes"
            descripcion="Es el código que se pide para abrir esta sección."
            icono="🔐"
            actual={config.claveAjustes}
            onGuardar={(clave) => guardar({ claveAjustes: clave })}
          />
        </Desplegable>
        <Desplegable icono="🗑️" titulo="Clave de eliminación" resumen="Gestación" abierto={abierto === "eliminar"} onAlternar={() => alternar("eliminar")}>
          <CambiarClave
            titulo="Clave de eliminación"
            descripcion="Se pide en Gestación para eliminar una cerda."
            icono="🗑️"
            actual={config.claveEliminar}
            onGuardar={(clave) => guardar({ claveEliminar: clave })}
          />
        </Desplegable>
        <Desplegable icono="🧾" titulo="Clave de facturas" resumen="Bodega" abierto={abierto === "facturas"} onAlternar={() => alternar("facturas")}>
          <CambiarClave
            titulo="Clave de facturas"
            descripcion="Se pide en Bodega para cargar una factura."
            icono="🧾"
            actual={config.claveFacturas}
            onGuardar={(clave) => guardar({ claveFacturas: clave })}
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
      </Grupo>

      <Grupo titulo="Bodega">
        <Desplegable icono="📦" titulo="Productos de bodega" resumen={`${productos}`} abierto={abierto === "productos"} onAlternar={() => alternar("productos")}>
          <CatalogoProductos incrustado />
        </Desplegable>
      </Grupo>

      <p className="px-1 text-center text-[11px] text-slate-400">
        La sección se cierra sola a los 15 minutos o al cerrar la app.
      </p>
    </ModuloPage>
  );
}

/* ───────────────────────── Componentes ───────────────────────── */

const claseCampo =
  "h-11 w-full rounded-xl border border-slate-200 bg-slate-50 px-3 text-center text-xl tracking-[0.5em] text-slate-900 outline-none placeholder:text-slate-300 placeholder:tracking-[0.5em] focus:bg-white focus:ring-2 focus:ring-emerald-200";

function Encabezado({ descripcion }: { icono?: string; titulo?: string; descripcion: string }) {
  return <p className="mb-3 text-xs leading-relaxed text-slate-500">{descripcion}</p>;
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

function CambiarClave({
  titulo,
  descripcion,
  icono,
  actual,
  onGuardar,
}: {
  titulo: string;
  descripcion: string;
  icono: string;
  actual: string;
  onGuardar: (clave: string) => void;
}) {
  const [claveActual, setClaveActual] = useState("");
  const [nueva, setNueva] = useState("");
  const [repetir, setRepetir] = useState("");
  const [error, setError] = useState("");

  const solo4 = (v: string) => v.replace(/\D/g, "").slice(0, 4);

  const enviar = async (e: FormEvent) => {
    e.preventDefault();
    if (claveActual !== actual) return setError("La clave actual no es correcta.");
    if (!/^\d{4}$/.test(nueva)) return setError("La nueva clave debe tener 4 números.");
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
            placeholder="••••"
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
              placeholder="••••"
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
              placeholder="••••"
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
    "h-12 w-full rounded-xl border border-slate-200 bg-slate-50 px-3 text-center text-xl font-semibold text-slate-900 outline-none focus:bg-white focus:ring-2 focus:ring-emerald-200";

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
        <p className="rounded-xl bg-emerald-50 px-3 py-2 text-sm text-emerald-900 ring-1 ring-emerald-100">
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
            className="h-12 w-full min-w-0 rounded-xl border border-slate-200 bg-slate-50 px-3 text-center text-xl font-semibold text-slate-900 outline-none focus:bg-white focus:ring-2 focus:ring-emerald-200"
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
