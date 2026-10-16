import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Identificador de cada build: al publicar una versión nueva, el service
  // worker se reinstala y vuelve a descargar todo para uso sin conexión.
  env: {
    NEXT_PUBLIC_BUILD_ID: String(Date.now()),
  },
  // El service worker nunca debe quedar en caché del navegador
  async headers() {
    return [
      {
        source: "/sw.js",
        headers: [
          { key: "Content-Type", value: "application/javascript; charset=utf-8" },
          { key: "Cache-Control", value: "no-cache, no-store, must-revalidate" },
          { key: "Service-Worker-Allowed", value: "/" },
        ],
      },
    ];
  },
  // Permite abrir el servidor de desarrollo (npm run dev) desde el celular
  // u otro equipo usando la IP del computador. Sin esto Next bloquea el
  // JavaScript en modo desarrollo y la pantalla de carga nunca avanza.
  // Solo aplica a `npm run dev`; no afecta el build de producción.
  allowedDevOrigins: [
    "20.50.1.110",
    "192.168.*.*",
    "10.*.*.*",
    "172.*.*.*",
    "*.local",
  ],
  turbopack: {
    rules: {
      "*.css": {
        loaders: ["@tailwindcss/turbopack"],
        as: "*.css",
      },
    },
  },
};

export default nextConfig;
