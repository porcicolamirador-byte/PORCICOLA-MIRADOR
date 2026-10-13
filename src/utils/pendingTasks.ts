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
}

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
  const hoy = new Date().toISOString().split('T')[0];
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

    if (diasDesdeInseminacion >= 25 && diasDesdeInseminacion <= 35) {
      tareas.push({
        id: cerda.id,
        tipo: 'Confirmación de gestación',
        prioridad: 'media',
        descripcion: 'Realizar chequeo o ecografía para confirmar gestación',
        dias: diasDesdeInseminacion,
        fecha: regInseminacion.fecha,
      });
    }

    if (diasDesdeInseminacion >= 18 && diasDesdeInseminacion <= 24 && !tieneParto && !tieneAborto && !tieneNuevaInseminacion) {
      tareas.push({
        id: cerda.id,
        tipo: 'Posible repetición de celo',
        prioridad: 'alta',
        descripcion: 'Verificar retorno a celo',
        dias: diasDesdeInseminacion,
        fecha: regInseminacion.fecha,
      });
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

    const confirmacionGestacion = historial.find((r) => r.tipo === 'Confirmación de Gestación');
    if (diasDesdeInseminacion > 35 && !confirmacionGestacion && !tieneParto) {
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

    if (diasDesdeParto >= 21 && diasDesdeParto <= 28) {
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
    if (diasDesdeDestete >= 3 && diasDesdeDestete <= 7) {
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
