// Ce fichier envoie automatiquement un WhatsApp aux collecteurs quand un nouveau signalement arrive

const { initializeApp, cert } = require("firebase-admin/app");
const { getFirestore } = require("firebase-admin/firestore");

exports.handler = async (event) => {
  if (event.httpMethod !== "POST") {
    return { statusCode: 405, body: "Method Not Allowed" };
  }

  try {
    const { signalement } = JSON.parse(event.body);
    const { commune, quartier, nom, type, volume, urgent, lat, lng } = signalement;

    // Initialiser Firebase Admin
    const app = initializeApp({
      credential: cert({
        projectId: process.env.FIREBASE_PROJECT_ID,
        clientEmail: process.env.FIREBASE_CLIENT_EMAIL,
        privateKey: process.env.FIREBASE_PRIVATE_KEY?.replace(/\\n/g, "\n"),
      })
    }, "notifier");

    const db = getFirestore(app);

    // Chercher les collecteurs de la même zone
    const snapshot = await db.collection("utilisateurs")
      .where("role", "==", "collecteur")
      .where("commune", "==", commune)
      .get();

    const collecteurs = snapshot.docs
      .map(doc => doc.data())
      .filter(c => c.quartier === quartier || c.commune === commune);

    // Envoyer WhatsApp à chaque collecteur
    const WASENDER_KEY = process.env.WASENDER_API_KEY;
    const message = `🗑️ *Nouveau signalement - Poubelle-CI*\n\n📍 *${commune} — ${quartier}*\n👤 ${nom}\n🗑️ ${type} · ${volume}${urgent ? "\n🔴 URGENT !" : ""}${lat ? `\n\n🗺️ Localisation : https://www.google.com/maps?q=${lat},${lng}` : ""}\n\n👉 Connectez-vous pour accepter !\npoubelle-ci.netlify.app`;

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

    return {
      statusCode: 200,
      body: JSON.stringify({ success: true, notifies: collecteurs.length })
    };

  } catch (e) {
    return {
      statusCode: 500,
      body: JSON.stringify({ error: e.message })
    };
  }
};