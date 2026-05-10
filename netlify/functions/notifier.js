// Ce fichier envoie automatiquement un WhatsApp aux collecteurs quand un nouveau signalement arrive

import admin from "firebase-admin";

if (!admin.apps.length) {
  admin.initializeApp({
    credential: admin.credential.cert({
      projectId: process.env.FIREBASE_PROJECT_ID,
      clientEmail: process.env.FIREBASE_CLIENT_EMAIL,
      privateKey: process.env.FIREBASE_PRIVATE_KEY?.replace(/\\n/g, "\n"),
    })
  });
}

const db = admin.firestore();

export default async function handler(req, res) {
  if (req.method !== "POST") {
    return res.status(405).json({ error: "Method Not Allowed" });
  }

  try {
    const { signalement } = req.body;
    const { commune, quartier, nom, type, volume, urgent, lat, lng } = signalement;

    const snapshot = await db.collection("utilisateurs")
      .where("role", "==", "collecteur")
      .where("commune", "==", commune)
      .get();

    const collecteurs = snapshot.docs
      .map(doc => doc.data())
      .filter(c => c.quartier === quartier || c.commune === commune);

    const message = `🗑️ *Nouveau signalement - Poubelle-CI*\n\n📍 *${commune} — ${quartier}*\n👤 ${nom}\n🗑️ ${type} · ${volume}${urgent ? "\n🔴 URGENT !" : ""}${lat ? `\n\n🗺️ Localisation : https://www.google.com/maps?q=${lat},${lng}` : ""}\n\n👉 Connectez-vous pour accepter !\npoubelle-ci.vercel.app`;

    const WASENDER_KEY = process.env.VITE_WASENDER_API_KEY;

    const envois = collecteurs.map(collecteur =>
      fetch("https://wasenderapi.com/api/send-message", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "Authorization": `Bearer ${WASENDER_KEY}`
        },
        body: JSON.stringify({
          sessionId: "42536",
          to: collecteur.telephone,
          text: message
        })
      })
    );

    await Promise.all(envois);

    return res.status(200).json({ success: true, notifies: collecteurs.length });

  } catch (e) {
    return res.status(500).json({ error: e.message });
  }
}