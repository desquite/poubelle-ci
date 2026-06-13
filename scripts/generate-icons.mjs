// Génère les icônes PWA (icon-192/512.png) depuis le logo Poubelle-CI.
// Fond carré plein (sans coins arrondis) : iOS et Android appliquent leur
// propre masque, donc on évite les coins transparents disgracieux.

import sharp from "sharp";

const svg = `<svg viewBox="0 0 96 96" xmlns="http://www.w3.org/2000/svg">
  <rect width="96" height="96" fill="#14532d"/>
  <path d="M48 14C33 14 22 25 22 40c0 16 26 42 26 42s26-26 26-42c0-15-11-26-26-26z" fill="#a3e635"/>
  <path d="M37 42h22l-2.2 18c-.12 1.5-1.4 2.6-2.9 2.6H42.1c-1.5 0-2.78-1.1-2.9-2.6z" fill="#14532d"/>
  <rect x="35" y="39" width="26" height="4" rx="2" fill="#14532d"/>
  <rect x="38" y="30" width="9" height="12" rx="3" fill="#fff"/>
  <path d="M42.5 30l-3-3 1 4z" fill="#fff"/>
  <path d="M42.5 30l3-3-1 4z" fill="#fff"/>
  <rect x="49" y="30" width="9" height="12" rx="3" fill="#fff"/>
  <path d="M53.5 30l-3-3 1 4z" fill="#fff"/>
  <path d="M53.5 30l3-3-1 4z" fill="#fff"/>
</svg>`;

for (const size of [192, 512]) {
  const out = `public/icon-${size}.png`;
  await sharp(Buffer.from(svg)).resize(size, size).png().toFile(out);
  console.log("✅", out);
}

console.log("Terminé.");
