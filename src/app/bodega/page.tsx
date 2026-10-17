"use client";

import { useMemo, useState, type FormEvent } from "react";
import ModuloPage from "@/components/ModuloPage";
import { Boton, Campo, Chevron, Chips, Dato, Entrada, Hoja, IconoMas, Insignia, Selector, Vacio } from "@/components/ui";
import {
  formatoFecha,
  guardarArticulos,
  hoy,
  leerArticulos,
  nuevoId,
  useVersionDatos,
  type ArticuloBodega,
  type CategoriaBodega,
} from "@/lib/datos";

const CATEGORIAS: { valor: CategoriaBodega; icono: string }[] = [
  { valor: "Alimento", icono: "🌾" },
  { valor: "Medicamentos", icono: "💊" },
  { valor: "Vacunas", icono: "💉" },
  { valor: "Limpieza", icono: "🧴" },
  { valor: "Otros", icono: "🧰" },
];
const UNIDADES = ["bultos", "kg", "unidades", "frascos", "dosis", "litros", "cajas"];
const icono = (c: CategoriaBodega) => CATEGORIAS.find((x) => x.valor === c)?.icono ?? "📦";
const num = (v: string) => {
  const n = Number(v.replace(",", "."));
  return Number.isFinite(n) ? n : 0;
};
const fmt = (n: number) => (Number.isInteger(n) ? String(n) : n.toFixed(1));

type Filtro = "todos" | "bajos" | CategoriaBodega;

export default function BodegaPage() {
  const version = useVersionDatos();
  const [filtro, setFiltro] = useState<Filtro>("todos");
  const [busqueda, setBusqueda] = useState("");
  const [nuevo, setNuevo] = useState(false);
  const [seleccionado, setSeleccionado] = useState<string | null>(null);

  const articulos = useMemo(() => (version < 0 ? null : leerArticulos()), [version]);
  const bajos = (articulos ?? []).filter((a) => a.cantidad <= a.minimo);
  const visibles = useMemo(() => {
    const q = busqueda.trim().toLowerCase();
    return (articulos ?? [])
      .filter((a) => (filtro === "todos" ? true : filtro === "bajos" ? a.cantidad <= a.minimo : a.categoria === filtro))
      .filter((a) => !q || a.nombre.toLowerCase().includes(q))
      .sort((a, b) => a.nombre.localeCompare(b.nombre, "es"));
  }, [articulos, filtro, busqueda]);
  const articulo = articulos?.find((a) => a.id === seleccionado) ?? null;

  return (
    <ModuloPage
      titulo="Bodega"
      subtitulo="Inventario de alimento, medicamentos e insumos"
      icono="📦"
      tono="teal"
      accion={
        <Boton onClick={() => setNuevo(true)} className="px-3.5">
          <IconoMas /> Artículo
        </Boton>
      }
    >
      <div className="grid grid-cols-2 gap-2">
        <Dato titulo="Artículos" valor={articulos ? articulos.length : "–"} />
        <Dato titulo="Bajo el mínimo" valor={articulos ? bajos.length : "–"} detalle={bajos.length ? "Hay que reponer" : "Todo en orden"} />
      </div>

      <input
        type="search"
        value={busqueda}
        onChange={(e) => setBusqueda(e.target.value)}
        placeholder="Buscar artículo"
        className="w-full rounded-2xl bg-slate-100 px-4 py-3 text-base text-slate-900 placeholder:text-slate-400 focus:bg-white focus:outline-none focus:ring-2 focus:ring-emerald-600"
      />

      <Chips
        opciones={[
          { valor: "todos", texto: "Todos" },
          { valor: "bajos", texto: `Por reponer${bajos.length ? ` (${bajos.length})` : ""}` },
          ...CATEGORIAS.map((c) => ({ valor: c.valor, texto: c.valor })),
        ]}
        valor={filtro}
        onChange={setFiltro}
      />

      {articulos === null ? (
        <div className="h-40 animate-pulse rounded-3xl bg-slate-100" />
      ) : articulos.length === 0 ? (
        <Vacio
          titulo="La bodega está vacía"
          texto="Registra el alimento, los medicamentos y demás insumos para controlar las existencias."
          accion={<Boton onClick={() => setNuevo(true)}>Agregar artículo</Boton>}
        />
      ) : visibles.length === 0 ? (
        <p className="py-8 text-center text-sm text-slate-500">Ningún artículo coincide con el filtro.</p>
      ) : (
        <ul className="divide-y divide-slate-100 overflow-hidden rounded-3xl bg-white ring-1 ring-slate-200/80">
          {visibles.map((a) => {
            const bajo = a.cantidad <= a.minimo;
            return (
              <li key={a.id}>
                <button
                  type="button"
                  onClick={() => setSeleccionado(a.id)}
                  className="flex w-full items-center gap-3 px-4 py-3.5 text-left transition hover:bg-slate-50 active:bg-slate-100"
                >
                  <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-teal-50 text-xl" aria-hidden="true">
                    {icono(a.categoria)}
                  </span>
                  <span className="min-w-0 flex-1">
                    <span className="block truncate text-sm font-semibold text-slate-900">{a.nombre}</span>
                    <span className="block truncate text-xs text-slate-500">
                      {a.categoria} · mínimo {fmt(a.minimo)} {a.unidad}
                    </span>
                  </span>
                  <span className="flex shrink-0 flex-col items-end gap-1">
                    <span className={`text-sm font-bold tabular-nums ${bajo ? "text-red-600" : "text-slate-900"}`}>
                      {fmt(a.cantidad)} <span className="text-xs font-medium text-slate-500">{a.unidad}</span>
                    </span>
                    {bajo && <Insignia clase="bg-red-50 text-red-700 ring-red-200">Reponer</Insignia>}
                  </span>
                  <Chevron />
                </button>
              </li>
            );
          })}
        </ul>
      )}

      <NuevoArticulo abierta={nuevo} onCerrar={() => setNuevo(false)} />
      {articulo && <DetalleArticulo articulo={articulo} onCerrar={() => setSeleccionado(null)} />}
    </ModuloPage>
  );
}

function actualizar(id: string, cambio: (a: ArticuloBodega) => ArticuloBodega) {
  guardarArticulos(leerArticulos().map((a) => (a.id === id ? cambio(a) : a)));
}

function NuevoArticulo({ abierta, onCerrar }: { abierta: boolean; onCerrar: () => void }) {
  const [nombre, setNombre] = useState("");
  const [categoria, setCategoria] = useState<CategoriaBodega>("Alimento");
  const [unidad, setUnidad] = useState("bultos");
  const [cantidad, setCantidad] = useState("");
  const [minimo, setMinimo] = useState("");

  const guardar = (e: FormEvent) => {
    e.preventDefault();
    if (!nombre.trim()) return;
    const inicial = num(cantidad);
    guardarArticulos([
      ...leerArticulos(),
      {
        id: nuevoId(),
        nombre: nombre.trim(),
        categoria,
        unidad,
        cantidad: inicial,
        minimo: num(minimo),
        movimientos: inicial > 0 ? [{ fecha: hoy(), tipo: "entrada", cantidad: inicial, nota: "Existencia inicial" }] : [],
      },
    ]);
    setNombre("");
    setCantidad("");
    setMinimo("");
    onCerrar();
  };

  return (
    <Hoja abierta={abierta} titulo="Nuevo artículo" onCerrar={onCerrar}>
      <form onSubmit={guardar} className="flex flex-col gap-3.5">
        <Campo etiqueta="Nombre *">
          <Entrada value={nombre} onChange={setNombre} placeholder="Ej. Concentrado levante" required />
        </Campo>
        <div className="grid grid-cols-2 gap-3">
          <Campo etiqueta="Categoría">
            <Selector
              value={categoria}
              onChange={(v) => setCategoria(v as CategoriaBodega)}
              opciones={CATEGORIAS.map((c) => ({ valor: c.valor, texto: `${c.icono} ${c.valor}` }))}
            />
          </Campo>
          <Campo etiqueta="Unidad">
            <Selector value={unidad} onChange={setUnidad} opciones={UNIDADES.map((u) => ({ valor: u, texto: u }))} />
          </Campo>
        </div>
        <div className="grid grid-cols-2 gap-3">
          <Campo etiqueta="Existencia actual">
            <Entrada type="number" inputMode="decimal" min={0} step="any" value={cantidad} onChange={setCantidad} placeholder="0" />
          </Campo>
          <Campo etiqueta="Mínimo" ayuda="Avisa cuando queda esto o menos">
            <Entrada type="number" inputMode="decimal" min={0} step="any" value={minimo} onChange={setMinimo} placeholder="0" />
          </Campo>
        </div>
        <Boton type="submit" className="mt-1 w-full py-3">
          Guardar artículo
        </Boton>
      </form>
    </Hoja>
  );
}

function DetalleArticulo({ articulo: a, onCerrar }: { articulo: ArticuloBodega; onCerrar: () => void }) {
  const [modo, setModo] = useState<"resumen" | "entrada" | "salida">("resumen");
  const [cantidad, setCantidad] = useState("");
  const [nota, setNota] = useState("");
  const [fecha, setFecha] = useState(hoy());
  const [error, setError] = useState("");

  const volver = () => {
    setModo("resumen");
    setCantidad("");
    setNota("");
    setError("");
    setFecha(hoy());
  };

  const registrar = (e: FormEvent) => {
    e.preventDefault();
    const n = num(cantidad);
    if (n <= 0) return setError("Escribe una cantidad mayor que cero.");
    if (modo === "salida" && n > a.cantidad) return setError(`Solo hay ${fmt(a.cantidad)} ${a.unidad} en bodega.`);
    actualizar(a.id, (x) => ({
      ...x,
      cantidad: Math.max(0, x.cantidad + (modo === "entrada" ? n : -n)),
      movimientos: [...x.movimientos, { fecha, tipo: modo === "entrada" ? "entrada" : "salida", cantidad: n, nota: nota.trim() || undefined }],
    }));
    volver();
  };

  const eliminar = () => {
    if (!window.confirm(`¿Eliminar ${a.nombre} y su historial?`)) return;
    guardarArticulos(leerArticulos().filter((x) => x.id !== a.id));
    onCerrar();
  };

  const bajo = a.cantidad <= a.minimo;
  const titulo = modo === "resumen" ? a.nombre : modo === "entrada" ? "Registrar entrada" : "Registrar salida";

  return (
    <Hoja abierta titulo={titulo} onCerrar={modo === "resumen" ? onCerrar : volver}>
      {modo === "resumen" ? (
        <div className="flex flex-col gap-4">
          <div className="flex items-center gap-3 rounded-2xl bg-teal-50/70 p-4 ring-1 ring-teal-100">
            <span className="text-3xl" aria-hidden="true">{icono(a.categoria)}</span>
            <div className="min-w-0 flex-1">
              <p className="text-xs text-slate-500">{a.categoria} · existencia</p>
              <p className={`text-3xl font-bold leading-tight tabular-nums ${bajo ? "text-red-600" : "text-slate-900"}`}>
                {fmt(a.cantidad)} <span className="text-base font-semibold text-slate-500">{a.unidad}</span>
              </p>
              <p className="text-xs text-slate-500">
                Mínimo {fmt(a.minimo)} {a.unidad}
                {bajo ? " · hay que reponer" : ""}
              </p>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-2">
            <Boton onClick={() => setModo("entrada")}>+ Entrada</Boton>
            <Boton variante="secundario" onClick={() => setModo("salida")} disabled={a.cantidad <= 0}>
              − Salida
            </Boton>
          </div>

          <div>
            <h3 className="mb-2 text-sm font-semibold text-slate-900">Movimientos</h3>
            {a.movimientos.length === 0 ? (
              <p className="text-sm text-slate-500">Sin movimientos todavía.</p>
            ) : (
              <ul className="flex flex-col gap-1.5">
                {[...a.movimientos]
                  .reverse()
                  .slice(0, 30)
                  .map((m, i) => (
                    <li key={i} className="flex items-center justify-between gap-3 rounded-xl bg-slate-50 px-3 py-2 text-sm">
                      <span className="min-w-0">
                        <span className={`font-semibold ${m.tipo === "entrada" ? "text-emerald-700" : "text-slate-800"}`}>
                          {m.tipo === "entrada" ? "+" : "−"}
                          {fmt(m.cantidad)} {a.unidad}
                        </span>
                        {m.nota && <span className="text-slate-500"> · {m.nota}</span>}
                      </span>
                      <span className="shrink-0 text-xs text-slate-500">{formatoFecha(m.fecha)}</span>
                    </li>
                  ))}
              </ul>
            )}
          </div>

          <button
            type="button"
            onClick={eliminar}
            className="self-center rounded-full px-4 py-2 text-sm font-medium text-rose-600 hover:bg-rose-50"
          >
            Eliminar artículo
          </button>
        </div>
      ) : (
        <form onSubmit={registrar} className="flex flex-col gap-3.5">
          <p className="text-sm text-slate-500">
            {a.nombre}: hay {fmt(a.cantidad)} {a.unidad}
          </p>
          <div className="grid grid-cols-2 gap-3">
            <Campo etiqueta={`Cantidad (${a.unidad}) *`}>
              <Entrada type="number" inputMode="decimal" min={0} step="any" value={cantidad} onChange={setCantidad} required />
            </Campo>
            <Campo etiqueta="Fecha">
              <Entrada type="date" value={fecha} onChange={setFecha} required />
            </Campo>
          </div>
          <Campo etiqueta="Nota">
            <Entrada
              value={nota}
              onChange={setNota}
              placeholder={modo === "entrada" ? "Ej. Compra a proveedor" : "Ej. Lote corral 3"}
            />
          </Campo>
          {error && <p className="text-sm font-medium text-rose-600">{error}</p>}
          <div className="mt-1 grid grid-cols-2 gap-2">
            <Boton variante="secundario" onClick={volver}>Cancelar</Boton>
            <Boton type="submit">Guardar</Boton>
          </div>
        </form>
      )}
    </Hoja>
  );
}
