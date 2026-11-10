// Copia la lógica de alertas de la app (src/utils/pendingTasks.ts) a la función
// "notificaciones" de la nube. Correr cada vez que cambien las alertas:
//   node scripts/motor-alertas.mjs
// En la nube, "datos" y "config" son versiones mínimas (motor/datos.ts y motor/config.ts)
// con solo lo que usan las alertas.
import { readFileSync, writeFileSync } from "node:fs";
const s = readFileSync("src/utils/pendingTasks.ts", "utf8")
  .replace(/from "@\/lib\/datos"/g, 'from "./datos.ts"')
  .replace(/from "@\/lib\/config"/g, 'from "./config.ts"');
if (/from "@\//.test(s)) throw new Error("pendingTasks.ts importa algo nuevo: agrégalo a motor/");
writeFileSync("supabase/functions/notificaciones/motor/pendingTasks.ts", `// GENERADO desde src/utils/pendingTasks.ts por scripts/motor-alertas.mjs — no editar aquí\n${s}`);
console.log("Motor de alertas actualizado");
