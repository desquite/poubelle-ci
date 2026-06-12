// Notification WhatsApp aux collecteurs de la zone lors d'un nouveau signalement.
// Le client n'envoie que l'id : les données sont relues depuis Firestore.

import { db, envoyerWhatsApp, distanceKm } from "./_firebase.js";

// Un collecteur est notifié s'il est physiquement dans son rayon autour du
// signalement (position vue récemment), sinon on retombe sur sa commune.
const POSITION_MAX_AGE_MS = 14 * 24 * 3600 * 1000;

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

    const { commune, quartier, nom, type, volume, prix, urgent, lat, lng } = s;

    const snapshot = await db.collection("utilisateurs")
      .where("role", "==", "collecteur")
      .get();

    const now = Date.now();
    const collecteurs = snapshot.docs
      .map(doc => doc.data())
      .filter(c => {
        if (!c.telephone) return false;
        const posAt = c.lastPositionAt?.toMillis ? c.lastPositionAt.toMillis() : 0;
        const positionRecente = c.lastLat != null && c.lastLng != null && posAt && (now - posAt) < POSITION_MAX_AGE_MS;
        // Proximité réelle si on connaît sa position récente et que le signalement est géolocalisé
        if (lat && lng && positionRecente) {
          return distanceKm(lat, lng, c.lastLat, c.lastLng) <= (c.rayonKm || 1);
        }
        // Repli : collecteurs de la même commune (jamais ouvert la carte, ou position trop ancienne)
        return c.commune === commune;
      });

    const prixTexte = Number(prix) > 0 ? `\n💰 *${Number(prix).toLocaleString("fr-FR")} FCFA*` : "";
    const message = `🗑️ *Nouveau signalement - Poubelle-CI*\n\n📍 *${commune} — ${quartier}*\n👤 ${nom}\n🗑️ ${type} · ${volume}${prixTexte}${urgent ? "\n🔴 URGENT !" : ""}${lat ? `\n\n🗺️ Localisation : https://www.google.com/maps?q=${lat},${lng}` : ""}\n\n👉 Connectez-vous pour accepter !\npoubelle-ci.vercel.app`;

    await Promise.all(collecteurs.map(c => envoyerWhatsApp(c.telephone, message)));

    return res.status(200).json({ success: true, notifies: collecteurs.length });

  } catch (e) {
    return res.status(500).json({ error: e.message });
  }
}
