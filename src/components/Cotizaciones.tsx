"use client";

import { useMemo, useState, type FormEvent } from "react";
import Modal from "@/components/Modal";
import { confirmar } from "@/components/Dialogo";
import { Boton, Campo, Entrada, EntradaPesos, SeccionDesplegable, Selector } from "@/components/ui";
import {
  diasEntre,
  formatoFecha,
  formatoPesos,
  guardarCotizaciones,
  hoy,
  leerCotizaciones,
  leerLotes,
  nombreLote,
  nuevoId,
  siguienteCotizacion,
  sumarDias,
  totalesCotizacion,
  useVersionDatos,
  type Cotizacion,
} from "@/lib/datos";
import { CONDICIONES_COTIZACION, EMPRESA, NOTA_IVA, VALIDEZ_COTIZACION_DIAS } from "@/lib/empresa";
import { generarPdfCotizacion } from "@/lib/pdfCotizacion";
import { cargarLogoJpeg, entregarPdf } from "@/lib/pdfFicha";

const ICONO = (
  <svg viewBox="0 0 24 24" className="h-5 w-5" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
    <path d="M7 3h7l5 5v13H7z" />
    <path d="M14 3v5h5" />
    <path d="M10 13h6M10 17h4" />
  </svg>
);

const kg = (n: number) => `${String(Math.round(n * 10) / 10).replace(".", ",")} kg`;
const AREA = "w-full rounded-xl border border-slate-200 bg-white px-3 py-2.5 text-[15px] text-slate-900 outline-none focus:border-sky-400";

/** Crea el PDF de una cotización guardada y lo entrega (compartir o descargar) */
export async function exportarCotizacion(c: Cotizacion) {
  const t = totalesCotizacion(c);
  const logo = await cargarLogoJpeg("/images/logo.png", 600);
  const blob = generarPdfCotizacion({
    empresa: EMPRESA,
    numero: c.numero,
    fecha: formatoFecha(c.fecha, true),
    validaHasta: formatoFecha(sumarDias(c.fecha, c.validezDias), true),
    validezDias: c.validezDias,
    cliente: c.cliente,
    lote: c.loteTexto,
    descripcion: "Lechones",
    detalle: `Lote ${c.loteTexto}${c.pesoPromedio ? ` · peso promedio ${kg(c.pesoPromedio)}` : ""}`,
    cantidad: c.cantidad,
    edadDias: c.edadDias,
    pesoPromedio: c.pesoPromedio ? kg(c.pesoPromedio) : undefined,
    valorUnitario: formatoPesos(c.valorUnitario),
    subtotal: formatoPesos(t.subtotal),
    descuentoTexto: c.descuento ? `Descuento ${String(c.descuento).replace(".", ",")} %` : undefined,
    descuento: t.descuento ? formatoPesos(t.descuento) : undefined,
    total: formatoPesos(t.total),
    condiciones: c.condiciones,
    observaciones: c.observaciones,
    notaIva: NOTA_IVA,
    logo,
  });
  await entregarPdf(blob, `Cotizacion-${c.numero}.pdf`);
}

export default function Cotizaciones() {
  const version = useVersionDatos();
  const [nueva, setNueva] = useState(false);
  const [exportando, setExportando] = useState<string | null>(null);
  const lista = useMemo(() => (version < 0 ? [] : leerCotizaciones().sort((a, b) => b.numero.localeCompare(a.numero))), [version]);

  const pdf = async (c: Cotizacion) => {
    if (exportando) return;
    setExportando(c.id);
    try {
      await exportarCotizacion(c);
    } finally {
      setExportando(null);
    }
  };
  const eliminar = async (c: Cotizacion) => {
    if (!(await confirmar({ titulo: "Eliminar cotización", mensaje: `Se borrará la cotización ${c.numero} de ${c.cliente.nombre}.`, aceptar: "Eliminar", destructivo: true }))) return;
    guardarCotizaciones(leerCotizaciones().filter((x) => x.id !== c.id));
  };

  return (
    <>
      <SeccionDesplegable titulo="Cotizaciones" cantidad={lista.length}>
        <div className="flex flex-col gap-2 p-3">
          <Boton onClick={() => setNueva(true)} className="w-full">
            Nueva cotización
          </Boton>
          {lista.length === 0 && <p className="py-2 text-center text-xs text-slate-400">Aún no hay cotizaciones.</p>}
          <ul className="flex flex-col divide-y divide-slate-100">
            {lista.map((c) => {
              const t = totalesCotizacion(c);
              const vence = sumarDias(c.fecha, c.validezDias);
              const vigente = vence >= hoy();
              return (
                <li key={c.id} className="flex items-center gap-2.5 py-2">
                  <span className="min-w-0 flex-1">
                    <span className="block truncate text-sm font-semibold text-slate-900">
                      <span className="text-sky-700">{c.numero}</span> · {c.cliente.nombre}
                    </span>
                    <span className="block truncate text-[11px] text-slate-500">
                      {c.cantidad} lechones · {c.loteTexto} · {formatoFecha(c.fecha, true)} ·{" "}
                      <span className={vigente ? "text-emerald-600" : "text-slate-400"}>{vigente ? `vigente hasta ${formatoFecha(vence, true)}` : "vencida"}</span>
                    </span>
                  </span>
                  <span className="shrink-0 text-sm font-bold tabular-nums text-slate-900">{formatoPesos(t.total)}</span>
                  <button
                    type="button"
                    onClick={() => void pdf(c)}
                    className="shrink-0 rounded-full bg-sky-50 px-2.5 py-1.5 text-xs font-semibold text-sky-700 active:scale-95"
                  >
                    {exportando === c.id ? "…" : "PDF"}
                  </button>
                  <button type="button" onClick={() => void eliminar(c)} aria-label={`Eliminar ${c.numero}`} className="shrink-0 px-1 text-slate-300 active:text-slate-500">
                    ✕
                  </button>
                </li>
              );
            })}
          </ul>
        </div>
      </SeccionDesplegable>
      {nueva && <NuevaCotizacion onCerrar={() => setNueva(false)} />}
    </>
  );
}

function NuevaCotizacion({ onCerrar }: { onCerrar: () => void }) {
  const lotes = useMemo(() => leerLotes().filter((l) => l.activo && l.vivos > 0), []);
  const [loteId, setLoteId] = useState("");
  const [cantidad, setCantidad] = useState("");
  const [edad, setEdad] = useState("");
  const [peso, setPeso] = useState("");
  const [valor, setValor] = useState("");
  const [descuento, setDescuento] = useState("");
  const [nombre, setNombre] = useState("");
  const [documento, setDocumento] = useState("");
  const [telefono, setTelefono] = useState("");
  const [ubicacion, setUbicacion] = useState("");
  const [correo, setCorreo] = useState("");
  const [fecha, setFecha] = useState(hoy());
  const [validez, setValidez] = useState(String(VALIDEZ_COTIZACION_DIAS));
  const [condiciones, setCondiciones] = useState(CONDICIONES_COTIZACION);
  const [observaciones, setObservaciones] = useState("");
  const [error, setError] = useState("");
  const [guardando, setGuardando] = useState(false);

  const lote = lotes.find((l) => l.id === loteId);
  const num = (s: string) => Number(String(s).replace(",", ".")) || 0;
  const totales = totalesCotizacion({ cantidad: num(cantidad), valorUnitario: num(valor), descuento: num(descuento) });

  const elegirLote = (id: string) => {
    setLoteId(id);
    setError("");
    const l = lotes.find((x) => x.id === id);
    if (!l) return;
    setEdad(String(Math.max(0, diasEntre(l.fechaIngreso, hoy()))));
    const ultimo = [...(l.pesajes ?? [])].sort((a, b) => b.fecha.localeCompare(a.fecha))[0];
    setPeso(ultimo ? String(ultimo.pesoPromedio).replace(".", ",") : "");
  };

  const guardar = async (e: FormEvent) => {
    e.preventDefault();
    if (!lote) return setError("Elige el lote de donde saldrán los lechones.");
    const n = Math.round(num(cantidad));
    if (!(n > 0)) return setError("Escribe cuántos lechones vas a cotizar.");
    if (n > lote.vivos) return setError(`El lote solo tiene ${lote.vivos} lechones.`);
    if (!(num(valor) > 0)) return setError("Escribe el valor por lechón.");
    if (!nombre.trim()) return setError("Escribe el nombre del cliente.");
    const dias = Math.round(num(validez));
    if (!(dias > 0)) return setError("Escribe los días de validez.");
    const c: Cotizacion = {
      id: nuevoId(),
      numero: siguienteCotizacion(),
      fecha,
      validezDias: dias,
      cliente: { nombre: nombre.trim(), documento: documento.trim() || undefined, telefono: telefono.trim() || undefined, ubicacion: ubicacion.trim() || undefined, correo: correo.trim() || undefined },
      loteId: lote.id,
      loteTexto: nombreLote(lote),
      cantidad: n,
      edadDias: Math.max(0, Math.round(num(edad))),
      pesoPromedio: num(peso) > 0 ? num(peso) : undefined,
      valorUnitario: Math.round(num(valor)),
      descuento: num(descuento) > 0 ? Math.min(100, num(descuento)) : undefined,
      condiciones: condiciones.trim(),
      observaciones: observaciones.trim() || undefined,
    };
    guardarCotizaciones([...leerCotizaciones(), c]);
    setGuardando(true);
    try {
      await exportarCotizacion(c);
    } finally {
      setGuardando(false);
      onCerrar();
    }
  };

  return (
    <Modal abierta etiqueta="Contabilidad" titulo="Nueva cotización" subtitulo={`Lechones · ${siguienteCotizacion()}`} icono={ICONO} onCerrar={onCerrar}>
      <form onSubmit={guardar} className="flex flex-col gap-3.5">
        <Campo etiqueta="Lote *">
          <Selector
            value={loteId}
            onChange={elegirLote}
            placeholder={lotes.length ? "Elige el lote" : "No hay lotes activos"}
            opciones={lotes.map((l) => ({ valor: l.id, texto: `${nombreLote(l)} · ${l.vivos} animales` }))}
          />
        </Campo>
        <div className="grid grid-cols-3 gap-2">
          <Campo etiqueta="A cotizar *">
            <Entrada type="number" inputMode="numeric" value={cantidad} onChange={setCantidad} placeholder={lote ? `de ${lote.vivos}` : ""} />
          </Campo>
          <Campo etiqueta="Edad (días)">
            <Entrada type="number" inputMode="numeric" value={edad} onChange={setEdad} />
          </Campo>
          <Campo etiqueta="Peso prom. kg">
            <Entrada type="number" inputMode="decimal" value={peso} onChange={setPeso} />
          </Campo>
        </div>
        <div className="grid grid-cols-2 gap-3">
          <Campo etiqueta="Valor por lechón *">
            <EntradaPesos value={valor} onChange={setValor} />
          </Campo>
          <Campo etiqueta="Descuento %">
            <Entrada type="number" inputMode="decimal" value={descuento} onChange={setDescuento} />
          </Campo>
        </div>
        {totales.subtotal > 0 && (
          <div className="flex items-baseline justify-between rounded-xl bg-sky-50 px-3 py-2 text-sm ring-1 ring-sky-100">
            <span className="text-sky-800">Total{totales.descuento ? ` (descuento ${formatoPesos(totales.descuento)})` : ""}</span>
            <b className="tabular-nums text-sky-900">{formatoPesos(totales.total)}</b>
          </div>
        )}

        <p className="-mb-1 mt-1 text-[11px] font-semibold uppercase tracking-wider text-slate-400">Cliente</p>
        <Campo etiqueta="Nombre o razón social *">
          <Entrada value={nombre} onChange={setNombre} />
        </Campo>
        <div className="grid grid-cols-2 gap-3">
          <Campo etiqueta="C.C. o NIT">
            <Entrada value={documento} onChange={setDocumento} placeholder="2222222" />
          </Campo>
          <Campo etiqueta="Teléfono">
            <Entrada inputMode="numeric" value={telefono} onChange={setTelefono} placeholder="0000000" />
          </Campo>
        </div>
        <Campo etiqueta="Dirección">
          <Entrada value={ubicacion} onChange={setUbicacion} placeholder="N/A" />
        </Campo>
        <Campo etiqueta="Correo">
          <Entrada value={correo} onChange={setCorreo} placeholder="N/A" />
        </Campo>

        <div className="grid grid-cols-2 gap-3">
          <Campo etiqueta="Fecha">
            <Entrada type="date" value={fecha} onChange={setFecha} required />
          </Campo>
          <Campo etiqueta="Válida por (días)">
            <Entrada type="number" inputMode="numeric" value={validez} onChange={setValidez} />
          </Campo>
        </div>
        <Campo etiqueta="Condiciones">
          <textarea value={condiciones} onChange={(e) => setCondiciones(e.target.value)} rows={3} className={AREA} />
        </Campo>
        <Campo etiqueta="Observaciones">
          <textarea value={observaciones} onChange={(e) => setObservaciones(e.target.value)} rows={2} className={AREA} />
        </Campo>
        <p className="text-[11px] leading-snug text-slate-500">
          Sale a nombre de {EMPRESA.razonSocial} (NIT {EMPRESA.nit}), excluida de IVA (art. 424 E.T.).
        </p>
        {error && <p className="text-sm font-medium text-rose-600">{error}</p>}
        <Boton type="submit" className="w-full py-3" disabled={guardando}>
          {guardando ? "Generando PDF…" : "Guardar y generar PDF"}
        </Boton>
      </form>
    </Modal>
  );
}
