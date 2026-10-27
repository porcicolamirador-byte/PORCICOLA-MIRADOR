/*
 * Consumo aproximado de alimento de las cerdas según unas reglas simples
 * (Ajustes ocultos → Consumo de cerdas). No es un control: solo una estimación.
 *  - Gestación (y cerdas vacías, en celo o sin registro): alimento de gestación.
 *  - Desde el día de cambio de la gestación (100 por defecto) hasta el parto:
 *    alimento de lactancia a la cantidad de pre-parto.
 *  - Del parto al destete: alimento de lactancia a la cantidad de lactancia.
 */

import { guardarConfig, leerConfig } from "@/lib/config";
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

/**
 * Cerdas en cada regla hoy, según el último registro de la cerda (el mismo
 * estado que muestra Gestación):
 *  - Parto → lactancia;
 *  - Inseminación con el día de cambio (100) cumplido → pre-parto (alimento de lactancia);
 *  - Baja → no come (no se cuenta);
 *  - cualquier otro estado (inseminación antes del día 100, celo, destete,
 *    aborto, tratamiento, evento o sin registros) → alimento de gestación.
 */
function contarCerdas(diaCambio: number) {
  const hoyIso = hoy();
  let gestantes = 0;
  let vacias = 0;
  let preparto = 0;
  let lactando = 0;
  for (const c of leerCerdas()) {
    const ultimo = leerHistorial(c.id)[0];
    // Dada de baja: ya no come, no se le descuenta alimento
    if (ultimo?.tipo === "Baja") continue;
    if (ultimo?.tipo === "Parto") lactando++;
    else if (ultimo?.tipo === "Inseminación") {
      if (diasEntre(ultimo.fecha, hoyIso) >= diaCambio) preparto++;
      else gestantes++;
    } else vacias++;
  }
  return { gestantes, vacias, preparto, lactando };
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
 * dupliquen. Nunca deja la existencia en negativo.
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
    const inventario = calcularInventario();
    const todos = leerProductos();
    const cambios = new Map<string, SalidaBodega>();

    const descontar = (codigo: string, prefijo: string, kgDia: number, nota: string) => {
      const productos = todos.filter((p) => codigoDe(p) === codigo && p.activo !== false);
      const producto = productos.find((p) => p.unidad === "bultos") ?? productos[0];
      if (!producto) return;
      const item = inventario.find((i) => i.producto.id === producto.id);
      if (!item || item.sinCompras) return;
      const deHoy = porId.get(prefijo + hoyIso);
      // Lo de hoy se vuelve a calcular: se devuelve lo que ya se había descontado hoy
      let disponible = item.disponible + (deHoy && deHoy.productoId === producto.id ? Number(deHoy.cantidad) || 0 : 0);
      const porDia = kgDia / factorKg(producto);
      for (let f = desde; f <= hoyIso; f = sumarDias(f, 1)) {
        const id = prefijo + f;
        const esHoy = f === hoyIso;
        if (!esHoy && porId.has(id)) continue;
        const cantidad = Math.round(Math.max(0, Math.min(porDia, disponible)) * 1000) / 1000;
        if (esHoy && deHoy) {
          if (Math.abs((Number(deHoy.cantidad) || 0) - cantidad) < 0.0005 && deHoy.nota === nota && deHoy.productoId === producto.id) return;
          cambios.set(id, { ...deHoy, productoId: producto.id, cantidad, nota });
          return;
        }
        if (cantidad <= 0) {
          if (esHoy) return;
          continue;
        }
        disponible -= cantidad;
        cambios.set(id, { id, productoId: producto.id, fecha: f, hora: "06:00", cantidad, nota });
      }
    };

    const cerdasG = cuenta.gestantes + cuenta.vacias;
    descontar(reglas.codigoGestacion, PREFIJOS_AUTO.gestacion, cerdasG * reglas.gestacion, `Consumo automático cerdas · ${cerdasG} × ${reglas.gestacion} kg`);
    const partes = [
      cuenta.preparto ? `${cuenta.preparto} pre-parto × ${reglas.preparto} kg` : "",
      cuenta.lactando ? `${cuenta.lactando} lactando × ${reglas.lactancia} kg` : "",
    ].filter(Boolean);
    descontar(
      reglas.codigoLactancia,
      PREFIJOS_AUTO.lactancia,
      cuenta.preparto * reglas.preparto + cuenta.lactando * reglas.lactancia,
      `Consumo automático lactancia · ${partes.join(" + ") || "sin cerdas"}`,
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

export function calcularConsumoCerdas(): { gestacion: ConsumoAlimentoCerdas; lactancia: ConsumoAlimentoCerdas; cerdas: number } {
  const reglas = leerConfig().consumoCerdas;
  const { gestantes, vacias, preparto, lactando } = contarCerdas(reglas.diaCambio);

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

  const armar = (codigo: string, grupos: { texto: string; cerdas: number; kgPorCerda: number }[]): ConsumoAlimentoCerdas => {
    const d = datosProducto(codigo);
    const lista = grupos.map((g) => ({ texto: g.texto, cerdas: g.cerdas, kg: g.cerdas * g.kgPorCerda }));
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

  return {
    cerdas: gestantes + vacias + preparto + lactando,
    gestacion: armar(reglas.codigoGestacion, [
      { texto: `Inseminadas (hasta el día ${reglas.diaCambio})`, cerdas: gestantes, kgPorCerda: reglas.gestacion },
      { texto: "Otros estados (celo, destete, tratamiento…)", cerdas: vacias, kgPorCerda: reglas.gestacion },
    ]),
    lactancia: armar(reglas.codigoLactancia, [
      { texto: `Pre-parto (día ${reglas.diaCambio} al parto)`, cerdas: preparto, kgPorCerda: reglas.preparto },
      { texto: "Lactancia (parto al destete)", cerdas: lactando, kgPorCerda: reglas.lactancia },
    ]),
  };
}
