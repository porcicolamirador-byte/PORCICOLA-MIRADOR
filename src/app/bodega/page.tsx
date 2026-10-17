"use client";

import { useEffect, useMemo, useState, type FormEvent } from "react";
import { useRouter } from "next/navigation";
import ModuloPage from "@/components/ModuloPage";
import { Boton, Campo, Chevron, Chips, Dato, Entrada, Hoja, IconoMas, Insignia, Selector, Vacio } from "@/components/ui";
import { avisar, confirmar } from "@/components/Dialogo";
import DialogoClave from "@/components/DialogoClave";
import { leerConfig } from "@/lib/config";
import Modal from "@/components/Modal";
import { CATEGORIAS_BODEGA, IconoCategoria } from "@/components/CatalogoProductos";
import {
  calcularInventario,
  formatoFecha,
  formatoPesos,
  guardarFacturas,
  guardarMovimientos,
  guardarSalidas,
  hoy,
  leerFacturas,
  leerMovimientos,
  leerProductos,
  leerSalidas,
  migrarBodegaAnterior,
  nuevoId,
  totalFactura,
  useVersionDatos,
  type CategoriaBodega,
  type ExistenciaProducto,
  type Factura,
  type ProductoBodega,
} from "@/lib/datos";

const num = (v: string) => {
  const n = Number(String(v).replace(",", "."));
  return Number.isFinite(n) ? n : 0;
};
const fmt = (n: number) => (Number.isInteger(n) ? String(n) : n.toFixed(1));

/** Categoría de Contabilidad según el tipo de producto */
const CATEGORIA_GASTO: Record<CategoriaBodega, string> = {
  Alimento: "Alimento",
  Medicamentos: "Medicamentos y vacunas",
  Vacunas: "Medicamentos y vacunas",
  Limpieza: "Otros gastos",
  Otros: "Otros gastos",
};

type Vista = "inventario" | "reponer" | "facturas";

export default function BodegaPage() {
  const router = useRouter();
  const version = useVersionDatos();
  const [vista, setVista] = useState<Vista>("inventario");
  const [busqueda, setBusqueda] = useState("");
  const [nuevaFactura, setNuevaFactura] = useState(false);
  const [pedirClave, setPedirClave] = useState(false);
  const [productoSel, setProductoSel] = useState<string | null>(null);
  const [facturaSel, setFacturaSel] = useState<string | null>(null);

  // Una sola vez: los artículos de la bodega anterior pasan al catálogo
  useEffect(() => {
    if (version >= 0) migrarBodegaAnterior();
  }, [version]);

  const datos = useMemo(() => {
    if (version < 0) return null;
    const inventario = calcularInventario();
    const facturas = leerFacturas().sort((a, b) => b.fecha.localeCompare(a.fecha) || b.numero.localeCompare(a.numero));
    return { inventario, facturas, productos: leerProductos() };
  }, [version]);

  const q = busqueda.trim().toLowerCase();
  const bajos = datos?.inventario.filter((i) => i.bajoMinimo) ?? [];
  const inventarioVisible = (vista === "reponer" ? bajos : datos?.inventario ?? [])
    .filter((i) => !q || i.producto.nombre.toLowerCase().includes(q))
    .sort((a, b) => a.producto.nombre.localeCompare(b.producto.nombre, "es"));
  const facturasVisibles = (datos?.facturas ?? []).filter(
    (f) => !q || f.numero.toLowerCase().includes(q) || (f.proveedor ?? "").toLowerCase().includes(q)
  );
  const mesActual = hoy().slice(0, 7);
  const compradoMes = (datos?.facturas ?? []).filter((f) => f.fecha.slice(0, 7) === mesActual).reduce((s, f) => s + totalFactura(f), 0);

  const conExistencia = datos?.inventario.filter((i) => i.existencia > 0).length ?? 0;
  const agotados = datos?.inventario.filter((i) => i.existencia <= 0).length ?? 0;
  const valorBodega = datos?.inventario.reduce((s, i) => s + Math.max(0, i.existencia) * i.ultimoPrecio, 0) ?? 0;
  const sinCatalogo = datos !== null && datos.productos.length === 0;
  const producto = datos?.inventario.find((i) => i.producto.id === productoSel) ?? null;
  const factura = datos?.facturas.find((f) => f.id === facturaSel) ?? null;

  return (
    <ModuloPage
      titulo="Bodega"
      subtitulo="Facturas, existencias y consumo de insumos"
      icono="📦"
      tono="teal"
      accion={
        <Boton onClick={() => setPedirClave(true)} className="px-3.5" disabled={sinCatalogo}>
          <IconoMas /> Factura
        </Boton>
      }
    >
      <div className="grid grid-cols-2 gap-2">
        <Dato
          titulo="Productos con existencia"
          valor={datos ? `${conExistencia} / ${datos.productos.length}` : "–"}
          detalle={agotados ? `${agotados} ${agotados === 1 ? "agotado" : "agotados"}` : "Ninguno agotado"}
        />
        <Dato titulo="Por reponer" valor={datos ? bajos.length : "–"} detalle={bajos.length ? "En el mínimo o menos" : "Todo en orden"} />
        <Dato titulo="Valor en bodega" valor={datos ? formatoPesos(valorBodega) : "–"} detalle="Según el último precio de compra" />
        <Dato titulo="Compras del mes" valor={datos ? formatoPesos(compradoMes) : "–"} />
      </div>

      {sinCatalogo ? (
        <Vacio
          titulo="Primero crea los productos"
          texto="Los productos de la bodega se definen en Ajustes → Ajustes (con código) → Productos de bodega. Después podrás ingresar facturas."
          accion={<Boton onClick={() => router.push("/ajustes")}>Ir a Ajustes</Boton>}
        />
      ) : (
        <>
          <input
            type="search"
            value={busqueda}
            onChange={(e) => setBusqueda(e.target.value)}
            placeholder={vista === "facturas" ? "Buscar por número o proveedor" : "Buscar producto"}
            className="w-full rounded-2xl bg-slate-100 px-4 py-3 text-base text-slate-900 placeholder:text-slate-400 focus:bg-white focus:outline-none focus:ring-2 focus:ring-emerald-600"
          />

          <Chips
            opciones={[
              { valor: "inventario", texto: "Inventario" },
              { valor: "reponer", texto: `Por reponer${bajos.length ? ` (${bajos.length})` : ""}` },
              { valor: "facturas", texto: `Facturas${datos?.facturas.length ? ` (${datos.facturas.length})` : ""}` },
            ]}
            valor={vista}
            onChange={setVista}
          />

          {datos === null ? (
            <div className="h-40 animate-pulse rounded-3xl bg-slate-100" />
          ) : vista === "facturas" ? (
            facturasVisibles.length === 0 ? (
              <Vacio
                titulo="Sin facturas"
                texto="Ingresa la factura de cada compra para que las existencias se actualicen solas."
                accion={<Boton onClick={() => setPedirClave(true)}>Ingresar factura</Boton>}
              />
            ) : (
              <ul className="divide-y divide-slate-100 overflow-hidden rounded-3xl bg-white ring-1 ring-slate-200/80">
                {facturasVisibles.map((f) => (
                  <li key={f.id}>
                    <button
                      type="button"
                      onClick={() => setFacturaSel(f.id)}
                      className="flex w-full items-center gap-3 px-4 py-3.5 text-left transition hover:bg-slate-50 active:bg-slate-100"
                    >
                      <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-teal-50 text-xl" aria-hidden="true">
                        🧾
                      </span>
                      <span className="min-w-0 flex-1">
                        <span className="block truncate text-sm font-semibold text-slate-900">Factura {f.numero}</span>
                        <span className="block truncate text-xs text-slate-500">
                          {formatoFecha(f.fecha, true)}
                          {f.proveedor ? ` · ${f.proveedor}` : ""} · {f.lineas.length}{" "}
                          {f.lineas.length === 1 ? "producto" : "productos"}
                        </span>
                      </span>
                      <span className="shrink-0 text-sm font-bold text-slate-900 tabular-nums">{formatoPesos(totalFactura(f))}</span>
                      <Chevron />
                    </button>
                  </li>
                ))}
              </ul>
            )
          ) : inventarioVisible.length === 0 ? (
            <p className="py-8 text-center text-sm text-slate-500">
              {vista === "reponer" ? "No hay productos por reponer. 👍" : "Ningún producto coincide con la búsqueda."}
            </p>
          ) : (
            <div className="flex flex-col gap-4">
              {CATEGORIAS_BODEGA.map(({ valor: cat }) => {
                const items = inventarioVisible.filter((i) => i.producto.categoria === cat);
                if (!items.length) return null;
                return (
                  <section key={cat}>
                    <h2 className="mb-2 flex items-center gap-1.5 px-1 text-[11px] font-semibold uppercase tracking-wider text-slate-400">
                      <IconoCategoria categoria={cat} className="h-4 w-4 text-[11px]" />
                      {cat} · {items.length}
                    </h2>
                    <div className="grid grid-cols-2 gap-2.5">
                      {items.map(({ producto: p, existencia, bajoMinimo, ultimoPrecio }) => {
                        const agotado = existencia <= 0;
                        const referencia = Math.max(p.minimo * 3, p.minimo + 1, 1);
                        const nivel = Math.max(0, Math.min(100, (existencia / referencia) * 100));
                        const colorBarra = agotado || bajoMinimo ? "bg-red-500" : existencia <= p.minimo * 1.5 ? "bg-amber-400" : "bg-emerald-500";
                        const estado = agotado
                          ? { t: "Agotado", c: "bg-red-600 text-white ring-red-600" }
                          : bajoMinimo
                          ? { t: "Reponer", c: "bg-red-50 text-red-700 ring-red-200" }
                          : existencia <= p.minimo * 1.5
                          ? { t: "Bajo", c: "bg-amber-50 text-amber-800 ring-amber-200" }
                          : { t: "Disponible", c: "bg-emerald-50 text-emerald-700 ring-emerald-200" };
                        return (
                          <button
                            key={p.id}
                            type="button"
                            onClick={() => setProductoSel(p.id)}
                            className={`flex flex-col gap-2 rounded-3xl bg-white p-3.5 text-left ring-1 transition active:scale-[0.98] ${
                              agotado || bajoMinimo ? "ring-red-200" : "ring-slate-200/80"
                            }`}
                          >
                            <div className="flex items-start justify-between gap-2">
                              <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl bg-teal-50 text-2xl">
                                <IconoCategoria categoria={p.categoria} className="h-8 w-8 text-2xl" />
                              </span>
                              <Insignia clase={estado.c}>{estado.t}</Insignia>
                            </div>
                            <p className="line-clamp-2 min-h-[2.5rem] text-sm font-semibold leading-snug text-slate-900">{p.nombre}</p>
                            <p className={`text-2xl font-bold leading-none tabular-nums ${agotado || bajoMinimo ? "text-red-600" : "text-slate-900"}`}>
                              {fmt(existencia)} <span className="text-xs font-semibold text-slate-500">{p.unidad}</span>
                            </p>
                            <div className="h-1.5 w-full overflow-hidden rounded-full bg-slate-100" role="img" aria-label={`Nivel ${Math.round(nivel)} %`}>
                              <div className={`h-full rounded-full ${colorBarra}`} style={{ width: `${Math.max(nivel, agotado ? 0 : 4)}%` }} />
                            </div>
                            <p className="text-[11px] text-slate-500">
                              Mín. {fmt(p.minimo)} {p.unidad}
                              {ultimoPrecio > 0 && existencia > 0 ? ` · ${formatoPesos(existencia * ultimoPrecio)}` : ""}
                            </p>
                          </button>
                        );
                      })}
                    </div>
                  </section>
                );
              })}
            </div>
          )}
        </>
      )}

      <p className="px-1 text-[11px] leading-relaxed text-slate-400">
        Las existencias se calculan con las facturas ingresadas menos las salidas por consumo. Los productos se administran
        en Ajustes avanzados.
      </p>

      {datos && (
        <DialogoClave
          abierto={pedirClave}
          titulo="Clave de facturas"
          mensaje="Ingresa el código para cargar una factura."
          aceptar="Continuar"
          onValidar={(codigo) => {
            if (codigo !== leerConfig().claveFacturas) return false;
            setPedirClave(false);
            setNuevaFactura(true);
            return true;
          }}
          onCerrar={() => setPedirClave(false)}
        />
        <NuevaFactura
          abierta={nuevaFactura}
          productos={datos.productos}
          facturas={datos.facturas}
          onCerrar={() => setNuevaFactura(false)}
        />
      )}
      {producto && <DetalleProducto item={producto} onCerrar={() => setProductoSel(null)} />}
      {factura && datos && (
        <DetalleFactura factura={factura} productos={datos.productos} onCerrar={() => setFacturaSel(null)} />
      )}
    </ModuloPage>
  );
}

/* ───────────────────── Nueva factura ───────────────────── */

interface LineaForm {
  clave: string;
  productoId: string;
  cantidad: string;
  valor: string;
}

const lineaVacia = (): LineaForm => ({ clave: nuevoId(), productoId: "", cantidad: "", valor: "" });

function NuevaFactura({
  abierta,
  productos,
  facturas,
  onCerrar,
}: {
  abierta: boolean;
  productos: ProductoBodega[];
  facturas: Factura[];
  onCerrar: () => void;
}) {
  const [numero, setNumero] = useState("");
  const [proveedor, setProveedor] = useState("");
  const [fecha, setFecha] = useState(hoy());
  const [nota, setNota] = useState("");
  const [lineas, setLineas] = useState<LineaForm[]>([lineaVacia()]);
  const [comoGasto, setComoGasto] = useState(true);
  const [error, setError] = useState("");

  const ordenados = [...productos].sort((a, b) => a.nombre.localeCompare(b.nombre, "es"));
  const unidadDe = (id: string) => productos.find((p) => p.id === id)?.unidad ?? "";
  const total = lineas.reduce((s, l) => s + num(l.cantidad) * num(l.valor), 0);
  const proveedores = Array.from(new Set(facturas.map((f) => f.proveedor).filter(Boolean))) as string[];

  const limpiar = () => {
    setNumero("");
    setProveedor("");
    setFecha(hoy());
    setNota("");
    setLineas([lineaVacia()]);
    setComoGasto(true);
    setError("");
  };
  const cerrar = () => {
    limpiar();
    onCerrar();
  };

  const cambiarLinea = (clave: string, cambio: Partial<LineaForm>) => {
    setLineas((ls) => ls.map((l) => (l.clave === clave ? { ...l, ...cambio } : l)));
    setError("");
  };

  const guardar = async (e: FormEvent) => {
    e.preventDefault();
    const n = numero.trim();
    if (!n) return setError("Escribe el número de la factura.");
    const validas = lineas.filter((l) => l.productoId && num(l.cantidad) > 0);
    if (validas.length === 0) return setError("Agrega al menos un producto con su cantidad.");
    if (lineas.some((l) => l.productoId && num(l.cantidad) <= 0)) return setError("Hay productos sin cantidad.");
    const ids = validas.map((l) => l.productoId);
    if (new Set(ids).size !== ids.length) return setError("Un producto está repetido; súmalo en una sola línea.");
    const repetida = facturas.find(
      (f) => f.numero.toLowerCase() === n.toLowerCase() && (f.proveedor ?? "").toLowerCase() === proveedor.trim().toLowerCase()
    );
    if (
      repetida &&
      !(await confirmar({
        titulo: "Factura ya ingresada",
        mensaje: `Ya existe la factura ${repetida.numero}${repetida.proveedor ? ` de ${repetida.proveedor}` : ""}. ¿Ingresarla de nuevo?`,
        aceptar: "Ingresar",
      }))
    )
      return;

    const factura: Factura = {
      id: nuevoId(),
      numero: n,
      proveedor: proveedor.trim() || undefined,
      fecha,
      nota: nota.trim() || undefined,
      lineas: validas.map((l) => ({ productoId: l.productoId, cantidad: num(l.cantidad), valorUnitario: num(l.valor) })),
    };
    const valor = totalFactura(factura);
    if (comoGasto && valor > 0) {
      const primero = productos.find((p) => p.id === factura.lineas[0].productoId);
      const movimientoId = nuevoId();
      guardarMovimientos([
        ...leerMovimientos(),
        {
          id: movimientoId,
          fecha,
          tipo: "gasto",
          categoria: primero ? CATEGORIA_GASTO[primero.categoria] : "Otros gastos",
          descripcion: `Factura ${n}${factura.proveedor ? ` · ${factura.proveedor}` : ""}`,
          monto: valor,
        },
      ]);
      factura.movimientoId = movimientoId;
    }
    guardarFacturas([...leerFacturas(), factura]);
    cerrar();
  };

  return (
    <Modal
      abierta={abierta}
      etiqueta="Bodega"
      titulo="Ingresar factura"
      subtitulo="Compra de insumos"
      icono="🧾"
      onCerrar={cerrar}
    >
      <form onSubmit={guardar} className="flex flex-col gap-3.5">
        <div className="grid grid-cols-2 gap-3">
          <Campo etiqueta="Número de factura *">
            <Entrada value={numero} onChange={(v) => { setNumero(v); setError(""); }} placeholder="Ej. FE-1234" required />
          </Campo>
          <Campo etiqueta="Fecha">
            <Entrada type="date" value={fecha} onChange={setFecha} required />
          </Campo>
        </div>
        <Campo etiqueta="Proveedor">
          <input
            list="proveedores-bodega"
            value={proveedor}
            onChange={(e) => setProveedor(e.target.value)}
            placeholder="Ej. Agropecuaria La Esperanza"
            className="block w-full min-w-0 rounded-xl bg-slate-50 px-3.5 py-2.5 text-base text-slate-900 ring-1 ring-slate-200 placeholder:text-slate-400 focus:bg-white focus:outline-none focus:ring-2 focus:ring-emerald-600"
          />
          <datalist id="proveedores-bodega">
            {proveedores.map((p) => (
              <option key={p} value={p} />
            ))}
          </datalist>
        </Campo>

        <div>
          <p className="mb-2 text-[13px] font-medium text-slate-700">Productos *</p>
          <div className="flex flex-col gap-2.5">
            {lineas.map((l, i) => (
              <div key={l.clave} className="min-w-0 rounded-2xl bg-slate-50 p-3 ring-1 ring-slate-200">
                <div className="mb-2 flex items-center justify-between">
                  <span className="text-xs font-semibold text-slate-500">Producto {i + 1}</span>
                  {lineas.length > 1 && (
                    <button
                      type="button"
                      onClick={() => setLineas((ls) => ls.filter((x) => x.clave !== l.clave))}
                      className="rounded-full px-2 py-0.5 text-xs text-slate-400 hover:bg-rose-50 hover:text-rose-600"
                    >
                      Quitar
                    </button>
                  )}
                </div>
                <Selector
                  value={l.productoId}
                  onChange={(v) => cambiarLinea(l.clave, { productoId: v })}
                  opciones={[
                    { valor: "", texto: "Elige un producto…" },
                    ...ordenados.map((p) => ({ valor: p.id, texto: `${p.nombre} (${p.unidad})` })),
                  ]}
                />
                <div className="mt-2 grid grid-cols-2 gap-2">
                  <Campo etiqueta={`Cantidad${unidadDe(l.productoId) ? ` (${unidadDe(l.productoId)})` : ""}`}>
                    <Entrada
                      type="number"
                      inputMode="decimal"
                      min={0}
                      step="any"
                      value={l.cantidad}
                      onChange={(v) => cambiarLinea(l.clave, { cantidad: v })}
                    />
                  </Campo>
                  <Campo etiqueta="Valor unitario ($)">
                    <Entrada
                      type="number"
                      inputMode="numeric"
                      min={0}
                      step="any"
                      value={l.valor}
                      onChange={(v) => cambiarLinea(l.clave, { valor: v })}
                    />
                  </Campo>
                </div>
                {num(l.cantidad) > 0 && num(l.valor) > 0 && (
                  <p className="mt-1.5 text-right text-xs text-slate-500">
                    Subtotal: <b className="text-slate-800">{formatoPesos(num(l.cantidad) * num(l.valor))}</b>
                  </p>
                )}
              </div>
            ))}
          </div>
          <button
            type="button"
            onClick={() => setLineas((ls) => [...ls, lineaVacia()])}
            className="mt-2 w-full rounded-2xl border border-dashed border-emerald-300 py-2.5 text-sm font-semibold text-emerald-700 hover:bg-emerald-50"
          >
            + Agregar otro producto
          </button>
        </div>

        <Campo etiqueta="Nota">
          <Entrada value={nota} onChange={setNota} placeholder="Opcional" />
        </Campo>

        <div className="flex items-center justify-between rounded-2xl bg-teal-50 px-4 py-3 ring-1 ring-teal-100">
          <span className="text-sm font-medium text-teal-900">Total de la factura</span>
          <span className="text-lg font-bold text-teal-900 tabular-nums">{formatoPesos(total)}</span>
        </div>
        <label className="flex items-center gap-2 text-sm text-slate-700">
          <input type="checkbox" checked={comoGasto} onChange={(e) => setComoGasto(e.target.checked)} className="h-5 w-5 accent-emerald-700" />
          Registrar el total como gasto en Contabilidad
        </label>

        {error && <p className="text-sm font-medium text-rose-600">{error}</p>}
        <Boton type="submit" className="mt-1 w-full py-3">
          Guardar factura
        </Boton>
      </form>
    </Modal>
  );
}

/* ───────────────────── Detalle de producto (salidas) ───────────────────── */

function DetalleProducto({ item, onCerrar }: { item: ExistenciaProducto; onCerrar: () => void }) {
  const { producto: p, existencia, bajoMinimo, movimientos } = item;
  const [salida, setSalida] = useState(false);
  const [cantidad, setCantidad] = useState("");
  const [fecha, setFecha] = useState(hoy());
  const [nota, setNota] = useState("");
  const [error, setError] = useState("");

  const volver = () => {
    setSalida(false);
    setCantidad("");
    setNota("");
    setFecha(hoy());
    setError("");
  };

  const registrar = (e: FormEvent) => {
    e.preventDefault();
    const n = num(cantidad);
    if (n <= 0) return setError("Escribe una cantidad mayor que cero.");
    if (n > existencia) return setError(`Solo hay ${fmt(existencia)} ${p.unidad} en bodega.`);
    guardarSalidas([...leerSalidas(), { id: nuevoId(), productoId: p.id, fecha, cantidad: n, nota: nota.trim() || undefined }]);
    volver();
  };

  const quitarSalida = async (salidaId: string) => {
    if (!(await confirmar({ titulo: "Eliminar salida", mensaje: "La cantidad volverá a sumar a la existencia.", aceptar: "Eliminar", destructivo: true }))) return;
    guardarSalidas(leerSalidas().filter((s) => s.id !== salidaId));
  };

  return (
    <Hoja abierta titulo={salida ? "Registrar salida" : p.nombre} onCerrar={salida ? volver : onCerrar}>
      {!salida ? (
        <div className="flex flex-col gap-4">
          <div className="flex items-center gap-3 rounded-2xl bg-teal-50/70 p-4 ring-1 ring-teal-100">
            <IconoCategoria categoria={p.categoria} className="h-12 w-12 shrink-0 text-3xl" />
            <div className="min-w-0 flex-1">
              <p className="text-xs text-slate-500">{p.categoria} · existencia</p>
              <p className={`text-3xl font-bold leading-tight tabular-nums ${bajoMinimo ? "text-red-600" : "text-slate-900"}`}>
                {fmt(existencia)} <span className="text-base font-semibold text-slate-500">{p.unidad}</span>
              </p>
              <p className="text-xs text-slate-500">
                Mínimo {fmt(p.minimo)} {p.unidad}
                {bajoMinimo ? " · hay que reponer" : ""}
              </p>
            </div>
          </div>
          <Boton variante="secundario" onClick={() => setSalida(true)} disabled={existencia <= 0}>
            − Registrar salida (consumo)
          </Boton>
          <div>
            <h3 className="mb-2 text-sm font-semibold text-slate-900">Movimientos</h3>
            {movimientos.length === 0 ? (
              <p className="text-sm text-slate-500">Sin movimientos. Ingresa una factura con este producto.</p>
            ) : (
              <ul className="flex flex-col gap-1.5">
                {movimientos.slice(0, 40).map((m, i) => (
                  <li key={i} className="flex items-center justify-between gap-3 rounded-xl bg-slate-50 px-3 py-2 text-sm">
                    <span className="min-w-0">
                      <span className={`font-semibold ${m.tipo === "entrada" ? "text-emerald-700" : "text-slate-800"}`}>
                        {m.tipo === "entrada" ? "+" : "−"}
                        {fmt(m.cantidad)} {p.unidad}
                      </span>
                      <span className="text-slate-500"> · {m.detalle}</span>
                    </span>
                    <span className="flex shrink-0 items-center gap-1">
                      <span className="text-xs text-slate-500">{formatoFecha(m.fecha)}</span>
                      {m.salidaId && (
                        <button
                          type="button"
                          onClick={() => quitarSalida(m.salidaId!)}
                          aria-label="Eliminar salida"
                          className="rounded-full px-1.5 text-slate-400 hover:text-rose-600"
                        >
                          ✕
                        </button>
                      )}
                    </span>
                  </li>
                ))}
              </ul>
            )}
          </div>
        </div>
      ) : (
        <form onSubmit={registrar} className="flex flex-col gap-3.5">
          <p className="text-sm text-slate-500">
            {p.nombre}: hay {fmt(existencia)} {p.unidad}
          </p>
          <div className="grid grid-cols-2 gap-3">
            <Campo etiqueta={`Cantidad (${p.unidad}) *`}>
              <Entrada type="number" inputMode="decimal" min={0} step="any" value={cantidad} onChange={setCantidad} required />
            </Campo>
            <Campo etiqueta="Fecha">
              <Entrada type="date" value={fecha} onChange={setFecha} required />
            </Campo>
          </div>
          <Campo etiqueta="Destino / nota">
            <Entrada value={nota} onChange={setNota} placeholder="Ej. Lote corral 3" />
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

/* ───────────────────── Detalle de factura ───────────────────── */

function DetalleFactura({ factura: f, productos, onCerrar }: { factura: Factura; productos: ProductoBodega[]; onCerrar: () => void }) {
  const eliminar = async () => {
    // No se permite si ya se consumió parte de lo que entró con esta factura
    const inventario = calcularInventario();
    const quedarianNegativos = f.lineas
      .map((l) => {
        const item = inventario.find((i) => i.producto.id === l.productoId);
        return item && item.existencia - l.cantidad < 0 ? item.producto.nombre : null;
      })
      .filter(Boolean);
    if (quedarianNegativos.length) {
      await avisar({
        titulo: "No se puede eliminar",
        mensaje: `Ya se registraron salidas de ${quedarianNegativos.join(", ")}. Elimina primero esas salidas para no dejar existencias negativas.`,
      });
      return;
    }
    if (
      !(await confirmar({
        titulo: `Eliminar factura ${f.numero}`,
        mensaje: `Las existencias se descontarán${f.movimientoId ? " y se borrará el gasto de Contabilidad" : ""}.`,
        aceptar: "Eliminar",
        destructivo: true,
      }))
    )
      return;
    guardarFacturas(leerFacturas().filter((x) => x.id !== f.id));
    if (f.movimientoId) guardarMovimientos(leerMovimientos().filter((m) => m.id !== f.movimientoId));
    onCerrar();
  };

  return (
    <Hoja abierta titulo={`Factura ${f.numero}`} onCerrar={onCerrar}>
      <div className="flex flex-col gap-4">
        <div className="rounded-2xl bg-slate-50 px-4 py-3 text-sm ring-1 ring-slate-100">
          <p className="text-slate-500">
            {formatoFecha(f.fecha, true)}
            {f.proveedor ? ` · ${f.proveedor}` : ""}
          </p>
          {f.nota && <p className="mt-1 text-xs italic text-slate-500">{f.nota}</p>}
        </div>
        <ul className="divide-y divide-slate-100 rounded-2xl ring-1 ring-slate-100">
          {f.lineas.map((l, i) => {
            const p = productos.find((x) => x.id === l.productoId);
            return (
              <li key={i} className="flex items-center gap-3 px-3.5 py-3">
                {p ? (
                  <IconoCategoria categoria={p.categoria} className="h-7 w-7 shrink-0 text-xl" />
                ) : (
                  <span className="text-xl" aria-hidden="true">📦</span>
                )}
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-semibold text-slate-900">{p?.nombre ?? "Producto eliminado"}</p>
                  <p className="text-xs text-slate-500">
                    {fmt(l.cantidad)} {p?.unidad ?? ""} × {formatoPesos(l.valorUnitario)}
                  </p>
                </div>
                <span className="shrink-0 text-sm font-semibold text-slate-900 tabular-nums">{formatoPesos(l.cantidad * l.valorUnitario)}</span>
              </li>
            );
          })}
        </ul>
        <div className="flex items-center justify-between rounded-2xl bg-teal-50 px-4 py-3 ring-1 ring-teal-100">
          <span className="text-sm font-medium text-teal-900">Total</span>
          <span className="text-lg font-bold text-teal-900 tabular-nums">{formatoPesos(totalFactura(f))}</span>
        </div>
        {f.movimientoId && <p className="text-center text-xs text-slate-500">Registrada como gasto en Contabilidad.</p>}
        <button type="button" onClick={eliminar} className="self-center rounded-full px-4 py-2 text-sm font-medium text-rose-600 hover:bg-rose-50">
          Eliminar factura
        </button>
      </div>
    </Hoja>
  );
}
