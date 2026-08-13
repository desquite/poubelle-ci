// Vérification du moteur anti-fraude des bornes.
//   node scripts/test-antifraude.mjs
//
// Aucune dépendance, aucun accès réseau : les règles sont des fonctions pures.

import {
  evaluerDepot, remplissagePct, densiteKgM3,
  TARIF_FCFA_PAR_KG, PLAFOND_DEPOT_KG, PLAFOND_JOUR_KG, MOTIFS,
} from "../api/_bornes.js";

const borne = {
  id: "BRN-COCODY-001", commune: "COCODY",
  etat: "ouverte", remplissagePct: 30,
  capaciteKg: 400, hauteurUtileCm: 120,
};

let ok = 0, ko = 0;
const verifier = (titre, condition, detail) => {
  if (condition) { ok++; console.log(`  ✓ ${titre}`); }
  else { ko++; console.log(`  ✗ ${titre}\n      ${detail}`); }
};

console.log("\n── Densité : la parade au sable ──");
{
  // 6 kg d'ordures ménagères dans 0,02 m³ → 300 kg/m³ : normal.
  const d = evaluerDepot({ borne, poidsKg: 6, volumeM3: 0.02 });
  verifier(`ordures 300 kg/m³ → ${d.creditFcfa} FCFA`,
    d.remunere && d.creditFcfa === 6 * TARIF_FCFA_PAR_KG, JSON.stringify(d));

  // 15 kg de sable dans 0,01 m³ → 1500 kg/m³.
  const s = evaluerDepot({ borne, poidsKg: 15, volumeM3: 0.01 });
  verifier("seau de sable 1500 kg/m³ → accepté mais NON rémunéré",
    s.accepte && !s.remunere && s.motif === MOTIFS.DENSITE, JSON.stringify(s));
  verifier("sable → score de fraude élevé", s.scoreFraude >= 80, JSON.stringify(s));

  // Cartons : légers et volumineux, doivent passer sans souci.
  const c = evaluerDepot({ borne, poidsKg: 2, volumeM3: 0.05 });
  verifier(`cartons 40 kg/m³ → ${c.creditFcfa} FCFA`, c.remunere, JSON.stringify(c));

  verifier("densité calculée correctement", densiteKgM3(15, 0.01) === 1500);
}

console.log("\n── Plafonds en cascade ──");
{
  // 18 kg d'un coup : écrêté au plafond par dépôt.
  const d = evaluerDepot({ borne, poidsKg: 18, volumeM3: 0.06 });
  verifier(`18 kg → rémunéré ${d.kgRemuneres} kg (plafond dépôt ${PLAFOND_DEPOT_KG})`,
    d.kgRemuneres === PLAFOND_DEPOT_KG && d.motif === MOTIFS.PLAFOND_DEPOT, JSON.stringify(d));

  // Déjà 14 kg crédités aujourd'hui : il ne reste qu'1 kg.
  const j = evaluerDepot({ borne, poidsKg: 8, volumeM3: 0.03, kgDejaCreditesAujourdhui: 14 });
  verifier(`déjà 14 kg aujourd'hui → reste ${j.kgRemuneres} kg (plafond jour ${PLAFOND_JOUR_KG})`,
    j.kgRemuneres === 1 && j.motif === MOTIFS.PLAFOND_JOUR, JSON.stringify(j));

  // Plafond jour atteint : plus rien, mais le dépôt entre quand même.
  const p = evaluerDepot({ borne, poidsKg: 5, volumeM3: 0.02, kgDejaCreditesAujourdhui: 15 });
  verifier("plafond jour atteint → 0 FCFA mais dépôt accepté",
    p.accepte && !p.remunere && p.creditFcfa === 0, JSON.stringify(p));

  // Budget de la borne épuisé : le filet ultime.
  const b = evaluerDepot({ borne, poidsKg: 5, volumeM3: 0.02, fcfaDejaCreditesBorneAujourdhui: 25000 });
  verifier("budget de la borne épuisé → 0 FCFA, dépôt accepté",
    b.accepte && b.creditFcfa === 0 && b.motif === MOTIFS.PLAFOND_BORNE, JSON.stringify(b));

  // Budget presque épuisé : écrêtage partiel, jamais de dépassement.
  const e = evaluerDepot({ borne, poidsKg: 10, volumeM3: 0.03, fcfaDejaCreditesBorneAujourdhui: 24900 });
  verifier(`budget presque épuisé → ${e.creditFcfa} FCFA (jamais plus que le reste)`,
    e.creditFcfa <= 100, JSON.stringify(e));
}

console.log("\n── Délai entre deux dépôts ──");
{
  const maintenant = Date.now();
  const trop = evaluerDepot({
    borne, poidsKg: 5, volumeM3: 0.02,
    dernierDepotMemeBorneMs: maintenant - 5 * 60 * 1000, maintenant,
  });
  verifier("2e dépôt après 5 min → non rémunéré",
    trop.accepte && !trop.remunere && trop.motif === MOTIFS.DELAI, JSON.stringify(trop));

  const bon = evaluerDepot({
    borne, poidsKg: 5, volumeM3: 0.02,
    dernierDepotMemeBorneMs: maintenant - 45 * 60 * 1000, maintenant,
  });
  verifier("2e dépôt après 45 min → rémunéré", bon.remunere, JSON.stringify(bon));
}

console.log("\n── Borne pleine et hors service ──");
{
  const pleine = evaluerDepot({ borne: { ...borne, remplissagePct: 97 }, poidsKg: 5, volumeM3: 0.02 });
  verifier("borne à 97 % → dépôt REFUSÉ",
    !pleine.accepte && pleine.motif === MOTIFS.BORNE_PLEINE, JSON.stringify(pleine));

  const hs = evaluerDepot({ borne: { ...borne, etat: "hors_service" }, poidsKg: 5, volumeM3: 0.02 });
  verifier("borne hors service → dépôt REFUSÉ", !hs.accepte, JSON.stringify(hs));

  const limite = evaluerDepot({ borne: { ...borne, remplissagePct: 94 }, poidsKg: 5, volumeM3: 0.02 });
  verifier("borne à 94 % → dépôt encore accepté", limite.accepte, JSON.stringify(limite));
}

console.log("\n── Pesée invalide ──");
{
  verifier("poids nul → refusé", !evaluerDepot({ borne, poidsKg: 0, volumeM3: 0.02 }).accepte);
  verifier("poids négatif → refusé", !evaluerDepot({ borne, poidsKg: -3, volumeM3: 0.02 }).accepte);
  verifier("poids non numérique → refusé", !evaluerDepot({ borne, poidsKg: NaN, volumeM3: 0.02 }).accepte);
  verifier("50 g (bruit du capteur) → refusé", !evaluerDepot({ borne, poidsKg: 0.05, volumeM3: 0.001 }).accepte);
}

console.log("\n── Remplissage : le maximum de deux signaux ──");
{
  // Cartons : léger (10 % du poids) mais volumineux (75 % du volume).
  const cartons = remplissagePct({ poidsNetKg: 40, capaciteKg: 400, hauteurLibreCm: 30, hauteurUtileCm: 120 });
  verifier(`cartons : léger mais volumineux → ${cartons} %`, cartons === 75, `attendu 75, obtenu ${cartons}`);

  // Organique : lourd (90 %) mais peu volumineux (25 %).
  const organique = remplissagePct({ poidsNetKg: 360, capaciteKg: 400, hauteurLibreCm: 90, hauteurUtileCm: 120 });
  verifier(`organique : lourd mais tassé → ${organique} %`, organique === 90, `attendu 90, obtenu ${organique}`);

  const vide = remplissagePct({ poidsNetKg: 0, capaciteKg: 400, hauteurLibreCm: 120, hauteurUtileCm: 120 });
  verifier("borne vide → 0 %", vide === 0, `obtenu ${vide}`);
}

console.log(`\n${ko === 0 ? "✓ TOUT PASSE" : "✗ ECHECS"} — ${ok} vérifications OK, ${ko} en échec\n`);
process.exit(ko === 0 ? 0 : 1);
