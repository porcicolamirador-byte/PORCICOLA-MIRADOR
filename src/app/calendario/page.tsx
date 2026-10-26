"use client";

import { useMemo, useRef, useState, type TouchEvent } from "react";
import { useRouter } from "next/navigation";
import ModuloPage from "@/components/ModuloPage";
import { Chevron } from "@/components/ui";
import {
  estadoDeCerda,
  formatoFecha,
  hoy,
  leerAjustes,
  leerCerdas,
  leerHistorial,
  nombreCerda,
  sumarDias,
  useVersionDatos,
} from "@/lib/datos";

/** Días después del parto para el destete en el calendario */
const DIAS_DESTETE = 21;

type Tipo = "parto" | "estimado" | "destete";

interface EventoDia {
  tipo: Tipo;
  cerdaId: string;
  nombre: string;
  detalle: string;
  vivos?: number;
}

const ESTILO: Record<Tipo, { punto: string; celda: string; etiqueta: string; texto: string }> = {
  parto: { punto: "bg-fuchsia-500", celda: "bg-fuchsia-500 text-white", etiqueta: "Parto registrado", texto: "text-fuchsia-700" },
  estimado: { punto: "bg-blue-500", celda: "bg-blue-500 text-white", etiqueta: "Parto estimado", texto: "text-blue-700" },
  destete: { punto: "bg-amber-400", celda: "bg-amber-400 text-amber-950", etiqueta: `Destete (día ${DIAS_DESTETE})`, texto: "text-amber-700" },
};
const ORDEN: Tipo[] = ["parto", "estimado", "destete"];
/** Mismos colores de las marcas del calendario (verde, azul y amarillo) */
const COLOR_BARRA: Record<Tipo, string> = { parto: "#d946ef", estimado: "#3b82f6", destete: "#f59e0b" };

const MESES = ["Enero", "Febrero", "Marzo", "Abril", "Mayo", "Junio", "Julio", "Agosto", "Septiembre", "Octubre", "Noviembre", "Diciembre"];
const DIAS_SEMANA = ["L", "M", "M", "J", "V", "S", "D"];

const clave = (a: number, m: number, d: number) => `${a}-${String(m + 1).padStart(2, "0")}-${String(d).padStart(2, "0")}`;

/** Todas las fechas marcadas: partos registrados, partos estimados y destetes */
function calcularEventos(): Map<string, EventoDia[]> {
  const { diasGestacion } = leerAjustes();
  const mapa = new Map<string, EventoDia[]>();
  const agregar = (fecha: string, e: EventoDia) => {
    if (!fecha) return;
    const lista = mapa.get(fecha) ?? [];
    lista.push(e);
    mapa.set(fecha, lista);
  };

  for (const cerda of leerCerdas()) {
    const historial = [...leerHistorial(cerda.id)].sort((a, b) => (b.fecha || "").localeCompare(a.fecha || ""));
    const nombre = nombreCerda(cerda);

    // Partos registrados (verde) y su destete al día 21 (amarillo)
    for (const r of historial) {
      if (r.tipo !== "Parto" || !r.fecha) continue;
      agregar(r.fecha, {
        tipo: "parto",
        cerdaId: cerda.id,
        nombre,
        detalle: r.vivos != null ? `${r.vivos} nacidos vivos` : "Parto registrado",
        vivos: Number(r.vivos) || 0,
      });
      agregar(sumarDias(r.fecha, DIAS_DESTETE), {
        tipo: "destete",
        cerdaId: cerda.id,
        nombre,
        detalle: `Día ${DIAS_DESTETE} del parto del ${formatoFecha(r.fecha)}`,
      });
    }

    // Parto estimado (azul) y su destete, para las cerdas en gestación
    if (estadoDeCerda(historial) === "Gestación") {
      const ia = historial.find((r) => r.tipo === "Inseminación")?.fecha;
      if (ia) {
        const parto = sumarDias(ia, diasGestacion);
        agregar(parto, { tipo: "estimado", cerdaId: cerda.id, nombre, detalle: `Inseminada el ${formatoFecha(ia)}` });
        agregar(sumarDias(parto, DIAS_DESTETE), {
          tipo: "destete",
          cerdaId: cerda.id,
          nombre,
          detalle: `Día ${DIAS_DESTETE} del parto estimado (${formatoFecha(parto)})`,
        });
      }
    }
  }
  return mapa;
}

export default function CalendarioPage() {
  const router = useRouter();
  const version = useVersionDatos();
  const fechaHoy = hoy();
  const [anio, setAnio] = useState(() => Number(fechaHoy.slice(0, 4)));
  const [mes, setMes] = useState(() => Number(fechaHoy.slice(5, 7)) - 1);
  const [seleccion, setSeleccion] = useState(fechaHoy);

  const eventos = useMemo(() => (version < 0 ? new Map<string, EventoDia[]>() : calcularEventos()), [version]);

  const cambiarMes = (delta: number) => {
    const d = new Date(anio, mes + delta, 1);
    setAnio(d.getFullYear());
    setMes(d.getMonth());
    // El mes nuevo entra desde el lado hacia donde se deslizó
    setEntrada(delta > 0 ? "derecha" : "izquierda");
    setVuelta((v) => v + 1);
  };

  // Deslizar a los lados para cambiar de mes
  const [dx, setDx] = useState(0);
  const [entrada, setEntrada] = useState<"derecha" | "izquierda" | null>(null);
  const [vuelta, setVuelta] = useState(0);
  const toque = useRef<{ x: number; y: number; horizontal: boolean | null } | null>(null);
  const alTocar = (e: TouchEvent) => {
    const t = e.touches[0];
    toque.current = { x: t.clientX, y: t.clientY, horizontal: null };
  };
  const alMover = (e: TouchEvent) => {
    const t = toque.current;
    if (!t) return;
    const mx = e.touches[0].clientX - t.x;
    const my = e.touches[0].clientY - t.y;
    // Se decide la dirección con los primeros píxeles: si es vertical, se deja desplazar la página
    if (t.horizontal === null && (Math.abs(mx) > 8 || Math.abs(my) > 8)) t.horizontal = Math.abs(mx) > Math.abs(my);
    if (t.horizontal) setDx(mx);
  };
  const alSoltar = () => {
    const t = toque.current;
    toque.current = null;
    if (t?.horizontal && Math.abs(dx) > 50) cambiarMes(dx < 0 ? 1 : -1);
    setDx(0);
  };
  const irAHoy = () => {
    setAnio(Number(fechaHoy.slice(0, 4)));
    setMes(Number(fechaHoy.slice(5, 7)) - 1);
    setSeleccion(fechaHoy);
  };

  // Cuadrícula del mes: semanas de lunes a domingo
  const primero = new Date(anio, mes, 1);
  const vacios = (primero.getDay() + 6) % 7;
  const diasMes = new Date(anio, mes + 1, 0).getDate();
  const celdas: (number | null)[] = [...Array(vacios).fill(null), ...Array.from({ length: diasMes }, (_, i) => i + 1)];
  while (celdas.length % 7) celdas.push(null);

  // Resumen del mes
  const prefijo = clave(anio, mes, 1).slice(0, 7);
  const delMesConFecha = [...eventos.entries()]
    .filter(([f]) => f.startsWith(prefijo))
    .sort(([a], [b]) => a.localeCompare(b))
    .flatMap(([f, l]) => [...l].sort((a, b) => ORDEN.indexOf(a.tipo) - ORDEN.indexOf(b.tipo)).map((e) => ({ ...e, fecha: f })));
  const delMes = delMesConFecha;
  const cuenta = (t: Tipo) => delMes.filter((e) => e.tipo === t).length;

  const delDia = (eventos.get(seleccion) ?? []).sort((a, b) => ORDEN.indexOf(a.tipo) - ORDEN.indexOf(b.tipo));

  return (
    <ModuloPage titulo="Calendario" subtitulo="Partos y destetes mes a mes" icono="📅" tono="emerald">
      {/* Leyenda con totales del mes */}
      <div className="grid grid-cols-3 gap-2">
        {ORDEN.map((t) => (
          <div key={t} className="rounded-2xl bg-white px-3 py-2.5 ring-1 ring-slate-200/80">
            <div className="flex items-center gap-1.5">
              <span className={`h-2.5 w-2.5 shrink-0 rounded-full ${ESTILO[t].punto}`} aria-hidden="true" />
              <span className="truncate text-[11px] font-medium text-slate-500">{ESTILO[t].etiqueta}</span>
            </div>
            <p className="mt-0.5 text-xl font-bold tabular-nums text-slate-900">{cuenta(t)}</p>
          </div>
        ))}
      </div>

      <section className="rounded-3xl bg-white p-3 ring-1 ring-slate-200/80">
        {/* Navegación de meses */}
        <div className="mb-2 flex items-center gap-2 px-1">
          <button
            type="button"
            onClick={() => cambiarMes(-1)}
            aria-label="Mes anterior"
            className="flex h-9 w-9 items-center justify-center rounded-full bg-slate-100 text-slate-700 active:scale-95"
          >
            <span className="rotate-180">
              <Chevron />
            </span>
          </button>
          <h2 className="flex-1 text-center text-lg font-bold text-slate-900">
            {MESES[mes]} {anio}
          </h2>
          <button
            type="button"
            onClick={() => cambiarMes(1)}
            aria-label="Mes siguiente"
            className="flex h-9 w-9 items-center justify-center rounded-full bg-slate-100 text-slate-700 active:scale-95"
          >
            <Chevron />
          </button>
        </div>

        <div className="grid grid-cols-7 gap-1 text-center">
          {DIAS_SEMANA.map((d, i) => (
            <span key={i} className="py-1 text-[11px] font-semibold text-slate-400">
              {d}
            </span>
          ))}
        </div>
        <div
          className="overflow-hidden"
          onTouchStart={alTocar}
          onTouchMove={alMover}
          onTouchEnd={alSoltar}
          onTouchCancel={alSoltar}
          style={{ touchAction: "pan-y" }}
        >
        <div
          key={vuelta}
          className={`grid grid-cols-7 gap-1 text-center ${dx === 0 && entrada ? `entrada-${entrada}` : ""}`}
          style={{
            transform: dx ? `translateX(${dx}px)` : undefined,
            opacity: dx ? Math.max(0.4, 1 - Math.abs(dx) / 400) : undefined,
            transition: dx ? "none" : "transform 200ms ease-out, opacity 200ms ease-out",
          }}
        >
          {celdas.map((dia, i) => {
            if (dia === null) return <span key={i} />;
            const fecha = clave(anio, mes, dia);
            const lista = eventos.get(fecha) ?? [];
            const tipos = ORDEN.filter((t) => lista.some((e) => e.tipo === t));
            const principal = tipos[0];
            const esHoy = fecha === fechaHoy;
            const elegido = fecha === seleccion;
            return (
              <button
                key={i}
                type="button"
                onClick={() => setSeleccion(fecha)}
                aria-label={`${dia} de ${MESES[mes]}${tipos.length ? `: ${tipos.map((t) => ESTILO[t].etiqueta).join(", ")}` : ""}`}
                className="relative flex aspect-square items-center justify-center rounded-xl transition active:scale-95"
              >
                {/* Marca más pequeña que la celda: círculo con el color del evento */}
                <span
                  className={`flex h-8 w-8 items-center justify-center rounded-full text-[13px] font-semibold tabular-nums ${
                    principal ? ESTILO[principal].celda : esHoy ? "bg-slate-100 text-slate-900" : "text-slate-800"
                  } ${elegido ? "ring-2 ring-slate-900 ring-offset-1" : ""}`}
                >
                  {dia}
                </span>
                {tipos.length > 1 && (
                  <span className="absolute bottom-0.5 flex gap-0.5" aria-hidden="true">
                    {tipos.slice(1).map((t) => (
                      <span key={t} className={`h-1.5 w-1.5 rounded-full ${ESTILO[t].punto}`} />
                    ))}
                  </span>
                )}
                {esHoy && !principal && <span className="absolute bottom-0.5 h-1 w-1 rounded-full bg-sky-600" aria-hidden="true" />}
              </button>
            );
          })}
        </div>
        </div>

        <div className="mt-2 flex justify-center">
          <style>{`
            .entrada-derecha { animation: cal-derecha 240ms ease-out; }
            .entrada-izquierda { animation: cal-izquierda 240ms ease-out; }
            @keyframes cal-derecha { from { transform: translateX(40%); opacity: 0 } to { transform: none; opacity: 1 } }
            @keyframes cal-izquierda { from { transform: translateX(-40%); opacity: 0 } to { transform: none; opacity: 1 } }
            @media (prefers-reduced-motion: reduce) { .entrada-derecha, .entrada-izquierda { animation: none } }
          `}</style>
          <button type="button" onClick={irAHoy} className="rounded-full px-3 py-1 text-xs font-semibold text-sky-700 active:bg-sky-50">
            Hoy
          </button>
        </div>
      </section>

      {/* Detalle del día elegido */}
      <section>
        <h2 className="mb-2 px-1 text-[11px] font-semibold uppercase tracking-wider text-slate-400">
          {formatoFecha(seleccion, true)} · {delDia.length ? `${delDia.length} ${delDia.length === 1 ? "evento" : "eventos"}` : "sin eventos"}
        </h2>
        {delDia.length > 0 && (
          <ul className="divide-y divide-slate-100 overflow-hidden rounded-3xl bg-white ring-1 ring-slate-200/80">
            {delDia.map((e, i) => (
              <li key={i}>
                <button
                  type="button"
                  onClick={() => router.push(`/cerda/${encodeURIComponent(e.cerdaId)}`)}
                  className="flex w-full items-center gap-3 px-4 py-3 text-left active:bg-slate-50"
                >
                  <span className={`h-3 w-3 shrink-0 rounded-full ${ESTILO[e.tipo].punto}`} aria-hidden="true" />
                  <span className="min-w-0 flex-1">
                    <span className={`block text-xs font-semibold ${ESTILO[e.tipo].texto}`}>{ESTILO[e.tipo].etiqueta}</span>
                    <span className="block truncate text-sm font-semibold text-slate-900">{e.nombre}</span>
                    <span className="block truncate text-xs text-slate-500">{e.detalle}</span>
                  </span>
                  <Chevron />
                </button>
              </li>
            ))}
          </ul>
        )}
      </section>
      {/* Resumen del mes: dona con el total de eventos */}
      <section className="rounded-3xl bg-white p-4 ring-1 ring-slate-200/80">
        <h2 className="mb-3 text-[15px] font-bold text-slate-900">Resumen de {MESES[mes].toLowerCase()}</h2>
        <div className="flex items-center gap-4">
          <Dona
            total={delMes.length}
            partes={ORDEN.map((t) => ({ tipo: t, valor: cuenta(t), color: COLOR_BARRA[t] }))}
          />
          <ul className="min-w-0 flex-1 space-y-2.5">
            {ORDEN.map((t) => (
              <li key={t} className="flex items-center gap-2 text-[13px] text-slate-700">
                <span className="h-2.5 w-2.5 shrink-0 rounded-[3px]" style={{ backgroundColor: COLOR_BARRA[t] }} aria-hidden="true" />
                <span className="min-w-0 flex-1 truncate">{ESTILO[t].etiqueta}</span>
                <b className="tabular-nums text-slate-900">{cuenta(t)}</b>
              </li>
            ))}
          </ul>
        </div>
      </section>
    </ModuloPage>
  );
}

/** Dona con el total de eventos del mes en el centro */
function Dona({ total, partes }: { total: number; partes: { tipo: Tipo; valor: number; color: string }[] }) {
  const r = 46;
  const c = 2 * Math.PI * r;
  const separacion = partes.filter((p) => p.valor > 0).length > 1 ? 2.5 : 0;
  let desplazamiento = 0;
  return (
    <svg
      viewBox="0 0 120 120"
      className="h-32 w-32 shrink-0"
      role="img"
      aria-label={`${total} eventos: ${partes.map((p) => `${ESTILO[p.tipo].etiqueta} ${p.valor}`).join(", ")}`}
    >
      <circle cx="60" cy="60" r={r} fill="none" className="stroke-slate-100" strokeWidth={14} />
      {total > 0 &&
        partes.map((p) => {
          if (!p.valor) return null;
          const largo = (p.valor / total) * c;
          const seg = (
            <circle
              key={p.tipo}
              cx="60"
              cy="60"
              r={r}
              fill="none"
              stroke={p.color}
              strokeWidth={14}
              strokeDasharray={`${Math.max(0.5, largo - separacion)} ${c}`}
              strokeDashoffset={-desplazamiento}
              transform="rotate(-90 60 60)"
            />
          );
          desplazamiento += largo;
          return seg;
        })}
      <text x="60" y="58" textAnchor="middle" className="fill-slate-900 text-[26px] font-bold tabular-nums">
        {total}
      </text>
      <text x="60" y="76" textAnchor="middle" className="fill-slate-500 text-[11px]">
        {total === 1 ? "evento" : "eventos"}
      </text>
    </svg>
  );
}
