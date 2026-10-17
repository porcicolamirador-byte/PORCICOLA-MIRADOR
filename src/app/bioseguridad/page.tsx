"use client";

import { useMemo, useState, type FormEvent } from "react";
import ModuloPage from "@/components/ModuloPage";
import { Boton, Campo, Entrada, Hoja, IconoMas, Insignia, Tarjeta } from "@/components/ui";
import {
  formatoFecha,
  guardarChecks,
  guardarVisitas,
  hoy,
  leerChecks,
  leerVisitas,
  nuevoId,
  sumarDias,
  useVersionDatos,
} from "@/lib/datos";
import { confirmar } from "@/components/Dialogo";

const PROTOCOLOS = [
  { id: "pediluvios", texto: "Pediluvios con desinfectante renovado" },
  { id: "ropa", texto: "Personal con ropa y botas exclusivas" },
  { id: "lavado", texto: "Lavado de manos al entrar a cada galpón" },
  { id: "corrales", texto: "Limpieza de corrales y comederos" },
  { id: "agua", texto: "Revisión de bebederos y calidad del agua" },
  { id: "plagas", texto: "Control de roedores, moscas y aves" },
  { id: "mortalidad", texto: "Disposición correcta de animales muertos" },
  { id: "vehiculos", texto: "Desinfección de vehículos que ingresan" },
];

export default function BioseguridadPage() {
  const version = useVersionDatos();
  const [nuevaVisita, setNuevaVisita] = useState(false);

  const datos = useMemo(() => {
    if (version < 0) return null;
    const checks = leerChecks();
    const fecha = hoy();
    const semana = Array.from({ length: 7 }, (_, i) => {
      const f = sumarDias(fecha, i - 6);
      const hechos = (checks[f] ?? []).filter((id) => PROTOCOLOS.some((p) => p.id === id)).length;
      return { fecha: f, porcentaje: Math.round((hechos / PROTOCOLOS.length) * 100) };
    });
    return {
      hechosHoy: new Set(checks[fecha] ?? []),
      semana,
      visitas: leerVisitas().sort((a, b) => b.fecha.localeCompare(a.fecha)),
    };
  }, [version]);

  const alternar = (id: string) => {
    const checks = leerChecks();
    const fecha = hoy();
    const actuales = new Set(checks[fecha] ?? []);
    if (actuales.has(id)) actuales.delete(id);
    else actuales.add(id);
    guardarChecks({ ...checks, [fecha]: [...actuales] });
  };

  const eliminarVisita = async (id: string) => {
    if (!(await confirmar({ titulo: "Eliminar visita", mensaje: "La visita se borrará del registro.", aceptar: "Eliminar", destructivo: true }))) return;
    guardarVisitas(leerVisitas().filter((v) => v.id !== id));
  };

  const porcentajeHoy = datos ? Math.round((datos.hechosHoy.size / PROTOCOLOS.length) * 100) : 0;

  return (
    <ModuloPage
      titulo="Bioseguridad"
      subtitulo="Protocolos sanitarios y visitas"
      icono="🛡️"
      tono="sky"
      accion={
        <Boton onClick={() => setNuevaVisita(true)} className="px-3.5">
          <IconoMas /> Visita
        </Boton>
      }
    >
      <Tarjeta
        titulo="Protocolos de hoy"
        accion={<span className="text-sm font-semibold text-sky-700 tabular-nums">{datos ? `${porcentajeHoy} %` : ""}</span>}
      >
        <div className="mb-3 h-2 overflow-hidden rounded-full bg-slate-100">
          <div className="h-full rounded-full bg-sky-600 transition-all" style={{ width: `${porcentajeHoy}%` }} />
        </div>
        <ul className="flex flex-col gap-1">
          {PROTOCOLOS.map((p) => {
            const hecho = datos?.hechosHoy.has(p.id) ?? false;
            return (
              <li key={p.id}>
                <button
                  type="button"
                  onClick={() => alternar(p.id)}
                  disabled={!datos}
                  aria-pressed={hecho}
                  className="flex w-full items-center gap-3 rounded-xl px-2 py-2.5 text-left transition hover:bg-slate-50"
                >
                  <span
                    className={`flex h-6 w-6 shrink-0 items-center justify-center rounded-lg ring-1 transition ${
                      hecho ? "bg-sky-600 text-white ring-sky-600" : "bg-white ring-slate-300"
                    }`}
                  >
                    {hecho && (
                      <svg viewBox="0 0 24 24" className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth={3} strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                        <path d="M5 12.5l4.5 4.5L19 7.5" />
                      </svg>
                    )}
                  </span>
                  <span className={`text-sm ${hecho ? "text-slate-400 line-through" : "text-slate-800"}`}>{p.texto}</span>
                </button>
              </li>
            );
          })}
        </ul>
      </Tarjeta>

      <Tarjeta titulo="Últimos 7 días">
        <div className="grid grid-cols-7 gap-1.5">
          {(datos?.semana ?? []).map((d) => (
            <div key={d.fecha} className="flex flex-col items-center gap-1">
              <div className="flex h-16 w-full items-end overflow-hidden rounded-lg bg-slate-100">
                <div className="w-full rounded-lg bg-sky-500" style={{ height: `${Math.max(d.porcentaje, 4)}%`, opacity: d.porcentaje ? 1 : 0.25 }} />
              </div>
              <span className="text-[10px] text-slate-500">
                {new Date(`${d.fecha}T00:00:00`).toLocaleDateString("es-CO", { weekday: "narrow" })}
              </span>
            </div>
          ))}
        </div>
      </Tarjeta>

      <Tarjeta titulo="Registro de visitas">
        {!datos || datos.visitas.length === 0 ? (
          <p className="text-sm text-slate-500">No hay visitas registradas.</p>
        ) : (
          <ul className="flex flex-col divide-y divide-slate-100">
            {datos.visitas.slice(0, 20).map((v) => {
              const riesgo = v.diasSinCerdos < 2 || !v.duchaYRopa;
              return (
                <li key={v.id} className="flex items-start gap-3 py-3 first:pt-0 last:pb-0">
                  <div className="min-w-0 flex-1">
                    <div className="flex flex-wrap items-center gap-2">
                      <span className="text-sm font-semibold text-slate-900">{v.nombre}</span>
                      <Insignia
                        clase={
                          riesgo
                            ? "bg-amber-50 text-amber-800 ring-amber-200"
                            : "bg-emerald-50 text-emerald-700 ring-emerald-200"
                        }
                      >
                        {riesgo ? "Revisar" : "Cumple"}
                      </Insignia>
                    </div>
                    <p className="mt-0.5 text-xs text-slate-500">
                      {formatoFecha(v.fecha, true)} · {v.motivo} · {v.diasSinCerdos} días sin contacto con cerdos
                      {v.duchaYRopa ? " · ducha y ropa" : " · sin ducha/ropa"}
                    </p>
                  </div>
                  <button
                    type="button"
                    onClick={() => eliminarVisita(v.id)}
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

      <NuevaVisita abierta={nuevaVisita} onCerrar={() => setNuevaVisita(false)} />
    </ModuloPage>
  );
}

function NuevaVisita({ abierta, onCerrar }: { abierta: boolean; onCerrar: () => void }) {
  const [nombre, setNombre] = useState("");
  const [motivo, setMotivo] = useState("");
  const [fecha, setFecha] = useState(hoy());
  const [dias, setDias] = useState("3");
  const [ducha, setDucha] = useState(true);

  const guardar = (e: FormEvent) => {
    e.preventDefault();
    if (!nombre.trim()) return;
    guardarVisitas([
      ...leerVisitas(),
      {
        id: nuevoId(),
        fecha,
        nombre: nombre.trim(),
        motivo: motivo.trim() || "Visita",
        diasSinCerdos: Math.max(0, Number(dias) || 0),
        duchaYRopa: ducha,
      },
    ]);
    setNombre("");
    setMotivo("");
    setDias("3");
    setDucha(true);
    onCerrar();
  };

  return (
    <Hoja abierta={abierta} titulo="Registrar visita" onCerrar={onCerrar}>
      <form onSubmit={guardar} className="flex flex-col gap-3.5">
        <Campo etiqueta="Nombre del visitante *">
          <Entrada value={nombre} onChange={setNombre} required />
        </Campo>
        <Campo etiqueta="Motivo / empresa">
          <Entrada value={motivo} onChange={setMotivo} placeholder="Ej. Veterinario, proveedor de alimento" />
        </Campo>
        <div className="grid grid-cols-2 gap-3">
          <Campo etiqueta="Fecha">
            <Entrada type="date" value={fecha} onChange={setFecha} required />
          </Campo>
          <Campo etiqueta="Días sin contacto con cerdos" ayuda="Se recomiendan 2 o más">
            <Entrada type="number" inputMode="numeric" min={0} value={dias} onChange={setDias} />
          </Campo>
        </div>
        <label className="flex items-center gap-2 text-sm text-slate-700">
          <input
            type="checkbox"
            checked={ducha}
            onChange={(e) => setDucha(e.target.checked)}
            className="h-5 w-5 accent-emerald-700"
          />
          Se duchó y usó ropa de la granja
        </label>
        <Boton type="submit" className="mt-1 w-full py-3">
          Guardar visita
        </Boton>
      </form>
    </Hoja>
  );
}
