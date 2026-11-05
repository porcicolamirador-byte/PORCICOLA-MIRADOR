"use client";

import Emoji from "@/components/Emoji";
import SelectorApp from "@/components/SelectorApp";
import Modal from "@/components/Modal";
import { generarPdfParto } from "@/lib/pdfParto";
import { CLAVE_JAULAS, granjaActual, nombreGranjaActual } from "@/lib/sincronizar";
import { borrarConRegistro, guardarConRegistro } from "@/lib/log";
import { useEffect, useRef, useState, type TouchEvent } from "react";
import { useParams, useRouter } from "next/navigation";
import usePageBackground from "@/hooks/usePageBackground";
import { cargarLogoJpeg, entregarPdf, generarPdfFicha, type LogoJpeg } from "@/lib/pdfFicha";
import { confirmar } from "@/components/Dialogo";
import { CONFIRMACIONES_GESTACION } from "@/utils/pendingTasks";
import {
  confirmarGestacion,
  actualizarGastoGenetica,
  quitarGastoGenetica,
  registrarGastoGenetica,
  type GeneticaPerdida,
  eliminarLotesDePartos,
  formatoPesos,
  guardarMovimientos,
  leerMovimientos,
  loteDelParto,
  lotesDeParto,
  nombreLote,
  nuevoId,
  useVersionDatos,
} from "@/lib/datos";
import { leerConfig } from "@/lib/config";

const DIAS_GESTACION = 114;
const MESES = ["Ene", "Feb", "Mar", "Abr", "May", "Jun", "Jul", "Ago", "Sep", "Oct", "Nov", "Dic"];

function parsearFechaLocal(fecha: string): Date {
  const [anio, mes, dia] = fecha.split("-").map(Number);
  return new Date(anio, mes - 1, dia);
}

function fechaLocalISO(fecha: Date): string {
  const anio = fecha.getFullYear();
  const mes = String(fecha.getMonth() + 1).padStart(2, "0");
  const dia = String(fecha.getDate()).padStart(2, "0");
  return `${anio}-${mes}-${dia}`;
}

function formatearFechaCorta(fecha: string): string {
  const d = parsearFechaLocal(fecha);
  const dia = d.getDate();
  const mes = MESES[d.getMonth()];
  const anio = d.getFullYear();
  return `${mes}-${dia}-${anio}`;
}

function calcularEdadLlegada(fechaLlegada: string): string {
  const llegada = new Date(fechaLlegada);
  if (Number.isNaN(llegada.getTime())) return "-";

  const hoy = new Date();
  let years = hoy.getFullYear() - llegada.getFullYear();
  let months = hoy.getMonth() - llegada.getMonth();
  let days = hoy.getDate() - llegada.getDate();

  if (days < 0) {
    months -= 1;
    const prevMonth = new Date(hoy.getFullYear(), hoy.getMonth(), 0);
    days += prevMonth.getDate();
  }

  if (months < 0) {
    years -= 1;
    months += 12;
  }

  const parts = [];
  if (years > 0) parts.push(`${years}a`);
  if (months > 0) parts.push(`${months}m`);
  parts.push(`${days}d`);

  return parts.join(" ");
}

function obtenerColorPorTipo(tipo: string): string {
  switch (tipo) {
    case "Compra de genética":
      return "bg-violet-500";
    case "Inseminación":
      return "bg-blue-500";
    case "Parto":
      return "bg-sky-500";
    case "Destete":
      return "bg-orange-500";
    case "Celo":
      return "bg-yellow-500";
    case "Aborto":
      return "bg-pink-500";
    case "Baja":
      return "bg-red-500";
    case "Tratamiento":
      return "bg-purple-500";
    case "Evento":
      return "bg-slate-400";
    default:
      return "bg-gray-400";
  }
}

function decodificar(valor: string): string {
  try {
    return decodeURIComponent(valor);
  } catch {
    return valor;
  }
}

const TIPOS_HISTORIAL = [
  "Inseminación",
  "Compra de genética",
  "Genética no usada",
  "Confirmación de Gestación",
  "Celo",
  "Parto",
  "Destete",
  "Aborto",
  "Tratamiento",
  "Vacunación",
  "Desparasitación",
  "Baja",
  "Evento",
];

function infoTipo(tipo: string): { icono: string; fondo: string; borde: string; texto: string } {
  switch (tipo) {
    case "Compra de genética":
      return { icono: "🧬", fondo: "bg-violet-100", borde: "border-violet-100", texto: "text-violet-800" };
    case "Genética no usada":
      return { icono: "🧬", fondo: "bg-rose-100", borde: "border-rose-100", texto: "text-rose-700" };
    case "Inseminación":
      return { icono: "🧬", fondo: "bg-sky-100", borde: "border-sky-100", texto: "text-sky-800" };
    case "Confirmación de Gestación":
      return { icono: "✅", fondo: "bg-blue-100", borde: "border-blue-100", texto: "text-blue-800" };
    case "Celo":
      return { icono: "🔥", fondo: "bg-amber-100", borde: "border-amber-100", texto: "text-amber-800" };
    case "Parto":
      return { icono: "🐷", fondo: "bg-sky-100", borde: "border-sky-100", texto: "text-sky-800" };
    case "Destete":
      return { icono: "🍼", fondo: "bg-orange-100", borde: "border-orange-100", texto: "text-orange-800" };
    case "Aborto":
      return { icono: "⚠️", fondo: "bg-pink-100", borde: "border-pink-100", texto: "text-pink-800" };
    case "Tratamiento":
      return { icono: "🩺", fondo: "bg-purple-100", borde: "border-purple-100", texto: "text-purple-800" };
    case "Vacunación":
      return { icono: "🛡️", fondo: "bg-cyan-100", borde: "border-cyan-100", texto: "text-cyan-800" };
    case "Desparasitación":
      return { icono: "💊", fondo: "bg-violet-100", borde: "border-violet-100", texto: "text-violet-800" };
    case "Baja":
      return { icono: "⛔", fondo: "bg-red-100", borde: "border-red-100", texto: "text-red-800" };
    default:
      return { icono: "📝", fondo: "bg-slate-100", borde: "border-slate-100", texto: "text-slate-800" };
  }
}

const MESES_LARGOS = ["Enero", "Febrero", "Marzo", "Abril", "Mayo", "Junio", "Julio", "Agosto", "Septiembre", "Octubre", "Noviembre", "Diciembre"];
function tituloMes(clave: string): string {
  const [a, m] = clave.split("-").map(Number);
  if (!a || !m) return "Sin fecha";
  return `${MESES_LARGOS[m - 1]} ${a}`;
}

/** Genéticas para la inseminación (con "Otro…" se escribe a mano) */
const GENETICAS = ["PIC 410 SUP", "PIC 410 TOP", "PIC 337 SUP", "PIC 337 TOP", "DUROC", "PIC L02", "PIC L03"];

/** Jaula de la cerda según el mapa común de jaulas (igual en todas las granjas); si no, la de su ficha */
function jaulaDeCerda(cerda: { id: string; jaula?: unknown }): string {
  try {
    const mapa = JSON.parse(localStorage.getItem(CLAVE_JAULAS) || "[]") as { id: string; cerdaId: string; granja: string }[];
    const e = Array.isArray(mapa) ? mapa.find((x) => x && x.cerdaId === cerda.id && x.granja === granjaActual()) : undefined;
    if (e) return e.id;
    if (Array.isArray(mapa) && mapa.length) return "";
  } catch {
    // sin mapa
  }
  return String(cerda.jaula || "");
}

export default function CerdaDetalle() {
  const params = useParams<{ id: string }>();
  // Sin conexión la pantalla puede venir de una copia guardada de otra cerda:
  // el id se lee de la dirección real del navegador.
  const [idDeUrl, setIdDeUrl] = useState<string | null>(null);
  useEffect(() => {
    const m = window.location.pathname.match(/\/cerda\/([^/]+)/);
    if (m) setIdDeUrl(decodificar(m[1]));
  }, [params]);
  const id = idDeUrl ?? decodificar(String(params?.id ?? ""));
  const router = useRouter();
  // Fondo blanco, también en la zona de la isla dinámica
  usePageBackground("#ffffff");

  const [cerda, setCerda] = useState<any>(null);
  const [registros, setRegistros] = useState<any[]>([]);
  const versionDatos = useVersionDatos();
  const [mostrarForm, setMostrarForm] = useState(false);
  const [mostrarMenu, setMostrarMenu] = useState(false);

  const [tipo, setTipo] = useState("Inseminación");
  const [fecha, setFecha] = useState("");
  const [descripcion, setDescripcion] = useState("");
  const [valorGenetica, setValorGenetica] = useState("");
  const [geneticaEnContabilidad, setGeneticaEnContabilidad] = useState(true);
  const [pagoGenetica, setPagoGenetica] = useState<"contado" | "credito">("contado");
  const [tipoGenetica, setTipoGenetica] = useState("");
  const [otraGenetica, setOtraGenetica] = useState("");
  const [filtro, setFiltro] = useState("Todos");
  const [mensajeAviso, setMensajeAviso] = useState("");
  const [mostrarInfo, setMostrarInfo] = useState(false);
  const [selectedRegistro, setSelectedRegistro] = useState<any | null>(null);
  const [activeTouchIndex, setActiveTouchIndex] = useState<number | null>(null);
  const [touchStartX, setTouchStartX] = useState<number | null>(null);
  const [touchCurrentX, setTouchCurrentX] = useState<number | null>(null);
  const [swipedIndex, setSwipedIndex] = useState<number | null>(null);
  const [longPressIndex, setLongPressIndex] = useState<number | null>(null);
  const longPressTimer = useRef<number | null>(null);
  const logoPdf = useRef<LogoJpeg | null>(null);
  const [exportando, setExportando] = useState(false);
  const [exportandoParto, setExportandoParto] = useState(false);

  useEffect(() => {
    if (!mostrarInfo || logoPdf.current) return;
    cargarLogoJpeg("/images/logo.png").then((logo) => {
      logoPdf.current = logo;
    });
  }, [mostrarInfo]);

  useEffect(() => {
    const datos = JSON.parse(localStorage.getItem("cerdas") || "[]");
    const encontrada = datos.find((c: any) => c.id === id);
    setCerda(encontrada);

    const hist = JSON.parse(localStorage.getItem(`historial-${id}`) || "[]");
    const registrosLimpios = Array.isArray(hist)
      ? hist.filter((registro: any) => registro.tipo !== "Aviso")
      : [];
    setRegistros(registrosLimpios);
  }, [id, versionDatos]);

  function guardar(nuevos: any[]) {
    setRegistros(nuevos);
    guardarConRegistro(`historial-${id}`, nuevos);
  }

  /* Genética comprada antes de la inseminación (por ejemplo al destetar): queda en la cerda
     y se junta con la inseminación cuando se registre */
  const pendiente = (cerda?.geneticaPendiente ?? null) as { genetica: string; valor: number; fecha: string; movimientoId?: string; cuentaId?: string; pago?: "contado" | "credito" } | null;
  const pendienteEnConta = Boolean(pendiente?.movimientoId || pendiente?.cuentaId);
  const totalRegistros = registros.length + (pendiente ? 1 : 0) + (Array.isArray(cerda?.geneticasPerdidas) ? cerda.geneticasPerdidas.length : 0);
  function guardarPendiente(valor: typeof pendiente) {
    const lista = JSON.parse(localStorage.getItem("cerdas") || "[]");
    const nuevas = lista.map((c: any) => {
      if (c.id !== id) return c;
      const { geneticaPendiente: _g, ...resto } = c;
      return valor ? { ...resto, geneticaPendiente: valor } : resto;
    });
    guardarConRegistro("cerdas", nuevas);
    setCerda(nuevas.find((c: any) => c.id === id));
  }

  async function quitarPendiente() {
    if (!pendiente) return;
    const ok = await confirmar({
      titulo: "Quitar genética comprada",
      mensaje: `Se quitará la genética ${pendiente.genetica} (${formatoPesos(pendiente.valor)}) de esta cerda${pendienteEnConta ? " y su gasto de Contabilidad" : ""}.`,
      aceptar: "Quitar",
      destructivo: true,
    });
    if (!ok) return;
    quitarGastoGenetica(pendiente);
    guardarPendiente(null);
  }

  /** Elimina un registro de "Genética no usada" y su gasto en Contabilidad (Pérdidas) */
  async function eliminarPerdida(k: number) {
    const lista = Array.isArray(cerda?.geneticasPerdidas) ? (cerda.geneticasPerdidas as GeneticaPerdida[]) : [];
    const g = lista[k];
    if (!g) return;
    const enConta = Boolean(g.movimientoId || g.cuentaId);
    const ok = await confirmar({
      titulo: "Eliminar genética no usada",
      mensaje: `Se eliminará ${g.genetica} (${formatoPesos(g.valor)}), comprada el ${formatearFechaCorta(g.fecha)}${enConta ? ", y su pérdida en Contabilidad" : ""}.`,
      aceptar: "Eliminar",
      destructivo: true,
    });
    if (!ok) return;
    quitarGastoGenetica({ movimientoId: g.movimientoId, cuentaId: g.cuentaId });
    const todas = JSON.parse(localStorage.getItem("cerdas") || "[]");
    const nuevas = todas.map((c: any) => (c.id === id ? { ...c, geneticasPerdidas: (c.geneticasPerdidas ?? []).filter((_: unknown, i: number) => i !== k) } : c));
    guardarConRegistro("cerdas", nuevas);
    setCerda(nuevas.find((c: any) => c.id === id));
    mostrarAviso("Genética no usada eliminada");
  }

  // Editar la compra de genética (lápiz en el historial)
  const [editCompra, setEditCompra] = useState(false);
  const [ecTipo, setEcTipo] = useState("");
  const [ecOtra, setEcOtra] = useState("");
  const [ecValor, setEcValor] = useState("");
  const [ecFecha, setEcFecha] = useState("");
  function abrirEdicionCompra() {
    if (!pendiente) return;
    const conocida = GENETICAS.includes(pendiente.genetica);
    setEcTipo(conocida ? pendiente.genetica : "OTRA");
    setEcOtra(conocida ? "" : pendiente.genetica);
    setEcValor(String(pendiente.valor));
    setEcFecha(pendiente.fecha);
    setEditCompra(true);
  }
  function guardarEdicionCompra() {
    if (!pendiente) return;
    const nombre = ecTipo === "OTRA" ? ecOtra.trim() : ecTipo;
    const valor = Number(ecValor.replace(/\D/g, "")) || 0;
    if (!nombre) return mostrarAviso("Selecciona la genética");
    if (valor <= 0) return mostrarAviso("Ingresa el valor de la genética");
    actualizarGastoGenetica(pendiente, { fecha: ecFecha || undefined, monto: valor, descripcion: `Genética ${nombre} · cerda ${id} (para inseminación)` });
    guardarPendiente({ ...pendiente, genetica: nombre, valor, fecha: ecFecha || pendiente.fecha });
    setEditCompra(false);
  }

  // Al abrir una inseminación, la genética comprada viene llena
  useEffect(() => {
    if (!mostrarForm || tipo !== "Inseminación" || !pendiente) return;
    if (GENETICAS.includes(pendiente.genetica)) {
      setTipoGenetica(pendiente.genetica);
    } else {
      setTipoGenetica("OTRA");
      setOtraGenetica(pendiente.genetica);
    }
    setValorGenetica(String(pendiente.valor));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [mostrarForm, tipo, pendiente?.genetica, pendiente?.valor]);

  useEffect(() => {
    if (!mensajeAviso) return;
    const timer = window.setTimeout(() => setMensajeAviso(""), 1700);
    return () => window.clearTimeout(timer);
  }, [mensajeAviso]);

  // Limpiar formulario cuando se cierra sin guardar
  useEffect(() => {
    if (!mostrarForm) {
      setTipo("Inseminación");
      setFecha("");
      setDescripcion("");
      setValorGenetica("");
      setGeneticaEnContabilidad(true);
      setPagoGenetica("contado");
      setTipoGenetica("");
      setOtraGenetica("");
    }
  }, [mostrarForm]);

  useEffect(() => {
    if (swipedIndex === null && longPressIndex === null) return;
    function handlePointerDown(event: PointerEvent) {
      const target = event.target as HTMLElement | null;
      if (target?.closest('[data-swipe-ignore]')) return;
      setSwipedIndex(null);
      setLongPressIndex(null);
    }
    document.addEventListener("pointerdown", handlePointerDown);
    return () => document.removeEventListener("pointerdown", handlePointerDown);
  }, [swipedIndex, longPressIndex]);

  function mostrarAviso(mensaje: string) {
    setMensajeAviso(mensaje);
  }

  function eliminarRegistro(index: number) {
    const r = registros[index];
    const nuevos = registros.filter((_, i) => i !== index);
    guardar(nuevos);
    // El gasto de la genética se borra de Contabilidad con la inseminación
    if (r?.movimientoId || r?.cuentaId) quitarGastoGenetica({ movimientoId: r.movimientoId, cuentaId: r.cuentaId });
    // El lote de engorde creado con ese parto se borra junto con el parto
    if (r?.tipo === "Parto" && r.codigoParto) eliminarLotesDePartos({ codigos: [String(r.codigoParto)] });
  }

  async function pedirEliminarRegistro(index: number) {
    const r = registros[index];
    setSwipedIndex(null);
    if (!r) return;
    const lotes = r.tipo === "Parto" && r.codigoParto ? lotesDeParto(String(r.codigoParto)) : [];
    const base =
      (r.fecha ? `Se borrará el registro del ${formatearFechaCorta(r.fecha)}.` : "Se borrará este registro.") +
      (r.movimientoId || r.cuentaId ? ` También se quitará de Contabilidad el gasto de la genética (${formatoPesos(Number(r.valorGenetica) || 0)}).` : "");
    const ok = await confirmar({
      titulo: `Eliminar ${String(r.tipo || "registro").toLowerCase()}`,
      mensaje: lotes.length
        ? `${base} También se eliminará de Engorde el ${lotes.map(nombreLote).join(", ")} con sus pesajes, alimento y mortalidad.`
        : base,
      aceptar: "Eliminar",
      destructivo: true,
    });
    if (ok) eliminarRegistro(index);
  }

  async function eliminarHistorialCompleto() {
    setMostrarMenu(false);
    if (!(await confirmar({ titulo: "Eliminar historial", mensaje: "Se borrarán todos los registros de esta cerda y los lotes de Engorde creados con sus partos. Esta acción no se puede deshacer.", aceptar: "Eliminar", destructivo: true }))) return;
    borrarConRegistro(`historial-${id}`);
    for (const r of registros) if (r.movimientoId || r.cuentaId) quitarGastoGenetica({ movimientoId: r.movimientoId, cuentaId: r.cuentaId });
    eliminarLotesDePartos({ cerdaId: String(id) });
    setRegistros([]);
    setMostrarMenu(false);
  }

  function handleTouchStart(e: TouchEvent, idx: number) {
    setActiveTouchIndex(idx);
    setTouchStartX(e.touches[0].clientX);
    setTouchCurrentX(e.touches[0].clientX);
  }

  function handleTouchMove(e: TouchEvent, idx: number) {
    if (activeTouchIndex !== idx || touchStartX === null) return;
    cancelarLongPress();
    setTouchCurrentX(e.touches[0].clientX);
  }

  function handleTouchEnd(e: TouchEvent, idx: number) {
    if (touchStartX === null || touchCurrentX === null) {
      setActiveTouchIndex(null);
      setTouchStartX(null);
      setTouchCurrentX(null);
      return;
    }
    const dx = touchCurrentX - touchStartX;
    const threshold = -60; // swipe left threshold
    if (dx < threshold) {
      setSwipedIndex(idx);
    } else {
      // if was already swiped and user swiped right enough, close
      if (swipedIndex === idx && dx > 40) {
        setSwipedIndex(null);
      }
    }
    setActiveTouchIndex(null);
    setTouchStartX(null);
    setTouchCurrentX(null);
  }

  function iniciarLongPress(idx: number) {
    if (longPressTimer.current) {
      window.clearTimeout(longPressTimer.current);
    }
    longPressTimer.current = window.setTimeout(() => {
      setLongPressIndex(idx);
    }, 1000);
  }

  function cancelarLongPress() {
    if (longPressTimer.current) {
      window.clearTimeout(longPressTimer.current);
      longPressTimer.current = null;
    }
  }

  function calcularParto(fechaInseminacion: string) {
    const f = parsearFechaLocal(fechaInseminacion);
    f.setDate(f.getDate() + DIAS_GESTACION);
    return fechaLocalISO(f);
  }

  function calcularDiasEntre(fechaInicio: string, fechaFin: string) {
    const inicio = parsearFechaLocal(fechaInicio);
    const fin = parsearFechaLocal(fechaFin);
    return Math.floor((fin.getTime() - inicio.getTime()) / (1000 * 60 * 60 * 24));
  }

  function obtenerEstadoActual() {
    if (registros.length === 0) return "Activa";
    const ultimo = registros[0];
    switch (ultimo.tipo) {
      case "Inseminación":
        return "Gestación";
      case "Parto":
        return "Lactancia";
      case "Destete":
        return "Próxima a Celo";
      case "Aborto":
        return "Aborto";
      case "Baja":
        return "Baja";
      case "Celo":
        return "Celo";
      case "Tratamiento":
        return "Tratamiento";
      default:
        return "Activa";
    }
  }

  function agregarRegistro() {
    if (!fecha) return;

    // Prevent consecutive identical events for certain types
    if (["Parto", "Destete", "Baja"].includes(tipo)) {
      const ultimoTipo = registros[0]?.tipo;
      if (ultimoTipo === tipo) {
        mostrarAviso(`No se puede registrar ${tipo} de forma consecutiva`);
        return;
      }
    }

    const ultimoTipo = registros[0]?.tipo;
    const ultimaInseminacion = registros.find((r) => r.tipo === "Inseminación");
    const ultimoParto = registros.find((r) => r.tipo === "Parto");
    const ultimoDestete = registros.find((r) => r.tipo === "Destete");

    const diasDesdeInseminacion = ultimaInseminacion
      ? calcularDiasEntre(ultimaInseminacion.fecha, fecha)
      : null;
    const diasDesdeParto = ultimoParto
      ? calcularDiasEntre(ultimoParto.fecha, fecha)
      : null;

    if (ultimoTipo === "Inseminación") {
      if (tipo === "Celo") {
        mostrarAviso("Revisar Ciclo Reproductivo");
        return;
      }
      if (tipo === "Parto") {
        if (diasDesdeInseminacion === null || diasDesdeInseminacion < 110) {
          mostrarAviso("Revisar Ciclo Reproductivo");
          return;
        }
      }
      if (tipo === "Destete") {
        mostrarAviso("Revisar Ciclo Reproductivo");
        return;
      }
    }

    if (ultimoTipo === "Celo") {
      if (["Parto", "Destete", "Aborto"].includes(tipo)) {
        mostrarAviso("Revisar Ciclo Reproductivo");
        return;
      }
    }

    if (ultimoTipo === "Parto") {
      if (tipo === "Inseminación") {
        if (diasDesdeParto === null || diasDesdeParto < 21) {
          mostrarAviso("Revisar Ciclo Reproductivo");
          return;
        }
      }
      if (tipo === "Destete") {
        const { desteteMin, desteteMax } = leerConfig();
        if (diasDesdeParto === null || diasDesdeParto < desteteMin || diasDesdeParto > desteteMax) {
          mostrarAviso(`El destete debe estar entre ${desteteMin} y ${desteteMax} días después del parto`);
          return;
        }
      }
    }

    if (ultimoTipo === "Destete") {
      if (tipo === "Parto") {
        mostrarAviso("Revisar Ciclo Reproductivo");
        return;
      }
    }

    const genetica = Number(valorGenetica.replace(/\D/g, "")) || 0;
    const nombreGenetica = tipoGenetica === "OTRA" ? otraGenetica.trim() : tipoGenetica;
    const conGenetica = tipo === "Inseminación" || tipo === "Compra de genética";
    if (tipo === "Compra de genética" && pendiente) {
      mostrarAviso("Ya hay una genética comprada para esta cerda");
      return;
    }
    if (conGenetica && !nombreGenetica) {
      mostrarAviso(tipoGenetica === "OTRA" ? "Escribe cuál es la genética" : "Selecciona la genética");
      return;
    }
    if (conGenetica && genetica <= 0) {
      mostrarAviso("Ingresa el valor de la genética");
      return;
    }

    // Compra de genética: queda en el historial de la cerda hasta la inseminación (no cambia su estado)
    if (tipo === "Compra de genética") {
      const fechaCompra = fecha || fechaLocalISO(new Date());
      const enlace = geneticaEnContabilidad
        ? registrarGastoGenetica({ fecha: fechaCompra, descripcion: `Genética ${nombreGenetica} · cerda ${id} (para inseminación)`, monto: genetica, cerdaId: String(id), pago: pagoGenetica })
        : {};
      guardarPendiente({ genetica: nombreGenetica, valor: genetica, fecha: fechaCompra, ...enlace, pago: pagoGenetica });
      setMostrarForm(false);
      mostrarAviso("Compra de genética registrada");
      return;
    }

    let nuevo: any = { id: nuevoId(), tipo, fecha, descripcion };

    if (tipo === "Inseminación") {
      // El valor queda siempre en la cerda; en Contabilidad solo si se marcó
      nuevo.valorGenetica = genetica;
      nuevo.genetica = nombreGenetica;
      if (pendiente) nuevo.compraGenetica = pendiente.fecha;
      if (pendienteEnConta && pendiente) {
        // Ya estaba en Contabilidad desde la compra: se usa ese mismo gasto (sin duplicarlo)
        if (pendiente.movimientoId) nuevo.movimientoId = pendiente.movimientoId;
        if (pendiente.cuentaId) nuevo.cuentaId = pendiente.cuentaId;
        nuevo.pago = pendiente.pago;
        actualizarGastoGenetica(pendiente, { monto: genetica, descripcion: `Genética ${nombreGenetica} · inseminación cerda ${id}` });
      } else if (geneticaEnContabilidad) {
        const enlace = registrarGastoGenetica({ fecha, descripcion: `Genética ${nombreGenetica} · inseminación cerda ${id}`, monto: genetica, cerdaId: String(id), pago: pagoGenetica });
        Object.assign(nuevo, enlace);
        nuevo.pago = pagoGenetica;
      }
      const partoEst = calcularParto(fecha);
      nuevo.partoEstimado = partoEst;
      nuevo.mensaje = `Parto estimado: ${formatearFechaCorta(partoEst)}`;
    }

    if (tipo === "Aborto") {
      nuevo.mensaje = "Reiniciar ciclo reproductivo";
    }

    if (tipo === "Baja") {
      nuevo.mensaje = "Cerda dada de baja";
    }

    if (tipo === "Parto") {
      const d = parsearFechaLocal(fecha);
      const { desteteMin, desteteMax } = leerConfig();
      const d21 = new Date(d.getFullYear(), d.getMonth(), d.getDate() + desteteMin);
      const d28 = new Date(d.getFullYear(), d.getMonth(), d.getDate() + desteteMax);
      const f21 = formatearFechaCorta(fechaLocalISO(d21));
      const f28 = formatearFechaCorta(fechaLocalISO(d28));
      nuevo.mensaje = `Destete entre ${f21} y ${f28}`;
    }

    if (tipo === "Destete" && !ultimoDestete) {
      const d = parsearFechaLocal(fecha);
      d.setDate(d.getDate() + 3);
      const fechaCelo = formatearFechaCorta(fechaLocalISO(d));
      nuevo.mensaje = `Próxima a Celo ${fechaCelo}`;
    }

    if (tipo === "Celo") {
      nuevo.mensaje = "Revisar Celo";
    }

    if (tipo === "Evento") {
      nuevo.mensaje = "Nuevo evento registrado";
    }

    guardar([nuevo, ...registros]);
    // La genética comprada ya quedó en esta inseminación
    if (tipo === "Inseminación" && pendiente) guardarPendiente(null);
    setMostrarForm(false);
    setFecha("");
    setDescripcion("");
    setValorGenetica("");
  }

  // If a new registro was just created via the parto page, open it to show details
  useEffect(() => {
    const last = localStorage.getItem("last-new-registro");
    if (!last) return;
    try {
      const parsed = JSON.parse(last);
      if (parsed && parsed.cerdaId === id) {
        const hist = JSON.parse(localStorage.getItem(`historial-${id}`) || "[]");
        if (Array.isArray(hist) && hist.length > 0) {
          // open the most recent registro
          setSelectedRegistro(hist[0]);
        }
      }
    } catch (e) {}
    localStorage.removeItem("last-new-registro");
  }, [id]);

  if (!cerda) {
    return (
      <main className="min-h-screen flex flex-col items-center justify-center gap-3 bg-white px-6 text-center">
        <p className="text-black">Cerda no encontrada</p>
        <button
          onClick={() => router.push("/gestacion")}
          className="rounded-2xl bg-sky-900 px-4 py-2 text-sm font-bold text-white"
        >
          Ir a Gestación
        </button>
      </main>
    );
  }

  const estado = obtenerEstadoActual();
  const estadoColor =
    estado === "Baja"
      ? "bg-red-100 text-red-600"
      : estado === "Gestación"
      ? "bg-blue-100 text-blue-600"
      : estado === "Lactancia"
      ? "bg-sky-100 text-sky-600"
      : "bg-pink-100 text-pink-600";

  const ultimaInseminacion = registros.find((r) => r.tipo === "Inseminación");
  const ultimoParto = registros.find((r) => r.tipo === "Parto");
  const hoy = new Date();
  const fechaHoy = fechaLocalISO(hoy);
  const diasGestacion = ultimaInseminacion
    ? calcularDiasEntre(ultimaInseminacion.fecha, fechaHoy)
    : 0;
  const porcentajeGestacion = Math.round((diasGestacion / DIAS_GESTACION) * 100);
  // El progreso de gestación solo aplica mientras la cerda está en gestación (tras el parto se suspende)
  const enGestacion = estado === "Gestación" && !!ultimaInseminacion;
  const diasFaltantes = Math.max(0, DIAS_GESTACION - diasGestacion);

  const totalPartos = registros.filter((r) => r.tipo === "Parto").length;

  const partosRegistrados = registros.filter((r) => r.tipo === "Parto");
  const totalVivos = partosRegistrados.reduce((s, r) => s + (Number(r.vivos) || 0), 0);
  const totalMuertos = partosRegistrados.reduce((s, r) => s + (Number(r.muertos) || 0), 0);
  const contarTipo = (t: string) => registros.filter((r) => r.tipo === t).length;
  const cifrasRepro = [
    { titulo: "Partos", valor: String(totalPartos), destacado: true },
    { titulo: "Nacidos vivos", valor: String(totalVivos), destacado: true },
    {
      titulo: "Promedio vivos / parto",
      valor: partosRegistrados.length ? (totalVivos / partosRegistrados.length).toFixed(1) : "–",
      destacado: true,
    },
    { titulo: "Nacidos muertos", valor: String(totalMuertos) },
    { titulo: "Inseminaciones", valor: String(contarTipo("Inseminación")) },
    { titulo: "Destetes", valor: String(contarTipo("Destete")) },
    { titulo: "Celos", valor: String(contarTipo("Celo")) },
    { titulo: "Abortos", valor: String(contarTipo("Aborto")) },
    { titulo: "Tratamientos", valor: String(contarTipo("Tratamiento")) },
  ];
  const datosGenerales = [
    { icono: "🏷️", etiqueta: "Identificación", valor: String(cerda.id) },
    { icono: "🧬", etiqueta: "Raza", valor: cerda.raza || "–" },
    { icono: "📅", etiqueta: "Fecha de llegada", valor: cerda.fecha ? formatearFechaCorta(cerda.fecha) : "–" },
    { icono: "⚖️", etiqueta: "Peso de llegada", valor: cerda.peso ? `${cerda.peso} kg` : "–" },
    { icono: "🧱", etiqueta: "Jaula", valor: jaulaDeCerda(cerda) || "–" },
    { icono: "⏱️", etiqueta: "Tiempo en la granja", valor: cerda.fecha ? calcularEdadLlegada(cerda.fecha) : "–" },
  ];

  /** Número de parto (por fecha), inseminación de esa gestación, días y lote */
  function infoParto(p: { fecha?: string; codigoParto?: string; vivos?: number; pesoPromedio?: number }) {
    const partos = registros.filter((r) => r.tipo === "Parto").sort((a, b) => String(a.fecha || "").localeCompare(String(b.fecha || "")));
    const i = partos.findIndex((r) => r === p || (r.codigoParto && r.codigoParto === p.codigoParto));
    const numero = i >= 0 ? i + 1 : partos.length;
    const ia = registros.find((r) => r.tipo === "Inseminación" && String(r.fecha || "") <= String(p.fecha || ""));
    const diasGestacion = ia?.fecha && p.fecha ? calcularDiasEntre(ia.fecha, p.fecha) : null;
    const lote = p.codigoParto ? loteDelParto(p.codigoParto) : undefined;
    const pesoCamada = p.pesoPromedio && p.vivos ? Math.round(Number(p.pesoPromedio) * Number(p.vivos) * 100) / 100 : 0;
    return { numero, fechaIA: ia?.fecha as string | undefined, diasGestacion, lote: lote ? `${lote.codigo ?? ""}${lote.activo ? "" : " (cerrado)"}` : "", pesoCamada };
  }

  async function exportarParto(p: Record<string, any>) {
    if (exportandoParto) return;
    setExportandoParto(true);
    try {
      const info = infoParto(p);
      // Logo en buena resolución: también va como marca de agua
      const logo = (await cargarLogoJpeg("/images/logo.png", 600)) ?? logoPdf.current;
      const blob = generarPdfParto({
        granja: nombreGranjaActual(),
        cerda: String(id),
        numeroParto: info.numero,
        codigoParto: p.codigoParto || "",
        fecha: p.fecha ? formatearFechaCorta(p.fecha) : "",
        hora: p.horaInicio || "",
        tipoParto: p.tipoParto || "",
        asistidoPor: p.asistidoPor || "",
        diasGestacion: info.diasGestacion !== null ? `${info.diasGestacion} días` : "",
        fechaIA: info.fechaIA ? formatearFechaCorta(info.fechaIA) : "",
        genetica: p.genetica || "",
        vivos: Number(p.vivos) || 0,
        muertos: Number(p.muertos) || 0,
        momias: Number(p.momias) || 0,
        pesoPromedio: p.pesoPromedio != null ? `${p.pesoPromedio} kg` : "",
        pesoCamada: info.pesoCamada ? `${info.pesoCamada} kg` : "",
        pesoCerda: p.pesoCerda != null ? `${p.pesoCerda} kg` : "",
        estadoSalud: p.estadoSalud || "",
        lote: info.lote,
        destete: String(p.mensaje || "").replace(/^Destete entre /, "Entre "),
        observaciones: p.observaciones || "",
        observacionesLechones: p.observacionesLechones || "",
        fechaGeneracion: formatearFechaCorta(fechaLocalISO(new Date())),
        logo,
      });
      await entregarPdf(blob, `parto-${String(id).replace(/[^\w-]+/g, "_")}-n${info.numero}.pdf`);
    } catch {
      mostrarAviso("No se pudo generar el PDF");
    } finally {
      setExportandoParto(false);
    }
  }

  async function exportarPdf() {
    if (exportando) return;
    setExportando(true);
    try {
      let nombreGranja = "Porcícola El Mirador";
      try {
        const ajustes = JSON.parse(localStorage.getItem("ajustes") || "{}");
        if (typeof ajustes?.nombreGranja === "string" && ajustes.nombreGranja.trim()) {
          nombreGranja = `Porcícola ${ajustes.nombreGranja.trim()}`;
        }
      } catch {}
      const blob = generarPdfFicha({
        id: String(cerda.id),
        raza: cerda.raza || "",
        estado,
        granja: nombreGranja,
        generales: datosGenerales.map(({ etiqueta, valor }) => ({ etiqueta, valor })),
        cifras: cifrasRepro,
        fechaGeneracion: formatearFechaCorta(fechaLocalISO(new Date())),
        logo: logoPdf.current,
      });
      await entregarPdf(blob, `ficha-cerda-${String(cerda.id).replace(/[^\w-]+/g, "_")}.pdf`);
    } catch {
      mostrarAviso("No se pudo generar el PDF");
    } finally {
      setExportando(false);
    }
  }

  return (
    <main
      className="min-h-screen bg-white p-3 pb-32 overflow-x-hidden"
      style={{ paddingTop: "calc(env(safe-area-inset-top) + 0.75rem)" }}
    >
      {selectedRegistro && (() => {
        const p = selectedRegistro;
        const info = infoParto(p);
        const total = (Number(p.vivos) || 0) + (Number(p.muertos) || 0) + (Number(p.momias) || 0);
        const fila = (k: string, v: string) => (
          <div className="min-w-0">
            <p className="text-[11px] text-slate-500">{k}</p>
            <p className="truncate text-sm font-semibold text-slate-900">{v || "—"}</p>
          </div>
        );
        return (
          <Modal abierta etiqueta={`Parto N.º ${info.numero}`} titulo={`Cerda ${id}`} subtitulo={p.codigoParto} icono="🐷" onCerrar={() => setSelectedRegistro(null)}>
            <div className="flex flex-col gap-4">
              <div className="grid grid-cols-4 gap-1.5 text-center">
                {[
                  { t: "Nacidos", v: total, c: "text-slate-900" },
                  { t: "Vivos", v: Number(p.vivos) || 0, c: "text-emerald-700" },
                  { t: "Muertos", v: Number(p.muertos) || 0, c: Number(p.muertos) ? "text-rose-600" : "text-slate-900" },
                  { t: "Momias", v: Number(p.momias) || 0, c: Number(p.momias) ? "text-rose-600" : "text-slate-900" },
                ].map((x) => (
                  <div key={x.t} className="rounded-2xl bg-slate-50 px-1 py-2.5 ring-1 ring-slate-100">
                    <p className={`text-xl font-black leading-none tabular-nums ${x.c}`}>{x.v}</p>
                    <p className="mt-1 text-[10px] font-semibold uppercase tracking-wide text-slate-500">{x.t}</p>
                  </div>
                ))}
              </div>
              <section>
                <h4 className="mb-2 text-[11px] font-bold uppercase tracking-[0.14em] text-sky-700">Parto</h4>
                <div className="grid grid-cols-2 gap-x-3 gap-y-2.5">
                  {fila("Fecha", p.fecha ? formatearFechaCorta(p.fecha) : "")}
                  {fila("Hora de inicio", p.horaInicio || "")}
                  {fila("Tipo", p.tipoParto || "")}
                  {fila("Asistido por", p.asistidoPor || "")}
                  {fila("Inseminación", info.fechaIA ? formatearFechaCorta(info.fechaIA) : "")}
                  {fila("Días de gestación", info.diasGestacion !== null ? `${info.diasGestacion} días` : "")}
                </div>
              </section>
              <section>
                <h4 className="mb-2 text-[11px] font-bold uppercase tracking-[0.14em] text-sky-700">Camada y madre</h4>
                <div className="grid grid-cols-2 gap-x-3 gap-y-2.5">
                  {fila("Peso promedio", p.pesoPromedio != null ? `${p.pesoPromedio} kg` : "")}
                  {fila("Peso camada (vivos)", info.pesoCamada ? `${info.pesoCamada} kg` : "")}
                  {fila("Genética", p.genetica || "")}
                  {fila("Peso de la cerda", p.pesoCerda != null ? `${p.pesoCerda} kg` : "")}
                  {fila("Estado de salud", p.estadoSalud || "")}
                  {fila("Lote de engorde", info.lote)}
                </div>
              </section>
              {(p.observaciones || p.observacionesLechones) && (
                <section className="flex flex-col gap-2">
                  {p.observaciones && (
                    <div className="rounded-2xl bg-slate-50 px-3 py-2.5 ring-1 ring-slate-100">
                      <p className="text-[11px] text-slate-500">Observaciones del parto</p>
                      <p className="mt-0.5 break-words text-sm text-slate-800">{p.observaciones}</p>
                    </div>
                  )}
                  {p.observacionesLechones && (
                    <div className="rounded-2xl bg-slate-50 px-3 py-2.5 ring-1 ring-slate-100">
                      <p className="text-[11px] text-slate-500">Observaciones de los lechones</p>
                      <p className="mt-0.5 break-words text-sm text-slate-800">{p.observacionesLechones}</p>
                    </div>
                  )}
                </section>
              )}
              <button
                type="button"
                onClick={() => void exportarParto(p)}
                disabled={exportandoParto}
                className="flex w-full items-center justify-center gap-2 rounded-2xl bg-sky-900 py-3 text-[15px] font-semibold text-white transition active:bg-sky-950 disabled:opacity-60"
              >
                <svg viewBox="0 0 24 24" className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                  <path d="M12 4v11M7.5 10.5 12 15l4.5-4.5M5 19h14" />
                </svg>
                {exportandoParto ? "Generando PDF…" : "Exportar reporte del parto"}
              </button>
            </div>
          </Modal>
        );
      })()}
      {mensajeAviso && (
        <div style={{ bottom: "calc(env(safe-area-inset-bottom) + 5rem)" }} className="fixed left-1/2 z-[9999] -translate-x-1/2 rounded-full bg-red-500 px-6 py-2 text-center text-sm font-bold text-white shadow-lg">
          {mensajeAviso}
        </div>
      )}

      <div className="w-full mx-auto">
        {/* HEADER */}
        <div className="flex items-center justify-between mb-2">
          <button
            onClick={() => router.back()}
            className="bg-white shadow border border-gray-200 px-4 py-2 rounded-2xl text-black hover:bg-gray-50"
          >
            ←
          </button>
          <div className="flex-1 text-center">
            <h1 className="text-2xl font-extrabold text-black">{cerda.id}</h1>
          </div>
          <div className="relative">
            <button
              onClick={() => setMostrarMenu(!mostrarMenu)}
              className="bg-white shadow border border-gray-200 px-3 py-2 rounded-2xl text-black hover:bg-gray-50"
            >
              ⋮
            </button>
            {mostrarMenu && (
              <>
                <div className="fixed inset-0 z-40" onClick={() => setMostrarMenu(false)} />
                <div className="absolute right-0 top-12 bg-white border border-gray-200 rounded-2xl shadow-lg overflow-hidden z-50">
                  <button
                    onClick={eliminarHistorialCompleto}
                    className="px-4 py-3 text-red-600 font-bold whitespace-nowrap hover:bg-red-50 w-full text-left"
                  >
                    Eliminar historial
                  </button>
                </div>
              </>
            )}
          </div>
        </div>

        {/* INFO PRINCIPAL */}
        <div className="bg-white rounded-xl p-3 shadow-sm border border-gray-100 mb-3">
          <div className="flex items-start gap-2 mb-3">
            <div className="w-12 h-12 rounded-full bg-pink-100 border border-pink-200 flex items-center justify-center text-xl flex-shrink-0">
              🐷
            </div>
            <div className="flex-1">
              <div className="flex items-center justify-between gap-3">
                <h2 className="text-lg font-bold text-black">{cerda.raza}</h2>
                <button
                  onClick={() => setMostrarInfo(true)}
                  className="rounded-2xl bg-slate-100 px-3 py-2 text-sm font-semibold text-slate-800 hover:bg-slate-200"
                  aria-label="Ver información de la cerda"
                >
                  📋
                </button>
              </div>
              <div className="flex gap-2 mt-1 text-xs">
                <span className="px-2 py-0.5 rounded-full font-bold bg-sky-100 text-sky-600">ACTIVA</span>
                <span className={`px-2 py-0.5 rounded-full font-bold ${estadoColor}`}>{estado === 'Gestación' ? 'GESTACIÓN' : estado.toUpperCase()}</span>
              </div>
            </div>
          </div>

          {/* TARJETAS GRIS APILADAS (ahora encima) */}
          <div className="space-y-1 mb-3">
            {/* Jaula: al tocarla abre el módulo Jaula para ubicarla o cambiarla */}
            <button
              type="button"
              onClick={() => {
                const j = jaulaDeCerda(cerda).trim().toUpperCase();
                const area = j.startsWith("L-") ? "lactancia" : j.startsWith("G-") ? "gestacion" : "";
                const q = new URLSearchParams({ cerda: String(cerda.id) });
                if (area) {
                  q.set("area", area);
                  q.set("jaula", j);
                }
                router.push(`/jaula?${q.toString()}`);
              }}
              className="flex w-full items-center justify-between rounded-md bg-gray-100 p-1 text-left active:bg-gray-200"
            >
              <div className="flex items-center gap-2">
                <span className="text-gray-500">🧱</span>
                <div className="text-[11px] text-gray-600">Jaula</div>
              </div>
              <div className="flex items-center gap-1 text-sm font-bold">
                {jaulaDeCerda(cerda) || "Ubicar"}
                <span className="text-sky-700" aria-hidden="true">›</span>
              </div>
            </button>
            <div className="bg-gray-100 rounded-md p-1 flex items-center justify-between">
              <div className="flex items-center gap-2">
                <span className="text-pink-500">🐖</span>
                <div className="text-[11px] text-gray-600">Partos</div>
              </div>
              <div className="font-bold text-sm">{totalPartos}</div>
            </div>

            <div className="bg-gray-100 rounded-md p-1 flex items-center justify-between">
              <div className="flex items-center gap-2">
                <span className="text-orange-400">🐷</span>
                <div className="text-[11px] text-gray-600">Lechones</div>
              </div>
              <div className="font-bold text-sm">{totalVivos || '-'}</div>
            </div>

            <div className="bg-gray-100 rounded-md p-1 flex items-center justify-between">
              <div className="flex items-center gap-2">
                <span className="text-indigo-400">⏱️</span>
                <div className="text-[11px] text-gray-600">Edad</div>
              </div>
              <div className="font-bold text-sm">{cerda.fecha ? calcularEdadLlegada(cerda.fecha) : '-'}</div>
            </div>
          </div>

          {/* BLOQUE DE GESTACIÓN */}
          <div className="bg-white rounded-2xl p-3 mb-3 border border-gray-100">
            <div className="grid grid-cols-3 gap-2 text-[11px]">
              <div className="bg-gray-100 rounded-lg p-2 flex flex-col gap-1 min-h-[64px] justify-center">
                <span className="text-gray-500 text-[10px] leading-3">IA (Última)</span>
                <span className="font-bold text-[11px] leading-4 break-words whitespace-normal">
                  {ultimaInseminacion ? formatearFechaCorta(ultimaInseminacion.fecha) : '-'}
                </span>
              </div>
              <div className="bg-gray-100 rounded-lg p-2 flex flex-col gap-1 min-h-[64px]">
                <span className="text-gray-500">Parto estimado</span>
                <span className="font-bold text-[12px] leading-4 truncate">{enGestacion ? formatearFechaCorta(calcularParto(ultimaInseminacion.fecha)) : '-'}</span>
              </div>
              <div className="bg-gray-100 rounded-lg p-2 flex flex-col gap-1 min-h-[64px]">
                <span className="text-gray-500">Días gest.</span>
                <span className="font-bold text-[12px] leading-4">{enGestacion ? `Día ${diasGestacion}` : '-'}</span>
                {enGestacion && <span className="text-gray-500 text-[10px]">{diasGestacion} / {DIAS_GESTACION}</span>}
              </div>
            </div>
          </div>
        </div>

        {/* PROGRESO DE GESTACIÓN: solo mientras está en gestación */}
        {enGestacion && (
          <div className="bg-white rounded-xl p-3 shadow-sm border border-gray-100 mb-3">
            <div className="flex items-center justify-between mb-3">
              <h3 className="text-sm font-bold text-black">Progreso de gestación</h3>
              <span className="text-blue-600 font-bold text-xs">{porcentajeGestacion}%</span>
            </div>

            {/* BARRA */}
            <div className="w-full bg-gray-200 rounded-full h-2 overflow-hidden shadow-inner mb-2">
              <div
                className="bg-blue-500 h-full transition-all duration-300 rounded-full"
                style={{ width: `${Math.min(porcentajeGestacion, 100)}%` }}
              />
            </div>

            <div className="flex items-center justify-between text-xs">
              <span className="text-blue-600 font-bold">Día {diasGestacion}</span>
              <span className="text-gray-500">Faltan {diasFaltantes} días</span>
            </div>

            {/* TARJETAS DE ESTADÍSTICAS */}
            <div className="grid grid-cols-3 gap-2 mt-3 text-xs">
              <div className="bg-sky-50 rounded-xl p-2 text-center">
                <p className="text-xl">📅</p>
                <p className="text-black font-bold mt-1">{diasGestacion}</p>
                <p className="text-gray-500 text-[11px]">Días desde IA</p>
              </div>
              <div className="bg-blue-50 rounded-xl p-2 text-center">
                <p className="text-xl">🕐</p>
                <p className="text-black font-bold mt-1">{diasFaltantes}</p>
                <p className="text-gray-500 text-[11px]">Días faltantes</p>
              </div>
              <div className="bg-purple-50 rounded-xl p-2 text-center">
                <p className="text-xl">🐷</p>
                <p className="text-black font-bold mt-1">{totalPartos}</p>
                <p className="text-gray-500 text-[11px]">Partos</p>
              </div>
            </div>
          </div>
        )}

        {/* ALERTAS ACTIVAS */}
        {enGestacion && diasGestacion > 110 && (
          <div className="bg-yellow-50 border border-yellow-200 rounded-3xl p-4 mb-4">
            <p className="text-yellow-800 font-bold text-sm flex items-center gap-2">
              🔔 Alertas activas
            </p>
            <div className="mt-2 space-y-2">
              <div className="bg-yellow-100 px-3 py-2 rounded-2xl text-yellow-900 text-xs">
                Parto próximo en {diasFaltantes} días
              </div>
            </div>
          </div>
        )}

        {/* HISTORIAL: línea de tiempo agrupada por mes, del más reciente al más antiguo */}
        {(() => {
          // La compra de genética pendiente se muestra como un registro más (idx -1: se edita con el lápiz)
          const compraVirtual = [
            ...(pendiente
              ? [
                  {
                    r: {
                      tipo: "Compra de genética",
                      fecha: pendiente.fecha,
                      genetica: pendiente.genetica,
                      valorGenetica: pendiente.valor,
                      compra: true,
                    } as any,
                    idx: -1,
                  },
                ]
              : []),
            // Genética que se dañó sin usarse (pasó a Pérdidas en Contabilidad)
            ...((Array.isArray(cerda?.geneticasPerdidas) ? cerda.geneticasPerdidas : []) as GeneticaPerdida[]).map((g, k) => ({
              r: {
                tipo: "Genética no usada",
                fecha: g.vencio,
                genetica: g.genetica,
                valorGenetica: g.valor,
                mensaje: `Comprada ${formatearFechaCorta(g.fecha)} · pasó a Pérdidas`,
                perdida: k,
              } as any,
              idx: -2 - k,
            })),
          ];
          const ordenados = [...registros.map((r, idx) => ({ r, idx })), ...compraVirtual]
            .sort((a, b) => String(b.r.fecha || "").localeCompare(String(a.r.fecha || "")) || a.idx - b.idx);
          const tiposPresentes = TIPOS_HISTORIAL.filter((t) => registros.some((r) => r.tipo === t) || compraVirtual.some((v) => v.r.tipo === t));
          const visibles = ordenados.filter(({ r }) => filtro === "Todos" || r.tipo === filtro);
          const grupos: { clave: string; titulo: string; items: typeof visibles }[] = [];
          for (const item of visibles) {
            const clave = String(item.r.fecha || "").slice(0, 7) || "sin-fecha";
            let g = grupos.find((x) => x.clave === clave);
            if (!g) {
              g = { clave, titulo: tituloMes(clave), items: [] };
              grupos.push(g);
            }
            g.items.push(item);
          }

          // Confirmación de gestación pendiente (1.ª día 18–24, 2.ª día 40–44)
          const ia = registros.find((x) => x.tipo === "Inseminación");
          const diasIa = ia?.fecha ? calcularDiasEntre(ia.fecha, fechaLocalISO(new Date())) : null;
          const cerradaIa = ia ? registros.some((x) => ["Parto", "Aborto"].includes(x.tipo) && x.fecha >= ia.fecha) : true;
          const porConfirmar =
            ia && diasIa !== null && !cerradaIa
              ? CONFIRMACIONES_GESTACION.find((c) => diasIa >= c.desde && diasIa <= c.hasta && !(c.etapa === 1 ? ia.confirmacion1 : ia.confirmacion2))
              : undefined;

          return (
            <>
            {porConfirmar && (
              <div className="mb-3 flex items-center gap-3 rounded-2xl bg-amber-50 px-4 py-3 ring-1 ring-amber-200">
                <div className="min-w-0 flex-1">
                  <p className="text-sm font-semibold text-amber-900">{porConfirmar.etapa}.ª confirmación de gestación</p>
                  <p className="text-xs text-amber-800">Día {diasIa} después de la inseminación (ventana {porConfirmar.desde}–{porConfirmar.hasta})</p>
                </div>
                <button
                  type="button"
                  onClick={async () => {
                    const ok = await confirmar({
                      titulo: `${porConfirmar.etapa}.ª confirmación`,
                      mensaje: `¿La cerda ${id} sigue gestante? Se registrará la ${porConfirmar.etapa}.ª confirmación con fecha de hoy.`,
                      aceptar: "Confirmar",
                    });
                    if (ok) confirmarGestacion(String(id), porConfirmar.etapa);
                  }}
                  className="shrink-0 rounded-full bg-sky-900 px-4 py-2 text-sm font-semibold text-white active:scale-95"
                >
                  Confirmar
                </button>
              </div>
            )}
            {editCompra && pendiente && (
              <Modal abierta etiqueta={`Cerda ${id}`} titulo="Compra de genética" subtitulo="Editar o eliminar" icono="🧬" onCerrar={() => setEditCompra(false)}>
                <div className="flex flex-col gap-3">
                  <div>
                    <p className="mb-1 text-sm font-medium text-slate-700">Genética *</p>
                    <SelectorApp
                      valor={ecTipo}
                      onCambiar={setEcTipo}
                      titulo="Genética"
                      placeholder="Selecciona la genética"
                      opciones={[...GENETICAS.map((g) => ({ valor: g, texto: g })), { valor: "OTRA", texto: "Otro…" }]}
                      className="w-full"
                      claseBoton="h-11 rounded-xl bg-slate-50 px-3.5 text-base text-slate-900 ring-1 ring-slate-200"
                    />
                    {ecTipo === "OTRA" && (
                      <input
                        type="text"
                        value={ecOtra}
                        onChange={(e) => setEcOtra(e.target.value.slice(0, 40))}
                        placeholder="Escribe la genética"
                        className="mt-2 h-11 w-full rounded-xl bg-slate-50 px-3.5 text-base text-slate-900 outline-none ring-1 ring-slate-200"
                      />
                    )}
                  </div>
                  <div className="grid grid-cols-2 gap-2">
                    <label className="flex min-w-0 flex-col gap-1">
                      <span className="text-sm font-medium text-slate-700">Valor *</span>
                      <span className="relative">
                        <span className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-slate-400">$</span>
                        <input
                          type="text"
                          inputMode="numeric"
                          value={ecValor ? Number(ecValor).toLocaleString("es-CO") : ""}
                          onChange={(e) => setEcValor(e.target.value.replace(/\D/g, "").slice(0, 10))}
                          className="h-11 w-full rounded-xl bg-slate-50 pl-7 pr-3 text-base text-slate-900 outline-none ring-1 ring-slate-200"
                        />
                      </span>
                    </label>
                    <label className="flex min-w-0 flex-col gap-1">
                      <span className="text-sm font-medium text-slate-700">Fecha</span>
                      <input
                        type="date"
                        value={ecFecha}
                        max={fechaLocalISO(new Date())}
                        onChange={(e) => setEcFecha(e.target.value)}
                        className="h-11 w-full rounded-xl bg-slate-50 px-3 text-base text-slate-900 outline-none ring-1 ring-slate-200"
                      />
                    </label>
                  </div>
                  <div className="grid grid-cols-2 gap-2">
                    <button
                      type="button"
                      onClick={async () => {
                        setEditCompra(false);
                        await quitarPendiente();
                      }}
                      className="rounded-2xl py-3 text-[15px] font-semibold text-rose-600 ring-1 ring-rose-200 active:bg-rose-50"
                    >
                      Eliminar
                    </button>
                    <button type="button" onClick={guardarEdicionCompra} className="rounded-2xl bg-sky-900 py-3 text-[15px] font-semibold text-white active:bg-sky-950">
                      Guardar
                    </button>
                  </div>
                </div>
              </Modal>
            )}
            <section className="mb-3 overflow-hidden rounded-3xl border border-slate-100 bg-white shadow-sm">
              <div className="flex items-center justify-between gap-3 px-4 pt-4">
                <div className="min-w-0">
                  <h3 className="text-[15px] font-bold text-slate-900">Historial</h3>
                  <p className="text-xs text-slate-500">
                    {totalRegistros === 1 ? "1 registro" : `${totalRegistros} registros`} · más recientes primero
                  </p>
                </div>
                <button
                  onClick={() => setMostrarForm(true)}
                  className="shrink-0 whitespace-nowrap rounded-full bg-sky-900 px-3.5 py-2 text-sm font-bold text-white transition hover:bg-sky-950 active:scale-95"
                >
                  + Registro
                </button>
              </div>

              {/* Filtro por tipo de registro (lista con el estilo de la app) */}
              {totalRegistros > 0 && (
                <div className="mt-3 flex items-center gap-2 px-4">
                  <span className="shrink-0 text-xs font-medium text-slate-500">Ver</span>
                  <SelectorApp
                    valor={tiposPresentes.includes(filtro as (typeof tiposPresentes)[number]) ? filtro : "Todos"}
                    onCambiar={setFiltro}
                    titulo="Filtrar historial"
                    opciones={["Todos", ...tiposPresentes].map((t) => {
                      const n = t === "Todos" ? registros.length : registros.filter((r) => r.tipo === t).length;
                      return { valor: t, texto: `${t === "Todos" ? "Todos los registros" : `${infoTipo(t).icono === "🍼" ? "" : `${infoTipo(t).icono} `}${t}`} · ${n}` };
                    })}
                    className="min-w-0 flex-1"
                  />
                  {filtro !== "Todos" && (
                    <button type="button" onClick={() => setFiltro("Todos")} className="shrink-0 text-xs font-semibold text-sky-700 active:opacity-70">
                      Quitar
                    </button>
                  )}
                </div>
              )}

              <div className="px-4 pb-4 pt-3" onClick={() => setSwipedIndex(null)}>
                {totalRegistros === 0 ? (
                  <div className="flex flex-col items-center gap-1 rounded-2xl border border-dashed border-slate-200 px-6 py-10 text-center">
                    <span className="text-3xl" aria-hidden="true">📋</span>
                    <p className="mt-1 text-sm font-semibold text-slate-800">Sin registros todavía</p>
                    <p className="text-xs text-slate-500">Toca “+ Registro” para anotar la primera inseminación, celo o parto.</p>
                  </div>
                ) : visibles.length === 0 ? (
                  <p className="py-6 text-center text-sm text-slate-500">No hay registros de este tipo.</p>
                ) : (
                  <div className="flex flex-col gap-3">
                    {grupos.map((g) => (
                      <div key={g.clave}>
                        <p className="mb-1.5 text-[11px] font-semibold uppercase tracking-wider text-slate-400">{g.titulo}</p>
                        <ol className="relative flex flex-col gap-1.5 before:absolute before:bottom-3 before:left-[13px] before:top-3 before:w-0.5 before:rounded-full before:bg-slate-100">
                          {g.items.map(({ r, idx }) => {
                            const info = infoTipo(r.tipo);
                            const isActiveMove = activeTouchIndex === idx && touchStartX !== null && touchCurrentX !== null;
                            const moveDx = isActiveMove ? Math.min(0, touchCurrentX! - touchStartX!) : 0;
                            const isSwiped = swipedIndex === idx;
                            const translateX = isSwiped ? -92 : moveDx;
                            const dias = r.fecha ? calcularDiasEntre(r.fecha, fechaHoy) : null;
                            const relativo =
                              dias === null ? "" : dias === 0 ? "Hoy" : dias === 1 ? "Ayer" : dias > 0 ? `Hace ${dias} días` : `En ${-dias} días`;
                            return (
                              <li key={`${idx}-${r.fecha}-${r.tipo}`} className="relative flex gap-2">
                                <span
                                  aria-hidden="true"
                                  className={`relative z-10 mt-1 flex h-7 w-7 shrink-0 items-center justify-center rounded-lg text-sm ring-[3px] ring-white ${info.fondo}`}
                                >
                                  <Emoji e={info.icono} />
                                </span>

                                <div className="relative min-w-0 flex-1 overflow-hidden rounded-xl">
                                  {/* Acción al deslizar */}
                                  <div
                                    className={`absolute inset-y-0 right-0 flex w-[88px] items-center justify-center rounded-r-xl bg-red-500 transition-opacity ${
                                      isSwiped ? "pointer-events-auto opacity-100" : "pointer-events-none opacity-0"
                                    }`}
                                  >
                                    <button
                                      data-swipe-ignore="true"
                                      onPointerDown={(e) => e.stopPropagation()}
                                      onClick={(e) => {
                                        e.stopPropagation();
                                        pedirEliminarRegistro(idx);
                                      }}
                                      className="flex flex-col items-center gap-0.5 text-[11px] font-semibold text-white"
                                      aria-label={`Eliminar registro ${r.tipo}`}
                                    >
                                      <svg viewBox="0 0 24 24" className="h-5 w-5" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                                        <path d="M4 7h16M10 11v6M14 11v6M5 7l1 12a2 2 0 0 0 2 2h8a2 2 0 0 0 2-2l1-12M9 7V4h6v3" />
                                      </svg>
                                      Eliminar
                                    </button>
                                  </div>

                                  <div
                                    className={`relative z-10 rounded-xl border bg-white px-3 py-2 ${info.borde}`}
                                    onTouchStart={(e) => { if (idx < 0) return; handleTouchStart(e, idx); e.stopPropagation(); }}
                                    onTouchMove={(e) => { if (idx < 0) return; handleTouchMove(e, idx); e.stopPropagation(); }}
                                    onTouchEnd={(e) => { if (idx < 0) return; handleTouchEnd(e, idx); e.stopPropagation(); }}
                                    style={{
                                      transform: `translateX(${translateX}px)`,
                                      transition: isActiveMove ? "none" : "transform 200ms ease-out",
                                    }}
                                  >
                                    <div className="flex items-baseline justify-between gap-2">
                                      <p className={`min-w-0 truncate text-[13px] font-bold leading-snug ${info.texto}`}>{r.tipo}</p>
                                      <p className="flex shrink-0 items-center gap-1.5 whitespace-nowrap text-[11px] text-slate-500">
                                        <span>
                                          <span className="font-semibold text-slate-700">{r.fecha ? formatearFechaCorta(r.fecha) : "–"}</span>
                                          {relativo ? ` · ${relativo}` : ""}
                                        </span>
                                        {(r.compra || typeof r.perdida === "number") && (
                                          <button
                                            type="button"
                                            data-swipe-ignore="true"
                                            onClick={(e) => {
                                              e.stopPropagation();
                                              if (r.compra) abrirEdicionCompra();
                                              else void eliminarPerdida(r.perdida);
                                            }}
                                            aria-label={r.compra ? "Editar compra de genética" : "Eliminar genética no usada"}
                                            className={`-my-1 flex h-7 w-7 items-center justify-center rounded-full ${r.compra ? "text-violet-700 active:bg-violet-50" : "text-rose-600 active:bg-rose-50"}`}
                                          >
                                            <svg viewBox="0 0 24 24" className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                                              <path d="M4 20h4L19 9l-4-4L4 16v4zM14 6l4 4" />
                                            </svg>
                                          </button>
                                        )}
                                      </p>
                                    </div>

                                    {r.tipo === "Parto" && (
                                      <div className="mt-1 flex flex-wrap gap-1">
                                        <span className="rounded-full bg-sky-50 px-2 py-0.5 text-[11px] font-semibold text-sky-800">
                                          {r.vivos ?? 0} vivos
                                        </span>
                                        {Number(r.muertos) > 0 && (
                                          <span className="rounded-full bg-slate-100 px-2 py-0.5 text-[11px] font-semibold text-slate-700">{r.muertos} muertos</span>
                                        )}
                                        {Number(r.momias) > 0 && (
                                          <span className="rounded-full bg-slate-100 px-2 py-0.5 text-[11px] font-semibold text-slate-700">{r.momias} momias</span>
                                        )}
                                        {r.lechones != null && (
                                          <span className="rounded-full bg-slate-100 px-2 py-0.5 text-[11px] font-semibold text-slate-700">{r.lechones} en total</span>
                                        )}
                                      </div>
                                    )}
                                    {r.tipo === "Destete" && r.destetados != null && (
                                      <p className="mt-0.5 text-xs font-semibold text-orange-800">{r.destetados} lechones destetados</p>
                                    )}

                                    {(r.mensaje || r.valorGenetica || r.genetica) && (
                                      <p className="mt-0.5 text-xs leading-snug text-slate-600">
                                        {[
                                          r.mensaje,
                                          r.genetica || r.valorGenetica
                                            ? `Genética ${[r.genetica, r.valorGenetica ? formatoPesos(Number(r.valorGenetica)) : ""].filter(Boolean).join(" ")}${r.compraGenetica ? ` · comprada ${formatearFechaCorta(r.compraGenetica)}` : ""}`
                                            : "",
                                        ]
                                          .filter(Boolean)
                                          .join(" · ")}
                                      </p>
                                    )}
                                    {r.confirmacion1 || r.confirmacion2 ? (
                                      <p className="mt-0.5 text-xs font-medium text-sky-700">
                                        {[r.confirmacion1 ? `✓ 1.ª confirmación ${formatearFechaCorta(r.confirmacion1)}` : "", r.confirmacion2 ? `✓ 2.ª confirmación ${formatearFechaCorta(r.confirmacion2)}` : ""].filter(Boolean).join(" · ")}
                                      </p>
                                    ) : null}
                                    {(r.descripcion || r.notas) && (
                                      <p className="mt-0.5 line-clamp-2 text-xs italic text-slate-500">{r.descripcion || r.notas}</p>
                                    )}

                                    {r.tipo === "Parto" && (
                                      <button
                                        data-swipe-ignore="true"
                                        onClick={(e) => {
                                          e.stopPropagation();
                                          setSelectedRegistro(r);
                                        }}
                                        className="mt-1 text-xs font-semibold text-sky-700 hover:underline"
                                      >
                                        Ver detalle del parto ›
                                      </button>
                                    )}
                                  </div>
                                </div>
                              </li>
                            );
                          })}
                        </ol>
                      </div>
                    ))}
                    <p className="text-center text-[11px] text-slate-400">Desliza un registro a la izquierda para eliminarlo</p>
                  </div>
                )}
              </div>
            </section>
            </>
          );
        })()}

        {/* FORMULARIO */}
        {mostrarForm && (
          <div
            className="fixed inset-0 bg-black/40 flex items-start justify-center px-4 z-[60] overflow-x-hidden"
            style={{ paddingTop: "calc(env(safe-area-inset-top) + 4rem)" }}
          >
            <div className="bg-white w-full max-w-md mx-auto rounded-3xl p-6 text-black max-h-[85vh] overflow-y-auto">
              <div className="flex items-center justify-between mb-4">
                <h3 className="text-lg font-bold text-black">Nuevo registro</h3>
                <button
                  onClick={() => setMostrarForm(false)}
                  className="text-gray-500 text-2xl hover:text-black"
                >
                  ✕
                </button>
              </div>

              <div className="space-y-4">
                {/* TIPO */}
                <div>
                  <label className="text-sm text-gray-600 font-medium">Tipo de registro</label>
                  <SelectorApp
                    valor={tipo}
                    onCambiar={setTipo}
                    titulo="Tipo de registro"
                    opciones={["Inseminación", "Compra de genética", "Celo", "Parto", "Destete", "Aborto", "Baja", "Tratamiento", "Evento"].map((t) => ({ valor: t, texto: t }))}
                    className="w-full max-w-[320px]"
                    claseBoton={"mt-1 rounded-2xl bg-gray-100 border border-gray-300 px-4 py-2 text-base text-black"}
                  />
                </div>

                {/* FECHA */}
                <div>
                  <label className="block text-sm text-gray-600 font-medium">Fecha</label>
                  <input
                    type="date"
                    value={fecha}
                    onChange={(e) => setFecha(e.target.value)}
                    max={tipo === "Parto" ? fechaLocalISO(new Date()) : undefined}
                    className="w-full max-w-[220px] mt-1 px-4 py-2 rounded-2xl bg-gray-100 border border-gray-300 text-black outline-none box-border"
                  />
                </div>

                {/* VALOR DE LA GENÉTICA (solo inseminación) */}
                {(tipo === "Inseminación" || tipo === "Compra de genética") && (
                  <div>
                    <label className="block text-sm text-gray-600 font-medium">Genética *</label>
                    <SelectorApp
                      valor={tipoGenetica}
                      onCambiar={setTipoGenetica}
                      titulo="Genética"
                      placeholder="Selecciona la genética"
                      opciones={[...GENETICAS.map((g) => ({ valor: g, texto: g })), { valor: "OTRA", texto: "Otro…" }]}
                      className="w-full max-w-[320px]"
                      claseBoton={"mt-1 rounded-2xl bg-gray-100 border border-gray-300 px-4 py-2 text-base text-black"}
                    />
                    {tipoGenetica === "OTRA" && (
                      <input
                        type="text"
                        value={otraGenetica}
                        onChange={(e) => setOtraGenetica(e.target.value.slice(0, 40))}
                        placeholder="Escribe la genética"
                        className="w-full max-w-[320px] mt-2 px-4 py-2 rounded-2xl bg-gray-100 border border-gray-300 text-black outline-none box-border"
                      />
                    )}
                  </div>
                )}
                {(tipo === "Inseminación" || tipo === "Compra de genética") && (
                  <div>
                    <label className="block text-sm text-gray-600 font-medium">Valor de la genética *</label>
                    <div className="relative mt-1 w-full max-w-[220px]">
                      <span className="pointer-events-none absolute left-4 top-1/2 -translate-y-1/2 text-black/50">$</span>
                      <input
                        type="text"
                        inputMode="numeric"
                        value={valorGenetica ? Number(valorGenetica).toLocaleString("es-CO") : ""}
                        onChange={(e) => setValorGenetica(e.target.value.replace(/\D/g, "").slice(0, 10))}
                        placeholder="Ingresar valor"
                        className="w-full pl-8 pr-4 py-2 rounded-2xl bg-gray-100 border border-gray-300 text-black outline-none box-border"
                      />
                    </div>
                    {pendiente && tipo === "Inseminación" && (
                      <p className="mt-2 text-xs text-sky-700">
                        🧬 Genética comprada el {formatearFechaCorta(pendiente.fecha)}
                        {pendienteEnConta ? ` · ya está en Contabilidad (${pendiente.pago === "credito" ? "crédito" : "contado"})` : ""}
                      </p>
                    )}
                    {(tipo === "Compra de genética" || !pendienteEnConta) && (
                    <label className="mt-2 flex items-center gap-2 text-sm text-gray-700">
                      <input
                        type="checkbox"
                        checked={geneticaEnContabilidad}
                        onChange={(e) => setGeneticaEnContabilidad(e.target.checked)}
                        className="h-5 w-5 accent-sky-700"
                      />
                      Registrar como gasto en Contabilidad
                    </label>
                    )}
                    {(tipo === "Compra de genética" || !pendienteEnConta) && geneticaEnContabilidad && (
                      <div className="mt-2 grid w-full max-w-[320px] grid-cols-2 gap-1 rounded-2xl bg-gray-100 p-1" role="radiogroup" aria-label="Método de pago">
                        {(["contado", "credito"] as const).map((m) => (
                          <button
                            key={m}
                            type="button"
                            role="radio"
                            aria-checked={pagoGenetica === m}
                            onClick={() => setPagoGenetica(m)}
                            className={`rounded-xl py-2 text-sm font-semibold transition ${pagoGenetica === m ? "bg-white text-black shadow-sm" : "text-gray-500"}`}
                          >
                            {m === "contado" ? "Contado" : "Crédito"}
                          </button>
                        ))}
                      </div>
                    )}
                  </div>
                )}

                {/* DESCRIPCIÓN */}
                <div>
                  <label className="text-sm text-gray-600 font-medium">Descripción (opcional)</label>
                  <textarea
                    value={descripcion}
                    onChange={(e) => setDescripcion(e.target.value)}
                    placeholder="Detalles adicionales..."
                    className="w-full max-w-[320px] mt-1 px-4 py-2 rounded-2xl bg-gray-100 border border-gray-300 text-black outline-none resize-none h-20 box-border"
                  />
                </div>

                {/* BOTONES */}
                <div className="flex gap-3 pt-2">
                  <button
                    onClick={() => {
                      if (tipo === "Parto") {
                        setMostrarForm(false);
                        router.replace(`/cerda/${encodeURIComponent(id)}/parto`);
                        return;
                      }
                      agregarRegistro();
                    }}
                    className="flex-1 bg-sky-900 text-white py-3 rounded-2xl font-bold hover:bg-sky-950"
                  >
                    {tipo === "Parto" ? "Registrar parto" : "Guardar"}
                  </button>
                  <button
                    onClick={() => setMostrarForm(false)}
                    className="flex-1 bg-gray-200 text-black py-3 rounded-2xl font-bold hover:bg-gray-300"
                  >
                    Cancelar
                  </button>
                </div>
              </div>
            </div>
          </div>
        )}
      </div>

      {/* INFO: hoja inferior con la ficha de la cerda */}
      {mostrarInfo && (
        <div
          role="dialog"
          aria-modal="true"
          aria-label="Información de la cerda"
          className="fixed inset-0 z-[60] flex items-center justify-center p-4"
          style={{ paddingTop: "calc(env(safe-area-inset-top) + 1rem)", paddingBottom: "calc(env(safe-area-inset-bottom) + 1rem)" }}
        >
          <button
            type="button"
            aria-label="Cerrar información"
            onClick={() => setMostrarInfo(false)}
            className="info-fondo absolute inset-0 bg-slate-950/45 backdrop-blur-[2px]"
          />

          <div
            className="info-hoja relative flex max-h-full w-full max-w-md flex-col overflow-hidden rounded-[28px] bg-white shadow-2xl"
          >
            {/* Encabezado con el arete */}
            <div className="relative overflow-hidden bg-sky-900 px-5 pb-5 pt-5 text-white">
              <button
                type="button"
                onClick={() => setMostrarInfo(false)}
                aria-label="Cerrar"
                className="absolute right-3 top-3 z-20 flex h-11 w-11 touch-manipulation items-center justify-center rounded-full bg-white/15 text-white transition hover:bg-white/25 active:bg-white/30"
              >
                <svg viewBox="0 0 24 24" className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth={2.4} strokeLinecap="round" aria-hidden="true">
                  <path d="M6 6l12 12M18 6 6 18" />
                </svg>
              </button>

              <div className="relative flex items-center gap-4">
                {/* Arete de oreja */}
                <div className="relative flex h-16 min-w-[4.5rem] max-w-[8rem] shrink-0 items-center justify-center rounded-2xl bg-amber-300 px-3 pt-2 shadow-inner">
                  <span aria-hidden="true" className="absolute left-1/2 top-1.5 h-2 w-2 -translate-x-1/2 rounded-full bg-amber-50/90 ring-1 ring-amber-600/40" />
                  <span className="truncate text-2xl font-black tabular-nums text-amber-950 arete-id">{cerda.id}</span>
                </div>
                <div className="min-w-0 pr-8">
                  <p className="text-xs font-medium uppercase tracking-[0.18em] text-sky-200/90">Ficha de la cerda</p>
                  <p className="mt-0.5 truncate text-xl font-bold">{cerda.raza || "Sin raza"}</p>
                  <span className={`mt-1.5 inline-flex items-center gap-1.5 rounded-full px-2.5 py-0.5 text-xs font-bold ${estadoColor}`}>
                    <span aria-hidden="true" className="h-1.5 w-1.5 rounded-full bg-current" />
                    {estado}
                  </span>
                </div>
              </div>
            </div>

            <div
              className="flex-1 overflow-y-auto px-5 pb-5 pt-4"
            >
              {/* Datos generales */}
              <h4 className="mb-1 px-1 text-[11px] font-semibold uppercase tracking-wider text-slate-400">Datos generales</h4>
              <dl className="divide-y divide-slate-100 rounded-2xl ring-1 ring-slate-100">
                {datosGenerales.map((f) => (
                  <div key={f.etiqueta} className="flex items-center gap-3 px-3.5 py-3">
                    <span aria-hidden="true" className="flex h-8 w-8 shrink-0 items-center justify-center rounded-xl bg-slate-50 text-base">
                      <Emoji e={f.icono} />
                    </span>
                    <dt className="flex-1 text-sm text-slate-500">{f.etiqueta}</dt>
                    <dd className="max-w-[55%] truncate text-right text-sm font-semibold text-slate-900">{f.valor}</dd>
                  </div>
                ))}
              </dl>

              {/* Registro reproductivo: cantidades, sin fechas */}
              <h4 className="mb-1 mt-5 px-1 text-[11px] font-semibold uppercase tracking-wider text-slate-400">Registro reproductivo</h4>
              <div className="grid grid-cols-3 gap-2">
                {cifrasRepro.map((c) => (
                  <div
                    key={c.titulo}
                    className={`flex flex-col justify-center rounded-2xl px-2 py-3 text-center ${
                      c.destacado ? "bg-sky-50 ring-1 ring-sky-100" : "bg-slate-50 ring-1 ring-slate-100"
                    }`}
                  >
                    <p className={`text-xl font-bold leading-tight tabular-nums ${c.destacado ? "text-sky-800" : "text-slate-900"}`}>
                      {c.valor}
                    </p>
                    <p className="mt-0.5 text-[11px] font-medium leading-tight text-slate-500">{c.titulo}</p>
                  </div>
                ))}
              </div>

              {/* Características */}
              <h4 className="mb-1 mt-5 px-1 text-[11px] font-semibold uppercase tracking-wider text-slate-400">Características</h4>
              <div className="rounded-2xl bg-amber-50/70 px-4 py-3 ring-1 ring-amber-100">
                <p className="whitespace-pre-line text-sm leading-relaxed text-slate-700">
                  {cerda.caracteristicas || "Sin observaciones registradas."}
                </p>
              </div>

              <div className="mt-5 grid grid-cols-2 gap-2">
                <button
                  type="button"
                  onClick={exportarPdf}
                  disabled={exportando}
                  className="inline-flex items-center justify-center gap-2 rounded-2xl bg-sky-900 py-3 text-sm font-bold text-white transition hover:bg-sky-950 active:scale-[0.98] disabled:opacity-60"
                >
                  <svg viewBox="0 0 24 24" className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth={2.2} strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                    <path d="M12 4v11M7.5 10.5 12 15l4.5-4.5M5 19h14" />
                  </svg>
                  {exportando ? "Generando…" : "Exportar PDF"}
                </button>
                <button
                  type="button"
                  onClick={() => setMostrarInfo(false)}
                  className="rounded-2xl bg-slate-100 py-3 text-sm font-bold text-slate-800 transition hover:bg-slate-200 active:scale-[0.98]"
                >
                  Cerrar
                </button>
              </div>
            </div>
          </div>

          <style>{`
            .info-fondo { animation: info-fade 200ms ease-out both; }
            .info-hoja { animation: info-subir 280ms cubic-bezier(0.2, 0.8, 0.2, 1) both; }
            @keyframes info-fade { from { opacity: 0 } to { opacity: 1 } }
            @keyframes info-subir { from { transform: scale(0.96); opacity: 0 } to { transform: none; opacity: 1 } }
            @media (prefers-reduced-motion: reduce) { .info-fondo, .info-hoja { animation: none; } }
          `}</style>
        </div>
      )}

      {/* FAB: botón flotante */}
      <button
        onClick={() => setMostrarForm(true)}
        style={{ bottom: "calc(env(safe-area-inset-bottom) + 1.5rem)" }}
        className="fixed right-5 z-50 bg-sky-900 w-12 h-12 rounded-full shadow-lg flex items-center justify-center text-white text-2xl hover:bg-sky-950"
        aria-label="Nuevo registro"
      >
        +
      </button>
    </main>
  );
}