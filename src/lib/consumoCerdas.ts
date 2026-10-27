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
  estadoDeCerda,
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

/** Cerdas en cada regla hoy */
function contarCerdas(diaCambio: number) {
  const hoyIso = hoy();
  let gestantes = 0;
  let vacias = 0;
  let preparto = 0;
  let lactando = 0;
  for (const c of leerCerdas()) {
    const historial = leerHistorial(c.id);
    const estado = estadoDeCerda(historial);
    if (estado === "Fuera del hato") continue;
    if (estado === "Lactancia") lactando++;
    else if (estado === "Gestación") {
      const ia = historial.find((h) => h.tipo === "Inseminación");
      const dias = ia ? diasEntre(ia.fecha, hoyIso) : 0;
      if (dias >= diaCambio) preparto++;
      else gestantes++;
    } else vacias++;
  }
  return { gestantes, vacias, preparto, lactando };
}

const PREFIJOS_AUTO = { gestacion: "auto-cg-", lactancia: "auto-cl-" } as const;
export const esSalidaAutomatica = (s: SalidaBodega) => s.id.startsWith("auto-cg-") || s.id.startsWith("auto-cl-");

/**
 * Descuenta de bodega, una vez por día, el alimento estimado de las cerdas:
 *  - gestación: cerdas gestantes y en otros estados × kg de gestación;
 *  - lactancia: pre-parto × kg de pre-parto + lactando × kg de lactancia.
 * Cada día tiene un id fijo por alimento para que varios teléfonos no lo
 * dupliquen. Si hubo días sin abrir la app se ponen al día (máximo 60).
 * Nunca deja la existencia en negativo.
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
    const existentes = new Set(salidas.map((s) => s.id));
    const desde = reglas.descuentoDesde > sumarDias(hoyIso, -59) ? reglas.descuentoDesde : sumarDias(hoyIso, -59);
    const faltan = (prefijo: string) => {
      const dias: string[] = [];
      for (let f = desde; f <= hoyIso; f = sumarDias(f, 1)) if (!existentes.has(prefijo + f)) dias.push(f);
      return dias;
    };
    const diasG = faltan(PREFIJOS_AUTO.gestacion);
    const diasL = faltan(PREFIJOS_AUTO.lactancia);
    if (diasG.length === 0 && diasL.length === 0) return;

    const cuenta = contarCerdas(reglas.diaCambio);
    const inventario = calcularInventario();
    const todos = leerProductos();
    const nuevas: SalidaBodega[] = [];

    const descontar = (codigo: string, prefijo: string, dias: string[], kgDia: number, nota: string) => {
      if (dias.length === 0 || kgDia <= 0) return;
      const productos = todos.filter((p) => codigoDe(p) === codigo && p.activo !== false);
      const producto = productos.find((p) => p.unidad === "bultos") ?? productos[0];
      if (!producto) return;
      const item = inventario.find((i) => i.producto.id === producto.id);
      if (!item || item.sinCompras) return;
      let disponible = item.disponible; // en la unidad del producto
      for (const f of dias) {
        const cantidad = Math.min(kgDia / factorKg(producto), disponible);
        if (cantidad <= 0.0001) break;
        disponible -= cantidad;
        nuevas.push({ id: prefijo + f, productoId: producto.id, fecha: f, hora: "06:00", cantidad: Math.round(cantidad * 1000) / 1000, nota });
      }
    };

    const cerdasG = cuenta.gestantes + cuenta.vacias;
    descontar(reglas.codigoGestacion, PREFIJOS_AUTO.gestacion, diasG, cerdasG * reglas.gestacion, `Consumo automático cerdas · ${cerdasG} × ${reglas.gestacion} kg`);
    const partes = [
      cuenta.preparto ? `${cuenta.preparto} pre-parto × ${reglas.preparto} kg` : "",
      cuenta.lactando ? `${cuenta.lactando} lactando × ${reglas.lactancia} kg` : "",
    ].filter(Boolean);
    descontar(
      reglas.codigoLactancia,
      PREFIJOS_AUTO.lactancia,
      diasL,
      cuenta.preparto * reglas.preparto + cuenta.lactando * reglas.lactancia,
      `Consumo automático lactancia · ${partes.join(" + ")}`,
    );
    if (nuevas.length) guardarSalidas([...salidas, ...nuevas]);
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
      { texto: `Gestación (hasta el día ${reglas.diaCambio})`, cerdas: gestantes, kgPorCerda: reglas.gestacion },
      { texto: "Vacías, en celo u otro estado", cerdas: vacias, kgPorCerda: reglas.gestacion },
    ]),
    lactancia: armar(reglas.codigoLactancia, [
      { texto: `Pre-parto (día ${reglas.diaCambio} al parto)`, cerdas: preparto, kgPorCerda: reglas.preparto },
      { texto: "Lactancia (parto al destete)", cerdas: lactando, kgPorCerda: reglas.lactancia },
    ]),
  };
}
