// Simulateur de borne : joue le scénario de démonstration complet contre
// /api/borne, sans une seule vis.
//
//   node scripts/simuler-borne.mjs                      → sur la production
//   node scripts/simuler-borne.mjs http://localhost:3000 → sur `vercel dev`
//
// Nécessite bornes-cles.json (créé par scripts/creer-bornes.mjs).

import { readFileSync } from "fs";

const BASE = process.argv[2]?.replace(/\/$/, "") || "https://poubelle-ci.vercel.app";
const cles = JSON.parse(readFileSync("bornes-cles.json", "utf8"));

const BORNE = "BRN-COCODY-001";
const DEPOSANT = "2250709646096";

// Géométrie de la borne, pour convertir un volume déposé en hauteur restante.
const HAUTEUR_UTILE_CM = 120;
const SURFACE_M2 = 1.5;
const TARE_KG = 85;

let poidsTotalKg = TARE_KG;
let hauteurLibreCm = HAUTEUR_UTILE_CM;

const pause = (ms) => new Promise((r) => setTimeout(r, ms));

async function appeler(action, corps = {}) {
  const r = await fetch(`${BASE}/api/borne`, {
    method: "POST",
    headers: { "Content-Type": "application/json", "x-borne-cle": cles[BORNE] },
    body: JSON.stringify({ action, borneCode: BORNE, ...corps }),
  });
  const data = await r.json().catch(() => ({}));
  if (!r.ok) throw new Error(`${r.status} — ${data.error || "erreur"}`);
  return data;
}

async function deposer(libelle, poidsKg, volumeM3, uid = DEPOSANT) {
  poidsTotalKg += poidsKg;
  hauteurLibreCm = Math.max(0, hauteurLibreCm - (volumeM3 / SURFACE_M2) * 100);

  const d = await appeler("depot", {
    uid, poidsKg, volumeM3,
    poidsTotalKg: Math.round(poidsTotalKg * 10) / 10,
    hauteurLibreCm: Math.round(hauteurLibreCm),
  });

  const densite = Math.round(poidsKg / volumeM3);
  console.log(`\n▸ ${libelle}`);
  console.log(`  ${poidsKg} kg · ${volumeM3} m³ · ${densite} kg/m³`);

  if (!d.accepte) {
    console.log(`  ⛔ DÉPÔT REFUSÉ — ${d.message}`);
    if (d.borneDeReport) {
      console.log(`  ➜ Borne la plus proche : ${d.borneDeReport.nom} (${d.borneDeReport.distanceM} m)`);
    }
    // Le dépôt n'est pas entré : on annule la mesure locale.
    poidsTotalKg -= poidsKg;
    hauteurLibreCm = Math.min(HAUTEUR_UTILE_CM, hauteurLibreCm + (volumeM3 / SURFACE_M2) * 100);
    return d;
  }

  if (d.remunere) {
    console.log(`  ✅ ${d.kgRemuneres} kg rémunérés → 💳 ${d.creditFcfa} FCFA de crédit internet`);
  } else {
    console.log(`  ⚠️  Accepté mais NON rémunéré — ${d.message}`);
  }
  if (d.remplissagePct != null) {
    const barre = "█".repeat(Math.round(d.remplissagePct / 5)).padEnd(20, "░");
    console.log(`  Remplissage : ${barre} ${d.remplissagePct} %`);
  }
  return d;
}

console.log(`\n╔══ Simulation borne ${BORNE} ══`);
console.log(`║  cible : ${BASE}\n`);

// 1 — Le geste normal, celui qu'on veut encourager.
await deposer("Un ménage dépose son sac du soir", 4.2, 0.014);
await pause(400);

// 2 — La fraude au sable : acceptée physiquement, jamais payée.
await deposer("Quelqu'un vide un seau de sable", 14, 0.009);
await pause(400);

// 3 — Le délai : deuxième dépôt du même numéro trop rapproché.
await deposer("Le même numéro revient 2 minutes après", 3, 0.01);
await pause(400);

// 4 — D'autres habitants remplissent la borne.
for (let i = 1; i <= 6; i++) {
  await deposer(`Habitant du quartier n°${i}`, 8, 0.28, `22507000000${i}`);
  await pause(250);
}

// 5 — La borne est pleine : refus, mais on indique toujours où aller.
await deposer("Un habitant arrive alors que la borne est pleine", 5, 0.02, "2250700000099");
await pause(400);

// 6 — Le vidage : la déclaration ne suffit pas, le poids doit retomber.
console.log("\n▸ Le prestataire déclare un vidage SANS vider");
const faux = await appeler("vidage", {
  prestataireId: "2250700000123",
  poidsTotalKg: Math.round(poidsTotalKg * 10) / 10,
  hauteurLibreCm: Math.round(hauteurLibreCm),
});
console.log(`  ${faux.valide ? "✅" : "⛔"} ${faux.message}`);

console.log("\n▸ Le prestataire vide réellement la borne");
poidsTotalKg = TARE_KG;
hauteurLibreCm = HAUTEUR_UTILE_CM;
const vrai = await appeler("vidage", {
  prestataireId: "2250700000123",
  poidsTotalKg, hauteurLibreCm,
});
console.log(`  ${vrai.valide ? "✅" : "⛔"} ${vrai.message} — remplissage ${vrai.remplissagePct} %`);

console.log("\n╚══ Fin de la simulation\n");
process.exit(0);
