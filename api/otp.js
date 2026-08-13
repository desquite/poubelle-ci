// OTP côté serveur : génération, stockage hashé dans Firestore (collection otps),
// envoi WhatsApp, vérification, puis émission d'un custom token Firebase Auth.
// Le code n'apparaît jamais côté client.

import crypto from "node:crypto";
import { FieldValue } from "firebase-admin/firestore";
import { db, adminAuth, envoyerWhatsApp } from "./_firebase.js";

const hashCode = (code) =>
  crypto.createHash("sha256").update(`${code}:${process.env.FIREBASE_PROJECT_ID}`).digest("hex");

const COMPTE_BLOQUE = "Ce compte a été suspendu. Contactez l'administrateur.";

export default async function handler(req, res) {
  if (req.method !== "POST") {
    return res.status(405).json({ error: "Method Not Allowed" });
  }

  try {
    const { action, telephone, code, contexte } = req.body || {};
    const tel = String(telephone || "").replace(/\D/g, "");
    if (!/^225\d{10}$/.test(tel)) {
      return res.status(400).json({ error: "Numéro invalide. Format attendu : 07 00 00 00 00" });
    }

    if (action === "send") {
      if (contexte === "connexion") {
        const u = await db.collection("utilisateurs").doc(tel).get();
        if (!u.exists) {
          return res.status(404).json({ error: "Numéro introuvable. Veuillez vous inscrire d'abord." });
        }
        if (u.data().bloque) {
          return res.status(403).json({ error: COMPTE_BLOQUE });
        }
      }

      const nouveauCode = Math.floor(100000 + Math.random() * 900000).toString();
      await db.collection("otps").doc(tel).set({
        hash: hashCode(nouveauCode),
        expireAt: Date.now() + 5 * 60 * 1000,
        tentatives: 0,
      });

      const libelle = contexte === "connexion" ? "connexion" : "vérification";
      const ok = await envoyerWhatsApp(tel,
        `*${nouveauCode}* est votre code de ${libelle} Poubelle-CI.\n\nCe code expire dans 5 minutes. Ne le partagez pas.`);
      if (!ok) return res.status(502).json({ error: "Erreur d'envoi WhatsApp. Vérifiez votre numéro." });

      return res.status(200).json({ success: true });
    }

    if (action === "verify") {
      const ref = db.collection("otps").doc(tel);
      const snap = await ref.get();
      if (!snap.exists) return res.status(400).json({ error: "Aucun code en attente. Recommencez." });

      const d = snap.data();
      if (Date.now() > d.expireAt) {
        await ref.delete();
        return res.status(400).json({ error: "Code expiré. Veuillez recommencer." });
      }
      if (d.tentatives >= 5) {
        await ref.delete();
        return res.status(400).json({ error: "Trop de tentatives. Veuillez recommencer." });
      }
      if (hashCode(String(code || "")) !== d.hash) {
        await ref.update({ tentatives: FieldValue.increment(1) });
        return res.status(400).json({ error: "Code incorrect. Réessayez." });
      }

      await ref.delete();

      // Second verrou : un compte peut avoir été bloqué après l'envoi du code.
      // (Le doc n'existe pas encore lors d'une inscription : cas normal.)
      const u = await db.collection("utilisateurs").doc(tel).get();
      if (u.exists && u.data().bloque) {
        return res.status(403).json({ error: COMPTE_BLOQUE });
      }

      const token = await adminAuth.createCustomToken(tel);
      return res.status(200).json({ success: true, token });
    }

    return res.status(400).json({ error: "Action inconnue" });
  } catch (e) {
    return res.status(500).json({ error: e.message });
  }
}
