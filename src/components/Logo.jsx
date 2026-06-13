// Logo Poubelle-CI : pin de carte contenant une poubelle avec deux sachets.
// withBadge=true → carré arrondi vert foncé (icônes, favicon, fond clair).
// withBadge=false → marque seule sur fond transparent (en-tête/splash vert foncé).

export default function Logo({ size = 40, withBadge = true, style }) {
  return (
    <svg viewBox="0 0 96 96" width={size} height={size} style={style} aria-label="Poubelle-CI" role="img">
      {withBadge && <rect width="96" height="96" rx="24" fill="#14532d" />}
      {/* Pin de carte */}
      <path d="M48 14C33 14 22 25 22 40c0 16 26 42 26 42s26-26 26-42c0-15-11-26-26-26z" fill="#a3e635" />
      {/* Corps de la poubelle */}
      <path d="M37 42h22l-2.2 18c-.12 1.5-1.4 2.6-2.9 2.6H42.1c-1.5 0-2.78-1.1-2.9-2.6z" fill="#14532d" />
      {/* Rebord */}
      <rect x="35" y="39" width="26" height="4" rx="2" fill="#14532d" />
      {/* Deux sachets noués qui dépassent */}
      <rect x="38" y="30" width="9" height="12" rx="3" fill="#fff" />
      <path d="M42.5 30l-3-3 1 4z" fill="#fff" />
      <path d="M42.5 30l3-3-1 4z" fill="#fff" />
      <rect x="49" y="30" width="9" height="12" rx="3" fill="#fff" />
      <path d="M53.5 30l-3-3 1 4z" fill="#fff" />
      <path d="M53.5 30l3-3-1 4z" fill="#fff" />
    </svg>
  );
}
