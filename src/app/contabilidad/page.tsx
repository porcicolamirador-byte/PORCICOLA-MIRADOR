"use client";

import Modal from "@/components/Modal";
import PagoFactura, { PagoCredito } from "@/components/PagoFactura";
import { calcularInventario, codigoDe, guardarCuentasPorPagar, guardarFacturas, leerCuentasPorPagar, leerFacturas, leerProductos, leerSalidas, saldoCuenta, saldoFactura, totalFactura } from "@/lib/datos";
import { useMemo, useState, type FormEvent } from "react";
import ModuloPage from "@/components/ModuloPage";
import { Boton, Campo, Entrada, IconoMas, SeccionDesplegable, Selector, Vacio, EntradaPesos } from "@/components/ui";
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
import { avisar, confirmar } from "@/components/Dialogo";
import { puede } from "@/lib/nube";
import { cargarLogoJpeg, entregarPdf } from "@/lib/pdfFicha";
import { generarPdfContabilidad } from "@/lib/pdfContabilidad";
import { exportarContabilidadLote } from "@/lib/exportarLote";
import { nombreGranjaActual } from "@/lib/sincronizar";

const CATEGORIAS: Record<Movimiento["tipo"], string[]> = {
  ingreso: ["Venta de cerdos de engorde", "Venta de lechones", "Venta de cerdas de descarte", "Otros ingresos"],
  gasto: [
    "Alimento",
    "Insumos",
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
    // Gasto de una factura de Bodega cuyos productos ya se consumieron en un lote: no se borra desde aquí
    const factura = leerFacturas().find((f) => f.movimientoId === id || (f.abonos ?? []).some((ab) => ab.movimientoId === id));
    if (factura) {
      const productos = leerProductos();
      const codigos = new Set(
        factura.lineas
          .map((l) => productos.find((p) => p.id === l.productoId))
          .map((p) => (p ? codigoDe(p) : ""))
          .filter(Boolean),
      );
      const ids = new Set([...factura.lineas.map((l) => l.productoId), ...productos.filter((p) => codigos.has(codigoDe(p))).map((p) => p.id)]);
      const consumido =
        leerSalidas().some((sd) => sd.loteId && ids.has(sd.productoId) && sd.fecha >= factura.fecha) ||
        leerLotes().some((l) => l.alimento.some((al) => al.productoId && ids.has(al.productoId) && al.fecha >= factura.fecha));
      if (consumido) {
        await avisar({
          titulo: "No se puede eliminar",
          mensaje: `Este gasto es de la factura ${factura.numero}${factura.proveedor ? ` de ${factura.proveedor}` : ""} y sus productos ya se consumieron en un lote. Si hay un error, corrígelo desde la factura en Bodega.`,
        });
        return;
      }
      // Sin la factura el gasto quedaría descuadrado: se eliminan juntos
      const inventario = calcularInventario();
      const negativos = factura.lineas
        .map((l) => {
          const item = inventario.find((i) => i.producto.id === l.productoId);
          return item && item.disponible - l.cantidad < 0 ? item.producto.nombre : null;
        })
        .filter(Boolean);
      if (negativos.length) {
        await avisar({
          titulo: "No se puede eliminar",
          mensaje: `Este gasto es de la factura ${factura.numero} y al eliminarla quedarían existencias negativas de ${negativos.join(", ")}. Revisa primero las salidas en Bodega.`,
        });
        return;
      }
      if (
        !(await confirmar({
          titulo: `Eliminar factura ${factura.numero}`,
          mensaje: `Este gasto es de la factura ${factura.numero}${factura.proveedor ? ` de ${factura.proveedor}` : ""}. Para que la contabilidad no quede descuadrada se eliminará también la factura ${factura.numero}${(factura.abonos ?? []).length ? " con sus abonos" : ""}, y sus productos saldrán del inventario de Bodega.`,
          aceptar: "Eliminar todo",
          destructivo: true,
        }))
      )
        return;
      const quitar = new Set([factura.movimientoId, ...(factura.abonos ?? []).map((ab) => ab.movimientoId), id].filter(Boolean));
      guardarMovimientos(leerMovimientos().filter((m) => !quitar.has(m.id)));
      guardarFacturas(leerFacturas().filter((f) => f.id !== factura.id));
      return;
    }
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
      {/* Resumen del mes: mes, ingresos, gastos y balance en una sola tarjeta */}
      <section className="overflow-hidden rounded-2xl bg-white ring-1 ring-slate-200">
        <div className="flex items-center justify-between border-b border-slate-100 px-1.5 py-1">
          <button type="button" onClick={() => setMes(moverMes(mes, -1))} aria-label="Mes anterior"
            className="flex h-8 w-8 items-center justify-center rounded-lg text-lg text-slate-500 active:bg-slate-100">‹</button>
          <span className="text-sm font-semibold capitalize text-slate-900">{nombreMes(mes)}</span>
          <button type="button" onClick={() => setMes(moverMes(mes, 1))} aria-label="Mes siguiente"
            className="flex h-8 w-8 items-center justify-center rounded-lg text-lg text-slate-500 active:bg-slate-100">›</button>
        </div>
        <div className="grid grid-cols-3 divide-x divide-slate-100">
          {[
            { t: "Ingresos", v: datos ? formatoPesos(datos.ingresos) : "–", c: "text-sky-700" },
            { t: "Gastos", v: datos ? formatoPesos(datos.gastos) : "–", c: "text-slate-900" },
            { t: "Balance", v: datos ? formatoPesos(balance) : "–", c: balance >= 0 ? "text-sky-700" : "text-rose-600" },
          ].map((x) => (
            <div key={x.t} className="min-w-0 px-2 py-2.5 text-center">
              <p className="text-[10px] font-medium uppercase tracking-wide text-slate-400">{x.t}</p>
              <p className={`truncate text-[15px] font-bold tabular-nums ${x.c}`}>{x.v}</p>
            </div>
          ))}
        </div>
      </section>

      <FacturasCredito version={version} />

      <ContabilidadLotes version={version} />

      {datos && datos.porCategoria.length > 0 && (
        <SeccionDesplegable titulo="Gastos por categoría" cantidad={datos.porCategoria.length}>
          <ul className="flex flex-col gap-2 p-3">
            {datos.porCategoria.map(([cat, monto]) => (
              <li key={cat}>
                <div className="flex justify-between gap-2 text-[13px]">
                  <span className="truncate text-slate-700">{cat}</span>
                  <span className="shrink-0 font-semibold tabular-nums">
                    {formatoPesos(monto)}
                    <span className="ml-1.5 text-[11px] font-normal text-slate-400">{Math.round((monto / datos.gastos) * 100)} %</span>
                  </span>
                </div>
                <div className="mt-1 h-1 overflow-hidden rounded-full bg-slate-100">
                  <div className="h-full rounded-full bg-sky-600" style={{ width: `${(monto / datos.gastos) * 100}%` }} />
                </div>
              </li>
            ))}
          </ul>
        </SeccionDesplegable>
      )}

      {datos === null ? (
        <div className="h-40 animate-pulse rounded-3xl bg-slate-100" />
      ) : leerMovimientos().length === 0 ? (
        <Vacio
          titulo="Sin movimientos"
          texto="Registra ventas y gastos para conocer el balance de la granja."
          accion={<Boton onClick={() => setNuevo(true)}>Registrar movimiento</Boton>}
        />
      ) : (
        <MovimientosPeriodo version={version} mes={mes} onEliminar={eliminar} />
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
  const [loteId, setLoteId] = useState("");
  const [pago, setPago] = useState<"" | "contado" | "credito">("");
  const [error, setError] = useState("");
  const lotesActivos = abierta ? leerLotes().filter((l) => l.activo) : [];

  const cambiarTipo = (t: Movimiento["tipo"]) => {
    setTipo(t);
    setCategoria(CATEGORIAS[t][0]);
    if (t !== "ingreso") setLoteId("");
    setPago("");
    setError("");
  };

  const guardar = (e: FormEvent) => {
    e.preventDefault();
    const valor = Number(monto) || 0;
    if (valor <= 0) return;
    if (tipo === "gasto" && !pago) return setError("Selecciona el método de pago: contado o crédito.");
    const lote = tipo === "ingreso" && loteId ? leerLotes().find((l) => l.id === loteId) : undefined;
    const texto = descripcion.trim();
    if (tipo === "gasto" && pago === "credito") {
      // A crédito: queda por pagar; cada abono se registra como gasto
      guardarCuentasPorPagar([
        ...leerCuentasPorPagar(),
        { id: nuevoId(), fecha, descripcion: texto || categoria, categoria, total: valor, abonos: [] },
      ]);
      setDescripcion("");
      setMonto("");
      setPago("");
      setError("");
      onCerrar();
      return;
    }
    guardarMovimientos([
      ...leerMovimientos(),
      {
        id: nuevoId(),
        fecha,
        tipo,
        categoria,
        // Con lote, el nombre del lote queda en la descripción (como los gastos del lote)
        descripcion: lote ? `${texto || categoria} · ${nombreLote(lote)}` : texto,
        monto: valor,
        ...(lote ? { loteId: lote.id } : {}),
      },
    ]);
    setDescripcion("");
    setMonto("");
    setLoteId("");
    setPago("");
    setError("");
    onCerrar();
  };

  return (
    <Modal
      abierta={abierta}
      etiqueta="Contabilidad"
      titulo="Nuevo movimiento"
      subtitulo={tipo === "gasto" ? "Registrar un gasto" : "Registrar un ingreso"}
      icono={tipo === "gasto" ? "💸" : "💰"}
      onCerrar={onCerrar}
    >
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
        {tipo === "ingreso" && lotesActivos.length > 0 && (
          <Campo etiqueta="Lote (opcional)">
            <Selector
              value={loteId}
              onChange={setLoteId}
              opciones={[
                { valor: "", texto: "Ingreso general de la granja" },
                ...lotesActivos.map((l) => ({ valor: l.id, texto: `${nombreLote(l)} · ${l.vivos} animales` })),
              ]}
            />
          </Campo>
        )}
        <Campo etiqueta="Descripción">
          <Entrada value={descripcion} onChange={setDescripcion} placeholder="Dato" />
        </Campo>
        <div className="grid grid-cols-2 gap-3">
          <Campo etiqueta="Valor *">
            <EntradaPesos value={monto} onChange={setMonto} required />
          </Campo>
          <Campo etiqueta="Fecha">
            <Entrada type="date" value={fecha} onChange={setFecha} required />
          </Campo>
        </div>
        {tipo === "gasto" && (
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
        )}
        {tipo === "gasto" && pago === "credito" && (
          <p className="-mt-1.5 rounded-xl bg-orange-50 px-3 py-2 text-xs leading-snug text-orange-800 ring-1 ring-orange-100">
            Queda en "Por pagar a crédito". Cada abono se registra como gasto en su fecha.
          </p>
        )}
        {error && <p className="text-sm font-medium text-rose-600">{error}</p>}
        <Boton type="submit" className="mt-1 w-full py-3">
          Guardar
        </Boton>
      </form>
    </Modal>
  );
}

/* ───────────── Contabilidad por lote (lotes activos) ───────────── */

function cuentasLote(l: Lote, movimientos = leerMovimientos()) {
  const alimento = l.alimento.reduce((s, a) => s + (Number(a.costo) || 0), 0);
  const sinPrecio = l.alimento.filter((a) => !(Number(a.costo) > 0)).length;
  const otros = (l.gastos ?? []).reduce((s, g) => s + (Number(g.valor) || 0), 0);
  const total = alimento + otros;
  const ingresosLote = movimientos.filter((m) => m.tipo === "ingreso" && m.loteId === l.id);
  const ingresos = ingresosLote.reduce((s, m) => s + m.monto, 0);
  return { alimento, otros, total, sinPrecio, porAnimal: l.vivos > 0 ? total / l.vivos : 0, ingresos, ingresosLote, utilidad: ingresos - total };
}

/* Por pagar a crédito: facturas de Bodega y gastos de Contabilidad con saldo; se abonan aquí */
type ItemCredito =
  | { clase: "factura"; id: string; fecha: string; titulo: string; detalle?: string; total: number; saldo: number }
  | { clase: "gasto"; id: string; fecha: string; titulo: string; detalle?: string; total: number; saldo: number };

function FacturasCredito({ version }: { version: number }) {
  const items = useMemo<ItemCredito[]>(() => {
    if (version < 0) return [];
    const facturas: ItemCredito[] = leerFacturas()
      .filter((f) => f.pago === "credito" && saldoFactura(f) > 0)
      .map((f) => ({ clase: "factura", id: f.id, fecha: f.fecha, titulo: `Factura ${f.numero}`, detalle: f.proveedor, total: totalFactura(f), saldo: saldoFactura(f) }));
    const gastos: ItemCredito[] = leerCuentasPorPagar()
      .filter((c) => saldoCuenta(c) > 0)
      .map((c) => ({ clase: "gasto", id: c.id, fecha: c.fecha, titulo: c.descripcion, detalle: c.categoria, total: c.total, saldo: saldoCuenta(c) }));
    return [...facturas, ...gastos].sort((x, y) => x.fecha.localeCompare(y.fecha));
  }, [version]);
  const [abierta, setAbierta] = useState<{ clase: ItemCredito["clase"]; id: string } | null>(null);
  // Se busca entre todos: al pagarse sale de la lista, pero el módulo sigue abierto mostrando "pagada"
  const factura = abierta?.clase === "factura" ? (leerFacturas().find((f) => f.id === abierta.id) ?? null) : null;
  const cuenta = abierta?.clase === "gasto" ? (leerCuentasPorPagar().find((c) => c.id === abierta.id) ?? null) : null;
  if (items.length === 0 && !factura && !cuenta) return null;
  const deuda = items.reduce((t, i) => t + i.saldo, 0);

  const eliminarCuenta = async () => {
    if (!cuenta) return;
    if (
      !(await confirmar({
        titulo: "Eliminar gasto a crédito",
        mensaje: `Se borrará "${cuenta.descripcion}"${cuenta.abonos.length ? " y los gastos de sus abonos" : ""}.`,
        aceptar: "Eliminar",
        destructivo: true,
      }))
    )
      return;
    const quitar = new Set(cuenta.abonos.map((a) => a.movimientoId).filter(Boolean));
    if (quitar.size) guardarMovimientos(leerMovimientos().filter((m) => !quitar.has(m.id)));
    guardarCuentasPorPagar(leerCuentasPorPagar().filter((c) => c.id !== cuenta.id));
    setAbierta(null);
  };

  return (
    <section>
      <h2 className="mb-1.5 flex items-baseline justify-between gap-2 px-1 text-[11px] font-semibold uppercase tracking-wider text-slate-400">
        <span>Por pagar a crédito</span>
        <span className="normal-case tracking-normal font-semibold text-orange-600">{formatoPesos(deuda)}</span>
      </h2>
      {items.length > 0 && (
        <SeccionDesplegable titulo="Facturas y gastos a crédito" cantidad={items.length}>
          <ul className="divide-y divide-slate-100 bg-white">
            {items.map((i) => (
              <li key={`${i.clase}-${i.id}`}>
                <button type="button" onClick={() => setAbierta({ clase: i.clase, id: i.id })} className="flex w-full items-center gap-2.5 px-3 py-2 text-left active:bg-slate-50">
                  <span className="min-w-0 flex-1">
                    <span className="block truncate text-sm font-semibold text-slate-900">
                      {i.titulo}
                      {i.detalle ? <span className="font-normal text-slate-500"> · {i.detalle}</span> : null}
                    </span>
                    <span className="mt-1 block h-1 overflow-hidden rounded-full bg-slate-100">
                      <span className="block h-full rounded-full bg-sky-500" style={{ width: `${i.total > 0 ? ((i.total - i.saldo) / i.total) * 100 : 0}%` }} />
                    </span>
                    <span className="mt-0.5 block truncate text-[11px] text-slate-500">
                      {i.clase === "factura" ? "Bodega" : "Gasto"} · {formatoFecha(i.fecha, true)} · total {formatoPesos(i.total)}
                    </span>
                  </span>
                  <span className="shrink-0 text-right">
                    <span className="block text-sm font-bold tabular-nums text-orange-600">{formatoPesos(i.saldo)}</span>
                    <span className="block text-[10px] text-slate-400">saldo</span>
                  </span>
                </button>
              </li>
            ))}
          </ul>
        </SeccionDesplegable>
      )}
      {factura && (
        <Modal
          abierta
          etiqueta="Contabilidad · Factura a crédito"
          titulo={`Factura ${factura.numero}`}
          subtitulo={`${formatoFecha(factura.fecha, true)}${factura.proveedor ? ` · ${factura.proveedor}` : ""}`}
          icono="🧾"
          onCerrar={() => setAbierta(null)}
        >
          <div className="flex flex-col gap-3">
            <div className="flex items-center justify-between rounded-2xl bg-sky-50 px-4 py-3 ring-1 ring-sky-100">
              <span className="text-sm font-medium text-sky-900">Total</span>
              <span className="text-lg font-bold tabular-nums text-sky-900">{formatoPesos(totalFactura(factura))}</span>
            </div>
            <PagoFactura factura={factura} productos={leerProductos()} />
          </div>
        </Modal>
      )}
      {cuenta && (
        <Modal
          abierta
          etiqueta="Contabilidad · Gasto a crédito"
          titulo={cuenta.descripcion}
          subtitulo={`${formatoFecha(cuenta.fecha, true)} · ${cuenta.categoria}`}
          icono="💸"
          onCerrar={() => setAbierta(null)}
        >
          <div className="flex flex-col gap-3">
            <div className="flex items-center justify-between rounded-2xl bg-sky-50 px-4 py-3 ring-1 ring-sky-100">
              <span className="text-sm font-medium text-sky-900">Total</span>
              <span className="text-lg font-bold tabular-nums text-sky-900">{formatoPesos(cuenta.total)}</span>
            </div>
            <PagoCredito
              credito
              total={cuenta.total}
              abonos={cuenta.abonos}
              conGasto
              categoria={cuenta.categoria}
              descripcionAbono={`Abono · ${cuenta.descripcion}`}
              onAbonos={(abonos) => guardarCuentasPorPagar(leerCuentasPorPagar().map((c) => (c.id === cuenta.id ? { ...c, abonos } : c)))}
            />
            <p className="text-center text-xs text-slate-500">Cada abono se registra como gasto en Contabilidad.</p>
            <button type="button" onClick={() => void eliminarCuenta()} className="self-center rounded-full px-4 py-2 text-sm font-medium text-rose-600 active:bg-rose-50">
              Eliminar gasto a crédito
            </button>
          </div>
        </Modal>
      )}
    </section>
  );
}

function ContabilidadLotes({ version }: { version: number }) {
  const lotes = useMemo(() => (version < 0 ? [] : leerLotes().filter((l) => l.activo)), [version]);
  const [abierto, setAbierto] = useState<string | null>(null);
  if (lotes.length === 0) return null;
  const lote = lotes.find((l) => l.id === abierto) ?? null;
  const totalGeneral = lotes.reduce((s, l) => s + cuentasLote(l).total, 0);

  return (
    <section>
      <h2 className="mb-1.5 flex items-baseline justify-between gap-2 px-1 text-[11px] font-semibold uppercase tracking-wider text-slate-400">
        <span>Por lote · activos</span>
        <span className="normal-case tracking-normal text-slate-500">{formatoPesos(totalGeneral)} desde su ingreso</span>
      </h2>
      <ul className="divide-y divide-slate-100 overflow-hidden rounded-2xl bg-white ring-1 ring-slate-200">
        {lotes.map((l) => {
          const c = cuentasLote(l);
          return (
            <li key={l.id}>
              <button type="button" onClick={() => setAbierto(l.id)} className="flex w-full items-center gap-2.5 px-3 py-2 text-left active:bg-slate-50">
                <span className="shrink-0 rounded-lg bg-sky-100 px-2 py-0.5 text-xs font-bold tabular-nums text-sky-800">{l.codigo ?? "Lote"}</span>
                <span className="min-w-0 flex-1">
                  <span className="block truncate text-sm font-semibold text-slate-900">{l.nombre && l.nombre !== l.codigo ? l.nombre : `${l.vivos} animales`}</span>
                  <span className="block truncate text-[11px] text-slate-500">
                    Alimento {formatoPesos(c.alimento)} · Otros {formatoPesos(c.otros)}
                    {c.ingresos > 0 ? ` · Ingresos ${formatoPesos(c.ingresos)}` : ""}
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
    </section>
  );
}

function DetalleCuentasLote({ lote, onCerrar }: { lote: Lote; onCerrar: () => void }) {
  const c = cuentasLote(lote);
  const [exportando, setExportando] = useState(false);

  const exportarPdf = async () => {
    if (exportando) return;
    setExportando(true);
    try {
      await exportarContabilidadLote(lote);
    } finally {
      setExportando(false);
    }
  };

  const items = [
    ...lote.alimento.map((a, i) => ({
      k: `a${i}`,
      f: a.fecha,
      h: a.hora ?? "",
      t: a.producto ? `${a.producto} · ${a.cantidad ?? ""} ${a.unidad ?? ""}`.trim() : `Alimento · ${a.kg} kg`,
      tipo: "Alimento",
      v: Number(a.costo) || 0,
      ingreso: false,
    })),
    ...(lote.gastos ?? []).map((g) => ({
      k: g.id,
      f: g.fecha,
      h: g.hora ?? "",
      t: `${g.descripcion}${g.cantidad ? ` · ${g.cantidad}` : ""}`,
      tipo: g.categoria,
      v: g.valor,
      ingreso: false,
    })),
    ...c.ingresosLote.map((m) => ({
      k: m.id,
      f: m.fecha,
      h: "",
      t: m.descripcion.replace(` · ${nombreLote(lote)}`, "") || m.categoria,
      tipo: `Ingreso · ${m.categoria}`,
      v: m.monto,
      ingreso: true,
    })),
  ].sort((a, b) => b.f.localeCompare(a.f) || b.h.localeCompare(a.h));

  return (
    <Modal
      abierta
      etiqueta="Contabilidad del lote"
      titulo={nombreLote(lote)}
      subtitulo={`${lote.vivos} animales vivos`}
      icono="🐖"
      onCerrar={onCerrar}
    >
      <div className="flex flex-col gap-3">
        <div className="grid grid-cols-3 gap-1.5 text-center">
          {[
            { t: "Alimento", v: formatoPesos(c.alimento) },
            { t: "Otros", v: formatoPesos(c.otros) },
            { t: "Gastos", v: formatoPesos(c.total) },
          ].map((x) => (
            <div key={x.t} className="rounded-xl bg-white px-2 py-2 ring-1 ring-slate-200">
              <p className="text-[10px] font-medium uppercase tracking-wide text-slate-400">{x.t}</p>
              <p className="truncate text-[13px] font-bold tabular-nums text-slate-900">{x.v}</p>
            </div>
          ))}
        </div>
        {c.ingresos > 0 && (
          <div className="grid grid-cols-2 gap-1.5 text-center">
            <div className="rounded-xl bg-sky-50 px-2 py-2 ring-1 ring-sky-100">
              <p className="text-[10px] font-medium uppercase tracking-wide text-sky-700">Ingresos</p>
              <p className="truncate text-[13px] font-bold tabular-nums text-sky-700">{formatoPesos(c.ingresos)}</p>
            </div>
            <div className={`rounded-xl px-2 py-2 ring-1 ${c.utilidad >= 0 ? "bg-sky-50 ring-sky-100" : "bg-rose-50 ring-rose-100"}`}>
              <p className={`text-[10px] font-medium uppercase tracking-wide ${c.utilidad >= 0 ? "text-sky-700" : "text-rose-600"}`}>Utilidad</p>
              <p className={`truncate text-[13px] font-bold tabular-nums ${c.utilidad >= 0 ? "text-sky-700" : "text-rose-600"}`}>{formatoPesos(c.utilidad)}</p>
            </div>
          </div>
        )}
        <p className="text-xs text-slate-500">
          {lote.vivos} animales vivos
          {c.porAnimal > 0 ? ` · ${formatoPesos(Math.round(c.porAnimal))} por animal` : ""}
          {c.sinPrecio ? ` · ${c.sinPrecio} registro${c.sinPrecio === 1 ? "" : "s"} de alimento sin precio (la factura no tenía valor)` : ""}
        </p>
        <Boton onClick={() => void exportarPdf()} disabled={exportando} className="w-full">
          {exportando ? "Generando PDF…" : "Exportar contabilidad del lote"}
        </Boton>
        {items.length === 0 ? (
          <p className="rounded-xl bg-slate-50 px-3 py-6 text-center text-sm text-slate-500">Este lote aún no tiene gastos ni ingresos.</p>
        ) : (
          <SeccionDesplegable titulo="Alimento, insumos e ingresos" cantidad={items.length}>
          <ul className="flex flex-col divide-y divide-slate-100 bg-white">
            {items.map((x) => (
              <li key={x.k} className="flex items-center gap-3 px-3.5 py-2.5">
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm text-slate-800">{x.t}</p>
                  <p className="truncate text-[11px] text-slate-500">
                    {x.tipo} · {formatoFecha(x.f)}
                  </p>
                </div>
                <span className={`shrink-0 text-sm font-semibold tabular-nums ${x.ingreso ? "text-sky-700" : "text-slate-900"}`}>
                  {x.v > 0 ? `${x.ingreso ? "+" : "−"}${formatoPesos(x.v)}` : "–"}
                </span>
              </li>
            ))}
          </ul>
          </SeccionDesplegable>
        )}
      </div>
    </Modal>
  );
}

/* ───────────── Movimientos: desplegable, por semana o mes, y PDF ───────────── */

const aISO = (d: Date) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
function lunesDe(iso: string) {
  const [a, m, d] = iso.split("-").map(Number);
  const f = new Date(a, m - 1, d);
  f.setDate(f.getDate() - ((f.getDay() + 6) % 7));
  return aISO(f);
}
function sumarDias(iso: string, dias: number) {
  const [a, m, d] = iso.split("-").map(Number);
  const f = new Date(a, m - 1, d);
  f.setDate(f.getDate() + dias);
  return aISO(f);
}
const fechaCorta = (iso: string) => {
  const [a, m, d] = iso.split("-").map(Number);
  return new Date(a, m - 1, d).toLocaleDateString("es-CO", { day: "numeric", month: "short" });
};
const textoSemana = (lunes: string) => {
  const domingo = sumarDias(lunes, 6);
  return `Semana del ${fechaCorta(lunes)} al ${fechaCorta(domingo)} ${domingo.slice(0, 4)}`;
};

function MovimientosPeriodo({ version, mes, onEliminar }: { version: number; mes: string; onEliminar: (id: string) => void }) {
  const [modo, setModo] = useState<"mes" | "semana">("mes");
  const [lunes, setLunes] = useState(() => lunesDe(hoy()));
  const [exportando, setExportando] = useState(false);

  const movs = useMemo(() => {
    void version;
    const todos = leerMovimientos();
    const domingo = sumarDias(lunes, 6);
    return todos
      .filter((m) => (modo === "mes" ? m.fecha.slice(0, 7) === mes : m.fecha >= lunes && m.fecha <= domingo))
      .sort((a, b) => b.fecha.localeCompare(a.fecha));
  }, [version, mes, modo, lunes]);
  const periodo = modo === "mes" ? nombreMes(mes) : textoSemana(lunes);
  const ingresos = movs.filter((m) => m.tipo === "ingreso").reduce((s, m) => s + m.monto, 0);
  const gastos = movs.filter((m) => m.tipo === "gasto").reduce((s, m) => s + m.monto, 0);

  const exportar = async () => {
    if (exportando) return;
    setExportando(true);
    try {
      const logo = await cargarLogoJpeg("/images/logo.png");
      const blob = generarPdfContabilidad({
        granja: nombreGranjaActual(),
        periodo: periodo.charAt(0).toUpperCase() + periodo.slice(1),
        filas: movs.map((m) => ({ fecha: formatoFecha(m.fecha), descripcion: m.descripcion, categoria: m.categoria, tipo: m.tipo, monto: m.monto })),
        fechaGeneracion: formatoFecha(hoy()),
        logo,
      });
      const sufijo = modo === "mes" ? mes : `semana-${lunes}`;
      await entregarPdf(blob, `contabilidad-${sufijo}.pdf`);
    } finally {
      setExportando(false);
    }
  };

  return (
    <SeccionDesplegable titulo="Movimientos" cantidad={movs.length}>
      <div className="flex flex-col gap-2.5 p-3">
        <div className="grid grid-cols-2 gap-1 rounded-xl bg-slate-100 p-1">
          {(["mes", "semana"] as const).map((m) => (
            <button
              key={m}
              type="button"
              onClick={() => setModo(m)}
              aria-pressed={modo === m}
              className={`h-8 rounded-lg text-[13px] font-semibold transition ${modo === m ? "bg-white text-slate-900 shadow-sm" : "text-slate-500"}`}
            >
              {m === "mes" ? "Mes" : "Semana"}
            </button>
          ))}
        </div>

        {modo === "semana" ? (
          <div className="flex items-center justify-between">
            <button type="button" onClick={() => setLunes(sumarDias(lunes, -7))} aria-label="Semana anterior" className="flex h-8 w-8 items-center justify-center rounded-lg text-lg text-slate-500 active:bg-slate-100">‹</button>
            <span className="text-[13px] font-semibold text-slate-900">{textoSemana(lunes)}</span>
            <button type="button" onClick={() => setLunes(sumarDias(lunes, 7))} aria-label="Semana siguiente" className="flex h-8 w-8 items-center justify-center rounded-lg text-lg text-slate-500 active:bg-slate-100">›</button>
          </div>
        ) : (
          <p className="text-center text-[13px] font-semibold capitalize text-slate-900">{nombreMes(mes)}</p>
        )}

        <div className="flex items-center justify-between gap-2 text-[12px]">
          <span className="text-slate-500">
            <span className="font-semibold text-sky-700">+{formatoPesos(ingresos)}</span> · <span className="font-semibold text-slate-900">−{formatoPesos(gastos)}</span>
          </span>
          <button
            type="button"
            onClick={() => void exportar()}
            disabled={exportando}
            className="flex items-center gap-1.5 rounded-full px-3 py-1.5 text-xs font-semibold text-sky-700 ring-1 ring-sky-200 active:bg-sky-50 disabled:opacity-50"
          >
            <svg viewBox="0 0 24 24" className="h-3.5 w-3.5" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
              <path d="M12 4v11M7.5 10.5 12 15l4.5-4.5M5 19h14" />
            </svg>
            {exportando ? "Generando…" : "Exportar PDF"}
          </button>
        </div>

        {movs.length === 0 ? (
          <p className="rounded-xl bg-slate-50 px-3 py-5 text-center text-sm text-slate-500">No hay movimientos en este periodo.</p>
        ) : (
          <ul className="divide-y divide-slate-100 overflow-hidden rounded-xl bg-white ring-1 ring-slate-100">
            {movs.map((m) => (
              <li key={m.id} className="flex items-center gap-2.5 px-3 py-2">
                <span
                  className={`flex h-7 w-7 shrink-0 items-center justify-center rounded-lg text-sm font-bold ${
                    m.tipo === "ingreso" ? "bg-sky-50 text-sky-700" : "bg-rose-50 text-rose-700"
                  }`}
                  aria-hidden="true"
                >
                  {m.tipo === "ingreso" ? "+" : "−"}
                </span>
                <div className="min-w-0 flex-1">
                  <p className="truncate text-[13px] font-semibold text-slate-900">{m.descripcion || m.categoria}</p>
                  <p className="truncate text-[11px] text-slate-500">
                    {m.categoria} · {formatoFecha(m.fecha)}
                  </p>
                </div>
                <span className={`shrink-0 text-[13px] font-semibold tabular-nums ${m.tipo === "ingreso" ? "text-sky-700" : "text-slate-900"}`}>
                  {m.tipo === "ingreso" ? "+" : "−"}
                  {formatoPesos(m.monto)}
                </span>
                <button
                  type="button"
                  onClick={() => onEliminar(m.id)}
                  aria-label={`Quitar ${m.descripcion || m.categoria}`}
                  className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full text-slate-300 active:bg-rose-50 active:text-rose-600"
                >
                  <svg viewBox="0 0 20 20" className="h-3.5 w-3.5" fill="none" stroke="currentColor" strokeWidth={2.2} strokeLinecap="round" aria-hidden="true">
                    <path d="M5 5l10 10M15 5L5 15" />
                  </svg>
                </button>
              </li>
            ))}
          </ul>
        )}
      </div>
    </SeccionDesplegable>
  );
}
