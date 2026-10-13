import React, { useMemo } from "react";
import Image from "next/image";

interface HeaderProps {
  title: string;
  subtitle?: string;
  bgColor?: string;
  actions?: React.ReactNode;
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
}: HeaderProps) {
  const isDark = useMemo(() => isColorDark(bgColor), [bgColor]);

  const textColor = isDark ? "text-white" : "text-slate-950";
  const subtitleColor = isDark ? "text-gray-300" : "text-slate-500";
  const iconBgColor = isDark ? "bg-white/20" : "bg-emerald-900/10";
  const borderColor = isDark ? "border-white/20" : "border-white/40";

  return (
    <header
      className={`flex items-start justify-between gap-4 p-4 rounded-2xl border ${borderColor}`}
      style={getHeaderBgStyle(isDark)}
    >
      <div className="flex items-center gap-3">
        <div
          className={`flex h-16 w-16 items-center justify-center rounded-3xl ${iconBgColor} shadow-sm`}
        >
          <Image
            src="/logo.png"
            alt="Logo Porcícola El Mirador"
            width={48}
            height={48}
            className="h-12 w-12 rounded-2xl object-contain"
          />
        </div>
        <div>
          <p className={`text-sm font-semibold uppercase tracking-[0.25em] ${subtitleColor}`}>
            Porcícola
          </p>
          <h1 className={`text-3xl font-black leading-tight ${textColor}`}>
            {title}
          </h1>
          {subtitle && (
            <p className={`mt-1 text-sm ${subtitleColor}`}>{subtitle}</p>
          )}
        </div>
      </div>
      {actions && <div className="flex items-center gap-2">{actions}</div>}
    </header>
  );
}
