/** Bulto de alimento de 40 kg (ícono a color para los encabezados) */
export default function IconoBulto({ className = "h-10 w-10" }: { className?: string }) {
  return (
    <svg viewBox="0 0 48 48" className={className} aria-hidden="true">
      <path
        d="M14 9c3 1.6 6.6 2.4 10 2.4S31 10.6 34 9l1.2 4.2c3.1 6.6 4.3 14.6 3.4 23.8-.3 3-2.5 5.3-5.5 5.6-6 .6-12.2.6-18.2 0-3-.3-5.2-2.6-5.5-5.6-.9-9.2.3-17.2 3.4-23.8z"
        fill="#f3e6c8"
        stroke="#c9a96b"
        strokeWidth={1.4}
        strokeLinejoin="round"
      />
      <path d="M13.5 13.5c3.4 1.3 6.9 2 10.5 2s7.1-.7 10.5-2" fill="none" stroke="#c9a96b" strokeWidth={1.3} strokeDasharray="2 1.6" strokeLinecap="round" />
      <path d="M15 7.5l2 1.6M20 8.8l1 1.8M28 8.8l-1 1.8M33 7.5l-2 1.6" stroke="#c9a96b" strokeWidth={1.3} strokeLinecap="round" />
      <rect x="11.5" y="21" width="25" height="12" rx="2.5" fill="#15803d" />
      <text x="24" y="30.2" textAnchor="middle" fontFamily="Arial, Helvetica, sans-serif" fontWeight={800} fontSize={8.6} fill="#fff">
        40 kg
      </text>
    </svg>
  );
}
