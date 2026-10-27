import React, { useMemo } from "react";
import Image from "next/image";

interface HeaderProps {
  title: string;
  subtitle?: string;
  bgColor?: string;
  actions?: React.ReactNode;
  /** Si se da, el título se puede tocar (p. ej. para cambiar de granja) */
  onTitulo?: () => void;
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

function getHeaderBgStyle(isDark: boolean) {
  return {
    backgroundColor: isDark
      ? "rgba(255,255,255,0.12)"
      : "rgba(255,255,255,0.82)",
  };
}

export default function Header({
  title,
  subtitle,
  bgColor = "#f5f5f7",
  actions,
  onTitulo,
}: HeaderProps) {
  const isDark = useMemo(() => isColorDark(bgColor), [bgColor]);

  const textColor = isDark ? "text-white" : "text-slate-950";
  const subtitleColor = isDark ? "text-gray-300" : "text-slate-500";
  const iconBgColor = isDark ? "bg-white/20" : "bg-sky-900/10";
  const borderColor = isDark ? "border-white/20" : "border-white/40";

  return (
    <header
      className={`encabezado flex items-start justify-between gap-4 p-4 rounded-2xl border ${borderColor}`}
      style={getHeaderBgStyle(isDark)}
    >
      <div className="flex min-w-0 items-center gap-3">
        <div
          className={`logo-caja flex h-16 w-16 items-center justify-center rounded-3xl ${iconBgColor} shadow-sm`}
        >
          <Image
            src="/images/logo-header.png"
            alt="Logo Porcícola El Mirador"
            width={48}
            height={48}
            unoptimized
            preload
            loading="eager"
            className="h-12 w-12 rounded-2xl object-contain"
          />
        </div>
        <div className="min-w-0">
          <p className={`text-sm font-semibold uppercase tracking-[0.25em] ${subtitleColor}`}>
            Porcícola
          </p>
          {onTitulo ? (
            <button type="button" onClick={onTitulo} className="flex items-center gap-1.5 text-left active:opacity-70" aria-label={`${title}: cambiar de granja`}>
              <h1 className={`text-3xl font-black leading-tight ${textColor}`}>{title}</h1>
              <svg viewBox="0 0 20 20" className={`mt-1 h-5 w-5 shrink-0 ${subtitleColor}`} fill="none" stroke="currentColor" strokeWidth={2.2} strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                <path d="M5 8l5 5 5-5" />
              </svg>
            </button>
          ) : (
            <h1 className={`text-3xl font-black leading-tight ${textColor}`}>{title}</h1>
          )}
          {subtitle && (
            <p className={`mt-1 text-sm ${subtitleColor}`}>{subtitle}</p>
          )}
        </div>
      </div>
      {actions && <div className="flex items-center gap-2">{actions}</div>}
    </header>
  );
}
