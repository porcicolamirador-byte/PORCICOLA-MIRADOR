/*
 * Service worker de Porcícola El Mirador
 * ------------------------------------------------------------
 * Permite abrir y usar la app sin internet ni servidor:
 *  - Al instalarse descarga todas las pantallas y sus archivos (JS, CSS,
 *    fuentes, imágenes) y los guarda en el teléfono.
 *  - Pantallas: primero intenta la red (para tener siempre la última versión)
 *    y, si no hay conexión o el servidor no responde, usa la copia guardada.
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
  "/tareas",
  "/monitoreo",
  "/bodega",
  "/programacion",
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

async function precargar() {
  const cache = await caches.open(CACHE);
  const pendientes = new Set(ARCHIVOS);
  const fallidas = [];

  for (const ruta of RUTAS) {
    const res = await guardar(cache, ruta);
    if (res) extraerRecursos(await res.text()).forEach((u) => pendientes.add(u));
    else if (res === null) fallidas.push(ruta);
  }

  const css = [];
  await Promise.all(
    [...pendientes].map(async (url) => {
      const res = await guardar(cache, url);
      if (res === null && url.startsWith("/_next/static/")) fallidas.push(url);
      if (res && url.split("?")[0].endsWith(".css")) css.push(await res.text());
    })
  );

  // Fuentes y archivos que solo aparecen dentro del CSS
  const extra = new Set();
  css.forEach((t) => extraerRecursos(t).forEach((u) => !pendientes.has(u) && extra.add(u)));
  await Promise.all([...extra].map((u) => guardar(cache, u)));

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

async function plantillaCerda(cache, pathname) {
  if (!pathname.startsWith("/cerda/")) return undefined;
  const ruta = pathname.replace(/\/+$/, "").endsWith("/parto") ? "/cerda/_/parto" : "/cerda/_";
  return cache.match(ruta, { ignoreVary: true });
}

async function navegar(request, url) {
  const cache = await caches.open(CACHE);
  try {
    if (sinRed()) throw new Error("sin red");
    const res = await limpia(await redConEspera(request));
    // Un error del servidor (500, 502…) se trata como si no hubiera conexión
    if (res.status >= 500) throw new Error(`servidor ${res.status}`);
    if (res.ok) cache.put(url.pathname, res.clone());
    return res;
  } catch {
    const guardada =
      (await cache.match(url.pathname, { ignoreVary: true, ignoreSearch: true })) ||
      (await plantillaCerda(cache, url.pathname)) ||
      (await caches.match(url.pathname, { ignoreVary: true, ignoreSearch: true })) ||
      (await cache.match("/dashboard", { ignoreVary: true })) ||
      (await caches.match("/dashboard", { ignoreVary: true }));
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
async function guardadaYActualizar(event, request) {
  const cache = await caches.open(CACHE);
  const guardada = await cache.match(request, { ignoreVary: true });
  if (!guardada && sinRed()) return Response.error();
  // Sin copia guardada, no se espera a una red lenta más de unos segundos
  const red = (guardada ? fetch(request) : redConEspera(request))
    .then((res) => {
      if (res.ok && res.type === "basic") return cache.put(request, res.clone()).then(() => res);
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
    event.respondWith(navegar(request, url));
  } else if (url.pathname.startsWith("/_next/static/")) {
    event.respondWith(cachePrimero(request));
  } else if (esRsc || esImagen) {
    // Cambiar de pantalla y volver atrás sin esperar a la red
    event.respondWith(guardadaYActualizar(event, request));
  } else {
    event.respondWith(redPrimero(request));
  }
});
