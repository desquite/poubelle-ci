import { useState, useEffect } from "react";
import { collection, addDoc, serverTimestamp, query, where, onSnapshot, deleteDoc, doc } from "firebase/firestore";
import { db } from "../firebase/config";
import { COMMUNES_QUARTIERS, COMMUNES } from "../quartiers";
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import {
  faTrash, faLocationDot, faClock, faMap, faTriangleExclamation,
  faBox, faCheck, faClipboardList, faSatelliteDish, faCamera,
  faArrowLeft, faPlus, faCircleCheck
} from "@fortawesome/free-solid-svg-icons";

const WASTE_TYPES = ["Ordures ménagères", "Encombrants", "Déchets recyclables", "Déchets organiques"];
const VOLUMES = ["Petit (moins d'un sac)", "Moyen (1-2 sacs)", "Grand (2-3 sacs)", "Gros volume", "Très grand volume"];

const STATUS = {
  "disponible": { bg: "#f0fdf4", text: "#16a34a", border: "#bbf7d0" },
  "en cours":   { bg: "#fffbeb", text: "#d97706", border: "#fde68a" },
  "collecté":   { bg: "#f8fafc", text: "#64748b", border: "#e2e8f0" },
};

const timeAgo = (timestamp) => {
  if (!timestamp?.seconds) return "";
  const now = Date.now();
  const diff = Math.floor((now - timestamp.seconds * 1000) / 1000);
  if (diff < 60) return "À l'instant";
  if (diff < 3600) return `${Math.floor(diff / 60)} min`;
  if (diff < 86400) return `${Math.floor(diff / 3600)} h`;
  return `${Math.floor(diff / 86400)} j`;
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

export default function Menage({ utilisateur, mode }) {
  const [step, setStep] = useState(0);
  const [form, setForm] = useState({
    nom: utilisateur?.nom || "", commune: utilisateur?.commune || "",
    quartier: utilisateur?.quartier || "", adresse: "",
    type: "", volume: "", notes: "", urgent: false, lat: null, lng: null, photo: null,
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

  const inp = {
    width: "100%", padding: "12px 14px", borderRadius: 12, border: "1.5px solid #e2e8f0",
    fontSize: 13, outline: "none", boxSizing: "border-box", color: "#0f172a",
    background: "white", fontFamily: "sans-serif", marginBottom: 12,
    boxShadow: "0 1px 3px rgba(0,0,0,0.05)"
  };
  const lbl = { fontSize: 11, fontWeight: 700, color: "#16a34a", display: "block", marginBottom: 5, textTransform: "uppercase", letterSpacing: 0.5 };

  const localiser = () => {
    if (!navigator.geolocation) { alert("GPS non disponible"); return; }
    setGpsLoading(true);
    navigator.geolocation.getCurrentPosition(
      (pos) => { setForm({ ...form, lat: pos.coords.latitude, lng: pos.coords.longitude }); setGpsOk(true); setGpsLoading(false); },
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
    } catch (err) { alert("Erreur upload : " + err.message); }
    setPhotoUploading(false);
  };

  const handleSubmit = async () => {
    if (!form.commune || !form.quartier || !form.type || !form.volume) return;
    setLoading(true);
    try {
      await addDoc(collection(db, "signalements"), { ...form, uid: utilisateur.uid, status: "disponible", createdAt: serverTimestamp() });
      await fetch("/api/notifier", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ signalement: form }) });
      setStep(3);
      setForm({ nom: utilisateur?.nom || "", commune: utilisateur?.commune || "", quartier: utilisateur?.quartier || "", adresse: "", type: "", volume: "", notes: "", urgent: false, lat: null, lng: null, photo: null });
      setGpsOk(false);
      setPhotoPreview(null);
    } catch (e) { alert("Erreur : " + e.message); }
    setLoading(false);
  };

  const supprimerSignalement = async (id, status) => {
    if (status === "en cours") { alert("Impossible de supprimer un signalement en cours."); return; }
    if (window.confirm("Supprimer ce signalement ?")) await deleteDoc(doc(db, "signalements", id));
  };

  // ── Vue Historique ──
  if (mode === "mescollectes") return (
    <div style={{ padding: "16px", maxWidth: 440, margin: "0 auto" }}>

      {/* Stats */}
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 10, marginBottom: 20 }}>
        {[
          { label: "Total", value: mesSignalements.length, icon: faBox, color: "#0f172a", bg: "linear-gradient(135deg, #f8fafc, #f1f5f9)", border: "#e2e8f0" },
          { label: "En cours", value: mesSignalements.filter(s => s.status === "en cours").length, icon: faClock, color: "#d97706", bg: "linear-gradient(135deg, #fffbeb, #fef3c7)", border: "#fde68a" },
          { label: "Collectés", value: mesSignalements.filter(s => s.status === "collecté").length, icon: faCheck, color: "#16a34a", bg: "linear-gradient(135deg, #f0fdf4, #dcfce7)", border: "#bbf7d0" },
        ].map(s => (
          <div key={s.label} style={{ background: s.bg, borderRadius: 14, padding: "14px 8px", textAlign: "center", border: `1px solid ${s.border}`, boxShadow: "0 2px 8px rgba(0,0,0,0.05)" }}>
            <div style={{ fontSize: 18 }}><FontAwesomeIcon icon={s.icon} /></div>
            <div style={{ fontSize: 24, fontWeight: 900, color: s.color, lineHeight: 1.1 }}>{s.value}</div>
            <div style={{ fontSize: 10, color: "#64748b", fontWeight: 600, marginTop: 2 }}>{s.label}</div>
          </div>
        ))}
      </div>

      {mesSignalements.length === 0 && (
        <div style={{ textAlign: "center", padding: 48, color: "#94a3b8" }}>
          <div style={{ fontSize: 36, marginBottom: 8 }}><FontAwesomeIcon icon={faClipboardList} /></div>
          <div style={{ fontSize: 13 }}>Aucun signalement pour le moment</div>
        </div>
      )}

      {mesSignalements.map(s => {
        const st = STATUS[s.status] || STATUS["disponible"];
        return (
          <div key={s.id} style={{ background: "white", borderRadius: 16, marginBottom: 12, overflow: "hidden", boxShadow: "0 2px 12px rgba(0,0,0,0.07)" }}>
            <div style={{ display: "flex" }}>
              <div style={{ width: 100, minHeight: 110, flexShrink: 0, position: "relative", overflow: "hidden", background: "#f1f5f9" }}>
                {s.photo ? (
                  <img src={s.photo} alt="poubelle" style={{ width: "100%", height: "100%", objectFit: "cover", position: "absolute", inset: 0 }} />
                ) : (
                  <div style={{ position: "absolute", inset: 0, display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", background: "linear-gradient(135deg, #f0fdf4, #dcfce7)" }}>
                    <span style={{ fontSize: 28, color: "#86efac" }}><FontAwesomeIcon icon={faTrash} /></span>
                  </div>
                )}
                {s.urgent && <div style={{ position: "absolute", top: 6, left: 6, background: "#ef4444", color: "white", fontSize: 9, fontWeight: 800, padding: "2px 6px", borderRadius: 6 }}>URGENT</div>}
              </div>

              <div style={{ flex: 1, padding: "12px 14px", display: "flex", flexDirection: "column", gap: 5 }}>
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start" }}>
                  <div style={{ fontSize: 14, fontWeight: 800, color: "#0f172a" }}>{s.type}</div>
                  <div style={{ fontSize: 10, color: "#94a3b8" }}><FontAwesomeIcon icon={faClock} style={{ marginRight: 3 }} />{timeAgo(s.createdAt)}</div>
                </div>
                <div style={{ fontSize: 12, color: "#16a34a", fontWeight: 700 }}>
                  <FontAwesomeIcon icon={faLocationDot} style={{ marginRight: 4 }} />{s.commune} <span style={{ color: "#94a3b8", fontWeight: 400 }}>— {s.quartier}</span>
                </div>
                <div style={{ display: "flex", gap: 6, flexWrap: "wrap", marginTop: 2 }}>
                  <span style={{ background: st.bg, color: st.text, border: `1px solid ${st.border}`, fontSize: 10, fontWeight: 700, padding: "2px 8px", borderRadius: 20 }}>{s.status}</span>
                  <span style={{ background: "#f8fafc", color: "#475569", border: "1px solid #e2e8f0", fontSize: 10, padding: "2px 8px", borderRadius: 20 }}>{s.volume}</span>
                  {s.lat && (
                    <a href={`https://www.google.com/maps?q=${s.lat},${s.lng}`} target="_blank" rel="noreferrer" style={{ textDecoration: "none" }}>
                      <span style={{ background: "#eff6ff", color: "#3b82f6", border: "1px solid #bfdbfe", fontSize: 10, fontWeight: 700, padding: "2px 8px", borderRadius: 20 }}><FontAwesomeIcon icon={faMap} style={{ marginRight: 4 }} />GPS</span>
                    </a>
                  )}
                </div>
              </div>
            </div>

            {s.status !== "en cours" && (
              <div style={{ borderTop: "1px solid #f1f5f9", padding: "10px 14px" }}>
                <button onClick={() => supprimerSignalement(s.id, s.status)} style={{
                  width: "100%", padding: "9px", background: "#fff5f5", color: "#ef4444",
                  border: "1px solid #fecaca", borderRadius: 10, fontWeight: 700, cursor: "pointer", fontSize: 12
                }}>
                  <FontAwesomeIcon icon={faTrash} style={{ marginRight: 5 }} />Supprimer
                </button>
              </div>
            )}
          </div>
        );
      })}
    </div>
  );

  // ── Vue Signaler ──
  return (
    <div style={{ padding: "16px", maxWidth: 440, margin: "0 auto" }}>

      {/* Étape 0 — Accueil */}
      {step === 0 && (
        <>
          <div style={{
            background: "linear-gradient(135deg, #0f2d0f, #166534)",
            borderRadius: 20, padding: "28px 20px", textAlign: "center",
            marginBottom: 20, boxShadow: "0 8px 32px rgba(15,45,15,0.25)"
          }}>
            <div style={{ fontSize: 48, marginBottom: 12, color: "#a3e635" }}><FontAwesomeIcon icon={faTrash} /></div>
            <h3 style={{ color: "white", fontSize: 18, fontWeight: 900, margin: "0 0 8px" }}>Signaler ma poubelle</h3>
            <p style={{ color: "#86efac", fontSize: 13, margin: "0 0 20px" }}>Un collecteur interviendra rapidement</p>
            <button onClick={() => setStep(1)} style={{
              background: "linear-gradient(135deg, #a3e635, #65a30d)", color: "#14532d",
              border: "none", borderRadius: 14, padding: "14px 32px",
              fontSize: 15, fontWeight: 900, cursor: "pointer",
              boxShadow: "0 4px 16px rgba(163,230,53,0.4)"
            }}>
              + Nouveau signalement
            </button>
          </div>

          {/* Mini stats */}
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 10, marginBottom: 4 }}>
            {[
              { label: "Total", value: mesSignalements.length, icon: faBox, color: "#0f172a" },
              { label: "En cours", value: mesSignalements.filter(s => s.status === "en cours").length, icon: faClock, color: "#d97706" },
              { label: "Collectés", value: mesSignalements.filter(s => s.status === "collecté").length, icon: faCheck, color: "#16a34a" },
            ].map(s => (
              <div key={s.label} style={{ background: "white", borderRadius: 14, padding: "12px 8px", textAlign: "center", boxShadow: "0 2px 8px rgba(0,0,0,0.06)" }}>
                <div style={{ fontSize: 16 }}><FontAwesomeIcon icon={s.icon} /></div>
                <div style={{ fontSize: 22, fontWeight: 900, color: s.color, lineHeight: 1.1 }}>{s.value}</div>
                <div style={{ fontSize: 10, color: "#64748b", fontWeight: 600, marginTop: 2 }}>{s.label}</div>
              </div>
            ))}
          </div>
        </>
      )}

      {/* Étape 1 — Lieu */}
      {step === 1 && (
        <div style={{ background: "white", borderRadius: 20, padding: 20, boxShadow: "0 4px 20px rgba(0,0,0,0.08)", marginBottom: 16 }}>
          <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 20 }}>
            <div style={{ width: 32, height: 32, borderRadius: 10, background: "linear-gradient(135deg, #16a34a, #15803d)", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 16, color: "white" }}><FontAwesomeIcon icon={faLocationDot} /></div>
            <div>
              <div style={{ fontSize: 15, fontWeight: 800, color: "#0f172a" }}>Lieu du ramassage</div>
              <div style={{ fontSize: 11, color: "#94a3b8" }}>Étape 1 sur 2</div>
            </div>
          </div>

          <label style={lbl}>Votre nom</label>
          <input value={form.nom} onChange={e => setForm({...form, nom: e.target.value})} placeholder="Votre nom complet" style={inp} />

          <label style={lbl}>Commune</label>
          <select value={form.commune} onChange={e => setForm({...form, commune: e.target.value, quartier: ""})} style={inp}>
            <option value="">Choisir une commune...</option>
            {COMMUNES.map(c => <option key={c} value={c}>{c}</option>)}
          </select>

          {form.commune && (
            <>
              <label style={lbl}>Quartier</label>
              <select value={form.quartier} onChange={e => setForm({...form, quartier: e.target.value})} style={inp}>
                <option value="">Choisir un quartier...</option>
                {COMMUNES_QUARTIERS[form.commune].map(q => <option key={q} value={q}>{q}</option>)}
              </select>
            </>
          )}

          <label style={lbl}>Adresse (optionnel)</label>
          <input value={form.adresse} onChange={e => setForm({...form, adresse: e.target.value})} placeholder="Ex: Rue 12, près de la mosquée..." style={inp} />

          <button onClick={localiser} disabled={gpsLoading} style={{
            width: "100%", padding: "12px", borderRadius: 12, cursor: "pointer", fontWeight: 700, fontSize: 13, marginBottom: 16,
            border: gpsOk ? "none" : "2px dashed #16a34a",
            background: gpsOk ? "linear-gradient(135deg, #f0fdf4, #dcfce7)" : "white",
            color: gpsOk ? "#16a34a" : "#16a34a",
            boxShadow: gpsOk ? "0 2px 8px rgba(22,163,74,0.15)" : "none"
          }}>
            {gpsLoading ? <><FontAwesomeIcon icon={faSatelliteDish} style={{ marginRight: 6 }} />Localisation en cours...</> : gpsOk ? <><FontAwesomeIcon icon={faCheck} style={{ marginRight: 6 }} />Position GPS obtenue !</> : <><FontAwesomeIcon icon={faLocationDot} style={{ marginRight: 6 }} />Ajouter ma localisation GPS</>}
          </button>

          <div style={{ display: "flex", gap: 10 }}>
            <button onClick={() => setStep(0)} style={{ flex: 1, padding: "13px", background: "#f8fafc", color: "#64748b", border: "1.5px solid #e2e8f0", borderRadius: 12, fontWeight: 700, cursor: "pointer", fontSize: 13 }}>
              Annuler
            </button>
            <button onClick={() => setStep(2)} disabled={!form.commune || !form.quartier} style={{
              flex: 2, padding: "13px", borderRadius: 12, fontWeight: 800, cursor: "pointer", fontSize: 13, border: "none",
              background: (!form.commune || !form.quartier) ? "#e2e8f0" : "linear-gradient(135deg, #16a34a, #15803d)",
              color: (!form.commune || !form.quartier) ? "#94a3b8" : "white",
              boxShadow: (!form.commune || !form.quartier) ? "none" : "0 3px 10px rgba(22,163,74,0.3)"
            }}>
              Continuer →
            </button>
          </div>
        </div>
      )}

      {/* Étape 2 — Détails */}
      {step === 2 && (
        <div style={{ background: "white", borderRadius: 20, padding: 20, boxShadow: "0 4px 20px rgba(0,0,0,0.08)", marginBottom: 16 }}>
          <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 20 }}>
            <div style={{ width: 32, height: 32, borderRadius: 10, background: "linear-gradient(135deg, #16a34a, #15803d)", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 16, color: "white" }}><FontAwesomeIcon icon={faTrash} /></div>
            <div>
              <div style={{ fontSize: 15, fontWeight: 800, color: "#0f172a" }}>Détails du signalement</div>
              <div style={{ fontSize: 11, color: "#94a3b8" }}>Étape 2 sur 2</div>
            </div>
          </div>

          <label style={lbl}>Type de déchets</label>
          <select value={form.type} onChange={e => setForm({...form, type: e.target.value})} style={inp}>
            <option value="">Choisir...</option>
            {WASTE_TYPES.map(t => <option key={t}>{t}</option>)}
          </select>

          <label style={lbl}>Volume estimé</label>
          <select value={form.volume} onChange={e => setForm({...form, volume: e.target.value})} style={inp}>
            <option value="">Choisir...</option>
            {VOLUMES.map(v => <option key={v}>{v}</option>)}
          </select>

          <label style={lbl}>Note pour le collecteur (optionnel)</label>
          <textarea value={form.notes} onChange={e => setForm({...form, notes: e.target.value})}
            placeholder="Ex: Sonner à la porte verte..." rows={3} style={{...inp, resize: "none"}} />

          <label style={lbl}>Photo de la poubelle (optionnel)</label>
          <label style={{
            display: "block", width: "100%", padding: "12px", borderRadius: 12, boxSizing: "border-box",
            border: "2px dashed #e2e8f0", background: "#f8fafc", textAlign: "center",
            fontSize: 13, color: "#64748b", cursor: "pointer", marginBottom: 12
          }}>
            <FontAwesomeIcon icon={faCamera} style={{ marginRight: 6 }} />{photoPreview ? "Changer la photo" : "Ajouter une photo"}
            <input type="file" accept="image/*" onChange={handlePhoto} style={{ display: "none" }} />
          </label>
          {photoUploading && <p style={{ color: "#16a34a", fontSize: 12, textAlign: "center" }}><FontAwesomeIcon icon={faClock} style={{ marginRight: 5 }} />Upload en cours...</p>}
          {photoPreview && !photoUploading && (
            <img src={photoPreview} alt="aperçu" style={{ width: "100%", borderRadius: 12, marginBottom: 12, maxHeight: 180, objectFit: "cover" }} />
          )}

          <div style={{
            display: "flex", alignItems: "center", gap: 12, padding: "14px", marginBottom: 16,
            background: form.urgent ? "#fef2f2" : "#fffbeb", borderRadius: 12,
            border: `1.5px solid ${form.urgent ? "#fecaca" : "#fde68a"}`, cursor: "pointer"
          }} onClick={() => setForm({...form, urgent: !form.urgent})}>
            <div style={{
              width: 22, height: 22, borderRadius: 6, border: `2px solid ${form.urgent ? "#ef4444" : "#fbbf24"}`,
              background: form.urgent ? "#ef4444" : "white", display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0
            }}>
              {form.urgent && <span style={{ color: "white", fontSize: 13, fontWeight: 900 }}>✓</span>}
            </div>
            <div>
              <div style={{ fontSize: 13, fontWeight: 700, color: form.urgent ? "#ef4444" : "#92400e" }}><FontAwesomeIcon icon={faTriangleExclamation} style={{ marginRight: 6 }} />Marquer comme urgent</div>
              <div style={{ fontSize: 11, color: "#94a3b8" }}>Les collecteurs seront alertés en priorité</div>
            </div>
          </div>

          {/* Récap */}
          <div style={{ background: "#f0fdf4", borderRadius: 12, padding: "12px 14px", marginBottom: 16, border: "1px solid #bbf7d0" }}>
            <div style={{ fontSize: 12, fontWeight: 700, color: "#16a34a" }}><FontAwesomeIcon icon={faLocationDot} style={{ marginRight: 4 }} />{form.commune} — {form.quartier}</div>
            {form.adresse && <div style={{ fontSize: 11, color: "#475569", marginTop: 2 }}>{form.adresse}</div>}
            <div style={{ display: "flex", gap: 8, marginTop: 6 }}>
              {gpsOk && <span style={{ fontSize: 10, background: "#dcfce7", color: "#16a34a", padding: "2px 8px", borderRadius: 20, fontWeight: 600 }}><FontAwesomeIcon icon={faCheck} style={{ marginRight: 3 }} />GPS</span>}
              {form.photo && <span style={{ fontSize: 10, background: "#dcfce7", color: "#16a34a", padding: "2px 8px", borderRadius: 20, fontWeight: 600 }}><FontAwesomeIcon icon={faCamera} style={{ marginRight: 3 }} />Photo</span>}
            </div>
          </div>

          <div style={{ display: "flex", gap: 10 }}>
            <button onClick={() => setStep(1)} style={{ flex: 1, padding: "13px", background: "#f8fafc", color: "#64748b", border: "1.5px solid #e2e8f0", borderRadius: 12, fontWeight: 700, cursor: "pointer", fontSize: 13 }}>
              ← Retour
            </button>
            <button onClick={handleSubmit} disabled={!form.type || !form.volume || loading || photoUploading} style={{
              flex: 2, padding: "13px", borderRadius: 12, fontWeight: 800, cursor: "pointer", fontSize: 13, border: "none",
              background: (!form.type || !form.volume) ? "#e2e8f0" : "linear-gradient(135deg, #16a34a, #15803d)",
              color: (!form.type || !form.volume) ? "#94a3b8" : "white",
              boxShadow: (!form.type || !form.volume) ? "none" : "0 3px 10px rgba(22,163,74,0.3)"
            }}>
              {loading ? "Envoi..." : <><FontAwesomeIcon icon={faCheck} style={{ marginRight: 6 }} />Envoyer</>}
            </button>
          </div>
        </div>
      )}

      {/* Succès */}
      {step === 3 && (
        <div style={{
          textAlign: "center", background: "linear-gradient(135deg, #0f2d0f, #166534)",
          borderRadius: 20, padding: "40px 24px", marginBottom: 20,
          boxShadow: "0 8px 32px rgba(15,45,15,0.25)"
        }}>
          <div style={{ fontSize: 56, marginBottom: 12, color: "#a3e635" }}><FontAwesomeIcon icon={faCircleCheck} /></div>
          <h3 style={{ margin: "0 0 8px", color: "white", fontWeight: 900, fontSize: 20 }}>Signalement envoyé !</h3>
          <p style={{ color: "#86efac", fontSize: 13, margin: "0 0 24px", lineHeight: 1.5 }}>
            Les collecteurs de votre zone<br />ont été notifiés par WhatsApp.
          </p>
          <button onClick={() => setStep(0)} style={{
            padding: "14px 32px", background: "linear-gradient(135deg, #a3e635, #65a30d)",
            color: "#14532d", border: "none", borderRadius: 14, fontWeight: 900,
            fontSize: 14, cursor: "pointer", boxShadow: "0 4px 16px rgba(163,230,53,0.4)"
          }}>
            + Nouveau signalement
          </button>
        </div>
      )}
    </div>
  );
}
