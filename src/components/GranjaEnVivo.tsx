"use client";

import { useEffect, useRef, useState, type FormEvent } from "react";
import { Boton, Campo, Entrada, Hoja, Insignia, Interruptor, Tarjeta, Vacio } from "@/components/ui";
import { guardarConfigMqtt, normalizarUrl, type ConfigMqtt, type GranjaEnVivoEstado } from "@/lib/mqtt";

const COLORES = [
  { nombre: "Rojo", hex: "#FF0000" },
  { nombre: "Verde", hex: "#00FF00" },
  { nombre: "Azul", hex: "#0000FF" },
  { nombre: "Blanco", hex: "#FFFFFF" },
];

type Control = "led" | "rele" | "rgb";
type Pendiente = { valor: boolean; id: number };

/** Tiempo máximo para que el ESP32 confirme una orden */
const ESPERA_CONFIRMACION = 6000;

/** "hace 8 s", "hace 3 min"… */
export function haceCuanto(ms: number) {
  const s = Math.max(0, Math.round(ms / 1000));
  if (s < 60) return `hace ${s} s`;
  const m = Math.round(s / 60);
  if (m < 60) return `hace ${m} min`;
  return `hace ${Math.round(m / 60)} h`;
}

/**
 * Tarjeta de Monitoreo con la temperatura del ESP32 en tiempo real y los controles de la granja.
 * La página abre una sola conexión (useGranjaEnVivo) y la comparte aquí y en el recuadro de Precebo.
 */
export default function GranjaEnVivo({ config, granja }: { config: ConfigMqtt | null; granja: GranjaEnVivoEstado }) {
  const [configurando, setConfigurando] = useState(false);
  const [aviso, setAviso] = useState("");
  const [ahora, setAhora] = useState(() => Date.now());

  // Refresca el "hace X s" cada pocos segundos
  useEffect(() => {
    const t = setInterval(() => setAhora(Date.now()), 5000);
    return () => clearInterval(t);
  }, []);

  useEffect(() => {
    if (!aviso) return;
    const t = setTimeout(() => setAviso(""), 3000);
    return () => clearTimeout(t);
  }, [aviso]);

  // Órdenes enviadas que el ESP32 todavía no confirma: el interruptor se mueve
  // al instante y vuelve a su lugar si no llega la confirmación a tiempo
  const [pendientes, setPendientes] = useState<Partial<Record<Control, Pendiente>>>({});
  const pendientesRef = useRef(pendientes);
  useEffect(() => {
    pendientesRef.current = pendientes;
  }, [pendientes]);

  const rgbConfirmado = granja.rgb === null ? null : granja.rgb !== "off";

  // Llega la confirmación del ESP32: se quita lo pendiente
  useEffect(() => {
    setPendientes((p) => {
      const n = { ...p };
      let cambio = false;
      if (n.led && granja.ledAzul === n.led.valor) { delete n.led; cambio = true; }
      if (n.rele && granja.rele === n.rele.valor) { delete n.rele; cambio = true; }
      if (n.rgb && rgbConfirmado === n.rgb.valor) { delete n.rgb; cambio = true; }
      return cambio ? n : p;
    });
  }, [granja.ledAzul, granja.rele, rgbConfirmado]);

  /** Envía la orden y mueve el control de inmediato */
  const ordenar = (control: Control, tema: string, mensaje: string, valor: boolean) => {
    if (!granja.enviar(tema, mensaje)) {
      setAviso("Sin conexión con el servidor. La orden no se envió.");
      return;
    }
    const actual = { led: granja.ledAzul, rele: granja.rele, rgb: rgbConfirmado }[control];
    if (actual === valor) {
      // Ya está en ese estado (por ejemplo, otro color con el RGB encendido): nada que esperar
      setPendientes((p) => {
        if (!p[control]) return p;
        const n = { ...p };
        delete n[control];
        return n;
      });
      return;
    }
    const id = Date.now() + Math.random();
    setPendientes((p) => ({ ...p, [control]: { valor, id } }));
    setTimeout(() => {
      if (pendientesRef.current[control]?.id !== id) return;
      setPendientes((p) => {
        const n = { ...p };
        delete n[control];
        return n;
      });
      setAviso("El ESP32 no confirmó la orden. Revisa que esté encendido y conectado.");
    }, ESPERA_CONFIRMACION);
  };

  const valor = (c: Control, confirmado: boolean | null) => pendientes[c]?.valor ?? confirmado;
  const estadoTexto = (c: Control, confirmado: boolean | null) =>
    pendientes[c] ? "Enviando…" : confirmado === null ? "Estado desconocido" : confirmado ? "Encendido" : "Apagado";

  const botonConexion = (
    <button
      type="button"
      onClick={() => setConfigurando(true)}
      className="rounded-full px-2.5 py-1 text-xs font-semibold text-sky-800 hover:bg-sky-50"
    >
      Conexión
    </button>
  );

  // Estado general: lo más importante primero
  const insignia =
    granja.conexion === "conectado" ? (
      granja.esp32 === false ? (
        <Insignia clase="bg-amber-50 text-amber-800 ring-amber-200">ESP32 desconectado</Insignia>
      ) : (
        <Insignia clase="bg-emerald-50 text-emerald-700 ring-emerald-200">En vivo</Insignia>
      )
    ) : granja.conexion === "conectando" ? (
      <Insignia clase="bg-slate-50 text-slate-600 ring-slate-200">Conectando…</Insignia>
    ) : granja.conexion === "error" ? (
      <Insignia clase="bg-red-50 text-red-700 ring-red-200">Sin conexión</Insignia>
    ) : null;

  const sinDatosRecientes = granja.actualizado !== null && ahora - granja.actualizado > 60_000;
  const rgbEncendido = granja.rgb !== null && granja.rgb !== "off";
  const ledVisible = valor("led", granja.ledAzul);
  const releVisible = valor("rele", granja.rele);

  return (
    <>
      <Tarjeta titulo="Granja en vivo" accion={botonConexion}>
        {!config ? (
          <Vacio
            titulo="Conecta el ESP32 de la granja"
            texto="Ingresa los datos de EMQX para ver la temperatura en tiempo real y controlar los equipos desde cualquier lugar."
            accion={<Boton onClick={() => setConfigurando(true)}>Configurar conexión</Boton>}
          />
        ) : (
          <div className="flex flex-col gap-4">
            <div className="flex items-start justify-between gap-3">
              <div className="min-w-0">
                <p className="text-xs font-medium text-slate-500">Sensor del ESP32</p>
                {granja.sensorError ? (
                  <p className="mt-1 text-lg font-semibold text-red-600">Sensor no detectado</p>
                ) : granja.temperatura !== null ? (
                  <p className="mt-1 text-4xl font-bold leading-none text-slate-900 tabular-nums">
                    {granja.temperatura.toFixed(1)}
                    <span className="text-lg font-semibold text-slate-500"> °C</span>
                  </p>
                ) : (
                  <p className="mt-1 text-lg font-semibold text-slate-400">Esperando lectura…</p>
                )}
                {granja.actualizado !== null && (
                  <p className={`mt-1.5 text-xs ${sinDatosRecientes ? "font-semibold text-amber-700" : "text-slate-500"}`}>
                    {sinDatosRecientes ? "Sin lecturas nuevas · " : "Actualizado "}
                    {haceCuanto(ahora - granja.actualizado)}
                  </p>
                )}
              </div>
              {insignia}
            </div>

            {granja.conexion === "error" && granja.error && (
              <p className="rounded-2xl bg-red-50 px-3.5 py-2.5 text-sm text-red-700 ring-1 ring-red-200">{granja.error}</p>
            )}

            <ul className="flex flex-col divide-y divide-slate-100 border-t border-slate-100">
              <li className="flex items-center justify-between gap-3 py-3">
                <div className="flex min-w-0 items-center gap-3">
                  <span
                    aria-hidden="true"
                    className={`h-3.5 w-3.5 shrink-0 rounded-full ring-1 ring-slate-200 ${ledVisible ? "bg-sky-500" : "bg-slate-200"}`}
                    style={ledVisible ? { boxShadow: "0 0 10px #0ea5e9" } : undefined}
                  />
                  <div className="min-w-0">
                    <p className="text-sm font-semibold text-slate-900">LED azul</p>
                    <p className="text-xs text-slate-500">
                      {estadoTexto("led", granja.ledAzul)}
                    </p>
                  </div>
                </div>
                <Interruptor
                  activo={ledVisible === true}
                  onCambiar={(v) => ordenar("led", "granja/led_azul/set", v ? "on" : "off", v)}
                />
              </li>

              <li className="flex items-center justify-between gap-3 py-3">
                <div className="flex min-w-0 items-center gap-3">
                  <span
                    aria-hidden="true"
                    className={`h-3.5 w-3.5 shrink-0 rounded-full ring-1 ring-slate-200 ${releVisible ? "bg-emerald-500" : "bg-slate-200"}`}
                    style={releVisible ? { boxShadow: "0 0 10px #10b981" } : undefined}
                  />
                  <div className="min-w-0">
                    <p className="text-sm font-semibold text-slate-900">Relé</p>
                    <p className="text-xs text-slate-500">
                      {estadoTexto("rele", granja.rele)}
                    </p>
                  </div>
                </div>
                <Interruptor
                  activo={releVisible === true}
                  onCambiar={(v) => ordenar("rele", "granja/rele/set", v ? "on" : "off", v)}
                />
              </li>

              <li className="flex flex-col gap-3 pt-3">
                <div className="flex items-center justify-between gap-3">
                  <div className="flex min-w-0 items-center gap-3">
                    <span
                      aria-hidden="true"
                      className="h-3.5 w-3.5 shrink-0 rounded-full ring-1 ring-slate-200"
                      style={{
                        background: rgbEncendido ? granja.rgb! : "#e2e8f0",
                        boxShadow: rgbEncendido ? `0 0 10px ${granja.rgb}` : undefined,
                      }}
                    />
                    <div className="min-w-0">
                      <p className="text-sm font-semibold text-slate-900">LED RGB de la placa</p>
                      <p className="text-xs text-slate-500">
                        {pendientes.rgb
                          ? "Enviando…"
                          : granja.rgb === null
                            ? "Estado desconocido"
                            : rgbEncendido
                              ? `Encendido · ${granja.rgb}`
                              : "Apagado"}
                      </p>
                    </div>
                  </div>
                  <Interruptor
                    activo={valor("rgb", rgbConfirmado) === true}
                    onCambiar={(v) => ordenar("rgb", "granja/rgb/set", v ? "on" : "off", v)}
                  />
                </div>
                <div className="flex flex-wrap items-center gap-2">
                  {COLORES.map((c) => (
                    <button
                      key={c.hex}
                      type="button"
                      onClick={() => ordenar("rgb", "granja/rgb/set", c.hex, true)}
                      aria-label={`Color ${c.nombre}`}
                      className={`h-9 w-9 rounded-full ring-1 transition active:scale-90 ${
                        granja.rgb === c.hex ? "ring-2 ring-sky-600 ring-offset-2" : "ring-slate-300"
                      }`}
                      style={{ background: c.hex }}
                    />
                  ))}
                  <label className="relative ml-1 flex h-9 items-center gap-2 rounded-full bg-slate-100 px-3 text-xs font-semibold text-slate-700">
                    Otro color
                    <input
                      type="color"
                      defaultValue="#0000FF"
                      onChange={(e) => ordenar("rgb", "granja/rgb/set", e.target.value.toUpperCase(), true)}
                      className="absolute inset-0 h-full w-full cursor-pointer opacity-0"
                    />
                  </label>
                </div>
              </li>
            </ul>
          </div>
        )}
        {aviso && <p className="mt-3 text-center text-xs font-semibold text-red-600">{aviso}</p>}
      </Tarjeta>

      <ConfigurarConexion abierta={configurando} actual={config} onCerrar={() => setConfigurando(false)} />
    </>
  );
}

function ConfigurarConexion({
  abierta,
  actual,
  onCerrar,
}: {
  abierta: boolean;
  actual: ConfigMqtt | null;
  onCerrar: () => void;
}) {
  const [url, setUrl] = useState("");
  const [usuario, setUsuario] = useState("");
  const [clave, setClave] = useState("");
  const [cargada, setCargada] = useState(false);

  // Al abrir, carga lo que ya estaba guardado
  if (abierta && !cargada) {
    setCargada(true);
    setUrl(actual?.url ?? "");
    setUsuario(actual?.usuario ?? "");
    setClave(actual?.clave ?? "");
  }
  if (!abierta && cargada) setCargada(false);

  const guardar = (e: FormEvent) => {
    e.preventDefault();
    if (!url.trim()) return;
    guardarConfigMqtt({ url: normalizarUrl(url), usuario: usuario.trim(), clave });
    onCerrar();
  };

  const quitar = () => {
    guardarConfigMqtt(null);
    onCerrar();
  };

  return (
    <Hoja abierta={abierta} titulo="Conexión con la granja" onCerrar={onCerrar}>
      <form onSubmit={guardar} className="flex flex-col gap-3.5">
        <Campo
          etiqueta="Servidor de EMQX *"
          ayuda="La dirección de Connection Information en EMQX. Se completa sola con wss:// y el puerto 8084."
        >
          <Entrada value={url} onChange={setUrl} required placeholder="df12cb9f.ala.us-east-1.emqxsl.com" />
        </Campo>
        <Campo etiqueta="Usuario">
          <Entrada value={usuario} onChange={setUsuario} placeholder="El de Access Control" />
        </Campo>
        <Campo etiqueta="Contraseña">
          <Entrada type="password" value={clave} onChange={setClave} />
        </Campo>
        <p className="text-xs text-slate-500">Estos datos se guardan solo en este teléfono.</p>
        <Boton type="submit" className="mt-1 w-full py-3">
          Guardar y conectar
        </Boton>
        {actual && (
          <Boton variante="suave" onClick={quitar} className="w-full text-rose-600">
            Quitar conexión
          </Boton>
        )}
      </form>
    </Hoja>
  );
}
