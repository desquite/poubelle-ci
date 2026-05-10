// Ce fichier gère l'inscription avec choix de commune et quartier selon le rôle

import { useState } from "react";
import { doc, setDoc } from "firebase/firestore";
import { db } from "../firebase/config";
import { COMMUNES_QUARTIERS, COMMUNES } from "../quartiers";

const WASENDER_KEY = import.meta.env.VITE_WASENDER_API_KEY;

const genererCode = () => Math.floor(100000 + Math.random() * 900000).toString();

const envoyerWhatsApp = async (numero, code) => {
  const response = await fetch("https://wasenderapi.com/api/send-message", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "Authorization": `Bearer ${WASENDER_KEY}`
    },
    body: JSON.stringify({
      sessionId: "42536",
      to: "225" + numero.replace(/\s/g, ""),
      text: `🗑️ *Poubelle-CI*\n\nVotre code de vérification est : *${code}*\n\nCe code expire dans 5 minutes.`
    })
  });
  return response.ok;
};

export default function Inscription({ onInscrit }) {
  const [etape, setEtape] = useState(1);
  const [role, setRole] = useState("");
  const [nom, setNom] = useState("");
  const [telephone, setTelephone] = useState("");
  const [commune, setCommune] = useState("");
  const [quartier, setQuartier] = useState("");
  const [code, setCode] = useState("");
  const [codeAttendu, setCodeAttendu] = useState("");
  const [loading, setLoading] = useState(false);
  const [erreur, setErreur] = useState("");
  const [expiration, setExpiration] = useState(null);

  const inputStyle = {
    width: "100%", padding: "12px", borderRadius: 10,
    border: "1.5px solid #c8e6c0", fontSize: 14, outline: "none",
    boxSizing: "border-box", fontFamily: "sans-serif", marginBottom: 12,
    background: "white", color: "#1a2e1a"
  };

  const btnStyle = {
    width: "100%", padding: "14px", background: "#4caf50", color: "white",
    border: "none", borderRadius: 12, fontSize: 15, fontWeight: 700,
    cursor: "pointer", marginTop: 8, fontFamily: "sans-serif"
  };

  const labelStyle = { fontSize: 12, fontWeight: 700, color: "#2e7d32", display: "block", marginBottom: 4 };

  const envoyerCode = async () => {
    if (!telephone || !nom || !role || !commune || !quartier) return;
    setLoading(true);
    setErreur("");
    try {
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
      await setDoc(doc(db, "utilisateurs", uid), {
        nom, telephone: uid, role, commune, quartier, createdAt: new Date()
      });
      onInscrit({ uid, nom, role, commune, quartier });
    } catch (e) {
      setErreur("Erreur : " + e.message);
    }
    setLoading(false);
  };

  if (etape === 1) return (
    <div style={{ padding: 24, maxWidth: 400, margin: "0 auto" }}>
      <h2 style={{ color: "#1a2e1a", marginBottom: 6 }}>📝 Créer un compte</h2>
      <p style={{ color: "#6b9e5a", fontSize: 13, marginBottom: 20 }}>Rejoignez Poubelle-CI</p>

      {/* Choix du rôle */}
      <p style={{ fontWeight: 700, color: "#2e7d32", marginBottom: 10 }}>Je suis...</p>
      <div style={{ display: "flex", gap: 10, marginBottom: 16 }}>
        {[
          { key: "menage", label: "🏠 Ménage", desc: "Je signale mes poubelles" },
          { key: "collecteur", label: "🚛 Collecteur", desc: "Je ramasse les poubelles" },
        ].map(r => (
          <div key={r.key} onClick={() => setRole(r.key)} style={{
            flex: 1, padding: 14, borderRadius: 12, cursor: "pointer", textAlign: "center",
            border: `2px solid ${role === r.key ? "#4caf50" : "#e2f0e2"}`,
            background: role === r.key ? "#f0fdf4" : "white"
          }}>
            <div style={{ fontSize: 24 }}>{r.label.split(" ")[0]}</div>
            <div style={{ fontWeight: 700, fontSize: 13, color: "#1a2e1a" }}>{r.label.split(" ")[1]}</div>
            <div style={{ fontSize: 11, color: "#6b9e5a" }}>{r.desc}</div>
          </div>
        ))}
      </div>

      {/* Nom */}
      <label style={labelStyle}>Votre nom complet</label>
      <input value={nom} onChange={e => setNom(e.target.value)}
        placeholder="Ex: Kouassi Jean" style={inputStyle} />

      {/* Téléphone */}
      <label style={labelStyle}>Numéro WhatsApp</label>
      <div style={{ display: "flex", gap: 8, marginBottom: 12 }}>
        <div style={{ padding: "12px", background: "#e8f5e3", borderRadius: 10, fontWeight: 700, color: "#2e7d32", fontSize: 14 }}>🇨🇮 +225</div>
        <input value={telephone} onChange={e => setTelephone(e.target.value)}
          placeholder="07 00 00 00 00" style={{...inputStyle, marginBottom: 0, flex: 1}} />
      </div>

      {/* Commune */}
      <label style={labelStyle}>
        {role === "collecteur" ? "Votre zone de travail / résidence" : "Votre commune"}
      </label>
      <select value={commune} onChange={e => { setCommune(e.target.value); setQuartier(""); }} style={inputStyle}>
        <option value="">Choisir une commune...</option>
        {COMMUNES.map(c => <option key={c} value={c}>{c}</option>)}
      </select>

      {/* Quartier */}
      {commune && (
        <>
          <label style={labelStyle}>Votre quartier</label>
          <select value={quartier} onChange={e => setQuartier(e.target.value)} style={inputStyle}>
            <option value="">Choisir un quartier...</option>
            {COMMUNES_QUARTIERS[commune].map(q => <option key={q} value={q}>{q}</option>)}
          </select>
        </>
      )}

      {erreur && <p style={{ color: "red", fontSize: 12 }}>{erreur}</p>}

      <button onClick={envoyerCode}
        disabled={!role || !nom || !telephone || !commune || !quartier || loading}
        style={{...btnStyle, opacity: (!role || !nom || !telephone || !commune || !quartier) ? 0.5 : 1}}>
        {loading ? "Envoi en cours..." : "💬 Recevoir le code WhatsApp"}
      </button>
    </div>
  );

  return (
    <div style={{ padding: 24, maxWidth: 400, margin: "0 auto" }}>
      <h2 style={{ color: "#1a2e1a", marginBottom: 6 }}>✅ Vérification</h2>
      <p style={{ color: "#4a6b3a", fontSize: 13, marginBottom: 16 }}>
        Un code a été envoyé sur WhatsApp au <strong>+225 {telephone}</strong>
      </p>

      <label style={labelStyle}>Code de vérification</label>
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