// Règles métier des bornes connectées : barème, seuils de remplissage et
// moteur anti-fraude. Volontairement écrit en fonctions pures, sans accès à
// Firestore : c'est la partie qu'on doit pouvoir relire, tester et défendre.

import crypto from "node:crypto";

// ── Barème ──────────────────────────────────────────────────────────────────
export const TARIF_FCFA_PAR_KG = 25;

// ── Seuils de remplissage ───────────────────────────────────────────────────
export const SEUIL_ALERTE_PCT = 80;   // le prestataire est prévenu
export const SEUIL_PLEINE_PCT = 95;   // la trappe se verrouille

// ── Plafonds anti-fraude (en cascade) ───────────────────────────────────────
export const PLAFOND_DEPOT_KG = 10;          // par dépôt
export const PLAFOND_JOUR_KG = 15;           // par numéro et par jour
export const PLAFOND_BORNE_JOUR_FCFA = 25000; // filet ultime : le budget d'une
                                              // borne ne peut pas être siphonné
export const DELAI_MIN_MS = 30 * 60 * 1000;  // entre deux dépôts, même numéro, même borne

// ── Densité : la parade contre le sable et les gravats ──────────────────────
// Ordures ménagères en vrac : 200 à 500 kg/m³ (humides et organiques à Abidjan,
// donc plutôt vers le haut). Eau ~1000, gravats ~1400, sable ~1500.
// Le seuil est délibérément haut pour ne jamais pénaliser un dépôt honnête :
// on préfère laisser passer un tricheur que refuser un citoyen de bonne foi.
export const DENSITE_MAX_KG_M3 = 600;

// Poids minimal mesurable de façon fiable par les cellules de charge.
export const POIDS_MIN_KG = 0.3;

export const MOTIFS = {
  BORNE_PLEINE: "borne_pleine",
  BORNE_HORS_SERVICE: "borne_hors_service",
  DENSITE: "densite",
  POIDS_INVALIDE: "poids_invalide",
  PLAFOND_DEPOT: "plafond_depot",
  PLAFOND_JOUR: "plafond_jour",
  PLAFOND_BORNE: "plafond_borne",
  DELAI: "delai",
};

export const MESSAGES = {
  [MOTIFS.BORNE_PLEINE]: "Cette borne est pleine.",
  [MOTIFS.BORNE_HORS_SERVICE]: "Cette borne est hors service.",
  [MOTIFS.DENSITE]: "Dépôt trop dense pour des ordures ménagères (sable, gravats ou eau ?). Il est enregistré mais non rémunéré.",
  [MOTIFS.POIDS_INVALIDE]: "Pesée invalide. Reposez le sac et ne touchez pas la borne pendant la mesure.",
  [MOTIFS.PLAFOND_DEPOT]: `Dépôt rémunéré jusqu'à ${PLAFOND_DEPOT_KG} kg.`,
  [MOTIFS.PLAFOND_JOUR]: `Vous avez atteint votre maximum de ${PLAFOND_JOUR_KG} kg pour aujourd'hui.`,
  [MOTIFS.PLAFOND_BORNE]: "Cette borne a atteint son budget du jour.",
  [MOTIFS.DELAI]: "Patientez 30 minutes entre deux dépôts sur la même borne.",
};

// ── Utilitaires ─────────────────────────────────────────────────────────────

export const densiteKgM3 = (poidsKg, volumeM3) =>
  volumeM3 > 0 ? poidsKg / volumeM3 : null;

// Comparaison à temps constant : évite de laisser deviner la clé d'une borne
// en mesurant le temps de réponse.
export const cleValide = (cleFournie, hashAttendu) => {
  if (!cleFournie || !hashAttendu) return false;
  const hash = crypto.createHash("sha256").update(String(cleFournie)).digest();
  const attendu = Buffer.from(String(hashAttendu), "hex");
  return hash.length === attendu.length && crypto.timingSafeEqual(hash, attendu);
};

export const hashCle = (cle) =>
  crypto.createHash("sha256").update(String(cle)).digest("hex");

// Le remplissage est le maximum de deux signaux indépendants : une borne pleine
// de cartons est volumineuse et légère, une borne pleine d'organique est
// l'inverse. Prendre le maximum, c'est ne jamais se faire surprendre.
export function remplissagePct({ poidsNetKg, capaciteKg, hauteurLibreCm, hauteurUtileCm }) {
  const parPoids = capaciteKg > 0 ? (poidsNetKg / capaciteKg) * 100 : 0;
  const parVolume = hauteurUtileCm > 0
    ? ((hauteurUtileCm - hauteurLibreCm) / hauteurUtileCm) * 100
    : 0;
  return Math.max(0, Math.min(100, Math.round(Math.max(parPoids, parVolume))));
}

export const etatDepuisRemplissage = (pct) =>
  pct >= SEUIL_PLEINE_PCT ? "pleine" : "ouverte";

/**
 * Décide du sort d'un dépôt. Ne touche à rien : renvoie une décision.
 *
 * Principe : un dépôt physiquement effectué est TOUJOURS enregistré (on veut
 * savoir ce qui entre dans la borne), mais il n'est pas toujours rémunéré.
 * Seule une borne pleine ou hors service refuse le dépôt lui-même.
 */
export function evaluerDepot({
  borne,
  poidsKg,
  volumeM3,
  kgDejaCreditesAujourdhui = 0,
  fcfaDejaCreditesBorneAujourdhui = 0,
  dernierDepotMemeBorneMs = null,
  maintenant = Date.now(),
}) {
  const refuser = (motif) => ({
    accepte: false, remunere: false, motif,
    message: MESSAGES[motif], kgRemuneres: 0, creditFcfa: 0, scoreFraude: 0,
  });

  // 1. La borne peut-elle recevoir quoi que ce soit ?
  if (borne.etat === "hors_service") return refuser(MOTIFS.BORNE_HORS_SERVICE);
  if (borne.etat === "pleine" || (borne.remplissagePct ?? 0) >= SEUIL_PLEINE_PCT) {
    return refuser(MOTIFS.BORNE_PLEINE);
  }

  // 2. La pesée est-elle exploitable ?
  if (!(poidsKg >= POIDS_MIN_KG) || !Number.isFinite(poidsKg)) {
    return refuser(MOTIFS.POIDS_INVALIDE);
  }

  // À partir d'ici le dépôt est accepté physiquement : il entre dans la borne.
  const accepte = (motif, kgRemuneres, scoreFraude = 0) => ({
    accepte: true,
    remunere: kgRemuneres > 0,
    motif,
    message: motif ? MESSAGES[motif] : null,
    kgRemuneres: Math.round(kgRemuneres * 100) / 100,
    creditFcfa: Math.round(kgRemuneres * TARIF_FCFA_PAR_KG),
    scoreFraude,
  });

  // 3. Densité — la parade au sable, prioritaire sur tout le reste.
  const densite = densiteKgM3(poidsKg, volumeM3);
  if (densite !== null && densite > DENSITE_MAX_KG_M3) {
    return accepte(MOTIFS.DENSITE, 0, 90);
  }

  // 4. Délai entre deux dépôts sur la même borne.
  if (dernierDepotMemeBorneMs && maintenant - dernierDepotMemeBorneMs < DELAI_MIN_MS) {
    return accepte(MOTIFS.DELAI, 0, 40);
  }

  // 5. Budget de la borne pour la journée.
  if (fcfaDejaCreditesBorneAujourdhui >= PLAFOND_BORNE_JOUR_FCFA) {
    return accepte(MOTIFS.PLAFOND_BORNE, 0, 0);
  }

  // 6. Plafonds par dépôt puis par personne et par jour : on ne refuse pas,
  //    on écrête. Le citoyen est payé pour ce qui reste sous le plafond.
  let kgRemuneres = Math.min(poidsKg, PLAFOND_DEPOT_KG);
  let motif = kgRemuneres < poidsKg ? MOTIFS.PLAFOND_DEPOT : null;

  const resteJour = Math.max(0, PLAFOND_JOUR_KG - kgDejaCreditesAujourdhui);
  if (kgRemuneres > resteJour) {
    kgRemuneres = resteJour;
    motif = MOTIFS.PLAFOND_JOUR;
  }

  // L'écrêtage par le budget de la borne ferme la cascade.
  const resteBorneFcfa = PLAFOND_BORNE_JOUR_FCFA - fcfaDejaCreditesBorneAujourdhui;
  const kgMaxBorne = resteBorneFcfa / TARIF_FCFA_PAR_KG;
  if (kgRemuneres > kgMaxBorne) {
    kgRemuneres = Math.max(0, kgMaxBorne);
    motif = MOTIFS.PLAFOND_BORNE;
  }

  return accepte(motif, kgRemuneres, 0);
}
