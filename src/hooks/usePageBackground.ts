import { useEffect } from "react";

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

export default function usePageBackground(bgColor: string) {
  useEffect(() => {
    const root = document.documentElement;
    const body = document.body;

    const prevBg = root.style.getPropertyValue("--page-bg");
    const prevFg = root.style.getPropertyValue("--page-fg");

    const isDark = isColorDark(bgColor);
    const pageFg = isDark ? "#ffffff" : "#111827";

    root.style.setProperty("--page-bg", bgColor);
    root.style.setProperty("--page-fg", pageFg);
    body.style.setProperty("--page-bg", bgColor);
    body.style.setProperty("--page-fg", pageFg);

    return () => {
      if (prevBg) {
        root.style.setProperty("--page-bg", prevBg);
        body.style.setProperty("--page-bg", prevBg);
      } else {
        root.style.removeProperty("--page-bg");
        body.style.removeProperty("--page-bg");
      }

      if (prevFg) {
        root.style.setProperty("--page-fg", prevFg);
        body.style.setProperty("--page-fg", prevFg);
      } else {
        root.style.removeProperty("--page-fg");
        body.style.removeProperty("--page-fg");
      }
    };
  }, [bgColor]);
}
