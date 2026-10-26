"use client";

import { useEffect, useState, type ReactNode } from "react";

/* Componentes de interfaz compartidos por los módulos. */

export function Tarjeta({
  titulo,
  accion,
  children,
  className = "",
}: {
  titulo?: string;
  accion?: ReactNode;
  children: ReactNode;
  className?: string;
}) {
  return (
    <section className={`rounded-3xl bg-white p-4 ring-1 ring-slate-200/80 ${className}`}>
      {(titulo || accion) && (
        <div className="mb-3 flex items-center justify-between gap-2">
          {titulo && <h2 className="text-[15px] font-semibold text-slate-900">{titulo}</h2>}
          {accion}
        </div>
      )}
      {children}
    </section>
  );
}

export function Dato({
  titulo,
  valor,
  detalle,
}: {
  titulo: string;
  valor: ReactNode;
  detalle?: string;
}) {
  return (
    <div className="rounded-2xl bg-white p-3.5 ring-1 ring-slate-200/80">
      <p className="text-xs font-medium text-slate-500">{titulo}</p>
      <p className="mt-0.5 text-2xl font-semibold leading-tight tracking-tight text-slate-900 tabular-nums">
        {valor}
      </p>
      {detalle && <p className="mt-0.5 text-[11px] leading-snug text-slate-500">{detalle}</p>}
    </div>
  );
}

export function Vacio({
  titulo,
  texto,
  accion,
}: {
  titulo: string;
  texto: string;
  accion?: ReactNode;
}) {
  return (
    <div className="flex flex-col items-center gap-2 rounded-3xl border border-dashed border-slate-300 bg-white px-6 py-10 text-center">
      <p className="font-semibold text-slate-900">{titulo}</p>
      <p className="max-w-xs text-sm text-slate-500">{texto}</p>
      {accion && <div className="mt-2">{accion}</div>}
    </div>
  );
}

export function Boton({
  children,
  onClick,
  type = "button",
  variante = "primario",
  className = "",
  disabled,
}: {
  children: ReactNode;
  onClick?: () => void;
  type?: "button" | "submit";
  variante?: "primario" | "secundario" | "peligro" | "suave";
  className?: string;
  disabled?: boolean;
}) {
  const estilos = {
    primario: "bg-sky-900 text-white hover:bg-sky-950",
    secundario: "bg-white text-slate-800 ring-1 ring-slate-300 hover:bg-slate-50",
    peligro: "bg-rose-600 text-white hover:bg-rose-700",
    suave: "bg-slate-100 text-slate-800 hover:bg-slate-200",
  }[variante];
  return (
    <button
      type={type}
      onClick={onClick}
      disabled={disabled}
      className={`inline-flex items-center justify-center gap-1.5 rounded-full px-4 py-2.5 text-sm font-semibold transition active:scale-95 disabled:opacity-40 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-600 focus-visible:ring-offset-2 ${estilos} ${className}`}
    >
      {children}
    </button>
  );
}

/* Los campos usan text-base (16px) para que el iPhone no haga zoom al escribir. */
const claseCampo =
  "block w-full min-w-0 max-w-full appearance-none rounded-xl bg-slate-50 px-3.5 py-2.5 text-base text-slate-900 ring-1 ring-slate-200 placeholder:text-slate-400 focus:bg-white focus:outline-none focus:ring-2 focus:ring-emerald-600";

export function Campo({
  etiqueta,
  children,
  ayuda,
}: {
  etiqueta: string;
  children: ReactNode;
  ayuda?: string;
}) {
  return (
    <label className="flex min-w-0 flex-col gap-1.5">
      <span className="text-[13px] font-medium text-slate-700">{etiqueta}</span>
      {children}
      {ayuda && <span className="text-xs text-slate-500">{ayuda}</span>}
    </label>
  );
}

export function Entrada({
  value,
  onChange,
  type = "text",
  placeholder,
  required,
  min,
  step,
  inputMode,
}: {
  value: string | number;
  onChange: (v: string) => void;
  type?: "text" | "number" | "date" | "time";
  placeholder?: string;
  required?: boolean;
  min?: number;
  step?: number | "any";
  inputMode?: "text" | "numeric" | "decimal";
}) {
  return (
    <input
      type={type}
      value={value}
      onChange={(e) => onChange(e.target.value)}
      placeholder={placeholder}
      required={required}
      min={min}
      step={step}
      inputMode={inputMode}
      className={claseCampo}
    />
  );
}

export function Selector({
  value,
  onChange,
  opciones,
}: {
  value: string;
  onChange: (v: string) => void;
  opciones: { valor: string; texto: string; deshabilitado?: boolean }[];
}) {
  return (
    <select value={value} onChange={(e) => onChange(e.target.value)} className={claseCampo}>
      {opciones.map((o) => (
        <option key={o.valor} value={o.valor} disabled={o.deshabilitado}>
          {o.texto}
        </option>
      ))}
    </select>
  );
}

export function Chips<T extends string>({
  opciones,
  valor,
  onChange,
}: {
  opciones: { valor: T; texto: string }[];
  valor: T;
  onChange: (v: T) => void;
}) {
  return (
    <div className="-mx-4 flex gap-2 overflow-x-auto px-4 pb-1 [scrollbar-width:none]">
      {opciones.map((o) => (
        <button
          key={o.valor}
          type="button"
          onClick={() => onChange(o.valor)}
          className={`shrink-0 rounded-full px-3.5 py-1.5 text-[13px] font-medium transition ${
            valor === o.valor
              ? "bg-slate-900 text-white"
              : "bg-white text-slate-600 ring-1 ring-slate-200 hover:bg-slate-50"
          }`}
        >
          {o.texto}
        </button>
      ))}
    </div>
  );
}

/** Hoja inferior (modal) para formularios y detalles. */
export function Hoja({
  abierta,
  titulo,
  onCerrar,
  children,
}: {
  abierta: boolean;
  titulo: string;
  onCerrar: () => void;
  children: ReactNode;
}) {
  useEffect(() => {
    if (!abierta) return;
    const alPresionar = (e: KeyboardEvent) => e.key === "Escape" && onCerrar();
    window.addEventListener("keydown", alPresionar);
    const overflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      window.removeEventListener("keydown", alPresionar);
      document.body.style.overflow = overflow;
    };
  }, [abierta, onCerrar]);

  if (!abierta) return null;

  return (
    <div className="fixed inset-0 z-[60] flex items-end justify-center sm:items-center" role="dialog" aria-modal="true" aria-label={titulo}>
      <button
        type="button"
        aria-label="Cerrar"
        onClick={onCerrar}
        className="absolute inset-0 bg-slate-950/40 backdrop-blur-[2px]"
      />
      <div
        className="relative max-h-[92dvh] w-full max-w-lg overflow-y-auto overflow-x-hidden overscroll-contain rounded-t-[28px] bg-white px-5 pt-3 shadow-2xl sm:rounded-[28px]"
        style={{ paddingBottom: "calc(env(safe-area-inset-bottom) + 1.25rem)" }}
      >
        <div className="mx-auto mb-3 h-1.5 w-10 rounded-full bg-slate-200 sm:hidden" />
        <div className="mb-4 flex items-center justify-between gap-3">
          <h2 className="text-lg font-semibold text-slate-900">{titulo}</h2>
          <button
            type="button"
            onClick={onCerrar}
            aria-label="Cerrar"
            className="flex h-9 w-9 items-center justify-center rounded-full bg-slate-100 text-slate-600 hover:bg-slate-200"
          >
            <svg viewBox="0 0 24 24" className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth={2.2} strokeLinecap="round" aria-hidden="true">
              <path d="M6 6l12 12M18 6 6 18" />
            </svg>
          </button>
        </div>
        {children}
      </div>
    </div>
  );
}

export function Insignia({ children, clase }: { children: ReactNode; clase: string }) {
  return (
    <span className={`inline-flex shrink-0 items-center rounded-full px-2 py-0.5 text-[11px] font-semibold ring-1 ring-inset ${clase}`}>
      {children}
    </span>
  );
}

export function IconoMas() {
  return (
    <svg viewBox="0 0 24 24" className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth={2.2} strokeLinecap="round" aria-hidden="true">
      <path d="M12 5v14M5 12h14" />
    </svg>
  );
}

export function Chevron() {
  return (
    <svg viewBox="0 0 24 24" className="h-4 w-4 shrink-0 text-slate-400" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d="M9 6l6 6-6 6" />
    </svg>
  );
}

/** Interruptor tipo iPhone */
export function Interruptor({ activo, onCambiar }: { activo: boolean; onCambiar: (v: boolean) => void }) {
  return (
    <span className="relative inline-flex shrink-0">
      <input
        type="checkbox"
        role="switch"
        checked={activo}
        onChange={(e) => onCambiar(e.target.checked)}
        className="peer absolute inset-0 h-full w-full cursor-pointer opacity-0"
      />
      <span
        aria-hidden="true"
        className={`flex h-[31px] w-[51px] items-center rounded-full p-[2px] transition-colors peer-focus-visible:ring-2 peer-focus-visible:ring-emerald-300 ${
          activo ? "bg-emerald-600" : "bg-slate-300"
        }`}
      >
        <span className={`h-[27px] w-[27px] rounded-full bg-white shadow transition-transform ${activo ? "translate-x-5" : ""}`} />
      </span>
    </span>
  );
}

/** Sección que se despliega y oculta (historial, movimientos…); cerrada por defecto */
export function SeccionDesplegable({
  titulo,
  cantidad,
  children,
  inicialAbierta = false,
}: {
  titulo: string;
  cantidad?: number;
  children: ReactNode;
  inicialAbierta?: boolean;
}) {
  const [abierta, setAbierta] = useState(inicialAbierta);
  return (
    <div className="overflow-hidden rounded-2xl ring-1 ring-slate-200/80">
      <button
        type="button"
        onClick={() => setAbierta((a) => !a)}
        aria-expanded={abierta}
        className="flex w-full items-center gap-2 bg-slate-50 px-3.5 py-2.5 text-left active:bg-slate-100"
      >
        <span className="flex-1 text-sm font-semibold text-slate-900">{titulo}</span>
        {cantidad !== undefined && (
          <span className="rounded-full bg-slate-200 px-2 py-0.5 text-[11px] font-semibold tabular-nums text-slate-700">{cantidad}</span>
        )}
        <span className="text-xs font-medium text-emerald-700">{abierta ? "Ocultar" : "Ver"}</span>
        <svg
          viewBox="0 0 24 24"
          aria-hidden="true"
          className={`h-4 w-4 shrink-0 text-slate-400 transition-transform duration-200 ${abierta ? "rotate-180" : ""}`}
          fill="none"
          stroke="currentColor"
          strokeWidth={2.4}
          strokeLinecap="round"
          strokeLinejoin="round"
        >
          <path d="m6 9 6 6 6-6" />
        </svg>
      </button>
      {abierta && <div className="border-t border-slate-100 p-2">{children}</div>}
    </div>
  );
}
