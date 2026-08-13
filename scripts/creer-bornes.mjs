// Crée (ou met à jour) un parc de bornes de démonstration dans Firestore.
//   node scripts/creer-bornes.mjs
//
// Chaque borne reçoit une clé secrète : elle est affichée UNE SEULE FOIS ici,
// et seule son empreinte SHA-256 est stockée. C'est cette clé que le firmware
// (ou le simulateur) envoie dans l'en-tête x-borne-cle.

import { initializeApp, cert } from "firebase-admin/app";
import { getFirestore } from "firebase-admin/firestore";
import { readFileSync, writeFileSync } from "fs";
import crypto from "node:crypto";
import { hashCle } from "../api/_bornes.js";

const env = readFileSync(".env", "utf8");
const get = (k) => env.match(new RegExp(`^${k}=(.+)$`, "m"))?.[1]?.replace(/^"|"$/g, "");

initializeApp({
  credential: cert({
    projectId: get("FIREBASE_PROJECT_ID"),
    clientEmail: get("FIREBASE_CLIENT_EMAIL"),
    privateKey: get("FIREBASE_PRIVATE_KEY")?.replace(/\\n/g, "\n"),
  }),
});

const db = getFirestore();

// Carrefours réels d'Abidjan, pour que la carte de démo soit crédible.
const PARC = [
  { code: "BRN-COCODY-001", nom: "Carrefour Saint-Jean", commune: "COCODY", quartier: "Saint-Jean", lat: 5.3486, lng: -3.9905 },
  { code: "BRN-COCODY-002", nom: "Angré 8e Tranche", commune: "COCODY", quartier: "Angré", lat: 5.3925, lng: -3.9805 },
  { code: "BRN-COCODY-003", nom: "Riviera 2 — Marché", commune: "COCODY", quartier: "Riviera 2", lat: 5.3574, lng: -3.9481 },
  { code: "BRN-YOPOUGON-001", nom: "Siporex — Grand Carrefour", commune: "YOPOUGON", quartier: "Siporex", lat: 5.3372, lng: -4.0865 },
  { code: "BRN-YOPOUGON-002", nom: "Niangon Nord", commune: "YOPOUGON", quartier: "Niangon Nord", lat: 5.3488, lng: -4.0961 },
  { code: "BRN-ABOBO-001", nom: "Abobo Gare", commune: "ABOBO", quartier: "Sagbé", lat: 5.4180, lng: -4.0195 },
  { code: "BRN-ADJAME-001", nom: "Marché d'Adjamé", commune: "ADJAMÉ", quartier: "Marché Adjamé", lat: 5.3549, lng: -4.0261 },
  { code: "BRN-MARCORY-001", nom: "Zone 4 — Rue Pierre et Marie Curie", commune: "MARCORY", quartier: "Zone 4", lat: 5.2955, lng: -3.9917 },
];

// Caractéristiques physiques d'une benne de carrefour type.
const GABARIT = {
  capaciteKg: 400,      // charge utile
  hauteurUtileCm: 120,  // hauteur intérieure
  tareKg: 85,           // poids à vide
};

const cles = {};

for (const b of PARC) {
  const cle = crypto.randomBytes(16).toString("hex");
  cles[b.code] = cle;

  await db.collection("bornes").doc(b.code).set({
    ...b,
    ...GABARIT,
    cleHash: hashCle(cle),
    poidsTotalKg: GABARIT.tareKg,
    poidsNetKg: 0,
    hauteurLibreCm: GABARIT.hauteurUtileCm,
    remplissagePct: 0,
    etat: "ouverte",
    alerteEnvoyee: false,
    creeAt: new Date(),
  }, { merge: true });

  console.log(`  ✓ ${b.code.padEnd(18)} ${b.nom}`);
}

// Les clés vont dans un fichier ignoré par git : c'est le seul endroit où
// elles existent en clair.
writeFileSync("bornes-cles.json", JSON.stringify(cles, null, 2));

console.log(`\n${PARC.length} bornes en place.`);
console.log("Clés secrètes écrites dans bornes-cles.json (à ne jamais committer).\n");
process.exit(0);
