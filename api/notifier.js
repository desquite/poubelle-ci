// Notification WhatsApp aux collecteurs de la zone lors d'un nouveau signalement.
// Le client n'envoie que l'id : les données sont relues depuis Firestore.

import { db, envoyerWhatsApp } from "./_firebase.js";

export default async function handler(req, res) {
  if (req.method !== "POST") {
    return res.status(405).json({ error: "Method Not Allowed" });
  }

  try {
    const { signalementId } = req.body || {};
    if (!signalementId) return res.status(400).json({ error: "signalementId requis" });

    const snap = await db.collection("signalements").doc(String(signalementId)).get();
    if (!snap.exists) return res.status(404).json({ error: "Signalement introuvable" });

    const s = snap.data();
    if (s.status !== "disponible") return res.status(400).json({ error: "Signalement non disponible" });

    const { commune, quartier, nom, type, volume, urgent, lat, lng } = s;

    const snapshot = await db.collection("utilisateurs")
      .where("role", "==", "collecteur")
      .where("commune", "==", commune)
      .get();

    const collecteurs = snapshot.docs
      .map(doc => doc.data())
      .filter(c => c.quartier === quartier || c.commune === commune);

    const message = `🗑️ *Nouveau signalement - Poubelle-CI*\n\n📍 *${commune} — ${quartier}*\n👤 ${nom}\n🗑️ ${type} · ${volume}${urgent ? "\n🔴 URGENT !" : ""}${lat ? `\n\n🗺️ Localisation : https://www.google.com/maps?q=${lat},${lng}` : ""}\n\n👉 Connectez-vous pour accepter !\npoubelle-ci.vercel.app`;

    await Promise.all(collecteurs.map(c => envoyerWhatsApp(c.telephone, message)));

    return res.status(200).json({ success: true, notifies: collecteurs.length });

  } catch (e) {
    return res.status(500).json({ error: e.message });
  }
}
