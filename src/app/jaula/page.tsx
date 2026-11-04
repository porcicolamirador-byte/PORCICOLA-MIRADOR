"use client";

/*
 * Jaula: mapa de las jaulas de la granja para saber dónde está cada cerda.
 *  - Área gestación: 2 filas de 17 jaulas (G-01 … G-34)
 *  - Área lactancia: 2 filas de 5 parideras (L-01 … L-10), cuadros más grandes
 * La jaula queda guardada en la ficha de la cerda (campo "Jaula").
 */

import { useEffect, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import ModuloPage from "@/components/ModuloPage";
import Modal from "@/components/Modal";
import SelectorApp from "@/components/SelectorApp";
import { Boton } from "@/components/ui";
import { JAULAS_POR_DEFECTO, type ConfigJaulas } from "@/lib/config";
import { leerFormaJaulas } from "@/lib/jaulas";
import { estadoDeCerda, guardarCerdas, leerCerdas, leerHistorial, notificarCambio, useVersionDatos } from "@/lib/datos";
import { CLAVE_JAULAS, granjaActual, leerGranjas, nombreGranjaActual } from "@/lib/sincronizar";
import { guardarConRegistro } from "@/lib/log";

type Area = "gestacion" | "lactancia";

type ConfigArea = { titulo: string; prefijo: string; porFila: number; filas: number; descripcion: string };
/** Áreas según Ajustes ocultos → Jaulas (por defecto 2 × 17 y 2 × 5) */
const areasDe = (j: ConfigJaulas): Record<Area, ConfigArea> => ({
  gestacion: {
    titulo: "Área gestación",
    prefijo: "G",
    porFila: j.gestacion.porFila,
    filas: j.gestacion.filas,
    descripcion: `${j.gestacion.filas} ${j.gestacion.filas === 1 ? "fila" : "filas"} de ${j.gestacion.porFila} jaulas`,
  },
  lactancia: {
    titulo: "Área lactancia",
    prefijo: "L",
    porFila: j.lactancia.porFila,
    filas: j.lactancia.filas,
    descripcion: `${j.lactancia.filas} ${j.lactancia.filas === 1 ? "fila" : "filas"} de ${j.lactancia.porFila} parideras`,
  },
});

/** Ocupante de una jaula (de esta granja o de otra) */
type Ocupante = { c: { id: string; jaula?: unknown }; estado: string; granja: string; granjaNombre: string; propia: boolean };
/** Entrada del mapa común: id = código de la jaula */
interface EntradaMapa {
  id: string;
  cerdaId: string;
  granja: string;
  granjaNombre: string;
  estado: string;
  fecha: string;
}
function leerMapa(): EntradaMapa[] {
  try {
    const v = JSON.parse(localStorage.getItem(CLAVE_JAULAS) || "[]");
    return Array.isArray(v) ? v.filter((e) => e && typeof e.id === "string" && typeof e.cerdaId === "string") : [];
  } catch {
    return [];
  }
}
const guardarMapa = (m: EntradaMapa[]) => {
  // Se conserva el elemento de configuración (cantidad de jaulas)
  let extra: unknown[] = [];
  try {
    const v = JSON.parse(localStorage.getItem(CLAVE_JAULAS) || "[]");
    extra = Array.isArray(v) ? v.filter((e) => e && e.id === "_config") : [];
  } catch {}
  guardarConRegistro(CLAVE_JAULAS, [...m, ...extra]);
};
const entradaMapa = (jaula: string, cerdaId: string, granja: string, estado: string): EntradaMapa => ({
  id: jaula,
  cerdaId,
  granja,
  granjaNombre: leerGranjas().find((g) => g.id === granja)?.nombre ?? granja,
  estado,
  fecha: new Date().toISOString(),
});

const codigoJaula = (prefijo: string, n: number) => `${prefijo}-${String(n).padStart(2, "0")}`;

const COLOR_ESTADO: Record<string, string> = {
  Gestación: "bg-sky-500",
  Lactancia: "bg-pink-500",
  "En tratamiento": "bg-rose-500",
  Vacía: "bg-amber-500",
};

export default function JaulaPage() {
  const router = useRouter();
  const version = useVersionDatos();
  const [area, setArea] = useState<Area | null>("gestacion");
  const [jaulaSel, setJaulaSel] = useState<string | null>(null);
  const [elegida, setElegida] = useState("");
  const [trasladando, setTrasladando] = useState(false);
  const toque = useRef<{ x: number; y: number } | null>(null);
  const [masOpciones, setMasOpciones] = useState(false);
  const [verSinJaula, setVerSinJaula] = useState(false);
  // Desde la ficha de una cerda: ?cerda=ID (&area=…&jaula=…) abre su jaula para cambiarla
  const [cerdaOrigen, setCerdaOrigen] = useState("");
  useEffect(() => {
    const q = new URLSearchParams(window.location.search);
    const a = q.get("area");
    const j = q.get("jaula");
    setCerdaOrigen(q.get("cerda") ?? "");
    if (a === "gestacion" || a === "lactancia") {
      setArea(a);
      if (j) setJaulaSel(j.toUpperCase());
    }
  }, []);

  const AREAS = useMemo(() => areasDe(version >= 0 ? leerFormaJaulas() : JAULAS_POR_DEFECTO), [version]);
  const datos = useMemo(() => {
    if (version < 0) return null;
    const granja = granjaActual();
    const cerdas = leerCerdas()
      .map((c) => ({ c, estado: estadoDeCerda(leerHistorial(c.id)) as string, granja, granjaNombre: nombreGranjaActual(), propia: true }))
      .filter((x) => x.estado !== "Fuera del hato");
    const mapa = leerMapa();
    const propias = new Map(cerdas.map((x) => [x.c.id, x]));
    // El mapa es común a todas las granjas: las cerdas de otras granjas se muestran con lo guardado al ubicarlas
    const porJaula = new Map<string, Ocupante>();
    const jaulaDe = new Map<string, string>();
    for (const e of mapa) {
      if (e.granja === granja) {
        const x = propias.get(e.cerdaId);
        if (!x) continue; // cerda eliminada o dada de baja: la jaula queda libre
        porJaula.set(e.id, x);
        jaulaDe.set(e.cerdaId, e.id);
      } else {
        porJaula.set(e.id, { c: { id: e.cerdaId }, estado: e.estado || "", granja: e.granja, granjaNombre: e.granjaNombre || "otra granja", propia: false });
      }
    }
    return { cerdas, porJaula, jaulaDe, granja };
  }, [version]);

  // Una sola vez por cambio: pasa al mapa común las jaulas que ya tenían las cerdas en su ficha,
  // y quita del mapa las cerdas de esta granja que ya no están
  useEffect(() => {
    if (!datos) return;
    const mapa = leerMapa();
    const granja = datos.granja;
    const ids = new Set(datos.cerdas.map((x) => x.c.id));
    let cambio = false;
    let nuevo = mapa.filter((e) => {
      const queda = e.granja !== granja || ids.has(e.cerdaId);
      if (!queda) cambio = true;
      return queda;
    });
    for (const x of datos.cerdas) {
      const j = String(x.c.jaula ?? "").trim().toUpperCase();
      if (!j || !/^[GL]-\d{2}$/.test(j)) continue;
      if (nuevo.some((e) => e.granja === granja && e.cerdaId === x.c.id)) continue;
      if (nuevo.some((e) => e.id === j)) continue;
      nuevo = [...nuevo, entradaMapa(j, x.c.id, granja, x.estado)];
      cambio = true;
    }
    if (cambio) guardarMapa(nuevo);
  }, [datos]);

  // Cerdas activas de esta granja sin una jaula válida de gestación o lactancia
  const codigosValidos = new Set(
    (Object.keys(AREAS) as Area[]).flatMap((a) => Array.from({ length: AREAS[a].porFila * AREAS[a].filas }, (_, i) => codigoJaula(AREAS[a].prefijo, i + 1)))
  );
  const sinJaula = (datos?.cerdas ?? [])
    .filter((x) => !codigosValidos.has(datos?.jaulaDe.get(x.c.id) ?? ""))
    .sort((a, b) => String(a.c.id).localeCompare(String(b.c.id), "es", { numeric: true }));

  const conteo = (a: Area) => {
    const cfg = AREAS[a];
    let ocupadas = 0;
    for (let n = 1; n <= cfg.porFila * cfg.filas; n++) if (datos?.porJaula.has(codigoJaula(cfg.prefijo, n))) ocupadas++;
    return { ocupadas, total: cfg.porFila * cfg.filas };
  };

  /**
   * Ubica una cerda en la jaula (una cerda por jaula: si estaba en otra, se mueve).
   * cerdaId null = desocupar. "granjaCerda" permite mover una cerda de otra granja.
   */
  const asignar = (jaula: string, cerdaId: string | null, granjaCerda = granjaActual()) => {
    const granja = granjaActual();
    const anterior = leerMapa().find((e) => e.id === jaula);
    let mapa = leerMapa().filter((e) => e.id !== jaula && !(cerdaId && e.granja === granjaCerda && e.cerdaId === cerdaId));
    if (cerdaId) {
      const propia = granjaCerda === granja;
      const estado = propia ? datos?.cerdas.find((x) => x.c.id === cerdaId)?.estado ?? "" : (leerMapa().find((e) => e.cerdaId === cerdaId && e.granja === granjaCerda)?.estado ?? "");
      const e = entradaMapa(jaula, cerdaId, granjaCerda, estado);
      if (!propia) e.granjaNombre = leerMapa().find((x) => x.cerdaId === cerdaId && x.granja === granjaCerda)?.granjaNombre ?? e.granjaNombre;
      mapa = [...mapa, e];
    }
    guardarMapa(mapa);
    // En la ficha de las cerdas de esta granja también queda la jaula
    const fichas = leerCerdas();
    let cambia = false;
    const nuevas = fichas.map((c) => {
      const actual = String(c.jaula ?? "").trim().toUpperCase();
      if (cerdaId && granjaCerda === granja && c.id === cerdaId) {
        if (actual !== jaula) cambia = true;
        return { ...c, jaula };
      }
      if (actual === jaula || (!cerdaId && anterior?.granja === granja && c.id === anterior.cerdaId)) {
        if (actual) cambia = true;
        return { ...c, jaula: "" };
      }
      return c;
    });
    if (cambia) guardarCerdas(nuevas);
    else notificarCambio();
    // La cerda que se estaba ubicando ya quedó en su jaula
    if (cerdaId && cerdaId === cerdaOrigen) setCerdaOrigen("");
  };

  const abrirJaula = (codigo: string) => {
    setJaulaSel(codigo);
    setTrasladando(false);
    setMasOpciones(false);
    // Si vino desde una cerda sin esta jaula, queda elegida para ubicarla aquí
    setElegida(cerdaOrigen && datos?.porJaula.get(codigo)?.c.id !== cerdaOrigen ? cerdaOrigen : "");
  };

  const ocupante = jaulaSel ? datos?.porJaula.get(jaulaSel) : undefined;

  // Pantalla inicial: los dos módulos
  if (!area) {
    return (
      <ModuloPage titulo="Jaula" subtitulo="Ubicación de las cerdas" tono="sky">
        {cerdaOrigen && (
          <div className="flex items-center justify-between gap-2 rounded-2xl bg-amber-50 px-3.5 py-2.5 text-sm text-amber-900 ring-1 ring-amber-200">
            <span className="min-w-0">Ubicando la cerda <b className="arete-id">{cerdaOrigen}</b>: {area ? "toca la jaula donde va" : "elige el área"}.</span>
            <button type="button" onClick={() => setCerdaOrigen("")} className="shrink-0 text-xs font-semibold text-sky-700">
              Cancelar
            </button>
          </div>
        )}
        <div className="grid grid-cols-2 gap-3">
          {(Object.keys(AREAS) as Area[]).map((a) => {
            const cfg = AREAS[a];
            const c = conteo(a);
            return (
              <button
                key={a}
                type="button"
                onClick={() => setArea(a)}
                className="flex flex-col items-start gap-3 rounded-3xl bg-white p-4 text-left ring-1 ring-slate-200/80 transition active:scale-[0.98]"
              >
                <span className={`flex h-11 w-11 items-center justify-center rounded-2xl ${a === "gestacion" ? "bg-sky-100 text-sky-800" : "bg-pink-100 text-pink-700"}`} aria-hidden="true">
                  <svg viewBox="0 0 24 24" className="h-6 w-6" fill="none" stroke="currentColor" strokeWidth={1.8} strokeLinecap="round" strokeLinejoin="round">
                    <rect x="3" y="5" width="18" height="14" rx="2" />
                    <path d="M9 5v14M15 5v14M3 12h18" />
                  </svg>
                </span>
                <span>
                  <span className="block text-[15px] font-bold text-slate-900">{cfg.titulo}</span>
                  <span className="block text-xs text-slate-500">{cfg.descripcion}</span>
                </span>
                <span className="text-xs font-semibold tabular-nums text-slate-600">
                  {datos ? `${c.ocupadas} de ${c.total} ocupadas` : "–"}
                </span>
              </button>
            );
          })}
        </div>
        <p className="px-1 text-xs leading-snug text-slate-500">
          Toca un área y luego una jaula para ubicar una cerda. La jaula también queda en la ficha de cada cerda.
        </p>
      </ModuloPage>
    );
  }

  const cfg = AREAS[area];
  const grande = area === "lactancia";
  const c = conteo(area);
  // Cerdas que se pueden ubicar: primero las que no tienen jaula
  const opciones = (datos?.cerdas ?? [])
    .filter((x) => x.c.id !== ocupante?.c.id)
    .sort((a, b) => Number(datos?.jaulaDe.has(a.c.id)) - Number(datos?.jaulaDe.has(b.c.id)) || String(a.c.id).localeCompare(String(b.c.id), "es", { numeric: true }))
    .map((x) => ({ valor: x.c.id, texto: `${x.c.id} · ${x.estado}${datos?.jaulaDe.get(x.c.id) ? ` · en ${datos?.jaulaDe.get(x.c.id)}` : ""}` }));

  return (
    <ModuloPage titulo={cfg.titulo} subtitulo={`${c.ocupadas} de ${c.total} ocupadas`} tono="sky">
      {/* Cambiar de área tocando aquí o deslizando la pantalla hacia el lado */}
      <div className="grid grid-cols-2 gap-1 rounded-2xl bg-slate-100 p-1" role="tablist">
        {(Object.keys(AREAS) as Area[]).map((a) => (
          <button
            key={a}
            type="button"
            role="tab"
            aria-selected={area === a}
            onClick={() => setArea(a)}
            className={`rounded-xl py-2 text-sm font-semibold transition ${area === a ? "bg-white text-slate-900 shadow-sm" : "text-slate-500"}`}
          >
            {AREAS[a].titulo.replace("Área ", "")}
          </button>
        ))}
      </div>
      {/* Cerdas sin jaula: línea discreta que se despliega con sus ID */}
      {sinJaula.length > 0 && (
        <div className="rounded-2xl bg-white ring-1 ring-slate-200/80">
          <button
            type="button"
            onClick={() => setVerSinJaula((v) => !v)}
            aria-expanded={verSinJaula}
            className="flex w-full items-center justify-between gap-2 px-3.5 py-2 text-left text-xs text-slate-500 active:opacity-70"
          >
            <span>
              <b className="font-semibold text-amber-600 tabular-nums">{sinJaula.length}</b> {sinJaula.length === 1 ? "cerda sin jaula asignada" : "cerdas sin jaula asignada"}
            </span>
            <svg viewBox="0 0 20 20" className={`h-3.5 w-3.5 shrink-0 text-slate-400 transition-transform ${verSinJaula ? "rotate-180" : ""}`} fill="none" stroke="currentColor" strokeWidth={2.2} strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
              <path d="M5 8l5 5 5-5" />
            </svg>
          </button>
          {verSinJaula && (
            <div className="flex flex-wrap gap-1.5 border-t border-slate-100 px-3.5 py-2.5">
              {sinJaula.map((x) => (
                <button
                  key={x.c.id}
                  type="button"
                  onClick={() => {
                    // Queda elegida: al tocar una jaula libre ya viene lista para ubicarla
                    setCerdaOrigen(x.c.id);
                    setVerSinJaula(false);
                  }}
                  className="arete-id rounded-lg bg-amber-100 px-2 py-1 text-xs font-black tabular-nums text-amber-950 ring-1 ring-amber-300 active:scale-95"
                >
                  {x.c.id}
                </button>
              ))}
              <p className="w-full pt-1 text-[11px] text-slate-400">Toca una para ubicarla y luego elige la jaula.</p>
            </div>
          )}
        </div>
      )}
      {cerdaOrigen && (
        <div className="flex items-center justify-between gap-2 rounded-2xl bg-amber-50 px-3.5 py-2.5 text-sm text-amber-900 ring-1 ring-amber-200">
          <span className="min-w-0">Ubicando la cerda <b className="arete-id">{cerdaOrigen}</b>: {area ? "toca la jaula donde va" : "elige el área"}.</span>
          <button type="button" onClick={() => setCerdaOrigen("")} className="shrink-0 text-xs font-semibold text-sky-700">
            Cancelar
          </button>
        </div>
      )}

      {/* Leyenda de estados */}
      <div className="flex flex-wrap gap-x-3 gap-y-1 px-1 text-[11px] text-slate-500">
        {Object.entries(COLOR_ESTADO).map(([t, col]) => (
          <span key={t} className="inline-flex items-center gap-1">
            <span className={`h-2 w-2 rounded-full ${col}`} aria-hidden="true" />
            {t}
          </span>
        ))}
      </div>

      {/* Las filas van una al lado de la otra (como el pasillo de la granja) */}
      <div
        className="grid gap-3"
        style={{ gridTemplateColumns: `repeat(${cfg.filas}, minmax(0, 1fr))` }}
        onTouchStart={(e) => {
          const t = e.touches[0];
          toque.current = { x: t.clientX, y: t.clientY };
        }}
        onTouchEnd={(e) => {
          const ini = toque.current;
          toque.current = null;
          if (!ini) return;
          const t = e.changedTouches[0];
          const dx = t.clientX - ini.x;
          const dy = t.clientY - ini.y;
          // Deslizar claramente hacia el lado (no al hacer scroll)
          if (Math.abs(dx) < 60 || Math.abs(dx) < Math.abs(dy) * 1.5) return;
          setArea(dx < 0 ? "lactancia" : "gestacion");
        }}
      >
        {Array.from({ length: cfg.filas }, (_, f) => (
          <section key={f} className="rounded-3xl bg-white p-2.5 ring-1 ring-slate-200/80">
            <p className="mb-2 text-center text-[11px] font-bold uppercase tracking-[0.14em] text-slate-500">Fila {f + 1}</p>
            <ul className="flex flex-col gap-1.5">
              {Array.from({ length: cfg.porFila }, (_, i) => {
                const numero = f * cfg.porFila + i + 1;
                const codigo = codigoJaula(cfg.prefijo, numero);
                const x = datos?.porJaula.get(codigo);
                const color = x ? COLOR_ESTADO[x.estado] ?? "bg-slate-400" : "";
                return (
                  <li key={codigo}>
                    <button
                      type="button"
                      onClick={() => abrirJaula(codigo)}
                      className={`flex w-full items-center gap-2 rounded-xl px-2.5 text-left transition active:scale-[0.98] ${grande ? "h-20" : "h-10"} ${
                        x ? "bg-amber-50 ring-1 ring-amber-200" : "border border-dashed border-slate-200 bg-slate-50"
                      }`}
                    >
                      <span className={`shrink-0 font-bold tabular-nums text-slate-400 ${grande ? "text-xs" : "text-[10px]"}`}>{codigo}</span>
                      {x ? (
                        <span className="flex min-w-0 flex-1 items-center justify-end gap-1.5">
                          <span className={`arete-id truncate font-black tabular-nums text-amber-950 ${grande ? "text-xl" : "text-sm"}`}>{x.c.id}</span>
                          <span className={`h-2 w-2 shrink-0 rounded-full ${color}`} aria-label={x.estado} />
                          {!x.propia && <span className="sr-only">{x.granjaNombre}</span>}
                        </span>
                      ) : (
                        <span className={`flex-1 text-right text-slate-300 ${grande ? "text-sm" : "text-[11px]"}`}>Libre</span>
                      )}
                    </button>
                  </li>
                );
              })}
            </ul>
          </section>
        ))}
      </div>

      {jaulaSel && (() => {
        // Trasladar: de gestación se pasa a lactancia y de lactancia a gestación
        const otra: Area = area === "gestacion" ? "lactancia" : "gestacion";
        const cfgOtra = AREAS[otra];
        const destinos = Array.from({ length: cfgOtra.porFila * cfgOtra.filas }, (_, i) => codigoJaula(cfgOtra.prefijo, i + 1));
        const libres = destinos.filter((j) => !datos?.porJaula.has(j));
        return (
          <Modal abierta etiqueta={cfg.titulo} titulo={`Jaula ${jaulaSel}`} subtitulo={ocupante ? `Cerda ${ocupante.c.id}${ocupante.estado ? ` · ${ocupante.estado}` : ""}${ocupante.propia ? "" : ` · ${ocupante.granjaNombre}`}` : "Libre"} onCerrar={() => setJaulaSel(null)}>
            {ocupante ? (
              <div className="flex flex-col gap-3">
                {!trasladando ? (
                  <div className="grid grid-cols-2 gap-2">
                    <Boton
                      variante="secundario"
                      disabled={!ocupante.propia}
                      onClick={() => ocupante.propia && router.push(`/cerda/${encodeURIComponent(ocupante.c.id)}`)}
                    >
                      {ocupante.propia ? "Ver cerda" : "De otra granja"}
                    </Boton>
                    <Boton onClick={() => setTrasladando(true)}>Trasladar</Boton>
                  </div>
                ) : (
                  <div>
                    {libres.length === 0 ? (
                      <p className="text-sm text-slate-500">No hay jaulas libres en {cfgOtra.titulo.toLowerCase()}.</p>
                    ) : (
                      // Igual que en la granja: Fila 1 y Fila 2 una al lado de la otra
                      <div className="mt-1 grid gap-2" style={{ gridTemplateColumns: `repeat(${cfgOtra.filas}, minmax(0, 1fr))` }}>
                        {Array.from({ length: cfgOtra.filas }, (_, f) => (
                          <div key={f} className="flex flex-col gap-1">
                            <p className="text-center text-[10px] font-bold uppercase tracking-[0.14em] text-slate-500">Fila {f + 1}</p>
                            {destinos.slice(f * cfgOtra.porFila, (f + 1) * cfgOtra.porFila).map((j) => {
                              // Ocupada: en rojo y no se puede elegir
                              const ocupadaPor = datos?.porJaula.get(j)?.c.id;
                              return (
                                <button
                                  key={j}
                                  type="button"
                                  disabled={Boolean(ocupadaPor)}
                                  onClick={() => {
                                    if (ocupadaPor) return;
                                    asignar(j, ocupante.c.id, ocupante.granja);
                                    setJaulaSel(null);
                                    setTrasladando(false);
                                    setArea(otra);
                                  }}
                                  aria-label={ocupadaPor ? `${j} ocupada por ${ocupadaPor}` : `${j} libre`}
                                  className={`flex items-center justify-between gap-1 rounded-lg px-2.5 text-xs font-bold tabular-nums ring-1 transition ${
                                    otra === "lactancia" ? "h-12" : "h-8"
                                  } ${
                                    ocupadaPor
                                      ? "cursor-not-allowed bg-rose-50 text-rose-500 ring-rose-200"
                                      : "bg-slate-50 text-slate-700 ring-slate-200 active:bg-sky-50 active:ring-sky-300"
                                  }`}
                                >
                                  <span>{j}</span>
                                  <span className={`truncate text-[10px] font-semibold ${ocupadaPor ? "" : "text-slate-300"}`}>{ocupadaPor ?? "Libre"}</span>
                                </button>
                              );
                            })}
                          </div>
                        ))}
                      </div>
                    )}
                    <button type="button" onClick={() => setTrasladando(false)} className="mt-3 text-sm font-semibold text-slate-500 active:opacity-70">
                      Cancelar
                    </button>
                  </div>
                )}

                {/* Desocupar queda escondido: solo si la cerda sale de la granja o del área */}
                <div className="rounded-2xl ring-1 ring-slate-200">
                  <button
                    type="button"
                    onClick={() => setMasOpciones((v) => !v)}
                    aria-expanded={masOpciones}
                    className="flex w-full items-center justify-between px-3.5 py-2.5 text-left text-sm font-medium text-slate-500 active:opacity-70"
                  >
                    Más opciones
                    <svg viewBox="0 0 20 20" className={`h-4 w-4 text-slate-400 transition-transform ${masOpciones ? "rotate-90" : ""}`} fill="none" stroke="currentColor" strokeWidth={2.2} strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                      <path d="M8 5l5 5-5 5" />
                    </svg>
                  </button>
                  {masOpciones && (
                    <div className="flex items-center justify-between gap-3 border-t border-slate-100 px-3.5 py-2.5">
                      <span className="min-w-0 text-xs leading-snug text-slate-500">Deja la jaula libre (la cerda queda sin jaula).</span>
                      <button
                        type="button"
                        onClick={() => {
                          asignar(jaulaSel, null);
                          setJaulaSel(null);
                        }}
                        className="shrink-0 rounded-full px-3.5 py-1.5 text-xs font-semibold text-rose-600 ring-1 ring-rose-200 transition active:bg-rose-50"
                      >
                        Desocupar
                      </button>
                    </div>
                  )}
                </div>
              </div>
            ) : (
              <div className="flex flex-col gap-3">
                <div>
                  <p className="mb-1 text-sm font-medium text-slate-700">Ubicar cerda</p>
                  {opciones.length === 0 ? (
                    <p className="text-sm text-slate-500">No hay cerdas para ubicar.</p>
                  ) : (
                    <SelectorApp
                      valor={elegida}
                      onCambiar={setElegida}
                      titulo={`Cerda para ${jaulaSel}`}
                      placeholder="Elige la cerda"
                      opciones={opciones}
                      className="w-full"
                      claseBoton="h-11 rounded-xl bg-slate-50 px-3.5 text-base text-slate-900 ring-1 ring-slate-200"
                    />
                  )}
                </div>
                <Boton
                  disabled={!elegida}
                  onClick={() => {
                    asignar(jaulaSel, elegida);
                    setJaulaSel(null);
                  }}
                  className="w-full"
                >
                  Guardar
                </Boton>
                <p className="text-xs leading-snug text-slate-500">Si la cerda estaba en otra jaula, se mueve a esta y la anterior queda libre.</p>
              </div>
            )}
          </Modal>
        );
      })()}
    </ModuloPage>
  );
}
