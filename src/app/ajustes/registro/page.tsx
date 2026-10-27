"use client";

import { useEffect, useMemo, useState, useSyncExternalStore } from "react";
import { useRouter } from "next/navigation";
import ModuloPage from "@/components/ModuloPage";
import { Boton, Chips } from "@/components/ui";
import { confirmar } from "@/components/Dialogo";
import { ajustesDesbloqueados } from "@/lib/acceso";
import { useVersionDatos } from "@/lib/datos";
import { leerLog, registrarLog, vaciarLog, type AccionLog, type EntradaLog } from "@/lib/log";

const sinSuscripcion = () => () => {};

type Filtro = "todos" | AccionLog;

const ESTILO: Record<AccionLog, { punto: string; texto: string; etiqueta: string }> = {
  Creación: { punto: "bg-sky-500", texto: "text-sky-700", etiqueta: "Creó" },
  Modificación: { punto: "bg-orange-500", texto: "text-orange-600", etiqueta: "Cambió" },
  Eliminación: { punto: "bg-red-500", texto: "text-red-600", etiqueta: "Eliminó" },
  Sistema: { punto: "bg-slate-400", texto: "text-slate-500", etiqueta: "Sistema" },
};

const POR_PAGINA = 150;

function diaDe(iso: string) {
  const d = new Date(iso);
  const hoy = new Date();
  const ayer = new Date();
  ayer.setDate(hoy.getDate() - 1);
  const mismo = (a: Date, b: Date) => a.toDateString() === b.toDateString();
  if (mismo(d, hoy)) return "Hoy";
  if (mismo(d, ayer)) return "Ayer";
  return d.toLocaleDateString("es-CO", { weekday: "long", day: "numeric", month: "long", year: "numeric" });
}

const horaDe = (iso: string) => new Date(iso).toLocaleTimeString("es-CO", { hour: "numeric", minute: "2-digit" });

export default function RegistroActividadPage() {
  const router = useRouter();
  const cliente = useSyncExternalStore(sinSuscripcion, () => true, () => false);
  const permitido = cliente && ajustesDesbloqueados();
  const version = useVersionDatos();
  const [recarga, setRecarga] = useState(0);
  const [filtro, setFiltro] = useState<Filtro>("todos");
  const [busqueda, setBusqueda] = useState("");
  const [limite, setLimite] = useState(POR_PAGINA);

  useEffect(() => {
    if (!ajustesDesbloqueados()) router.replace("/ajustes");
  }, [router]);

  // eslint-disable-next-line react-hooks/exhaustive-deps
  const log = useMemo<EntradaLog[]>(() => (cliente ? leerLog() : []), [cliente, version, recarga]);
  const q = busqueda.trim().toLowerCase();
  const filtrados = log.filter(
    (e) => (filtro === "todos" || e.accion === filtro) && (!q || `${e.detalle} ${e.modulo} ${e.usuario ?? ""} ${e.granja ?? ""}`.toLowerCase().includes(q)),
  );
  const visibles = filtrados.slice(0, limite);
  const cuenta = (a: AccionLog) => log.filter((e) => e.accion === a).length;

  // Agrupa por día manteniendo el orden (más reciente primero)
  const grupos: { dia: string; items: EntradaLog[] }[] = [];
  for (const e of visibles) {
    const dia = diaDe(e.fecha);
    const g = grupos[grupos.length - 1];
    if (g && g.dia === dia) g.items.push(e);
    else grupos.push({ dia, items: [e] });
  }

  const vaciar = async () => {
    if (!(await confirmar({ titulo: "Vaciar registro", mensaje: "Se borrará todo el registro de actividad de este teléfono. Los datos de la granja no cambian.", aceptar: "Vaciar", destructivo: true }))) return;
    vaciarLog();
    registrarLog([{ accion: "Sistema", modulo: "Registro", detalle: "Registro de actividad vaciado" }]);
    setRecarga((n) => n + 1);
  };

  const icono = (
    <svg viewBox="0 0 24 24" className="h-5 w-5" fill="none" stroke="currentColor" strokeWidth={1.8} strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d="M8 3h8a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2z" />
      <path d="M9.5 8h5M9.5 12h5M9.5 16h3" />
    </svg>
  );

  return (
    <ModuloPage titulo="Registro de actividad" subtitulo="Todo lo que se hace en la app" icono={icono} tono="slate" volverA="/ajustes/avanzados">
      {permitido && (
        <>
          <div className="relative">
            <svg viewBox="0 0 24 24" className="pointer-events-none absolute left-3.5 top-1/2 h-[18px] w-[18px] -translate-y-1/2 text-slate-400" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" aria-hidden="true">
              <circle cx="11" cy="11" r="7" />
              <path d="m20 20-3.5-3.5" />
            </svg>
            <input
              type="search"
              value={busqueda}
              onChange={(e) => {
                setBusqueda(e.target.value);
                setLimite(POR_PAGINA);
              }}
              placeholder="Buscar: cerda, lote, producto…"
              aria-label="Buscar en el registro"
              className="w-full rounded-2xl bg-slate-100 py-3 pl-10 pr-4 text-base text-slate-900 placeholder:text-slate-400 focus:bg-white focus:outline-none focus:ring-2 focus:ring-sky-600"
            />
          </div>

          <Chips<Filtro>
            opciones={[
              { valor: "todos", texto: `Todo (${log.length})` },
              { valor: "Creación", texto: `Creaciones (${cuenta("Creación")})` },
              { valor: "Modificación", texto: `Cambios (${cuenta("Modificación")})` },
              { valor: "Eliminación", texto: `Eliminaciones (${cuenta("Eliminación")})` },
            ]}
            valor={filtro}
            onChange={(v) => {
              setFiltro(v);
              setLimite(POR_PAGINA);
            }}
          />

          {grupos.length === 0 ? (
            <p className="rounded-2xl bg-white px-4 py-8 text-center text-sm text-slate-500 ring-1 ring-slate-200">
              {log.length === 0 ? "Aún no hay actividad registrada. Desde ahora se guardará todo lo que se cree, cambie o elimine." : "Nada coincide con la búsqueda."}
            </p>
          ) : (
            grupos.map((g) => (
              <section key={g.dia}>
                <h2 className="mb-1.5 px-1 text-[11px] font-semibold uppercase tracking-wider text-slate-400">{g.dia}</h2>
                <ul className="divide-y divide-slate-100 overflow-hidden rounded-2xl bg-white ring-1 ring-slate-200/80">
                  {g.items.map((e) => {
                    const est = ESTILO[e.accion] ?? ESTILO.Sistema;
                    return (
                      <li key={e.id} className="flex gap-3 px-3.5 py-2.5">
                        <span className={`mt-1.5 h-2 w-2 shrink-0 rounded-full ${est.punto}`} aria-hidden="true" />
                        <div className="min-w-0 flex-1">
                          <p className="text-sm leading-snug text-slate-800">{e.detalle}</p>
                          <p className="mt-0.5 text-[11px] text-slate-500">
                            <span className={`font-semibold ${est.texto}`}>{est.etiqueta}</span> · {e.modulo}
                            {e.usuario ? <> · <span className="font-medium text-slate-600">{e.usuario}</span></> : null}
                            {e.granja && e.granja !== "El Mirador" ? <> · {e.granja}</> : null}
                          </p>
                        </div>
                        <span className="shrink-0 pt-0.5 text-[11px] tabular-nums text-slate-400">{horaDe(e.fecha)}</span>
                      </li>
                    );
                  })}
                </ul>
              </section>
            ))
          )}

          {filtrados.length > limite && (
            <Boton variante="secundario" onClick={() => setLimite((n) => n + POR_PAGINA)} className="w-full">
              Ver más ({filtrados.length - limite})
            </Boton>
          )}

          {log.length > 0 && (
            <Boton variante="suave" onClick={vaciar} className="w-full text-rose-600">
              Vaciar registro
            </Boton>
          )}
        </>
      )}
    </ModuloPage>
  );
}
