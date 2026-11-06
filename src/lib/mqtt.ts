"use client";

/**
 * Conexión en vivo con el ESP32 de la granja a través de EMQX (MQTT por WebSocket).
 *
 * Cliente MQTT 3.1.1 mínimo (sin dependencias): conectar, suscribirse, publicar
 * y mantener viva la conexión. Solo usa QoS 0, que es lo que necesita la granja.
 *
 * Temas que publica el ESP32:
 *   granja/temperatura      "24.5" o "error"
 *   granja/led_azul/estado  "on" | "off"
 *   granja/rgb/estado       "off" | "#RRGGBB"
 *   granja/conexion         "online" | "offline"
 * Temas que escucha el ESP32:
 *   granja/led_azul/set     "on" | "off"
 *   granja/rgb/set          "on" | "off" | "#RRGGBB"
 */

import { useCallback, useEffect, useRef, useState } from "react";

/* ---------------- Configuración (se guarda solo en este teléfono) ---------------- */

export type ConfigMqtt = { url: string; usuario: string; clave: string };

const CLAVE_CONFIG = "granja-mqtt";
const EVENTO_CONFIG = "granja-mqtt-cambio";

export function leerConfigMqtt(): ConfigMqtt | null {
  if (typeof window === "undefined") return null;
  try {
    const c = JSON.parse(localStorage.getItem(CLAVE_CONFIG) || "null");
    if (c && typeof c.url === "string" && c.url.trim()) return c as ConfigMqtt;
  } catch {}
  return null;
}

export function guardarConfigMqtt(c: ConfigMqtt | null) {
  try {
    if (c) localStorage.setItem(CLAVE_CONFIG, JSON.stringify(c));
    else localStorage.removeItem(CLAVE_CONFIG);
  } catch {}
  window.dispatchEvent(new Event(EVENTO_CONFIG));
}

/** Acepta "df12cb9f.ala...emqxsl.com" o la dirección completa, y devuelve wss://host:8084/mqtt */
export function normalizarUrl(entrada: string) {
  let u = entrada.trim();
  if (!u) return "";
  if (!/^wss?:\/\//i.test(u)) u = "wss://" + u.replace(/^\/+/, "");
  try {
    const url = new URL(u);
    if (!url.port) url.port = "8084";
    if (url.pathname === "/" || url.pathname === "") url.pathname = "/mqtt";
    return url.toString().replace(/\/$/, "");
  } catch {
    return u;
  }
}

export function useConfigMqtt() {
  const [config, setConfig] = useState<ConfigMqtt | null>(null);
  useEffect(() => {
    const leer = () => setConfig(leerConfigMqtt());
    leer();
    window.addEventListener(EVENTO_CONFIG, leer);
    return () => window.removeEventListener(EVENTO_CONFIG, leer);
  }, []);
  return config;
}

/* ---------------- Codificación de paquetes MQTT ---------------- */

const codificador = new TextEncoder();
const decodificador = new TextDecoder();

function texto(s: string) {
  const b = codificador.encode(s);
  return [b.length >> 8, b.length & 0xff, ...b];
}

function largoRestante(n: number) {
  const bytes: number[] = [];
  do {
    let d = n % 128;
    n = Math.floor(n / 128);
    if (n > 0) d |= 0x80;
    bytes.push(d);
  } while (n > 0);
  return bytes;
}

function paquete(cabecera: number, cuerpo: number[]) {
  return new Uint8Array([cabecera, ...largoRestante(cuerpo.length), ...cuerpo]);
}

function paqueteConectar(idCliente: string, usuario: string, clave: string, keepAlive: number) {
  let banderas = 0x02; // sesión limpia
  if (usuario) banderas |= 0x80;
  if (clave) banderas |= 0x40;
  const cuerpo = [
    ...texto("MQTT"),
    4, // MQTT 3.1.1
    banderas,
    keepAlive >> 8,
    keepAlive & 0xff,
    ...texto(idCliente),
    ...(usuario ? texto(usuario) : []),
    ...(clave ? texto(clave) : []),
  ];
  return paquete(0x10, cuerpo);
}

function paqueteSuscribir(id: number, tema: string) {
  return paquete(0x82, [id >> 8, id & 0xff, ...texto(tema), 0]);
}

function paquetePublicar(tema: string, mensaje: string) {
  return paquete(0x30, [...texto(tema), ...codificador.encode(mensaje)]);
}

const MOTIVOS_CONNACK: Record<number, string> = {
  1: "El servidor no acepta esta versión de MQTT.",
  2: "El servidor rechazó el identificador de la app.",
  3: "El servidor no está disponible. Intenta en un momento.",
  4: "Usuario o contraseña incorrectos. Revísalos en Conexión.",
  5: "Este usuario no tiene permiso. Revisa Access Control en EMQX.",
};

/* ---------------- Estado en vivo de la granja ---------------- */

export type EstadoConexion = "sin-config" | "conectando" | "conectado" | "error";

export type Granja = {
  conexion: EstadoConexion;
  error: string;
  /** true = ESP32 conectado, false = desconectado, null = todavía no se sabe */
  esp32: boolean | null;
  temperatura: number | null;
  sensorError: boolean;
  actualizado: number | null;
  ledAzul: boolean | null;
  /** "off" o un color "#RRGGBB"; null = todavía no se sabe */
  rgb: string | null;
};

const INICIAL: Granja = {
  conexion: "sin-config",
  error: "",
  esp32: null,
  temperatura: null,
  sensorError: false,
  actualizado: null,
  ledAzul: null,
  rgb: null,
};

const KEEPALIVE = 30;

export function useGranjaEnVivo(config: ConfigMqtt | null) {
  const [estado, setEstado] = useState<Granja>(INICIAL);
  const socket = useRef<WebSocket | null>(null);

  useEffect(() => {
    if (!config) {
      setEstado(INICIAL);
      return;
    }

    let cerrado = false;
    let reintento: ReturnType<typeof setTimeout> | undefined;
    let ping: ReturnType<typeof setInterval> | undefined;
    let espera = 2000;

    const alMensaje = (tema: string, msg: string) => {
      setEstado((e) => {
        switch (tema) {
          case "granja/temperatura": {
            const t = Number(msg);
            return msg === "error" || !Number.isFinite(t)
              ? { ...e, sensorError: true, actualizado: Date.now() }
              : { ...e, temperatura: t, sensorError: false, actualizado: Date.now() };
          }
          case "granja/led_azul/estado":
            return { ...e, ledAzul: msg === "on" };
          case "granja/rgb/estado":
            return { ...e, rgb: msg === "off" ? "off" : msg.toUpperCase() };
          case "granja/conexion":
            return { ...e, esp32: msg === "online" };
          default:
            return e;
        }
      });
    };

    const conectar = () => {
      if (cerrado) return;
      setEstado((e) => ({ ...e, conexion: "conectando", error: "" }));
      let ws: WebSocket;
      try {
        ws = new WebSocket(normalizarUrl(config.url), "mqtt");
      } catch {
        setEstado((e) => ({ ...e, conexion: "error", error: "La dirección del servidor no es válida." }));
        return;
      }
      ws.binaryType = "arraybuffer";
      socket.current = ws;
      let pendiente = new Uint8Array(0);
      let aceptado = false;

      ws.onopen = () => {
        const id = "app-mirador-" + Math.random().toString(16).slice(2, 10);
        ws.send(paqueteConectar(id, config.usuario, config.clave, KEEPALIVE));
      };

      ws.onmessage = (ev) => {
        // Junta lo recibido y separa cada paquete MQTT completo
        const nuevo = new Uint8Array(ev.data as ArrayBuffer);
        const todo = new Uint8Array(pendiente.length + nuevo.length);
        todo.set(pendiente);
        todo.set(nuevo, pendiente.length);
        let i = 0;
        while (i + 2 <= todo.length) {
          let largo = 0;
          let mult = 1;
          let j = i + 1;
          let completo = false;
          while (j < todo.length) {
            const b = todo[j++];
            largo += (b & 0x7f) * mult;
            mult *= 128;
            if (!(b & 0x80)) {
              completo = true;
              break;
            }
          }
          if (!completo || j + largo > todo.length) break;
          const tipo = todo[i] >> 4;
          const cuerpo = todo.subarray(j, j + largo);

          if (tipo === 2) {
            // CONNACK
            const codigo = cuerpo[1];
            if (codigo === 0) {
              aceptado = true;
              espera = 2000;
              setEstado((e) => ({ ...e, conexion: "conectado", error: "" }));
              ws.send(paqueteSuscribir(1, "granja/#"));
              ping = setInterval(() => {
                if (ws.readyState === WebSocket.OPEN) ws.send(new Uint8Array([0xc0, 0]));
              }, (KEEPALIVE * 1000) / 2);
            } else {
              setEstado((e) => ({ ...e, conexion: "error", error: MOTIVOS_CONNACK[codigo] ?? `El servidor rechazó la conexión (código ${codigo}).` }));
              espera = 30000; // no insistir seguido con una clave mala
              ws.close();
            }
          } else if (tipo === 3) {
            // PUBLISH
            const qos = (todo[i] >> 1) & 3;
            const largoTema = (cuerpo[0] << 8) | cuerpo[1];
            const tema = decodificador.decode(cuerpo.subarray(2, 2 + largoTema));
            const inicio = 2 + largoTema + (qos > 0 ? 2 : 0);
            alMensaje(tema, decodificador.decode(cuerpo.subarray(inicio)).trim());
          }
          i = j + largo;
        }
        pendiente = todo.slice(i);
      };

      ws.onerror = () => {
        if (!aceptado) {
          setEstado((e) => ({
            ...e,
            conexion: "error",
            error: e.error || "No se pudo conectar. Revisa la dirección del servidor y tu internet.",
          }));
        }
      };

      ws.onclose = () => {
        clearInterval(ping);
        if (socket.current === ws) socket.current = null;
        if (cerrado) return;
        setEstado((e) => ({ ...e, conexion: e.conexion === "error" ? "error" : "conectando" }));
        reintento = setTimeout(conectar, espera);
        espera = Math.min(espera * 2, 30000);
      };
    };

    conectar();

    // Al volver a la app (por ejemplo, desde otra pestaña), reconecta enseguida
    const alVolver = () => {
      if (document.visibilityState === "visible" && !socket.current) {
        clearTimeout(reintento);
        espera = 2000;
        conectar();
      }
    };
    document.addEventListener("visibilitychange", alVolver);

    return () => {
      cerrado = true;
      clearTimeout(reintento);
      clearInterval(ping);
      document.removeEventListener("visibilitychange", alVolver);
      socket.current?.close();
      socket.current = null;
    };
  }, [config]);

  /** Envía una orden al ESP32. Devuelve false si no hay conexión. */
  const enviar = useCallback((tema: string, mensaje: string) => {
    const ws = socket.current;
    if (!ws || ws.readyState !== WebSocket.OPEN) return false;
    ws.send(paquetePublicar(tema, mensaje));
    return true;
  }, []);

  return { ...estado, enviar };
}
