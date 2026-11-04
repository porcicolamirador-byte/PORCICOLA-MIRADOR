/*
 * Muestra el ícono de un texto (emoji). Algunos se reemplazan por un dibujo
 * propio para que se vean igual en todos los teléfonos.
 */

/** Destete: la cerda, una flecha y el lechón que se separa */
export function IconoDestete({ className = "inline-block h-[1.2em] w-[1.2em] align-[-0.25em]" }: { className?: string }) {
  return (
    <svg viewBox="0 0 48 48" className={className} aria-hidden="true">
      <circle cx="14" cy="24" r="8" fill="#fbcfe8" />
      <circle cx="35" cy="24" r="5.5" fill="#f9a8d4" />
      <circle cx="14" cy="25.5" r="2.6" fill="#f472b6" />
      <circle cx="35" cy="25" r="1.8" fill="#f472b6" />
      <path d="M23 24h5M26 21l3 3-3 3" fill="none" stroke="#f59e0b" strokeWidth={2.6} strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

export default function Emoji({ e }: { e: string }) {
  if (e === "🍼") return <IconoDestete />;
  return <>{e}</>;
}
