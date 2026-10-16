import type { MetadataRoute } from "next";

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "Porcícola El Mirador",
    short_name: "El Mirador",
    description: "Gestión de producción porcina",
    start_url: "/",
    scope: "/",
    display: "standalone",
    orientation: "portrait",
    background_color: "#ffffff",
    theme_color: "#ffffff",
    lang: "es",
    icons: [
      { src: "/images/icons/icon-192.png", sizes: "192x192", type: "image/png", purpose: "any" },
      { src: "/images/icons/icon-512.png", sizes: "512x512", type: "image/png", purpose: "any" },
      { src: "/images/icons/maskable-512.png", sizes: "512x512", type: "image/png", purpose: "maskable" },
      { src: "/apple-icon.png", sizes: "180x180", type: "image/png" },
    ],
  };
}
