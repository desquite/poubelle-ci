// Ce fichier gère la connexion d'un utilisateur existant via code WhatsApp WaSender

import { useState } from "react";
import { doc, getDoc } from "firebase/firestore";
import { db } from "../firebase/config";

const WASENDER_KEY = import.meta.env.VITE_WASENDER_API_KEY;
const SESSION_ID = import.meta.env.VITE_WASENDER_SESSION_ID;

const genererCode = () => Math.floor(100000 + Math.random() * 900000).toString();

const envoyerWhatsApp = async (numero, code) => {
  const response = await fetch("https://wasenderapi.com/api/send-message", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "Authorization": `Bearer ${WASENDER_KEY}`
    },
    body: JSON.stringify({
      sessionId: SESSION_ID,
      to: "225" + numero.replace(/\s/g, ""),
      text: `*${code}* est votre code de connexion Poubelle-CI.\n\nCe code expire dans 5 minutes. Ne le partagez pas.`
    })
  });
  return response.ok;
};

export default function Connexion({ onConnecte }) {
  const [etape, setEtape] = useState(1);
  const [telephone, setTelephone] = useState("");
  const [code, setCode] = useState("");
  const [codeAttendu, setCodeAttendu] = useState("");
  const [loading, setLoading] = useState(false);
  const [erreur, setErreur] = useState("");
  const [expiration, setExpiration] = useState(null);

  const inputStyle = {
    width: "100%", padding: "12px", borderRadius: 10,
    border: "1.5px solid #c8e6c0", fontSize: 14, outline: "none",
    boxSizing: "border-box", fontFamily: "sans-serif", marginBottom: 12
  };

  const btnStyle = {
    width: "100%", padding: "14px", background: "#4caf50", color: "white",
    border: "none", borderRadius: 12, fontSize: 15, fontWeight: 700,
    cursor: "pointer", marginTop: 8
  };

  const envoyerCode = async () => {
    if (!telephone) return;
    setLoading(true);
    setErreur("");
    try {
      const uid = "225" + telephone.replace(/\s/g, "");
      const snap = await getDoc(doc(db, "utilisateurs", uid));
      if (!snap.exists()) {
        setErreur("Numéro introuvable. Veuillez vous inscrire d'abord.");
        setLoading(false);
        return;
      }
      const nouveauCode = genererCode();
      const ok = await envoyerWhatsApp(telephone, nouveauCode);
      if (ok) {
        setCodeAttendu(nouveauCode);
        setExpiration(Date.now() + 5 * 60 * 1000);
        setEtape(2);
      } else {
        setErreur("Erreur d'envoi WhatsApp. Vérifiez votre numéro.");
      }
    } catch (e) {
      setErreur("Erreur : " + e.message);
    }
    setLoading(false);
  };

  const verifierCode = async () => {
    if (!code) return;
    setLoading(true);
    setErreur("");
    if (Date.now() > expiration) {
      setErreur("Code expiré. Veuillez recommencer.");
      setLoading(false);
      return;
    }
    if (code !== codeAttendu) {
      setErreur("Code incorrect. Réessayez.");
      setLoading(false);
      return;
    }
    try {
      const uid = "225" + telephone.replace(/\s/g, "");
      const snap = await getDoc(doc(db, "utilisateurs", uid));
      onConnecte({ uid, ...snap.data() });
    } catch (e) {
      setErreur("Erreur : " + e.message);
    }
    setLoading(false);
  };

  if (etape === 1) return (
    <div style={{ padding: 24, maxWidth: 400, margin: "0 auto" }}>
      <h2 style={{ color: "#1a2e1a", marginBottom: 6 }}>🔐 Se connecter</h2>
      <p style={{ color: "#6b9e5a", fontSize: 13, marginBottom: 24 }}>Connectez-vous à votre compte</p>

      <label style={{ fontSize: 12, fontWeight: 700, color: "#2e7d32" }}>Numéro WhatsApp</label>
      <div style={{ display: "flex", gap: 8, marginBottom: 12 }}>
        <div style={{ padding: "12px", background: "#e8f5e3", borderRadius: 10, fontWeight: 700, color: "#2e7d32", fontSize: 14 }}>🇨🇮 +225</div>
        <input value={telephone} onChange={e => setTelephone(e.target.value)}
          placeholder="07 00 00 00 00" style={{...inputStyle, marginBottom: 0, flex: 1}} />
      </div>

      {erreur && <p style={{ color: "red", fontSize: 12 }}>{erreur}</p>}

      <button onClick={envoyerCode} disabled={!telephone || loading}
        style={{...btnStyle, opacity: !telephone ? 0.5 : 1}}>
        {loading ? "Vérification..." : "💬 Recevoir le code WhatsApp"}
      </button>
    </div>
  );

  return (
    <div style={{ padding: 24, maxWidth: 400, margin: "0 auto" }}>
      <h2 style={{ color: "#1a2e1a", marginBottom: 6 }}>✅ Vérification</h2>
      <p style={{ color: "#4a6b3a", fontSize: 13, marginBottom: 16 }}>
        Code envoyé sur WhatsApp au <strong>+225 {telephone}</strong>
      </p>

      <label style={{ fontSize: 12, fontWeight: 700, color: "#2e7d32" }}>Code de vérification</label>
      <input value={code} onChange={e => setCode(e.target.value)}
        placeholder="123456" maxLength={6}
        style={{...inputStyle, fontSize: 24, textAlign: "center", letterSpacing: 8}} />

      {erreur && <p style={{ color: "red", fontSize: 12 }}>{erreur}</p>}

      <button onClick={verifierCode} disabled={!code || loading}
        style={{...btnStyle, opacity: !code ? 0.5 : 1}}>
        {loading ? "Vérification..." : "✅ Confirmer le code"}
      </button>

      <button onClick={() => setEtape(1)}
        style={{...btnStyle, background: "#e8f5e3", color: "#2e7d32", marginTop: 8}}>
        ← Retour
      </button>
    </div>
  );
}