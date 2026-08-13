// Attribue un rôle à un compte existant.
//   node scripts/set-role.mjs 2250709646096 mairie
//
// Les rôles sensibles (admin, mairie) ne peuvent pas être pris depuis l'app :
// les règles Firestore n'autorisent l'auto-inscription qu'en menage/collecteur.

import { initializeApp, cert } from "firebase-admin/app";
import { getFirestore } from "firebase-admin/firestore";
import { readFileSync } from "fs";

const ROLES = ["menage", "collecteur", "mairie", "admin"];

const [tel, role] = process.argv.slice(2);
if (!tel || !ROLES.includes(role)) {
  console.error(`Usage : node scripts/set-role.mjs <numero> <${ROLES.join("|")}>`);
  console.error("Exemple : node scripts/set-role.mjs 2250709646096 mairie");
  process.exit(1);
}

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
const uid = String(tel).replace(/\D/g, "");
const ref = db.collection("utilisateurs").doc(uid);
const snap = await ref.get();

if (!snap.exists) {
  console.error(`Aucun compte pour le numéro ${uid}. La personne doit d'abord s'inscrire dans l'app.`);
  process.exit(1);
}

const avant = snap.data().role;
await ref.update({ role });
console.log(`${snap.data().nom || uid} : ${avant} → ${role}`);
process.exit(0);
