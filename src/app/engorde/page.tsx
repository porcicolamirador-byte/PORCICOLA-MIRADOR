"use client";

import { useMemo, useState, type FormEvent } from "react";
import ModuloPage from "@/components/ModuloPage";
import { Boton, Campo, Chips, Dato, Entrada, IconoMas, Selector, Vacio } from "@/components/ui";
import {
  diasEntre,
  formatoFecha,
  formatoPesos,
  guardarLotes,
  guardarMovimientos,
  hoy,
  leerCorrales,
  leerLotes,
  leerMovimientos,
  nuevoId,
  useVersionDatos,
  type Lote,
} from "@/lib/datos";
import { confirmar } from "@/components/Dialogo";
import Modal from "@/components/Modal";

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
  const visibles = (lotes ?? []).filter((l) => (vista === "activos" ? l.activo : !l.activo));
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
          titulo={vista === "activos" ? "No hay lotes activos" : "No hay lotes cerrados"}
          texto="Crea un lote cuando ingresen lechones a engorde para seguir su peso, mortalidad y alimento."
          accion={vista === "activos" ? <Boton onClick={() => setNuevo(true)}>Crear lote</Boton> : undefined}
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
                    <div className="min-w-0">
                      <p className="truncate font-semibold text-slate-900">{l.nombre}</p>
                      {l.origen && (
                        <p className="truncate text-xs text-slate-500">🐖 De la cerda {l.origen.cerdaId} · parto automático</p>
                      )}
                    </div>
                    <span className="text-xs text-slate-500">Día {r.dias}</span>
                  </div>
                  <div className="mt-3 grid grid-cols-3 gap-2 text-center">
                    <Mini titulo="Animales" valor={`${l.vivos}/${l.cantidadInicial}`} />
                    <Mini titulo="Peso prom." valor={r.pesoActual ? `${r.pesoActual.toFixed(1)} kg` : "–"} />
                    <Mini titulo="Ganancia" valor={r.gdp !== null ? `${Math.round(r.gdp)} g/d` : "–"} />
                  </div>
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

function Mini({ titulo, valor }: { titulo: string; valor: string }) {
  return (
    <div className="rounded-xl bg-amber-50/70 px-2 py-2">
      <p className="text-[10px] font-medium uppercase tracking-wide text-amber-900/70">{titulo}</p>
      <p className="text-sm font-semibold text-slate-900 tabular-nums">{valor}</p>
    </div>
  );
}

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
    guardarLotes([
      ...leerLotes(),
      {
        id: nuevoId(),
        nombre: nombre.trim() || `Lote ${formatoFecha(fecha)}`,
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
        <Campo etiqueta="Nombre del lote">
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

type Accion = "resumen" | "pesaje" | "muerte" | "alimento" | "corral";

const ICONOS_ACCION: Record<Accion, string> = { resumen: "🐖", pesaje: "⚖️", muerte: "⚠️", alimento: "🥣", corral: "🏚️" };

function DetalleLote({ lote, onCerrar }: { lote: Lote; onCerrar: () => void }) {
  const [accion, setAccion] = useState<Accion>("resumen");
  const [fecha, setFecha] = useState(hoy());
  const [valor, setValor] = useState("");
  const [extra, setExtra] = useState("");
  const [comoGasto, setComoGasto] = useState(true);
  const [corralSel, setCorralSel] = useState(lote.corralId ?? "");
  const r = resumenLote(lote);
  const corrales = leerCorrales().sort((a, b) => a.codigo.localeCompare(b.codigo, "es", { numeric: true }));
  const corral = corrales.find((c) => c.id === lote.corralId);

  const limpiar = () => {
    setValor("");
    setExtra("");
    setFecha(hoy());
    setCorralSel(lote.corralId ?? "");
    setAccion("resumen");
  };

  const guardar = (e: FormEvent) => {
    e.preventDefault();
    if (accion === "corral") {
      if (!corralSel) return;
      actualizarLote(lote.id, (l) => ({ ...l, corralId: corralSel }));
      return limpiar();
    }
    const n = Number(valor) || 0;
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
      const costo = Number(extra) || 0;
      actualizarLote(lote.id, (l) => ({
        ...l,
        alimento: [...l.alimento, { fecha, kg: n, costo: costo || undefined }],
      }));
      if (costo > 0 && comoGasto) {
        guardarMovimientos([
          ...leerMovimientos(),
          {
            id: nuevoId(),
            fecha,
            tipo: "gasto",
            categoria: "Alimento",
            descripcion: `${n} kg – ${lote.nombre}`,
            monto: costo,
          },
        ]);
      }
    }
    limpiar();
  };

  const cerrarLote = async () => {
    if (!(await confirmar({ titulo: `Cerrar ${lote.nombre}`, mensaje: "El lote pasará a la lista de lotes cerrados. Puedes reabrirlo después.", aceptar: "Cerrar lote" }))) return;
    actualizarLote(lote.id, (l) => ({ ...l, activo: false, fechaSalida: hoy() }));
    onCerrar();
  };
  const reabrir = () => actualizarLote(lote.id, (l) => ({ ...l, activo: true, fechaSalida: undefined }));
  const eliminar = async () => {
    if (!(await confirmar({ titulo: `Eliminar ${lote.nombre}`, mensaje: "Se borrarán el lote y todos sus pesajes, alimento y mortalidad.", aceptar: "Eliminar", destructivo: true }))) return;
    guardarLotes(leerLotes().filter((l) => l.id !== lote.id));
    onCerrar();
  };

  const titulos: Record<Accion, string> = {
    resumen: lote.nombre,
    pesaje: "Registrar pesaje",
    muerte: "Registrar muerte",
    alimento: "Registrar alimento",
    corral: "Corral del lote",
  };

  return (
    <Modal
      abierta
      etiqueta={accion === "resumen" ? "Lote de engorde" : lote.nombre}
      titulo={titulos[accion]}
      subtitulo={accion === "resumen" ? `${lote.vivos} animales · ${lote.activo ? "activo" : "cerrado"}` : undefined}
      icono={ICONOS_ACCION[accion]}
      onCerrar={accion === "resumen" ? onCerrar : limpiar}
    >
      {accion === "resumen" ? (
        <div className="flex flex-col gap-4">
          {lote.origen && (
            <p className="rounded-xl bg-amber-50 px-3 py-2 text-xs text-amber-900 ring-1 ring-amber-100">
              Lote creado automáticamente con la camada del parto {lote.origen.codigoParto} (cerda {lote.origen.cerdaId}).
            </p>
          )}
          <p className="text-sm text-slate-500">
            Ingresó el {formatoFecha(lote.fechaIngreso, true)} · {r.dias} días
            {!lote.activo && lote.fechaSalida ? ` · cerrado el ${formatoFecha(lote.fechaSalida, true)}` : ""}
          </p>
          <div className="grid grid-cols-2 gap-2">
            <Dato titulo="Animales vivos" valor={`${lote.vivos} / ${lote.cantidadInicial}`} />
            <Dato titulo="Mortalidad" valor={`${r.mortalidad.toFixed(1)} %`} detalle={`${r.muertes} animales`} />
            <Dato
              titulo="Peso promedio"
              valor={r.pesoActual ? `${r.pesoActual.toFixed(1)} kg` : "–"}
              detalle={lote.pesoInicial ? `Inició en ${lote.pesoInicial} kg` : undefined}
            />
            <Dato titulo="Ganancia diaria" valor={r.gdp !== null ? `${Math.round(r.gdp)} g` : "–"} detalle="por animal" />
            <Dato titulo="Alimento" valor={`${Math.round(r.kgAlimento)} kg`} />
            <Dato titulo="Conversión" valor={r.conversion !== null ? r.conversion.toFixed(2) : "–"} detalle="kg alimento / kg ganado" />
          </div>

          {lote.activo && (
            <div className="flex flex-col gap-2">
              <Boton onClick={() => setAccion("alimento")} disabled={!corral} className="w-full py-3">
                Registrar alimento
              </Boton>
              <div className="grid grid-cols-3 gap-2">
                <Boton variante="suave" onClick={() => setAccion("corral")} className={corral ? "" : "ring-2 ring-emerald-600"}>
                  <span className="truncate">{corral ? corral.codigo : "Corral"}</span>
                </Boton>
                <Boton variante="suave" onClick={() => setAccion("pesaje")} disabled={!corral}>Pesaje</Boton>
                <Boton variante="suave" onClick={() => setAccion("muerte")} disabled={!corral}>Muerte</Boton>
              </div>
              {!corral && <p className="text-center text-xs text-slate-500">Elige el corral del lote para habilitar alimento, pesaje y muerte.</p>}
            </div>
          )}

          {(lote.pesajes.length > 0 || lote.mortalidad.length > 0 || lote.alimento.length > 0) && (
            <div>
              <h3 className="mb-2 text-sm font-semibold text-slate-900">Registros</h3>
              <ul className="flex flex-col gap-1.5 text-sm">
                {[
                  ...lote.pesajes.map((p) => ({ f: p.fecha, t: `Pesaje: ${p.pesoPromedio} kg promedio` })),
                  ...lote.alimento.map((a) => ({
                    f: a.fecha,
                    t: `Alimento: ${a.kg} kg${a.costo ? ` · ${formatoPesos(a.costo)}` : ""}`,
                  })),
                  ...lote.mortalidad.map((m) => ({ f: m.fecha, t: `Muerte: ${m.cantidad}${m.causa ? ` · ${m.causa}` : ""}` })),
                ]
                  .sort((a, b) => b.f.localeCompare(a.f))
                  .map((x, i) => (
                    <li key={i} className="flex justify-between gap-3 rounded-xl bg-slate-50 px-3 py-2">
                      <span className="text-slate-700">{x.t}</span>
                      <span className="shrink-0 text-xs text-slate-500">{formatoFecha(x.f)}</span>
                    </li>
                  ))}
              </ul>
            </div>
          )}

          <div className="flex flex-wrap justify-center gap-2 pt-1">
            {lote.activo ? (
              <Boton variante="secundario" onClick={cerrarLote}>Cerrar lote (venta)</Boton>
            ) : (
              <Boton variante="secundario" onClick={reabrir}>Reabrir lote</Boton>
            )}
            <Boton variante="suave" onClick={eliminar} className="text-rose-600">Eliminar</Boton>
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
              <Campo etiqueta="Corral donde están los lechones">
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
          {accion === "alimento" && (
            <>
              <div className="grid grid-cols-2 gap-3">
                <Campo etiqueta="Kilos de alimento">
                  <Entrada type="number" inputMode="decimal" min={0} step="any" value={valor} onChange={setValor} required />
                </Campo>
                <Campo etiqueta="Costo total ($)">
                  <Entrada type="number" inputMode="numeric" min={0} value={extra} onChange={setExtra} />
                </Campo>
              </div>
              <label className="flex items-center gap-2 text-sm text-slate-700">
                <input
                  type="checkbox"
                  checked={comoGasto}
                  onChange={(e) => setComoGasto(e.target.checked)}
                  className="h-5 w-5 accent-emerald-700"
                />
                Registrar el costo como gasto en Contabilidad
              </label>
            </>
          )}
          <div className="mt-1 grid grid-cols-2 gap-2">
            <Boton variante="secundario" onClick={limpiar}>Cancelar</Boton>
            <Boton type="submit" disabled={accion === "corral" && (!corralSel || corrales.length === 0)}>Guardar</Boton>
          </div>
        </form>
      )}
    </Modal>
  );
}
