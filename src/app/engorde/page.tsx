"use client";

import { useMemo, useState, type FormEvent } from "react";
import { useRouter } from "next/navigation";
import ModuloPage from "@/components/ModuloPage";
import { Boton, Campo, Chips, Dato, Entrada, IconoMas, SeccionDesplegable, Selector, Vacio } from "@/components/ui";
import {
  diasEntre,
  formatoFecha,
  formatoPesos,
  guardarLotes,
  hoy,
  calcularInventario,
  formatoHora,
  horaActual,
  kgDeCantidad,
  registrarConsumoLote,
  nombreLote,
  siguienteCodigoLote,
  tomarCodigoLote,
  editarConsumoLote,
  eliminarConsumoLote,
  leerCorrales,
  leerProductos,
  codigoDe,
  KG_POR_BULTO,
  leerCerdas,
  leerSalidas,
  leerLotes,
  nuevoId,
  useVersionDatos,
  type Corral,
  type Lote,
} from "@/lib/datos";
import { confirmar } from "@/components/Dialogo";
import DialogoClave from "@/components/DialogoClave";
import Modal from "@/components/Modal";
import { ETAPAS_ALIMENTACION, leerConfig } from "@/lib/config";

/** Indicadores calculados de un lote */
function resumenLote(l: Lote) {
  const fin = l.activo ? hoy() : l.fechaSalida || hoy();
  const dias = Math.max(0, diasEntre(l.fechaIngreso, fin));
  const pesajes = [...l.pesajes].sort((a, b) => b.fecha.localeCompare(a.fecha));
  const pesoActual = pesajes[0]?.pesoPromedio ?? l.pesoInicial;
  const diasAlUltimoPeso = pesajes[0] ? Math.max(1, diasEntre(l.fechaIngreso, pesajes[0].fecha)) : 0;
  const gdp = pesajes[0] && l.pesoInicial ? ((pesoActual - l.pesoInicial) / diasAlUltimoPeso) * 1000 : null;
  const muertes = l.mortalidad.reduce((s, m) => s + (Number(m.cantidad) || 0), 0);
  const mortalidad = l.cantidadInicial ? (muertes / l.cantidadInicial) * 100 : 0;
  const kgAlimento = l.alimento.reduce((s, a) => s + (Number(a.kg) || 0), 0);
  const kgGanados = l.vivos * pesoActual - l.cantidadInicial * l.pesoInicial;
  const conversion = kgAlimento > 0 && kgGanados > 0 ? kgAlimento / kgGanados : null;
  return { dias, pesoActual, gdp, muertes, mortalidad, kgAlimento, conversion };
}

export default function EngordePage() {
  const version = useVersionDatos();
  const [vista, setVista] = useState<"activos" | "cerrados">("activos");
  const [nuevo, setNuevo] = useState(false);
  const [seleccionado, setSeleccionado] = useState<string | null>(null);

  const lotes = useMemo(() => (version < 0 ? null : leerLotes()), [version]);
  const activos = lotes?.filter((l) => l.activo) ?? [];
  const [busqueda, setBusqueda] = useState("");
  // Busca por código o nombre del lote, por la madre (número o nombre) y por el código del parto
  const q = busqueda.trim().toLowerCase();
  const nombresMadres = useMemo(() => (version < 0 ? new Map<string, string>() : new Map(leerCerdas().map((c) => [c.id, c.nombre ?? ""]))), [version]);
  const coincide = (l: Lote) =>
    !q ||
    [l.codigo, l.nombre, l.origen?.cerdaId, l.origen?.codigoParto, l.origen ? nombresMadres.get(l.origen.cerdaId) : ""]
      .filter(Boolean)
      .some((t) => String(t).toLowerCase().includes(q));
  const visibles = (lotes ?? []).filter((l) => (vista === "activos" ? l.activo : !l.activo) && coincide(l));
  const animales = activos.reduce((s, l) => s + l.vivos, 0);
  const lote = lotes?.find((l) => l.id === seleccionado) ?? null;

  return (
    <ModuloPage
      titulo="Engorde"
      subtitulo="Lotes, peso y alimento"
      icono="🐷"
      tono="amber"
      accion={
        <Boton onClick={() => setNuevo(true)} className="px-3.5">
          <IconoMas /> Lote
        </Boton>
      }
    >
      <div className="grid grid-cols-2 gap-2">
        <Dato titulo="Lotes activos" valor={lotes ? activos.length : "–"} />
        <Dato titulo="Animales en engorde" valor={lotes ? animales : "–"} />
      </div>

      <div className="relative">
        <svg viewBox="0 0 24 24" className="pointer-events-none absolute left-3.5 top-1/2 h-[18px] w-[18px] -translate-y-1/2 text-slate-400" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" aria-hidden="true">
          <circle cx="11" cy="11" r="7" />
          <path d="m20 20-3.5-3.5" />
        </svg>
        <input
          type="search"
          value={busqueda}
          onChange={(e) => setBusqueda(e.target.value)}
          placeholder="Buscar lote, nombre o madre"
          aria-label="Buscar lote, nombre o madre"
          className="w-full rounded-2xl bg-slate-100 py-3 pl-10 pr-4 text-base text-slate-900 placeholder:text-slate-400 focus:bg-white focus:outline-none focus:ring-2 focus:ring-sky-600"
        />
      </div>

      <Chips
        opciones={[
          { valor: "activos", texto: "Activos" },
          { valor: "cerrados", texto: "Cerrados" },
        ]}
        valor={vista}
        onChange={setVista}
      />

      {lotes === null ? (
        <div className="h-40 animate-pulse rounded-3xl bg-slate-100" />
      ) : visibles.length === 0 ? (
        <Vacio
          titulo={q ? "Ningún lote coincide" : vista === "activos" ? "No hay lotes activos" : "No hay lotes cerrados"}
          texto={q ? `No hay lotes ${vista} con “${busqueda.trim()}”. Prueba con el código (LP-03), el nombre o el número de la madre.` : "Crea un lote cuando ingresen lechones a engorde para seguir su peso, mortalidad y alimento."}
          accion={!q && vista === "activos" ? <Boton onClick={() => setNuevo(true)}>Crear lote</Boton> : undefined}
        />
      ) : (
        <ul className="flex flex-col gap-2.5">
          {visibles.map((l) => {
            const r = resumenLote(l);
            return (
              <li key={l.id}>
                <button
                  type="button"
                  onClick={() => setSeleccionado(l.id)}
                  className="w-full rounded-3xl bg-white p-4 text-left ring-1 ring-slate-200/80 transition hover:shadow-md active:scale-[0.99]"
                >
                  <div className="flex items-center justify-between gap-2">
                    <div className="flex min-w-0 items-center gap-2">
                      {l.codigo && (
                        <span className="shrink-0 rounded-lg bg-amber-100 px-2 py-0.5 text-xs font-bold tabular-nums text-amber-900">{l.codigo}</span>
                      )}
                      <div className="min-w-0">
                      {l.nombre && l.nombre !== l.codigo && <p className="truncate font-semibold text-slate-900">{l.nombre}</p>}
                      {l.origen && (
                        <p className="truncate text-xs text-slate-500">🐖 De la cerda {l.origen.cerdaId} · parto automático</p>
                      )}
                      </div>
                    </div>
                    <span className="shrink-0 text-right text-xs leading-tight text-slate-500">
                      <span className="block text-[10px] uppercase tracking-wide text-slate-400">{l.origen ? "Edad" : "En el lote"}</span>
                      <span className="font-semibold tabular-nums text-slate-700">
                        {textoEdad(edadMesesDias(l.fechaIngreso, l.activo ? hoy() : l.fechaSalida || hoy()))}
                      </span>
                    </span>
                  </div>
                  <div className="mt-3 grid grid-cols-3 gap-2 text-center">
                    <Mini titulo="Animales" valor={`${l.vivos}/${l.cantidadInicial}`} />
                    <Mini titulo="Peso prom." valor={r.pesoActual ? `${r.pesoActual.toFixed(1)} kg` : "–"} />
                    <Mini titulo="Ganancia" valor={r.gdp !== null ? `${Math.round(r.gdp)} g/d` : "–"} />
                  </div>
                  <BarraConsumo lote={l} />
                </button>
              </li>
            );
          })}
        </ul>
      )}

      <NuevoLote abierta={nuevo} onCerrar={() => setNuevo(false)} />
      {lote && <DetalleLote lote={lote} onCerrar={() => setSeleccionado(null)} />}
    </ModuloPage>
  );
}

/** Línea del consumo establecido general, para la tarjeta del lote en la lista */
function BarraConsumo({ lote }: { lote: Lote }) {
  const c = consumoEstablecido(lote);
  if (c.estandar <= 0) return null;
  const total = (c.consumido / c.estandar) * 100;
  const color = colorAvance(total);
  return (
    <div className="mt-3">
      <div className="mb-1 flex items-baseline justify-between gap-2 text-[11px]">
        <span className="font-medium uppercase tracking-wide text-slate-400">Consumo establecido</span>
        <span className="tabular-nums text-slate-500">
          {fmtNumBultos(c.consumido)} de {fmtBultos(c.estandar)} · <b className={`font-bold ${color.texto}`}>{Math.floor(total).toLocaleString("es-CO")} %</b>
        </span>
      </div>
      <div className="h-1.5 overflow-hidden rounded-full bg-slate-100">
        <div className={`h-full rounded-full ${color.barra}`} style={{ width: `${Math.min(100, total)}%` }} />
      </div>
    </div>
  );
}

/** Dato pequeño para la ficha del lote (3 por fila) */
function DatoCompacto({ titulo, valor, detalle }: { titulo: string; valor: string; detalle?: string }) {
  return (
    <div className="min-w-0 rounded-xl bg-white px-2.5 py-2 ring-1 ring-slate-200">
      <p className="truncate text-[10px] font-medium uppercase tracking-wide text-slate-400">{titulo}</p>
      <p className="truncate text-[15px] font-bold leading-tight tabular-nums text-slate-900">{valor}</p>
      {detalle && <p className="truncate text-[10px] text-slate-500">{detalle}</p>}
    </div>
  );
}

function Mini({ titulo, valor }: { titulo: string; valor: string }) {
  return (
    <div className="rounded-xl bg-amber-50/70 px-2 py-2">
      <p className="text-[10px] font-medium uppercase tracking-wide text-amber-900/70">{titulo}</p>
      <p className="text-sm font-semibold text-slate-900 tabular-nums">{valor}</p>
    </div>
  );
}

/**
 * Consumo establecido del lote: los kilos estándar de cada etapa son por
 * lechón, así que se multiplican por los animales vivos. Lo consumido de cada
 * etapa sale de los registros de alimento cuyo producto tiene un código unido
 * a esa etapa en Ajustes → Alimentación estándar.
 */
function consumoEstablecido(l: Lote) {
  const config = leerConfig();
  const codigoPorProducto = new Map(leerProductos().map((p) => [p.id, codigoDe(p)]));
  const etapas = ETAPAS_ALIMENTACION.map(({ clave, nombre }) => {
    const codigos = config.productosEtapa[clave];
    const porAnimal = config.alimentacion[clave];
    const estandar = porAnimal * l.vivos;
    const consumido = l.alimento.reduce((s, a) => {
      const codigo = a.productoId ? codigoPorProducto.get(a.productoId) : "";
      return codigo && codigos.includes(codigo) ? s + (Number(a.kg) || 0) : s;
    }, 0);
    return { clave, nombre, porAnimal, estandar, consumido, faltan: Math.max(0, estandar - consumido), sinProductos: codigos.length === 0 };
  });
  const enEtapas = etapas.reduce((s, e) => s + e.consumido, 0);
  const totalConsumido = l.alimento.reduce((s, a) => s + (Number(a.kg) || 0), 0);
  // Etapa actual: la primera que aún no completa su estándar
  const actual = etapas.find((e) => e.estandar > 0 && e.consumido < e.estandar)?.clave ?? null;
  return {
    etapas,
    actual,
    estandar: etapas.reduce((s, e) => s + e.estandar, 0),
    consumido: enEtapas,
    sinEtapa: Math.max(0, totalConsumido - enEtapas),
  };
}

/** Bultos de 40 kg, con un decimal */
const bultos = (kg: number) => kg / KG_POR_BULTO;
const fmtBultos = (kg: number) => {
  const b = Math.round(bultos(kg) * 10) / 10;
  return `${b.toLocaleString("es-CO", { maximumFractionDigits: 1 })} ${b === 1 ? "bulto" : "bultos"}`;
};
const fmtNumBultos = (kg: number) => (Math.round(bultos(kg) * 10) / 10).toLocaleString("es-CO", { maximumFractionDigits: 1 });

/** Color según el avance: azul hasta 100 %, naranja hasta 115 %, rojo por encima */
function colorAvance(porcentaje: number) {
  if (porcentaje > 115) return { barra: "bg-red-500", texto: "text-red-600" };
  if (porcentaje > 100) return { barra: "bg-orange-500", texto: "text-orange-600" };
  return { barra: "bg-sky-600", texto: "text-sky-700" };
}

function ConsumoEstablecido({ lote }: { lote: Lote }) {
  const [verEtapas, setVerEtapas] = useState(false);
  const c = consumoEstablecido(lote);
  if (c.estandar <= 0) return null;
  // El porcentaje sigue subiendo después del 100 %; la barra se llena hasta el tope
  const pct = (a: number, b: number) => (b > 0 ? (a / b) * 100 : 0);
  const total = pct(c.consumido, c.estandar);
  const colorTotal = colorAvance(total);
  const exceso = c.consumido - c.estandar;
  return (
    <section className="rounded-xl bg-white px-3 py-2.5 ring-1 ring-slate-200">
      <div className="flex items-baseline justify-between gap-2">
        <p className="whitespace-nowrap text-[11px] font-semibold uppercase tracking-wider text-slate-400">Consumo establecido</p>
        <p className="truncate text-[11px] text-slate-500">{lote.vivos} animales · bulto {KG_POR_BULTO} kg</p>
      </div>
      <p className="mt-0.5 text-base font-bold tabular-nums text-slate-900">
        {fmtNumBultos(c.consumido)} <span className="text-sm font-medium text-slate-500">de {fmtBultos(c.estandar)}</span>
      </p>
      <div className="mt-1.5 flex items-center gap-2.5">
        <div className="h-2 min-w-0 flex-1 overflow-hidden rounded-full bg-slate-100">
          <div className={`h-full rounded-full ${colorTotal.barra}`} style={{ width: `${Math.min(100, total)}%` }} />
        </div>
        <span className={`shrink-0 text-sm font-bold tabular-nums ${colorTotal.texto}`}>{Math.floor(total).toLocaleString("es-CO")} %</span>
      </div>
      <p className={`mt-1 text-xs ${exceso > 0 ? colorTotal.texto : "text-slate-500"}`}>
        {exceso > 0
          ? `${fmtBultos(exceso)} por encima del total`
          : total >= 100
            ? "Consumo total completo"
            : `Completado del total · faltan ${fmtBultos(c.estandar - c.consumido)}`}
      </p>

      <button
        type="button"
        onClick={() => setVerEtapas((v) => !v)}
        aria-expanded={verEtapas}
        className="mt-2 flex w-full items-center gap-2 rounded-lg bg-slate-50 px-3 py-2 text-left active:bg-slate-100"
      >
        <span className="min-w-0 flex-1 text-sm font-semibold text-slate-800">Alimento por etapa</span>
        {c.actual && !verEtapas && (
          <span className="shrink-0 truncate text-xs text-slate-500">Actual: {c.etapas.find((e) => e.clave === c.actual)?.nombre}</span>
        )}
        <svg viewBox="0 0 20 20" className={`h-4 w-4 shrink-0 text-slate-400 transition-transform ${verEtapas ? "rotate-180" : ""}`} fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
          <path d="M5 8l5 5 5-5" />
        </svg>
      </button>

      {verEtapas && (
      <ul className="mt-2 flex flex-col gap-2.5">
        {c.etapas.map((e) => {
          const actual = e.clave === c.actual;
          const avance = pct(e.consumido, e.estandar);
          const color = colorAvance(avance);
          const completa = e.estandar > 0 && avance >= 100;
          const sobra = e.consumido - e.estandar;
          return (
            <li key={e.clave} className={`rounded-xl px-3 py-2.5 ${actual ? "bg-sky-50 ring-1 ring-sky-100" : "bg-slate-50"}`}>
              <div className="flex items-center gap-2">
                <span className={`min-w-0 flex-1 truncate text-sm font-semibold ${actual ? "text-sky-900" : "text-slate-800"}`}>{e.nombre}</span>
                {actual && <span className="shrink-0 rounded-full bg-sky-700 px-2 py-0.5 text-[10px] font-semibold text-white">Actual</span>}
                <span className={`shrink-0 text-xs font-bold tabular-nums ${color.texto}`}>{Math.floor(avance).toLocaleString("es-CO")} %</span>
              </div>
              <p className="mt-0.5 text-xs text-slate-500">
                Estándar <b className="font-semibold text-slate-700">{fmtBultos(e.estandar)}</b> para {lote.vivos} animales
              </p>
              <div className="mt-1.5 h-1.5 overflow-hidden rounded-full bg-slate-200/70">
                <div className={`h-full rounded-full ${color.barra}`} style={{ width: `${Math.min(100, avance)}%` }} />
              </div>
              <p className="mt-1 flex justify-between gap-2 text-xs tabular-nums">
                <span className="text-slate-600">Consumido {fmtBultos(e.consumido)}</span>
                <span className={sobra > 0 ? `font-semibold ${color.texto}` : "text-slate-600"}>
                  {sobra > 0 ? `+${fmtBultos(sobra)} de más` : completa ? "✓ Completa" : `Faltan ${fmtBultos(e.faltan)}`}
                </span>
              </p>
              {e.sinProductos && <p className="mt-1 text-[11px] text-amber-700">Sin productos unidos en Ajustes → Alimentación estándar</p>}
            </li>
          );
        })}
      </ul>
      )}
      {c.sinEtapa > 0 && (
        <p className="mt-2 text-xs text-slate-500">{fmtBultos(c.sinEtapa)} registrados con productos que no están unidos a ninguna etapa.</p>
      )}
    </section>
  );
}

/** Edad entre dos fechas (AAAA-MM-DD) en meses y días de calendario */
function edadMesesDias(desde: string, hasta: string): { meses: number; dias: number } {
  const [a1, m1, d1] = desde.split("-").map(Number);
  const [a2, m2, d2] = hasta.split("-").map(Number);
  if (!a1 || !a2 || hasta < desde) return { meses: 0, dias: 0 };
  let meses = (a2 - a1) * 12 + (m2 - m1);
  let dias = d2 - d1;
  if (dias < 0) {
    meses -= 1;
    // días del mes anterior a la fecha final
    dias += new Date(a2, m2 - 1, 0).getDate();
  }
  return { meses: Math.max(0, meses), dias: Math.max(0, dias) };
}

function textoEdad({ meses, dias }: { meses: number; dias: number }) {
  const m = `${meses} ${meses === 1 ? "mes" : "meses"}`;
  const d = `${dias} ${dias === 1 ? "día" : "días"}`;
  return meses > 0 ? `${m} y ${d}` : d;
}

const fmtCantidad = (n: number) => n.toLocaleString("es-CO", { maximumFractionDigits: 2 });

function actualizarLote(id: string, cambio: (l: Lote) => Lote) {
  guardarLotes(leerLotes().map((l) => (l.id === id ? cambio(l) : l)));
}

function NuevoLote({ abierta, onCerrar }: { abierta: boolean; onCerrar: () => void }) {
  const [nombre, setNombre] = useState("");
  const [fecha, setFecha] = useState(hoy());
  const [cantidad, setCantidad] = useState("");
  const [peso, setPeso] = useState("");

  const guardar = (e: FormEvent) => {
    e.preventDefault();
    const n = Number(cantidad) || 0;
    if (n <= 0) return;
    const codigo = tomarCodigoLote();
    guardarLotes([
      ...leerLotes(),
      {
        id: nuevoId(),
        codigo,
        nombre: nombre.trim() || codigo,
        fechaIngreso: fecha,
        cantidadInicial: n,
        vivos: n,
        pesoInicial: Number(peso) || 0,
        pesajes: [],
        mortalidad: [],
        alimento: [],
        activo: true,
      },
    ]);
    setNombre("");
    setCantidad("");
    setPeso("");
    onCerrar();
  };

  return (
    <Modal abierta={abierta} etiqueta="Engorde" titulo="Nuevo lote" subtitulo="Lote de engorde" icono="🐖" onCerrar={onCerrar}>
      <form onSubmit={guardar} className="flex flex-col gap-3.5">
        {abierta && (
          <div className="flex items-center justify-between rounded-xl bg-amber-50 px-3.5 py-2.5 ring-1 ring-amber-100">
            <span className="text-sm text-amber-900/80">Código del lote</span>
            <span className="text-base font-bold tabular-nums text-amber-900">{siguienteCodigoLote()}</span>
          </div>
        )}
        <Campo etiqueta="Nombre del lote (opcional)">
          <Entrada value={nombre} onChange={setNombre} placeholder="Ej. Corral 3 – octubre" />
        </Campo>
        <Campo etiqueta="Fecha de ingreso">
          <Entrada type="date" value={fecha} onChange={setFecha} required />
        </Campo>
        <div className="grid grid-cols-2 gap-3">
          <Campo etiqueta="Cantidad de animales *">
            <Entrada type="number" inputMode="numeric" min={1} value={cantidad} onChange={setCantidad} required />
          </Campo>
          <Campo etiqueta="Peso promedio (kg)">
            <Entrada type="number" inputMode="decimal" min={0} step="any" value={peso} onChange={setPeso} />
          </Campo>
        </div>
        <Boton type="submit" className="mt-1 w-full py-3">
          Crear lote
        </Boton>
      </form>
    </Modal>
  );
}

type Accion = "resumen" | "pesaje" | "muerte" | "alimento" | "editarAlimento" | "corral";

const ICONOS_ACCION: Record<Accion, string> = { resumen: "🐖", pesaje: "⚖️", muerte: "⚠️", alimento: "🥣", editarAlimento: "✏️", corral: "🏚️" };

/** Espacio que muestra el corral guardado del lote */
function TarjetaCorral({ corral, onCambiar }: { corral?: Corral; onCambiar?: () => void }) {
  if (!corral) {
    return (
      <div className="flex items-center gap-3 rounded-xl border border-dashed border-slate-300 bg-slate-50 px-3 py-2">
        <div className="min-w-0 flex-1">
          <p className="text-[11px] font-semibold uppercase tracking-wider text-slate-400">Corral</p>
          <p className="text-sm font-medium text-slate-600">Sin corral asignado</p>
        </div>
        {onCambiar && (
          <button type="button" onClick={onCambiar} className="shrink-0 rounded-full bg-sky-900 px-3 py-1.5 text-xs font-semibold text-white active:scale-95">
            Elegir
          </button>
        )}
      </div>
    );
  }
  return (
    <div className="flex items-center gap-3 rounded-xl bg-sky-50 px-3 py-2 ring-1 ring-sky-100">
      <span className="flex h-9 min-w-[3.25rem] shrink-0 items-center justify-center rounded-lg bg-white px-2 text-sm font-bold tabular-nums text-sky-800 ring-1 ring-sky-200">
        {corral.codigo}
      </span>
      <div className="min-w-0 flex-1">
        <p className="text-[11px] font-semibold uppercase tracking-wider text-sky-700/80">Corral</p>
        <p className="truncate text-sm font-semibold text-slate-900">
          {corral.zona}
          {corral.capacidad ? ` · capacidad ${corral.capacidad}` : ""}
        </p>
        {corral.nota && <p className="truncate text-xs text-slate-500">{corral.nota}</p>}
      </div>
      {onCambiar && (
        <button type="button" onClick={onCambiar} className="shrink-0 rounded-full px-2.5 py-1 text-xs font-semibold text-sky-700 active:bg-sky-100">
          Cambiar
        </button>
      )}
    </div>
  );
}

function DetalleLote({ lote, onCerrar }: { lote: Lote; onCerrar: () => void }) {
  const [accion, setAccion] = useState<Accion>("resumen");
  const [fecha, setFecha] = useState(hoy());
  const [hora, setHora] = useState(horaActual());
  const [valor, setValor] = useState("");
  const [extra, setExtra] = useState("");
  const [productoId, setProductoId] = useState("");
  const [corralSel, setCorralSel] = useState(lote.corralId ?? "");
  const [editIdx, setEditIdx] = useState<number | null>(null);
  const registroEdit = accion === "editarAlimento" && editIdx !== null ? lote.alimento[editIdx] : undefined;
  const esAlimento = accion === "alimento" || accion === "editarAlimento";
  // Registro antiguo sin producto de bodega: solo se corrigen fecha, hora y kilos
  const legado = accion === "editarAlimento" && !registroEdit?.productoId;
  const r = resumenLote(lote);
  const router = useRouter();
  const madre = lote.origen ? leerCerdas().find((c) => c.id === lote.origen?.cerdaId) : undefined;
  const fechaFin = lote.activo ? hoy() : lote.fechaSalida || hoy();
  const edad = edadMesesDias(lote.fechaIngreso, fechaFin);
  const corrales = leerCorrales().sort((a, b) => a.codigo.localeCompare(b.codigo, "es", { numeric: true }));
  const corral = corrales.find((c) => c.id === lote.corralId);
  // Productos de bodega: los que tienen existencia primero; sin existencia aparecen desactivados
  // Al editar, lo que ya se había descontado con este registro cuenta como disponible
  const inventario = esAlimento && !legado ? calcularInventario({ excluirSalida: registroEdit?.salidaId }) : [];
  const productos = [...inventario].sort(
    (a, b) =>
      Number(b.disponible > 0) - Number(a.disponible > 0) ||
      Number(b.producto.categoria === "Alimento") - Number(a.producto.categoria === "Alimento") ||
      a.producto.nombre.localeCompare(b.producto.nombre, "es"),
  );
  const elegido = productos.find((p) => p.producto.id === productoId);
  const cantidadNum = Number(valor.replace(",", ".")) || 0;
  // Ajuste oculto: permite usar productos sin existencia (el inventario queda negativo)
  const sinLimite = esAlimento && leerConfig().permitirSinInventario;
  const excede = !!elegido && !sinLimite && cantidadNum > elegido.disponible;
  const kgDe = (cantidad: number, unidad: string) => kgDeCantidad(cantidad, unidad, elegido?.producto.kgPorUnidad);

  const limpiar = () => {
    setValor("");
    setExtra("");
    setProductoId("");
    setFecha(hoy());
    setHora(horaActual());
    setCorralSel(lote.corralId ?? "");
    setEditIdx(null);
    setAccion("resumen");
  };

  const abrirEdicion = (i: number) => {
    const a = lote.alimento[i];
    if (!a) return;
    setEditIdx(i);
    setProductoId(a.productoId ?? "");
    setValor(String(a.productoId ? (a.cantidad ?? "") : a.kg));
    setFecha(a.fecha);
    setHora(a.hora ?? horaActual());
    setAccion("editarAlimento");
  };

  const borrarRegistro = async () => {
    if (editIdx === null) return;
    const ok = await confirmar({
      titulo: "Eliminar registro de alimento",
      mensaje: registroEdit?.salidaId
        ? "Se borrará el consumo del lote y la cantidad volverá a la bodega."
        : "Se borrará este consumo del lote.",
      aceptar: "Eliminar",
      destructivo: true,
    });
    if (!ok) return;
    eliminarConsumoLote(lote.id, editIdx);
    limpiar();
  };

  const guardar = (e: FormEvent) => {
    e.preventDefault();
    if (accion === "corral") {
      if (!corralSel) return;
      actualizarLote(lote.id, (l) => ({ ...l, corralId: corralSel }));
      limpiar();
      setCorralSel(corralSel);
      return;
    }
    const n = Number(valor.replace(",", ".")) || 0;
    if (n <= 0) return;
    if (accion === "pesaje") {
      actualizarLote(lote.id, (l) => ({ ...l, pesajes: [...l.pesajes, { fecha, pesoPromedio: n }] }));
    } else if (accion === "muerte") {
      const cantidad = Math.min(n, lote.vivos);
      actualizarLote(lote.id, (l) => ({
        ...l,
        vivos: Math.max(0, l.vivos - cantidad),
        mortalidad: [...l.mortalidad, { fecha, cantidad, causa: extra.trim() || undefined }],
      }));
    } else if (accion === "alimento") {
      // Se descuenta de la bodega: queda como salida del producto elegido
      const actual = calcularInventario().find((p) => p.producto.id === productoId);
      const libre = leerConfig().permitirSinInventario;
      if (!actual || (!libre && (actual.disponible <= 0 || n > actual.disponible))) return;
      registrarConsumoLote({ loteId: lote.id, productoId: actual.producto.id, cantidad: n, fecha, hora });
    } else if (accion === "editarAlimento" && editIdx !== null) {
      if (legado) {
        editarConsumoLote(lote.id, editIdx, { cantidad: n, fecha, hora });
      } else {
        const actual = calcularInventario({ excluirSalida: registroEdit?.salidaId }).find((p) => p.producto.id === productoId);
        const libre = leerConfig().permitirSinInventario;
        if (!actual || (!libre && n > actual.disponible)) return;
        editarConsumoLote(lote.id, editIdx, { productoId: actual.producto.id, cantidad: n, fecha, hora });
      }
    }
    limpiar();
  };

  const cerrarLote = async () => {
    if (!(await confirmar({ titulo: `Cerrar ${nombreLote(lote)}`, mensaje: "El lote pasará a la lista de lotes cerrados. Puedes reabrirlo después.", aceptar: "Cerrar lote" }))) return;
    actualizarLote(lote.id, (l) => ({ ...l, activo: false, fechaSalida: hoy() }));
    onCerrar();
  };
  const reabrir = () => actualizarLote(lote.id, (l) => ({ ...l, activo: true, fechaSalida: undefined }));
  const [pedirClave, setPedirClave] = useState(false);
  const eliminar = async () => {
    if (!(await confirmar({ titulo: `Eliminar ${nombreLote(lote)}`, mensaje: "Se borrarán el lote y todos sus pesajes, alimento y mortalidad.", aceptar: "Eliminar", destructivo: true }))) return;
    guardarLotes(leerLotes().filter((l) => l.id !== lote.id));
    onCerrar();
  };

  const titulos: Record<Accion, string> = {
    resumen: nombreLote(lote),
    pesaje: "Registrar pesaje",
    muerte: "Registrar muerte",
    alimento: "Registrar alimento",
    editarAlimento: "Editar alimento",
    corral: "Corral del lote",
  };

  return (
    <>
    <Modal
      abierta
      etiqueta={accion === "resumen" ? "Lote de engorde" : nombreLote(lote)}
      titulo={titulos[accion]}
      subtitulo={accion === "resumen" ? `${lote.vivos} animales · ${lote.activo ? "activo" : "cerrado"}` : undefined}
      icono={ICONOS_ACCION[accion]}
      onCerrar={accion === "resumen" ? onCerrar : limpiar}
    >
      {accion === "resumen" ? (
        <div className="flex flex-col gap-4">
          <TarjetaCorral corral={corral} onCambiar={lote.activo ? () => setAccion("corral") : undefined} />
          <div className={`grid gap-1.5 ${lote.origen ? "grid-cols-2" : "grid-cols-1"}`}>
            {lote.origen && (
              <button
                type="button"
                onClick={() => router.push(`/cerda/${encodeURIComponent(lote.origen!.cerdaId)}`)}
                className="min-w-0 rounded-xl bg-white px-3 py-2 text-left ring-1 ring-slate-200 active:bg-slate-50"
              >
                <p className="text-[11px] font-semibold uppercase tracking-wider text-slate-400">Madre</p>
                <p className="truncate text-base font-bold text-slate-900">
                  {lote.origen.cerdaId} <span className="text-sky-700">›</span>
                </p>
                <p className="truncate text-xs text-slate-500">
                  {madre?.nombre ? `${madre.nombre} · ` : ""}parto {lote.origen.codigoParto}
                </p>
              </button>
            )}
            <div className="min-w-0 rounded-xl bg-white px-3 py-2 ring-1 ring-slate-200">
              <p className="text-[11px] font-semibold uppercase tracking-wider text-slate-400">
                {lote.origen ? "Edad" : "Tiempo en el lote"}
              </p>
              <p className="text-base font-bold tabular-nums text-slate-900">{textoEdad(edad)}</p>
              <p className="truncate text-xs text-slate-500">
                {lote.origen ? "Nació" : "Ingresó"} el {formatoFecha(lote.fechaIngreso, true)}
                {!lote.activo && lote.fechaSalida ? ` · cerrado el ${formatoFecha(lote.fechaSalida, true)}` : ""}
              </p>
            </div>
          </div>
          <div className="grid grid-cols-3 gap-1.5">
            <DatoCompacto titulo="Vivos" valor={`${lote.vivos}/${lote.cantidadInicial}`} />
            <DatoCompacto titulo="Mortalidad" valor={`${r.mortalidad.toFixed(1)} %`} detalle={`${r.muertes} muertes`} />
            <DatoCompacto
              titulo="Peso prom."
              valor={r.pesoActual ? `${r.pesoActual.toFixed(1)} kg` : "–"}
              detalle={lote.pesoInicial ? `inició ${lote.pesoInicial} kg` : undefined}
            />
            <DatoCompacto titulo="Ganancia" valor={r.gdp !== null ? `${Math.round(r.gdp)} g` : "–"} detalle="por día" />
            <DatoCompacto titulo="Alimento" valor={`${Math.round(r.kgAlimento)} kg`} />
            <DatoCompacto titulo="Conversión" valor={r.conversion !== null ? r.conversion.toFixed(2) : "–"} detalle="kg/kg" />
          </div>

          <ConsumoEstablecido lote={lote} />

          {lote.activo && (
            <div className="flex flex-col gap-2">
              <Boton onClick={() => setAccion("alimento")} disabled={!corral} className="w-full py-3">
                Registrar alimento
              </Boton>
              <div className="grid grid-cols-3 gap-2">
                <Boton variante="suave" onClick={() => setAccion("corral")} className={corral ? "" : "ring-2 ring-sky-600"}>
                  <span className="truncate">{corral ? corral.codigo : "Corral"}</span>
                </Boton>
                <Boton variante="suave" onClick={() => setAccion("pesaje")} disabled={!corral}>Pesaje</Boton>
                <Boton variante="suave" onClick={() => setAccion("muerte")} disabled={!corral}>Muerte</Boton>
              </div>
            </div>
          )}

          {(lote.pesajes.length > 0 || lote.mortalidad.length > 0 || lote.alimento.length > 0) && (
            <SeccionDesplegable titulo="Registros" cantidad={lote.pesajes.length + lote.mortalidad.length + lote.alimento.length}>
              <ul className="flex flex-col gap-1.5 text-sm">
                {[
                  ...lote.pesajes.map((p) => ({ f: p.fecha, h: "", t: `Pesaje: ${p.pesoPromedio} kg promedio`, i: -1 })),
                  ...lote.alimento.map((a, i) => ({
                    i,
                    f: a.fecha,
                    h: a.hora ?? "",
                    t: a.producto
                      ? `Alimento: ${fmtCantidad(a.cantidad ?? 0)} ${a.unidad ?? ""} ${a.producto}${a.kg ? ` (${fmtCantidad(a.kg)} kg)` : ""}`
                      : `Alimento: ${a.kg} kg${a.costo ? ` · ${formatoPesos(a.costo)}` : ""}`,
                  })),
                  ...lote.mortalidad.map((m) => ({ f: m.fecha, h: "", t: `Muerte: ${m.cantidad}${m.causa ? ` · ${m.causa}` : ""}`, i: -1 })),
                ]
                  .sort((a, b) => b.f.localeCompare(a.f) || b.h.localeCompare(a.h))
                  .map((x, k) => {
                    const contenido = (
                      <>
                        <span className="min-w-0 flex-1 text-slate-700">{x.t}</span>
                        <span className="shrink-0 text-right text-xs leading-tight text-slate-500">
                          {formatoFecha(x.f)}
                          {x.h && <span className="block text-[10px]">{formatoHora(x.h)}</span>}
                        </span>
                      </>
                    );
                    return (
                      <li key={k}>
                        {x.i >= 0 ? (
                          <button
                            type="button"
                            onClick={() => abrirEdicion(x.i)}
                            aria-label={`Editar o eliminar: ${x.t}`}
                            className="flex w-full items-center gap-3 rounded-xl bg-slate-50 px-3 py-2 text-left active:bg-slate-100"
                          >
                            {contenido}
                            <svg viewBox="0 0 20 20" className="h-4 w-4 shrink-0 text-slate-400" fill="none" stroke="currentColor" strokeWidth={1.8} aria-hidden="true">
                              <path d="M13.5 3.5l3 3L7 16H4v-3l9.5-9.5z" strokeLinejoin="round" />
                            </svg>
                          </button>
                        ) : (
                          <div className="flex justify-between gap-3 rounded-xl bg-slate-50 px-3 py-2">{contenido}</div>
                        )}
                      </li>
                    );
                  })}
              </ul>
            </SeccionDesplegable>
          )}

          <div className="flex flex-wrap justify-center gap-2 pt-1">
            {lote.activo ? (
              <Boton variante="secundario" onClick={cerrarLote} disabled={!corral}>Cerrar lote (venta)</Boton>
            ) : (
              <Boton variante="secundario" onClick={reabrir}>Reabrir lote</Boton>
            )}
            <Boton variante="suave" onClick={() => (leerConfig().claveLotesActiva ? setPedirClave(true) : void eliminar())} disabled={!corral} className="text-rose-600">Eliminar</Boton>
          </div>
        </div>
      ) : (
        <form onSubmit={guardar} className="flex flex-col gap-3.5">
          {accion === "corral" ? (
            corrales.length === 0 ? (
              <p className="rounded-xl bg-amber-50 px-3 py-2.5 text-sm text-amber-900 ring-1 ring-amber-100">
                Aún no hay corrales. Créalos en Ajustes → Ajustes avanzados → Corrales.
              </p>
            ) : (
              <Campo etiqueta="Corral">
                <Selector
                  value={corralSel}
                  onChange={setCorralSel}
                  opciones={[
                    { valor: "", texto: "Selecciona un corral" },
                    ...corrales.map((c) => ({ valor: c.id, texto: `${c.codigo} · ${c.zona}${c.capacidad ? ` · cap. ${c.capacidad}` : ""}` })),
                  ]}
                />
              </Campo>

            )
          ) : esAlimento ? (
            <div className="grid grid-cols-2 gap-3">
              <Campo etiqueta="Fecha">
                <Entrada type="date" value={fecha} onChange={setFecha} required />
              </Campo>
              <Campo etiqueta="Hora">
                <Entrada type="time" value={hora} onChange={setHora} required />
              </Campo>
            </div>
          ) : (
          <Campo etiqueta="Fecha">
            <Entrada type="date" value={fecha} onChange={setFecha} required />
          </Campo>
          )}
          {accion === "pesaje" && (
            <Campo etiqueta="Peso promedio por animal (kg)">
              <Entrada type="number" inputMode="decimal" min={0} step="any" value={valor} onChange={setValor} required />
            </Campo>
          )}
          {accion === "muerte" && (
            <>
              <Campo etiqueta="Cantidad de animales">
                <Entrada type="number" inputMode="numeric" min={1} value={valor} onChange={setValor} required />
              </Campo>
              <Campo etiqueta="Causa">
                <Entrada value={extra} onChange={setExtra} placeholder="Opcional" />
              </Campo>
            </>
          )}
          {legado && (
            <Campo etiqueta="Kilos de alimento">
              <Entrada type="number" inputMode="decimal" min={0} step="any" value={valor} onChange={setValor} required />
            </Campo>
          )}
          {esAlimento && !legado &&
            (productos.length === 0 ? (
              <p className="rounded-xl bg-amber-50 px-3 py-2.5 text-sm text-amber-900 ring-1 ring-amber-100">
                No hay productos en bodega. Créalos en Ajustes avanzados y carga una factura en Bodega.
              </p>
            ) : (
              <>
                <Campo etiqueta="Producto de bodega">
                  <Selector
                    value={productoId}
                    onChange={(v) => {
                      setProductoId(v);
                      setValor("");
                    }}
                    opciones={[
                      { valor: "", texto: "Selecciona un producto" },
                      ...productos.map((p) => ({
                        valor: p.producto.id,
                        texto: `${p.producto.nombre} · ${p.disponible > 0 ? `hay ${fmtCantidad(p.disponible)} ${p.producto.unidad}` : "sin existencia"}`,
                        deshabilitado: !sinLimite && p.disponible <= 0,
                      })),
                    ]}
                  />
                </Campo>
                <Campo etiqueta={elegido ? `Cantidad (${elegido.producto.unidad})` : "Cantidad"}>
                  <Entrada
                    type="number"
                    inputMode="decimal"
                    min={0}
                    step="any"
                    value={valor}
                    onChange={setValor}
                    placeholder={elegido ? (sinLimite ? "Cantidad" : `Máximo ${fmtCantidad(elegido.disponible)}`) : "Primero elige el producto"}
                    required
                  />
                </Campo>
                {excede && elegido && (
                  <p className="text-sm font-medium text-rose-600">
                    Solo hay {fmtCantidad(elegido.disponible)} {elegido.producto.unidad} en bodega.
                  </p>
                )}
                {elegido && cantidadNum > 0 && !excede && (
                  <p className="text-xs text-slate-500">
                    Quedarán {fmtCantidad(elegido.disponible - cantidadNum)} {elegido.producto.unidad} en bodega
                    {kgDe(cantidadNum, elegido.producto.unidad) ? ` · ${fmtCantidad(kgDe(cantidadNum, elegido.producto.unidad))} kg para el lote` : ""}.
                  </p>
                )}
              </>
            ))}
          <div className="mt-1 grid grid-cols-2 gap-2">
            <Boton variante="secundario" onClick={limpiar}>Cancelar</Boton>
            <Boton
              type="submit"
              disabled={
                (accion === "corral" && (!corralSel || corrales.length === 0)) ||
                (esAlimento && !legado && (!elegido || cantidadNum <= 0 || excede)) ||
                (legado && cantidadNum <= 0)
              }
            >
              Guardar
            </Boton>
          </div>
          {accion === "editarAlimento" && (
            <Boton variante="suave" onClick={borrarRegistro} className="w-full text-rose-600">
              Eliminar registro
            </Boton>
          )}
        </form>
      )}
    </Modal>
          <DialogoClave
            abierto={pedirClave}
            titulo="Clave de lotes"
            mensaje={`Ingresa la clave para eliminar ${nombreLote(lote)}.`}
            longitud={3}
            aceptar="Continuar"
            onValidar={(codigo) => {
              if (codigo !== leerConfig().claveLotes) return false;
              setPedirClave(false);
              void eliminar();
              return true;
            }}
            onCerrar={() => setPedirClave(false)}
          />
    </>
  );
}
