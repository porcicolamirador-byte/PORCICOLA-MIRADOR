"use client";

import { useMemo, useState, type FormEvent } from "react";
import Modal from "@/components/Modal";
import { Boton, Campo, Entrada, IconoMas, Selector } from "@/components/ui";
import { confirmar } from "@/components/Dialogo";
import { guardarCorrales, leerCorrales, nuevoId, useVersionDatos, type Corral, type ZonaCorral } from "@/lib/datos";

export const ZONAS_CORRAL: { valor: ZonaCorral; icono: string; prefijo: string }[] = [
  { valor: "Gestación", icono: "🤰", prefijo: "G" },
  { valor: "Maternidad", icono: "🍼", prefijo: "M" },
  { valor: "Precebo", icono: "🐽", prefijo: "P" },
  { valor: "Engorde", icono: "🐖", prefijo: "E" },
  { valor: "Cuarentena", icono: "🩺", prefijo: "C" },
  { valor: "Otro", icono: "🏚️", prefijo: "O" },
];
const iconoZona = (z: ZonaCorral) => ZONAS_CORRAL.find((x) => x.valor === z)?.icono ?? "🏚️";

/** Siguiente código libre para una zona: G-01, G-02… */
function sugerirCodigo(zona: ZonaCorral, corrales: Corral[]) {
  const prefijo = ZONAS_CORRAL.find((z) => z.valor === zona)?.prefijo ?? "C";
  const usados = new Set(corrales.map((c) => c.codigo.toUpperCase()));
  for (let n = 1; n < 1000; n++) {
    const codigo = `${prefijo}-${String(n).padStart(2, "0")}`;
    if (!usados.has(codigo)) return codigo;
  }
  return `${prefijo}-`;
}

/** Lista de corrales en los ajustes ocultos: crear, editar y quitar */
export default function CatalogoCorrales() {
  const version = useVersionDatos();
  const [editando, setEditando] = useState<Corral | "nuevo" | null>(null);
  const corrales = useMemo(() => (version < 0 ? null : leerCorrales()), [version]);

  const grupos = ZONAS_CORRAL.map((z) => ({
    ...z,
    items: (corrales ?? [])
      .filter((c) => c.zona === z.valor)
      .sort((a, b) => a.codigo.localeCompare(b.codigo, "es", { numeric: true })),
  })).filter((g) => g.items.length);

  const quitar = async (c: Corral) => {
    if (!(await confirmar({ titulo: `Eliminar corral ${c.codigo}`, mensaje: "El corral se quitará de la lista.", aceptar: "Eliminar", destructivo: true }))) return;
    guardarCorrales(leerCorrales().filter((x) => x.id !== c.id));
  };

  return (
    <>
      <div className="mb-3 flex items-center gap-3">
        <p className="min-w-0 flex-1 text-xs leading-relaxed text-slate-500">Cada corral con su identificación y la zona a la que pertenece.</p>
        <Boton onClick={() => setEditando("nuevo")} className="shrink-0 px-3">
          <IconoMas /> Corral
        </Boton>
      </div>

      {corrales === null ? (
        <div className="h-20 animate-pulse rounded-2xl bg-slate-100" />
      ) : corrales.length === 0 ? (
        <p className="rounded-2xl border border-dashed border-slate-200 px-4 py-6 text-center text-sm text-slate-500">
          Aún no hay corrales. Crea el primero con su identificación, por ejemplo G-01.
        </p>
      ) : (
        <div className="flex flex-col gap-3">
          {grupos.map((g) => (
            <div key={g.valor}>
              <p className="mb-1 px-1 text-[11px] font-semibold uppercase tracking-wider text-slate-400">
                {g.icono} {g.valor} · {g.items.length}
              </p>
              <ul className="divide-y divide-slate-100 overflow-hidden rounded-2xl bg-white ring-1 ring-slate-100">
                {g.items.map((c) => (
                  <li key={c.id} className="flex items-center gap-3 px-3 py-2.5">
                    <span className="flex h-9 min-w-[3.25rem] shrink-0 items-center justify-center rounded-lg bg-emerald-50 px-2 text-sm font-bold tabular-nums text-emerald-800 ring-1 ring-emerald-100">
                      {c.codigo}
                    </span>
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-xs text-slate-600">
                        {c.capacidad ? `Capacidad ${c.capacidad}` : "Sin capacidad"}
                        {c.nota ? ` · ${c.nota}` : ""}
                      </p>
                    </div>
                    <button
                      type="button"
                      onClick={() => setEditando(c)}
                      className="shrink-0 rounded-full px-2.5 py-1 text-xs font-semibold text-emerald-700 active:bg-emerald-50"
                    >
                      Editar
                    </button>
                    <button
                      type="button"
                      onClick={() => quitar(c)}
                      className="shrink-0 rounded-full px-2 py-1 text-xs text-slate-400 active:bg-rose-50 active:text-rose-600"
                    >
                      Quitar
                    </button>
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </div>
      )}

      <FormCorral corral={editando} onCerrar={() => setEditando(null)} />
    </>
  );
}

function FormCorral({ corral, onCerrar }: { corral: Corral | "nuevo" | null; onCerrar: () => void }) {
  const [codigo, setCodigo] = useState("");
  const [zona, setZona] = useState<ZonaCorral>("Gestación");
  const [capacidad, setCapacidad] = useState("");
  const [nota, setNota] = useState("");
  const [tocado, setTocado] = useState(false);
  const [error, setError] = useState("");
  const [cargado, setCargado] = useState<Corral | "nuevo" | null>(null);

  if (corral !== cargado) {
    setCargado(corral);
    if (corral && corral !== "nuevo") {
      setCodigo(corral.codigo);
      setZona(corral.zona);
      setCapacidad(corral.capacidad ? String(corral.capacidad) : "");
      setNota(corral.nota ?? "");
      setTocado(true);
    } else if (corral === "nuevo") {
      setCodigo(sugerirCodigo("Gestación", leerCorrales()));
      setZona("Gestación");
      setCapacidad("");
      setNota("");
      setTocado(false);
    }
    setError("");
  }

  const cambiarZona = (z: ZonaCorral) => {
    setZona(z);
    // Mientras no escriba su propio código, se sugiere uno de la zona
    if (!tocado && corral === "nuevo") setCodigo(sugerirCodigo(z, leerCorrales()));
  };

  const guardar = (e: FormEvent) => {
    e.preventDefault();
    const limpio = codigo.trim().toUpperCase();
    if (!limpio) return setError("Escribe la identificación del corral.");
    const todos = leerCorrales();
    const id = corral && corral !== "nuevo" ? corral.id : null;
    if (todos.some((c) => c.codigo.toUpperCase() === limpio && c.id !== id)) return setError(`Ya existe el corral ${limpio}.`);
    const cap = Math.max(0, Math.round(Number(capacidad) || 0));
    const datos = { codigo: limpio, zona, capacidad: cap || undefined, nota: nota.trim() || undefined };
    guardarCorrales(id ? todos.map((c) => (c.id === id ? { ...c, ...datos } : c)) : [...todos, { id: nuevoId(), ...datos }]);
    onCerrar();
  };

  return (
    <Modal
      abierta={corral !== null}
      etiqueta="Corrales"
      titulo={corral === "nuevo" ? "Nuevo corral" : "Editar corral"}
      subtitulo={codigo.trim() ? codigo.trim().toUpperCase() : undefined}
      icono={iconoZona(zona)}
      onCerrar={onCerrar}
    >
      <form onSubmit={guardar} className="flex flex-col gap-3.5">
        <div className="grid grid-cols-2 gap-3">
          <Campo etiqueta="Identificación *">
            <Entrada
              value={codigo}
              onChange={(v) => {
                setCodigo(v.toUpperCase().slice(0, 12));
                setTocado(true);
                setError("");
              }}
              placeholder="G-01"
              required
            />
          </Campo>
          <Campo etiqueta="Zona">
            <Selector value={zona} onChange={(v) => cambiarZona(v as ZonaCorral)} opciones={ZONAS_CORRAL.map((z) => ({ valor: z.valor, texto: `${z.icono} ${z.valor}` }))} />
          </Campo>
        </div>
        <Campo etiqueta="Capacidad (animales)">
          <Entrada type="number" inputMode="numeric" min={0} value={capacidad} onChange={setCapacidad} placeholder="Opcional" />
        </Campo>
        <Campo etiqueta="Nota">
          <Entrada value={nota} onChange={setNota} placeholder="Opcional, p. ej. bebedero nuevo" />
        </Campo>
        {error && <p className="text-sm font-medium text-rose-600">{error}</p>}
        <Boton type="submit" className="mt-1 w-full py-3">
          Guardar corral
        </Boton>
      </form>
    </Modal>
  );
}
