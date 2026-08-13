// Contrôle rapide : état du parc de bornes et qui recevrait une alerte WhatsApp.
//   node scripts/verif-bornes.mjs

import { initializeApp, cert } from "firebase-admin/app";
import { getFirestore } from "firebase-admin/firestore";
import { readFileSync } from "fs";

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

const bornes = await db.collection("bornes").get();
console.log(`\nBornes en base : ${bornes.size}`);
bornes.docs.forEach((d) => {
  const b = d.data();
  console.log(`  ${b.code.padEnd(18)} ${String(b.remplissagePct ?? 0).padStart(3)} %  ${b.etat.padEnd(12)} ${b.commune}`);
});

const users = await db.collection("utilisateurs").get();
const collecteurs = users.docs.map((d) => d.data()).filter((u) => u.role === "collecteur");

console.log(`\nCollecteurs inscrits : ${collecteurs.length}`);
const parCommune = {};
collecteurs.forEach((c) => { parCommune[c.commune] = (parCommune[c.commune] || 0) + 1; });
Object.entries(parCommune).forEach(([c, n]) => console.log(`  ${String(n).padStart(2)} en ${c}`));

console.log("\nQui recevrait un message WhatsApp si une borne dépasse 80 % :");
["COCODY", "YOPOUGON", "ABOBO", "ADJAMÉ", "MARCORY"].forEach((c) => {
  console.log(`  ${c.padEnd(10)} → ${parCommune[c] || 0} destinataire(s)`);
});

const depots = await db.collection("depots").get();
console.log(`\nDépôts déjà enregistrés : ${depots.size}\n`);
process.exit(0);
