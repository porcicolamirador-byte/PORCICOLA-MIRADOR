"use client";

import { useEffect, useRef, useState, type TouchEvent } from "react";
import { useParams, useRouter } from "next/navigation";
import usePageBackground from "@/hooks/usePageBackground";
import { cargarLogoJpeg, entregarPdf, generarPdfFicha, type LogoJpeg } from "@/lib/pdfFicha";

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
    case "Inseminación":
      return "bg-blue-500";
    case "Parto":
      return "bg-green-500";
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
  const [mostrarForm, setMostrarForm] = useState(false);
  const [mostrarMenu, setMostrarMenu] = useState(false);

  const [tipo, setTipo] = useState("Inseminación");
  const [fecha, setFecha] = useState("");
  const [descripcion, setDescripcion] = useState("");
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
  }, [id]);

  function guardar(nuevos: any[]) {
    setRegistros(nuevos);
    localStorage.setItem(`historial-${id}`, JSON.stringify(nuevos));
  }

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
    const nuevos = registros.filter((_, i) => i !== index);
    guardar(nuevos);
  }

  function eliminarHistorialCompleto() {
    if (!confirm("¿Eliminar Historial? Esta acción no se podrá reestablecerse")) return;
    localStorage.removeItem(`historial-${id}`);
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
        if (diasDesdeParto === null || diasDesdeParto < 21 || diasDesdeParto > 28) {
          mostrarAviso("El destete debe estar entre 21 y 28 días después del parto");
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

    let nuevo: any = { tipo, fecha, descripcion };

    if (tipo === "Inseminación") {
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
      const d21 = new Date(d.getFullYear(), d.getMonth(), d.getDate() + 21);
      const d28 = new Date(d.getFullYear(), d.getMonth(), d.getDate() + 28);
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
    setMostrarForm(false);
    setFecha("");
    setDescripcion("");
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
          className="rounded-2xl bg-emerald-700 px-4 py-2 text-sm font-bold text-white"
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
      ? "bg-green-100 text-green-600"
      : "bg-pink-100 text-pink-600";

  const ultimaInseminacion = registros.find((r) => r.tipo === "Inseminación");
  const ultimoParto = registros.find((r) => r.tipo === "Parto");
  const hoy = new Date();
  const fechaHoy = fechaLocalISO(hoy);
  const diasGestacion = ultimaInseminacion
    ? calcularDiasEntre(ultimaInseminacion.fecha, fechaHoy)
    : 0;
  const porcentajeGestacion = Math.round((diasGestacion / DIAS_GESTACION) * 100);
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
    { icono: "🧱", etiqueta: "Jaula", valor: cerda.jaula || "–" },
    { icono: "⏱️", etiqueta: "Tiempo en la granja", valor: cerda.fecha ? calcularEdadLlegada(cerda.fecha) : "–" },
  ];

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
      {selectedRegistro && (
        <div className="fixed inset-0 z-50 bg-black/50 flex items-center justify-center p-4" onClick={() => setSelectedRegistro(null)}>
          <div className="relative w-full max-w-lg rounded-2xl bg-white p-4 shadow-2xl" onClick={(e) => e.stopPropagation()}>
            <button onClick={() => setSelectedRegistro(null)} className="absolute right-4 top-4 text-slate-500 hover:text-slate-900">✕</button>
            <h3 className="text-lg font-bold text-black">Resumen del parto</h3>
            <div className="mt-3 grid grid-cols-2 gap-2 text-xs text-slate-700 sm:grid-cols-3">
              <div className="rounded-lg bg-emerald-50 p-2"><b>Lote</b><p>{selectedRegistro.codigoParto || "-"}</p></div>
              <div className="rounded-lg bg-slate-100 p-2"><b>Fecha</b><p>{selectedRegistro.fecha ? formatearFechaCorta(selectedRegistro.fecha) : "-"}</p></div>
              <div className="rounded-lg bg-slate-100 p-2"><b>Hora</b><p>{selectedRegistro.horaInicio || "-"}</p></div>
              <div className="rounded-lg bg-slate-100 p-2"><b>Tipo</b><p>{selectedRegistro.tipoParto || "-"}</p></div>
              <div className="rounded-lg bg-slate-100 p-2"><b>Asistido por</b><p>{selectedRegistro.asistidoPor || "-"}</p></div>
              <div className="rounded-lg bg-slate-100 p-2"><b>Total nacidos</b><p>{selectedRegistro.lechones ?? "-"}</p></div>
              <div className="rounded-lg bg-slate-100 p-2"><b>Vivos</b><p>{selectedRegistro.vivos ?? "-"}</p></div>
              <div className="rounded-lg bg-slate-100 p-2"><b>Muertos</b><p>{selectedRegistro.muertos ?? "-"}</p></div>
              <div className="rounded-lg bg-slate-100 p-2"><b>Peso promedio</b><p>{selectedRegistro.pesoPromedio != null ? `${selectedRegistro.pesoPromedio} kg` : "-"}</p></div>
              <div className="rounded-lg bg-slate-100 p-2"><b>Raza</b><p>{selectedRegistro.raza || "-"}</p></div>
              <div className="rounded-lg bg-slate-100 p-2"><b>Peso de cerda</b><p>{selectedRegistro.pesoCerda != null ? `${selectedRegistro.pesoCerda} kg` : "-"}</p></div>
              <div className="rounded-lg bg-slate-100 p-2"><b>Estado de salud</b><p>{selectedRegistro.estadoSalud || "-"}</p></div>
              <div className="col-span-2 rounded-lg bg-slate-100 p-2 sm:col-span-3"><b>Observaciones del parto</b><p className="mt-1 break-words">{selectedRegistro.observaciones || "-"}</p></div>
              <div className="col-span-2 rounded-lg bg-slate-100 p-2 sm:col-span-3"><b>Observaciones de los lechones</b><p className="mt-1 break-words">{selectedRegistro.observacionesLechones || "-"}</p></div>
            </div>
          </div>
        </div>
      )}
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
                <span className="px-2 py-0.5 rounded-full font-bold bg-green-100 text-green-600">ACTIVA</span>
                <span className={`px-2 py-0.5 rounded-full font-bold ${estadoColor}`}>{estado === 'Gestación' ? 'GESTACIÓN' : estado.toUpperCase()}</span>
              </div>
            </div>
          </div>

          {/* TARJETAS GRIS APILADAS (ahora encima) */}
          <div className="space-y-1 mb-3">
            <div className="bg-gray-100 rounded-md p-1 flex items-center justify-between">
              <div className="flex items-center gap-2">
                <span className="text-gray-500">🧱</span>
                <div className="text-[11px] text-gray-600">Jaula</div>
              </div>
              <div className="font-bold text-sm">{cerda.jaula || '-'}</div>
            </div>
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
              <div className="font-bold text-sm">{cerda.lechones || '-'}</div>
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
                <span className="font-bold text-[12px] leading-4 truncate">{ultimaInseminacion ? formatearFechaCorta(calcularParto(ultimaInseminacion.fecha)) : '-'}</span>
              </div>
              <div className="bg-gray-100 rounded-lg p-2 flex flex-col gap-1 min-h-[64px]">
                <span className="text-gray-500">Días gest.</span>
                <span className="font-bold text-[12px] leading-4">Día {diasGestacion}</span>
                <span className="text-gray-500 text-[10px]">{diasGestacion} / {DIAS_GESTACION}</span>
              </div>
            </div>
          </div>
        </div>

        {/* PROGRESO DE GESTACIÓN */}
        {ultimaInseminacion && (
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
              <div className="bg-green-50 rounded-xl p-2 text-center">
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
        {ultimaInseminacion && diasGestacion > 110 && (
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

        {/* HISTORIAL */}
        <div className="bg-white rounded-xl p-3 shadow-sm border border-gray-100 mb-3">
          <div className="flex items-center justify-between mb-4 gap-2">
            <h3 className="text-sm font-bold text-black">Historial</h3>
            <div className="flex items-center gap-2">
              <select
                value={filtro}
                onChange={(e) => setFiltro(e.target.value)}
                className="px-2 py-2 rounded-xl border border-gray-200 bg-gray-50 text-black text-xs outline-none"
              >
                <option value="Todos">Todos</option>
                <option value="Inseminación">Inseminación</option>
                <option value="Celo">Celo</option>
                <option value="Parto">Parto</option>
                <option value="Destete">Destete</option>
                <option value="Aborto">Aborto</option>
                <option value="Baja">Baja</option>
                <option value="Tratamiento">Tratamiento</option>
                <option value="Evento">Evento</option>
              </select>
              <button
                onClick={() => setMostrarForm(true)}
                className="bg-emerald-700 text-white px-4 py-2 rounded-2xl font-bold text-sm hover:bg-emerald-800"
              >
                + Nuevo registro
              </button>
            </div>
          </div>

          {/* TIMELINE */}
          <div className="space-y-3" onClick={() => setSwipedIndex(null)}>
            {registros.length === 0 ? (
              <p className="text-gray-500 text-center py-6">Sin registros</p>
            ) : (
              registros
                .filter((r) => filtro === "Todos" || r.tipo === filtro)
                .map((r, i) => {
                    const isActiveMove = activeTouchIndex === i && touchStartX !== null && touchCurrentX !== null;
                    const moveDx = isActiveMove ? Math.min(0, touchCurrentX! - touchStartX!) : 0;
                    const isSwiped = swipedIndex === i;
                    const translateX = isSwiped ? -80 : moveDx; // reveal width ~80px
                    return (
                      <div
                        key={i}
                        className="relative overflow-hidden rounded-lg"
                        onPointerDown={() => iniciarLongPress(i)}
                        onPointerUp={cancelarLongPress}
                        onPointerLeave={cancelarLongPress}
                        onPointerCancel={cancelarLongPress}
                      >
                        <div
                          className={`absolute inset-y-0 right-0 z-0 flex items-center justify-end pr-3 bg-red-500 rounded-r-lg w-20 transition ${isSwiped || longPressIndex === i ? 'opacity-100 pointer-events-auto' : 'opacity-0 pointer-events-none'}`}
                        >
                          {longPressIndex === i ? (
                            <div className="flex gap-2">
                              <button
                                data-swipe-ignore="true"
                                onPointerDown={(e) => e.stopPropagation()}
                                onClick={(e) => {
                                  e.stopPropagation();
                                  eliminarRegistro(i);
                                  setLongPressIndex(null);
                                }}
                                className="bg-white text-red-600 text-[10px] px-2 py-1 rounded-md font-semibold"
                                aria-label={`Eliminar registro ${r.tipo}`}
                              >
                                Eliminar
                              </button>
                              <button
                                data-swipe-ignore="true"
                                onPointerDown={(e) => e.stopPropagation()}
                                onClick={(e) => {
                                  e.stopPropagation();
                                  setLongPressIndex(null);
                                }}
                                className="bg-gray-100 text-black text-[10px] px-2 py-1 rounded-md"
                              >
                                Cancelar
                              </button>
                            </div>
                          ) : (
                            <button
                              data-swipe-ignore="true"
                              onPointerDown={(e) => e.stopPropagation()}
                              onClick={(e) => { e.stopPropagation(); eliminarRegistro(i); }}
                              className="bg-white text-red-600 text-[10px] px-2 py-1 rounded-md font-semibold"
                              aria-label={`Eliminar registro ${r.tipo}`}
                            >
                              Eliminar
                            </button>
                          )}
                        </div>

                        <div
                          className={`relative z-10 flex gap-2 py-2 border-b border-gray-200 last:border-0 p-1 rounded-lg ${r.tipo === 'Evento' ? 'bg-slate-100 hover:bg-slate-200' : 'bg-white hover:bg-gray-50'}`}
                          onTouchStart={(e) => { handleTouchStart(e, i); e.stopPropagation(); }}
                          onTouchMove={(e) => { handleTouchMove(e, i); e.stopPropagation(); }}
                          onTouchEnd={(e) => { handleTouchEnd(e, i); e.stopPropagation(); }}
                          style={{ transform: `translateX(${translateX}px)` }}
                        >
                          <div className={`w-3 h-3 rounded-full ${obtenerColorPorTipo(r.tipo)} flex-shrink-0 mt-1`} />
                          <div className="flex-1 min-w-0 pr-12">
                            <div className="flex justify-between items-center">
                              <p className="font-semibold text-black text-sm">{r.tipo}</p>
                              <div className="flex items-center gap-2">
                                {r.tipo === 'Parto' && (
                                  <button
                                    data-swipe-ignore="true"
                                    onClick={(e) => { e.stopPropagation(); setSelectedRegistro(selectedRegistro === r ? null : r); }}
                                    className="text-slate-600 text-sm"
                                    aria-label={`Ver detalles de parto ${r.fecha}`}
                                  >
                                    📋
                                  </button>
                                )}
                                <p className="text-gray-500 text-[11px]">{formatearFechaCorta(r.fecha)}</p>
                              </div>
                            </div>
                            {r.mensaje && <p className="text-gray-700 text-[11px] mt-1 truncate">{r.mensaje}</p>}
                            {r.descripcion && <p className="text-gray-600 text-[11px] italic mt-1 truncate">{r.descripcion}</p>}
                            {selectedRegistro === r && r.tipo === "Parto" && (
                              <div className="mt-2 grid grid-cols-2 gap-x-3 gap-y-1 rounded-lg bg-emerald-50 p-2 text-[10px] text-slate-700 sm:grid-cols-4">
                                <span><b>Código:</b> {r.codigoParto || "-"}</span>
                                <span><b>Total:</b> {r.lechones ?? "-"}</span>
                                <span><b>Vivos:</b> {r.vivos ?? "-"}</span>
                                <span><b>Muertos:</b> {r.muertos ?? "-"}</span>
                                <span><b>Hora:</b> {r.horaInicio || "-"}</span>
                                <span><b>Tipo:</b> {r.tipoParto || "-"}</span>
                                <span><b>Asistido:</b> {r.asistidoPor || "-"}</span>
                                <span><b>Peso lechón:</b> {r.pesoPromedio != null ? `${r.pesoPromedio} kg` : "-"}</span>
                                <span><b>Raza:</b> {r.raza || "-"}</span>
                                <span><b>Peso cerda:</b> {r.pesoCerda != null ? `${r.pesoCerda} kg` : "-"}</span>
                                <span><b>Estado:</b> {r.estadoSalud || "-"}</span>
                                <span className="col-span-2 sm:col-span-4"><b>Observaciones:</b> {r.observaciones || "-"}</span>
                                <span className="col-span-2 sm:col-span-4"><b>Observaciones lechones:</b> {r.observacionesLechones || "-"}</span>
                              </div>
                            )}
                          </div>
                        </div>
                      </div>
                    );
                  })
            )}
          </div>
        </div>

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
                  <select
                    value={tipo}
                    onChange={(e) => setTipo(e.target.value)}
                    className="w-full max-w-[320px] mt-1 px-4 py-2 rounded-2xl bg-gray-100 border border-gray-300 text-black outline-none box-border"
                  >
                    <option>Inseminación</option>
                    <option>Celo</option>
                    <option>Parto</option>
                    <option>Destete</option>
                    <option>Aborto</option>
                    <option>Baja</option>
                    <option>Tratamiento</option>
                    <option>Evento</option>
                  </select>
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
                    className="flex-1 bg-emerald-700 text-white py-3 rounded-2xl font-bold hover:bg-emerald-800"
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
            <div className="relative overflow-hidden bg-emerald-900 px-5 pb-5 pt-5 text-white">
              <div
                aria-hidden="true"
                className="pointer-events-none absolute inset-0 opacity-60"
                style={{
                  backgroundImage:
                    "repeating-linear-gradient(90deg, rgba(255,255,255,0.05) 0 10px, transparent 10px 26px)",
                }}
              />
              <button
                type="button"
                onClick={() => setMostrarInfo(false)}
                aria-label="Cerrar"
                className="absolute right-4 top-4 flex h-9 w-9 items-center justify-center rounded-full bg-white/15 text-white transition hover:bg-white/25"
              >
                <svg viewBox="0 0 24 24" className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth={2.4} strokeLinecap="round" aria-hidden="true">
                  <path d="M6 6l12 12M18 6 6 18" />
                </svg>
              </button>

              <div className="relative flex items-center gap-4">
                {/* Arete de oreja */}
                <div className="relative flex h-16 min-w-[4.5rem] max-w-[8rem] shrink-0 items-center justify-center rounded-2xl bg-amber-300 px-3 pt-2 shadow-inner">
                  <span aria-hidden="true" className="absolute left-1/2 top-1.5 h-2 w-2 -translate-x-1/2 rounded-full bg-amber-50/90 ring-1 ring-amber-600/40" />
                  <span className="truncate text-2xl font-black tabular-nums text-amber-950">{cerda.id}</span>
                </div>
                <div className="min-w-0 pr-8">
                  <p className="text-xs font-medium uppercase tracking-[0.18em] text-emerald-200/90">Ficha de la cerda</p>
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
                      {f.icono}
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
                      c.destacado ? "bg-emerald-50 ring-1 ring-emerald-100" : "bg-slate-50 ring-1 ring-slate-100"
                    }`}
                  >
                    <p className={`text-xl font-bold leading-tight tabular-nums ${c.destacado ? "text-emerald-800" : "text-slate-900"}`}>
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
                  className="inline-flex items-center justify-center gap-2 rounded-2xl bg-emerald-700 py-3 text-sm font-bold text-white transition hover:bg-emerald-800 active:scale-[0.98] disabled:opacity-60"
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
        className="fixed right-5 z-50 bg-emerald-700 w-12 h-12 rounded-full shadow-lg flex items-center justify-center text-white text-2xl hover:bg-emerald-800"
        aria-label="Nuevo registro"
      >
        +
      </button>
    </main>
  );
}