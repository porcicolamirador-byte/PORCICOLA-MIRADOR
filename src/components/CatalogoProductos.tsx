"use client";

import Modal from "@/components/Modal";
import { useEffect, useMemo, useRef, useState, type FormEvent, type ReactNode, Fragment } from "react";
import { Boton, Campo, Entrada, IconoMas, Interruptor, Selector, Tarjeta } from "@/components/ui";
import { avisar, confirmar } from "@/components/Dialogo";
import {
  calcularInventario,
  codigoDe,
  factorKg,
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

/** Trazos de línea de cada categoría (mismo estilo que los iconos del Dashboard) */
const TRAZOS_CATEGORIA: Record<CategoriaBodega, ReactNode> = {
  Alimento: (
    <>
      <path d="M5.5 4h13l1.5 3.5-1 12.5a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2L4 7.5z" />
      <path d="M4 7.5h16M9 13h6M9 16.5h6" />
    </>
  ),
  Medicamentos: (
    <>
      <path d="m10.5 20.5 10-10a4.95 4.95 0 1 0-7-7l-10 10a4.95 4.95 0 1 0 7 7z" />
      <path d="m8.5 8.5 7 7" />
    </>
  ),
  Vacunas: <path d="m18 2 4 4M17 7l3-3M19 9 8.5 19.5a2.1 2.1 0 0 1-3-3L16 6M9 11l4 4M5 19l-3 3M14 4l6 6" />,
  Limpieza: (
    <>
      <path d="M9 3h5v3H9zM14 4h3l1.5 1.5" />
      <path d="M10 6 8 9.5V20a1 1 0 0 0 1 1h6a1 1 0 0 0 1-1V9.5L14 6" />
      <path d="M8 13h8" />
    </>
  ),
  Otros: (
    <>
      <rect x="3" y="7" width="18" height="13" rx="2" />
      <path d="M9 7V5a1 1 0 0 1 1-1h4a1 1 0 0 1 1 1v2M3 13h18M10 13v2h4v-2" />
    </>
  ),
};

/** Ícono de línea de una categoría de bodega */
export function IconoCategoria({ categoria, className = "h-6 w-6" }: { categoria: CategoriaBodega; className?: string }) {
  return (
    <svg
      viewBox="0 0 24 24"
      className={className}
      fill="none"
      stroke="currentColor"
      strokeWidth={1.8}
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      {TRAZOS_CATEGORIA[categoria] ?? TRAZOS_CATEGORIA.Otros}
    </svg>
  );
}

/** Ícono en recuadro gris (como los del Dashboard) */
export function RecuadroCategoria({ categoria, tamano = "md" }: { categoria: CategoriaBodega; tamano?: "sm" | "md" | "lg" }) {
  const t = { sm: ["h-8 w-8 rounded-lg", "h-[18px] w-[18px]"], md: ["h-9 w-9 rounded-xl", "h-5 w-5"], lg: ["h-12 w-12 rounded-2xl", "h-6 w-6"] }[tamano];
  return (
    <span className={`flex shrink-0 items-center justify-center bg-slate-100 text-slate-700 ${t[0]}`} aria-hidden="true">
      <IconoCategoria categoria={categoria} className={t[1]} />
    </span>
  );
}

/** Lista desplegable de categorías con su ícono al lado */
function SelectorCategoria({ value, onChange }: { value: CategoriaBodega; onChange: (c: CategoriaBodega) => void }) {
  const [abierto, setAbierto] = useState(false);
  const caja = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (!abierto) return;
    const fuera = (e: PointerEvent) => {
      if (caja.current && !caja.current.contains(e.target as Node)) setAbierto(false);
    };
    document.addEventListener("pointerdown", fuera);
    return () => document.removeEventListener("pointerdown", fuera);
  }, [abierto]);
  return (
    <div ref={caja} className="relative">
      <button
        type="button"
        onClick={() => setAbierto((a) => !a)}
        aria-haspopup="listbox"
        aria-expanded={abierto}
        className="flex h-12 w-full items-center gap-2 rounded-xl border border-slate-200 bg-slate-50 px-2.5 text-left text-base text-slate-900 outline-none focus-visible:ring-2 focus-visible:ring-sky-200"
      >
        <span className="text-slate-600">
          <IconoCategoria categoria={value} className="h-5 w-5" />
        </span>
        <span className="min-w-0 flex-1 truncate">{value}</span>
        <svg viewBox="0 0 20 20" className={`h-4 w-4 shrink-0 text-slate-400 transition-transform ${abierto ? "rotate-180" : ""}`} fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
          <path d="M5 8l5 5 5-5" />
        </svg>
      </button>
      {abierto && (
        <ul role="listbox" aria-label="Categoría" className="absolute left-0 top-full z-30 mt-1.5 w-[calc(200%+0.75rem)] max-w-[80vw] overflow-hidden rounded-2xl bg-white py-1 shadow-xl ring-1 ring-slate-200">
          {CATEGORIAS_BODEGA.map(({ valor }) => {
            const elegido = valor === value;
            return (
              <li key={valor} role="option" aria-selected={elegido}>
                <button
                  type="button"
                  onClick={() => {
                    onChange(valor);
                    setAbierto(false);
                  }}
                  className="flex w-full items-center gap-3 px-3 py-2.5 text-left active:bg-slate-50"
                >
                  <RecuadroCategoria categoria={valor} tamano="sm" />
                  <span className={`min-w-0 flex-1 text-[15px] ${elegido ? "font-semibold text-slate-900" : "text-slate-700"}`}>{valor}</span>
                  {elegido && (
                    <svg viewBox="0 0 20 20" className="h-4 w-4 text-sky-600" fill="none" stroke="currentColor" strokeWidth={2.4} strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                      <path d="m4.5 10.5 3.5 3.5 7.5-8" />
                    </svg>
                  )}
                </button>
              </li>
            );
          })}
        </ul>
      )}
    </div>
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

  const inventario = useMemo(() => (version < 0 ? null : calcularInventario({ incluirInactivos: true })), [version]);
  // Primero los preestablecidos, luego los demás por categoría y nombre
  const ordenados = [...(inventario ?? [])].sort(
    (a, b) =>
      Number(!!b.producto.preestablecido) - Number(!!a.producto.preestablecido) ||
      a.producto.categoria.localeCompare(b.producto.categoria) ||
      a.producto.nombre.localeCompare(b.producto.nombre, "es")
  );

  const alternar = (p: ProductoBodega, activo: boolean) =>
    guardarProductos(leerProductos().map((x) => (x.id === p.id ? { ...x, activo } : x)));

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
          <span className="flex-1" />
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
            <li key={p.id} className={`flex items-center gap-3 px-3.5 py-3 ${p.activo === false ? "opacity-55" : ""}`}>
              <RecuadroCategoria categoria={p.categoria} tamano="md" />
              <div className="min-w-0 flex-1">
                <p className="flex items-center gap-1.5 text-sm font-semibold text-slate-900">
                  {codigoDe(p) && (
                    <span className="shrink-0 rounded-md bg-slate-100 px-1.5 py-0.5 text-[10px] font-bold tabular-nums text-slate-600">{codigoDe(p)}</span>
                  )}
                  <span className="truncate">{p.nombre}</span>
                </p>
                <p className="truncate text-xs text-slate-500">
                  {p.unidad}
                  {p.unidad === "bultos" ? ` de ${fmt(factorKg(p))} kg` : ""} · mínimo {fmt(p.minimo)} · hay {fmt(existencia)}
                </p>
              </div>
              {p.preestablecido && (
                <Interruptor activo={p.activo !== false} onCambiar={(v) => alternar(p, v)} />
              )}
              <button
                type="button"
                onClick={() => setEditando(p)}
                className="shrink-0 rounded-full px-2.5 py-1 text-xs font-semibold text-sky-700 hover:bg-sky-50"
              >
                Editar
              </button>
              {!p.preestablecido && (
                <button
                  type="button"
                  onClick={() => eliminar(p)}
                  className="shrink-0 rounded-full px-2 py-1 text-xs text-slate-400 hover:bg-rose-50 hover:text-rose-600"
                >
                  Quitar
                </button>
              )}
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
  const [codigo, setCodigo] = useState("");
  const [kgBulto, setKgBulto] = useState("40");
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
      setCodigo(producto.codigo ?? "");
      setKgBulto(String(producto.kgPorUnidad ?? 40));
    } else {
      setNombre("");
      setCategoria("Alimento");
      setUnidad("bultos");
      setMinimo("");
      setCodigo("");
      setKgBulto("40");
    }
    setError("");
  }

  // Productos con el mismo código (para asociar inventarios)
  const idActual = producto && producto !== "nuevo" ? producto.id : null;
  const esPreestablecido = !!(producto && producto !== "nuevo" && producto.preestablecido);
  const codigoLimpio = codigo.trim().toUpperCase();
  const todosProductos = producto !== null ? leerProductos() : [];
  const coincidencias = codigoLimpio ? todosProductos.filter((p) => p.id !== idActual && codigoDe(p) === codigoLimpio) : [];
  const codigosDisponibles = todosProductos.filter((p) => p.preestablecido && p.id !== idActual);
  const describir = (p: ProductoBodega) => `${p.nombre} (${p.unidad}${p.unidad === "bultos" ? ` de ${fmt(factorKg(p))} kg` : ""})`;

  const guardar = async (e: FormEvent) => {
    e.preventDefault();
    const limpio = nombre.trim();
    if (!limpio) return setError("Escribe el nombre del producto.");
    const todos = leerProductos();
    const id = producto && producto !== "nuevo" ? producto.id : null;
    if (todos.some((p) => p.nombre.toLowerCase() === limpio.toLowerCase() && p.id !== id)) {
      return setError("Ya existe un producto con ese nombre.");
    }
    const min = Math.max(0, Number(minimo.replace(",", ".")) || 0);
    const cod = codigo.trim().toUpperCase() || undefined;
    const kg = unidad === "bultos" ? Math.max(1, Number(kgBulto.replace(",", ".")) || 40) : undefined;
    // Con el mismo código, las unidades deben poder convertirse (bultos/kg) o ser iguales
    if (cod) {
      const otros = todos.filter((p) => p.id !== id && (p.codigo ?? "").trim().toUpperCase() === cod);
      const convertible = (u: string) => u === "bultos" || u === "kg";
      if (otros.some((o) => !(convertible(o.unidad) && convertible(unidad)) && o.unidad !== unidad)) {
        return setError(`El código ${cod} ya lo usa un producto en ${otros[0].unidad}; solo se pueden unir bultos con kilos o la misma unidad.`);
      }
      // Preguntar antes de asociar (al crear o al cambiar el código)
      const codigoAntes = producto && producto !== "nuevo" ? (producto.codigo ?? "").trim().toUpperCase() : "";
      if (otros.length && cod !== codigoAntes) {
        const ok = await confirmar({
          titulo: "¿Asociar productos?",
          mensaje: `El código ${cod} pertenece a ${otros.map(describir).join(", ")}. ¿Quieres asociar «${limpio}» para que compartan el mismo inventario?`,
          aceptar: "Asociar",
        });
        if (!ok) return setError("No se guardó. Cambia el código o déjalo vacío para no asociarlo.");
      }
    }
    if (id) {
      guardarProductos(todos.map((p) => (p.id === id ? { ...p, nombre: limpio, categoria, unidad, minimo: min, codigo: cod, kgPorUnidad: kg } : p)));
    } else {
      guardarProductos([...todos, { id: nuevoId(), nombre: limpio, categoria, unidad, minimo: min, codigo: cod, kgPorUnidad: kg, activo: true }]);
    }
    onCerrar();
  };

  return (
    <Modal
      abierta={producto !== null}
      etiqueta="Bodega"
      titulo={producto === "nuevo" ? "Nuevo producto" : "Editar producto"}
      subtitulo={nombre.trim() || undefined}
      icono={<IconoCategoria categoria={categoria} className="h-7 w-7" />}
      onCerrar={onCerrar}
    >
      <form onSubmit={guardar} className="flex flex-col gap-3.5">
        <div className="grid grid-cols-[7rem_1fr] gap-3">
          <Campo etiqueta="Código">
            {esPreestablecido ? (
              <p className="flex h-[46px] items-center rounded-xl bg-slate-100 px-3.5 text-base font-bold tabular-nums text-slate-700">{codigo}</p>
            ) : (
              <Entrada
                value={codigo}
                onChange={(v) => {
                  setCodigo(v.toUpperCase().slice(0, 12));
                  setError("");
                }}
                placeholder="PR-01"
              />
            )}
          </Campo>
          <Campo etiqueta="Nombre *">
            <Entrada value={nombre} onChange={setNombre} placeholder="Ej. Preiniciación kilos" required />
          </Campo>
        </div>
        {!esPreestablecido && codigosDisponibles.length > 0 && (
          <div className="-mt-1 flex flex-wrap gap-1.5">
            {codigosDisponibles.map((p) => (
              <button
                key={p.id}
                type="button"
                onClick={() => {
                  setCodigo(codigoDe(p));
                  setError("");
                }}
                className={`rounded-full px-2.5 py-1 text-[11px] font-bold tabular-nums ring-1 transition active:scale-95 ${
                  codigoLimpio === codigoDe(p) ? "bg-sky-900 text-white ring-sky-900" : "bg-white text-slate-600 ring-slate-200"
                }`}
              >
                {codigoDe(p)}
              </button>
            ))}
          </div>
        )}
        {!esPreestablecido && coincidencias.length > 0 && (
          <p className="rounded-xl bg-sky-50 px-3 py-2 text-xs text-sky-900 ring-1 ring-sky-100">
            🔗 Se asociará con {coincidencias.map(describir).join(", ")}
          </p>
        )}
        <div className="grid grid-cols-2 gap-3">
          <Campo etiqueta="Categoría">
            <SelectorCategoria value={categoria} onChange={setCategoria} />
          </Campo>
          <Campo etiqueta="Unidad">
            <Selector value={unidad} onChange={setUnidad} opciones={UNIDADES_BODEGA.map((u) => ({ valor: u, texto: u }))} />
          </Campo>
        </div>
        {unidad === "bultos" && (
          <Campo etiqueta="Kilos por bulto">
            <Entrada type="number" inputMode="decimal" min={1} step="any" value={kgBulto} onChange={setKgBulto} placeholder="40" />
          </Campo>
        )}
        <Campo etiqueta="Existencia mínima">
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
