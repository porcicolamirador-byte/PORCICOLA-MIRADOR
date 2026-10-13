import React, { useMemo } from "react";

interface CardProps {
  nombre: string;
  valor: string | number;
  detalle: string;
  icon: string;
  iconBg?: string;
  bgColor?: string;
}

// Función para calcular si un color es claro u oscuro
function isColorDark(color: string): boolean {
  if (!color) return false;

  let r = 0, g = 0, b = 0;

  if (color.startsWith("#")) {
    const hex = color.replace("#", "");
    r = parseInt(hex.substring(0, 2), 16);
    g = parseInt(hex.substring(2, 4), 16);
    b = parseInt(hex.substring(4, 6), 16);
  } else if (color.includes("rgb")) {
    const match = color.match(/\d+/g);
    if (match) {
      r = parseInt(match[0]);
      g = parseInt(match[1]);
      b = parseInt(match[2]);
    }
  }

  const luminancia = (0.299 * r + 0.587 * g + 0.114 * b) / 255;
  return luminancia < 0.5;
}

export default function SummaryCard({
  nombre,
  valor,
  detalle,
  icon,
  iconBg = "bg-emerald-50 text-emerald-700",
  bgColor = "#f5f5f7",
}: CardProps) {
  const isDark = useMemo(() => isColorDark(bgColor), [bgColor]);

  const cardBgColor = isDark
    ? "bg-slate-900/80 backdrop-blur-xl"
    : "bg-white/60 backdrop-blur-xl";
  const textColor = isDark ? "text-white" : "text-slate-950";
  const detailColor = isDark ? "text-gray-300" : "text-slate-500";
  const borderColor = isDark ? "ring-white/10" : "ring-white/40";

  return (
    <div className={`rounded-2xl ${cardBgColor} px-2 py-1 shadow-sm ring-1 ${borderColor}`}>
      <div className="flex items-center justify-between gap-2">
        <div
          className={`inline-flex h-7 w-7 items-center justify-center rounded-2xl ${iconBg}`}
        >
          <span className="text-base">{icon}</span>
        </div>
        <div className="text-right">
          <p
            className={`text-[10px] font-semibold uppercase tracking-[0.12em] ${detailColor}`}
          >
            {detalle}
          </p>
          <p className={`text-base font-black ${textColor}`}>{valor}</p>
        </div>
      </div>
      <p
        className={`mt-1 text-[9px] font-semibold uppercase tracking-[0.12em] ${
          isDark ? "text-gray-300" : "text-slate-700"
        }`}
      >
        {nombre}
      </p>
    </div>
  );
}
