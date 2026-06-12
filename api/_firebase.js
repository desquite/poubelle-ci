// Initialisation partagée firebase-admin + envoi WhatsApp (WaSender) côté serveur.
// Les fichiers préfixés par _ dans /api ne sont pas exposés comme routes par Vercel.

import { initializeApp, cert, getApps } from "firebase-admin/app";
import { getFirestore } from "firebase-admin/firestore";
import { getAuth } from "firebase-admin/auth";

if (!getApps().length) {
  initializeApp({
    credential: cert({
      projectId: process.env.FIREBASE_PROJECT_ID,
      clientEmail: process.env.FIREBASE_CLIENT_EMAIL,
      privateKey: process.env.FIREBASE_PRIVATE_KEY?.replace(/\\n/g, "\n"),
    })
  });
}

export const db = getFirestore();
export const adminAuth = getAuth();

const WASENDER_KEY = process.env.WASENDER_API_KEY || process.env.VITE_WASENDER_API_KEY;
const SESSION_ID = process.env.WASENDER_SESSION_ID || process.env.VITE_WASENDER_SESSION_ID;

export const envoyerWhatsApp = async (to, text) => {
  const r = await fetch("https://wasenderapi.com/api/send-message", {
    method: "POST",
    headers: { "Content-Type": "application/json", "Authorization": `Bearer ${WASENDER_KEY}` },
    body: JSON.stringify({ sessionId: SESSION_ID, to, text })
  });
  return r.ok;
};

export const nomAffiche = (nom) => nom?.trim().split(/\s+/).pop() || nom || "";

// Distance entre deux points GPS en km (formule de Haversine)
export const distanceKm = (lat1, lng1, lat2, lng2) => {
  const R = 6371;
  const dLat = ((lat2 - lat1) * Math.PI) / 180;
  const dLng = ((lng2 - lng1) * Math.PI) / 180;
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos((lat1 * Math.PI) / 180) * Math.cos((lat2 * Math.PI) / 180) * Math.sin(dLng / 2) ** 2;
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
};
