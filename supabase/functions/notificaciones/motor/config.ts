// Versión mínima de src/lib/config.ts para el servidor (días de destete)
const esDia = (v: unknown): v is number => typeof v === "number" && Number.isInteger(v) && v >= 1 && v <= 90;
export function leerConfig() {
  let c: { desteteMin?: unknown; desteteMax?: unknown } = {};
  try {
    c = JSON.parse(localStorage.getItem("config-granja") || "{}");
  } catch {
    // por defecto
  }
  const desteteMin = esDia(c.desteteMin) ? c.desteteMin : 21;
  const desteteMax = esDia(c.desteteMax) && c.desteteMax > desteteMin ? c.desteteMax : Math.max(desteteMin + 1, 28);
  return { desteteMin, desteteMax };
}
