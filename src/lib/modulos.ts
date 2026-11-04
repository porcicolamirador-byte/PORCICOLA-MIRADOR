/*
 * Módulos del Dashboard que el administrador puede activar o desactivar por usuario
 * (por ejemplo, los que aún están en desarrollo). Por defecto todos están activos:
 * en el perfil se guardan solo los desactivados (modulos_ocultos).
 */
"use client";

import { useEffect, useState } from "react";
import { EVENTO_SESION, perfilGuardado, type PerfilNube } from "@/lib/nube";

export const MODULOS_DASHBOARD = [
  { nombre: "Gestación", ruta: "/gestacion" },
  { nombre: "Engorde", ruta: "/engorde" },
  { nombre: "Monitoreo", ruta: "/monitoreo" },
  { nombre: "Tratamientos", ruta: "/tratamientos" },
  { nombre: "Bodega", ruta: "/bodega" },
  { nombre: "Bioseguridad", ruta: "/bioseguridad" },
  { nombre: "Indicadores", ruta: "/indicadores" },
  { nombre: "Contabilidad", ruta: "/contabilidad" },
  { nombre: "Jaula", ruta: "/jaula" },
  { nombre: "Programación", ruta: "/programacion" },
] as const;

/** Rutas desactivadas para el usuario de este teléfono */
export function modulosOcultos(perfil: PerfilNube | null = perfilGuardado()): string[] {
  return Array.isArray(perfil?.modulos_ocultos) ? perfil!.modulos_ocultos! : [];
}

/** Lista de rutas ocultas, actualizada cuando cambia el perfil (al entrar o al sincronizar) */
export function useModulosOcultos(): string[] {
  const [ocultos, setOcultos] = useState<string[]>([]);
  useEffect(() => {
    const leer = () => setOcultos(modulosOcultos());
    leer();
    window.addEventListener(EVENTO_SESION, leer);
    return () => window.removeEventListener(EVENTO_SESION, leer);
  }, []);
  return ocultos;
}
