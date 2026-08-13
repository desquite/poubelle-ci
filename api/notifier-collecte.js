// Notifications WhatsApp au ménage lors de l'acceptation et de la fin de collecte.
// Le client n'envoie que l'id du signalement : le contenu du message et le
// destinataire sont déterminés côté serveur (non falsifiables).

import { db, envoyerWhatsApp, nomAffiche } from "./_firebase.js";

export default async function handler(req, res) {
  if (req.method !== "POST") {
    return res.status(405).json({ error: "Method Not Allowed" });
  }

  try {
    const { type, signalementId } = req.body || {};
    if (!signalementId) return res.status(400).json({ error: "signalementId requis" });

    const snap = await db.collection("signalements").doc(String(signalementId)).get();
    if (!snap.exists) return res.status(404).json({ error: "Signalement introuvable" });

    const s = snap.data();
    if (!s.uid || !s.collecteurId) return res.status(400).json({ error: "Signalement sans ménage ou sans collecteur" });

    let message;
    if (type === "acceptation") {
      if (s.status !== "en cours") return res.status(400).json({ error: "Statut incohérent" });
      message = `✅ *Votre demande de collecte a été acceptée !*\n\n🚛 *Collecteur :* ${nomAffiche(s.collecteurNom)}\n📞 *Téléphone :* +${s.collecteurId}\n\nIl arrive bientôt. Suivez sa position en direct sur l'app ! 🗺️\npoubelle-ci.vercel.app`;
    } else if (type === "collecte_terminee") {
      if (s.status !== "collecté") return res.status(400).json({ error: "Statut incohérent" });
      message = `✅ *Votre poubelle a été collectée !*\n\n🚛 *Collecteur :* ${nomAffiche(s.collecteurNom)}\n📍 ${s.commune} — ${s.quartier}\n\nMerci d'utiliser Poubelle-CI ! 🌍\npoubelle-ci.vercel.app`;
    } else {
      return res.status(400).json({ error: "Type inconnu" });
    }

    await envoyerWhatsApp(s.uid, message);
    return res.status(200).json({ success: true });
  } catch (e) {
    return res.status(500).json({ error: e.message });
  }
}
