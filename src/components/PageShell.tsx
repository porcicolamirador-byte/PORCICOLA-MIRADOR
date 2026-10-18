"use client";

import React, { useMemo } from "react";
import usePageBackground from "@/hooks/usePageBackground";

interface PageShellProps {
  bgColor?: string;
  className?: string;
  children: React.ReactNode;
}

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

export default function PageShell({
  bgColor = "#ffffff",
  className = "",
  children,
}: PageShellProps) {
  usePageBackground(bgColor);

  const isDark = useMemo(() => isColorDark(bgColor), [bgColor]);
  const textColor = isDark ? "text-white" : "text-slate-900";
  // Páginas blancas: usan el fondo del tema (blanco o negro en modo oscuro)
  const blanca = !bgColor || ["#ffffff", "#fff", "white"].includes(bgColor.toLowerCase());
  const backgroundColor = blanca ? "var(--page-bg, #ffffff)" : bgColor;

  return (
    <main
      className={`min-h-screen px-4 pt-4 pb-24 sm:px-6 ${textColor} ${className}`}
      style={{
        backgroundColor,
        color: blanca ? "var(--page-fg, #111827)" : isDark ? "#ffffff" : "#111827",
        // El contenido no queda debajo de la isla dinámica / notch
        paddingTop: "calc(env(safe-area-inset-top) + 1rem)",
      }}
    >
      {children}
    </main>
  );
}
