"use client";

import { useEffect, useMemo, useState, type FormEvent } from "react";
import { useRouter } from "next/navigation";
import ModuloPage from "@/components/ModuloPage";
import { Boton, Campo, Chevron, Chips, Entrada, IconoMas, Insignia, SeccionDesplegable, Selector, Vacio, EntradaPesos } from "@/components/ui";
import { avisar, confirmar } from "@/components/Dialogo";
import { puede } from "@/lib/nube";
import DialogoClave from "@/components/DialogoClave";
import { leerConfig } from "@/lib/config";
import Modal from "@/components/Modal";
import { calcularConsumoCerdas, type ConsumoAlimentoCerdas } from "@/lib/consumoCerdas";
import { CATEGORIAS_BODEGA, IconoCategoria, RecuadroCategoria } from "@/components/CatalogoProductos";
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
  leerProductosActivos,
  factorKg,
  leerSalidas,
  migrarBodegaAnterior,
  nuevoId,
  totalFactura,
  useVersionDatos,
  type CategoriaBodega,
  type ExistenciaProducto,
  type Factura,
  type ProductoBodega,
  eliminarSalida,
  kgDeCantidad,
  leerCorrales,
  leerLotes,
  registrarConsumoLote,
  formatoHora,
  horaActual,
  nombreLote,
  leerGastosProduccion,
  registrarGastoProduccion,
  CATEGORIAS_GASTO_PRODUCCION,
} from "@/lib/datos";
const avisarSinPermisoBodega = () =>
  avisar({ titulo: "Sin permiso", mensaje: "Tu usuario no tiene permiso para cargar facturas ni registrar salidas de bodega. Pídeselo al administrador." });

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
  // Si la clave de facturas está desactivada en ajustes, se abre directo
  const abrirFactura = () => {
    if (!puede("bodega")) return void avisarSinPermisoBodega();
    if (leerConfig().claveFacturasActiva) setPedirClave(true);
    else setNuevaFactura(true);
  };
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
    return { inventario, facturas, productos: leerProductos(), activos: leerProductosActivos() };
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

  const principales = datos?.inventario.filter((i) => !i.subproducto) ?? [];
  const conExistencia = principales.filter((i) => i.existencia > 0).length;
  const agotados = principales.filter((i) => !i.sinCompras && i.existencia <= 0).length;
  const valorBodega = principales.reduce((s, i) => s + Math.max(0, i.existencia) * i.ultimoPrecio, 0);
  const sinCatalogo = datos !== null && datos.activos.length === 0;
  const producto = datos?.inventario.find((i) => i.producto.id === productoSel) ?? null;
  const factura = datos?.facturas.find((f) => f.id === facturaSel) ?? null;

  return (
    <ModuloPage
      titulo="Bodega"
      subtitulo="Facturas, existencias y consumo de insumos"
      icono="📦"
      tono="teal"
      accion={
        <Boton onClick={abrirFactura} className="px-3.5" disabled={sinCatalogo}>
          <IconoMas /> Factura
        </Boton>
      }
    >
      {/* Resumen compacto: dos filas, valores en pesos completos */}
      <div className="grid grid-cols-2 overflow-hidden rounded-2xl bg-white ring-1 ring-slate-200/80 [&>*:nth-child(odd)]:border-r [&>*:nth-child(-n+2)]:border-b [&>*]:border-slate-200">
        {[
          { t: "Con existencia", v: datos ? String(conExistencia) : "–", alerta: agotados > 0 },
          { t: "Por reponer", v: datos ? String(bajos.length) : "–", alerta: bajos.length > 0 },
          { t: "En bodega", v: datos ? formatoPesos(valorBodega) : "–", alerta: false },
          { t: "Compras del mes", v: datos ? formatoPesos(compradoMes) : "–", alerta: false },
        ].map((c) => (
          <div key={c.t} className="min-w-0 px-3 py-2">
            <p className="truncate text-[11px] text-slate-500">{c.t}</p>
            <p className={`truncate text-base font-bold leading-tight tabular-nums ${c.alerta ? "text-red-600" : "text-slate-900"}`}>{c.v}</p>
          </div>
        ))}
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
            className="w-full rounded-2xl bg-slate-100 px-4 py-3 text-base text-slate-900 placeholder:text-slate-400 focus:bg-white focus:outline-none focus:ring-2 focus:ring-sky-600"
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

          {vista === "inventario" && !q && <TarjetaGastosProduccion />}
          {vista === "inventario" && !q && <TarjetaConsumoCerdas />}

          {datos === null ? (
            <div className="h-40 animate-pulse rounded-3xl bg-slate-100" />
          ) : vista === "facturas" ? (
            facturasVisibles.length === 0 ? (
              <Vacio
                titulo="Sin facturas"
                texto="Ingresa la factura de cada compra para que las existencias se actualicen solas."
                accion={<Boton onClick={abrirFactura}>Ingresar factura</Boton>}
              />
            ) : (
              <ul className="divide-y divide-slate-100 overflow-hidden rounded-3xl bg-white ring-1 ring-slate-200/80">
                {facturasVisibles.map((f) => (
                  <li key={f.id}>
                    <button
                      type="button"
                      onClick={() => setFacturaSel(f.id)}
                      className="flex w-full items-center gap-3 px-3.5 py-2.5 text-left transition hover:bg-slate-50 active:bg-slate-100"
                    >
                      <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-sky-50 text-base" aria-hidden="true">
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
            <div className="flex flex-col gap-3">
              {CATEGORIAS_BODEGA.map(({ valor: cat }) => {
                const items = inventarioVisible.filter((i) => i.producto.categoria === cat);
                if (!items.length) return null;
                return (
                  <section key={cat}>
                    <h2 className="mb-1.5 flex items-center gap-1.5 px-1 text-[11px] font-semibold uppercase tracking-wider text-slate-400">
                      <IconoCategoria categoria={cat} className="h-3.5 w-3.5" />
                      {cat} · {items.length}
                    </h2>
                    <div className="grid grid-cols-2 gap-2">
                      {items.map(({ producto: p, existencia, disponible, subproducto, bajoMinimo, sinCompras, ultimoPrecio }) => {
                        const nuevo = !subproducto && sinCompras;
                        const agotado = !subproducto && !nuevo && existencia <= 0;
                        const referencia = Math.max(p.minimo * 3, p.minimo + 1, 1);
                        const nivel = Math.max(0, Math.min(100, (existencia / referencia) * 100));
                        const colorBarra = agotado || bajoMinimo ? "bg-red-500" : existencia <= p.minimo * 1.5 ? "bg-amber-400" : "bg-sky-500";
                        const estado = subproducto
                          ? { t: "Subproducto", c: "bg-sky-50 text-sky-700 ring-sky-200" }
                          : nuevo
                          ? { t: "Sin compras", c: "bg-slate-100 text-slate-500 ring-slate-200" }
                          : agotado
                          ? { t: "Agotado", c: "bg-red-600 text-white ring-red-600" }
                          : bajoMinimo
                          ? { t: "Reponer", c: "bg-red-50 text-red-700 ring-red-200" }
                          : existencia <= p.minimo * 1.5
                          ? { t: "Bajo", c: "bg-amber-50 text-amber-800 ring-amber-200" }
                          : { t: "Disponible", c: "bg-sky-50 text-sky-700 ring-sky-200" };
                        return (
                          <button
                            key={p.id}
                            type="button"
                            onClick={() => setProductoSel(p.id)}
                            className={`flex flex-col gap-1.5 rounded-2xl bg-white p-2.5 text-left ring-1 transition active:scale-[0.98] ${
                              agotado || bajoMinimo ? "ring-red-200" : "ring-slate-200/80"
                            }`}
                          >
                            <div className="flex items-start justify-between gap-2">
                              <RecuadroCategoria categoria={p.categoria} tamano="sm" />
                              <Insignia clase={estado.c}>{estado.t}</Insignia>
                            </div>
                            <p className="line-clamp-2 text-[13px] font-semibold leading-tight text-slate-900">{p.nombre}</p>
                            <p className={`text-xl font-bold leading-none tabular-nums ${subproducto ? "text-sky-700" : agotado || bajoMinimo ? "text-red-600" : "text-slate-900"}`}>
                              {fmt(existencia)} <span className="text-xs font-semibold text-slate-500">{p.unidad}</span>
                            </p>
                            {subproducto ? (
                              <p className="text-[10px] leading-tight text-slate-500">
                                De {subproducto.principal} · quedan {fmt(Math.max(0, disponible))} {p.unidad}
                              </p>
                            ) : (
                            <>
                            <div className="h-1 w-full overflow-hidden rounded-full bg-slate-100" role="img" aria-label={`Nivel ${Math.round(nivel)} %`}>
                              <div className={`h-full rounded-full ${colorBarra}`} style={{ width: `${Math.max(nivel, agotado ? 0 : 4)}%` }} />
                            </div>
                            <p className="text-[10px] leading-tight text-slate-500">
                              Mín. {fmt(p.minimo)} {p.unidad}
                              {p.unidad === "bultos" && existencia > 0 ? ` · ${fmt(existencia * factorKg(p))} kg` : ""}
                              {ultimoPrecio > 0 && existencia > 0 ? ` · ${formatoPesos(existencia * ultimoPrecio)}` : ""}
                            </p>
                            </>
                            )}
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


      {datos && (
        <>
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
          productos={datos.activos}
          facturas={datos.facturas}
          onCerrar={() => setNuevaFactura(false)}
        />
        </>
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
            className="block w-full min-w-0 rounded-xl bg-slate-50 px-3.5 py-2.5 text-base text-slate-900 ring-1 ring-slate-200 placeholder:text-slate-400 focus:bg-white focus:outline-none focus:ring-2 focus:ring-sky-600"
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
                  <Campo etiqueta="Valor unitario">
                    <EntradaPesos value={l.valor} onChange={(v) => cambiarLinea(l.clave, { valor: v })} />
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
            className="mt-2 w-full rounded-2xl border border-dashed border-sky-300 py-2.5 text-sm font-semibold text-sky-700 hover:bg-sky-50"
          >
            + Agregar otro producto
          </button>
        </div>

        <Campo etiqueta="Nota">
          <Entrada value={nota} onChange={setNota} placeholder="Opcional" />
        </Campo>

        <div className="flex items-center justify-between rounded-2xl bg-sky-50 px-4 py-3 ring-1 ring-sky-100">
          <span className="text-sm font-medium text-sky-900">Total de la factura</span>
          <span className="text-lg font-bold text-sky-900 tabular-nums">{formatoPesos(total)}</span>
        </div>
        <label className="flex items-center gap-2 text-sm text-slate-700">
          <input type="checkbox" checked={comoGasto} onChange={(e) => setComoGasto(e.target.checked)} className="h-5 w-5 accent-sky-700" />
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
  const { producto: p, existencia, disponible, subproducto, bajoMinimo, movimientos } = item;
  const [salida, setSalida] = useState(false);
  const [cantidad, setCantidad] = useState("");
  const [fecha, setFecha] = useState(hoy());
  const [hora, setHora] = useState(horaActual());
  const [nota, setNota] = useState("");
  const [destino, setDestino] = useState("");
  const [error, setError] = useState("");
  const libre = leerConfig().permitirSinInventario;
  // Lotes de engorde activos: destino del consumo (solo los que ya tienen corral)
  const lotes = salida ? leerLotes().filter((l) => l.activo) : [];
  const corrales = salida ? leerCorrales() : [];

  const volver = () => {
    setSalida(false);
    setCantidad("");
    setNota("");
    setDestino("");
    setHora(horaActual());
    setFecha(hoy());
    setError("");
  };

  const registrar = (e: FormEvent) => {
    e.preventDefault();
    const n = num(cantidad);
    if (n <= 0) return setError("Escribe una cantidad mayor que cero.");
    if (!libre && n > disponible) return setError(`Solo hay ${fmt(disponible)} ${p.unidad} en bodega.`);
    if (!destino) return setError("Elige el destino del consumo.");
    if (destino === "otro") {
      guardarSalidas([...leerSalidas(), { id: nuevoId(), productoId: p.id, fecha, hora, cantidad: n, nota: nota.trim() || undefined }]);
    } else {
      // Consumo de un lote: queda también en el alimento del lote
      registrarConsumoLote({ loteId: destino, productoId: p.id, cantidad: n, fecha, hora });
    }
    volver();
  };

  const quitarSalida = async (salidaId: string) => {
    if (!(await confirmar({ titulo: "Eliminar salida", mensaje: "La cantidad volverá a sumar a la existencia. Si fue consumo de un lote, también se quita de su alimento.", aceptar: "Eliminar", destructivo: true }))) return;
    eliminarSalida(salidaId);
  };

  return (
    <Modal
      abierta
      etiqueta={salida ? p.nombre : "Bodega"}
      titulo={salida ? "Registrar salida" : p.nombre}
      subtitulo={salida ? undefined : `${p.codigo ? `${p.codigo} · ` : ""}${p.categoria}`}
      icono={<IconoCategoria categoria={p.categoria} className="h-7 w-7" />}
      onCerrar={salida ? volver : onCerrar}
    >
      {!salida ? (
        <div className="flex flex-col gap-4">
          <div className="flex items-center gap-3 rounded-2xl bg-sky-50/70 p-4 ring-1 ring-sky-100">
            <RecuadroCategoria categoria={p.categoria} tamano="lg" />
            <div className="min-w-0 flex-1">
              <p className="text-xs text-slate-500">{p.categoria} · {subproducto ? "consumido (subproducto)" : "existencia"}</p>
              <p className={`text-3xl font-bold leading-tight tabular-nums ${subproducto ? "text-sky-700" : bajoMinimo ? "text-red-600" : "text-slate-900"}`}>
                {fmt(existencia)} <span className="text-base font-semibold text-slate-500">{p.unidad}</span>
              </p>
              <p className="text-xs text-slate-500">
                {subproducto
                  ? `Se descuenta de ${subproducto.principal} · quedan ${fmt(Math.max(0, disponible))} ${p.unidad}`
                  : `Mínimo ${fmt(p.minimo)} ${p.unidad}${bajoMinimo ? " · hay que reponer" : ""}`}
              </p>
            </div>
          </div>
          <Boton variante="secundario" onClick={() => (puede("bodega") ? setSalida(true) : void avisarSinPermisoBodega())} disabled={!libre && disponible <= 0}>
            − Registrar salida (consumo)
          </Boton>
          <SeccionDesplegable titulo="Movimientos" cantidad={movimientos.length}>
            {movimientos.length === 0 ? (
              <p className="text-sm text-slate-500">Sin movimientos. Ingresa una factura con este producto.</p>
            ) : (
              <ul className="flex flex-col gap-1.5">
                {movimientos.slice(0, 40).map((m, i) => (
                  <li key={i} className="flex items-center justify-between gap-3 rounded-xl bg-slate-50 px-3 py-2 text-sm">
                    <span className="min-w-0">
                      <span className={`font-semibold ${m.tipo === "entrada" ? "text-sky-700" : "text-slate-800"}`}>
                        {m.tipo === "entrada" ? "+" : "−"}
                        {fmt(m.cantidad)} {p.unidad}
                      </span>
                      <span className="text-slate-500"> · {m.detalle}</span>
                    </span>
                    <span className="flex shrink-0 items-center gap-1">
                      <span className="text-right text-xs leading-tight text-slate-500">
                        {formatoFecha(m.fecha)}
                        {m.hora && <span className="block text-[10px]">{formatoHora(m.hora)}</span>}
                      </span>
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
          </SeccionDesplegable>
        </div>
      ) : (
        <form onSubmit={registrar} className="flex flex-col gap-3.5">
          <p className="text-sm text-slate-500">
            {p.nombre}: hay {fmt(disponible)} {p.unidad}
          </p>
          <Campo etiqueta={`Cantidad (${p.unidad}) *`}>
            <Entrada type="number" inputMode="decimal" min={0} step="any" value={cantidad} onChange={setCantidad} required />
          </Campo>
          <div className="grid grid-cols-2 gap-3">
            <Campo etiqueta="Fecha">
              <Entrada type="date" value={fecha} onChange={setFecha} required />
            </Campo>
            <Campo etiqueta="Hora">
              <Entrada type="time" value={hora} onChange={setHora} required />
            </Campo>
          </div>
          <Campo etiqueta="Destino *">
            <Selector
              value={destino}
              onChange={(v) => {
                setDestino(v);
                setError("");
              }}
              opciones={[
                { valor: "", texto: "Selecciona el lote" },
                ...lotes.map((l) => {
                  const c = corrales.find((x) => x.id === l.corralId);
                  return {
                    valor: l.id,
                    texto: c ? `${nombreLote(l)} · corral ${c.codigo} · ${l.vivos} animales` : `${nombreLote(l)} · sin corral asignado`,
                    deshabilitado: !c,
                  };
                }),
                { valor: "otro", texto: "Otro consumo (sin lote)" },
              ]}
            />
          </Campo>
          {lotes.length > 0 && lotes.every((l) => !corrales.some((c) => c.id === l.corralId)) && (
            <p className="text-xs text-slate-500">Para elegir un lote, primero asígnale su corral en Engorde.</p>
          )}
          {destino === "otro" && (
            <Campo etiqueta="Nota">
              <Entrada value={nota} onChange={setNota} placeholder="Dato" />
            </Campo>
          )}
          {destino && destino !== "otro" && num(cantidad) > 0 && kgDeCantidad(num(cantidad), p.unidad, p.kgPorUnidad) > 0 && (
            <p className="text-xs text-slate-500">
              Se registrarán {fmt(kgDeCantidad(num(cantidad), p.unidad, p.kgPorUnidad))} kg de alimento en el lote.
            </p>
          )}
          {error && <p className="text-sm font-medium text-rose-600">{error}</p>}
          <div className="mt-1 grid grid-cols-2 gap-2">
            <Boton variante="secundario" onClick={volver}>Cancelar</Boton>
            <Boton type="submit" disabled={!destino}>Guardar</Boton>
          </div>
        </form>
      )}
    </Modal>
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
        return item && item.disponible - l.cantidad < 0 ? item.producto.nombre : null;
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
    <Modal
      abierta
      etiqueta="Bodega · Factura"
      titulo={`Factura ${f.numero}`}
      subtitulo={`${formatoFecha(f.fecha, true)}${f.proveedor ? ` · ${f.proveedor}` : ""}`}
      icono="🧾"
      onCerrar={onCerrar}
    >
      <div className="flex flex-col gap-4">
        <div className="flex items-center justify-between rounded-2xl bg-sky-50 px-4 py-3 ring-1 ring-sky-100">
          <span className="text-sm font-medium text-sky-900">Total</span>
          <span className="text-lg font-bold text-sky-900 tabular-nums">{formatoPesos(totalFactura(f))}</span>
        </div>
        {f.nota && <p className="rounded-xl bg-slate-50 px-3 py-2 text-xs italic text-slate-500">{f.nota}</p>}
        <SeccionDesplegable titulo="Productos" cantidad={f.lineas.length}>
        <ul className="divide-y divide-slate-100 bg-white">
          {f.lineas.map((l, i) => {
            const p = productos.find((x) => x.id === l.productoId);
            return (
              <li key={i} className="flex items-center gap-3 px-3.5 py-3">
                {p ? (
                  <RecuadroCategoria categoria={p.categoria} tamano="md" />
                ) : (
                  <RecuadroCategoria categoria="Otros" tamano="md" />
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
        </SeccionDesplegable>
        {f.movimientoId && <p className="text-center text-xs text-slate-500">Registrada como gasto en Contabilidad.</p>}
        <button type="button" onClick={eliminar} className="self-center rounded-full px-4 py-2 text-sm font-medium text-rose-600 hover:bg-rose-50">
          Eliminar factura
        </button>
      </div>
    </Modal>
  );
}

/* ───────────── Gastos de producción (módulo fijo de Bodega) ───────────── */

/* Consumo aproximado de alimento de las cerdas (reglas en Ajustes ocultos) */
const bultosTexto = (kg: number, kgBulto: number) => {
  const b = kg / (kgBulto || 40);
  return `${b.toLocaleString("es-CO", { maximumFractionDigits: b < 10 ? 1 : 0 })} bulto${Math.abs(b - 1) < 0.05 ? "" : "s"}`;
};
const kgTexto = (kg: number) => `${kg.toLocaleString("es-CO", { maximumFractionDigits: 1 })} kg`;

function TarjetaConsumoCerdas() {
  const version = useVersionDatos();
  const [abierta, setAbierta] = useState(false);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  const datos = useMemo(() => (version < 0 ? null : calcularConsumoCerdas()), [version]);
  if (!datos || datos.cerdas === 0) return null;
  const minimo = [datos.gestacion, datos.lactancia].filter((a) => a.dias !== null).sort((a, b) => a.dias! - b.dias!)[0];
  const kgDia = datos.gestacion.kgDia + datos.lactancia.kgDia;

  return (
    <>
      <button
        type="button"
        onClick={() => setAbierta(true)}
        className="flex w-full items-center gap-3 rounded-2xl bg-white p-3 text-left ring-1 ring-slate-200/80 transition active:scale-[0.99]"
      >
        <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-slate-100 text-slate-700" aria-hidden="true">
          <IconoCategoria categoria="Alimento" className="h-5 w-5" />
        </span>
        <span className="min-w-0 flex-1">
          <span className="flex items-center gap-1.5">
            <span className="truncate text-[15px] font-semibold text-slate-900">Consumo de cerdas</span>
            <span className="shrink-0 rounded-full bg-sky-50 px-1.5 py-0.5 text-[10px] font-semibold text-sky-700 ring-1 ring-sky-200">Aprox.</span>
          </span>
          <span className="block truncate text-xs text-slate-500">
            {datos.cerdas} cerdas · {kgTexto(kgDia)} al día
          </span>
        </span>
        <span className="shrink-0 text-right">
          <span className={`block text-sm font-bold tabular-nums ${minimo && minimo.dias! <= 7 ? "text-orange-600" : "text-slate-900"}`}>
            {minimo ? `${minimo.dias} días` : "–"}
          </span>
          <span className="block text-[10px] text-slate-400">alcanza</span>
        </span>
        <Chevron />
      </button>
      {abierta && (
        <Modal abierta etiqueta="Bodega" titulo="Consumo de cerdas" subtitulo="Aproximado según las reglas de Ajustes" icono="🐷" onCerrar={() => setAbierta(false)}>
          <div className="flex flex-col gap-3">
            <BloqueConsumo titulo="Alimento de gestación" a={datos.gestacion} />
            <BloqueConsumo titulo="Alimento de lactancia" a={datos.lactancia} />
            {leerConfig().consumoCerdas.descontarGestacion && (
              <p className="rounded-xl bg-sky-50 px-3 py-2 text-[11px] leading-snug text-sky-800 ring-1 ring-sky-100">
                Los dos alimentos se descuentan solos de la bodega cada día (salidas «Consumo automático»).
              </p>
            )}
            <p className="px-1 text-[11px] leading-snug text-slate-500">
              Es una estimación. Las cantidades y el día de cambio se ajustan en Ajustes → Consumo de cerdas.
            </p>
          </div>
        </Modal>
      )}
    </>
  );
}

function BloqueConsumo({ titulo, a }: { titulo: string; a: ConsumoAlimentoCerdas }) {
  const alerta = a.dias !== null && a.dias <= 7;
  return (
    <section className="overflow-hidden rounded-2xl bg-white ring-1 ring-slate-200/80">
      <div className="flex items-center gap-2 px-3.5 pb-2 pt-3">
        <span className="shrink-0 rounded-md bg-sky-50 px-1.5 py-0.5 text-[11px] font-bold tabular-nums text-sky-800 ring-1 ring-sky-200">{a.codigo}</span>
        <div className="min-w-0 flex-1">
          <p className="text-[11px] font-semibold uppercase tracking-wider text-slate-400">{titulo}</p>
          <p className="truncate text-sm font-semibold text-slate-900">{a.nombre}</p>
        </div>
      </div>
      <div className="grid grid-cols-3 gap-1.5 px-3.5 pb-3 text-center">
        <div className="rounded-xl bg-slate-50 px-1.5 py-2">
          <p className="text-[10px] font-medium uppercase tracking-wide text-slate-400">Al día</p>
          <p className="text-[13px] font-bold tabular-nums text-slate-900">{kgTexto(a.kgDia)}</p>
          <p className="text-[10px] text-slate-500">{bultosTexto(a.kgDia, a.kgBulto)}</p>
        </div>
        <div className="rounded-xl bg-slate-50 px-1.5 py-2">
          <p className="text-[10px] font-medium uppercase tracking-wide text-slate-400">Al mes</p>
          <p className="text-[13px] font-bold tabular-nums text-slate-900">{bultosTexto(a.kgDia * 30, a.kgBulto)}</p>
          <p className="text-[10px] text-slate-500">{kgTexto(a.kgDia * 30)}</p>
        </div>
        <div className={`rounded-xl px-1.5 py-2 ${alerta ? "bg-orange-50" : "bg-sky-50"}`}>
          <p className={`text-[10px] font-medium uppercase tracking-wide ${alerta ? "text-orange-600" : "text-sky-700"}`}>Alcanza</p>
          <p className={`text-[13px] font-bold tabular-nums ${alerta ? "text-orange-600" : "text-sky-900"}`}>
            {a.dias !== null ? `${a.dias} días` : "–"}
          </p>
          <p className="text-[10px] text-slate-500">{a.existenciaKg !== null ? `hay ${bultosTexto(a.existenciaKg, a.kgBulto)}` : "sin producto"}</p>
        </div>
      </div>
      <ul className="divide-y divide-slate-100 border-t border-slate-100">
        {a.grupos.map((g) => (
          <li key={g.texto} className="flex items-center gap-2 px-3.5 py-2 text-sm">
            <span className="min-w-0 flex-1 truncate text-slate-700">{g.texto}</span>
            <span className="shrink-0 text-xs text-slate-500">{g.cerdas} cerda{g.cerdas === 1 ? "" : "s"}</span>
            <span className="w-16 shrink-0 text-right font-semibold tabular-nums text-slate-900">{kgTexto(g.kg)}</span>
          </li>
        ))}
      </ul>
    </section>
  );
}

function TarjetaGastosProduccion() {
  const version = useVersionDatos();
  const [abierta, setAbierta] = useState(false);
  const mesActual = hoy().slice(0, 7);
  const gastos = version < 0 ? [] : leerGastosProduccion();
  const delMes = gastos.filter((g) => g.fecha.slice(0, 7) === mesActual);
  const totalMes = delMes.reduce((s, g) => s + g.monto, 0);

  return (
    <>
      <button
        type="button"
        onClick={() => setAbierta(true)}
        className="flex w-full items-center gap-3 rounded-2xl bg-white p-3 text-left ring-1 ring-slate-200/80 transition active:scale-[0.99]"
      >
        <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-slate-100 text-slate-700" aria-hidden="true">
          <svg viewBox="0 0 24 24" className="h-5 w-5" fill="none" stroke="currentColor" strokeWidth={1.8} strokeLinecap="round" strokeLinejoin="round">
            <path d="M6 3h12v18l-3-2-3 2-3-2-3 2z" />
            <path d="M9 8h6M9 12h6M9 16h3" />
          </svg>
        </span>
        <span className="min-w-0 flex-1">
          <span className="flex items-center gap-1.5">
            <span className="truncate text-[15px] font-semibold text-slate-900">Gastos de producción</span>
            <span className="shrink-0 rounded-full bg-sky-50 px-1.5 py-0.5 text-[10px] font-semibold text-sky-700 ring-1 ring-sky-200">Fijo</span>
          </span>
          <span className="block truncate text-xs text-slate-500">
            Insumos, medicamentos y más · {delMes.length} este mes
          </span>
        </span>
        <span className="shrink-0 text-right">
          <span className="block text-sm font-bold tabular-nums text-slate-900">{formatoPesos(totalMes)}</span>
          <span className="block text-[10px] text-slate-400">este mes</span>
        </span>
        <Chevron />
      </button>
      {abierta && <HojaGastosProduccion onCerrar={() => setAbierta(false)} />}
    </>
  );
}

function HojaGastosProduccion({ onCerrar }: { onCerrar: () => void }) {
  const version = useVersionDatos();
  const [nuevo, setNuevo] = useState(false);
  const [descripcion, setDescripcion] = useState("");
  const [cantidad, setCantidad] = useState("");
  const [valor, setValor] = useState("");
  const [categoria, setCategoria] = useState(CATEGORIAS_GASTO_PRODUCCION[0]);
  const [fecha, setFecha] = useState(hoy());
  const gastos = version < 0 ? [] : leerGastosProduccion();
  const total = gastos.reduce((s, g) => s + g.monto, 0);
  const monto = Number(valor.replace(/\D/g, "")) || 0;

  const abrirNuevo = () => {
    if (!puede("bodega")) return void avisarSinPermisoBodega();
    setNuevo(true);
  };

  const guardar = (e: FormEvent) => {
    e.preventDefault();
    if (!registrarGastoProduccion({ descripcion, cantidad, valor: monto, categoria, fecha })) return;
    setDescripcion("");
    setCantidad("");
    setValor("");
    setCategoria(CATEGORIAS_GASTO_PRODUCCION[0]);
    setFecha(hoy());
    setNuevo(false);
  };

  const eliminar = async (id: string, texto: string) => {
    if (!(await confirmar({ titulo: "Eliminar gasto", mensaje: `${texto}. También se quitará de Contabilidad.`, aceptar: "Eliminar", destructivo: true }))) return;
    guardarMovimientos(leerMovimientos().filter((m) => m.id !== id));
  };

  return (
    <Modal
      abierta
      etiqueta="Bodega"
      titulo={nuevo ? "Nuevo gasto" : "Gastos de producción"}
      subtitulo={nuevo ? "Gastos de producción" : `${gastos.length} registrados`}
      icono="🧾"
      onCerrar={nuevo ? () => setNuevo(false) : onCerrar}
    >
      {nuevo ? (
        <form onSubmit={guardar} className="flex flex-col gap-3.5">
          <Campo etiqueta="Producto o servicio">
            <Entrada value={descripcion} onChange={(v) => setDescripcion(v.slice(0, 80))} placeholder="Dato" required />
          </Campo>
          <div className="grid grid-cols-2 gap-3">
            <Campo etiqueta="Cantidad">
              <Entrada value={cantidad} onChange={(v) => setCantidad(v.slice(0, 40))} placeholder="Dato" />
            </Campo>
            <Campo etiqueta="Valor total">
              <EntradaPesos value={valor} onChange={setValor} placeholder="Dato" required />
            </Campo>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <Campo etiqueta="Categoría">
              <Selector value={categoria} onChange={setCategoria} opciones={CATEGORIAS_GASTO_PRODUCCION.map((c) => ({ valor: c, texto: c }))} />
            </Campo>
            <Campo etiqueta="Fecha">
              <Entrada type="date" value={fecha} onChange={setFecha} required />
            </Campo>
          </div>
          <p className="text-xs text-slate-500">Se suma como gasto en la contabilidad general de la granja.</p>
          <div className="grid grid-cols-2 gap-2">
            <Boton variante="secundario" onClick={() => setNuevo(false)}>
              Cancelar
            </Boton>
            <Boton type="submit" disabled={!descripcion.trim() || monto <= 0}>
              Guardar
            </Boton>
          </div>
        </form>
      ) : (
        <div className="flex flex-col gap-3">
          <div className="flex items-center justify-between rounded-2xl bg-sky-50 px-4 py-3 ring-1 ring-sky-100">
            <span className="text-sm text-sky-900">Total registrado</span>
            <span className="text-lg font-bold tabular-nums text-sky-900">{formatoPesos(total)}</span>
          </div>
          <Boton onClick={abrirNuevo} className="w-full py-3">
            <IconoMas /> Registrar gasto
          </Boton>
          {gastos.length === 0 ? (
            <p className="rounded-xl bg-slate-50 px-3 py-6 text-center text-sm text-slate-500">Aún no hay gastos de producción.</p>
          ) : (
            <SeccionDesplegable titulo="Registros" cantidad={gastos.length}>
            <ul className="divide-y divide-slate-100 bg-white">
              {gastos.map((g) => (
                <li key={g.id} className="flex items-center gap-2.5 px-3 py-2">
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-[13px] font-semibold text-slate-900">{g.descripcion}</p>
                    <p className="truncate text-[11px] text-slate-500">
                      {g.categoria} · {formatoFecha(g.fecha)}
                    </p>
                  </div>
                  <span className="shrink-0 text-[13px] font-semibold tabular-nums text-slate-900">{formatoPesos(g.monto)}</span>
                  <button
                    type="button"
                    onClick={() => void eliminar(g.id, g.descripcion)}
                    aria-label={`Eliminar ${g.descripcion}`}
                    className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full text-slate-300 active:bg-rose-50 active:text-rose-600"
                  >
                    <svg viewBox="0 0 20 20" className="h-3.5 w-3.5" fill="none" stroke="currentColor" strokeWidth={2.2} strokeLinecap="round" aria-hidden="true">
                      <path d="M5 5l10 10M15 5L5 15" />
                    </svg>
                  </button>
                </li>
              ))}
            </ul>
            </SeccionDesplegable>
          )}
        </div>
      )}
    </Modal>
  );
}
