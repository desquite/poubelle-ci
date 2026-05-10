// Ce fichier gère la vue ménage avec commune, quartier, GPS et photo

import { useState, useEffect } from "react";
import { collection, addDoc, serverTimestamp, query, where, onSnapshot } from "firebase/firestore";
import { db } from "../firebase/config";
import { COMMUNES_QUARTIERS, COMMUNES } from "../quartiers";

const WASTE_TYPES = ["Ordures ménagères", "Encombrants", "Déchets recyclables", "Déchets organiques"];
const VOLUMES = ["Petit (moins d'un sac)", "Moyen (1-2 sacs)", "Grand (2-3 sacs)", "Gros volume", "Très grand volume"];

const STATUS_COLORS = {
  "disponible": { bg: "#dcfce7", text: "#15803d", dot: "#22c55e" },
  "en cours":   { bg: "#fef9c3", text: "#92400e", dot: "#f59e0b" },
  "collecté":   { bg: "#f1f5f9", text: "#64748b", dot: "#94a3b8" },
};

const uploadImage = async (file) => {
  const formData = new FormData();
  formData.append("file", file);
  formData.append("upload_preset", import.meta.env.VITE_CLOUDINARY_UPLOAD_PRESET);
  const response = await fetch(
    `https://api.cloudinary.com/v1_1/${import.meta.env.VITE_CLOUDINARY_CLOUD_NAME}/image/upload`,
    { method: "POST", body: formData }
  );
  const data = await response.json();
  return data.secure_url;
};

export default function Menage({ utilisateur }) {
  const [step, setStep] = useState(0);
  const [form, setForm] = useState({
    nom: utilisateur?.nom || "",
    commune: utilisateur?.commune || "",
    quartier: utilisateur?.quartier || "",
    adresse: "",
    type: "",
    volume: "",
    notes: "",
    urgent: false,
    lat: null,
    lng: null,
    photo: null,
  });
  const [gpsLoading, setGpsLoading] = useState(false);
  const [gpsOk, setGpsOk] = useState(false);
  const [photoPreview, setPhotoPreview] = useState(null);
  const [photoUploading, setPhotoUploading] = useState(false);
  const [loading, setLoading] = useState(false);
  const [mesSignalements, setMesSignalements] = useState([]);

  useEffect(() => {
    if (!utilisateur?.uid) return;
    const q = query(collection(db, "signalements"), where("uid", "==", utilisateur.uid));
    const unsub = onSnapshot(q, (snapshot) => {
      const data = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
      data.sort((a, b) => (b.createdAt?.seconds || 0) - (a.createdAt?.seconds || 0));
      setMesSignalements(data);
    });
    return () => unsub();
  }, [utilisateur]);

  const inputStyle = {
    width: "100%", padding: "10px 12px", borderRadius: 10,
    border: "1.5px solid #c8e6c0", fontSize: 13, outline: "none",
    boxSizing: "border-box", color: "#1a2e1a", background: "white",
    fontFamily: "sans-serif", marginBottom: 10
  };

  const labelStyle = { fontSize: 12, fontWeight: 700, color: "#2e7d32", display: "block", marginBottom: 4 };

  const localiser = () => {
    if (!navigator.geolocation) { alert("GPS non disponible"); return; }
    setGpsLoading(true);
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        setForm({ ...form, lat: pos.coords.latitude, lng: pos.coords.longitude });
        setGpsOk(true);
        setGpsLoading(false);
      },
      () => { alert("Impossible d'obtenir votre position."); setGpsLoading(false); }
    );
  };

  const handlePhoto = async (e) => {
    const file = e.target.files[0];
    if (!file) return;
    setPhotoPreview(URL.createObjectURL(file));
    setPhotoUploading(true);
    try {
      const url = await uploadImage(file);
      setForm({ ...form, photo: url });
    } catch (err) {
      alert("Erreur upload photo : " + err.message);
    }
    setPhotoUploading(false);
  };

  const handleSubmit = async () => {
    if (!form.commune || !form.quartier || !form.type || !form.volume) return;
    setLoading(true);
    try {
      await addDoc(collection(db, "signalements"), {
        ...form,
        uid: utilisateur.uid,
        status: "disponible",
        createdAt: serverTimestamp(),
      });

      await fetch("/.netlify/functions/notifier", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ signalement: form })
      });

      setStep(3);
      setForm({
        nom: utilisateur?.nom || "",
        commune: utilisateur?.commune || "",
        quartier: utilisateur?.quartier || "",
        adresse: "", type: "", volume: "", notes: "",
        urgent: false, lat: null, lng: null, photo: null
      });
      setGpsOk(false);
      setPhotoPreview(null);
    } catch (e) {
      alert("Erreur : " + e.message);
    }
    setLoading(false);
  };

  return (
    <div style={{ padding: 20, maxWidth: 440, margin: "0 auto" }}>

      {/* Stats */}
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 10, marginBottom: 20 }}>
        {[
          { label: "Total", value: mesSignalements.length, icon: "📦" },
          { label: "En cours", value: mesSignalements.filter(s => s.status === "en cours").length, icon: "⏳" },
          { label: "Collectés", value: mesSignalements.filter(s => s.status === "collecté").length, icon: "✅" },
        ].map(s => (
          <div key={s.label} style={{ background: "#f0faf0", borderRadius: 12, padding: "12px 10px", textAlign: "center", border: "1px solid #c8e6c0" }}>
            <div style={{ fontSize: 20 }}>{s.icon}</div>
            <div style={{ fontSize: 22, fontWeight: 800, color: "#1a2e1a", lineHeight: 1 }}>{s.value}</div>
            <div style={{ fontSize: 10, color: "#4a6b3a", fontWeight: 600 }}>{s.label}</div>
          </div>
        ))}
      </div>

      {/* Bouton signaler */}
      {step === 0 && (
        <button onClick={() => setStep(1)} style={{
          width: "100%", background: "linear-gradient(135deg, #4caf50, #2e7d32)", color: "white",
          border: "none", borderRadius: 16, padding: "18px 24px", fontSize: 16, fontWeight: 800,
          cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center", gap: 10,
          boxShadow: "0 4px 20px rgba(76,175,80,0.35)", marginBottom: 20
        }}>
          <span style={{ fontSize: 24 }}>🗑️</span> Signaler ma poubelle
        </button>
      )}

      {/* Etape 1 — Lieu */}
      {step === 1 && (
        <div style={{ background: "#f9fef9", borderRadius: 16, padding: 20, border: "2px solid #c8e6c0", marginBottom: 20 }}>
          <h3 style={{ margin: "0 0 16px", fontSize: 15, fontWeight: 800, color: "#1a2e1a" }}>📍 Lieu du ramassage</h3>

          <label style={labelStyle}>Votre nom</label>
          <input value={form.nom} onChange={e => setForm({...form, nom: e.target.value})}
            placeholder="Votre nom" style={inputStyle} />

          <label style={labelStyle}>Commune</label>
          <select value={form.commune} onChange={e => setForm({...form, commune: e.target.value, quartier: ""})} style={inputStyle}>
            <option value="">Choisir une commune...</option>
            {COMMUNES.map(c => <option key={c} value={c}>{c}</option>)}
          </select>

          {form.commune && (
            <>
              <label style={labelStyle}>Quartier</label>
              <select value={form.quartier} onChange={e => setForm({...form, quartier: e.target.value})} style={inputStyle}>
                <option value="">Choisir un quartier...</option>
                {COMMUNES_QUARTIERS[form.commune].map(q => <option key={q} value={q}>{q}</option>)}
              </select>
            </>
          )}

          <label style={labelStyle}>Adresse (optionnel)</label>
          <input value={form.adresse} onChange={e => setForm({...form, adresse: e.target.value})}
            placeholder="Ex: Rue 12, près de la mosquée..." style={inputStyle} />

          <button onClick={localiser} disabled={gpsLoading} style={{
            width: "100%", padding: "12px", borderRadius: 10, border: "2px dashed #4caf50",
            background: gpsOk ? "#f0fdf4" : "white", color: gpsOk ? "#2e7d32" : "#4caf50",
            fontWeight: 700, fontSize: 13, cursor: "pointer", marginBottom: 12
          }}>
            {gpsLoading ? "📡 Localisation..." : gpsOk ? "✅ Position GPS obtenue !" : "📍 Ajouter ma localisation GPS"}
          </button>

          <div style={{ display: "flex", gap: 10 }}>
            <button onClick={() => setStep(0)} style={{ flex: 1, padding: "12px", background: "#e8f5e3", color: "#2e7d32", border: "none", borderRadius: 12, fontWeight: 700, cursor: "pointer" }}>
              Annuler
            </button>
            <button onClick={() => setStep(2)} disabled={!form.commune || !form.quartier}
              style={{ flex: 2, padding: "12px", background: (!form.commune || !form.quartier) ? "#ccc" : "#4caf50", color: "white", border: "none", borderRadius: 12, fontWeight: 700, cursor: "pointer" }}>
              Continuer →
            </button>
          </div>
        </div>
      )}

      {/* Etape 2 — Type + Photo */}
      {step === 2 && (
        <div style={{ background: "#f9fef9", borderRadius: 16, padding: 20, border: "2px solid #c8e6c0", marginBottom: 20 }}>
          <h3 style={{ margin: "0 0 16px", fontSize: 15, fontWeight: 800, color: "#1a2e1a" }}>🗑️ Détails du signalement</h3>

          <label style={labelStyle}>Type de déchets</label>
          <select value={form.type} onChange={e => setForm({...form, type: e.target.value})} style={inputStyle}>
            <option value="">Choisir...</option>
            {WASTE_TYPES.map(t => <option key={t}>{t}</option>)}
          </select>

          <label style={labelStyle}>Volume estimé</label>
          <select value={form.volume} onChange={e => setForm({...form, volume: e.target.value})} style={inputStyle}>
            <option value="">Choisir...</option>
            {VOLUMES.map(v => <option key={v}>{v}</option>)}
          </select>

          <label style={labelStyle}>Note pour le collecteur (optionnel)</label>
          <textarea value={form.notes} onChange={e => setForm({...form, notes: e.target.value})}
            placeholder="Ex: Sonner à la porte verte..." rows={3}
            style={{...inputStyle, resize: "none"}} />

          <label style={labelStyle}>📸 Photo de la poubelle (optionnel)</label>
          <input type="file" accept="image/*" onChange={handlePhoto}
            style={{ marginBottom: 10, fontSize: 13 }} />
          {photoUploading && <p style={{ color: "#4caf50", fontSize: 12 }}>⏳ Upload en cours...</p>}
          {photoPreview && !photoUploading && (
            <img src={photoPreview} alt="aperçu"
              style={{ width: "100%", borderRadius: 10, marginBottom: 10, maxHeight: 200, objectFit: "cover" }} />
          )}

          <div style={{ display: "flex", alignItems: "center", gap: 10, padding: "12px", background: "#fff8e1", borderRadius: 10, marginBottom: 14, border: "1px solid #ffd54f" }}>
            <input type="checkbox" checked={form.urgent} onChange={e => setForm({...form, urgent: e.target.checked})} />
            <label style={{ fontSize: 13, fontWeight: 600, color: "#e65100" }}>🔴 Marquer comme urgent</label>
          </div>

          <div style={{ background: "#e8f5e3", borderRadius: 10, padding: 12, marginBottom: 14, fontSize: 12, color: "#2e7d32" }}>
            <strong>📍 {form.commune} — {form.quartier}</strong><br />
            {form.adresse && <>{form.adresse}<br /></>}
            {gpsOk && <span>✅ GPS activé · </span>}
            {form.photo && <span>📸 Photo ajoutée</span>}
          </div>

          <div style={{ display: "flex", gap: 10 }}>
            <button onClick={() => setStep(1)} style={{ flex: 1, padding: "12px", background: "#e8f5e3", color: "#2e7d32", border: "none", borderRadius: 12, fontWeight: 700, cursor: "pointer" }}>
              ← Retour
            </button>
            <button onClick={handleSubmit} disabled={!form.type || !form.volume || loading || photoUploading}
              style={{ flex: 2, padding: "12px", background: (!form.type || !form.volume) ? "#ccc" : "#4caf50", color: "white", border: "none", borderRadius: 12, fontWeight: 700, cursor: "pointer" }}>
              {loading ? "Envoi..." : "✅ Envoyer"}
            </button>
          </div>
        </div>
      )}

      {/* Succès */}
      {step === 3 && (
        <div style={{ textAlign: "center", background: "#f0fdf4", borderRadius: 16, padding: 28, border: "2px solid #86efac", marginBottom: 20 }}>
          <div style={{ fontSize: 48 }}>🎉</div>
          <h3 style={{ margin: "8px 0 4px", color: "#166534", fontWeight: 800 }}>Signalement envoyé !</h3>
          <p style={{ color: "#4a6b3a", fontSize: 13, margin: "0 0 16px" }}>Les collecteurs de votre zone ont été notifiés.</p>
          <button onClick={() => setStep(0)} style={{ padding: "12px 24px", background: "#4caf50", color: "white", border: "none", borderRadius: 12, fontWeight: 700, cursor: "pointer" }}>
            Nouveau signalement
          </button>
        </div>
      )}

      {/* Historique */}
      <h3 style={{ fontSize: 14, fontWeight: 800, color: "#1a2e1a", margin: "20px 0 10px" }}>📋 Mes signalements</h3>

      {mesSignalements.length === 0 && (
        <div style={{ textAlign: "center", padding: 30, color: "#6b9e5a", fontSize: 13 }}>
          Aucun signalement pour le moment
        </div>
      )}

      {mesSignalements.map(s => {
        const sc = STATUS_COLORS[s.status] || STATUS_COLORS["disponible"];
        return (
          <div key={s.id} style={{ background: "white", borderRadius: 12, border: "1px solid #e2f0e2", marginBottom: 10, overflow: "hidden" }}>
            <div style={{ display: "flex" }}>
              {/* Image à gauche */}
              <div style={{ width: 110, minHeight: 100, flexShrink: 0, background: "#f0faf0", position: "relative", overflow: "hidden" }}>
                {s.photo ? (
                  <img src={s.photo} alt="poubelle"
                    style={{ width: "100%", height: "100%", objectFit: "cover", position: "absolute", inset: 0 }} />
                ) : (
                  <div style={{ position: "absolute", inset: 0, display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", gap: 4 }}>
                    <span style={{ fontSize: 28 }}>🗑️</span>
                    <span style={{ fontSize: 10, color: "#6b9e5a" }}>Pas de photo</span>
                  </div>
                )}
              </div>

              {/* Infos à droite */}
              <div style={{ flex: 1, padding: "10px 12px", display: "flex", flexDirection: "column", gap: 4 }}>
                <div style={{ fontWeight: 700, fontSize: 13, color: "#1a2e1a" }}>{s.type}</div>
                <div style={{ fontSize: 11, color: "#6b9e5a" }}>📍 {s.commune} — {s.quartier}</div>
                <div style={{ fontSize: 11, color: "#6b9e5a" }}>🗑️ {s.volume}</div>
                {s.lat && (
                  <a href={`https://www.google.com/maps?q=${s.lat},${s.lng}`} target="_blank" rel="noreferrer"
                    style={{ fontSize: 11, color: "#4caf50", textDecoration: "none" }}>
                    🗺️ Voir sur la carte
                  </a>
                )}
                {s.urgent && <span style={{ fontSize: 10, color: "#ef4444", fontWeight: 700 }}>🔴 URGENT</span>}
                <div style={{ background: sc.bg, color: sc.text, padding: "2px 10px", borderRadius: 20, fontSize: 11, fontWeight: 700, alignSelf: "flex-start", marginTop: 4 }}>
                  {s.status}
                </div>
              </div>
            </div>
          </div>
        );
      })}
    </div>
  );
}