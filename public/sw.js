/*
 * Service worker de Porcícola El Mirador
 * ------------------------------------------------------------
 * Permite abrir y usar la app sin internet ni servidor:
 *  - Al instalarse descarga todas las pantallas y sus archivos (JS, CSS,
 *    fuentes, imágenes) y los guarda en el teléfono.
 *  - Pantallas: si hay copia guardada se abren al instante y se actualizan en
 *    segundo plano; si no hay copia, se piden a la red.
 *  - Archivos de /_next/static (tienen nombre único por versión): se sirven
 *    desde la copia guardada sin ir a la red.
 *  - Imágenes y datos de navegación entre pantallas: se muestran al instante
 *    desde la copia guardada y se actualizan en segundo plano.
 * Los datos de la granja ya viven en el teléfono (localStorage), así que con
 * esto la app funciona completa sin conexión.
 */

const VERSION = new URL(self.location.href).searchParams.get("v") || "1";
const CACHE = `mirador-${VERSION}`;
const ESPERA_RED_MS = 3000;
// Datos de navegación entre pantallas sin copia: con datos lentos no se espera más de esto
const ESPERA_RSC_MS = 1200;
// Archivos JS/CSS que no están guardados: se espera un poco más (pueden pesar)
const ESPERA_ARCHIVO_MS = 10000;
// Versiones guardadas: la actual y la anterior (para pantallas que ya estaban
// abiertas cuando llegó una actualización)
const VERSIONES_GUARDADAS = 2;

const sinRed = () => self.navigator && self.navigator.onLine === false;

// Pantallas que se guardan al instalar. "/cerda/_" y "/cerda/_/parto" son
// plantillas que sirven para cualquier cerda cuando no hay conexión.
const RUTAS = [
  "/",
  "/dashboard",
  "/gestacion",
  "/engorde",
  "/tratamientos",
  "/bioseguridad",
  "/indicadores",
  "/contabilidad",
  "/ajustes",
  "/ajustes/avanzados",
  "/ajustes/registro",
  "/ajustes/usuarios",
  "/tareas",
  "/monitoreo",
  "/bodega",
  "/programacion",
  "/jaula",
  "/calendario",
  "/cerda/_",
  "/cerda/_/parto",
];

const ARCHIVOS = [
  "/manifest.webmanifest",
  "/images/logo.png",
  "/images/logo-header.png",
  "/images/icons/icon-192.png",
  "/images/icons/icon-512.png",
  "/images/icons/maskable-512.png",
];

/* ─────────────── Utilidades ─────────────── */

/** Saca de un HTML o CSS las direcciones de archivos propios que hay que guardar */
function extraerRecursos(texto) {
  const urls = new Set();
  const limpio = texto.replace(/&amp;/g, "&");

  // Archivos de Next (aparecen como /_next/static/... o static/chunks/... en los datos)
  const reNext = /(?:\/_next\/)?static\/(?:chunks|css|media)\/[\w\-.\/%~@\[\]]+/g;
  for (const m of limpio.match(reNext) || []) {
    urls.add(m.startsWith("/_next/") ? m : `/_next/${m}`);
  }
  // Atributos src, href y srcset con rutas propias (imágenes, íconos, manifiesto)
  const reAttr = /(?:src|href|srcSet|srcset)="([^"]+)"/g;
  let m;
  while ((m = reAttr.exec(limpio))) {
    for (const parte of m[1].split(",")) {
      const url = parte.trim().split(/\s+/)[0];
      if (url && url.startsWith("/") && !url.startsWith("//")) urls.add(url);
    }
  }
  // url(...) dentro de CSS (fuentes)
  const reCss = /url\(\s*["']?([^"')]+)["']?\s*\)/g;
  while ((m = reCss.exec(limpio))) {
    if (m[1].startsWith("/") && !m[1].startsWith("//")) urls.add(m[1]);
  }
  return [...urls].filter((u) => !u.includes("webpack-hmr") && !u.includes("__nextjs"));
}

/** Safari no acepta respuestas "redirigidas" para navegaciones: se copian limpias */
async function limpia(res) {
  if (!res.redirected) return res;
  const cuerpo = await res.blob();
  return new Response(cuerpo, { status: res.status, statusText: res.statusText, headers: res.headers });
}

/** Guarda una URL. Devuelve la respuesta, false si no existe (4xx) o null si falló la red */
async function guardar(cache, url, intentos = 3) {
  for (let i = 0; i < intentos; i++) {
    try {
      const res = await limpia(await redConEspera(new Request(url, { cache: "no-store", credentials: "same-origin" }), 15000));
      if (res.ok && res.type !== "opaqueredirect") {
        await cache.put(url, res.clone());
        return res;
      }
      // No existe (404…): no se reintenta ni cuenta como descarga fallida
      if (res.status >= 400 && res.status < 500) return false;
    } catch {
      // red caída o lenta: se reintenta
    }
    await new Promise((ok) => setTimeout(ok, 800 * (i + 1)));
  }
  return null;
}

/** fetch con tiempo límite: si el servidor no responde, se usa la copia guardada */
function redConEspera(request, ms = ESPERA_RED_MS) {
  return new Promise((resolve, reject) => {
    const t = setTimeout(() => reject(new Error("timeout")), ms);
    fetch(request).then(
      (r) => {
        clearTimeout(t);
        resolve(r);
      },
      (e) => {
        clearTimeout(t);
        reject(e);
      }
    );
  });
}

/* ─────────────── Instalación: descargar todo ─────────────── */

/** Descarga todas las pantallas y sus archivos. `avance(hechos, total)` informa el progreso. */
async function descargarTodo(avance = () => {}) {
  const cache = await caches.open(CACHE);
  const pendientes = new Set(ARCHIVOS);
  const fallidas = [];
  let hechos = 0;
  let total = RUTAS.length + ARCHIVOS.length;
  const paso = () => avance(++hechos, total);

  for (const ruta of RUTAS) {
    const res = await guardar(cache, ruta);
    if (res) {
      const antes = pendientes.size;
      extraerRecursos(await res.text()).forEach((u) => pendientes.add(u));
      total += pendientes.size - antes;
    } else if (res === null) fallidas.push(ruta);
    paso();
  }

  const css = [];
  await Promise.all(
    [...pendientes].map(async (url) => {
      const res = await guardar(cache, url);
      if (res === null && url.startsWith("/_next/static/")) fallidas.push(url);
      if (res && url.split("?")[0].endsWith(".css")) css.push(await res.text());
      paso();
    })
  );

  // Fuentes y archivos que solo aparecen dentro del CSS
  const extra = new Set();
  css.forEach((t) => extraerRecursos(t).forEach((u) => !pendientes.has(u) && extra.add(u)));
  total += extra.size;
  await Promise.all([...extra].map((u) => guardar(cache, u).then(paso)));
  return { fallidas, total };
}

async function precargar() {
  const { fallidas } = await descargarTodo();

  // Si la descarga quedó incompleta (se fue la señal a mitad) y el teléfono ya
  // tiene una versión completa, no se instala esta: se conserva la anterior,
  // que sigue funcionando sin conexión, y se reintenta en la próxima apertura.
  if (fallidas.length) {
    const anteriores = (await caches.keys()).filter((n) => n.startsWith("mirador-") && n !== CACHE);
    if (anteriores.length) {
      await caches.delete(CACHE);
      throw new Error(`Descarga incompleta (${fallidas.length}): se conserva la versión anterior`);
    }
  }
}

self.addEventListener("install", (event) => {
  self.skipWaiting();
  event.waitUntil(precargar());
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    (async () => {
      // Se conservan la versión actual y la anterior; las demás se borran
      const numero = (n) => Number(n.slice("mirador-".length)) || 0;
      const viejas = (await caches.keys())
        .filter((n) => n.startsWith("mirador-") && n !== CACHE)
        .sort((a, b) => numero(b) - numero(a))
        .slice(VERSIONES_GUARDADAS - 1);
      await Promise.all(viejas.map((n) => caches.delete(n)));
      await self.clients.claim();
    })()
  );
});

/* ─────────────── Peticiones ─────────────── */

/** ¿Es una pantalla (HTML)? Los datos de navegación (RSC) nunca se muestran como pantalla */
const esHtml = (res) => Boolean(res) && (res.headers.get("Content-Type") || "").includes("text/html");

/** Copia de una pantalla guardada, solo si es HTML (las que no lo son se descartan) */
async function pantallaGuardada(cache, ruta) {
  const res = await cache.match(ruta, { ignoreVary: true });
  if (!res) return undefined;
  if (esHtml(res)) return res;
  await cache.delete(ruta, { ignoreVary: true }).catch(() => undefined);
  return undefined;
}

/** Los datos de navegación se guardan con una clave propia para no mezclarse con la pantalla */
const claveRsc = (url) => {
  const u = new URL(url.href);
  u.searchParams.set("__rsc", "1");
  return u.pathname + u.search;
};

async function plantillaCerda(cache, pathname) {
  if (!pathname.startsWith("/cerda/")) return undefined;
  const ruta = pathname.replace(/\/+$/, "").endsWith("/parto") ? "/cerda/_/parto" : "/cerda/_";
  return pantallaGuardada(cache, ruta);
}

async function navegar(event, request, url) {
  const cache = await caches.open(CACHE);
  // Con copia guardada de esta versión: se abre al instante (los datos viven en el
  // teléfono) y la pantalla se actualiza en segundo plano para la próxima vez.
  const copia = await pantallaGuardada(cache, url.pathname);
  if (copia) {
    if (!sinRed()) {
      event.waitUntil(
        fetch(request)
          .then(limpia)
          .then((res) => (res.ok && esHtml(res) ? cache.put(url.pathname, res.clone()) : undefined))
          .catch(() => undefined)
      );
    }
    return copia;
  }
  try {
    if (sinRed()) throw new Error("sin red");
    const res = await limpia(await redConEspera(request));
    // Un error del servidor (500, 502…) se trata como si no hubiera conexión
    if (res.status >= 500) throw new Error(`servidor ${res.status}`);
    if (res.ok && esHtml(res)) cache.put(url.pathname, res.clone());
    return res;
  } catch {
    const otra = await caches.match(url.pathname, { ignoreVary: true });
    const guardada =
      (await pantallaGuardada(cache, url.pathname)) ||
      (await plantillaCerda(cache, url.pathname)) ||
      (esHtml(otra) ? otra : undefined) ||
      (await pantallaGuardada(cache, "/dashboard"));
    if (guardada) return guardada;
    return new Response(
      '<!doctype html><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">' +
        '<title>Sin conexión</title><body style="font-family:system-ui;padding:40px 24px;text-align:center;color:#0f172a">' +
        "<h1 style=\"font-size:20px\">Sin conexión</h1><p style=\"color:#64748b\">Abre la app una vez con internet para poder usarla sin conexión.</p>" +
        '<p><a href="/dashboard" style="color:#065f46;font-weight:600">Reintentar</a></p></body>',
      { status: 503, headers: { "Content-Type": "text/html; charset=utf-8" } }
    );
  }
}

/** Primero la red; si falla, la copia guardada (datos de navegación, imágenes, manifiesto) */
async function redPrimero(request) {
  const cache = await caches.open(CACHE);
  try {
    if (sinRed()) throw new Error("sin red");
    const res = await redConEspera(request);
    if (res.ok && res.type === "basic") cache.put(request, res.clone());
    return res;
  } catch {
    const guardada = (await cache.match(request, { ignoreVary: true })) || (await caches.match(request, { ignoreVary: true }));
    // Sin copia: se devuelve un error y Next.js recarga la pantalla completa,
    // que entonces se sirve desde la caché.
    return guardada || Response.error();
  }
}

/** Copia guardada al instante y actualización en segundo plano */
async function guardadaYActualizar(event, request, clave = request) {
  const cache = await caches.open(CACHE);
  const guardada = await cache.match(clave, { ignoreVary: true });
  if (!guardada && sinRed()) return Response.error();
  // Sin copia guardada no se espera a una red lenta: si tarda, Next.js abre la
  // pantalla completa, que sale al instante de la copia guardada
  const red = (guardada ? fetch(request) : redConEspera(request, ESPERA_RSC_MS))
    .then((res) => {
      if (res.ok && res.type === "basic") return cache.put(clave, res.clone()).then(() => res);
      return res;
    })
    .catch(() => undefined);
  if (guardada) {
    event.waitUntil(red);
    return guardada;
  }
  const res = await red;
  // Sin copia ni red: error para que Next.js recargue la pantalla desde la caché
  return res || Response.error();
}

/** Primero la copia guardada (archivos con nombre único por versión) */
async function cachePrimero(request) {
  const cache = await caches.open(CACHE);
  // Los nombres son únicos por versión: sirve la copia de cualquier versión guardada
  const guardada = (await cache.match(request, { ignoreVary: true })) || (await caches.match(request, { ignoreVary: true }));
  if (guardada) return guardada;
  if (sinRed()) return Response.error();
  try {
    const res = await redConEspera(request, ESPERA_ARCHIVO_MS);
    if (res.ok && res.type === "basic") cache.put(request, res.clone());
    return res;
  } catch {
    return Response.error();
  }
}

self.addEventListener("fetch", (event) => {
  const { request } = event;
  if (request.method !== "GET") return;
  const url = new URL(request.url);
  if (url.origin !== self.location.origin) return;
  if (url.pathname.startsWith("/_next/webpack-hmr") || url.pathname.includes("__nextjs")) return;
  if (url.pathname === "/sw.js") return;

  const esRsc = request.headers.get("RSC") === "1" || url.searchParams.has("_rsc");
  const esImagen =
    url.pathname.startsWith("/_next/image") ||
    url.pathname.startsWith("/images/") ||
    /\.(png|jpe?g|webp|svg|ico|woff2?)$/i.test(url.pathname);

  if (request.mode === "navigate") {
    event.respondWith(navegar(event, request, url));
  } else if (url.pathname.startsWith("/_next/static/")) {
    event.respondWith(cachePrimero(request));
  } else if (esRsc) {
    // Cambiar de pantalla y volver atrás sin esperar a la red (clave aparte de la pantalla)
    event.respondWith(guardadaYActualizar(event, request, claveRsc(url)));
  } else if (esImagen) {
    event.respondWith(guardadaYActualizar(event, request));
  } else {
    event.respondWith(redPrimero(request));
  }
});

/* ─────────────── Mensajes desde la app (botón "Descargar para usar sin conexión") ─────────────── */

self.addEventListener("message", (event) => {
  const datos = event.data || {};
  const puerto = event.ports && event.ports[0];
  if (!puerto) return;

  if (datos.tipo === "estado") {
    event.waitUntil(
      (async () => {
        const cache = await caches.open(CACHE);
        let guardadas = 0;
        for (const ruta of RUTAS) if (await cache.match(ruta, { ignoreVary: true })) guardadas += 1;
        puerto.postMessage({ tipo: "estado", version: VERSION, guardadas, total: RUTAS.length });
      })()
    );
  }

  if (datos.tipo === "descargar-todo") {
    event.waitUntil(
      (async () => {
        try {
          const { fallidas } = await descargarTodo((hechos, total) => puerto.postMessage({ tipo: "avance", hechos, total }));
          puerto.postMessage({ tipo: "listo", version: VERSION, fallidas: fallidas.length });
        } catch (e) {
          puerto.postMessage({ tipo: "listo", version: VERSION, fallidas: -1, error: String(e) });
        }
      })()
    );
  }
});

/* ───────────── Notificaciones (llegan aunque la app esté cerrada) ───────────── */

self.addEventListener("push", (event) => {
  let d = {};
  try {
    d = event.data ? event.data.json() : {};
  } catch {
    d = { title: "Porcícola El Mirador", body: event.data ? event.data.text() : "" };
  }
  event.waitUntil(
    self.registration.showNotification(d.title || "Porcícola El Mirador", {
      body: d.body || "",
      tag: d.tag || undefined,
      icon: "/images/logo.png",
      badge: "/images/logo.png",
      data: { url: d.url || "/tareas" },
    })
  );
});

self.addEventListener("notificationclick", (event) => {
  event.notification.close();
  const url = new URL((event.notification.data && event.notification.data.url) || "/tareas", self.location.origin).href;
  event.waitUntil(
    (async () => {
      const ventanas = await self.clients.matchAll({ type: "window", includeUncontrolled: true });
      for (const v of ventanas) {
        if ("focus" in v) {
          await v.focus();
          if ("navigate" in v) return v.navigate(url);
          return;
        }
      }
      return self.clients.openWindow(url);
    })()
  );
});
