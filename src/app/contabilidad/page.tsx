"use client";

import { useMemo, useState, type FormEvent } from "react";
import ModuloPage from "@/components/ModuloPage";
import { Boton, Campo, Dato, Entrada, Hoja, IconoMas, Selector, Tarjeta, Vacio, EntradaPesos } from "@/components/ui";
import {
  formatoFecha,
  formatoPesos,
  guardarMovimientos,
  hoy,
  leerMovimientos,
  leerLotes,
  nombreLote,
  nuevoId,
  useVersionDatos,
  type Lote,
  type Movimiento,
} from "@/lib/datos";
import { confirmar } from "@/components/Dialogo";
import { puede } from "@/lib/nube";

const CATEGORIAS: Record<Movimiento["tipo"], string[]> = {
  ingreso: ["Venta de cerdos de engorde", "Venta de lechones", "Venta de cerdas de descarte", "Otros ingresos"],
  gasto: [
    "Alimento",
    "Medicamentos y vacunas",
    "Mano de obra",
    "Genética / semen",
    "Servicios (agua, luz)",
    "Mantenimiento",
    "Transporte",
    "Otros gastos",
  ],
};

function nombreMes(mes: string) {
  const [a, m] = mes.split("-").map(Number);
  const t = new Date(a, (m || 1) - 1, 1).toLocaleDateString("es-CO", { month: "long", year: "numeric" });
  return t.charAt(0).toUpperCase() + t.slice(1);
}

function moverMes(mes: string, delta: number) {
  const [a, m] = mes.split("-").map(Number);
  const d = new Date(a, (m || 1) - 1 + delta, 1);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
}

export default function ContabilidadPage() {
  const version = useVersionDatos();
  const [mes, setMes] = useState(() => hoy().slice(0, 7));
  const [nuevo, setNuevo] = useState(false);

  const datos = useMemo(() => {
    if (version < 0) return null;
    const movs = leerMovimientos()
      .filter((m) => m.fecha.slice(0, 7) === mes)
      .sort((a, b) => b.fecha.localeCompare(a.fecha));
    const ingresos = movs.filter((m) => m.tipo === "ingreso").reduce((s, m) => s + m.monto, 0);
    const gastos = movs.filter((m) => m.tipo === "gasto").reduce((s, m) => s + m.monto, 0);
    const porCategoria = Object.entries(
      movs
        .filter((m) => m.tipo === "gasto")
        .reduce<Record<string, number>>((acc, m) => ({ ...acc, [m.categoria]: (acc[m.categoria] ?? 0) + m.monto }), {})
    ).sort((a, b) => b[1] - a[1]);
    return { movs, ingresos, gastos, porCategoria };
  }, [version, mes]);

  const eliminar = async (id: string) => {
    if (!(await confirmar({ titulo: "Eliminar movimiento", mensaje: "El ingreso o gasto se borrará y el balance del mes se recalculará.", aceptar: "Eliminar", destructivo: true }))) return;
    guardarMovimientos(leerMovimientos().filter((m) => m.id !== id));
  };

  const balance = datos ? datos.ingresos - datos.gastos : 0;

  // Solo el administrador o quien tenga el permiso ve la contabilidad
  if (version >= 0 && !puede("contabilidad")) {
    return (
      <ModuloPage titulo="Contabilidad" subtitulo="Ingresos y gastos" icono="💼" tono="stone">
        <p className="rounded-2xl bg-white px-4 py-8 text-center text-sm text-slate-500 ring-1 ring-slate-200">
          Tu usuario no tiene permiso para ver la contabilidad. Pídeselo al administrador.
        </p>
      </ModuloPage>
    );
  }

  return (
    <ModuloPage
      titulo="Contabilidad"
      subtitulo="Ingresos y gastos"
      icono="💼"
      tono="stone"
      accion={
        <Boton onClick={() => setNuevo(true)} className="px-3.5">
          <IconoMas /> Nuevo
        </Boton>
      }
    >
      <div className="flex items-center justify-between rounded-2xl bg-slate-100 p-1">
        <button type="button" onClick={() => setMes(moverMes(mes, -1))} aria-label="Mes anterior"
          className="flex h-9 w-9 items-center justify-center rounded-xl text-slate-600 hover:bg-white">‹</button>
        <span className="text-sm font-semibold text-slate-900">{nombreMes(mes)}</span>
        <button type="button" onClick={() => setMes(moverMes(mes, 1))} aria-label="Mes siguiente"
          className="flex h-9 w-9 items-center justify-center rounded-xl text-slate-600 hover:bg-white">›</button>
      </div>

      <div className="grid grid-cols-2 gap-2">
        <Dato titulo="Ingresos" valor={datos ? formatoPesos(datos.ingresos) : "–"} />
        <Dato titulo="Gastos" valor={datos ? formatoPesos(datos.gastos) : "–"} />
      </div>
      <div
        className={`rounded-2xl px-4 py-3 ${balance >= 0 ? "bg-sky-900 text-white" : "bg-rose-600 text-white"}`}
      >
        <p className="text-xs opacity-80">Balance del mes</p>
        <p className="text-2xl font-semibold tabular-nums">{datos ? formatoPesos(balance) : "–"}</p>
      </div>

      <ContabilidadLotes version={version} />

      {datos && datos.porCategoria.length > 0 && (
        <Tarjeta titulo="Gastos por categoría">
          <ul className="flex flex-col gap-2.5">
            {datos.porCategoria.map(([cat, monto]) => (
              <li key={cat}>
                <div className="flex justify-between gap-2 text-sm">
                  <span className="truncate text-slate-700">{cat}</span>
                  <span className="shrink-0 font-semibold tabular-nums">{formatoPesos(monto)}</span>
                </div>
                <div className="mt-1 h-1.5 overflow-hidden rounded-full bg-slate-100">
                  <div className="h-full rounded-full bg-stone-500" style={{ width: `${(monto / datos.gastos) * 100}%` }} />
                </div>
              </li>
            ))}
          </ul>
        </Tarjeta>
      )}

      {datos === null ? (
        <div className="h-40 animate-pulse rounded-3xl bg-slate-100" />
      ) : datos.movs.length === 0 ? (
        <Vacio
          titulo="Sin movimientos este mes"
          texto="Registra ventas y gastos para conocer el balance de la granja."
          accion={<Boton onClick={() => setNuevo(true)}>Registrar movimiento</Boton>}
        />
      ) : (
        <Tarjeta titulo="Movimientos">
          <ul className="flex flex-col divide-y divide-slate-100">
            {datos.movs.map((m) => (
              <li key={m.id} className="flex items-center gap-3 py-3 first:pt-0 last:pb-0">
                <span
                  className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-xl text-base font-bold ${
                    m.tipo === "ingreso" ? "bg-sky-50 text-sky-700" : "bg-rose-50 text-rose-700"
                  }`}
                  aria-hidden="true"
                >
                  {m.tipo === "ingreso" ? "+" : "−"}
                </span>
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-semibold text-slate-900">{m.descripcion || m.categoria}</p>
                  <p className="truncate text-xs text-slate-500">
                    {m.categoria} · {formatoFecha(m.fecha)}
                  </p>
                </div>
                <div className="flex shrink-0 flex-col items-end">
                  <span className={`text-sm font-semibold tabular-nums ${m.tipo === "ingreso" ? "text-sky-700" : "text-slate-900"}`}>
                    {m.tipo === "ingreso" ? "+" : "−"}
                    {formatoPesos(m.monto)}
                  </span>
                  <button type="button" onClick={() => eliminar(m.id)} className="text-[11px] text-slate-400 hover:text-rose-600">
                    Quitar
                  </button>
                </div>
              </li>
            ))}
          </ul>
        </Tarjeta>
      )}

      <NuevoMovimiento abierta={nuevo} onCerrar={() => setNuevo(false)} />
    </ModuloPage>
  );
}

function NuevoMovimiento({ abierta, onCerrar }: { abierta: boolean; onCerrar: () => void }) {
  const [tipo, setTipo] = useState<Movimiento["tipo"]>("gasto");
  const [categoria, setCategoria] = useState(CATEGORIAS.gasto[0]);
  const [descripcion, setDescripcion] = useState("");
  const [monto, setMonto] = useState("");
  const [fecha, setFecha] = useState(hoy());

  const cambiarTipo = (t: Movimiento["tipo"]) => {
    setTipo(t);
    setCategoria(CATEGORIAS[t][0]);
  };

  const guardar = (e: FormEvent) => {
    e.preventDefault();
    const valor = Number(monto) || 0;
    if (valor <= 0) return;
    guardarMovimientos([
      ...leerMovimientos(),
      { id: nuevoId(), fecha, tipo, categoria, descripcion: descripcion.trim(), monto: valor },
    ]);
    setDescripcion("");
    setMonto("");
    onCerrar();
  };

  return (
    <Hoja abierta={abierta} titulo="Nuevo movimiento" onCerrar={onCerrar}>
      <form onSubmit={guardar} className="flex flex-col gap-3.5">
        <div className="grid grid-cols-2 gap-1 rounded-2xl bg-slate-100 p-1">
          {(["gasto", "ingreso"] as const).map((t) => (
            <button
              key={t}
              type="button"
              onClick={() => cambiarTipo(t)}
              className={`rounded-xl py-2 text-sm font-semibold transition ${
                tipo === t ? "bg-white text-slate-900 shadow-sm" : "text-slate-500"
              }`}
            >
              {t === "gasto" ? "Gasto" : "Ingreso"}
            </button>
          ))}
        </div>
        <Campo etiqueta="Categoría">
          <Selector value={categoria} onChange={setCategoria} opciones={CATEGORIAS[tipo].map((c) => ({ valor: c, texto: c }))} />
        </Campo>
        <Campo etiqueta="Descripción">
          <Entrada value={descripcion} onChange={setDescripcion} placeholder="Ej. 20 bultos de levante" />
        </Campo>
        <div className="grid grid-cols-2 gap-3">
          <Campo etiqueta="Valor *">
            <EntradaPesos value={monto} onChange={setMonto} required />
          </Campo>
          <Campo etiqueta="Fecha">
            <Entrada type="date" value={fecha} onChange={setFecha} required />
          </Campo>
        </div>
        <Boton type="submit" className="mt-1 w-full py-3">
          Guardar
        </Boton>
      </form>
    </Hoja>
  );
}

/* ───────────── Contabilidad por lote (lotes activos) ───────────── */

function cuentasLote(l: Lote) {
  const alimento = l.alimento.reduce((s, a) => s + (Number(a.costo) || 0), 0);
  const sinPrecio = l.alimento.filter((a) => !(Number(a.costo) > 0)).length;
  const otros = (l.gastos ?? []).reduce((s, g) => s + (Number(g.valor) || 0), 0);
  const total = alimento + otros;
  return { alimento, otros, total, sinPrecio, porAnimal: l.vivos > 0 ? total / l.vivos : 0 };
}

function ContabilidadLotes({ version }: { version: number }) {
  const lotes = useMemo(() => (version < 0 ? [] : leerLotes().filter((l) => l.activo)), [version]);
  const [abierto, setAbierto] = useState<string | null>(null);
  if (lotes.length === 0) return null;
  const lote = lotes.find((l) => l.id === abierto) ?? null;
  const totalGeneral = lotes.reduce((s, l) => s + cuentasLote(l).total, 0);

  return (
    <Tarjeta titulo="Contabilidad por lote">
      <p className="-mt-1 mb-2 text-xs text-slate-500">Lotes activos · todo lo gastado desde que ingresaron · {formatoPesos(totalGeneral)} en total</p>
      <ul className="flex flex-col gap-1.5">
        {lotes.map((l) => {
          const c = cuentasLote(l);
          return (
            <li key={l.id}>
              <button type="button" onClick={() => setAbierto(l.id)} className="flex w-full items-center gap-3 rounded-xl bg-slate-50 px-3 py-2.5 text-left active:bg-slate-100">
                <span className="shrink-0 rounded-lg bg-sky-100 px-2 py-0.5 text-xs font-bold tabular-nums text-sky-800">{l.codigo ?? "Lote"}</span>
                <span className="min-w-0 flex-1">
                  <span className="block truncate text-sm font-semibold text-slate-900">{l.nombre && l.nombre !== l.codigo ? l.nombre : `${l.vivos} animales`}</span>
                  <span className="block truncate text-[11px] text-slate-500">
                    Alimento {formatoPesos(c.alimento)} · Otros {formatoPesos(c.otros)}
                  </span>
                </span>
                <span className="shrink-0 text-right">
                  <span className="block text-sm font-bold tabular-nums text-slate-900">{formatoPesos(c.total)}</span>
                  {c.porAnimal > 0 && <span className="block text-[10px] tabular-nums text-slate-500">{formatoPesos(Math.round(c.porAnimal))} / animal</span>}
                </span>
              </button>
            </li>
          );
        })}
      </ul>
      {lote && <DetalleCuentasLote lote={lote} onCerrar={() => setAbierto(null)} />}
    </Tarjeta>
  );
}

function DetalleCuentasLote({ lote, onCerrar }: { lote: Lote; onCerrar: () => void }) {
  const c = cuentasLote(lote);
  const items = [
    ...lote.alimento.map((a, i) => ({
      k: `a${i}`,
      f: a.fecha,
      h: a.hora ?? "",
      t: a.producto ? `${a.producto} · ${a.cantidad ?? ""} ${a.unidad ?? ""}`.trim() : `Alimento · ${a.kg} kg`,
      tipo: "Alimento",
      v: Number(a.costo) || 0,
    })),
    ...(lote.gastos ?? []).map((g) => ({
      k: g.id,
      f: g.fecha,
      h: g.hora ?? "",
      t: `${g.descripcion}${g.cantidad ? ` · ${g.cantidad}` : ""}`,
      tipo: g.categoria,
      v: g.valor,
    })),
  ].sort((a, b) => b.f.localeCompare(a.f) || b.h.localeCompare(a.h));

  return (
    <Hoja abierta titulo={nombreLote(lote)} onCerrar={onCerrar}>
      <div className="flex flex-col gap-3">
        <div className="grid grid-cols-3 gap-1.5 text-center">
          {[
            { t: "Alimento", v: formatoPesos(c.alimento) },
            { t: "Otros", v: formatoPesos(c.otros) },
            { t: "Total", v: formatoPesos(c.total) },
          ].map((x) => (
            <div key={x.t} className="rounded-xl bg-white px-2 py-2 ring-1 ring-slate-200">
              <p className="text-[10px] font-medium uppercase tracking-wide text-slate-400">{x.t}</p>
              <p className="truncate text-[13px] font-bold tabular-nums text-slate-900">{x.v}</p>
            </div>
          ))}
        </div>
        <p className="text-xs text-slate-500">
          {lote.vivos} animales vivos
          {c.porAnimal > 0 ? ` · ${formatoPesos(Math.round(c.porAnimal))} por animal` : ""}
          {c.sinPrecio ? ` · ${c.sinPrecio} registro${c.sinPrecio === 1 ? "" : "s"} de alimento sin precio (la factura no tenía valor)` : ""}
        </p>
        {items.length === 0 ? (
          <p className="rounded-xl bg-slate-50 px-3 py-6 text-center text-sm text-slate-500">Este lote aún no tiene gastos.</p>
        ) : (
          <ul className="flex flex-col divide-y divide-slate-100 rounded-2xl bg-white ring-1 ring-slate-200">
            {items.map((x) => (
              <li key={x.k} className="flex items-center gap-3 px-3.5 py-2.5">
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm text-slate-800">{x.t}</p>
                  <p className="truncate text-[11px] text-slate-500">
                    {x.tipo} · {formatoFecha(x.f)}
                  </p>
                </div>
                <span className="shrink-0 text-sm font-semibold tabular-nums text-slate-900">{x.v > 0 ? formatoPesos(x.v) : "–"}</span>
              </li>
            ))}
          </ul>
        )}
      </div>
    </Hoja>
  );
}
