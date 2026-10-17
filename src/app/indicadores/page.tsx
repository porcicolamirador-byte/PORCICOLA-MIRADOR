"use client";

import { useMemo, type ReactNode } from "react";
import ModuloPage from "@/components/ModuloPage";
import { Dato, Tarjeta } from "@/components/ui";
import { BarrasHorizontales, BarrasVerticales } from "@/components/Graficas";
import {
  diasEntre,
  estadoDeCerda,
  formatoPesos,
  hoy,
  leerCerdas,
  leerHistorial,
  leerLotes,
  leerMovimientos,
  sumarDias,
  useVersionDatos,
  type EstadoCerda,
  type RegistroCerda,
} from "@/lib/datos";

const ESTADOS: { estado: EstadoCerda; color: string }[] = [
  { estado: "Gestación", color: "#2a78d6" },
  { estado: "Lactancia", color: "#eb6834" },
  { estado: "Vacía", color: "#1baf7a" },
  { estado: "En celo", color: "#d94f8a" },
  { estado: "En tratamiento", color: "#eda100" },
  { estado: "Sin registro", color: "#94a3b8" },
];

const AZUL = "#2a78d6";
const NARANJA = "#eb6834";
const MESES_CORTOS = ["Ene", "Feb", "Mar", "Abr", "May", "Jun", "Jul", "Ago", "Sep", "Oct", "Nov", "Dic"];
const MESES_LARGOS = ["Enero", "Febrero", "Marzo", "Abril", "Mayo", "Junio", "Julio", "Agosto", "Septiembre", "Octubre", "Noviembre", "Diciembre"];

/** Últimos n meses ("AAAA-MM"), del más antiguo al actual */
function ultimosMeses(fecha: string, n: number): string[] {
  const [a, m] = fecha.split("-").map(Number);
  return Array.from({ length: n }, (_, i) => {
    const d = new Date(a, m - 1 - (n - 1 - i), 1);
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
  });
}
const etiquetaMes = (mes: string) => MESES_CORTOS[Number(mes.slice(5, 7)) - 1];
const detalleMes = (mes: string) => `${MESES_LARGOS[Number(mes.slice(5, 7)) - 1]} ${mes.slice(0, 4)}`;

const pesosCompactos = (n: number) =>
  n >= 1_000_000
    ? `$${(n / 1_000_000).toLocaleString("es-CO", { maximumFractionDigits: 1 })} M`
    : n >= 1000
      ? `$${Math.round(n / 1000).toLocaleString("es-CO")} mil`
      : `$${Math.round(n).toLocaleString("es-CO")}`;

const uno = (n: number) => (Number.isFinite(n) ? n.toFixed(1) : "–");

export default function IndicadoresPage() {
  const version = useVersionDatos();

  const ind = useMemo(() => {
    if (version < 0) return null;
    const fecha = hoy();
    const desde = sumarDias(fecha, -365);
    const enAnio = (r: RegistroCerda) => !!r.fecha && r.fecha >= desde && r.fecha <= fecha;

    const conteo = Object.fromEntries(ESTADOS.map((e) => [e.estado, 0])) as Record<EstadoCerda, number>;
    let activas = 0;
    let partos = 0;
    let vivos = 0;
    let muertos = 0;
    let destetados = 0;
    let destetes = 0;
    let inseminaciones = 0;
    let abortos = 0;
    const intervalos: number[] = [];
    const meses = ultimosMeses(fecha, 6);
    const porMes = () => Object.fromEntries(meses.map((m) => [m, 0])) as Record<string, number>;
    const partosMes = porMes();
    const vivosMes = porMes();
    const destetadosMes = porMes();
    const insemMes = porMes();
    const sumar = (t: Record<string, number>, f: string, v: number) => {
      const k = f.slice(0, 7);
      if (k in t) t[k] += v;
    };

    for (const cerda of leerCerdas()) {
      const h = leerHistorial(cerda.id);
      const estado = estadoDeCerda(h);
      if (estado !== "Fuera del hato") {
        activas += 1;
        if (estado in conteo) conteo[estado] += 1;
      }
      const anio = h.filter(enAnio);
      for (const r of h) {
        if (!r.fecha) continue;
        if (r.tipo === "Parto") {
          sumar(partosMes, r.fecha, 1);
          sumar(vivosMes, r.fecha, Number(r.vivos) || 0);
        } else if (r.tipo === "Destete") sumar(destetadosMes, r.fecha, Number(r.destetados) || 0);
        else if (r.tipo === "Inseminación") sumar(insemMes, r.fecha, 1);
      }
      for (const r of anio) {
        if (r.tipo === "Parto") {
          partos += 1;
          vivos += Number(r.vivos) || 0;
          muertos += (Number(r.muertos) || 0) + (Number(r.momias) || 0);
        } else if (r.tipo === "Destete") {
          destetes += 1;
          destetados += Number(r.destetados) || 0;
        } else if (r.tipo === "Inseminación") inseminaciones += 1;
        else if (r.tipo === "Aborto") abortos += 1;
      }
      // Intervalo destete → celo / inseminación (historial está del más reciente al más antiguo)
      const cronologico = [...anio].reverse();
      cronologico.forEach((r, i) => {
        if (r.tipo !== "Destete") return;
        const siguiente = cronologico.slice(i + 1).find((x) => x.tipo === "Celo" || x.tipo === "Inseminación");
        if (siguiente) {
          const d = diasEntre(r.fecha, siguiente.fecha);
          if (d >= 0 && d <= 60) intervalos.push(d);
        }
      });
    }

    const lotes = leerLotes();
    const activos = lotes.filter((l) => l.activo);
    let gdpSuma = 0;
    let gdpN = 0;
    let iniciales = 0;
    let muertes = 0;
    for (const l of lotes) {
      iniciales += l.cantidadInicial;
      muertes += l.mortalidad.reduce((s, m) => s + (Number(m.cantidad) || 0), 0);
      const ultimo = [...l.pesajes].sort((a, b) => b.fecha.localeCompare(a.fecha))[0];
      if (ultimo && l.pesoInicial) {
        const dias = Math.max(1, diasEntre(l.fechaIngreso, ultimo.fecha));
        gdpSuma += ((ultimo.pesoPromedio - l.pesoInicial) / dias) * 1000 * l.vivos;
        gdpN += l.vivos;
      }
    }

    const mes = fecha.slice(0, 7);
    const todos = leerMovimientos();
    const ingresosMes = porMes();
    const gastosMes = porMes();
    for (const m of todos) sumar(m.tipo === "ingreso" ? ingresosMes : gastosMes, m.fecha ?? "", Number(m.monto) || 0);
    const movs = todos.filter((m) => m.fecha.slice(0, 7) === mes);
    const ingresos = movs.filter((m) => m.tipo === "ingreso").reduce((s, m) => s + m.monto, 0);
    const gastos = movs.filter((m) => m.tipo === "gasto").reduce((s, m) => s + m.monto, 0);

    const grupo = (...tablas: Record<string, number>[]) =>
      meses.map((m) => ({ etiqueta: etiquetaMes(m), detalle: detalleMes(m), valores: tablas.map((t) => t[m]) }));

    const pesoActual = (l: (typeof lotes)[number]) =>
      [...l.pesajes].sort((a, b) => b.fecha.localeCompare(a.fecha))[0]?.pesoPromedio ?? l.pesoInicial;

    return {
      graficaPartos: grupo(partosMes, insemMes),
      graficaLechones: grupo(vivosMes, destetadosMes),
      graficaEconomia: grupo(ingresosMes, gastosMes),
      lotesGrafica: activos.map((l) => ({ nombre: l.nombre, vivos: l.vivos, peso: pesoActual(l) || 0 })),
      activas,
      conteo,
      partos,
      vivosPorParto: partos ? vivos / partos : NaN,
      muertosPorParto: partos ? muertos / partos : NaN,
      destetadosPorCamada: destetes ? destetados / destetes : NaN,
      mortalidadPredestete: vivos && destetes ? Math.max(0, ((vivos - destetados) / vivos) * 100) : NaN,
      tasaParto: inseminaciones ? Math.min(100, (partos / inseminaciones) * 100) : NaN,
      abortos,
      intervaloDesteteCelo: intervalos.length ? intervalos.reduce((a, b) => a + b, 0) / intervalos.length : NaN,
      lotesActivos: activos.length,
      animalesEngorde: activos.reduce((s, l) => s + l.vivos, 0),
      gdp: gdpN ? gdpSuma / gdpN : NaN,
      mortalidadEngorde: iniciales ? (muertes / iniciales) * 100 : NaN,
      ingresos,
      gastos,
    };
  }, [version]);

  return (
    <ModuloPage titulo="Indicadores" subtitulo="Rendimiento productivo · últimos 12 meses" icono="📊" tono="violet">
      {ind === null ? (
        <div className="h-60 animate-pulse rounded-3xl bg-slate-100" />
      ) : (
        <>
          <Tarjeta titulo="Estado del hato" accion={<span className="text-sm text-slate-500">{ind.activas} cerdas</span>}>
            {ind.activas === 0 ? (
              <p className="text-sm text-slate-500">Registra cerdas en Gestación para ver su distribución.</p>
            ) : (
              <BarrasHorizontales
                total={ind.activas}
                filas={ESTADOS.filter((e) => ind.conteo[e.estado] > 0).map((e) => ({
                  nombre: e.estado,
                  valor: ind.conteo[e.estado],
                  color: e.color,
                }))}
              />
            )}
          </Tarjeta>

          <Tarjeta titulo="Partos e inseminaciones" accion={<span className="text-xs text-slate-500">6 meses</span>}>
            <BarrasVerticales
              grupos={ind.graficaPartos}
              series={[{ nombre: "Partos", color: AZUL }, { nombre: "Inseminaciones", color: NARANJA }]}
            />
          </Tarjeta>

          <Tarjeta titulo="Lechones" accion={<span className="text-xs text-slate-500">6 meses</span>}>
            <BarrasVerticales
              grupos={ind.graficaLechones}
              series={[{ nombre: "Nacidos vivos", color: AZUL }, { nombre: "Destetados", color: NARANJA }]}
            />
          </Tarjeta>

          <Seccion titulo="Reproducción">
            <Dato titulo="Partos" valor={ind.partos} detalle="últimos 12 meses" />
            <Dato titulo="Nacidos vivos / parto" valor={uno(ind.vivosPorParto)} detalle={`${uno(ind.muertosPorParto)} muertos/momias`} />
            <Dato titulo="Destetados / camada" valor={uno(ind.destetadosPorCamada)} />
            <Dato titulo="Mortalidad predestete" valor={Number.isFinite(ind.mortalidadPredestete) ? `${uno(ind.mortalidadPredestete)} %` : "–"} />
            <Dato titulo="Tasa de parto" valor={Number.isFinite(ind.tasaParto) ? `${Math.round(ind.tasaParto)} %` : "–"} detalle="partos / inseminaciones" />
            <Dato titulo="Destete → celo" valor={Number.isFinite(ind.intervaloDesteteCelo) ? `${uno(ind.intervaloDesteteCelo)} d` : "–"} detalle={`${ind.abortos} abortos en el año`} />
          </Seccion>

          <Seccion titulo="Engorde">
            <Dato titulo="Lotes activos" valor={ind.lotesActivos} detalle={`${ind.animalesEngorde} animales`} />
            <Dato titulo="Ganancia diaria" valor={Number.isFinite(ind.gdp) ? `${Math.round(ind.gdp)} g` : "–"} detalle="promedio por animal" />
            <Dato titulo="Mortalidad engorde" valor={Number.isFinite(ind.mortalidadEngorde) ? `${uno(ind.mortalidadEngorde)} %` : "–"} detalle="todos los lotes" />
          </Seccion>

          {ind.lotesGrafica.length > 0 && (
            <Tarjeta titulo="Lotes de engorde activos">
              <p className="mb-2 text-xs font-medium uppercase tracking-wider text-slate-500">Animales por lote</p>
              <BarrasHorizontales
                filas={ind.lotesGrafica.map((l) => ({ nombre: l.nombre, valor: l.vivos, color: AZUL }))}
              />
              <p className="mb-2 mt-5 text-xs font-medium uppercase tracking-wider text-slate-500">Peso promedio actual (kg)</p>
              <BarrasHorizontales
                filas={ind.lotesGrafica.map((l) => ({ nombre: l.nombre, valor: l.peso, color: NARANJA }))}
              />
            </Tarjeta>
          )}

          <Tarjeta titulo="Ingresos y gastos" accion={<span className="text-xs text-slate-500">6 meses</span>}>
            <BarrasVerticales
              grupos={ind.graficaEconomia}
              formato={pesosCompactos}
              series={[{ nombre: "Ingresos", color: AZUL }, { nombre: "Gastos", color: NARANJA }]}
            />
          </Tarjeta>

          <Seccion titulo="Economía · este mes">
            <Dato titulo="Ingresos" valor={formatoPesos(ind.ingresos)} />
            <Dato titulo="Gastos" valor={formatoPesos(ind.gastos)} />
            <Dato titulo="Balance" valor={formatoPesos(ind.ingresos - ind.gastos)} />
          </Seccion>
        </>
      )}
    </ModuloPage>
  );
}

function Seccion({ titulo, children }: { titulo: string; children: ReactNode }) {
  return (
    <section>
      <h2 className="mb-2 px-1 text-[13px] font-semibold uppercase tracking-wider text-slate-500">{titulo}</h2>
      <div className="grid grid-cols-2 gap-2">{children}</div>
    </section>
  );
}
