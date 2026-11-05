"use client";

import { useEffect, useMemo, useState, type FormEvent } from "react";
import { useRouter } from "next/navigation";
import ModuloPage from "@/components/ModuloPage";
import { Boton, Campo, Chevron, Chips, Entrada, IconoMas, Insignia, SeccionDesplegable, Selector, Vacio, EntradaPesos, CLASE_SELECTOR } from "@/components/ui";
import { avisar, confirmar } from "@/components/Dialogo";
import CampoFactura from "@/components/CampoFactura";
import { puede } from "@/lib/nube";
import DialogoClave from "@/components/DialogoClave";
import { leerConfig } from "@/lib/config";
import Modal from "@/components/Modal";
import SelectorApp from "@/components/SelectorApp";
import { generarPdfSalidas } from "@/lib/pdfSalidas";
import { cargarLogoJpeg, entregarPdf } from "@/lib/pdfFicha";
import { granjaActual, leerGranjas, nombreGranjaActual } from "@/lib/sincronizar";
import PagoFactura, { PagoCredito } from "@/components/PagoFactura";
import { calcularConsumoCerdas, type ConsumoAlimentoCerdas } from "@/lib/consumoCerdas";
import { CATEGORIAS_BODEGA, IconoCategoria, RecuadroCategoria } from "@/components/CatalogoProductos";
import {
  calcularInventario,
  codigoDe,
  devolverPrestamo,
  devolverMedicamento,
  leerExistenciasGranjas,
  facturasDeGastos,
  tomarPrestado,
  gratificarPrestamo,
  type ExistenciasGranja,
  leerPrestamos,
  leerPrestamosMedicamento,
  medicamentosRegistrados,
  pendientePrestamoMed,
  prestarMedicamento,
  convertirUnidad,
  type PrestamoMedicamento,
  pendientePrestamo,
  prestarProducto,
  type PrestamoBodega,
  formatoFecha,
  formatoPesos,
  guardarFacturas,
  guardarMovimientos,
  guardarSalidas,
  hoy,
  leerFacturas,
  leerMovimientos,
  leerCuentasPorPagar,
  guardarCuentasPorPagar,
  leerProductos,
  leerProductosActivos,
  factorKg,
  leerSalidas,
  migrarBodegaAnterior,
  nuevoId,
  totalFactura,
  trazabilidadSalidas,
  recontabilizarSinExistencia,
  saldoFactura,
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
  eliminarGastoProduccion,
  registrarGastoProduccion,
  CATEGORIAS_GASTO_PRODUCCION,
  UNIDADES_VACUNA,
  textoCategoriaProduccion,
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

/** Orden fijo de los alimentos en Bodega; los demás productos van después, por nombre */
const ORDEN_BODEGA = ["PR-01", "IN-01", "ML-01", "MC-01", "CG-01", "CL-01"];
const posicionBodega = (p: ProductoBodega) => {
  const i = ORDEN_BODEGA.indexOf(codigoDe(p));
  return i < 0 ? ORDEN_BODEGA.length : i;
};

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
  const [facturaGastoSel, setFacturaGastoSel] = useState<string | null>(null);

  // Una sola vez: los artículos de la bodega anterior pasan al catálogo
  useEffect(() => {
    if (version >= 0) migrarBodegaAnterior();
  }, [version]);

  const datos = useMemo(() => {
    if (version < 0) return null;
    const inventario = calcularInventario();
    // En orden de ingreso: la última factura ingresada primero (el id empieza con la hora de creación)
    const facturas = leerFacturas().sort((a, b) => (a.id < b.id ? 1 : a.id > b.id ? -1 : 0));
    return { inventario, facturas, productos: leerProductos(), activos: leerProductosActivos() };
  }, [version]);

  const q = busqueda.trim().toLowerCase();
  const bajos = datos?.inventario.filter((i) => i.bajoMinimo) ?? [];
  const inventarioVisible = (vista === "reponer" ? bajos : datos?.inventario ?? [])
    .filter((i) => !q || i.producto.nombre.toLowerCase().includes(q))
    .sort((a, b) => posicionBodega(a.producto) - posicionBodega(b.producto) || a.producto.nombre.localeCompare(b.producto.nombre, "es"));
  const facturasVisibles = (datos?.facturas ?? []).filter(
    (f) => !q || f.numero.toLowerCase().includes(q) || (f.proveedor ?? "").toLowerCase().includes(q)
  );
  // Facturas de gastos de producción y genética (no mueven inventario)
  const otrasFacturas = (version < 0 ? [] : facturasDeGastos())
    .filter((f) => !q || f.numero.toLowerCase().includes(q) || f.descripcion.toLowerCase().includes(q))
    .sort((a, b) => b.fecha.localeCompare(a.fecha));
  const mesActual = hoy().slice(0, 7);
  const compradoMes = (datos?.facturas ?? []).filter((f) => f.fecha.slice(0, 7) === mesActual).reduce((s, f) => s + totalFactura(f), 0);

  const principales = datos?.inventario.filter((i) => !i.subproducto) ?? [];
  const conExistencia = principales.filter((i) => i.existencia > 0).length;
  const agotados = principales.filter((i) => !i.sinCompras && i.existencia <= 0).length;
  const valorBodega = principales.reduce((s, i) => s + Math.max(0, i.existencia) * i.ultimoPrecio, 0);
  const sinCatalogo = datos !== null && datos.activos.length === 0;
  const producto = datos?.inventario.find((i) => i.producto.id === productoSel) ?? null;
  // Días que alcanza el alimento de las cerdas (por código), para avisar en naranja
  const consumoCerdas = useMemo(() => (datos ? calcularConsumoCerdas() : null), [datos]);
  const diasAlimento = new Map<string, number | null>(
    consumoCerdas ? [consumoCerdas.gestacion, consumoCerdas.lactancia].map((a) => [a.codigo, a.existenciaKg !== null && a.existenciaKg <= 0.01 ? 0 : a.dias] as const) : [],
  );
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

          {vista === "inventario" && !q && <BotonTomarPrestado />}
          {vista === "inventario" && !q && <AvisosPrestamos />}
          {vista === "inventario" && !q && <TarjetaGastosProduccion />}
          {vista === "inventario" && !q && <TarjetaConsumoCerdas />}
          {vista === "inventario" && !q && <SalidasALotes />}

          {datos === null ? (
            <div className="h-40 animate-pulse rounded-3xl bg-slate-100" />
          ) : vista === "facturas" ? (
            facturasVisibles.length === 0 && otrasFacturas.length === 0 ? (
              <Vacio
                titulo="Sin facturas"
                texto="Ingresa la factura de cada compra para que las existencias se actualicen solas."
                accion={<Boton onClick={abrirFactura}>Ingresar factura</Boton>}
              />
            ) : (
              <>
              {(() => {
                // Facturas de productos y de gastos (producción y genética) con saldo
                const pendientesGasto = (version < 0 ? [] : facturasDeGastos()).filter((f) => f.saldo > 0);
                const pendientes = [...(datos?.facturas ?? []).filter((f) => saldoFactura(f) > 0), ...pendientesGasto];
                const deuda = (datos?.facturas ?? []).reduce((t, f) => t + saldoFactura(f), 0) + pendientesGasto.reduce((t, f) => t + f.saldo, 0);
                return pendientes.length > 0 ? (
                  <div className="flex items-center justify-between rounded-2xl bg-orange-50 px-3.5 py-2.5 ring-1 ring-orange-100">
                    <span className="text-sm font-medium text-orange-800">
                      Por pagar · {pendientes.length} factura{pendientes.length === 1 ? "" : "s"} a crédito
                    </span>
                    <span className="text-sm font-bold tabular-nums text-orange-700">{formatoPesos(deuda)}</span>
                  </div>
                ) : null;
              })()}
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
                      <span className="shrink-0 text-right">
                        <span className="block text-sm font-bold text-slate-900 tabular-nums">{formatoPesos(totalFactura(f))}</span>
                        {f.pago === "credito" &&
                          (saldoFactura(f) > 0 ? (
                            <span className="block text-[10px] font-semibold text-orange-600 tabular-nums">Debe {formatoPesos(saldoFactura(f))}</span>
                          ) : (
                            <span className="block text-[10px] font-semibold text-sky-700">Crédito pagado</span>
                          ))}
                      </span>
                      <Chevron />
                    </button>
                  </li>
                ))}
              </ul>
              {otrasFacturas.length > 0 && (
                <section>
                  <h2 className="mb-1.5 mt-1 px-1 text-[11px] font-semibold uppercase tracking-wider text-slate-400">Gastos de producción y genética · {otrasFacturas.length}</h2>
                  <ul className="divide-y divide-slate-100 overflow-hidden rounded-3xl bg-white ring-1 ring-slate-200/80">
                    {otrasFacturas.map((f) => (
                      <li key={f.id}>
                        <button type="button" onClick={() => setFacturaGastoSel(f.id)} className="flex w-full items-center gap-3 px-3.5 py-2.5 text-left transition active:bg-slate-100">
                        <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-slate-50 text-base" aria-hidden="true">
                          {f.categoria === "Genética" ? "🧬" : "🧾"}
                        </span>
                        <span className="min-w-0 flex-1">
                          <span className="block truncate text-sm font-semibold text-slate-900">Factura {f.numero}</span>
                          <span className="block truncate text-xs text-slate-500">
                            {formatoFecha(f.fecha, true)} · {f.descripcion}
                          </span>
                        </span>
                        <span className="shrink-0 text-right">
                          <span className="block text-sm font-bold text-slate-900 tabular-nums">{formatoPesos(f.total)}</span>
                          {f.pago === "credito" &&
                            (f.saldo > 0 ? (
                              <span className="block text-[10px] font-semibold text-orange-600 tabular-nums">Debe {formatoPesos(f.saldo)}</span>
                            ) : (
                              <span className="block text-[10px] font-semibold text-sky-700">Crédito pagado</span>
                            ))}
                        </span>
                        <Chevron />
                        </button>
                      </li>
                    ))}
                  </ul>
                </section>
              )}
              </>
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
                      {items.map(({ producto: p, existencia, disponible, subproducto, bajoMinimo, sinCompras }) => {
                        const nuevo = !subproducto && sinCompras;
                        const diasCerdas = !subproducto && !nuevo ? diasAlimento.get(codigoDe(p)) : undefined;
                        // Alimento de cerdas: naranja cuando queda para unos 2 días o menos ("Revisar" en 0)
                        const naranja = diasCerdas !== undefined && diasCerdas !== null && diasCerdas <= 2;
                        const agotado = !subproducto && !nuevo && existencia <= 0 && !naranja;
                        const referencia = Math.max(p.minimo * 3, p.minimo + 1, 1);
                        const nivel = Math.max(0, Math.min(100, (existencia / referencia) * 100));
                        const colorBarra = naranja ? "bg-orange-500" : agotado || bajoMinimo ? "bg-red-500" : existencia <= p.minimo * 1.5 ? "bg-amber-400" : "bg-sky-500";
                        const estado = naranja
                          ? { t: existencia <= 0 || diasCerdas === 0 ? "Revisar" : `${diasCerdas} día${diasCerdas === 1 ? "" : "s"}`, c: "bg-orange-500 text-white ring-orange-500" }
                          : subproducto
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
                              naranja ? "ring-orange-300" : agotado || bajoMinimo ? "ring-red-200" : "ring-slate-200/80"
                            }`}
                          >
                            <div className="flex items-start justify-between gap-2">
                              <RecuadroCategoria categoria={p.categoria} tamano="sm" />
                              <Insignia clase={estado.c}>{estado.t}</Insignia>
                            </div>
                            <p className="line-clamp-2 text-[13px] font-semibold leading-tight text-slate-900">{p.nombre}</p>
                            <p className={`text-xl font-bold leading-none tabular-nums ${subproducto ? "text-sky-700" : naranja ? "text-orange-600" : agotado || bajoMinimo ? "text-red-600" : "text-slate-900"}`}>
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
          titulo="Confirma con tu PIN"
          mensaje="Escribe tu PIN para cargar una factura."
          aceptar="Continuar"
          onConfirmado={() => {
            setPedirClave(false);
            setNuevaFactura(true);
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
      {facturaGastoSel && <DetalleFacturaGasto id={facturaGastoSel} onCerrar={() => setFacturaGastoSel(null)} />}
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
  const [pago, setPago] = useState<"" | "contado" | "credito">("");
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
    setPago("");
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
    if (validas.some((l) => !(num(l.valor) > 0))) return setError("Cada producto debe tener su valor unitario (mayor que 0).");
    if (!pago) return setError("Selecciona el método de pago: contado o crédito.");
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
      pago,
      registrarGasto: comoGasto,
      abonos: pago === "credito" ? [] : undefined,
    };
    const valor = totalFactura(factura);
    // De contado: el gasto va completo hoy. A crédito: cada abono se registra como gasto.
    if (pago === "contado" && comoGasto && valor > 0) {
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
    // Si había salidas sin existencia de estos productos y el precio cambió, se revaloran
    const corregidos = recontabilizarSinExistencia(factura);
    cerrar();
    if (corregidos > 0) {
      await avisar({
        titulo: "Costos actualizados",
        mensaje: `${corregidos} consumo${corregidos === 1 ? "" : "s"} de lotes que salieron sin existencia se volvieron a valorar con el precio de esta factura.`,
      });
    }
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
                  <Campo etiqueta="Valor unitario *">
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
        <Campo etiqueta="Método de pago *">
          <div className="grid grid-cols-2 gap-1 rounded-2xl bg-slate-100 p-1">
            {(["contado", "credito"] as const).map((m) => (
              <button
                key={m}
                type="button"
                onClick={() => {
                  setPago(m);
                  setError("");
                }}
                className={`rounded-xl py-2 text-sm font-semibold transition ${pago === m ? "bg-white text-slate-900 shadow-sm" : "text-slate-500"}`}
              >
                {m === "contado" ? "Contado" : "Crédito"}
              </button>
            ))}
          </div>
        </Campo>
        {pago === "credito" && (
          <p className="-mt-1.5 rounded-xl bg-orange-50 px-3 py-2 text-xs leading-snug text-orange-800 ring-1 ring-orange-100">
            Queda con saldo pendiente. Desde la factura podrás registrar abonos o pagarla completa.
          </p>
        )}
        <label className="flex items-center gap-2 text-sm text-slate-700">
          <input type="checkbox" checked={comoGasto} onChange={(e) => setComoGasto(e.target.checked)} className="h-5 w-5 accent-sky-700" />
          {pago === "credito" ? "Registrar cada abono como gasto en Contabilidad" : "Registrar el total como gasto en Contabilidad"}
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
  const [prestar, setPrestar] = useState(false);
  const otrasGranjas = leerGranjas().filter((g) => g.id !== granjaActual());
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
    // Sin existencia y sin ninguna compra con precio: no hay con qué valorar el consumo del lote
    if (destino !== "otro" && n > disponible + 1e-9 && !(item.ultimoPrecio > 0)) return setError("Sin valor de referencia");
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
          {otrasGranjas.length > 0 && !subproducto && (
            <Boton variante="secundario" onClick={() => (puede("bodega") ? setPrestar(true) : void avisarSinPermisoBodega())} disabled={disponible <= 0}>
              ⇄ Prestar a otra granja
            </Boton>
          )}
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
              <Entrada value={nota} onChange={setNota} />
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
      {prestar && <PrestarProducto item={item} granjas={otrasGranjas} onCerrar={() => setPrestar(false)} />}
    </Modal>
  );
}

/** Prestar bultos a la bodega de otra granja */
function PrestarProducto({ item, granjas, onCerrar }: { item: ExistenciaProducto; granjas: { id: string; nombre: string }[]; onCerrar: () => void }) {
  const p = item.producto;
  const [destino, setDestino] = useState("");
  const [cantidad, setCantidad] = useState("");
  const [error, setError] = useState("");
  const guardar = async (e: FormEvent) => {
    e.preventDefault();
    if (!destino) return setError("Elige la granja que recibe.");
    const n = num(cantidad);
    const r = prestarProducto(p.id, destino, n);
    if (r) return setError(r);
    const g = granjas.find((x) => x.id === destino)?.nombre ?? "";
    onCerrar();
  };
  return (
    <Modal abierta etiqueta={p.nombre} titulo="Prestar a otra granja" subtitulo={`Hay ${fmt(item.disponible)} ${p.unidad}`} onCerrar={onCerrar}>
      <form onSubmit={guardar} className="flex flex-col gap-3.5">
        <Campo etiqueta="Granja que recibe *">
          <SelectorApp
            valor={destino}
            onCambiar={setDestino}
            titulo="Granja que recibe"
            placeholder="Elige la granja"
            opciones={granjas.map((g) => ({ valor: g.id, texto: g.nombre }))}
            className="w-full"
            claseBoton={CLASE_SELECTOR}
          />
        </Campo>
        <Campo etiqueta={`Cantidad (${p.unidad}) *`}>
          <Entrada type="number" inputMode="decimal" value={cantidad} onChange={setCantidad} />
        </Campo>
        {error && <p className="text-sm font-medium text-rose-600">{error}</p>}
        <div className="grid grid-cols-2 gap-2">
          <Boton variante="secundario" onClick={onCerrar}>
            Cancelar
          </Boton>
          <Boton type="submit" disabled={!destino || !(num(cantidad) > 0)}>
            Prestar
          </Boton>
        </div>
        <p className="text-xs leading-snug text-slate-500">
          Sale de esta bodega y entra a la otra. En la otra granja quedará un aviso naranja de lo que debe, con la opción de devolver.
        </p>
      </form>
    </Modal>
  );
}

/** Tomar prestado de otra granja que lo permita (alimento o medicamentos) */
function BotonTomarPrestado() {
  const version = useVersionDatos();
  const [abierto, setAbierto] = useState(false);
  const otras = useMemo(() => (version < 0 ? [] : leerExistenciasGranjas().filter((e) => e.id !== granjaActual() && e.permite)), [version]);
  if (otras.length === 0) return null;
  return (
    <>
      <button
        type="button"
        onClick={() => (puede("bodega") ? setAbierto(true) : void avisarSinPermisoBodega())}
        className="flex w-full items-center justify-between rounded-2xl bg-white px-3.5 py-2.5 text-left text-sm font-medium text-slate-700 ring-1 ring-slate-200 active:bg-slate-50"
      >
        <span>⇄ Tomar prestado de otra granja</span>
        <span className="text-sky-700" aria-hidden="true">›</span>
      </button>
      {abierto && <TomarPrestado granjas={otras} onCerrar={() => setAbierto(false)} />}
    </>
  );
}

function TomarPrestado({ granjas, onCerrar }: { granjas: ExistenciasGranja[]; onCerrar: () => void }) {
  const [granja, setGranja] = useState(granjas[0]?.id ?? "");
  const [clase, setClase] = useState<"alimento" | "medicamento">("alimento");
  const [item, setItem] = useState("");
  const [cantidad, setCantidad] = useState("");
  const [error, setError] = useState("");
  const g = granjas.find((x) => x.id === granja);
  const opciones =
    clase === "alimento"
      ? (g?.alimentos ?? []).map((a) => ({ valor: a.codigo, texto: `${a.nombre}`, detalle: `hay ${fmt(a.disponible)} ${a.unidad}` }))
      : (g?.medicamentos ?? []).map((m) => ({ valor: m.id, texto: `${m.nombre}`, detalle: `quedan ${fmt(m.restante)} ${m.unidad}` }));
  const unidad = clase === "alimento" ? g?.alimentos.find((a) => a.codigo === item)?.unidad : g?.medicamentos.find((m) => m.id === item)?.unidad;
  const guardar = async (e: FormEvent) => {
    e.preventDefault();
    if (!item) return setError("Elige qué vas a tomar.");
    const n = num(cantidad);
    const r = tomarPrestado(granja, clase === "alimento" ? { tipo: "alimento", codigo: item } : { tipo: "medicamento", id: item }, n);
    if (r) return setError(r);
    const nombre = opciones.find((o) => o.valor === item)?.texto ?? "";
    onCerrar();
  };
  return (
    <Modal abierta etiqueta="Bodega" titulo="Tomar prestado" subtitulo="De otra granja" onCerrar={onCerrar}>
      <form onSubmit={guardar} className="flex flex-col gap-3.5">
        <Campo etiqueta="Granja *">
          <SelectorApp
            valor={granja}
            onCambiar={(v) => {
              setGranja(v);
              setItem("");
            }}
            titulo="Granja"
            opciones={granjas.map((x) => ({ valor: x.id, texto: x.nombre }))}
            className="w-full"
            claseBoton={CLASE_SELECTOR}
          />
        </Campo>
        <div className="grid grid-cols-2 gap-1 rounded-2xl bg-slate-100 p-1" role="radiogroup" aria-label="Qué tomar">
          {(["alimento", "medicamento"] as const).map((c) => (
            <button
              key={c}
              type="button"
              role="radio"
              aria-checked={clase === c}
              onClick={() => {
                setClase(c);
                setItem("");
              }}
              className={`rounded-xl py-2 text-sm font-semibold transition ${clase === c ? "bg-white text-slate-900 shadow-sm" : "text-slate-500"}`}
            >
              {c === "alimento" ? "Alimento" : "Medicamentos"}
            </button>
          ))}
        </div>
        <Campo etiqueta={clase === "alimento" ? "Producto *" : "Medicamento *"}>
          {opciones.length ? (
            <SelectorApp valor={item} onCambiar={setItem} titulo={clase === "alimento" ? "Producto" : "Medicamento"} placeholder="Elige" opciones={opciones} className="w-full" claseBoton={CLASE_SELECTOR} />
          ) : (
            <p className="rounded-xl bg-slate-50 px-3.5 py-2.5 text-sm text-slate-500">{g?.nombre ?? "Esa granja"} no tiene existencia para prestar.</p>
          )}
        </Campo>
        <Campo etiqueta={`Cantidad${unidad ? ` (${unidad})` : ""} *`}>
          <Entrada type="number" inputMode="decimal" value={cantidad} onChange={setCantidad} />
        </Campo>
        {error && <p className="text-sm font-medium text-rose-600">{error}</p>}
        <div className="grid grid-cols-2 gap-2">
          <Boton variante="secundario" onClick={onCerrar}>
            Cancelar
          </Boton>
          <Boton type="submit" disabled={!item || !(num(cantidad) > 0)}>
            Tomar prestado
          </Boton>
        </div>
        <p className="text-xs leading-snug text-slate-500">
          Las existencias de {g?.nombre ?? "la otra granja"} son las de su última actualización{g?.fecha ? ` (${formatoFecha(g.fecha.slice(0, 10), true)})` : ""}.
        </p>
      </form>
    </Modal>
  );
}

/** Avisos naranja de préstamos pendientes entre granjas (lo que se debe y lo que deben) */
function AvisosPrestamos() {
  const version = useVersionDatos();
  const [devolver, setDevolver] = useState<PrestamoBodega | null>(null);
  const datos = useMemo(() => {
    if (version < 0) return null;
    const g = granjaActual();
    const pendientes = leerPrestamos().filter((p) => pendientePrestamo(p) > 0);
    const inv = calcularInventario();
    const hay = (codigo: string) => inv.find((i) => codigoDe(i.producto) === codigo && !i.subproducto)?.disponible ?? 0;
    const meds = leerPrestamosMedicamento().filter((p) => pendientePrestamoMed(p) > 0);
    return {
      debo: pendientes.filter((p) => p.a === g).map((p) => ({ p, hay: hay(p.codigo) })),
      meDeben: pendientes.filter((p) => p.de === g),
      medDebo: meds.filter((p) => p.a === g),
      medMeDeben: meds.filter((p) => p.de === g),
    };
  }, [version]);
  const [devolverMed, setDevolverMed] = useState<PrestamoMedicamento | null>(null);
  // Solo la granja que prestó puede regalar lo que le deben
  const gratificar = async (id: string, clase: "alimento" | "medicamento", que: string, granja: string) => {
    if (!puede("bodega")) return void avisarSinPermisoBodega();
    const ok = await confirmar({ titulo: "Gratificar préstamo", mensaje: `${granja} ya no deberá ${que}. Se toma como un regalo: no vuelve el producto ni se cobra, y su valor queda en Contabilidad como Gastos generales de esta granja.`, aceptar: "Gratificar" });
    if (ok) gratificarPrestamo(id, clase);
  };
  if (!datos || (datos.debo.length === 0 && datos.meDeben.length === 0 && datos.medDebo.length === 0 && datos.medMeDeben.length === 0)) return null;
  return (
    <div className="flex flex-col gap-2">
      {datos.debo.map(({ p, hay }) => (
        <div key={p.id} className="flex items-center gap-3 rounded-2xl bg-orange-50 px-3.5 py-3 ring-1 ring-orange-200">
          <div className="min-w-0 flex-1">
            <p className="text-sm font-semibold text-orange-800">
              Debes {fmt(pendientePrestamo(p))} {p.unidad} de {p.nombre}
            </p>
            <p className="text-xs text-orange-700">
              Préstamo de {p.deNombre} · {formatoFecha(p.fecha, true)}
              {hay <= 0 ? " · sin existencia (puedes pagarlo)" : ""}
            </p>
          </div>
          <button
            type="button"
            onClick={() => (puede("bodega") ? setDevolver(p) : void avisarSinPermisoBodega())}
            className="shrink-0 rounded-full bg-orange-600 px-3.5 py-2 text-xs font-semibold text-white transition active:scale-95 disabled:opacity-40"
          >
            Devolver
          </button>
        </div>
      ))}
      {datos.meDeben.map((p) => (
        <div key={p.id} className="flex items-center gap-3 rounded-2xl bg-orange-50/60 px-3.5 py-2.5 ring-1 ring-orange-100">
          <div className="min-w-0 flex-1">
            <p className="text-sm font-semibold text-orange-700">
              {p.aNombre} te debe {fmt(pendientePrestamo(p))} {p.unidad} de {p.nombre}
            </p>
            <p className="text-xs text-orange-600">Prestado el {formatoFecha(p.fecha, true)}</p>
          </div>
          <button
            type="button"
            onClick={() => void gratificar(p.id, "alimento", `${fmt(pendientePrestamo(p))} ${p.unidad} de ${p.nombre}`, p.aNombre)}
            className="shrink-0 rounded-full px-3 py-1.5 text-xs font-semibold text-orange-700 ring-1 ring-orange-300 transition active:bg-orange-100"
          >
            Gratificar
          </button>
        </div>
      ))}
      {datos.medDebo.map((p) => (
        <div key={p.id} className="flex items-center gap-3 rounded-2xl bg-orange-50 px-3.5 py-3 ring-1 ring-orange-200">
          <div className="min-w-0 flex-1">
            <p className="text-sm font-semibold text-orange-800">
              Debes {fmt(pendientePrestamoMed(p))} {p.unidad} de {p.nombre}
            </p>
            <p className="text-xs text-orange-700">
              Préstamo de {p.deNombre} · {formatoFecha(p.fecha, true)}
            </p>
          </div>
          <button
            type="button"
            onClick={() => (puede("bodega") ? setDevolverMed(p) : void avisarSinPermisoBodega())}
            className="shrink-0 rounded-full bg-orange-600 px-3.5 py-2 text-xs font-semibold text-white transition active:scale-95"
          >
            Devolver
          </button>
        </div>
      ))}
      {datos.medMeDeben.map((p) => (
        <div key={p.id} className="flex items-center gap-3 rounded-2xl bg-orange-50/60 px-3.5 py-2.5 ring-1 ring-orange-100">
          <div className="min-w-0 flex-1">
            <p className="text-sm font-semibold text-orange-700">
              {p.aNombre} te debe {fmt(pendientePrestamoMed(p))} {p.unidad} de {p.nombre}
            </p>
            <p className="text-xs text-orange-600">Prestado el {formatoFecha(p.fecha, true)}</p>
          </div>
          <button
            type="button"
            onClick={() => void gratificar(p.id, "medicamento", `${fmt(pendientePrestamoMed(p))} ${p.unidad} de ${p.nombre}`, p.aNombre)}
            className="shrink-0 rounded-full px-3 py-1.5 text-xs font-semibold text-orange-700 ring-1 ring-orange-300 transition active:bg-orange-100"
          >
            Gratificar
          </button>
        </div>
      ))}
      {devolver && <DevolverPrestamo prestamo={devolver} onCerrar={() => setDevolver(null)} />}
      {devolverMed && <DevolverMedicamento prestamo={devolverMed} onCerrar={() => setDevolverMed(null)} />}
    </div>
  );
}

/** Prestar parte de un medicamento o vacuna a otra granja */
function PrestarMedicamento({ gastoId, onCerrar }: { gastoId: string; onCerrar: () => void }) {
  const med = medicamentosRegistrados().find((m) => m.id === gastoId);
  const granjas = leerGranjas().filter((g) => g.id !== granjaActual());
  const [destino, setDestino] = useState("");
  const [cantidad, setCantidad] = useState("");
  const [error, setError] = useState("");
  if (!med) return null;
  const guardar = async (e: FormEvent) => {
    e.preventDefault();
    if (!destino) return setError("Elige la granja que recibe.");
    const n = num(cantidad);
    const r = prestarMedicamento(gastoId, destino, n);
    if (r) return setError(r);
    onCerrar();
  };
  return (
    <Modal abierta etiqueta={med.nombre} titulo="Prestar a otra granja" subtitulo={`Quedan ${fmt(med.restante)} ${med.unidad}`} onCerrar={onCerrar}>
      <form onSubmit={guardar} className="flex flex-col gap-3.5">
        <Campo etiqueta="Granja que recibe *">
          <SelectorApp valor={destino} onCambiar={setDestino} titulo="Granja que recibe" placeholder="Elige la granja" opciones={granjas.map((g) => ({ valor: g.id, texto: g.nombre }))} className="w-full" claseBoton={CLASE_SELECTOR} />
        </Campo>
        <Campo etiqueta={`Cantidad (${med.unidad}) *`}>
          <Entrada type="number" inputMode="decimal" value={cantidad} onChange={setCantidad} />
        </Campo>
        {error && <p className="text-sm font-medium text-rose-600">{error}</p>}
        <div className="grid grid-cols-2 gap-2">
          <Boton variante="secundario" onClick={onCerrar}>
            Cancelar
          </Boton>
          <Boton type="submit" disabled={!destino || !(num(cantidad) > 0)}>
            Prestar
          </Boton>
        </div>
        <p className="text-xs leading-snug text-slate-500">La otra granja lo podrá aplicar a sus lotes con este valor por {med.unidad}. Le quedará un aviso naranja hasta que lo devuelva.</p>
      </form>
    </Modal>
  );
}

function DevolverMedicamento({ prestamo: p, onCerrar }: { prestamo: PrestamoMedicamento; onCerrar: () => void }) {
  const falta = pendientePrestamoMed(p);
  // De dónde sale: lo prestado sin usar o una compra propia en la misma unidad (ml/Litro o Dosis)
  const fuentes = medicamentosRegistrados().filter(
    (m) => m.restante > 0 && (m.id === `pr:${p.id}` || (!m.prestado && Number.isFinite(convertirUnidad(1, p.unidad, m.unidad))))
  );
  const [fuente, setFuente] = useState(fuentes.find((m) => m.id === `pr:${p.id}`)?.id ?? fuentes[0]?.id ?? "");
  const [cantidad, setCantidad] = useState(String(Math.floor(falta * 100) / 100).replace(".", ","));
  const [error, setError] = useState("");
  const [modo, setModo] = useState<"producto" | "pago">(fuentes.length ? "producto" : "pago");
  const guardar = async (e: FormEvent) => {
    e.preventDefault();
    const n = num(cantidad);
    const r = devolverMedicamento(p.id, n, fuente, modo);
    if (r) return setError(r);
    onCerrar();
  };
  return (
    <Modal abierta etiqueta={p.nombre} titulo={`Devolver a ${p.deNombre}`} subtitulo={`Debes ${fmt(falta)} ${p.unidad}`} onCerrar={onCerrar}>
      <form onSubmit={guardar} className="flex flex-col gap-3.5">
        <div className="grid grid-cols-2 gap-1 rounded-2xl bg-slate-100 p-1" role="radiogroup" aria-label="Cómo devolver">
          {(["producto", "pago"] as const).map((m) => (
            <button
              key={m}
              type="button"
              role="radio"
              aria-checked={modo === m}
              onClick={() => setModo(m)}
              className={`rounded-xl py-2 text-sm font-semibold transition ${modo === m ? "bg-white text-slate-900 shadow-sm" : "text-slate-500"}`}
            >
              {m === "producto" ? "En producto" : "Pagar de contado"}
            </button>
          ))}
        </div>
        {modo === "producto" && (
        <Campo etiqueta="Sale de *">
          {fuentes.length ? (
            <SelectorApp
              valor={fuente}
              onCambiar={setFuente}
              titulo="Sale de"
              opciones={fuentes.map((m) => ({ valor: m.id, texto: m.id === `pr:${p.id}` ? `Lo prestado sin usar · quedan ${fmt(m.restante)} ${m.unidad}` : `${m.nombre} · quedan ${fmt(m.restante)} ${m.unidad}` }))}
              className="w-full"
              claseBoton={CLASE_SELECTOR}
            />
          ) : (
            <p className="rounded-xl bg-slate-50 px-3.5 py-2.5 text-sm text-slate-500">No hay existencia para devolver. Ingresa la compra en Gastos de producción.</p>
          )}
        </Campo>
        )}
        <Campo etiqueta={`Cantidad ${modo === "pago" ? "a pagar" : "a devolver"} (${p.unidad}) *`}>
          <Entrada type="number" inputMode="decimal" value={cantidad} onChange={setCantidad} />
        </Campo>
        {modo === "pago" && (
          <div className="flex items-center justify-between rounded-2xl bg-sky-50 px-4 py-2.5 ring-1 ring-sky-100">
            <span className="text-sm text-sky-900">Valor a pagar ({formatoPesos(p.valorUnitario)} por {p.unidad.replace(/s$/, "")})</span>
            <span className="text-base font-bold tabular-nums text-sky-900">{formatoPesos(Math.round(num(cantidad) * (p.valorUnitario || 0)))}</span>
          </div>
        )}
        {error && <p className="text-sm font-medium text-rose-600">{error}</p>}
        <div className="grid grid-cols-2 gap-2">
          <Boton variante="secundario" onClick={onCerrar}>
            Cancelar
          </Boton>
          <Boton type="submit" disabled={(modo === "producto" && !fuente) || !(num(cantidad) > 0)}>
            {modo === "pago" ? "Pagar" : "Devolver"}
          </Boton>
        </div>
      </form>
    </Modal>
  );
}

function DevolverPrestamo({ prestamo: p, onCerrar }: { prestamo: PrestamoBodega; onCerrar: () => void }) {
  const falta = pendientePrestamo(p);
  const hay = calcularInventario().find((i) => codigoDe(i.producto) === p.codigo && !i.subproducto)?.disponible ?? 0;
  const [modo, setModo] = useState<"producto" | "pago">(hay > 0 ? "producto" : "pago");
  const maximo = modo === "pago" ? falta : Math.max(0, Math.min(falta, hay));
  const [cantidad, setCantidad] = useState(String(Math.floor((hay > 0 ? Math.min(falta, hay) : falta) * 100) / 100).replace(".", ","));
  const [error, setError] = useState("");
  const guardar = async (e: FormEvent) => {
    e.preventDefault();
    const n = num(cantidad);
    const r = devolverPrestamo(p.id, n, modo);
    if (r) return setError(r);
    onCerrar();
  };
  return (
    <Modal abierta etiqueta={p.nombre} titulo={`Devolver a ${p.deNombre}`} subtitulo={`Debes ${fmt(falta)} ${p.unidad} · hay ${fmt(hay)} en bodega`} onCerrar={onCerrar}>
      <form onSubmit={guardar} className="flex flex-col gap-3.5">
        <div className="grid grid-cols-2 gap-1 rounded-2xl bg-slate-100 p-1" role="radiogroup" aria-label="Cómo devolver">
          {(["producto", "pago"] as const).map((m) => (
            <button
              key={m}
              type="button"
              role="radio"
              aria-checked={modo === m}
              onClick={() => setModo(m)}
              className={`rounded-xl py-2 text-sm font-semibold transition ${modo === m ? "bg-white text-slate-900 shadow-sm" : "text-slate-500"}`}
            >
              {m === "producto" ? "En producto" : "Pagar de contado"}
            </button>
          ))}
        </div>
        <Campo etiqueta={`Cantidad ${modo === "pago" ? "a pagar" : "a devolver"} (${p.unidad}) *`}>
          <Entrada type="number" inputMode="decimal" value={cantidad} onChange={setCantidad} />
        </Campo>
        {modo === "pago" && (
          <div className="flex items-center justify-between rounded-2xl bg-sky-50 px-4 py-2.5 ring-1 ring-sky-100">
            <span className="text-sm text-sky-900">Valor a pagar ({formatoPesos(p.valorUnitario)} por {p.unidad.replace(/s$/, "")})</span>
            <span className="text-base font-bold tabular-nums text-sky-900">{formatoPesos(Math.round(num(cantidad) * (p.valorUnitario || 0)))}</span>
          </div>
        )}
        {error && <p className="text-sm font-medium text-rose-600">{error}</p>}
        <div className="grid grid-cols-2 gap-2">
          <Boton variante="secundario" onClick={onCerrar}>
            Cancelar
          </Boton>
          <Boton type="submit" disabled={!(num(cantidad) > 0) || num(cantidad) > maximo + 1e-9}>
            {modo === "pago" ? "Pagar" : "Devolver"}
          </Boton>
        </div>
        <p className="text-xs leading-snug text-slate-500">
          {modo === "pago"
            ? `Se registra como gasto de contado aquí y como ingreso en ${p.deNombre}. El producto se queda en esta bodega.`
            : `Sale de esta bodega y vuelve a la de ${p.deNombre}. Puedes devolver por partes.`}
        </p>
      </form>
    </Modal>
  );
}

/** Factura de un gasto de producción o genética: ver el detalle y, si es a crédito, abonar o pagar */
function DetalleFacturaGasto({ id, onCerrar }: { id: string; onCerrar: () => void }) {
  useVersionDatos();
  const cuenta = leerCuentasPorPagar().find((c) => c.id === id);
  const mov = cuenta ? undefined : leerMovimientos().find((m) => m.id === id);
  const fuente = cuenta ?? mov;
  if (!fuente) return null;
  const total = cuenta ? cuenta.total : mov!.monto;
  const filas: [string, string][] = [
    ["Fecha", formatoFecha(fuente.fecha, true)],
    ["Categoría", textoCategoriaProduccion(fuente.categoria)],
    ["Producto o servicio", fuente.descripcion],
    ...(fuente.marca ? ([["Marca", fuente.marca]] as [string, string][]) : []),
    ...(fuente.cantidadNum ? ([["Cantidad", `${fmt(fuente.cantidadNum)} ${fuente.unidad ?? ""}`.trim()]] as [string, string][]) : fuente.cantidad ? ([["Cantidad", fuente.cantidad]] as [string, string][]) : []),
    ...(fuente.valorUnitario ? ([["Valor por unidad", `${formatoPesos(fuente.valorUnitario)}${fuente.unidad ? ` por ${fuente.unidad}` : ""}`]] as [string, string][]) : []),
    ["Método de pago", cuenta ? "Crédito" : "Contado"],
  ];
  return (
    <Modal abierta etiqueta="Factura de gasto" titulo={`Factura ${fuente.factura ?? ""}`} subtitulo={formatoPesos(total)} icono={fuente.categoria === "Genética" ? "🧬" : "🧾"} onCerrar={onCerrar}>
      <div className="flex flex-col gap-3">
        <dl className="divide-y divide-slate-100 rounded-2xl bg-white ring-1 ring-slate-200">
          {filas.map(([k, v]) => (
            <div key={k} className="flex items-start justify-between gap-3 px-3.5 py-2.5">
              <dt className="shrink-0 text-sm text-slate-500">{k}</dt>
              <dd className="min-w-0 text-right text-sm font-semibold text-slate-900">{v}</dd>
            </div>
          ))}
          <div className="flex items-center justify-between gap-3 px-3.5 py-2.5">
            <dt className="text-sm font-semibold text-slate-900">Total</dt>
            <dd className="text-base font-bold tabular-nums text-slate-900">{formatoPesos(total)}</dd>
          </div>
        </dl>
        {cuenta && (
          <PagoCredito
            credito
            total={cuenta.total}
            abonos={cuenta.abonos}
            conGasto
            categoria={cuenta.categoria}
            descripcionAbono={`Abono · Factura ${cuenta.factura ?? ""} · ${cuenta.descripcion}`}
            onAbonos={(abonos) => guardarCuentasPorPagar(leerCuentasPorPagar().map((c) => (c.id === cuenta.id ? { ...c, abonos } : c)))}
          />
        )}
        {cuenta && <p className="text-center text-xs text-slate-500">Cada abono se registra como gasto en Contabilidad.</p>}
      </div>
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
    const quitar = new Set([f.movimientoId, ...(f.abonos ?? []).map((a) => a.movimientoId)].filter(Boolean));
    if (quitar.size) guardarMovimientos(leerMovimientos().filter((m) => !quitar.has(m.id)));
    onCerrar();
  };

  const credito = f.pago === "credito";
  const conGasto = f.registrarGasto ?? Boolean(f.movimientoId);

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

        <PagoFactura factura={f} productos={productos} />

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
        {conGasto && (
          <p className="text-center text-xs text-slate-500">
            {credito ? "Cada abono se registra como gasto en Contabilidad." : "Registrada como gasto en Contabilidad."}
          </p>
        )}
        <button type="button" onClick={eliminar} className="self-center rounded-full px-4 py-2 text-sm font-medium text-rose-600 hover:bg-rose-50">
          Eliminar factura
        </button>
      </div>
    </Modal>
  );
}

/* ───────────── Gastos de producción (módulo fijo de Bodega) ───────────── */

/* Salidas a lotes: para qué lote salió cada producto, de qué factura(s), valor, fecha y hora */
function SalidasALotes() {
  const version = useVersionDatos();
  const [limite, setLimite] = useState(30);
  const [filtroProducto, setFiltroProducto] = useState("");
  const [filtroLote, setFiltroLote] = useState("");
  const [exportando, setExportando] = useState(false);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  const todas = useMemo(() => (version < 0 ? [] : trazabilidadSalidas().filter((t) => t.salida.loteId)), [version]);
  if (todas.length === 0) return null;
  const cant = (n: number) => n.toLocaleString("es-CO", { maximumFractionDigits: 2 });
  const productosLista = [...new Map(todas.map((t) => [t.producto.id, t.producto.nombre])).entries()].sort((a, b) => a[1].localeCompare(b[1], "es"));
  const lotesLista = [...new Map(todas.map((t) => [t.salida.loteId!, t.lote ? `${t.lote.codigo ?? ""} · ${nombreLote(t.lote)}` : "Lote eliminado"])).entries()].sort((a, b) =>
    a[1].localeCompare(b[1], "es", { numeric: true }),
  );
  const trazas = todas.filter((t) => (!filtroProducto || t.producto.id === filtroProducto) && (!filtroLote || t.salida.loteId === filtroLote));
  const totalFiltro = trazas.reduce((s, t) => s + t.valor, 0);

  const exportar = async () => {
    if (exportando) return;
    setExportando(true);
    try {
      const logo = await cargarLogoJpeg("/images/logo.png");
      const filtro = [
        filtroProducto ? productosLista.find(([id]) => id === filtroProducto)?.[1] ?? "" : "Todos los productos",
        filtroLote ? lotesLista.find(([id]) => id === filtroLote)?.[1] ?? "" : "Todos los lotes",
      ].join(" · ");
      const blob = generarPdfSalidas({
        granja: nombreGranjaActual(),
        filtro,
        fechaGeneracion: formatoFecha(hoy(), true),
        logo,
        filas: trazas.map((t) => ({
          fecha: `${formatoFecha(t.salida.fecha)}${t.salida.hora ? ` ${t.salida.hora}` : ""}`,
          lote: t.lote?.codigo ?? "Lote",
          producto: t.producto.nombre,
          cantidad: `${cant(t.salida.cantidad)} ${t.producto.unidad}`,
          valor: t.valor,
          facturas: t.partes.map((p) => ({
            texto: `Factura ${p.factura.numero}${p.factura.proveedor ? ` · ${p.factura.proveedor}` : ""} · ${formatoFecha(p.factura.fecha)}`,
            cantidad: `${cant(p.cantidad)} ${t.producto.unidad}`,
            valor: p.valor,
          })),
          sinFactura: t.sinFactura > 0.0001 ? `${cant(t.sinFactura)} ${t.producto.unidad}` : undefined,
        })),
      });
      await entregarPdf(blob, `salidas-a-lotes-${hoy()}.pdf`);
    } finally {
      setExportando(false);
    }
  };

  return (
    <SeccionDesplegable titulo="Salidas a lotes" cantidad={todas.length}>
      <div className="flex flex-col gap-2 border-b border-slate-100 bg-white px-3.5 py-3">
        <div className="grid grid-cols-2 gap-2">
          <SelectorApp
            titulo="Producto"
            etiqueta="Salidas a lotes"
            valor={filtroProducto}
            onCambiar={(v) => {
              setFiltroProducto(v);
              setLimite(30);
            }}
            opciones={[{ valor: "", texto: "Todos los productos" }, ...productosLista.map(([id, n]) => ({ valor: id, texto: n }))]}
          />
          <SelectorApp
            titulo="Lote"
            etiqueta="Salidas a lotes"
            valor={filtroLote}
            onCambiar={(v) => {
              setFiltroLote(v);
              setLimite(30);
            }}
            opciones={[{ valor: "", texto: "Todos los lotes" }, ...lotesLista.map(([id, n]) => ({ valor: id, texto: n }))]}
          />
        </div>
        <div className="flex items-center justify-between gap-2">
          <span className="text-xs text-slate-500">
            {trazas.length} {trazas.length === 1 ? "salida" : "salidas"} · <b className="font-semibold text-slate-800">{formatoPesos(Math.round(totalFiltro))}</b>
          </span>
          <button
            type="button"
            onClick={() => void exportar()}
            disabled={exportando || trazas.length === 0}
            className="rounded-full bg-sky-900 px-3.5 py-1.5 text-xs font-semibold text-white active:scale-95 disabled:opacity-50"
          >
            {exportando ? "Generando…" : "Exportar PDF"}
          </button>
        </div>
      </div>
      {trazas.length === 0 && <p className="bg-white px-3.5 py-4 text-center text-sm text-slate-500">No hay salidas con este filtro.</p>}
      <ul className="divide-y divide-slate-100 bg-white">
        {trazas.slice(0, limite).map((t) => (
          <li key={t.salida.id} className="px-3.5 py-2.5">
            <div className="flex items-start gap-2">
              <span className="shrink-0 rounded-md bg-sky-100 px-1.5 py-0.5 text-[11px] font-bold tabular-nums text-sky-800">
                {t.lote?.codigo ?? "Lote"}
              </span>
              <div className="min-w-0 flex-1">
                <p className="truncate text-sm font-semibold text-slate-900">
                  {cant(t.salida.cantidad)} {t.producto.unidad} · {t.producto.nombre}
                </p>
                <p className="text-[11px] text-slate-500">
                  {t.lote ? nombreLote(t.lote) : "Lote eliminado"} · {formatoFecha(t.salida.fecha, true)}
                  {t.salida.hora ? ` · ${formatoHora(t.salida.hora)}` : ""}
                </p>
              </div>
              <span className="shrink-0 text-sm font-bold tabular-nums text-slate-900">{formatoPesos(Math.round(t.valor))}</span>
            </div>
            <ul className="mt-1.5 flex flex-col gap-1 pl-1">
              {t.partes.map((p) => (
                <li key={p.factura.id} className="flex items-center gap-2 rounded-lg bg-slate-50 px-2.5 py-1.5 text-xs">
                  <span aria-hidden="true">🧾</span>
                  <span className="min-w-0 flex-1 truncate text-slate-700">
                    Factura <b className="font-semibold">{p.factura.numero}</b>
                    {p.factura.proveedor ? ` · ${p.factura.proveedor}` : ""}
                    <span className="text-slate-400"> · {formatoFecha(p.factura.fecha)}</span>
                  </span>
                  <span className="shrink-0 tabular-nums text-slate-500">
                    {cant(p.cantidad)} {t.producto.unidad}
                  </span>
                  <span className="w-20 shrink-0 text-right font-semibold tabular-nums text-slate-800">{formatoPesos(Math.round(p.valor))}</span>
                </li>
              ))}
              {t.sinFactura > 0.0001 && (
                <li className="rounded-lg bg-orange-50 px-2.5 py-1.5 text-xs text-orange-800">
                  {cant(t.sinFactura)} {t.producto.unidad} sin factura de compra (sin valor)
                </li>
              )}
            </ul>
          </li>
        ))}
      </ul>
      {trazas.length > limite && (
        <button type="button" onClick={() => setLimite((n) => n + 30)} className="w-full border-t border-slate-100 py-2.5 text-sm font-semibold text-sky-700 active:bg-slate-50">
          Ver más ({trazas.length - limite})
        </button>
      )}
    </SeccionDesplegable>
  );
}

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
  const revisar = [datos.gestacion, datos.lactancia].some(agotado);
  const naranja = revisar || [datos.gestacion, datos.lactancia].some(porAgotarse);
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
          <span className={`block text-sm font-bold tabular-nums ${naranja ? "text-orange-600" : "text-slate-900"}`}>
            {revisar ? "Revisar" : minimo ? `${minimo.dias} días` : "–"}
          </span>
          <span className="block text-[10px] text-slate-400">{revisar ? "alimento en 0" : "alcanza"}</span>
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
                Los alimentos de producción descuentan automáticamente de bodega diariamente «salidas - Consumo automático».
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

/** El alimento llegó a 0 en bodega: se revisa (depende de la condición corporal de cada cerda) */
const agotado = (a: ConsumoAlimentoCerdas) => a.existenciaKg !== null && a.existenciaKg <= 0.01;
/** Queda para unos 2 días o menos: se avisa en naranja */
const porAgotarse = (a: ConsumoAlimentoCerdas) => a.dias !== null && a.dias <= 2;

function BloqueConsumo({ titulo, a }: { titulo: string; a: ConsumoAlimentoCerdas }) {
  const alerta = agotado(a) || porAgotarse(a);
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
            {agotado(a) ? "Revisar" : a.dias !== null ? `${a.dias} días` : "–"}
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
  const [categoria, setCategoria] = useState("");
  const [unidad, setUnidad] = useState("");
  const [pago, setPago] = useState<"" | "contado" | "credito">("");
  const [marca, setMarca] = useState("");
  const [facturaG, setFacturaG] = useState("");
  const [prestarMed, setPrestarMed] = useState<string | null>(null);
  const hayOtras = leerGranjas().some((g) => g.id !== granjaActual());
  const [fecha, setFecha] = useState(hoy());
  const esVacuna = categoria === "Medicamentos y vacunas";
  const cantidadNum = Number(cantidad.replace(",", ".")) || 0;
  const gastos = version < 0 ? [] : leerGastosProduccion();
  const total = gastos.reduce((s, g) => s + g.monto, 0);
  const monto = Number(valor.replace(/\D/g, "")) || 0;

  const abrirNuevo = () => {
    if (!puede("bodega")) return void avisarSinPermisoBodega();
    setNuevo(true);
  };

  const guardar = (e: FormEvent) => {
    e.preventDefault();
    if (!categoria) return;
    if (esVacuna && (!unidad || !(cantidadNum > 0))) return;
    if (!pago || !facturaG.trim()) return;
    if (!registrarGastoProduccion({ descripcion, cantidad, unidad: esVacuna ? unidad : undefined, marca: esVacuna ? marca : undefined, valor: monto, categoria, fecha, pago, factura: facturaG })) return;
    setPago("");
    setFacturaG("");
    setMarca("");
    setDescripcion("");
    setCantidad("");
    setValor("");
    setCategoria("");
    setUnidad("");
    setFecha(hoy());
    setNuevo(false);
  };

  const eliminar = async (id: string, texto: string) => {
    if (!(await confirmar({ titulo: "Eliminar gasto", mensaje: `${texto}. También se quitará de Contabilidad.`, aceptar: "Eliminar", destructivo: true }))) return;
    eliminarGastoProduccion(id);
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
          <Campo etiqueta="Categoría *">
            <Selector
              value={categoria}
              onChange={(v) => {
                setCategoria(v);
                if (v !== "Medicamentos y vacunas") {
                  setUnidad("");
                  setMarca("");
                }
              }}
              titulo="Categoría"
              placeholder="Elige la categoría"
              opciones={CATEGORIAS_GASTO_PRODUCCION.map((c) => ({ valor: c.categoria, texto: c.texto }))}
            />
          </Campo>
          <CampoFactura valor={facturaG} onCambiar={setFacturaG} />
          <Campo etiqueta="Producto o servicio *">
            <Entrada value={descripcion} onChange={(v) => setDescripcion(v.slice(0, 80))} required />
          </Campo>
          {esVacuna && (
            <div className="grid grid-cols-2 gap-3">
              <Campo etiqueta="Unidad *">
                <Selector value={unidad} onChange={setUnidad} titulo="Unidad" placeholder="Elige" opciones={UNIDADES_VACUNA.map((u) => ({ valor: u, texto: u }))} />
              </Campo>
              <Campo etiqueta="Marca">
                <Entrada value={marca} onChange={(v) => setMarca(v.slice(0, 40))} />
              </Campo>
            </div>
          )}
          <div className="grid grid-cols-2 gap-3">
            <Campo etiqueta={esVacuna ? `Cantidad${unidad ? ` (${unidad})` : ""} *` : "Cantidad"}>
              <Entrada type="number" inputMode="decimal" value={cantidad} onChange={(v) => setCantidad(v.slice(0, 10))} />
            </Campo>
            <Campo etiqueta="Valor total *">
              <EntradaPesos value={valor} onChange={setValor} required />
            </Campo>
          </div>
          {cantidadNum > 0 && monto > 0 && (
            <div className="flex items-center justify-between rounded-2xl bg-sky-50 px-4 py-2.5 ring-1 ring-sky-100">
              <span className="text-sm text-sky-900">Valor por {esVacuna && unidad ? unidad : "unidad"}</span>
              <span className="text-base font-bold tabular-nums text-sky-900">{formatoPesos(Math.round((monto / cantidadNum) * 100) / 100)}</span>
            </div>
          )}
          <Campo etiqueta="Fecha">
            <Entrada type="date" value={fecha} onChange={setFecha} required />
          </Campo>
          <Campo etiqueta="Método de pago *">
            <div className="grid grid-cols-2 gap-1 rounded-2xl bg-slate-100 p-1" role="radiogroup" aria-label="Método de pago">
              {(["contado", "credito"] as const).map((m) => (
                <button
                  key={m}
                  type="button"
                  role="radio"
                  aria-checked={pago === m}
                  onClick={() => setPago(m)}
                  className={`rounded-xl py-2 text-sm font-semibold transition ${pago === m ? "bg-white text-slate-900 shadow-sm" : "text-slate-500"}`}
                >
                  {m === "contado" ? "Contado" : "Crédito"}
                </button>
              ))}
            </div>
          </Campo>
          <p className="text-xs text-slate-500">
            {pago === "credito"
              ? "Queda en Contabilidad → Por pagar a crédito; entra al balance cuando se abone o se pague."
              : "Se suma como gasto en la contabilidad general de la granja."}
          </p>
          <div className="grid grid-cols-2 gap-2">
            <Boton variante="secundario" onClick={() => setNuevo(false)}>
              Cancelar
            </Boton>
            <Boton type="submit" disabled={!pago || !facturaG.trim() || !categoria || !descripcion.trim() || monto <= 0 || (esVacuna && (!unidad || !(cantidadNum > 0)))}>
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
                      {textoCategoriaProduccion(g.categoria)} · {formatoFecha(g.fecha)}
                      {g.valorUnitario && g.cantidadNum ? ` · ${formatoPesos(g.valorUnitario)} por ${g.unidad ?? "unidad"}` : ""}
                      {g.pago === "credito" ? <span className="font-semibold text-orange-600">{(g.saldo ?? 0) > 0 ? ` · crédito, debe ${formatoPesos(g.saldo ?? 0)}` : " · crédito pagado"}</span> : null}
                      {(g.recuperado ?? 0) > 0 ? <span className="font-semibold text-emerald-700">{` · abonado ${formatoPesos(g.recuperado ?? 0)}, queda ${formatoPesos(Math.max(0, g.monto - (g.recuperado ?? 0)))}`}</span> : null}
                    </p>
                  </div>
                  <span className="shrink-0 text-[13px] font-semibold tabular-nums text-slate-900">{formatoPesos(g.monto)}</span>
                  {g.categoria === "Medicamentos y vacunas" && g.unidad && hayOtras && (
                    <button
                      type="button"
                      onClick={() => (puede("bodega") ? setPrestarMed(g.id) : void avisarSinPermisoBodega())}
                      className="shrink-0 rounded-full px-2 py-1 text-[11px] font-semibold text-sky-700 ring-1 ring-sky-200 active:bg-sky-50"
                    >
                      ⇄ Prestar
                    </button>
                  )}
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
      {prestarMed && <PrestarMedicamento gastoId={prestarMed} onCerrar={() => setPrestarMed(null)} />}
    </Modal>
  );
}
