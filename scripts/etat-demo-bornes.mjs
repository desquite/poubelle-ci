// Donne au parc un état de remplissage varié, pour que la carte montre les
// trois couleurs pendant une démonstration.
//   node scripts/etat-demo-bornes.mjs
//
// Passe par l'action « etat » de l'API : ce sont des relevés de capteur, pas
// de faux dépôts citoyens. Aucun crédit n'est généré.
//
// Les bornes de YOPOUGON restent volontairement sous 80 % : c'est la seule
// commune où un collecteur est inscrit, et franchir ce seuil lui enverrait un
// vrai message WhatsApp.

import { readFileSync } from "fs";

const BASE = process.argv[2]?.replace(/\/$/, "") || "https://poubelle-ci.vercel.app";
const cles = JSON.parse(readFileSync("bornes-cles.json", "utf8"));

const CAPACITE_KG = 400;
const HAUTEUR_UTILE_CM = 120;
const TARE_KG = 85;

const CIBLES = {
  "BRN-COCODY-001": 34,
  "BRN-COCODY-002": 84,
  "BRN-COCODY-003": 97,
  "BRN-ABOBO-001": 88,
  "BRN-ADJAME-001": 12,
  "BRN-MARCORY-001": 96,
  "BRN-YOPOUGON-001": 23,
  "BRN-YOPOUGON-002": 61,
};

for (const [code, pct] of Object.entries(CIBLES)) {
  const poidsTotalKg = Math.round((TARE_KG + (CAPACITE_KG * pct) / 100) * 10) / 10;
  const hauteurLibreCm = Math.round(HAUTEUR_UTILE_CM * (1 - pct / 100));

  const r = await fetch(`${BASE}/api/borne`, {
    method: "POST",
    headers: { "Content-Type": "application/json", "x-borne-cle": cles[code] },
    body: JSON.stringify({ action: "etat", borneCode: code, poidsTotalKg, hauteurLibreCm }),
  });
  const d = await r.json().catch(() => ({}));

  const couleur = d.remplissagePct >= 95 ? "🔴" : d.remplissagePct >= 80 ? "🟠" : "🟢";
  console.log(`  ${couleur} ${code.padEnd(18)} ${String(d.remplissagePct ?? "?").padStart(3)} %`);
}

console.log("\nParc prêt pour la démonstration.\n");
process.exit(0);
