/*
 * Consumo aproximado de alimento de las cerdas según unas reglas simples
 * (Ajustes ocultos → Consumo de cerdas). No es un control: solo una estimación.
 *  - Gestación (y cerdas vacías, en celo o sin registro): alimento de gestación.
 *  - Desde el día de cambio de la gestación (100 por defecto) hasta el parto:
 *    alimento de lactancia a la cantidad de pre-parto.
 *  - Del parto al destete: alimento de lactancia a la cantidad de lactancia.
 */

import { leerConfig } from "@/lib/config";
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

export function calcularConsumoCerdas(): { gestacion: ConsumoAlimentoCerdas; lactancia: ConsumoAlimentoCerdas; cerdas: number } {
  const reglas = leerConfig().consumoCerdas;
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
      if (dias >= reglas.diaCambio) preparto++;
      else gestantes++;
    } else vacias++;
  }

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
      { texto: "Vacías / en espera", cerdas: vacias, kgPorCerda: reglas.gestacion },
    ]),
    lactancia: armar(reglas.codigoLactancia, [
      { texto: `Pre-parto (día ${reglas.diaCambio} al parto)`, cerdas: preparto, kgPorCerda: reglas.preparto },
      { texto: "Lactancia (parto al destete)", cerdas: lactando, kgPorCerda: reglas.lactancia },
    ]),
  };
}
