"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import ModuloPage from "@/components/ModuloPage";
import { Boton, Tarjeta } from "@/components/ui";
import { ajustesDesbloqueados, bloquearAjustes } from "@/lib/acceso";

/**
 * Sección oculta de ajustes: solo se abre después de ingresar el código
 * en Ajustes. Sin código válido, regresa a Ajustes.
 */
export default function AjustesAvanzadosPage() {
  const router = useRouter();
  const [permitido, setPermitido] = useState<boolean | null>(null);

  useEffect(() => {
    const ok = ajustesDesbloqueados();
    setPermitido(ok);
    if (!ok) router.replace("/ajustes");
  }, [router]);

  const bloquear = () => {
    bloquearAjustes();
    router.replace("/ajustes");
  };

  if (!permitido) {
    return (
      <ModuloPage titulo="Ajustes" subtitulo="Sección protegida" icono="🔒" tono="slate" volverA="/ajustes">
        <div className="h-40 animate-pulse rounded-3xl bg-slate-100" />
      </ModuloPage>
    );
  }

  return (
    <ModuloPage
      titulo="Ajustes avanzados"
      subtitulo="Sección protegida con código"
      icono="🔓"
      tono="slate"
      volverA="/ajustes"
      accion={
        <Boton variante="secundario" onClick={bloquear} className="px-3.5">
          Bloquear
        </Boton>
      }
    >
      <Tarjeta titulo="Opciones">
        <p className="text-sm text-slate-500">
          Esta sección está lista. Aquí irán los ajustes que se puedan cambiar solo con el código.
        </p>
      </Tarjeta>

      <p className="px-1 text-center text-[11px] text-slate-400">
        La sección se cierra sola a los 15 minutos o al cerrar la app.
      </p>
    </ModuloPage>
  );
}
