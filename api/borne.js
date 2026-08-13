// Point d'entrée unique des bornes connectées.
//
// Le firmware ne parle JAMAIS à Firestore : il tape cette route avec la clé
// secrète de sa borne (en-tête x-borne-cle). Sans ça, n'importe qui muni du SDK
// pourrait fabriquer des dépôts et se créditer.
//
// Actions : depot · etat · vidage

import { FieldValue } from "firebase-admin/firestore";
import { db, envoyerWhatsApp, distanceKm } from "./_firebase.js";
import {
  evaluerDepot, remplissagePct, etatDepuisRemplissage, cleValide, densiteKgM3,
  SEUIL_ALERTE_PCT, SEUIL_PLEINE_PCT, MOTIFS,
} from "./_bornes.js";

// Clé du compteur journalier (fuseau d'Abidjan = UTC, pas de changement d'heure)
const jour = (d = new Date()) => d.toISOString().slice(0, 10).replace(/-/g, "");

const nombre = (v) => (Number.isFinite(Number(v)) ? Number(v) : null);

// Borne ouverte la plus proche, pour ne jamais refuser sans proposer d'alternative.
async function borneDeReport(borne) {
  const snap = await db.collection("bornes")
    .where("commune", "==", borne.commune)
    .where("etat", "==", "ouverte")
    .get();

  let meilleure = null, dMin = Infinity;
  snap.docs.forEach((d) => {
    const b = d.data();
    if (d.id === borne.id || b.lat == null) return;
    const dist = distanceKm(borne.lat, borne.lng, b.lat, b.lng);
    if (dist < dMin) { dMin = dist; meilleure = { code: b.code, nom: b.nom, lat: b.lat, lng: b.lng }; }
  });

  return meilleure ? { ...meilleure, distanceM: Math.round(dMin * 1000) } : null;
}

export default async function handler(req, res) {
  if (req.method !== "POST") {
    return res.status(405).json({ error: "Method Not Allowed" });
  }

  try {
    const { action, borneCode } = req.body || {};
    if (!borneCode) return res.status(400).json({ error: "borneCode requis" });

    const borneRef = db.collection("bornes").doc(String(borneCode));
    const borneSnap = await borneRef.get();
    if (!borneSnap.exists) return res.status(404).json({ error: "Borne inconnue" });

    const borne = { id: borneSnap.id, ...borneSnap.data() };

    if (!cleValide(req.headers["x-borne-cle"], borne.cleHash)) {
      return res.status(401).json({ error: "Clé de borne invalide" });
    }

    if (action === "etat") return await majEtat(req, res, borneRef, borne);
    if (action === "vidage") return await vidage(req, res, borneRef, borne);
    if (action === "depot") return await depot(req, res, borneRef, borne);

    return res.status(400).json({ error: "Action inconnue" });
  } catch (e) {
    return res.status(500).json({ error: e.message });
  }
}

// ── Recalcule le remplissage à partir d'une mesure brute ────────────────────
function mesurer(borne, poidsTotalKg, hauteurLibreCm) {
  const poidsNetKg = Math.max(0, (poidsTotalKg ?? borne.poidsTotalKg ?? borne.tareKg) - (borne.tareKg || 0));
  const pct = remplissagePct({
    poidsNetKg,
    capaciteKg: borne.capaciteKg,
    hauteurLibreCm: hauteurLibreCm ?? borne.hauteurLibreCm ?? borne.hauteurUtileCm,
    hauteurUtileCm: borne.hauteurUtileCm,
  });
  return { poidsNetKg, pct };
}

// ── Battement de cœur : la borne rapporte son état ──────────────────────────
async function majEtat(req, res, borneRef, borne) {
  const poidsTotalKg = nombre(req.body.poidsTotalKg);
  const hauteurLibreCm = nombre(req.body.hauteurLibreCm);
  const { poidsNetKg, pct } = mesurer(borne, poidsTotalKg, hauteurLibreCm);

  await borneRef.update({
    poidsTotalKg: poidsTotalKg ?? borne.poidsTotalKg ?? null,
    poidsNetKg,
    hauteurLibreCm: hauteurLibreCm ?? borne.hauteurLibreCm ?? null,
    remplissagePct: pct,
    etat: borne.etat === "hors_service" ? "hors_service" : etatDepuisRemplissage(pct),
    vueAt: FieldValue.serverTimestamp(),
  });

  await alerterSiPleine(borne, pct);
  return res.status(200).json({ success: true, remplissagePct: pct });
}

// ── Vidage : la déclaration ne suffit pas, le poids doit retomber ───────────
async function vidage(req, res, borneRef, borne) {
  const { prestataireId } = req.body;
  const poidsTotalKg = nombre(req.body.poidsTotalKg);
  const hauteurLibreCm = nombre(req.body.hauteurLibreCm);
  const { poidsNetKg, pct } = mesurer(borne, poidsTotalKg, hauteurLibreCm);

  // Le capteur arbitre, pas la déclaration : un vidage n'est validé que si la
  // borne est réellement revenue à vide (tolérance 10 % de sa capacité).
  const seuilVideKg = (borne.capaciteKg || 0) * 0.1;
  const valide = poidsNetKg <= seuilVideKg;

  await db.collection("vidages").add({
    borneId: borne.id, borneCode: borne.code, commune: borne.commune,
    prestataireId: prestataireId || null,
    poidsAvantNetKg: borne.poidsNetKg ?? null,
    poidsApresNetKg: poidsNetKg,
    valide,
    createdAt: FieldValue.serverTimestamp(),
  });

  if (valide) {
    await borneRef.update({
      poidsTotalKg: poidsTotalKg ?? borne.tareKg,
      poidsNetKg,
      hauteurLibreCm: hauteurLibreCm ?? borne.hauteurUtileCm,
      remplissagePct: pct,
      etat: borne.etat === "hors_service" ? "hors_service" : "ouverte",
      dernierVidageAt: FieldValue.serverTimestamp(),
      alerteEnvoyee: false,
    });
  }

  return res.status(200).json({
    success: true, valide, remplissagePct: pct,
    message: valide ? "Vidage confirmé." : "Vidage refusé : la borne n'est pas vide.",
  });
}

// ── Dépôt : le cœur du système ──────────────────────────────────────────────
async function depot(req, res, borneRef, borne) {
  const uid = String(req.body.uid || "").replace(/\D/g, "");
  const poidsKg = nombre(req.body.poidsKg);
  const volumeM3 = nombre(req.body.volumeM3);
  const poidsTotalKg = nombre(req.body.poidsTotalKg);
  const hauteurLibreCm = nombre(req.body.hauteurLibreCm);

  if (!uid) return res.status(400).json({ error: "uid (numéro de téléphone) requis" });

  const j = jour();
  const compteurUid = db.collection("compteurs").doc(`${uid}_${j}`);
  const compteurBorne = db.collection("compteurs").doc(`${borne.id}_${j}`);
  const depotRef = db.collection("depots").doc();

  const decision = await db.runTransaction(async (tx) => {
    const [cuSnap, cbSnap] = await Promise.all([tx.get(compteurUid), tx.get(compteurBorne)]);
    const cu = cuSnap.data() || {};
    const cb = cbSnap.data() || {};

    const d = evaluerDepot({
      borne,
      poidsKg,
      volumeM3,
      kgDejaCreditesAujourdhui: cu.kgCredites || 0,
      fcfaDejaCreditesBorneAujourdhui: cb.fcfaCredites || 0,
      dernierDepotMemeBorneMs: cu.dernierDepot?.[borne.id] || null,
    });

    // Un dépôt refusé n'entre pas dans la borne : rien à enregistrer d'autre
    // qu'une trace, et surtout aucune mise à jour du poids.
    if (!d.accepte) {
      tx.set(depotRef, {
        borneId: borne.id, borneCode: borne.code, commune: borne.commune, uid,
        poidsKg, volumeM3, densiteKgM3: densiteKgM3(poidsKg, volumeM3),
        statut: "refuse", motif: d.motif, creditFcfa: 0, scoreFraude: d.scoreFraude,
        createdAt: FieldValue.serverTimestamp(),
      });
      return d;
    }

    const { poidsNetKg, pct } = mesurer(borne, poidsTotalKg, hauteurLibreCm);

    tx.set(depotRef, {
      borneId: borne.id, borneCode: borne.code, commune: borne.commune, uid,
      poidsKg, volumeM3, densiteKgM3: densiteKgM3(poidsKg, volumeM3),
      kgRemuneres: d.kgRemuneres,
      creditFcfa: d.creditFcfa,
      // Rien n'est envoyé à l'opérateur dans la seconde : les crédits sont
      // validés en lot plus tard, ce qui laisse le temps de détecter un schéma
      // de fraude et de l'annuler avant qu'il ne coûte quoi que ce soit.
      statut: d.remunere ? "en_attente" : "non_remunere",
      motif: d.motif,
      scoreFraude: d.scoreFraude,
      createdAt: FieldValue.serverTimestamp(),
    });

    tx.update(borneRef, {
      poidsTotalKg: poidsTotalKg ?? FieldValue.increment(poidsKg),
      poidsNetKg,
      hauteurLibreCm: hauteurLibreCm ?? borne.hauteurLibreCm ?? null,
      remplissagePct: pct,
      etat: borne.etat === "hors_service" ? "hors_service" : etatDepuisRemplissage(pct),
      dernierDepotAt: FieldValue.serverTimestamp(),
      vueAt: FieldValue.serverTimestamp(),
    });

    tx.set(compteurUid, {
      uid, jour: j,
      kgCredites: FieldValue.increment(d.kgRemuneres),
      fcfaCredites: FieldValue.increment(d.creditFcfa),
      dernierDepot: { [borne.id]: Date.now() },
    }, { merge: true });

    tx.set(compteurBorne, {
      borneId: borne.id, jour: j,
      kgRecus: FieldValue.increment(poidsKg),
      fcfaCredites: FieldValue.increment(d.creditFcfa),
      nbDepots: FieldValue.increment(1),
    }, { merge: true });

    return { ...d, remplissagePct: pct };
  });

  // Borne pleine : on refuse, mais on indique toujours où aller. Refuser sans
  // alternative, c'est créer le tas par terre qu'on voulait éviter.
  if (!decision.accepte && decision.motif === MOTIFS.BORNE_PLEINE) {
    const report = await borneDeReport(borne);
    await alerterSiPleine(borne, borne.remplissagePct ?? 100);
    return res.status(200).json({ ...decision, depotId: depotRef.id, borneDeReport: report });
  }

  if (decision.accepte) await alerterSiPleine(borne, decision.remplissagePct);

  return res.status(200).json({ ...decision, depotId: depotRef.id });
}

// ── Alerte WhatsApp au prestataire de vidage ────────────────────────────────
async function alerterSiPleine(borne, pct) {
  if (pct < SEUIL_ALERTE_PCT || borne.alerteEnvoyee) return;

  try {
    await db.collection("bornes").doc(borne.id).update({ alerteEnvoyee: true });

    const snap = await db.collection("utilisateurs")
      .where("role", "==", "collecteur")
      .where("commune", "==", borne.commune)
      .get();

    const etat = pct >= SEUIL_PLEINE_PCT ? "🔴 *PLEINE — dépôts refusés*" : "🟠 Bientôt pleine";
    const message = `🗑️ *Borne à vider — Poubelle-CI*\n\n📍 *${borne.nom}*\n${borne.commune}\n\n${etat}\nRemplissage : *${pct} %*\n\n🗺️ https://www.google.com/maps?q=${borne.lat},${borne.lng}`;

    await Promise.all(
      snap.docs.map((d) => d.data().telephone && envoyerWhatsApp(d.data().telephone, message))
    );
  } catch {
    // Une alerte qui échoue ne doit jamais faire échouer un dépôt.
  }
}
