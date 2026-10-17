/*
 * Motor de programación reproductiva: a partir del último evento de cada
 * cerda calcula qué sigue (inseminar, vigilar celo, confirmar gestación,
 * trasladar a maternidad, parto y destete).
 */
import { leerConfig } from "@/lib/config";
import {
  diasEntre,
  formatoFecha,
  leerAjustes,
  leerCerdas,
  leerHistorial,
  sumarDias,
  type CerdaDatos,
  type RegistroCerda,
} from "@/lib/datos";

/* ───────────── Parámetros del ciclo reproductivo (días) ───────────── */
export const REPETICION_CELO = [18, 24] as const; // revisar si vuelve a celo tras la IA
export const CONFIRMAR_GESTACION = [25, 35] as const;
export const ANTES_PARTO_MATERNIDAD = 7; // traslado a maternidad antes del parto
export const CELO_TRAS_DESTETE = [3, 7] as const;
export const VENTANA_IA_TRAS_CELO = 2; // días para inseminar después de detectar celo

export type Clase = "inseminar" | "vigilar" | "parto" | "maternidad" | "destete" | "confirmar" | "repeticion";

export interface Evento {
  cerdaId: string;
  nombre: string;
  clase: Clase;
  titulo: string;
  detalle: string;
  /** Fecha en que hay que actuar (YYYY-MM-DD) */
  fecha: string;
  /** Fin de la ventana, si es un rango */
  hasta?: string;
}

export const ESTILO: Record<Clase, { icono: string; fondo: string; texto: string }> = {
  inseminar: { icono: "💉", fondo: "bg-sky-100", texto: "text-sky-800" },
  vigilar: { icono: "🔥", fondo: "bg-amber-100", texto: "text-amber-800" },
  repeticion: { icono: "🔁", fondo: "bg-amber-100", texto: "text-amber-800" },
  confirmar: { icono: "✅", fondo: "bg-blue-100", texto: "text-blue-800" },
  maternidad: { icono: "🏠", fondo: "bg-violet-100", texto: "text-violet-800" },
  parto: { icono: "🐷", fondo: "bg-emerald-100", texto: "text-emerald-800" },
  destete: { icono: "🍼", fondo: "bg-orange-100", texto: "text-orange-800" },
};

const REPRO = ["Inseminación", "Confirmación de Gestación", "Parto", "Destete", "Celo", "Aborto"];

function nombreDe(c: CerdaDatos) {
  return typeof c.nombre === "string" && c.nombre.trim() ? `${c.id} · ${c.nombre}` : `Cerda ${c.id}`;
}

/** Motor: a partir del último evento reproductivo de cada cerda, calcula qué sigue */
export function calcularProgramacion(fechaHoy: string) {
  const { diasGestacion } = leerAjustes();
  const { desteteMin, desteteMax } = leerConfig();
  const eventos: Evento[] = [];

  for (const cerda of leerCerdas()) {
    const historial = [...leerHistorial(cerda.id)].sort((a, b) => (b.fecha || "").localeCompare(a.fecha || ""));
    const ultimo = historial[0];
    if (!ultimo || ["Baja", "Vendida", "Muerta"].includes(ultimo.tipo)) {
      if (!ultimo) {
        eventos.push({
          cerdaId: cerda.id,
          nombre: nombreDe(cerda),
          clase: "vigilar",
          titulo: "Sin registros",
          detalle: "Vigilar celo y registrar la primera inseminación",
          fecha: fechaHoy,
        });
      }
      continue;
    }
    const repro = historial.find((r) => REPRO.includes(r.tipo)) as RegistroCerda | undefined;
    if (!repro?.fecha) continue;
    const base = { cerdaId: cerda.id, nombre: nombreDe(cerda) };
    const f = repro.fecha;

    switch (repro.tipo) {
      case "Celo":
        eventos.push({
          ...base,
          clase: "inseminar",
          titulo: "Inseminar",
          detalle: `Celo detectado el ${formatoFecha(f)}`,
          fecha: f,
          hasta: sumarDias(f, VENTANA_IA_TRAS_CELO),
        });
        break;

      case "Destete":
      case "Aborto":
        eventos.push({
          ...base,
          clase: "vigilar",
          titulo: "Vigilar celo",
          detalle: `${repro.tipo} el ${formatoFecha(f)} · celo esperado`,
          fecha: sumarDias(f, CELO_TRAS_DESTETE[0]),
          hasta: sumarDias(f, CELO_TRAS_DESTETE[1]),
        });
        break;

      case "Inseminación":
      case "Confirmación de Gestación": {
        const ia = historial.find((r) => r.tipo === "Inseminación")?.fecha ?? f;
        const confirmada = repro.tipo === "Confirmación de Gestación";
        const parto = sumarDias(ia, diasGestacion);
        const diasIA = diasEntre(ia, fechaHoy);
        if (!confirmada && diasIA <= REPETICION_CELO[1]) {
          eventos.push({
            ...base,
            clase: "repeticion",
            titulo: "Revisar repetición de celo",
            detalle: `Inseminada el ${formatoFecha(ia)}`,
            fecha: sumarDias(ia, REPETICION_CELO[0]),
            hasta: sumarDias(ia, REPETICION_CELO[1]),
          });
        }
        if (!confirmada && diasIA <= CONFIRMAR_GESTACION[1] + 10) {
          eventos.push({
            ...base,
            clase: "confirmar",
            titulo: "Confirmar gestación",
            detalle: "Chequeo o ecografía",
            fecha: sumarDias(ia, CONFIRMAR_GESTACION[0]),
            hasta: sumarDias(ia, CONFIRMAR_GESTACION[1]),
          });
        }
        if (diasEntre(fechaHoy, parto) >= 0) eventos.push({
          ...base,
          clase: "maternidad",
          titulo: "Trasladar a maternidad",
          detalle: `Preparar corral · parto el ${formatoFecha(parto)}`,
          fecha: sumarDias(parto, -ANTES_PARTO_MATERNIDAD),
        });
        eventos.push({
          ...base,
          clase: "parto",
          titulo: "Parto estimado",
          detalle: `IA el ${formatoFecha(ia)} · día ${Math.max(0, diasIA)} de ${diasGestacion}`,
          fecha: parto,
        });
        break;
      }

      case "Parto":
        eventos.push({
          ...base,
          clase: "destete",
          titulo: "Destetar",
          detalle: `Parto el ${formatoFecha(f)}${repro.vivos != null ? ` · ${repro.vivos} vivos` : ""}`,
          fecha: sumarDias(f, desteteMin),
          hasta: sumarDias(f, desteteMax),
        });
        break;
    }
  }

  return eventos.sort((a, b) => a.fecha.localeCompare(b.fecha));
}
