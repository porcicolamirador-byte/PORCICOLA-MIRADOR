/*
 * Consumo aproximado de alimento de las cerdas según unas reglas simples
 * (Ajustes ocultos → Consumo de cerdas). No es un control: solo una estimación.
 *  - Gestación (y cerdas vacías, en celo o sin registro): alimento de gestación.
 *  - Desde el día de cambio de la gestación (100 por defecto) hasta el parto:
 *    alimento de lactancia a la cantidad de pre-parto.
 *  - Del parto al destete: alimento de lactancia a la cantidad de lactancia.
 */

import { guardarConfig, leerConfig } from "@/lib/config";
import { reemplazarClave } from "@/lib/sincronizar";
import {
  calcularInventario,
  codigoDe,
  diasEntre,
  factorKg,
  hoy,
  leerCerdas,
  leerHistorial,
  leerProductos,
  KG_POR_BULTO,
  guardarSalidas,
  leerSalidas,
  sumarDias,
  type SalidaBodega,
} from "@/lib/datos";

export interface ConsumoAlimentoCerdas {
  codigo: string;
  nombre: string;
  /** Kilos por día de todas las cerdas */
  kgDia: number;
  /** Existencia en bodega, en kilos (null si no hay producto con ese código) */
  existenciaKg: number | null;
  /** Días que alcanza la existencia (null si no hay consumo o producto) */
  dias: number | null;
  /** Kilos por bulto del producto (para mostrar en bultos) */
  kgBulto: number;
  grupos: { texto: string; cerdas: number; kg: number }[];
}

type Regla = "g" | "pre" | "lac" | "x";

/**
 * Regla de alimento de una cerda según su último registro (el estado que muestra Gestación):
 *  - Baja → no come ("x");
 *  - Parto → lactancia ("lac");
 *  - Inseminación con el día de cambio (100) cumplido → pre-parto ("pre", alimento de lactancia);
 *  - cualquier otro estado → alimento de gestación ("g").
 */
function reglaDe(historial: { tipo: string; fecha: string }[], diaCambio: number, hoyIso: string): Regla {
  const ultimo = historial[0];
  if (ultimo?.tipo === "Baja") return "x";
  if (ultimo?.tipo === "Parto") return "lac";
  if (ultimo?.tipo === "Inseminación") return diasEntre(ultimo.fecha, hoyIso) >= diaCambio ? "pre" : "g";
  return "g";
}

/*
 * Registro del día: qué comió cada cerda en cada comida.
 * Las cerdas comen dos veces (8 a. m. y 5 p. m.); cada comida es la mitad de la ración.
 *  - Si cambia de estado antes de las 5 p. m., la comida de la mañana queda con el estado
 *    anterior y la de la tarde con el nuevo (mitad y mitad).
 *  - Desde las 5 p. m. el día ya está comido: los cambios cuentan desde mañana.
 *  - Una cerda nueva antes de las 5 p. m. come solo la comida de la tarde; después, nada hoy.
 * Se sincroniza entre teléfonos (la última versión gana).
 */
const CLAVE_DIA = "consumo-cerdas-dia";
const HORA_CIERRE = 17;
interface RegistroDia {
  fecha: string;
  cerdas: Record<string, { am: Regla; pm: Regla }>;
}

function leerDia(): RegistroDia | null {
  try {
    const v = JSON.parse(localStorage.getItem(CLAVE_DIA) || "null") as RegistroDia | null;
    return v && typeof v.fecha === "string" && v.cerdas && typeof v.cerdas === "object" ? v : null;
  } catch {
    return null;
  }
}

/** Registro de hoy actualizado con el estado actual de las cerdas (y si cambió, se guarda) */
function registroDeHoy(diaCambio: number, guardar: boolean): RegistroDia {
  const hoyIso = hoy();
  const hora = new Date().getHours();
  const previo = leerDia();
  const actuales = new Map(leerCerdas().map((c) => [c.id, leerHistorial(c.id)] as const));
  let dia: RegistroDia;
  if (previo && previo.fecha === hoyIso) {
    dia = { fecha: hoyIso, cerdas: { ...previo.cerdas } };
  } else {
    // Día nuevo: cada cerda empieza con su estado; si hoy ya tiene un registro nuevo,
    // la mañana queda con lo que comía ayer en la tarde
    const ayer = previo && previo.fecha === sumarDias(hoyIso, -1) ? previo.cerdas : {};
    dia = { fecha: hoyIso, cerdas: {} };
    for (const [id, historial] of actuales) {
      const ahora = reglaDe(historial, diaCambio, hoyIso);
      const cambioHoy = historial[0]?.fecha === hoyIso;
      dia.cerdas[id] = { am: cambioHoy && ayer[id] ? ayer[id].pm : ahora, pm: ahora };
    }
  }
  if (hora < HORA_CIERRE) {
    for (const [id, historial] of actuales) {
      const ahora = reglaDe(historial, diaCambio, hoyIso);
      const e = dia.cerdas[id];
      if (!e) dia.cerdas[id] = { am: "x", pm: ahora }; // nueva hoy: solo la comida de la tarde
      else if (e.pm !== ahora) dia.cerdas[id] = { ...e, pm: ahora };
    }
    // Eliminada hoy: comió en la mañana, en la tarde ya no
    for (const id of Object.keys(dia.cerdas)) if (!actuales.has(id) && dia.cerdas[id].pm !== "x") dia.cerdas[id] = { ...dia.cerdas[id], pm: "x" };
  }
  if (guardar && JSON.stringify(dia) !== JSON.stringify(previo)) reemplazarClave(CLAVE_DIA, dia);
  return dia;
}

/** Kilos de hoy por regla, sumando media ración por cada comida */
function kilosDeHoy(dia: RegistroDia, reglas: { gestacion: number; preparto: number; lactancia: number }) {
  const kg: Record<Regla, number> = { g: 0, pre: 0, lac: 0, x: 0 };
  const cerdas: Record<Regla, number> = { g: 0, pre: 0, lac: 0, x: 0 };
  const racion: Record<Regla, number> = { g: reglas.gestacion, pre: reglas.preparto, lac: reglas.lactancia, x: 0 };
  // El conteo de cerdas es solo de las que existen ahora; los kilos sí incluyen
  // lo que ya comió hoy una cerda eliminada
  const existentes = new Set(leerCerdas().map((c) => c.id));
  let eliminadas = 0;
  for (const [id, e] of Object.entries(dia.cerdas)) {
    kg[e.am] += racion[e.am] / 2;
    kg[e.pm] += racion[e.pm] / 2;
    if (!existentes.has(id)) {
      if (e.am !== "x" || e.pm !== "x") eliminadas++;
      continue;
    }
    // Cuenta en la regla de su estado actual (o la de la mañana si ya no come)
    cerdas[e.pm !== "x" ? e.pm : e.am]++;
  }
  return { kg, cerdas, eliminadas };
}

/** Cerdas en cada regla hoy (día completo, para los días anteriores que faltan) */
function contarCerdas(diaCambio: number) {
  const hoyIso = hoy();
  const n: Record<Regla, number> = { g: 0, pre: 0, lac: 0, x: 0 };
  for (const c of leerCerdas()) n[reglaDe(leerHistorial(c.id), diaCambio, hoyIso)]++;
  return { gestacion: n.g, preparto: n.pre, lactando: n.lac };
}

/** Lo que tocaba descontar ese día: el plan guardado o, en salidas antiguas, los kg de la nota */
function planDe(s: SalidaBodega, kgPorUnidad: number): number | null {
  if (typeof s.plan === "number") return s.plan;
  const m = / · ([\d.,]+) kg hoy$/.exec(s.nota ?? "");
  if (!m) return null;
  const kg = Number(m[1].replace(",", "."));
  return Number.isFinite(kg) && kg > 0 ? Math.round((kg / kgPorUnidad) * 1000) / 1000 : null;
}

const PREFIJOS_AUTO = { gestacion: "auto-cg-", lactancia: "auto-cl-" } as const;
export const esSalidaAutomatica = (s: SalidaBodega) => s.id.startsWith("auto-cg-") || s.id.startsWith("auto-cl-");

/**
 * Descuenta de bodega el alimento estimado de las cerdas:
 *  - gestación: cerdas gestantes y en otros estados × kg de gestación;
 *  - lactancia: pre-parto × kg de pre-parto + lactando × kg de lactancia.
 * La salida de HOY se recalcula en cuanto cambia algo (se crea una cerda,
 * se registra un parto…), así el descuento es inmediato. Los días pasados ya
 * no cambian; si hubo días sin abrir la app se ponen al día (máximo 60).
 * Cada día tiene un id fijo por alimento para que varios teléfonos no lo
 * dupliquen. Descuenta completo aunque la existencia quede en negativo; los días
 * que quedaron cortos se completan cuando entra alimento (p. ej. una factura de fecha anterior).
 */
export function aplicarDescuentoCerdas() {
  if (typeof window === "undefined") return;
  try {
    const reglas = leerConfig().consumoCerdas;
    if (!reglas.descontarGestacion) return;
    const hoyIso = hoy();
    if (!reglas.descuentoDesde) {
      guardarConfig({ consumoCerdas: { ...reglas, descuentoDesde: hoyIso } });
      reglas.descuentoDesde = hoyIso;
    }
    const salidas = leerSalidas();
    const porId = new Map(salidas.map((s) => [s.id, s]));
    const desde = reglas.descuentoDesde > sumarDias(hoyIso, -59) ? reglas.descuentoDesde : sumarDias(hoyIso, -59);

    const cuenta = contarCerdas(reglas.diaCambio);
    const hoyDia = kilosDeHoy(registroDeHoy(reglas.diaCambio, true), reglas);
    const inventario = calcularInventario();
    const todos = leerProductos();
    const cambios = new Map<string, SalidaBodega>();
    const kgTexto = (n: number) => `${Math.round(n * 10) / 10} kg`;

    const descontar = (codigo: string, prefijo: string, kgDia: number, kgHoy: number, nota: string) => {
      const productos = todos.filter((p) => codigoDe(p) === codigo && p.activo !== false);
      const producto = productos.find((p) => p.unidad === "bultos") ?? productos[0];
      if (!producto) return;
      const item = inventario.find((i) => i.producto.id === producto.id);
      // Sin ninguna compra todavía no se descuenta: al ingresar la primera factura se ponen al día los días que faltan
      if (!item || item.sinCompras) return;
      const porDia = Math.round((kgDia / factorKg(producto)) * 1000) / 1000;
      const deHoyKg = Math.round((kgHoy / factorKg(producto)) * 1000) / 1000;
      for (let f = desde; f <= hoyIso; f = sumarDias(f, 1)) {
        const id = prefijo + f;
        const esHoy = f === hoyIso;
        const previa = porId.get(id);
        if (!esHoy && previa) {
          // Día pasado que quedó corto porque no había existencia: se completa lo que tocaba
          const plan = planDe(previa, factorKg(producto));
          if (plan !== null && (Number(previa.cantidad) || 0) < plan - 0.0005) cambios.set(id, { ...previa, cantidad: plan, plan });
          continue;
        }
        // Se descuenta completo aunque la existencia quede en negativo: al ingresar la factura (aunque sea de fecha anterior) se compensa
        const cantidad = esHoy ? deHoyKg : porDia;
        if (esHoy && previa) {
          if (Math.abs((Number(previa.cantidad) || 0) - cantidad) < 0.0005 && previa.nota === nota && previa.productoId === producto.id) return;
          cambios.set(id, { ...previa, productoId: producto.id, cantidad, plan: cantidad, nota });
          return;
        }
        if (cantidad <= 0) continue;
        cambios.set(id, { id, productoId: producto.id, fecha: f, hora: "06:00", cantidad, plan: cantidad, nota: esHoy ? nota : `${nota.replace(/ · [\d.,]+ kg hoy$/, "")} · ${kgTexto(kgDia)}` });
      }
    };

    descontar(
      reglas.codigoGestacion,
      PREFIJOS_AUTO.gestacion,
      cuenta.gestacion * reglas.gestacion,
      hoyDia.kg.g,
      `Consumo automático cerdas · ${hoyDia.cerdas.g} cerdas · ${kgTexto(hoyDia.kg.g)} hoy`,
    );
    descontar(
      reglas.codigoLactancia,
      PREFIJOS_AUTO.lactancia,
      cuenta.preparto * reglas.preparto + cuenta.lactando * reglas.lactancia,
      hoyDia.kg.pre + hoyDia.kg.lac,
      `Consumo automático lactancia · ${hoyDia.cerdas.pre} pre-parto + ${hoyDia.cerdas.lac} lactando · ${kgTexto(hoyDia.kg.pre + hoyDia.kg.lac)} hoy`,
    );
    if (cambios.size === 0) return;
    // La de hoy se actualiza (aunque quede en 0) en vez de borrarse: borrar exige permiso
    const lista = salidas.map((s) => cambios.get(s.id) ?? s);
    for (const [id, s] of cambios) if (!porId.has(id) && s.cantidad > 0) lista.push(s);
    guardarSalidas(lista);
  } catch {
    // es solo una estimación: si algo falla no se descuenta
  }
}

export function calcularConsumoCerdas(): { gestacion: ConsumoAlimentoCerdas; lactancia: ConsumoAlimentoCerdas; cerdas: number; eliminadasHoy: number } {
  const reglas = leerConfig().consumoCerdas;
  const hoyDia = kilosDeHoy(registroDeHoy(reglas.diaCambio, false), reglas);

  const productos = leerProductos();
  const inventario = calcularInventario();
  const datosProducto = (codigo: string) => {
    const conCodigo = productos.filter((p) => codigoDe(p) === codigo);
    const principal = conCodigo.find((p) => p.unidad === "bultos") ?? conCodigo[0];
    const item = principal ? inventario.find((i) => i.producto.id === principal.id) : undefined;
    return {
      nombre: principal?.nombre ?? "Sin producto en bodega",
      existenciaKg: item ? Math.max(0, item.disponible) * factorKg(item.producto) : null,
      kgBulto: principal?.unidad === "bultos" ? factorKg(principal) : KG_POR_BULTO,
    };
  };

  const armar = (codigo: string, grupos: { texto: string; cerdas: number; kg: number }[]): ConsumoAlimentoCerdas => {
    const d = datosProducto(codigo);
    const lista = grupos.map((g) => ({ texto: g.texto, cerdas: g.cerdas, kg: g.kg }));
    const kgDia = lista.reduce((s, g) => s + g.kg, 0);
    return {
      codigo,
      nombre: d.nombre,
      kgDia,
      existenciaKg: d.existenciaKg,
      dias: d.existenciaKg !== null && kgDia > 0 ? Math.floor(d.existenciaKg / kgDia) : null,
      kgBulto: d.kgBulto,
      grupos: lista,
    };
  };

  // Al día, al mes y cuánto alcanza: con las cerdas que hay ahora y su estado actual
  // (lo de hoy de una cerda eliminada o dada de baja ya no cuenta para lo que viene)
  const n = contarCerdas(reglas.diaCambio);
  return {
    cerdas: n.gestacion + n.preparto + n.lactando,
    eliminadasHoy: hoyDia.eliminadas,
    gestacion: armar(reglas.codigoGestacion, [
      { texto: "Gestación y otros estados", cerdas: n.gestacion, kg: n.gestacion * reglas.gestacion },
    ]),
    lactancia: armar(reglas.codigoLactancia, [
      { texto: `Pre-parto (día ${reglas.diaCambio} al parto)`, cerdas: n.preparto, kg: n.preparto * reglas.preparto },
      { texto: "Lactancia (parto al destete)", cerdas: n.lactando, kg: n.lactando * reglas.lactancia },
    ]),
  };
}
