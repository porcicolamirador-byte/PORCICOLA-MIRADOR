"use client";

import { CLASE_SELECTOR } from "@/components/ui";
import SelectorApp from "@/components/SelectorApp";
import { guardarConRegistro } from "@/lib/log";
import { useEffect, useState, type ReactNode } from "react";
import { useParams, useRouter } from "next/navigation";
import usePageBackground from "@/hooks/usePageBackground";
import { leerConfig } from "@/lib/config";
import { crearLoteDesdeParto } from "@/lib/datos";

const MESES = ["Ene", "Feb", "Mar", "Abr", "May", "Jun", "Jul", "Ago", "Sep", "Oct", "Nov", "Dic"];
const TIPOS_PARTO = ["Normal", "Asistido", "Distócico", "Cesárea"];
const ESTADOS_SALUD = ["Buena", "Regular", "Mala"];

interface Registro {
  tipo?: string;
  fecha?: string;
  [clave: string]: unknown;
}

function decodificar(valor: string): string {
  try {
    return decodeURIComponent(valor);
  } catch {
    return valor;
  }
}

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
  return `${MESES[d.getMonth()]}-${d.getDate()}-${d.getFullYear()}`;
}

function calcularDiasEntre(inicio: string, fin: string) {
  return Math.floor((parsearFechaLocal(fin).getTime() - parsearFechaLocal(inicio).getTime()) / 86_400_000);
}

const inputBase =
  "w-full h-12 rounded-xl border border-slate-300 bg-slate-50 px-3 text-base text-slate-900 outline-none transition placeholder:text-slate-400 focus:ring-2 focus:ring-sky-200";

/** Convierte "1,4" o "1.4" a número; vacío → null */
function aNumero(valor: string): number | null {
  const limpio = valor.replace(",", ".").trim();
  if (!limpio) return null;
  const n = Number(limpio);
  return Number.isFinite(n) ? n : null;
}

export default function RegistrarParto() {
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
  usePageBackground("#ffffff");

  const [historial, setHistorial] = useState<Registro[] | null>(null);
  const [existe, setExiste] = useState(true);

  const [fecha, setFecha] = useState("");
  const [horaInicio, setHoraInicio] = useState("");
  const [tipoParto, setTipoParto] = useState("Normal");
  const [asistidoPor, setAsistidoPor] = useState("");
  const [vivos, setVivos] = useState("");
  const [muertos, setMuertos] = useState("");
  const [momias, setMomias] = useState("");
  const [pesoPromedio, setPesoPromedio] = useState("1.25");
  const [pesoCerda, setPesoCerda] = useState("");
  const [estadoSalud, setEstadoSalud] = useState("Buena");
  const [observaciones, setObservaciones] = useState("");
  const [observacionesLechones, setObservacionesLechones] = useState("");
  const [error, setError] = useState("");

  useEffect(() => {
    const cerdas = JSON.parse(localStorage.getItem("cerdas") || "[]");
    setExiste(Array.isArray(cerdas) && cerdas.some((c: { id?: string }) => c.id === id));
    const hist = JSON.parse(localStorage.getItem(`historial-${id}`) || "[]");
    setHistorial(Array.isArray(hist) ? hist : []);
    setFecha(fechaLocalISO(new Date()));
  }, [id]);

  const volver = () => router.replace(`/cerda/${encodeURIComponent(id)}`);

  const totalPartos = historial?.filter((r) => r.tipo === "Parto").length ?? 0;
  const codigoParto = `${id}-P${totalPartos + 1}`;
  const ultimaInseminacion = historial?.find((r) => r.tipo === "Inseminación");
  const diasDesdeIA =
    ultimaInseminacion?.fecha && fecha ? calcularDiasEntre(ultimaInseminacion.fecha, fecha) : null;

  function guardar() {
    if (!historial) return;
    if (!fecha) return setError("La fecha del parto es obligatoria");
    if (fecha > fechaLocalISO(new Date())) return setError("La fecha del parto no puede ser futura");

    // Mismas reglas del ciclo reproductivo que la ficha de la cerda
    const ultimoTipo = historial[0]?.tipo;
    if (ultimoTipo === "Parto") return setError("No se puede registrar Parto de forma consecutiva");
    if (ultimoTipo === "Celo" || ultimoTipo === "Destete") return setError("Revisar Ciclo Reproductivo");
    if (ultimoTipo === "Inseminación" && (diasDesdeIA === null || diasDesdeIA < 110)) {
      return setError("Revisar Ciclo Reproductivo: faltan días de gestación");
    }

    // Todos los datos son obligatorios, menos "Asistido por"
    if (!horaInicio) return setError("Escribe la hora de inicio del parto");
    if (!tipoParto) return setError("Elige el tipo de parto");
    const nVivos = aNumero(vivos);
    if (nVivos === null || nVivos < 0) return setError("Indica cuántos lechones nacieron vivos");
    const nMuertosTxt = aNumero(muertos);
    if (nMuertosTxt === null || nMuertosTxt < 0) return setError("Indica cuántos nacieron muertos (0 si ninguno)");
    const nMomiasTxt = aNumero(momias);
    if (nMomiasTxt === null || nMomiasTxt < 0) return setError("Indica cuántas momias hubo (0 si ninguna)");
    const nPeso = aNumero(pesoPromedio);
    if (nPeso === null || !(nPeso > 0)) return setError("Escribe el peso promedio de los lechones");
    if (!observacionesLechones.trim()) return setError("Escribe las observaciones de los lechones");
    const nPesoCerda = aNumero(pesoCerda);
    if (nPesoCerda === null || !(nPesoCerda > 0)) return setError("Escribe el peso de la cerda");
    if (!estadoSalud) return setError("Elige el estado de salud de la cerda");
    if (!observaciones.trim()) return setError("Escribe las observaciones del parto");
    const nMuertos = Math.max(0, nMuertosTxt);
    const nMomias = Math.max(0, nMomiasTxt);

    const d = parsearFechaLocal(fecha);
    const { desteteMin, desteteMax } = leerConfig();
    const d21 = fechaLocalISO(new Date(d.getFullYear(), d.getMonth(), d.getDate() + desteteMin));
    const d28 = fechaLocalISO(new Date(d.getFullYear(), d.getMonth(), d.getDate() + desteteMax));

    const nuevo: Registro = {
      tipo: "Parto",
      fecha,
      codigoParto,
      horaInicio: horaInicio || undefined,
      tipoParto,
      asistidoPor: asistidoPor.trim() || undefined,
      lechones: nVivos + nMuertos + nMomias,
      vivos: nVivos,
      muertos: nMuertos,
      momias: nMomias,
      pesoPromedio: aNumero(pesoPromedio) ?? undefined,
      // Genética de la inseminación de esta camada (no se cambia aquí)
      genetica: (ultimaInseminacion as { genetica?: string } | undefined)?.genetica || undefined,
      pesoCerda: aNumero(pesoCerda) ?? undefined,
      estadoSalud,
      observaciones: observaciones.trim() || undefined,
      observacionesLechones: observacionesLechones.trim() || undefined,
      descripcion: "",
      mensaje: `Destete entre ${formatearFechaCorta(d21)} y ${formatearFechaCorta(d28)}`,
    };

    guardarConRegistro(`historial-${id}`, [nuevo, ...historial]);
    // La camada pasa automáticamente a Engorde como un lote nuevo
    crearLoteDesdeParto({
      cerdaId: id,
      codigoParto,
      fecha,
      vivos: nVivos,
      pesoPromedio: aNumero(pesoPromedio) ?? undefined,
    });
    // La ficha de la cerda abre el resumen de este parto al volver
    localStorage.setItem("last-new-registro", JSON.stringify({ cerdaId: id }));
    volver();
  }

  if (!existe) {
    return (
      <main className="flex min-h-screen flex-col items-center justify-center gap-3 bg-white px-6 text-center">
        <p className="text-black">Cerda no encontrada</p>
        <button onClick={() => router.push("/gestacion")} className="rounded-2xl bg-sky-900 px-4 py-2 text-sm font-bold text-white">
          Ir a Gestación
        </button>
      </main>
    );
  }

  return (
    <main
      className="min-h-screen bg-white px-4 pb-10 text-slate-900"
      style={{
        paddingTop: "calc(env(safe-area-inset-top) + 0.75rem)",
        paddingBottom: "calc(env(safe-area-inset-bottom) + 2rem)",
      }}
    >
      <div className="mx-auto max-w-md">
        <header className="mb-4 flex items-center gap-3">
          <button
            onClick={volver}
            aria-label="Volver"
            className="rounded-2xl border border-gray-200 bg-white px-4 py-2 text-black shadow hover:bg-gray-50"
          >
            ←
          </button>
          <div className="min-w-0 flex-1">
            <h1 className="truncate text-2xl font-extrabold text-black">Registrar parto</h1>
            <p className="text-xs text-slate-500">
              Cerda {id} · código {codigoParto}
              {diasDesdeIA !== null ? ` · día ${diasDesdeIA} desde la IA` : ""}
            </p>
          </div>
        </header>

        <div className="space-y-4">
          <Seccion titulo="Parto">
            <div className="grid grid-cols-2 gap-3">
              <Campo etiqueta="Fecha *">
                <input type="date" value={fecha} max={fechaLocalISO(new Date())}
                  onChange={(e) => { setFecha(e.target.value); setError(""); }} className={`${inputBase} appearance-none`} />
              </Campo>
              <Campo etiqueta="Hora de inicio *">
                <input type="time" value={horaInicio} onChange={(e) => setHoraInicio(e.target.value)} className={`${inputBase} appearance-none`} />
              </Campo>
              <Campo etiqueta="Tipo de parto *">
                <SelectorApp valor={tipoParto} onCambiar={setTipoParto} titulo="Tipo de parto" opciones={TIPOS_PARTO.map((t) => ({ valor: t, texto: t }))} className="w-full" claseBoton={CLASE_SELECTOR} />
              </Campo>
              <Campo etiqueta="Asistido por">
                <input value={asistidoPor} onChange={(e) => setAsistidoPor(e.target.value)} placeholder="Nombre" className={inputBase} />
              </Campo>
            </div>
          </Seccion>

          <Seccion titulo="Lechones">
            <div className="grid grid-cols-3 gap-3">
              <Campo etiqueta="Vivos *">
                <input type="tel" inputMode="numeric" value={vivos}
                  onChange={(e) => { setVivos(e.target.value.replace(/\D/g, "")); setError(""); }} className={inputBase} />
              </Campo>
              <Campo etiqueta="Muertos *">
                <input type="tel" inputMode="numeric" value={muertos}
                  onChange={(e) => setMuertos(e.target.value.replace(/\D/g, ""))} className={inputBase} />
              </Campo>
              <Campo etiqueta="Momias *">
                <input type="tel" inputMode="numeric" value={momias}
                  onChange={(e) => setMomias(e.target.value.replace(/\D/g, ""))} className={inputBase} />
              </Campo>
            </div>
            <p className="mt-2 text-xs text-slate-500">
              Total nacidos: <b>{(aNumero(vivos) ?? 0) + (aNumero(muertos) ?? 0) + (aNumero(momias) ?? 0)}</b>
            </p>
            {(aNumero(vivos) ?? 0) > 0 && (
              <p className="mt-2 rounded-xl bg-amber-50 px-3 py-2 text-xs text-amber-900 ring-1 ring-amber-100">
                🐷 Al guardar se creará en <b>Engorde</b> el lote <b>Lote {codigoParto}</b> con{" "}
                <b>{aNumero(vivos)}</b> {aNumero(vivos) === 1 ? "lechón" : "lechones"}.
              </p>
            )}
            <div className="mt-3 grid grid-cols-2 gap-3">
              <Campo etiqueta="Peso promedio (kg) *">
                <input type="tel" inputMode="decimal" value={pesoPromedio} placeholder="1.25"
                  onChange={(e) => setPesoPromedio(e.target.value.replace(/[^0-9.,]/g, ""))} className={inputBase} />
              </Campo>
              <div className="col-span-2">
                <Campo etiqueta="Genética (de la inseminación)">
                  <div className="flex h-11 items-center rounded-xl border border-slate-200 bg-slate-100 px-3 text-base text-slate-700" aria-readonly="true">
                    {(ultimaInseminacion as { genetica?: string } | undefined)?.genetica || "Sin genética registrada"}
                  </div>
                </Campo>
              </div>
            </div>
            <div className="mt-3">
              <Campo etiqueta="Observaciones de los lechones *">
                <textarea value={observacionesLechones} onChange={(e) => setObservacionesLechones(e.target.value)}
                  placeholder="Tamaño, vitalidad, malformaciones…"
                  className="h-20 w-full resize-none rounded-xl border border-slate-300 bg-slate-50 px-3 py-2 text-base outline-none focus:ring-2 focus:ring-sky-200" />
              </Campo>
            </div>
          </Seccion>

          <Seccion titulo="Cerda">
            <div className="grid grid-cols-2 gap-3">
              <Campo etiqueta="Peso de la cerda (kg) *">
                <input type="tel" inputMode="decimal" value={pesoCerda}
                  onChange={(e) => setPesoCerda(e.target.value.replace(/[^0-9.,]/g, ""))} className={inputBase} />
              </Campo>
              <Campo etiqueta="Estado de salud *">
                <SelectorApp valor={estadoSalud} onCambiar={setEstadoSalud} titulo="Estado de salud" opciones={ESTADOS_SALUD.map((t) => ({ valor: t, texto: t }))} className="w-full" claseBoton={CLASE_SELECTOR} />
              </Campo>
            </div>
            <div className="mt-3">
              <Campo etiqueta="Observaciones del parto *">
                <textarea value={observaciones} onChange={(e) => setObservaciones(e.target.value)}
                  placeholder="Duración, complicaciones, medicamentos…"
                  className="h-20 w-full resize-none rounded-xl border border-slate-300 bg-slate-50 px-3 py-2 text-base outline-none focus:ring-2 focus:ring-sky-200" />
              </Campo>
            </div>
          </Seccion>

          {error && (
            <p role="alert" className="rounded-2xl bg-red-50 px-4 py-3 text-sm font-semibold text-red-700">
              {error}
            </p>
          )}

          <div className="flex gap-3 pt-1">
            <button
              onClick={guardar}
              disabled={!historial}
              className="flex-1 rounded-2xl bg-sky-900 py-3 font-bold text-white hover:bg-sky-950 disabled:opacity-50"
            >
              Guardar parto
            </button>
            <button onClick={volver} className="flex-1 rounded-2xl bg-gray-200 py-3 font-bold text-black hover:bg-gray-300">
              Cancelar
            </button>
          </div>
        </div>
      </div>
    </main>
  );
}

function Seccion({ titulo, children }: { titulo: string; children: ReactNode }) {
  return (
    <section className="rounded-2xl border border-gray-100 bg-white p-3 shadow-sm">
      <h2 className="mb-3 text-sm font-bold text-black">{titulo}</h2>
      {children}
    </section>
  );
}

function Campo({ etiqueta, children }: { etiqueta: string; children: ReactNode }) {
  return (
    <label className="block">
      <span className="mb-1 block text-sm font-medium text-slate-700">{etiqueta}</span>
      {children}
    </label>
  );
}
