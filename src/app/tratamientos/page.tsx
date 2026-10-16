"use client";

import { useMemo, useState, type FormEvent } from "react";
import ModuloPage from "@/components/ModuloPage";
import { Boton, Campo, Dato, Entrada, Hoja, IconoMas, Insignia, Selector, Tarjeta, Vacio } from "@/components/ui";
import {
  agregarEvento,
  diasEntre,
  estadoDeCerda,
  formatoFecha,
  guardarTratamientos,
  hoy,
  leerCerdas,
  leerHistorial,
  leerLotes,
  leerTratamientos,
  nombreCerda,
  nuevoId,
  sumarDias,
  useVersionDatos,
  type Tratamiento,
  type TipoTratamiento,
} from "@/lib/datos";

const COLOR_TIPO: Record<TipoTratamiento, string> = {
  Tratamiento: "bg-rose-50 text-rose-700 ring-rose-200",
  Vacunación: "bg-sky-50 text-sky-700 ring-sky-200",
  Desparasitación: "bg-violet-50 text-violet-700 ring-violet-200",
};

export default function TratamientosPage() {
  const version = useVersionDatos();
  const [nuevo, setNuevo] = useState(false);

  const datos = useMemo(() => {
    if (version < 0) return null;
    const fecha = hoy();
    const lotes = leerLotes();
    const cerdas = leerCerdas();
    const nombreDe = (t: Tratamiento) => {
      if (t.objetivo === "lote") return lotes.find((l) => l.id === t.objetivoId)?.nombre ?? "Lote eliminado";
      const c = cerdas.find((x) => x.id === t.objetivoId);
      return c ? `Cerda ${nombreCerda(c)}` : `Cerda ${t.objetivoId}`;
    };
    const lista = leerTratamientos()
      .map((t) => {
        const fin = sumarDias(t.fecha, Math.max(1, t.dias) - 1);
        const finRetiro = sumarDias(fin, t.retiroDias);
        const enCurso = fecha <= fin;
        const enRetiro = !enCurso && t.retiroDias > 0 && fecha <= finRetiro;
        return { t, nombre: nombreDe(t), fin, finRetiro, enCurso, enRetiro };
      })
      .sort((a, b) => b.t.fecha.localeCompare(a.t.fecha));
    return {
      enCurso: lista.filter((x) => x.enCurso),
      enRetiro: lista.filter((x) => x.enRetiro),
      historial: lista.filter((x) => !x.enCurso && !x.enRetiro),
      esteMes: lista.filter((x) => x.t.fecha.slice(0, 7) === fecha.slice(0, 7)).length,
    };
  }, [version]);

  const eliminar = (id: string) => {
    if (!window.confirm("¿Eliminar este registro?")) return;
    guardarTratamientos(leerTratamientos().filter((t) => t.id !== id));
  };

  return (
    <ModuloPage
      titulo="Tratamientos"
      subtitulo="Salud, vacunas y medicamentos"
      icono="🩺"
      tono="rose"
      accion={
        <Boton onClick={() => setNuevo(true)} className="px-3.5">
          <IconoMas /> Registrar
        </Boton>
      }
    >
      <div className="grid grid-cols-3 gap-2">
        <Dato titulo="En curso" valor={datos ? datos.enCurso.length : "–"} />
        <Dato titulo="En retiro" valor={datos ? datos.enRetiro.length : "–"} />
        <Dato titulo="Este mes" valor={datos ? datos.esteMes : "–"} />
      </div>

      {datos === null ? (
        <div className="h-40 animate-pulse rounded-3xl bg-slate-100" />
      ) : datos.enCurso.length + datos.enRetiro.length + datos.historial.length === 0 ? (
        <Vacio
          titulo="Sin tratamientos registrados"
          texto="Registra tratamientos, vacunas y desparasitaciones de cerdas o lotes para controlar los tiempos de retiro."
          accion={<Boton onClick={() => setNuevo(true)}>Registrar</Boton>}
        />
      ) : (
        <>
          {[
            { titulo: "En curso", items: datos.enCurso },
            { titulo: "En tiempo de retiro", items: datos.enRetiro },
            { titulo: "Historial", items: datos.historial.slice(0, 30) },
          ]
            .filter((g) => g.items.length > 0)
            .map((g) => (
              <Tarjeta key={g.titulo} titulo={g.titulo}>
                <ul className="flex flex-col divide-y divide-slate-100">
                  {g.items.map(({ t, nombre, fin, finRetiro, enCurso, enRetiro }) => (
                    <li key={t.id} className="flex items-start gap-3 py-3 first:pt-0 last:pb-0">
                      <div className="min-w-0 flex-1">
                        <div className="flex flex-wrap items-center gap-2">
                          <span className="text-sm font-semibold text-slate-900">{t.medicamento}</span>
                          <Insignia clase={COLOR_TIPO[t.tipo]}>{t.tipo}</Insignia>
                        </div>
                        <p className="mt-0.5 text-xs text-slate-600">
                          {nombre}
                          {t.dosis ? ` · ${t.dosis}` : ""}
                        </p>
                        <p className="mt-0.5 text-xs text-slate-500">
                          {formatoFecha(t.fecha)}
                          {t.dias > 1 ? ` – ${formatoFecha(fin)}` : ""}
                          {enCurso && ` · día ${diasEntre(t.fecha, hoy()) + 1} de ${t.dias}`}
                          {enRetiro && ` · apto desde ${formatoFecha(sumarDias(finRetiro, 1))}`}
                        </p>
                        {t.motivo && <p className="mt-0.5 text-xs text-slate-500">{t.motivo}</p>}
                      </div>
                      <button
                        type="button"
                        onClick={() => eliminar(t.id)}
                        className="shrink-0 rounded-full px-2 py-1 text-xs text-slate-400 hover:bg-rose-50 hover:text-rose-600"
                      >
                        Quitar
                      </button>
                    </li>
                  ))}
                </ul>
              </Tarjeta>
            ))}
        </>
      )}

      <NuevoTratamiento abierta={nuevo} onCerrar={() => setNuevo(false)} />
    </ModuloPage>
  );
}

function NuevoTratamiento({ abierta, onCerrar }: { abierta: boolean; onCerrar: () => void }) {
  const [tipo, setTipo] = useState<TipoTratamiento>("Tratamiento");
  const [objetivo, setObjetivo] = useState<"cerda" | "lote">("cerda");
  const [objetivoId, setObjetivoId] = useState("");
  const [medicamento, setMedicamento] = useState("");
  const [dosis, setDosis] = useState("");
  const [fecha, setFecha] = useState(hoy());
  const [dias, setDias] = useState("1");
  const [retiro, setRetiro] = useState("0");
  const [motivo, setMotivo] = useState("");
  const [error, setError] = useState("");

  // Se recalcula al abrir la hoja para tener la lista al día
  const opciones = useMemo(() => {
    if (!abierta) return { cerdas: [], lotes: [] };
    return {
      cerdas: leerCerdas()
        .filter((c) => estadoDeCerda(leerHistorial(c.id)) !== "Fuera del hato")
        .map((c) => ({ valor: c.id, texto: `Cerda ${nombreCerda(c)}` })),
      lotes: leerLotes()
        .filter((l) => l.activo)
        .map((l) => ({ valor: l.id, texto: l.nombre })),
    };
  }, [abierta]);
  const lista = objetivo === "cerda" ? opciones.cerdas : opciones.lotes;

  const guardar = (e: FormEvent) => {
    e.preventDefault();
    const destino = objetivoId || lista[0]?.valor;
    if (!destino) return setError(objetivo === "cerda" ? "No hay cerdas registradas." : "No hay lotes activos.");
    if (!medicamento.trim()) return setError("Escribe el medicamento o la vacuna.");
    const t: Tratamiento = {
      id: nuevoId(),
      tipo,
      fecha,
      objetivo,
      objetivoId: destino,
      medicamento: medicamento.trim(),
      dosis: dosis.trim(),
      dias: Math.max(1, Number(dias) || 1),
      retiroDias: Math.max(0, Number(retiro) || 0),
      motivo: motivo.trim() || undefined,
    };
    guardarTratamientos([...leerTratamientos(), t]);
    // En la cerda también queda en su historial (lo usan las tareas del dashboard)
    if (objetivo === "cerda") {
      agregarEvento(destino, {
        tipo,
        fecha,
        notas: [t.medicamento, t.dosis, t.motivo].filter(Boolean).join(" · "),
      });
    }
    setMedicamento("");
    setDosis("");
    setMotivo("");
    setDias("1");
    setRetiro("0");
    setError("");
    onCerrar();
  };

  return (
    <Hoja abierta={abierta} titulo="Registrar tratamiento" onCerrar={onCerrar}>
      <form onSubmit={guardar} className="flex flex-col gap-3.5">
        <div className="grid grid-cols-2 gap-3">
          <Campo etiqueta="Tipo">
            <Selector
              value={tipo}
              onChange={(v) => setTipo(v as TipoTratamiento)}
              opciones={[
                { valor: "Tratamiento", texto: "Tratamiento" },
                { valor: "Vacunación", texto: "Vacunación" },
                { valor: "Desparasitación", texto: "Desparasitación" },
              ]}
            />
          </Campo>
          <Campo etiqueta="Aplicado a">
            <Selector
              value={objetivo}
              onChange={(v) => {
                setObjetivo(v as "cerda" | "lote");
                setObjetivoId("");
              }}
              opciones={[
                { valor: "cerda", texto: "Una cerda" },
                { valor: "lote", texto: "Un lote de engorde" },
              ]}
            />
          </Campo>
        </div>
        <Campo etiqueta={objetivo === "cerda" ? "Cerda" : "Lote"}>
          {lista.length ? (
            <Selector value={objetivoId || lista[0].valor} onChange={setObjetivoId} opciones={lista} />
          ) : (
            <p className="rounded-xl bg-slate-50 px-3.5 py-2.5 text-sm text-slate-500">
              {objetivo === "cerda" ? "No hay cerdas activas registradas." : "No hay lotes activos."}
            </p>
          )}
        </Campo>
        <div className="grid grid-cols-2 gap-3">
          <Campo etiqueta="Medicamento / vacuna *">
            <Entrada value={medicamento} onChange={setMedicamento} placeholder="Ej. Ivermectina" required />
          </Campo>
          <Campo etiqueta="Dosis">
            <Entrada value={dosis} onChange={setDosis} placeholder="Ej. 2 ml IM" />
          </Campo>
        </div>
        <div className="grid grid-cols-3 gap-3">
          <Campo etiqueta="Inicio">
            <Entrada type="date" value={fecha} onChange={setFecha} required />
          </Campo>
          <Campo etiqueta="Días">
            <Entrada type="number" inputMode="numeric" min={1} value={dias} onChange={setDias} />
          </Campo>
          <Campo etiqueta="Retiro (días)">
            <Entrada type="number" inputMode="numeric" min={0} value={retiro} onChange={setRetiro} />
          </Campo>
        </div>
        <Campo etiqueta="Motivo / diagnóstico">
          <Entrada value={motivo} onChange={setMotivo} placeholder="Opcional" />
        </Campo>
        {error && <p className="text-sm font-medium text-rose-600">{error}</p>}
        <Boton type="submit" className="mt-1 w-full py-3">
          Guardar
        </Boton>
      </form>
    </Hoja>
  );
}
