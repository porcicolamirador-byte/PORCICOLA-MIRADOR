import { useEffect } from "react";

const BLANCO = "#ffffff";

function isColorDark(color: string): boolean {
  if (!color) return false;

  let r = 255;
  let g = 255;
  let b = 255;

  if (color.startsWith("#")) {
    const hex = color.replace("#", "");
    r = parseInt(hex.substring(0, 2), 16);
    g = parseInt(hex.substring(2, 4), 16);
    b = parseInt(hex.substring(4, 6), 16);
  } else if (color.includes("rgb")) {
    const match = color.match(/\d+/g);
    if (match) {
      r = parseInt(match[0], 10);
      g = parseInt(match[1], 10);
      b = parseInt(match[2], 10);
    }
  }

  const luminance = (0.299 * r + 0.587 * g + 0.114 * b) / 255;
  return luminance < 0.5;
}

/** Pone (o crea) <meta name="theme-color">, que Safari usa para la zona de la isla dinámica. */
function setThemeColor(color: string) {
  const metas = document.querySelectorAll<HTMLMetaElement>('meta[name="theme-color"]');
  if (metas.length === 0) {
    const meta = document.createElement("meta");
    meta.name = "theme-color";
    meta.content = color;
    document.head.appendChild(meta);
    return;
  }
  metas.forEach((m) => {
    m.removeAttribute("media");
    m.content = color;
  });
}

/**
 * Cambia el color de fondo global (html, body, barra de estado e isla dinámica)
 * al color de la página. Al salir de la página vuelve a blanco.
 */
export default function usePageBackground(bgColor: string = BLANCO) {
  useEffect(() => {
    const root = document.documentElement;
    const color = bgColor || BLANCO;
    const pageFg = isColorDark(color) ? "#ffffff" : "#111827";

    root.style.setProperty("--page-bg", color);
    root.style.setProperty("--page-fg", pageFg);
    root.style.backgroundColor = color;
    document.body.style.backgroundColor = color;
    setThemeColor(color);

    return () => {
      root.style.setProperty("--page-bg", BLANCO);
      root.style.setProperty("--page-fg", "#111827");
      root.style.backgroundColor = BLANCO;
      document.body.style.backgroundColor = BLANCO;
      setThemeColor(BLANCO);
    };
  }, [bgColor]);
}
