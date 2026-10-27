import { leerConfig } from "@/lib/config";

export interface Registro {
  tipo?: string;
  fecha?: string;
}

export interface Cerda {
  id: string;
  [key: string]: unknown;
}

export interface PendingTask {
  id: string;
  tipo: string;
  prioridad: string;
  descripcion: string;
  dias: number;
  fecha?: string;
  /** Botón para resolver la tarea desde la lista (1.ª o 2.ª confirmación de gestación) */
  confirmar?: 1 | 2;
}

/** Ventanas para confirmar la gestación (días después de la inseminación) */
export const CONFIRMACIONES_GESTACION = [
  { etapa: 1 as const, desde: 18, hasta: 24 },
  { etapa: 2 as const, desde: 40, hasta: 44 },
];

export function calcularDiasEntre(fechaInicio: string, fechaFin: string) {
  const inicio = new Date(fechaInicio);
  const fin = new Date(fechaFin);
  const diff = fin.getTime() - inicio.getTime();
  return Math.floor(diff / (1000 * 60 * 60 * 24));
}

export function cargarCerdasDeStorage(): Cerda[] {
  if (typeof window === 'undefined') {
    return [];
  }

  const datos = JSON.parse(localStorage.getItem('cerdas') || '[]');
  return Array.isArray(datos) ? datos : [];
}

export function cargarHistorialDeCerda(cerdaId: string): Registro[] {
  if (typeof window === 'undefined') {
    return [];
  }

  const historial = JSON.parse(localStorage.getItem(`historial-${cerdaId}`) || '[]');
  return Array.isArray(historial) ? (historial as Registro[]) : [];
}

export function generarTareasPendientes(cerda: Cerda): PendingTask[] {
  const tareas: PendingTask[] = [];
  const d = new Date();
  const hoy = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
  const historial = cargarHistorialDeCerda(cerda.id);

  if (historial.length === 0) {
    return tareas;
  }

  const ultimoRegistro = historial[0];
  const diasDesdeUltimo = calcularDiasEntre(ultimoRegistro.fecha || hoy, hoy);

  if (['Baja', 'Vendida', 'Muerta'].includes(ultimoRegistro.tipo || '')) {
    return tareas;
  }

  const regInseminacion = historial.find((r) => r.tipo === 'Inseminación');
  const regParto = historial.find((r) => r.tipo === 'Parto');
  const regDestete = historial.find((r) => r.tipo === 'Destete');
  const regCelo = historial.find((r) => r.tipo === 'Celo');
  const regTratamiento = historial.find((r) => r.tipo === 'Tratamiento');
  const regVacunacion = historial.find((r) => r.tipo === 'Vacunación');
  const regDesparasitacion = historial.find((r) => r.tipo === 'Desparasitación');

  const tieneParto = historial.some((r) => r.tipo === 'Parto');
  const tieneAborto = historial.some((r) => r.tipo === 'Aborto');
  const tieneNuevaInseminacion = historial.filter((r) => r.tipo === 'Inseminación').length > 1;

  if (regInseminacion) {
    const diasDesdeInseminacion = calcularDiasEntre(regInseminacion.fecha || hoy, hoy);

    // Confirmación de gestación en dos momentos; al confirmar, la alerta desaparece
    const ia = regInseminacion as Registro & { confirmacion1?: string; confirmacion2?: string };
    const cerrada = historial.some((r) => ['Parto', 'Aborto'].includes(r.tipo || '') && (r.fecha || '') >= (ia.fecha || ''));
    const confirmacionAntigua = historial.some((r) => r.tipo === 'Confirmación de Gestación' && (r.fecha || '') >= (ia.fecha || ''));
    for (const c of CONFIRMACIONES_GESTACION) {
      const hecha = c.etapa === 1 ? ia.confirmacion1 : ia.confirmacion2;
      if (!cerrada && !hecha && !confirmacionAntigua && diasDesdeInseminacion >= c.desde && diasDesdeInseminacion <= c.hasta) {
        tareas.push({
          id: cerda.id,
          tipo: `${c.etapa}.ª confirmación de gestación`,
          prioridad: 'alta',
          descripcion: `Día ${c.desde}–${c.hasta}: confirmar que sigue gestante`,
          dias: diasDesdeInseminacion,
          fecha: regInseminacion.fecha,
          confirmar: c.etapa,
        });
      }
    }

    if (diasDesdeInseminacion >= 70 && diasDesdeInseminacion <= 90) {
      tareas.push({
        id: cerda.id,
        tipo: 'Desparasitación gestacional',
        prioridad: 'media',
        descripcion: 'Aplicar desparasitante durante la gestación',
        dias: diasDesdeInseminacion,
        fecha: regInseminacion.fecha,
      });
    }

    if (diasDesdeInseminacion >= 100 && diasDesdeInseminacion <= 109) {
      tareas.push({
        id: cerda.id,
        tipo: 'Monitoreo preparto',
        prioridad: 'alta',
        descripcion: 'Vigilar signos de proximidad al parto',
        dias: diasDesdeInseminacion,
        fecha: regInseminacion.fecha,
      });
    }

    if (diasDesdeInseminacion >= 105 && diasDesdeInseminacion <= 110) {
      tareas.push({
        id: cerda.id,
        tipo: 'Traslado a maternidad',
        prioridad: 'alta',
        descripcion: 'Preparar instalaciones para parto',
        dias: diasDesdeInseminacion,
        fecha: regInseminacion.fecha,
      });
    }

    if (diasDesdeInseminacion >= 110 && diasDesdeInseminacion <= 114) {
      tareas.push({
        id: cerda.id,
        tipo: 'Parto próximo',
        prioridad: 'critica',
        descripcion: 'Preparar maternidad y supervisión',
        dias: diasDesdeInseminacion,
        fecha: regInseminacion.fecha,
      });
    }

    if (diasDesdeInseminacion >= 115 && !tieneParto) {
      tareas.push({
        id: cerda.id,
        tipo: 'Parto retrasado',
        prioridad: 'critica',
        descripcion: 'Revisar inmediatamente - Gestación prolongada',
        dias: diasDesdeInseminacion,
        fecha: regInseminacion.fecha,
      });
    }

    // Pasó la ventana de la 2.ª confirmación sin confirmar
    if (diasDesdeInseminacion > 44 && !ia.confirmacion2 && !confirmacionAntigua && !cerrada) {
      tareas.push({
        id: cerda.id,
        tipo: 'Gestación sin confirmar',
        prioridad: 'alta',
        descripcion: 'Revisar estado reproductivo',
        dias: diasDesdeInseminacion,
        fecha: regInseminacion.fecha,
      });
    }
  }

  if (regParto) {
    const diasDesdeParto = calcularDiasEntre(regParto.fecha || hoy, hoy);

    if (diasDesdeParto >= 1 && diasDesdeParto <= 5) {
      tareas.push({
        id: cerda.id,
        tipo: 'Revisión postparto',
        prioridad: 'media',
        descripcion: 'Evaluar estado de la cerda y la camada',
        dias: diasDesdeParto,
        fecha: regParto.fecha,
      });
    }

    if (diasDesdeParto >= 10 && diasDesdeParto <= 14 && !historial.some((r) => r.tipo === 'Parvo-Lepto' && calcularDiasEntre(regParto.fecha || hoy, r.fecha || hoy) > 0)) {
      tareas.push({
        id: cerda.id,
        tipo: 'Vacuna Parvo-Lepto',
        prioridad: 'media',
        descripcion: 'Aplicar refuerzo reproductivo',
        dias: diasDesdeParto,
        fecha: regParto.fecha,
      });
    }

    const { desteteMin, desteteMax } = leerConfig();
    if (diasDesdeParto >= desteteMin && diasDesdeParto <= desteteMax) {
      tareas.push({
        id: cerda.id,
        tipo: 'Destete próximo',
        prioridad: 'media',
        descripcion: 'Programar destete de la camada',
        dias: diasDesdeParto,
        fecha: regParto.fecha,
      });
    }
  }

  if (regDestete) {
    const diasDesdeDestete = calcularDiasEntre(regDestete.fecha || hoy, hoy);
    if (diasDesdeDestete >= 4 && diasDesdeDestete <= 8) {
      tareas.push({
        id: cerda.id,
        tipo: 'Detección de celo',
        prioridad: 'alta',
        descripcion: 'Monitorear aparición de celo postdestete',
        dias: diasDesdeDestete,
        fecha: regDestete.fecha,
      });
    }
  }

  if (regCelo) {
    const diasDesdeCelo = calcularDiasEntre(regCelo.fecha || hoy, hoy);
    if (diasDesdeCelo >= 0 && diasDesdeCelo <= 10) {
      tareas.push({
        id: cerda.id,
        tipo: 'Inseminación pendiente',
        prioridad: 'alta',
        descripcion: 'Programar inseminación',
        dias: diasDesdeCelo,
        fecha: regCelo.fecha,
      });
    }
  }

  if (regTratamiento && diasDesdeUltimo <= 14) {
    tareas.push({
      id: cerda.id,
      tipo: 'Seguimiento sanitario',
      prioridad: 'media',
      descripcion: 'Verificar evolución del tratamiento',
      dias: diasDesdeUltimo,
      fecha: regTratamiento.fecha,
    });
  }

  if (regVacunacion) {
    const diasDesdeVacunacion = calcularDiasEntre(regVacunacion.fecha || hoy, hoy);
    if (diasDesdeVacunacion >= 180 && diasDesdeVacunacion <= 190) {
      tareas.push({
        id: cerda.id,
        tipo: 'Vacunación programada',
        prioridad: 'media',
        descripcion: 'Mantener plan sanitario vigente',
        dias: diasDesdeVacunacion,
        fecha: regVacunacion.fecha,
      });
    }
  }

  if (regDesparasitacion) {
    const diasDesdeDesparasitacion = calcularDiasEntre(regDesparasitacion.fecha || hoy, hoy);
    if (diasDesdeDesparasitacion >= 120 && diasDesdeDesparasitacion <= 130) {
      tareas.push({
        id: cerda.id,
        tipo: 'Desparasitación programada',
        prioridad: 'media',
        descripcion: 'Mantener control parasitario',
        dias: diasDesdeDesparasitacion,
        fecha: regDesparasitacion.fecha,
      });
    }
  }

  if (diasDesdeUltimo > 30 && diasDesdeUltimo <= 60) {
    tareas.push({
      id: cerda.id,
      tipo: 'Actualizar información',
      prioridad: 'baja',
      descripcion: 'No existen registros recientes',
      dias: diasDesdeUltimo,
      fecha: ultimoRegistro.fecha,
    });
  }

  if (diasDesdeUltimo > 60) {
    tareas.push({
      id: cerda.id,
      tipo: 'Revisar estado productivo',
      prioridad: 'media',
      descripcion: 'Verificar situación reproductiva',
      dias: diasDesdeUltimo,
      fecha: ultimoRegistro.fecha,
    });
  }

  const abortos = historial.filter((r) => r.tipo === 'Aborto');
  if (abortos.length >= 2) {
    const dos_ultimos = abortos.slice(0, 2);
    if (calcularDiasEntre(dos_ultimos[1].fecha || hoy, dos_ultimos[0].fecha || hoy) <= 180) {
      tareas.push({
        id: cerda.id,
        tipo: 'Evaluación reproductiva',
        prioridad: 'alta',
        descripcion: 'Múltiples abortos detectados - Revisar continuidad en el plantel',
        dias: 0,
        fecha: hoy,
      });
    }
  }

  const celos = historial.filter((r) => r.tipo === 'Celo');
  if (celos.length >= 3) {
    const tres_ultimos = celos.slice(0, 3);
    if (calcularDiasEntre(tres_ultimos[2].fecha || hoy, tres_ultimos[0].fecha || hoy) <= 90) {
      tareas.push({
        id: cerda.id,
        tipo: 'Evaluación reproductiva',
        prioridad: 'alta',
        descripcion: 'Repeticiones de celo consecutivas - Revisar continuidad en el plantel',
        dias: 0,
        fecha: hoy,
      });
    }
  }

  const tareasUnicas = tareas.filter((tarea, index, self) =>
    index === self.findIndex((item) => item.id === tarea.id && item.tipo === tarea.tipo)
  );

  return tareasUnicas;
}

export function calcularTareasPendientes(datos: Cerda[]) {
  return datos.flatMap((cerda) => generarTareasPendientes(cerda));
}

export function contarTareasPendientes(datos: Cerda[]) {
  return calcularTareasPendientes(datos).length;
}
