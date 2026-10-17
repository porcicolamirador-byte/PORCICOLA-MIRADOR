"use client";

import { useRef, useState, type ChangeEvent } from "react";
import ModuloPage from "@/components/ModuloPage";
import { Boton, Tarjeta } from "@/components/ui";
import {
  clavesDeLaApp,
  hoy,
  leerCerdas,
  leerLotes,
  leerMovimientos,
  notificarCambio,
  useVersionDatos,
} from "@/lib/datos";
import { avisar as mostrarAviso, confirmar } from "@/components/Dialogo";

export default function AjustesPage() {
  const version = useVersionDatos();
  const cargado = version >= 0;
  const [mensaje, setMensaje] = useState("");
  const archivo = useRef<HTMLInputElement>(null);

  const resumen = cargado
    ? { cerdas: leerCerdas().length, lotes: leerLotes().length, movimientos: leerMovimientos().length }
    : null;

  const avisar = (texto: string) => {
    setMensaje(texto);
    window.setTimeout(() => setMensaje(""), 3000);
  };

  const exportar = () => {
    const datos: Record<string, unknown> = {};
    for (const k of clavesDeLaApp()) {
      try {
        datos[k] = JSON.parse(localStorage.getItem(k) || "null");
      } catch {
        datos[k] = localStorage.getItem(k);
      }
    }
    const blob = new Blob([JSON.stringify({ app: "porcicola-mirador", fecha: hoy(), datos }, null, 2)], {
      type: "application/json",
    });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `respaldo-el-mirador-${hoy()}.json`;
    document.body.appendChild(a);
    a.click();
    a.remove();
    URL.revokeObjectURL(url);
    avisar("Respaldo exportado");
  };

  const importar = async (e: ChangeEvent<HTMLInputElement>) => {
    const f = e.target.files?.[0];
    e.target.value = "";
    if (!f) return;
    try {
      const json = JSON.parse(await f.text()) as { app?: string; datos?: Record<string, unknown> };
      if (json.app !== "porcicola-mirador" || !json.datos) throw new Error("formato");
      if (!(await confirmar({ titulo: "Restaurar respaldo", mensaje: "Se reemplazarán los datos actuales por los del respaldo.", aceptar: "Restaurar", destructivo: true }))) return;
      for (const k of clavesDeLaApp()) localStorage.removeItem(k);
      for (const [k, v] of Object.entries(json.datos)) localStorage.setItem(k, JSON.stringify(v));
      notificarCambio();
      avisar("Respaldo restaurado");
    } catch {
      await mostrarAviso({ titulo: "Archivo no válido", mensaje: "El archivo no es un respaldo de El Mirador." });
    }
  };

  const borrarTodo = async () => {
    if (!(await confirmar({ titulo: "Borrar todos los datos", mensaje: "Se borrará toda la información de la granja guardada en este dispositivo.", aceptar: "Continuar", destructivo: true }))) return;
    if (!(await confirmar({ titulo: "¿Estás seguro?", mensaje: "Esta acción no se puede deshacer. Te recomendamos exportar un respaldo antes.", aceptar: "Borrar todo", destructivo: true }))) return;
    for (const k of clavesDeLaApp()) localStorage.removeItem(k);
    notificarCambio();
    avisar("Datos borrados");
  };

  return (
    <ModuloPage titulo="Ajustes" subtitulo="Respaldo de los datos" icono="⚙️" tono="slate">
      <Tarjeta titulo="Datos">
        <p className="mb-3 text-sm text-slate-500">
          Los datos se guardan solo en este dispositivo
          {resumen ? ` · ${resumen.cerdas} cerdas, ${resumen.lotes} lotes, ${resumen.movimientos} movimientos` : ""}.
          Exporta un respaldo con frecuencia.
        </p>
        <div className="grid grid-cols-2 gap-2">
          <Boton variante="secundario" onClick={exportar} disabled={!cargado}>Exportar respaldo</Boton>
          <Boton variante="secundario" onClick={() => archivo.current?.click()} disabled={!cargado}>Importar respaldo</Boton>
        </div>
        <input ref={archivo} type="file" accept="application/json,.json" onChange={importar} className="hidden" />
        <Boton variante="suave" onClick={borrarTodo} className="mt-2 w-full text-rose-600" disabled={!cargado}>
          Borrar todos los datos
        </Boton>
      </Tarjeta>

      <p className="text-center text-xs text-slate-400">Porcícola El Mirador · versión 2.0.0</p>

      {mensaje && (
        <div
          role="status"
          className="fixed left-1/2 z-50 -translate-x-1/2 rounded-full bg-slate-900 px-4 py-2 text-sm font-medium text-white shadow-lg"
          style={{ bottom: "calc(env(safe-area-inset-bottom) + 1.5rem)" }}
        >
          {mensaje}
        </div>
      )}
    </ModuloPage>
  );
}
