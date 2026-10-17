"use client";

import { useMemo, useState, type FormEvent } from "react";
import ModuloPage from "@/components/ModuloPage";
import { Boton, Campo, Entrada, Hoja, IconoMas, Insignia, Selector, Tarjeta, Vacio } from "@/components/ui";
import {
  formatoFecha,
  guardarLecturas,
  hoy,
  leerLecturas,
  nuevoId,
  useVersionDatos,
  type Lectura,
  type ZonaMonitoreo,
} from "@/lib/datos";
import { confirmar } from "@/components/Dialogo";

/** Rangos de confort recomendados por zona (°C) y humedad relativa (%) */
const ZONAS: { zona: ZonaMonitoreo; icono: string; min: number; max: number }[] = [
  { zona: "Maternidad", icono: "🍼", min: 18, max: 22 },
  { zona: "Gestación", icono: "🐖", min: 16, max: 22 },
  { zona: "Precebo", icono: "🐽", min: 24, max: 28 },
  { zona: "Engorde", icono: "🐷", min: 16, max: 24 },
];
const HUMEDAD_MIN = 50;
const HUMEDAD_MAX = 75;

function horaActual() {
  const d = new Date();
  return `${String(d.getHours()).padStart(2, "0")}:${String(d.getMinutes()).padStart(2, "0")}`;
}

function evaluar(l: Lectura) {
  const rango = ZONAS.find((z) => z.zona === l.zona) ?? ZONAS[0];
  const avisos: string[] = [];
  if (l.temperatura < rango.min) avisos.push(`Frío (mín. ${rango.min} °C)`);
  if (l.temperatura > rango.max) avisos.push(`Calor (máx. ${rango.max} °C)`);
  if (l.humedad !== undefined && l.humedad < HUMEDAD_MIN) avisos.push(`Ambiente seco (mín. ${HUMEDAD_MIN} %)`);
  if (l.humedad !== undefined && l.humedad > HUMEDAD_MAX) avisos.push(`Muy húmedo (máx. ${HUMEDAD_MAX} %)`);
  return avisos;
}

const ordenar = (a: Lectura, b: Lectura) => `${b.fecha} ${b.hora}`.localeCompare(`${a.fecha} ${a.hora}`);

export default function MonitoreoPage() {
  const version = useVersionDatos();
  const [nueva, setNueva] = useState<ZonaMonitoreo | null>(null);

  const datos = useMemo(() => {
    if (version < 0) return null;
    const lecturas = leerLecturas().sort(ordenar);
    const fecha = hoy();
    const porZona = ZONAS.map((z) => {
      const deZona = lecturas.filter((l) => l.zona === z.zona);
      const deHoy = deZona.filter((l) => l.fecha === fecha).map((l) => l.temperatura);
      return {
        ...z,
        ultima: deZona[0],
        minHoy: deHoy.length ? Math.min(...deHoy) : undefined,
        maxHoy: deHoy.length ? Math.max(...deHoy) : undefined,
      };
    });
    const alertas = porZona.filter((z) => z.ultima && evaluar(z.ultima).length > 0).length;
    return { lecturas, porZona, alertas };
  }, [version]);

  const eliminar = async (id: string) => {
    if (!(await confirmar({ titulo: "Eliminar lectura", mensaje: "Esta lectura se borrará del historial.", aceptar: "Eliminar", destructivo: true }))) return;
    guardarLecturas(leerLecturas().filter((l) => l.id !== id));
  };

  return (
    <ModuloPage
      titulo="Monitoreo"
      subtitulo="Temperatura y humedad de los galpones"
      icono="🌡️"
      tono="orange"
      accion={
        <Boton onClick={() => setNueva("Maternidad")} className="px-3.5">
          <IconoMas /> Lectura
        </Boton>
      }
    >
      {datos && datos.alertas > 0 && (
        <div className="rounded-2xl bg-red-50 px-4 py-3 text-sm font-semibold text-red-700 ring-1 ring-red-200">
          {datos.alertas === 1 ? "1 zona fuera de rango" : `${datos.alertas} zonas fuera de rango`} en la última lectura
        </div>
      )}

      <div className="grid grid-cols-2 gap-2.5">
        {(datos?.porZona ?? ZONAS.map((z) => ({ ...z, ultima: undefined, minHoy: undefined, maxHoy: undefined }))).map(
          (z) => {
            const avisos = z.ultima ? evaluar(z.ultima) : [];
            const ok = z.ultima && avisos.length === 0;
            return (
              <button
                key={z.zona}
                type="button"
                onClick={() => setNueva(z.zona)}
                className={`flex flex-col gap-2 rounded-3xl bg-white p-3.5 text-left ring-1 transition active:scale-[0.98] ${
                  avisos.length ? "ring-red-300" : "ring-slate-200/80"
                }`}
              >
                <div className="flex items-center justify-between gap-2">
                  <span className="truncate text-sm font-semibold text-slate-900">
                    <span aria-hidden="true">{z.icono}</span> {z.zona}
                  </span>
                  {z.ultima && (
                    <Insignia
                      clase={
                        ok
                          ? "bg-emerald-50 text-emerald-700 ring-emerald-200"
                          : "bg-red-50 text-red-700 ring-red-200"
                      }
                    >
                      {ok ? "Normal" : "Alerta"}
                    </Insignia>
                  )}
                </div>
                {z.ultima ? (
                  <>
                    <p className="text-3xl font-bold leading-none text-slate-900 tabular-nums">
                      {z.ultima.temperatura.toFixed(1)}
                      <span className="text-base font-semibold text-slate-500"> °C</span>
                    </p>
                    <p className="text-xs text-slate-500">
                      {z.ultima.humedad !== undefined ? `💧 ${z.ultima.humedad} % · ` : ""}
                      {formatoFecha(z.ultima.fecha)} {z.ultima.hora}
                    </p>
                    {z.minHoy !== undefined && (
                      <p className="text-[11px] text-slate-500">
                        Hoy: mín {z.minHoy.toFixed(1)}° · máx {z.maxHoy?.toFixed(1)}°
                      </p>
                    )}
                    {avisos.length > 0 && <p className="text-[11px] font-semibold text-red-600">{avisos.join(" · ")}</p>}
                  </>
                ) : (
                  <p className="text-xs text-slate-500">Sin lecturas · ideal {z.min}–{z.max} °C</p>
                )}
              </button>
            );
          }
        )}
      </div>

      <Tarjeta titulo="Últimas lecturas">
        {!datos || datos.lecturas.length === 0 ? (
          <Vacio
            titulo="Sin lecturas registradas"
            texto="Toca una zona o “+ Lectura” para anotar la temperatura y la humedad del termómetro."
          />
        ) : (
          <ul className="flex flex-col divide-y divide-slate-100">
            {datos.lecturas.slice(0, 40).map((l) => {
              const avisos = evaluar(l);
              return (
                <li key={l.id} className="flex items-center gap-3 py-2.5 first:pt-0 last:pb-0">
                  <span
                    className={`flex h-9 w-14 shrink-0 items-center justify-center rounded-xl text-sm font-bold tabular-nums ${
                      avisos.length ? "bg-red-50 text-red-700" : "bg-orange-50 text-orange-800"
                    }`}
                  >
                    {l.temperatura.toFixed(1)}°
                  </span>
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm font-semibold text-slate-900">
                      {l.zona}
                      {l.humedad !== undefined ? <span className="font-normal text-slate-500"> · {l.humedad} %</span> : null}
                    </p>
                    <p className="truncate text-xs text-slate-500">
                      {formatoFecha(l.fecha, true)} · {l.hora}
                      {avisos.length ? ` · ${avisos.join(", ")}` : ""}
                    </p>
                  </div>
                  <button
                    type="button"
                    onClick={() => eliminar(l.id)}
                    className="shrink-0 rounded-full px-2 py-1 text-xs text-slate-400 hover:bg-rose-50 hover:text-rose-600"
                  >
                    Quitar
                  </button>
                </li>
              );
            })}
          </ul>
        )}
      </Tarjeta>

      <p className="px-1 text-[11px] leading-relaxed text-slate-400">
        Rangos de referencia: maternidad 18–22 °C, gestación 16–22 °C, precebo 24–28 °C, engorde 16–24 °C;
        humedad {HUMEDAD_MIN}–{HUMEDAD_MAX} %. Los lechones recién nacidos necesitan 30–34 °C en su nido.
      </p>

      <NuevaLectura zonaInicial={nueva} onCerrar={() => setNueva(null)} />
    </ModuloPage>
  );
}

function NuevaLectura({ zonaInicial, onCerrar }: { zonaInicial: ZonaMonitoreo | null; onCerrar: () => void }) {
  const [zona, setZona] = useState<ZonaMonitoreo>("Maternidad");
  const [temperatura, setTemperatura] = useState("");
  const [humedad, setHumedad] = useState("");
  const [fecha, setFecha] = useState(hoy());
  const [hora, setHora] = useState(horaActual());
  const [abiertaPara, setAbiertaPara] = useState<ZonaMonitoreo | null>(null);

  // Al abrir, se preselecciona la zona tocada y la hora actual
  if (zonaInicial && zonaInicial !== abiertaPara) {
    setAbiertaPara(zonaInicial);
    setZona(zonaInicial);
    setFecha(hoy());
    setHora(horaActual());
  }
  if (!zonaInicial && abiertaPara) setAbiertaPara(null);

  const cerrar = () => {
    setTemperatura("");
    setHumedad("");
    onCerrar();
  };

  const guardar = (e: FormEvent) => {
    e.preventDefault();
    const t = Number(temperatura.replace(",", "."));
    if (!Number.isFinite(t) || temperatura.trim() === "") return;
    const h = Number(humedad.replace(",", "."));
    guardarLecturas([
      ...leerLecturas(),
      {
        id: nuevoId(),
        fecha,
        hora,
        zona,
        temperatura: t,
        humedad: humedad.trim() && Number.isFinite(h) ? Math.round(h) : undefined,
      },
    ]);
    cerrar();
  };

  return (
    <Hoja abierta={zonaInicial !== null} titulo="Nueva lectura" onCerrar={cerrar}>
      <form onSubmit={guardar} className="flex flex-col gap-3.5">
        <Campo etiqueta="Zona">
          <Selector
            value={zona}
            onChange={(v) => setZona(v as ZonaMonitoreo)}
            opciones={ZONAS.map((z) => ({ valor: z.zona, texto: `${z.zona} (ideal ${z.min}–${z.max} °C)` }))}
          />
        </Campo>
        <div className="grid grid-cols-2 gap-3">
          <Campo etiqueta="Temperatura (°C) *">
            <Entrada type="number" inputMode="decimal" step="any" value={temperatura} onChange={setTemperatura} required placeholder="Ej. 21.5" />
          </Campo>
          <Campo etiqueta="Humedad (%)">
            <Entrada type="number" inputMode="numeric" min={0} value={humedad} onChange={setHumedad} placeholder="Ej. 65" />
          </Campo>
        </div>
        <div className="grid grid-cols-2 gap-3">
          <Campo etiqueta="Fecha">
            <Entrada type="date" value={fecha} onChange={setFecha} required />
          </Campo>
          <Campo etiqueta="Hora">
            <input
              type="time"
              value={hora}
              onChange={(e) => setHora(e.target.value)}
              required
              className="w-full rounded-xl bg-slate-50 px-3.5 py-2.5 text-base text-slate-900 ring-1 ring-slate-200 focus:bg-white focus:outline-none focus:ring-2 focus:ring-emerald-600"
            />
          </Campo>
        </div>
        <Boton type="submit" className="mt-1 w-full py-3">
          Guardar lectura
        </Boton>
      </form>
    </Hoja>
  );
}
