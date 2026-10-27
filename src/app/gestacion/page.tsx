"use client";

import { borrarConRegistro, guardarConRegistro } from "@/lib/log";
import { useEffect, useMemo, useState, type TouchEvent } from "react";
import { useRouter } from "next/navigation";
import PageShell from "@/components/PageShell";
import Modal from "@/components/Modal";
import { Boton, Campo } from "@/components/ui";
import { avisar, confirmar } from "@/components/Dialogo";
import { puede } from "@/lib/nube";
import { leerConfig } from "@/lib/config";
import { eliminarLotesDePartos, useVersionDatos } from "@/lib/datos";

const ESTADOS = [
  "Todos",
  "Activa",
  "Gestación",
  "Lactancia",
  "Próxima a Celo",
  "Celo",
  "Aborto",
  "Baja",
  "Tratamiento",
];

const RAZAS = ["Camborough", "Landrace", "Large White", "Yorkshire", "Duroc", "Pietrain", "Hampshire"];


export default function Gestacion() {
  const router = useRouter();

  const [mostrarFormulario, setMostrarFormulario] = useState(false);
  // Vista: lista (con deslizar para editar) o cuadrícula de 2 columnas; se recuerda
  const [cuadricula, setCuadricula] = useState(false);
  useEffect(() => {
    try {
      setCuadricula(localStorage.getItem("gestacion-vista") === "cuadricula");
    } catch {}
  }, []);
  const cambiarVista = () =>
    setCuadricula((v) => {
      try {
        localStorage.setItem("gestacion-vista", v ? "lista" : "cuadricula");
      } catch {}
      return !v;
    });
  const [buscar, setBuscar] = useState("");
  const [estadoFiltro, setEstadoFiltro] = useState("Todos");
  const [mostrarMenuFlotante, setMostrarMenuFlotante] = useState(false);

  const [menuIndex, setMenuIndex] = useState<number | null>(null);
  const [activeTouchIndex, setActiveTouchIndex] = useState<number | null>(null);
  const [touchStartX, setTouchStartX] = useState<number | null>(null);
  const [touchCurrentX, setTouchCurrentX] = useState<number | null>(null);
  const [swipedIndex, setSwipedIndex] = useState<number | null>(null);
  const [editIndex, setEditIndex] = useState<number | null>(null);
  const [confirmDeleteIndex, setConfirmDeleteIndex] = useState<number | null>(null);
  const [deletePinInput, setDeletePinInput] = useState("");
  const [deletePinError, setDeletePinError] = useState("");
  // En ajustes se puede desactivar la clave para eliminar cerdas
  const claveEliminarActiva = confirmDeleteIndex !== null ? leerConfig().claveEliminarActiva : true;

  const [id, setId] = useState("");
  const [idError, setIdError] = useState("");
  const [raza, setRaza] = useState("Camborough");
  const [otraRaza, setOtraRaza] = useState("");
  const [peso, setPeso] = useState("");
  const [pesoError, setPesoError] = useState("");
  const [fecha, setFecha] = useState("");
  const [fechaError, setFechaError] = useState("");
  const [razaError, setRazaError] = useState("");
  const [caracteristicas, setCaracteristicas] = useState("");

  const [cerdas, setCerdas] = useState<any[]>([]);

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

  function calcularDiasParaParto(fechaInseminacion: string) {
    const hoy = new Date();
    const fechaHoy = fechaLocalISO(hoy);
    const diasDesde = calcularDiasEntre(fechaInseminacion, fechaHoy);
    return Math.max(0, DIAS_GESTACION - diasDesde);
  }

  const versionDatos = useVersionDatos();
  useEffect(() => {
    const datos = JSON.parse(localStorage.getItem("cerdas") || "[]");
    setCerdas(datos);
  }, [versionDatos]);
  useEffect(() => setEstadoFiltro("Todos"), []);

  // CERRAR MENÚ AL TOCAR FUERA
  useEffect(() => {
    function handleClickOutside() {
      setMenuIndex(null);
      setSwipedIndex(null);
    }

    if (menuIndex !== null || swipedIndex !== null) {
      document.addEventListener("click", handleClickOutside);
    }

    return () => {
      document.removeEventListener("click", handleClickOutside);
    };
  }, [menuIndex, swipedIndex]);

  function guardar(nuevas: any[]) {
    setCerdas(nuevas);

    guardarConRegistro("cerdas", nuevas);
  }

  function resetForm() {
    setId("");
    setIdError("");
    setRaza("Camborough");
    setOtraRaza("");
    setPeso("");
    setPesoError("");
    setFecha("");
    setFechaError("");
    setRazaError("");
    setCaracteristicas("");
    setEditIndex(null);
  }

  function eliminarCerda(index: number) {
    if (!puede("eliminar")) {
      setMenuIndex(null);
      void avisar({ titulo: "Sin permiso", mensaje: "Tu usuario no tiene permiso para eliminar. Pídeselo al administrador." });
      return;
    }
    setConfirmDeleteIndex(index);
    setMenuIndex(null);
  }

  function confirmarEliminarCerda() {
    if (confirmDeleteIndex === null) return;

    const pideClave = leerConfig().claveEliminarActiva;
    if (pideClave && deletePinInput !== leerConfig().claveEliminar) {
      setDeletePinError("Clave incorrecta");
      return;
    }

    const cerdaAEliminar = cerdas[confirmDeleteIndex];

    const nuevas = cerdas.filter((_, i) => i !== confirmDeleteIndex);

    guardar(nuevas);

    borrarConRegistro(`historial-${cerdaAEliminar.id}`);
    eliminarLotesDePartos({ cerdaId: cerdaAEliminar.id });

    setConfirmDeleteIndex(null);
    setDeletePinInput("");
    setDeletePinError("");
  }

  function cancelarEliminarCerda() {
    setConfirmDeleteIndex(null);
    setDeletePinInput("");
    setDeletePinError("");
  }

  function editarCerda(index: number) {
    const c = cerdas[index];

    const razasBase = [
      "Camborough",
      "Landrace",
      "Large White",
      "Yorkshire",
      "Duroc",
      "Pietrain",
      "Hampshire",
    ];

    setId(c.id);

    setRaza(razasBase.includes(c.raza) ? c.raza : "OTRA");

    setOtraRaza(razasBase.includes(c.raza) ? "" : c.raza);

    setFecha(c.fecha);
    setPeso(c.peso || "");

    setCaracteristicas(c.caracteristicas);

    setEditIndex(index);

    setMostrarFormulario(true);
    setSwipedIndex(null);

    setMenuIndex(null);
  }

  function obtenerEstadoPorRegistro(tipo?: string) {
    switch (tipo) {
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

  function obtenerEstadoStyles(estado?: string) {
    switch (estado) {
      case "Gestación":
        return "bg-blue-100 text-blue-800";
      case "Lactancia":
        return "bg-orange-100 text-orange-800";
      case "Próxima a Celo":
        return "bg-yellow-100 text-yellow-900";
      case "Aborto":
        return "bg-rose-100 text-rose-800";
      case "Baja":
        return "bg-red-100 text-red-800";
      case "Celo":
        return "bg-yellow-100 text-yellow-900";
      case "Tratamiento":
        return "bg-amber-100 text-amber-800";
      case "Activa":
        return "bg-pink-100 text-pink-800";
      default:
        return "bg-slate-200 text-slate-800";
    }
  }

  function obtenerBarraColor(estado?: string) {
    switch (estado) {
      case "Gestación":
        return "from-blue-500 to-blue-400";
      case "Lactancia":
        return "from-orange-500 to-orange-400";
      case "Próxima a Celo":
      case "Celo":
        return "from-yellow-500 to-yellow-400";
      case "Aborto":
      case "Tratamiento":
        return "from-rose-500 to-rose-400";
      case "Baja":
        return "from-red-500 to-red-400";
      case "Activa":
        return "from-pink-300 to-pink-200";
      default:
        return "from-sky-700 to-sky-500";
    }
  }

  function obtenerPanelStyles(estado?: string) {
    switch (estado) {
      case "Gestación":
        return {
          bg: "bg-blue-50",
          border: "border-blue-200",
          title: "text-blue-700",
          content: "text-blue-900",
          secondary: "text-blue-600",
        };
      case "Lactancia":
        return {
          bg: "bg-orange-50",
          border: "border-orange-200",
          title: "text-orange-700",
          content: "text-orange-900",
          secondary: "text-orange-600",
        };
      case "Próxima a Celo":
      case "Celo":
        return {
          bg: "bg-yellow-50",
          border: "border-yellow-200",
          title: "text-yellow-700",
          content: "text-yellow-800",
          secondary: "text-yellow-600",
        };
      case "Aborto":
      case "Tratamiento":
        return {
          bg: "bg-rose-50",
          border: "border-rose-200",
          title: "text-rose-700",
          content: "text-rose-800",
          secondary: "text-rose-600",
        };
      case "Baja":
        return {
          bg: "bg-red-50",
          border: "border-red-200",
          title: "text-red-700",
          content: "text-red-800",
          secondary: "text-red-600",
        };
      case "Activa":
        return {
          bg: "bg-pink-50",
          border: "border-pink-200",
          title: "text-pink-700",
          content: "text-pink-900",
          secondary: "text-pink-600",
        };
      default:
        return {
          bg: "bg-sky-50",
          border: "border-sky-200",
          title: "text-sky-700",
          content: "text-sky-900",
          secondary: "text-sky-600",
        };
    }
  }

  function handleTouchStart(e: TouchEvent, idx: number) {
    setActiveTouchIndex(idx);
    setTouchStartX(e.touches[0].clientX);
    setTouchCurrentX(e.touches[0].clientX);
  }

  function handleTouchMove(e: TouchEvent, idx: number) {
    if (activeTouchIndex !== idx || touchStartX === null) return;
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
    const threshold = -60;

    if (dx < threshold) {
      setSwipedIndex(idx);
    } else if (swipedIndex === idx && dx > 40) {
      setSwipedIndex(null);
    }

    setActiveTouchIndex(null);
    setTouchStartX(null);
    setTouchCurrentX(null);
  }

  async function agregarOCrear() {
    const razaFinal = raza === "OTRA" ? otraRaza : raza;

    if (!id.trim()) {
      setIdError("El ID es obligatorio");
      return;
    }

    if (!razaFinal) {
      setRazaError("La raza es obligatoria");
      return;
    }

    if (!peso.trim()) {
      setPesoError("El peso es obligatorio");
      return;
    }

    const pesoFinal = peso.replace(",", ".");
    const pesoNumero = parseFloat(pesoFinal);
    if (Number.isNaN(pesoNumero) || pesoNumero <= 0) {
      setPesoError("Peso inválido");
      return;
    }

    const idMayus = id.toUpperCase();
    const idYaExiste = cerdas.some(
      (cerda, index) =>
        cerda.id === idMayus &&
        (editIndex === null || index !== editIndex)
    );

    if (idYaExiste) {
      setIdError("Este ID ya existe");
      return;
    }

    if (!fecha) {
      setFechaError("La fecha de llegada es obligatoria");
      return;
    }

    const llegadaDate = parsearFechaLocal(fecha);
    const hoy = new Date();
    hoy.setHours(0, 0, 0, 0);
    if (llegadaDate.getTime() > hoy.getTime()) {
      setFechaError("La fecha de llegada no puede ser futura");
      return;
    }

    setIdError("");
    setRazaError("");
    setPesoError("");
    setFechaError("");

    const nueva = {
      id: idMayus,
      raza: razaFinal,
      peso,
      fecha,
      caracteristicas,
      estado: "GESTACIÓN",
    };

    if (editIndex !== null) {
      const ok = await confirmar({
        titulo: "Actualizar cerda",
        mensaje: `Se guardarán los cambios de la cerda ${idMayus}.`,
        aceptar: "Actualizar",
      });

      if (!ok) return;

      const nuevas = [...cerdas];

      nuevas[editIndex] = nueva;

      guardar(nuevas);
    } else {
      guardar([...cerdas, nueva]);
    }

    setMostrarFormulario(false);

    resetForm();
  }

  // Historial de cada cerda leído una sola vez (no en cada render ni al deslizar)
  const historiales = useMemo(() => {
    const mapa = new Map<string, any[]>();
    for (const c of cerdas) {
      try {
        const h = JSON.parse(localStorage.getItem(`historial-${c.id}`) || "[]");
        mapa.set(c.id, Array.isArray(h) ? h : []);
      } catch {
        mapa.set(c.id, []);
      }
    }
    return mapa;
  }, [cerdas]);

  const filtradas = useMemo(() => cerdas
    .filter((c) => {
      const matchesId = (c.id || "").toLowerCase().includes(buscar.toLowerCase());

      const historial = historiales.get(c.id) ?? [];
      const ultimoRegistro = historial[0] || null;
      const estado = ultimoRegistro
        ? obtenerEstadoPorRegistro(ultimoRegistro.tipo)
        : "Activa";

      const matchesEstado = estadoFiltro === "Todos" || estado === estadoFiltro;

      return matchesId && matchesEstado;
    })
    .sort((a, b) => {
      return new Date(b.fecha).getTime() - new Date(a.fecha).getTime();
    }), [cerdas, buscar, estadoFiltro, historiales]);

  const totales = useMemo(() => cerdas.reduce(
    (acc, cerda) => {
      const historial = historiales.get(cerda.id) ?? [];
      const ultimoRegistro = historial[0] || null;
      const estadoLabel = ultimoRegistro
        ? obtenerEstadoPorRegistro(ultimoRegistro.tipo)
        : "Activa";

      const ultimaInseminacion = historial.find(
        (r: any) => r.tipo === "Inseminación"
      );
      const diasParaParto = ultimaInseminacion
        ? calcularDiasParaParto(ultimaInseminacion.fecha)
        : null;

      acc.gestantes += estadoLabel === "Gestación" ? 1 : 0;
      acc.lactando += estadoLabel === "Lactancia" ? 1 : 0;
      acc.proxPartos +=
        estadoLabel === "Gestación" && diasParaParto !== null && diasParaParto <= 14
          ? 1
          : 0;
      acc.alertas += [
        "Aborto",
        "Baja",
        "Celo",
        "Tratamiento",
        "Próxima a Celo",
      ].includes(estadoLabel)
        ? 1
        : 0;

      return acc;
    },
    {
      gestantes: 0,
      lactando: 0,
      proxPartos: 0,
      alertas: 0,
    }
  ), [cerdas, historiales]);

  const pct = (n: number) => (cerdas.length ? `${Math.round((n / cerdas.length) * 100)}%` : "0%");

  const resumen = [
    { label: "Gestantes", valor: totales.gestantes, nota: pct(totales.gestantes), tono: "text-blue-700" },
    { label: "Lactando", valor: totales.lactando, nota: pct(totales.lactando), tono: "text-sky-700" },
    { label: "Próx. partos", valor: totales.proxPartos, nota: "en 14 días", tono: totales.proxPartos > 0 ? "text-amber-600" : "text-slate-900" },
    { label: "Alertas", valor: totales.alertas, nota: "por revisar", tono: totales.alertas > 0 ? "text-rose-600" : "text-slate-900" },
  ];

  return (
    <PageShell bgColor="#ffffff" className="px-3 pt-3 text-slate-900">
      <div className="mx-auto max-w-3xl pb-32">
        {/* ENCABEZADO */}
        <header className="mb-4">
          <button
            type="button"
            onClick={() => router.push("/dashboard")}
            className="-ml-1 mb-1 rounded-full px-2 py-1 text-sm font-medium text-sky-800 transition hover:bg-sky-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-sky-600"
          >
            ‹ Inicio
          </button>
          <div className="flex items-center justify-between gap-3">
            <h1 className="text-3xl font-bold tracking-tight text-sky-900">Gestación</h1>
            {/* Cambiar entre lista y cuadrícula de 2 columnas */}
            <button
              type="button"
              onClick={cambiarVista}
              aria-pressed={cuadricula}
              aria-label={cuadricula ? "Ver como lista" : "Ver en cuadrícula de 2 columnas"}
              className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-xl transition active:scale-95 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-sky-600 ${
                cuadricula ? "bg-sky-800 text-white" : "bg-slate-100 text-slate-700"
              }`}
            >
              <svg viewBox="0 0 24 24" className="h-5 w-5" fill={cuadricula ? "currentColor" : "none"} stroke="currentColor" strokeWidth={1.8} aria-hidden="true">
                <rect x="3.5" y="3.5" width="7" height="7" rx="1.8" />
                <rect x="13.5" y="3.5" width="7" height="7" rx="1.8" />
                <rect x="3.5" y="13.5" width="7" height="7" rx="1.8" />
                <rect x="13.5" y="13.5" width="7" height="7" rx="1.8" />
              </svg>
            </button>
          </div>
          <p className="mt-0.5 text-sm text-slate-500">
            {cerdas.length === 1 ? "1 hembra en el inventario" : `${cerdas.length} hembras en el inventario`}
          </p>

          {/* Una sola franja de cifras, legible a la luz del día */}
          <div className="mt-4 grid grid-cols-4 divide-x divide-slate-200 rounded-2xl border border-slate-200 bg-white py-3 shadow-sm">
            {resumen.map((r) => (
              <div key={r.label} className="px-2 text-center">
                <p className={`text-2xl font-bold leading-none tabular-nums ${r.tono}`}>{r.valor}</p>
                <p className="mt-1.5 text-[11px] font-medium leading-tight text-slate-700">{r.label}</p>
                <p className="text-[11px] leading-tight text-slate-400">{r.nota}</p>
              </div>
            ))}
          </div>
        </header>

        {/* BUSCADOR */}
        <div className="relative mb-3">
          <span aria-hidden="true" className="pointer-events-none absolute left-3.5 top-1/2 -translate-y-1/2 text-base text-slate-400">
            🔍
          </span>
          <input
            type="text"
            placeholder="Buscar por ID"
            value={buscar}
            onChange={(e) => setBuscar(e.target.value)}
            aria-label="Buscar cerda por ID"
            className="h-12 w-full rounded-2xl border border-slate-200 bg-white pl-11 pr-3 text-base text-slate-900 shadow-sm outline-none transition placeholder:text-slate-400 focus:border-sky-600 focus:ring-2 focus:ring-sky-200"
          />
        </div>

        {/* FILTROS POR ESTADO */}
        <div
          role="group"
          aria-label="Filtrar por estado"
          className="-mx-3 mb-3 flex gap-2 overflow-x-auto px-3 pb-1 [scrollbar-width:none]"
        >
          {ESTADOS.map((estado) => {
            const activo = estadoFiltro === estado;
            return (
              <button
                key={estado}
                type="button"
                onClick={() => setEstadoFiltro(estado)}
                aria-pressed={activo}
                className={`shrink-0 rounded-full border px-3.5 py-1.5 text-sm font-medium transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-sky-600 ${
                  activo
                    ? "border-sky-800 bg-sky-800 text-white"
                    : "border-slate-200 bg-white text-slate-700"
                }`}
              >
                {estado}
              </button>
            );
          })}
        </div>

        {(buscar || estadoFiltro !== "Todos") && cerdas.length > 0 && (
          <p className="mb-2 text-xs text-slate-500">
            Mostrando {filtradas.length} de {cerdas.length}
          </p>
        )}

        {/* TARJETAS */}
        {filtradas.length === 0 ? (
          <div className="rounded-2xl border border-dashed border-slate-300 bg-white p-8 text-center">
            <p className="text-3xl" aria-hidden="true">🐖</p>
            <p className="mt-2 text-sm font-semibold text-slate-800">
              {cerdas.length === 0 ? "Aún no hay cerdas" : "Ninguna cerda coincide"}
            </p>
            <p className="mt-1 text-sm text-slate-500">
              {cerdas.length === 0
                ? "Toca + y agrega la primera hembra."
                : "Cambia la búsqueda o el filtro de estado."}
            </p>
          </div>
        ) : cuadricula ? (
          /* Cuadrícula de 2 columnas, como los módulos del Dashboard */
          <div className="grid grid-cols-2 gap-2.5">
            {filtradas.map((cerda) => {
              const historial = historiales.get(cerda.id) ?? [];
              const ultimoRegistro = historial[0] || null;
              const estadoLabel = ultimoRegistro ? obtenerEstadoPorRegistro(ultimoRegistro.tipo) : "Activa";
              const ultimaInseminacion = historial.find((item: any) => item.tipo === "Inseminación");
              const diasParaParto = ultimaInseminacion ? calcularDiasParaParto(ultimaInseminacion.fecha) : null;
              const dato =
                estadoLabel === "Gestación" && diasParaParto !== null
                  ? { t: "Parto", v: formatearFechaCorta(calcularParto(ultimaInseminacion?.fecha || cerda.fecha)), n: diasParaParto === 1 ? "Queda 1 día" : `Quedan ${diasParaParto} días` }
                  : ultimoRegistro
                    ? { t: ultimoRegistro.tipo, v: formatearFechaCorta(ultimoRegistro.fecha), n: "" }
                    : { t: "Llegada", v: formatearFechaCorta(cerda.fecha), n: "" };
              return (
                <button
                  key={cerda.id}
                  type="button"
                  onClick={() => router.push(`/cerda/${encodeURIComponent(cerda.id)}`)}
                  className="relative flex min-w-0 flex-col items-start gap-2.5 overflow-hidden rounded-3xl border border-slate-200 bg-white px-3.5 py-3.5 text-left shadow-sm transition active:scale-[0.97] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-sky-600"
                >
                  <div className={`absolute inset-x-0 top-0 h-1 bg-gradient-to-r ${obtenerBarraColor(estadoLabel)}`} />
                  <div className="relative flex h-11 min-w-[3.25rem] max-w-full items-center justify-center rounded-xl bg-amber-300 px-2.5 pt-1.5 shadow-inner">
                    <span aria-hidden="true" className="absolute left-1/2 top-1 h-1.5 w-1.5 -translate-x-1/2 rounded-full bg-amber-50/90 ring-1 ring-amber-600/40" />
                    <span className="truncate text-base font-black tabular-nums text-amber-950 arete-id">{cerda.id}</span>
                  </div>
                  <div className="w-full min-w-0">
                    <p className="truncate text-sm font-semibold text-slate-950">{cerda.raza || "Sin raza"}</p>
                    <span className={`mt-1 inline-flex max-w-full items-center gap-1.5 rounded-full px-2 py-0.5 text-[11px] font-semibold ${obtenerEstadoStyles(estadoLabel)}`}>
                      <span aria-hidden="true" className="h-1.5 w-1.5 shrink-0 rounded-full bg-current" />
                      <span className="truncate">{estadoLabel}</span>
                    </span>
                  </div>
                  <div className="w-full min-w-0 border-t border-slate-100 pt-2">
                    <p className="truncate text-[11px] text-slate-500">{dato.t}</p>
                    <p className="truncate text-sm font-semibold text-slate-900">{dato.v}</p>
                    {dato.n && <p className="truncate text-[11px] font-medium text-blue-700">{dato.n}</p>}
                  </div>
                </button>
              );
            })}
          </div>
        ) : (
          <div className="grid grid-cols-1 gap-2.5 sm:grid-cols-2">
            {filtradas.map((cerda, index) => {
              const historial = historiales.get(cerda.id) ?? [];

              const ultimoRegistro = historial[0] || null;
              const estadoLabel = ultimoRegistro
                ? obtenerEstadoPorRegistro(ultimoRegistro.tipo)
                : "Activa";
              const panelStyles = obtenerPanelStyles(estadoLabel);

              const ultimaInseminacion = historial.find(
                (item: any) => item.tipo === "Inseminación"
              );
              const diasDesdeInseminacion = ultimaInseminacion
                ? calcularDiasEntre(ultimaInseminacion.fecha, fechaLocalISO(new Date()))
                : null;
              const diasParaParto = ultimaInseminacion
                ? calcularDiasParaParto(ultimaInseminacion.fecha)
                : null;
              const progresoGestacion =
                diasDesdeInseminacion !== null
                  ? Math.min(100, Math.max(0, Math.round((diasDesdeInseminacion / DIAS_GESTACION) * 100)))
                  : null;
              const isActiveMove =
                activeTouchIndex === index && touchStartX !== null && touchCurrentX !== null;
              const moveDx = isActiveMove ? Math.min(0, touchCurrentX! - touchStartX!) : 0;
              const isSwiped = swipedIndex === index;
              const translateX = isSwiped ? -96 : moveDx;

              // La lista está filtrada y ordenada: editar/eliminar necesitan la posición real en `cerdas`
              const indiceReal = cerdas.indexOf(cerda);

              return (
                <article
                  key={index}
                  className="relative overflow-hidden rounded-[20px] bg-white shadow-[0_1px_3px_rgba(15,23,42,0.06)] ring-1 ring-slate-200/70"
                >
                  {/* Acciones que aparecen al deslizar */}
                  <div
                    className={`absolute inset-y-0 right-0 z-0 flex w-24 flex-col justify-center gap-2 border-l border-sky-100 bg-sky-50 px-2 transition-opacity duration-200 ${
                      isSwiped ? "pointer-events-auto opacity-100" : "pointer-events-none opacity-0"
                    }`}
                  >
                    <button
                      data-swipe-ignore="true"
                      onClick={(e) => {
                        e.stopPropagation();
                        setSwipedIndex(null);
                        editarCerda(indiceReal);
                      }}
                      className="w-full rounded-lg bg-white py-2 text-xs font-semibold text-sky-800 shadow-sm"
                    >
                      Editar
                    </button>
                    <button
                      data-swipe-ignore="true"
                      onClick={(e) => {
                        e.stopPropagation();
                        setSwipedIndex(null);
                        eliminarCerda(indiceReal);
                      }}
                      className="w-full rounded-lg bg-red-600 py-2 text-xs font-semibold text-white shadow-sm"
                    >
                      Eliminar
                    </button>
                  </div>

                  <div
                    className="relative z-10 cursor-pointer bg-white px-2.5 py-2"
                    onClick={() => {
                      if (isSwiped) {
                        setSwipedIndex(null);
                        return;
                      }
                      router.push(`/cerda/${encodeURIComponent(cerda.id)}`);
                    }}
                    onTouchStart={(e) => { handleTouchStart(e, index); e.stopPropagation(); }}
                    onTouchMove={(e) => { handleTouchMove(e, index); e.stopPropagation(); }}
                    onTouchEnd={(e) => { handleTouchEnd(e, index); e.stopPropagation(); }}
                    style={{
                      transform: `translateX(${translateX}px)`,
                      transition: isActiveMove ? "none" : "transform 200ms ease-out",
                    }}
                  >
                    <div className="flex flex-col gap-1.5">
                      {/* Cabecera: arete + raza + estado + progreso */}
                      <div className="flex items-center gap-3">
                        {/* El ID se ve como un arete de oreja */}
                        <div className="relative flex h-9 min-w-[2.75rem] shrink-0 items-center justify-center rounded-[10px] bg-gradient-to-b from-amber-200 to-amber-300 px-1.5 pt-1 shadow-sm ring-1 ring-amber-400/60">
                          <span
                            aria-hidden="true"
                            className="absolute left-1/2 top-[3px] h-1 w-1 -translate-x-1/2 rounded-full bg-white/90 ring-1 ring-amber-600/40"
                          />
                          <span className="whitespace-nowrap text-[13px] font-black tabular-nums tracking-tight text-amber-950 arete-id">{cerda.id}</span>
                        </div>

                        <div className="min-w-0 flex-1">
                          <p className="truncate text-sm font-semibold leading-tight text-slate-900">{cerda.raza || "Sin raza"}</p>
                          <span className={`mt-0.5 inline-flex items-center gap-1.5 rounded-full px-2 py-0.5 text-[11px] font-semibold ${obtenerEstadoStyles(estadoLabel)}`}>
                            <span aria-hidden="true" className="h-1.5 w-1.5 rounded-full bg-current" />
                            {estadoLabel}
                          </span>
                        </div>

                        {progresoGestacion !== null && estadoLabel === "Gestación" && diasParaParto !== null && (
                          <div className={`relative h-9 w-9 shrink-0 ${panelStyles.secondary}`} role="img" aria-label={`Gestación al ${progresoGestacion}%`}>
                            <svg viewBox="0 0 44 44" className="h-9 w-9 -rotate-90" aria-hidden="true">
                              <circle cx="22" cy="22" r="18" fill="none" strokeWidth="4" stroke="currentColor" strokeOpacity={0.15} />
                              <circle
                                cx="22"
                                cy="22"
                                r="18"
                                fill="none"
                                strokeWidth="4"
                                strokeLinecap="round"
                                stroke="currentColor"
                                strokeDasharray={`${(progresoGestacion / 100) * 113.1} 113.1`}
                              />
                            </svg>
                            <span className="absolute inset-0 flex flex-col items-center justify-center leading-none">
                              <span className="text-[11px] font-bold tabular-nums">{Math.max(0, diasParaParto)}</span>
                              <span className="text-[7px] font-medium text-slate-500">días</span>
                            </span>
                          </div>
                        )}

                        <button
                          type="button"
                          aria-label={`Opciones de ${cerda.id}`}
                          onClick={(e) => {
                            e.stopPropagation();
                            setSwipedIndex(isSwiped ? null : index);
                          }}
                          className="-mr-1 flex h-8 w-7 shrink-0 items-center justify-center rounded-full text-xl leading-none text-slate-400 transition hover:bg-slate-100 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-sky-600"
                        >
                          ⋮
                        </button>
                      </div>

                      {cerda.caracteristicas ? (
                        <p className="line-clamp-1 px-0.5 text-xs text-slate-500">{cerda.caracteristicas}</p>
                      ) : null}

                      {/* Estado / seguimiento */}
                      <div className={`flex items-center gap-2 rounded-lg px-2.5 py-1.5 ${panelStyles.bg}`}>
                        {estadoLabel === "Gestación" && diasParaParto !== null ? (
                          <div className="min-w-0 flex-1">
                            <p className={`truncate text-[13px] font-bold ${panelStyles.content}`}>
                              <span className={`mr-1.5 text-[11px] font-medium ${panelStyles.title}`}>Parto</span>
                              {formatearFechaCorta(calcularParto(ultimaInseminacion?.fecha || cerda.fecha))}
                              <span className={`ml-1.5 text-xs font-medium ${panelStyles.secondary}`}>
                                · Día {diasDesdeInseminacion} de {DIAS_GESTACION}
                              </span>
                            </p>
                          </div>
                        ) : (
                          <div className="min-w-0 flex-1">
                            <p className={`text-[13px] font-semibold leading-snug ${panelStyles.content}`}>
                              <span className={`mr-1.5 text-[11px] font-medium ${panelStyles.title}`}>
                                {ultimoRegistro?.tipo === "Evento" ? "Evento" : estadoLabel === "Lactancia" ? "Lactancia" : "Seguimiento"}
                              </span>
                              {ultimoRegistro?.tipo === "Evento"
                                ? "Nuevo evento registrado"
                                : estadoLabel === "Lactancia"
                                  ? ultimoRegistro?.mensaje || "En lactancia"
                                  : ultimoRegistro?.mensaje || "Pendiente"}
                            </p>
                          </div>
                        )}
                        <svg viewBox="0 0 24 24" aria-hidden="true" className={`h-4 w-4 shrink-0 opacity-60 ${panelStyles.title}`} fill="none" stroke="currentColor" strokeWidth={2.4} strokeLinecap="round" strokeLinejoin="round">
                          <path d="m9 6 6 6-6 6" />
                        </svg>
                      </div>
                    </div>
                  </div>
                </article>
              );
            })}
          </div>
        )}

        {/* BOTÓN + */}
        <div className="relative">
          <button
            onClick={() => setMostrarMenuFlotante(!mostrarMenuFlotante)}
            style={{ bottom: "calc(env(safe-area-inset-bottom) + 1.5rem)" }}
            className="fixed right-5 z-30 h-14 w-14 rounded-full bg-gradient-to-br from-sky-700 to-sky-900 text-3xl text-white shadow-lg transition-all duration-200 hover:scale-105 hover:shadow-xl focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-sky-600 focus-visible:ring-offset-2 active:scale-95"
            aria-label="Abrir menú de opciones"
            aria-expanded={mostrarMenuFlotante}
          >
            <span className={`inline-block transition-transform duration-300 ${mostrarMenuFlotante ? "rotate-45" : ""}`}>
              +
            </span>
          </button>

          {mostrarMenuFlotante && (
            <>
              <div
                className="fixed inset-0 z-40"
                onClick={() => setMostrarMenuFlotante(false)}
              />

              <div style={{ bottom: "calc(env(safe-area-inset-bottom) + 5.5rem)" }} className="fixed right-4 z-50 w-56 overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-2xl">
                <button
                  onClick={() => {
                    setMostrarMenuFlotante(false);
                    router.push("/tareas");
                  }}
                  className="group block w-full px-3 py-3 text-left transition-colors hover:bg-sky-50"
                >
                  <div className="flex items-center gap-3">
                    <div className="flex h-9 w-9 items-center justify-center rounded-full bg-yellow-100 transition-colors group-hover:bg-yellow-200">
                      <span className="text-sm font-bold text-yellow-700">!</span>
                    </div>
                    <div>
                      <p className="text-sm font-semibold text-slate-900">Alertas</p>
                      <p className="text-xs text-slate-500">Ver tareas</p>
                    </div>
                  </div>
                </button>

                <div className="border-t border-slate-100" />

                <button
                  onClick={() => {
                    resetForm();
                    setMostrarFormulario(true);
                    setMostrarMenuFlotante(false);
                  }}
                  className="group block w-full px-3 py-3 text-left transition-colors hover:bg-sky-50"
                >
                  <div className="flex items-center gap-3">
                    <div className="flex h-9 w-9 items-center justify-center rounded-full bg-sky-100 transition-colors group-hover:bg-sky-200">
                      <span className="text-base font-bold text-sky-800">+</span>
                    </div>
                    <div>
                      <p className="text-sm font-semibold text-slate-900">Agregar cerda</p>
                      <p className="text-xs text-slate-500">Nueva hembra</p>
                    </div>
                  </div>
                </button>
              </div>
            </>
          )}
        </div>

        {/* CONFIRMAR ELIMINACIÓN: alerta con estilo de app nativa y clave */}
        {confirmDeleteIndex !== null && (
          <div
            role="alertdialog"
            aria-modal="true"
            aria-labelledby="eliminar-titulo"
            className="fixed inset-0 z-[90] flex items-center justify-center p-6"
          >
            <div aria-hidden="true" className="dialogo-fondo absolute inset-0 bg-slate-950/40" onClick={cancelarEliminarCerda} />
            <div className="dialogo-caja relative w-full max-w-[290px] overflow-hidden rounded-[18px] bg-white/95 text-center shadow-2xl backdrop-blur-xl">
              <div className="px-5 pb-4 pt-5">
                <div className="mx-auto mb-2 flex h-11 w-11 items-center justify-center rounded-full bg-red-50 text-red-600" aria-hidden="true">
                  <svg viewBox="0 0 24 24" className="h-5 w-5" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
                    <path d="M4 7h16M10 11v6M14 11v6M5 7l1 12a2 2 0 0 0 2 2h8a2 2 0 0 0 2-2l1-12M9 7V4h6v3" />
                  </svg>
                </div>
                <h2 id="eliminar-titulo" className="text-[17px] font-semibold leading-snug text-slate-900">
                  Eliminar cerda {cerdas[confirmDeleteIndex]?.id || ""}
                </h2>
                <p className="mt-1.5 text-[13px] leading-snug text-slate-600">
                  Se borrarán la cerda, todo su historial y los lotes de Engorde creados con sus partos.{claveEliminarActiva ? " Escribe la clave para confirmar." : ""}
                </p>

                {claveEliminarActiva && (<>
                <input
                  type="password"
                  inputMode="numeric"
                  pattern="[0-9]*"
                  autoFocus
                  value={deletePinInput}
                  onChange={(e) => {
                    setDeletePinInput(e.target.value.replace(/\D/g, "").slice(0, 4));
                    if (deletePinError) setDeletePinError("");
                  }}
                  onKeyDown={(e) => {
                    if (e.key === "Enter") confirmarEliminarCerda();
                    if (e.key === "Escape") cancelarEliminarCerda();
                  }}
                  placeholder="••••"
                  aria-label="Clave de confirmación"
                  className={`mt-3 h-11 w-full rounded-xl border bg-slate-50 text-center text-xl tracking-[0.6em] text-slate-900 outline-none placeholder:text-slate-300 focus:bg-white focus:ring-2 ${
                    deletePinError ? "border-red-400 focus:ring-red-200" : "border-slate-200 focus:ring-sky-200"
                  }`}
                />
                {deletePinError ? <p className="mt-2 text-[13px] font-medium text-red-600">{deletePinError}</p> : null}
                </>)}
              </div>

              <div className="grid grid-cols-2 divide-x divide-slate-200 border-t border-slate-200">
                <button
                  type="button"
                  onClick={cancelarEliminarCerda}
                  className="py-3 text-[17px] text-sky-700 transition active:bg-slate-100"
                >
                  Cancelar
                </button>
                <button
                  type="button"
                  onClick={confirmarEliminarCerda}
                  className="py-3 text-[17px] font-semibold text-red-600 transition active:bg-slate-100"
                >
                  Eliminar
                </button>
              </div>
            </div>
            <style>{`
              .dialogo-fondo { animation: dialogo-fade 160ms ease-out both; }
              .dialogo-caja { animation: dialogo-entrar 200ms cubic-bezier(0.2, 0.8, 0.2, 1) both; }
              @keyframes dialogo-fade { from { opacity: 0 } to { opacity: 1 } }
              @keyframes dialogo-entrar { from { transform: scale(1.12); opacity: 0 } to { transform: none; opacity: 1 } }
            `}</style>
          </div>
        )}

        {/* FORMULARIO: módulo centrado con el mismo estilo de los demás */}
        <Modal
          abierta={mostrarFormulario}
          etiqueta="Gestación"
          titulo={editIndex !== null ? "Editar cerda" : "Nueva cerda"}
          subtitulo={editIndex !== null ? "Actualiza los datos de la cerda" : "Registro de una cerda nueva"}
          icono="🐷"
          onCerrar={() => setMostrarFormulario(false)}
        >
          <form
            onSubmit={(e) => {
              e.preventDefault();
              void agregarOCrear();
            }}
            className="flex flex-col gap-3.5"
          >
            <div className="grid grid-cols-2 gap-3">
              <Campo etiqueta="Identificación *">
                <input
                  type="text"
                  placeholder="Dato"
                  autoComplete="off"
                  autoCapitalize="characters"
                  value={id}
                  onChange={(e) => {
                    setId(e.target.value.toUpperCase());
                    if (idError) setIdError("");
                  }}
                  className="block w-full min-w-0 max-w-full appearance-none rounded-xl bg-slate-50 px-3.5 py-2.5 text-base text-slate-900 ring-1 ring-slate-200 placeholder:text-slate-400 focus:bg-white focus:outline-none focus:ring-2 focus:ring-sky-600 uppercase"
                />
              </Campo>
              <Campo etiqueta="Raza">
                <select value={raza} onChange={(e) => setRaza(e.target.value)} className="block w-full min-w-0 max-w-full appearance-none rounded-xl bg-slate-50 px-3.5 py-2.5 text-base text-slate-900 ring-1 ring-slate-200 placeholder:text-slate-400 focus:bg-white focus:outline-none focus:ring-2 focus:ring-sky-600">
                  {RAZAS.map((r) => (
                    <option key={r} value={r}>{r}</option>
                  ))}
                  <option value="OTRA">Otra</option>
                </select>
              </Campo>
            </div>
            {raza === "OTRA" && (
              <Campo etiqueta="¿Cuál raza?">
                <input type="text" placeholder="Dato" value={otraRaza} onChange={(e) => setOtraRaza(e.target.value)} className="block w-full min-w-0 max-w-full appearance-none rounded-xl bg-slate-50 px-3.5 py-2.5 text-base text-slate-900 ring-1 ring-slate-200 placeholder:text-slate-400 focus:bg-white focus:outline-none focus:ring-2 focus:ring-sky-600" />
              </Campo>
            )}
            {(idError || razaError) && <p className="-mt-2 text-[13px] text-red-600">{idError || razaError}</p>}
            <div className="grid grid-cols-2 gap-3">
              <Campo etiqueta="Fecha de llegada">
                <input
                  type="date"
                  value={fecha}
                  max={fechaLocalISO(new Date())}
                  onChange={(e) => {
                    setFecha(e.target.value);
                    if (fechaError) setFechaError("");
                  }}
                  className="block w-full min-w-0 max-w-full appearance-none rounded-xl bg-slate-50 px-3.5 py-2.5 text-base text-slate-900 ring-1 ring-slate-200 placeholder:text-slate-400 focus:bg-white focus:outline-none focus:ring-2 focus:ring-sky-600"
                />
              </Campo>
              <Campo etiqueta="Peso (kg)">
                <input
                  type="tel"
                  inputMode="decimal"
                  pattern="[0-9]*[.,]?[0-9]*"
                  value={peso}
                  onChange={(e) => {
                    setPeso(e.target.value.replace(/[^0-9.,]/g, ""));
                    if (pesoError) setPesoError("");
                  }}
                  placeholder="Dato"
                  className="block w-full min-w-0 max-w-full appearance-none rounded-xl bg-slate-50 px-3.5 py-2.5 text-base text-slate-900 ring-1 ring-slate-200 placeholder:text-slate-400 focus:bg-white focus:outline-none focus:ring-2 focus:ring-sky-600"
                />
              </Campo>
            </div>
            {(fechaError || pesoError) && <p className="-mt-2 text-[13px] text-red-600">{fechaError || pesoError}</p>}
            <Campo etiqueta="Notas">
              <textarea
                value={caracteristicas}
                onChange={(e) => setCaracteristicas(e.target.value)}
                placeholder="Dato"
                rows={3}
                className="block w-full min-w-0 max-w-full appearance-none rounded-xl bg-slate-50 px-3.5 py-2.5 text-base text-slate-900 ring-1 ring-slate-200 placeholder:text-slate-400 focus:bg-white focus:outline-none focus:ring-2 focus:ring-sky-600 resize-none"
              />
            </Campo>
            <Boton type="submit" disabled={!id.trim()} className="mt-1 w-full py-3">
              {editIndex !== null ? "Guardar cambios" : "Crear cerda"}
            </Boton>
          </form>
        </Modal>
      </div>
    </PageShell>
  );
}
