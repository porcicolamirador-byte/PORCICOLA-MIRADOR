"use client";

import Modal from "@/components/Modal";
import { useEffect, useMemo, useState, type FormEvent, Fragment } from "react";
import { Boton, Campo, Entrada, IconoMas, Selector, Tarjeta } from "@/components/ui";
import { avisar, confirmar } from "@/components/Dialogo";
import {
  calcularInventario,
  guardarProductos,
  leerProductos,
  migrarBodegaAnterior,
  nuevoId,
  useVersionDatos,
  type CategoriaBodega,
  type ProductoBodega,
} from "@/lib/datos";

export const CATEGORIAS_BODEGA: { valor: CategoriaBodega; icono: string }[] = [
  { valor: "Alimento", icono: "" }, // se dibuja como bulto de 40 kg (IconoCategoria)
  { valor: "Medicamentos", icono: "💊" },
  { valor: "Vacunas", icono: "💉" },
  { valor: "Limpieza", icono: "🧴" },
  { valor: "Otros", icono: "🧰" },
];
export const UNIDADES_BODEGA = ["bultos", "kg", "unidades", "frascos", "dosis", "litros", "cajas"];
/** Emoji de la categoría para textos simples (listas desplegables); el alimento no lleva emoji */
export const iconoCategoria = (c: CategoriaBodega) => CATEGORIAS_BODEGA.find((x) => x.valor === c)?.icono ?? "📦";
export const textoCategoria = (c: CategoriaBodega) => {
  const i = iconoCategoria(c);
  return i ? `${i} ${c}` : c;
};

/** Bulto de concentrado de 40 kg (ícono de la categoría Alimento) */
export function IconoBulto({ className = "h-6 w-6" }: { className?: string }) {
  return (
    <svg viewBox="0 0 48 48" className={className} aria-hidden="true">
      <path d="M13 8h22v4l2 26a3 3 0 0 1-3 3H14a3 3 0 0 1-3-3l2-26z" fill="#e7c48a" />
      <path d="M13 8h22v4H13z" fill="#a16207" />
      <rect x="15" y="20" width="18" height="12" rx="2" fill="#fff" />
      <text x="24" y="29.5" fontSize="7.5" fontWeight="700" textAnchor="middle" fill="#92400e" fontFamily="Arial, sans-serif">
        40kg
      </text>
    </svg>
  );
}

/** Ícono de una categoría: bulto dibujado para Alimento, emoji para las demás */
export function IconoCategoria({ categoria, className = "h-6 w-6" }: { categoria: CategoriaBodega; className?: string }) {
  if (categoria === "Alimento") return <IconoBulto className={className} />;
  return (
    <span className={`inline-flex items-center justify-center leading-none ${className}`} style={{ fontSize: "1.25em" }} aria-hidden="true">
      {iconoCategoria(categoria)}
    </span>
  );
}

const fmt = (n: number) => (Number.isInteger(n) ? String(n) : n.toFixed(1));

/** Apartado de Ajustes avanzados para definir los productos que se usan en Bodega */
export default function CatalogoProductos({ incrustado = false }: { incrustado?: boolean } = {}) {
  const version = useVersionDatos();
  const [editando, setEditando] = useState<ProductoBodega | "nuevo" | null>(null);

  useEffect(() => {
    if (version >= 0) migrarBodegaAnterior();
  }, [version]);

  const inventario = useMemo(() => (version < 0 ? null : calcularInventario()), [version]);
  const ordenados = [...(inventario ?? [])].sort(
    (a, b) => a.producto.categoria.localeCompare(b.producto.categoria) || a.producto.nombre.localeCompare(b.producto.nombre, "es")
  );

  const eliminar = async (p: ProductoBodega) => {
    const uso = inventario?.find((i) => i.producto.id === p.id);
    if (uso && uso.movimientos.length > 0) {
      await avisar({
        titulo: "No se puede eliminar",
        mensaje: `${p.nombre} ya aparece en facturas o salidas. Elimina primero esos registros en Bodega.`,
      });
      return;
    }
    if (!(await confirmar({ titulo: `Eliminar ${p.nombre}`, mensaje: "El producto se quitará del catálogo.", aceptar: "Eliminar", destructivo: true }))) return;
    guardarProductos(leerProductos().filter((x) => x.id !== p.id));
  };

  const Contenedor = incrustado ? Fragment : Tarjeta;
  return (
    <Contenedor>
      {incrustado ? (
        <div className="mb-3 flex items-center gap-3">
          <p className="min-w-0 flex-1 text-xs leading-relaxed text-slate-500">Solo estos productos se pueden ingresar en las facturas.</p>
          <Boton onClick={() => setEditando("nuevo")} className="shrink-0 px-3">
            <IconoMas /> Producto
          </Boton>
        </div>
      ) : (
      <div className="mb-3 flex items-start gap-3">
        <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-sky-50 text-lg" aria-hidden="true">
          📦
        </span>
        <div className="min-w-0 flex-1">
          <h2 className="text-[15px] font-semibold text-slate-900">Productos de bodega</h2>
          <p className="text-xs text-slate-500">Solo estos productos se pueden ingresar en las facturas de Bodega.</p>
        </div>
        <Boton onClick={() => setEditando("nuevo")} className="shrink-0 px-3">
          <IconoMas /> Producto
        </Boton>
      </div>
      )}

      {inventario === null ? (
        <div className="h-24 animate-pulse rounded-2xl bg-slate-100" />
      ) : ordenados.length === 0 ? (
        <p className="rounded-2xl border border-dashed border-slate-200 px-4 py-6 text-center text-sm text-slate-500">
          Aún no hay productos. Agrega el alimento, medicamentos y demás insumos que compras.
        </p>
      ) : (
        <ul className="divide-y divide-slate-100 rounded-2xl ring-1 ring-slate-100">
          {ordenados.map(({ producto: p, existencia }) => (
            <li key={p.id} className="flex items-center gap-3 px-3.5 py-3">
              <IconoCategoria categoria={p.categoria} className="h-7 w-7 shrink-0 text-xl" />
              <div className="min-w-0 flex-1">
                <p className="truncate text-sm font-semibold text-slate-900">{p.nombre}</p>
                <p className="truncate text-xs text-slate-500">
                  {p.categoria} · {p.unidad} · mínimo {fmt(p.minimo)} · hay {fmt(existencia)}
                </p>
              </div>
              <button
                type="button"
                onClick={() => setEditando(p)}
                className="shrink-0 rounded-full px-2.5 py-1 text-xs font-semibold text-sky-700 hover:bg-sky-50"
              >
                Editar
              </button>
              <button
                type="button"
                onClick={() => eliminar(p)}
                className="shrink-0 rounded-full px-2 py-1 text-xs text-slate-400 hover:bg-rose-50 hover:text-rose-600"
              >
                Quitar
              </button>
            </li>
          ))}
        </ul>
      )}

      <FormProducto producto={editando} onCerrar={() => setEditando(null)} />
    </Contenedor>
  );
}

function FormProducto({ producto, onCerrar }: { producto: ProductoBodega | "nuevo" | null; onCerrar: () => void }) {
  const [nombre, setNombre] = useState("");
  const [categoria, setCategoria] = useState<CategoriaBodega>("Alimento");
  const [unidad, setUnidad] = useState("bultos");
  const [minimo, setMinimo] = useState("");
  const [error, setError] = useState("");
  const [cargado, setCargado] = useState<ProductoBodega | "nuevo" | null>(null);

  // Al abrir, se cargan los datos del producto a editar (o se limpia para uno nuevo)
  if (producto !== cargado) {
    setCargado(producto);
    if (producto && producto !== "nuevo") {
      setNombre(producto.nombre);
      setCategoria(producto.categoria);
      setUnidad(producto.unidad);
      setMinimo(String(producto.minimo));
    } else {
      setNombre("");
      setCategoria("Alimento");
      setUnidad("bultos");
      setMinimo("");
    }
    setError("");
  }

  const guardar = (e: FormEvent) => {
    e.preventDefault();
    const limpio = nombre.trim();
    if (!limpio) return setError("Escribe el nombre del producto.");
    const todos = leerProductos();
    const id = producto && producto !== "nuevo" ? producto.id : null;
    if (todos.some((p) => p.nombre.toLowerCase() === limpio.toLowerCase() && p.id !== id)) {
      return setError("Ya existe un producto con ese nombre.");
    }
    const min = Math.max(0, Number(minimo.replace(",", ".")) || 0);
    if (id) {
      guardarProductos(todos.map((p) => (p.id === id ? { ...p, nombre: limpio, categoria, unidad, minimo: min } : p)));
    } else {
      guardarProductos([...todos, { id: nuevoId(), nombre: limpio, categoria, unidad, minimo: min }]);
    }
    onCerrar();
  };

  return (
    <Modal
      abierta={producto !== null}
      etiqueta="Bodega"
      titulo={producto === "nuevo" ? "Nuevo producto" : "Editar producto"}
      subtitulo={nombre.trim() || undefined}
      icono={<IconoCategoria categoria={categoria} className="h-9 w-9 text-3xl" />}
      onCerrar={onCerrar}
    >
      <form onSubmit={guardar} className="flex flex-col gap-3.5">
        <Campo etiqueta="Nombre *">
          <Entrada value={nombre} onChange={setNombre} placeholder="Ej. Concentrado levante 40 kg" required />
        </Campo>
        <div className="grid grid-cols-2 gap-3">
          <Campo etiqueta="Categoría">
            <Selector
              value={categoria}
              onChange={(v) => setCategoria(v as CategoriaBodega)}
              opciones={CATEGORIAS_BODEGA.map((c) => ({ valor: c.valor, texto: textoCategoria(c.valor) }))}
            />
          </Campo>
          <Campo etiqueta="Unidad">
            <Selector value={unidad} onChange={setUnidad} opciones={UNIDADES_BODEGA.map((u) => ({ valor: u, texto: u }))} />
          </Campo>
        </div>
        <Campo etiqueta="Existencia mínima" ayuda="Bodega avisa “Reponer” cuando quede esto o menos">
          <Entrada type="number" inputMode="decimal" min={0} step="any" value={minimo} onChange={setMinimo} placeholder="0" />
        </Campo>
        {error && <p className="text-sm font-medium text-rose-600">{error}</p>}
        <Boton type="submit" className="mt-1 w-full py-3">
          Guardar producto
        </Boton>
      </form>
    </Modal>
  );
}
