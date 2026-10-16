"use client";

import { useMemo, useState, type FormEvent } from "react";
import ModuloPage from "@/components/ModuloPage";
import { Boton, Campo, Dato, Entrada, Hoja, IconoMas, Selector, Tarjeta, Vacio } from "@/components/ui";
import {
  formatoFecha,
  formatoPesos,
  guardarMovimientos,
  hoy,
  leerMovimientos,
  nuevoId,
  useVersionDatos,
  type Movimiento,
} from "@/lib/datos";

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

  const eliminar = (id: string) => {
    if (!window.confirm("¿Eliminar este movimiento?")) return;
    guardarMovimientos(leerMovimientos().filter((m) => m.id !== id));
  };

  const balance = datos ? datos.ingresos - datos.gastos : 0;

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
        className={`rounded-2xl px-4 py-3 ${balance >= 0 ? "bg-emerald-900 text-white" : "bg-rose-600 text-white"}`}
      >
        <p className="text-xs opacity-80">Balance del mes</p>
        <p className="text-2xl font-semibold tabular-nums">{datos ? formatoPesos(balance) : "–"}</p>
      </div>

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
                    m.tipo === "ingreso" ? "bg-emerald-50 text-emerald-700" : "bg-rose-50 text-rose-700"
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
                  <span className={`text-sm font-semibold tabular-nums ${m.tipo === "ingreso" ? "text-emerald-700" : "text-slate-900"}`}>
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
          <Campo etiqueta="Valor ($) *">
            <Entrada type="number" inputMode="numeric" min={1} value={monto} onChange={setMonto} required />
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
