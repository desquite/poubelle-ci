// Contrôle : que contiennent réellement les collections ?
//   node scripts/verif-collections.mjs

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

for (const nom of ["signalements", "incidents", "bornes", "depots", "vidages", "corbeilles"]) {
  const snap = await db.collection(nom).get();
  console.log(`\n${nom} : ${snap.size} document(s)`);
  snap.docs.slice(0, 5).forEach((d) => {
    const x = d.data();
    if (nom === "signalements") {
      console.log(`   ${(x.nom || "?").padEnd(12)} ${(x.commune || "").padEnd(10)} ${x.type || ""} · ${x.status || ""}`);
    } else if (nom === "incidents") {
      console.log(`   ${(x.type || "?").padEnd(16)} ${(x.commune || "").padEnd(10)} ${x.statut || ""}`);
    } else if (nom === "bornes") {
      console.log(`   ${x.code} ${String(x.remplissagePct).padStart(3)} %`);
    }
  });
}

console.log("");
process.exit(0);
