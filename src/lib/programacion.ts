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
  estadoDeCerda,
  sumarDias,
  type CerdaDatos,
  type EstadoCerda,
  type RegistroCerda,
} from "@/lib/datos";

/* ───────────── Parámetros del ciclo reproductivo (días) ───────────── */
export const REPETICION_CELO = [18, 24] as const; // revisar si vuelve a celo tras la IA
export const CONFIRMAR_GESTACION = [25, 35] as const;
/** La cerda debe estar en paridera estos días antes del parto */
export const ANTES_PARTO_MATERNIDAD = 15;
/** Celo esperado entre estos días después del destete */
export const CELO_TRAS_DESTETE = [4, 8] as const;
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
  parto: { icono: "🐷", fondo: "bg-sky-100", texto: "text-sky-800" },
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
          titulo: "Entrar a paridera",
          detalle: `${ANTES_PARTO_MATERNIDAD} días antes del parto (${formatoFecha(parto)})`,
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

/* ═════════════════ Plan de inseminación y parideras ═════════════════ */

export interface VentanaIA {
  /** Ventana proyectada de inseminación */
  desde: string;
  hasta: string;
  /** Fecha recomendada (puede correrse si no hay paridera libre) */
  recomendada: string;
  /** Días que se corrió por falta de paridera (0 = sin cambio) */
  corrimiento: number;
  /** Si con el corrimiento máximo tampoco hay paridera */
  sinCupo: boolean;
  entradaParidera: string;
  parto: string;
  salidaParidera: string;
}

export interface TarjetaCerda {
  cerdaId: string;
  nombre: string;
  estado: EstadoCerda;
  /** Fecha del último registro de celo */
  ultimoCelo?: string;
  /** Último evento reproductivo */
  ultimoEvento?: { tipo: string; fecha: string };
  /** Qué sigue para esta cerda */
  accion: { icono: string; titulo: string; detalle: string; fecha?: string; hasta?: string };
  /** Proyección de inseminación (si aplica) */
  ia?: VentanaIA;
  /** Ocupación de paridera ya comprometida (gestante o lactante) */
  paridera?: { desde: string; hasta: string; parto: string };
  /** Orden: más cerca de inseminar primero */
  orden: number;
}

export interface ResumenMes {
  mes: string; // AAAA-MM
  inseminaciones: number;
  partos: number;
  /** Máximo de parideras ocupadas en algún día del mes */
  picoParideras: number;
}

export interface PlanProgramacion {
  tarjetas: TarjetaCerda[];
  parideras: number;
  ocupadasHoy: number;
  /** Partos (y por tanto inseminaciones efectivas) que caben al mes */
  capacidadMes: number;
  diasCicloParidera: number;
  meses: ResumenMes[];
}

const CORRIMIENTO_MAX = 60;

const mesDe = (f: string) => f.slice(0, 7);
function mesesDesde(fecha: string, n: number) {
  const [a, m] = fecha.split("-").map(Number);
  return Array.from({ length: n }, (_, i) => {
    const d = new Date(a, m - 1 + i, 1);
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
  });
}

/**
 * Plan: una tarjeta por cerda (con su último celo) y una proyección de
 * inseminación que respeta la cantidad de parideras: cada cerda ocupa una
 * paridera desde 15 días antes del parto hasta el fin de la ventana de destete.
 */
export function calcularPlan(fechaHoy: string): PlanProgramacion {
  const { diasGestacion } = leerAjustes();
  const { desteteMin, desteteMax, parideras } = leerConfig();
  const ocupacion: { desde: string; hasta: string }[] = [];
  const tarjetas: TarjetaCerda[] = [];
  const pendientes: { tarjeta: TarjetaCerda; desde: string; hasta: string }[] = [];

  const intervaloPorParto = (parto: string) => ({
    desde: sumarDias(parto, -ANTES_PARTO_MATERNIDAD),
    hasta: sumarDias(parto, desteteMax),
  });

  for (const cerda of leerCerdas()) {
    const historial = [...leerHistorial(cerda.id)].sort((a, b) => (b.fecha || "").localeCompare(a.fecha || ""));
    const estado = estadoDeCerda(historial);
    if (estado === "Fuera del hato") continue;
    const repro = historial.find((r) => REPRO.includes(r.tipo) && r.fecha);
    const ultimoCelo = historial.find((r) => r.tipo === "Celo" && r.fecha)?.fecha;
    const t: TarjetaCerda = {
      cerdaId: cerda.id,
      nombre: nombreDe(cerda),
      estado,
      ultimoCelo,
      ultimoEvento: repro ? { tipo: repro.tipo, fecha: repro.fecha } : undefined,
      accion: { icono: "👀", titulo: "Vigilar celo", detalle: "Sin registros reproductivos" },
      orden: 500,
    };
    const f = repro?.fecha ?? "";

    switch (repro?.tipo) {
      case "Celo": {
        const hasta = sumarDias(f, VENTANA_IA_TRAS_CELO);
        t.accion = { icono: "💉", titulo: "Inseminar", detalle: `En celo desde el ${formatoFecha(f)}`, fecha: f, hasta };
        pendientes.push({ tarjeta: t, desde: f, hasta });
        break;
      }
      case "Destete":
      case "Aborto": {
        const desde = sumarDias(f, CELO_TRAS_DESTETE[0]);
        const hasta = sumarDias(f, CELO_TRAS_DESTETE[1]);
        t.accion = {
          icono: "🔥",
          titulo: "Celo esperado",
          detalle: `${repro.tipo} el ${formatoFecha(f)} · día ${CELO_TRAS_DESTETE[0]} a ${CELO_TRAS_DESTETE[1]}`,
          fecha: desde,
          hasta,
        };
        pendientes.push({ tarjeta: t, desde, hasta });
        break;
      }
      case "Parto": {
        const destete = sumarDias(f, desteteMin);
        const salida = sumarDias(f, desteteMax);
        t.paridera = { desde: sumarDias(f, -ANTES_PARTO_MATERNIDAD), hasta: salida, parto: f };
        ocupacion.push({ desde: f, hasta: salida });
        t.accion = { icono: "🍼", titulo: "Destetar", detalle: `Parto el ${formatoFecha(f)}`, fecha: destete, hasta: salida };
        // Tras el destete: celo 4–8 días después
        const desde = sumarDias(destete, CELO_TRAS_DESTETE[0]);
        const hasta = sumarDias(salida, CELO_TRAS_DESTETE[1]);
        pendientes.push({ tarjeta: t, desde, hasta });
        break;
      }
      case "Inseminación":
      case "Confirmación de Gestación": {
        const ia = historial.find((r) => r.tipo === "Inseminación")?.fecha ?? f;
        const parto = sumarDias(ia, diasGestacion);
        const intervalo = intervaloPorParto(parto);
        t.paridera = { ...intervalo, parto };
        ocupacion.push(intervalo);
        const entra = diasEntre(fechaHoy, intervalo.desde);
        t.accion =
          entra > 0
            ? { icono: "🏠", titulo: "Entrar a paridera", detalle: `Parto estimado el ${formatoFecha(parto)}`, fecha: intervalo.desde }
            : { icono: "🐷", titulo: "Parto estimado", detalle: `En paridera desde el ${formatoFecha(intervalo.desde)}`, fecha: parto };
        t.orden = 1000 + Math.max(0, diasEntre(fechaHoy, parto));
        break;
      }
    }
    tarjetas.push(t);
  }

  // Cuántas parideras se usan cada día de un intervalo (máximo)
  const pico = (desde: string, hasta: string) => {
    let max = 0;
    for (let d = desde; d <= hasta; d = sumarDias(d, 1)) {
      let n = 0;
      for (const o of ocupacion) if (o.desde <= d && d <= o.hasta) n += 1;
      if (n > max) max = n;
    }
    return max;
  };

  // Asignación: las más cercanas a inseminación toman primero las parideras
  pendientes.sort((a, b) => a.desde.localeCompare(b.desde));
  for (const p of pendientes) {
    // Si la ventana ya empezó (o pasó sin registrar celo), se proyecta desde hoy
    const base = p.desde < fechaHoy ? fechaHoy : p.desde;
    let corrimiento = 0;
    let sinCupo = false;
    if (parideras > 0) {
      while (corrimiento <= CORRIMIENTO_MAX) {
        const parto = sumarDias(sumarDias(base, corrimiento), diasGestacion);
        const i = intervaloPorParto(parto);
        if (pico(i.desde, i.hasta) < parideras) break;
        corrimiento += 1;
      }
      if (corrimiento > CORRIMIENTO_MAX) {
        sinCupo = true;
        corrimiento = 0;
      }
    }
    const recomendada = sumarDias(base, corrimiento);
    const parto = sumarDias(recomendada, diasGestacion);
    const i = intervaloPorParto(parto);
    if (!sinCupo) ocupacion.push(i);
    p.tarjeta.ia = {
      desde: p.desde,
      hasta: p.hasta,
      recomendada,
      corrimiento,
      sinCupo,
      entradaParidera: i.desde,
      parto,
      salidaParidera: i.hasta,
    };
    p.tarjeta.orden = diasEntre(fechaHoy, recomendada);
  }

  tarjetas.sort((a, b) => a.orden - b.orden || a.cerdaId.localeCompare(b.cerdaId, "es", { numeric: true }));

  const meses = mesesDesde(fechaHoy, 4).map((mes) => {
    const ultimoDia = sumarDias(`${mesesDesde(`${mes}-01`, 2)[1]}-01`, -1);
    return {
      mes,
      inseminaciones: tarjetas.filter((t) => t.ia && !t.ia.sinCupo && mesDe(t.ia.recomendada) === mes).length,
      partos: tarjetas.filter(
        (t) => (t.paridera && mesDe(t.paridera.parto) === mes && t.estado === "Gestación") || (t.ia && !t.ia.sinCupo && mesDe(t.ia.parto) === mes),
      ).length,
      picoParideras: pico(`${mes}-01`, ultimoDia),
    };
  });

  const diasCicloParidera = ANTES_PARTO_MATERNIDAD + desteteMax;
  return {
    tarjetas,
    parideras,
    ocupadasHoy: ocupacion.filter((o) => o.desde <= fechaHoy && fechaHoy <= o.hasta).length,
    capacidadMes: parideras > 0 ? Math.floor((parideras * 30) / diasCicloParidera) : 0,
    diasCicloParidera,
    meses,
  };
}
