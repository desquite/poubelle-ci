// Ce fichier gère la connexion d'un utilisateur existant via code WhatsApp WaSender

import { useState } from "react";
import { doc, getDoc } from "firebase/firestore";
import { signInWithCustomToken } from "firebase/auth";
import { db, auth } from "../firebase/config";
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import { faCheck, faArrowLeft, faComment, faLock, faShieldHalved } from "@fortawesome/free-solid-svg-icons";

// L'OTP est géré côté serveur (/api/otp) : le code n'apparaît jamais dans le navigateur.
const apiOtp = async (payload) => {
  const r = await fetch("/api/otp", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload)
  });
  const data = await r.json().catch(() => ({}));
  if (!r.ok) throw new Error(data.error || "Erreur serveur");
  return data;
};

export default function Connexion({ onConnecte }) {
  const [etape, setEtape] = useState(1);
  const [telephone, setTelephone] = useState("");
  const [code, setCode] = useState("");
  const [loading, setLoading] = useState(false);
  const [erreur, setErreur] = useState("");

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
      // L'existence du compte est vérifiée côté serveur (contexte connexion)
      await apiOtp({ action: "send", telephone: "225" + telephone.replace(/\s/g, ""), contexte: "connexion" });
      setEtape(2);
    } catch (e) {
      setErreur(e.message);
    }
    setLoading(false);
  };

  const verifierCode = async () => {
    if (!code) return;
    setLoading(true);
    setErreur("");
    try {
      const uid = "225" + telephone.replace(/\s/g, "");
      const { token } = await apiOtp({ action: "verify", telephone: uid, code });
      await signInWithCustomToken(auth, token);
      const snap = await getDoc(doc(db, "utilisateurs", uid));
      onConnecte({ uid, ...snap.data() });
    } catch (e) {
      setErreur(e.message);
    }
    setLoading(false);
  };

  if (etape === 1) return (
    <div style={{ padding: 24, maxWidth: 400, margin: "0 auto" }}>
      <h2 style={{ color: "#1a2e1a", marginBottom: 6 }}><FontAwesomeIcon icon={faLock} style={{ marginRight: 8, color: "#4caf50" }} />Se connecter</h2>
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
        {loading ? "Vérification..." : <><FontAwesomeIcon icon={faComment} style={{ marginRight: 6 }} />Recevoir le code WhatsApp</>}
      </button>
    </div>
  );

  return (
    <div style={{ padding: 24, maxWidth: 400, margin: "0 auto" }}>
      <h2 style={{ color: "#1a2e1a", marginBottom: 6 }}><FontAwesomeIcon icon={faShieldHalved} style={{ marginRight: 8, color: "#4caf50" }} />Vérification</h2>
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
        {loading ? "Vérification..." : <><FontAwesomeIcon icon={faCheck} style={{ marginRight: 6 }} />Confirmer le code</>}
      </button>

      <button onClick={() => setEtape(1)}
        style={{...btnStyle, background: "#e8f5e3", color: "#2e7d32", marginTop: 8}}>
        <FontAwesomeIcon icon={faArrowLeft} style={{ marginRight: 6 }} />Retour
      </button>
    </div>
  );
}