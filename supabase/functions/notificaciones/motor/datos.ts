// Versión mínima de src/lib/datos.ts para el servidor (solo lo que usan las alertas)
type Obj = { [k: string]: unknown };
const leer = <T>(clave: string, porDefecto: T): T => {
  try {
    const v = JSON.parse(localStorage.getItem(clave) ?? "null");
    return v ?? porDefecto;
  } catch {
    return porDefecto;
  }
};
interface Lote extends Obj {
  id: string;
  activo?: boolean;
  origen?: { codigoParto?: string };
  aplicaciones?: { tipo?: string }[];
}
export const leerCerdas = () => leer<({ id: string } & Obj)[]>("cerdas", []);
export const leerLotes = () => leer<Lote[]>("engorde-lotes", []);
export const loteDelParto = (codigoParto: string) => leerLotes().find((l) => l.origen?.codigoParto === codigoParto);
export const hierroAplicado = (l: Lote) => (l.aplicaciones ?? []).find((a) => a.tipo === "Hierro");
