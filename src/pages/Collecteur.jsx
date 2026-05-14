import { useState, useEffect } from "react";
import { collection, onSnapshot, doc, updateDoc, query, where } from "firebase/firestore";
import { db } from "../firebase/config";
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import {
  faTrash, faLocationDot, faClock, faMap, faTriangleExclamation, faXmark,
  faTruck, faBox, faCheck, faPhone, faHandPointer, faComment
} from "@fortawesome/free-solid-svg-icons";

const nomAffiche = (nom) => nom?.trim().split(/\s+/).pop() || nom || "";

const timeAgo = (timestamp) => {
  if (!timestamp?.seconds) return "";
  const now = Date.now();
  const diff = Math.floor((now - timestamp.seconds * 1000) / 1000);
  if (diff < 60) return "À l'instant";
  if (diff < 3600) return `${Math.floor(diff / 60)} min`;
  if (diff < 86400) return `${Math.floor(diff / 3600)} h`;
  return `${Math.floor(diff / 86400)} j`;
};

const STATUS = {
  "disponible": { bg: "#f0fdf4", text: "#16a34a", border: "#bbf7d0" },
  "en cours":   { bg: "#fffbeb", text: "#d97706", border: "#fde68a" },
  "collecté":   { bg: "#f8fafc", text: "#64748b", border: "#e2e8f0" },
};

export default function Collecteur({ utilisateur, mode }) {
  const [disponibles, setDisponibles] = useState([]);
  const [mesCollectes, setMesCollectes] = useState([]);
  const [loading, setLoading] = useState(true);
  const [filtreCommune, setFiltreCommune] = useState("");
  const [filtreUrgent, setFiltreUrgent] = useState(false);

  useEffect(() => {
    const q = query(collection(db, "signalements"), where("status", "==", "disponible"));
    const unsub = onSnapshot(q, (snapshot) => {
      const data = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
      data.sort((a, b) => (b.urgent ? 1 : 0) - (a.urgent ? 1 : 0));
      setDisponibles(data);
      setLoading(false);
    });
    return () => unsub();
  }, []);

  useEffect(() => {
    if (!utilisateur?.uid) return;
    const q = query(collection(db, "signalements"), where("collecteurId", "==", utilisateur.uid));
    const unsub = onSnapshot(q, (snapshot) => {
      const data = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
      data.sort((a, b) => (b.createdAt?.seconds || 0) - (a.createdAt?.seconds || 0));
      setMesCollectes(data);
    });
    return () => unsub();
  }, [utilisateur]);

  const notifierMenage = async (menageTelephone) => {
    const message = `✅ *Votre signalement a été accepté !*\n\n🚛 *Collecteur :* ${nomAffiche(utilisateur.nom)}\n📞 *Téléphone :* +${utilisateur.uid}\n\nIl arrive bientôt. Merci de faire confiance à Poubelle-CI ! 🗑️`;
    try {
      await fetch("https://wasenderapi.com/api/send-message", {
        method: "POST",
        headers: { "Content-Type": "application/json", "Authorization": `Bearer ${import.meta.env.VITE_WASENDER_API_KEY}` },
        body: JSON.stringify({ sessionId: import.meta.env.VITE_WASENDER_SESSION_ID, to: menageTelephone, text: message })
      });
    } catch (e) {
      console.error("WaSender erreur:", e.message);
    }
  };

  const accepter = async (id, signalement) => {
    await updateDoc(doc(db, "signalements", id), { status: "en cours", collecteurId: utilisateur.uid, collecteurNom: utilisateur.nom });
    if (signalement.uid) await notifierMenage(signalement.uid);
  };

  const terminer = async (id, signalement) => {
    await updateDoc(doc(db, "signalements", id), { status: "collecté" });
    if (signalement.uid) {
      const message = `✅ *Votre poubelle a été collectée !*\n\n🚛 *Collecteur :* ${nomAffiche(utilisateur.nom)}\n📍 ${signalement.commune} — ${signalement.quartier}\n\nMerci d'utiliser Poubelle-CI ! 🌍\npoubelle-ci.vercel.app`;
      try {
        await fetch("https://wasenderapi.com/api/send-message", {
          method: "POST",
          headers: { "Content-Type": "application/json", "Authorization": `Bearer ${import.meta.env.VITE_WASENDER_API_KEY}` },
          body: JSON.stringify({ sessionId: import.meta.env.VITE_WASENDER_SESSION_ID, to: signalement.uid, text: message })
        });
      } catch (e) {
        console.error("WaSender erreur:", e.message);
      }
    }
  };

  const communesDisponibles = [...new Set(disponibles.map(s => s.commune).filter(Boolean))].sort();
  const disponiblesFiltres = disponibles
    .filter(s => filtreCommune ? s.commune === filtreCommune : true)
    .filter(s => filtreUrgent ? s.urgent : true);

  const Carte = ({ s, actions }) => {
    const st = STATUS[s.status] || STATUS["disponible"];
    return (
      <div style={{
        background: "white", borderRadius: 16, marginBottom: 12, overflow: "hidden",
        boxShadow: s.urgent ? "0 0 0 2px #fca5a5, 0 4px 16px rgba(239,68,68,0.08)" : "0 2px 12px rgba(0,0,0,0.07)"
      }}>
        <div style={{ display: "flex" }}>
          {/* Image */}
          <div style={{ width: 100, minHeight: 120, flexShrink: 0, position: "relative", overflow: "hidden", background: "#f1f5f9" }}>
            {s.photo ? (
              <img src={s.photo} alt="poubelle" style={{ width: "100%", height: "100%", objectFit: "cover", position: "absolute", inset: 0 }} />
            ) : (
              <div style={{ position: "absolute", inset: 0, display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", background: "linear-gradient(135deg, #f0fdf4, #dcfce7)" }}>
                <span style={{ fontSize: 28, color: "#86efac" }}><FontAwesomeIcon icon={faTrash} /></span>
                <span style={{ fontSize: 9, color: "#86efac", fontWeight: 600, marginTop: 4 }}>Pas de photo</span>
              </div>
            )}
            {s.urgent && (
              <div style={{ position: "absolute", top: 6, left: 6, background: "#ef4444", color: "white", fontSize: 9, fontWeight: 800, padding: "2px 6px", borderRadius: 6 }}>URGENT</div>
            )}
          </div>

          {/* Infos */}
          <div style={{ flex: 1, padding: "12px 14px", display: "flex", flexDirection: "column", gap: 5 }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start" }}>
              <div style={{ fontSize: 15, fontWeight: 800, color: "#0f172a" }}>{nomAffiche(s.nom)}</div>
              <div style={{ fontSize: 10, color: "#94a3b8", whiteSpace: "nowrap", marginLeft: 6 }}><FontAwesomeIcon icon={faClock} style={{ marginRight: 3 }} />{timeAgo(s.createdAt)}</div>
            </div>

            <div style={{ fontSize: 12, color: "#16a34a", fontWeight: 700 }}>
              <FontAwesomeIcon icon={faLocationDot} style={{ marginRight: 4 }} />{s.commune} <span style={{ color: "#94a3b8", fontWeight: 400 }}>— {s.quartier}</span>
            </div>

            <div style={{ fontSize: 11, color: "#475569" }}><FontAwesomeIcon icon={faTrash} style={{ marginRight: 4 }} />{s.type}</div>

            {s.uid && (
              <div style={{ fontSize: 11, color: "#0f172a", fontWeight: 700 }}><FontAwesomeIcon icon={faPhone} style={{ marginRight: 4 }} />+{s.uid}</div>
            )}

            <div style={{ display: "flex", gap: 6, flexWrap: "wrap", marginTop: 2 }}>
              <span style={{ background: st.bg, color: st.text, border: `1px solid ${st.border}`, fontSize: 10, fontWeight: 700, padding: "2px 8px", borderRadius: 20 }}>
                {s.status}
              </span>
              <span style={{ background: "#f8fafc", color: "#475569", border: "1px solid #e2e8f0", fontSize: 10, padding: "2px 8px", borderRadius: 20 }}>
                {s.volume}
              </span>
              {s.lat && (
                <a href={`https://www.google.com/maps?q=${s.lat},${s.lng}`} target="_blank" rel="noreferrer" style={{ textDecoration: "none" }}>
                  <span style={{ background: "#eff6ff", color: "#3b82f6", border: "1px solid #bfdbfe", fontSize: 10, fontWeight: 700, padding: "2px 8px", borderRadius: 20 }}><FontAwesomeIcon icon={faMap} style={{ marginRight: 4 }} />GPS</span>
                </a>
              )}
            </div>

            {s.notes && <div style={{ fontSize: 11, color: "#94a3b8", fontStyle: "italic" }}><FontAwesomeIcon icon={faComment} style={{ marginRight: 4 }} />{s.notes}</div>}
          </div>
        </div>

        <div style={{ borderTop: "1px solid #f1f5f9", padding: "10px 14px" }}>
          {actions}
        </div>
      </div>
    );
  };

  if (loading) return (
    <div style={{ padding: 60, textAlign: "center", color: "#94a3b8" }}>
      <div style={{ fontSize: 32, marginBottom: 8 }}><FontAwesomeIcon icon={faClock} /></div>
      <div style={{ fontSize: 13 }}>Chargement...</div>
    </div>
  );

  return (
    <div style={{ padding: "16px 16px", maxWidth: 440, margin: "0 auto" }}>

      {/* Stats */}
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 10, marginBottom: 20 }}>
        {[
          { label: "Disponibles", value: disponibles.length, icon: faBox, color: "#16a34a", bg: "linear-gradient(135deg, #f0fdf4, #dcfce7)", border: "#bbf7d0" },
          { label: "En cours", value: mesCollectes.filter(s => s.status === "en cours").length, icon: faClock, color: "#d97706", bg: "linear-gradient(135deg, #fffbeb, #fef3c7)", border: "#fde68a" },
          { label: "Collectés", value: mesCollectes.filter(s => s.status === "collecté").length, icon: faCheck, color: "#3b82f6", bg: "linear-gradient(135deg, #eff6ff, #dbeafe)", border: "#bfdbfe" },
        ].map(s => (
          <div key={s.label} style={{ background: s.bg, borderRadius: 14, padding: "14px 8px", textAlign: "center", border: `1px solid ${s.border}`, boxShadow: "0 2px 8px rgba(0,0,0,0.05)" }}>
            <div style={{ fontSize: 18 }}><FontAwesomeIcon icon={s.icon} /></div>
            <div style={{ fontSize: 24, fontWeight: 900, color: s.color, lineHeight: 1.1 }}>{s.value}</div>
            <div style={{ fontSize: 10, color: "#64748b", fontWeight: 600, marginTop: 2 }}>{s.label}</div>
          </div>
        ))}
      </div>

      {/* Vue Disponibles */}
      {mode === "disponibles" && (
        <div>
          <div style={{ display: "flex", gap: 8, marginBottom: 14, flexWrap: "wrap" }}>
            <select value={filtreCommune} onChange={e => setFiltreCommune(e.target.value)} style={{
              flex: 1, minWidth: 130, padding: "9px 12px", borderRadius: 12, border: "1.5px solid #e2e8f0",
              fontSize: 12, color: "#0f172a", background: "white", outline: "none", fontWeight: 600,
              boxShadow: "0 1px 3px rgba(0,0,0,0.06)"
            }}>
              <option value="">Toutes les communes</option>
              {communesDisponibles.map(c => <option key={c} value={c}>{c}</option>)}
            </select>

            <button onClick={() => setFiltreUrgent(!filtreUrgent)} style={{
              padding: "9px 14px", borderRadius: 12, cursor: "pointer", fontWeight: 700, fontSize: 12,
              border: filtreUrgent ? "1.5px solid #ef4444" : "1.5px solid #e2e8f0",
              background: filtreUrgent ? "#fef2f2" : "white", color: filtreUrgent ? "#ef4444" : "#64748b",
              boxShadow: "0 1px 3px rgba(0,0,0,0.06)"
            }}><FontAwesomeIcon icon={faTriangleExclamation} style={{ marginRight: 5 }} />Urgent</button>

            {(filtreCommune || filtreUrgent) && (
              <button onClick={() => { setFiltreCommune(""); setFiltreUrgent(false); }} style={{
                padding: "9px 12px", borderRadius: 12, border: "1.5px solid #e2e8f0",
                background: "white", color: "#64748b", fontSize: 12, cursor: "pointer"
              }}><FontAwesomeIcon icon={faXmark} /></button>
            )}
          </div>

          <div style={{ fontSize: 12, color: "#94a3b8", marginBottom: 12, textAlign: "right", fontWeight: 600 }}>
            {disponiblesFiltres.length} résultat{disponiblesFiltres.length > 1 ? "s" : ""}
          </div>

          {disponiblesFiltres.length === 0 && (
            <div style={{ textAlign: "center", padding: 48, color: "#94a3b8" }}>
              <div style={{ fontSize: 36, marginBottom: 8 }}><FontAwesomeIcon icon={faTrash} /></div>
              <div style={{ fontSize: 13 }}>Aucun signalement pour ce filtre</div>
            </div>
          )}

          {disponiblesFiltres.map(s => (
            <Carte key={s.id} s={s} actions={
              <button onClick={() => {
                if (window.confirm("Accepter cette collecte ?\n\n📍 " + s.commune + " — " + s.quartier + "\n🗑️ " + s.type + " · " + s.volume)) {
                  accepter(s.id, s);
                }
              }} style={{
                width: "100%", padding: "11px", cursor: "pointer", fontWeight: 800, fontSize: 13,
                background: "linear-gradient(135deg, #16a34a, #15803d)", color: "white",
                border: "none", borderRadius: 12, boxShadow: "0 3px 10px rgba(22,163,74,0.3)"
              }}>
                <FontAwesomeIcon icon={faHandPointer} style={{ marginRight: 6 }} />Accepter cette collecte
              </button>
            } />
          ))}
        </div>
      )}

      {/* Vue Mes collectes */}
      {mode === "mescollectes" && (
        <div>
          {mesCollectes.length === 0 && (
            <div style={{ textAlign: "center", padding: 48, color: "#94a3b8" }}>
              <div style={{ fontSize: 36, marginBottom: 8 }}><FontAwesomeIcon icon={faTruck} /></div>
              <div style={{ fontSize: 13 }}>Vous n'avez pas encore de collectes</div>
            </div>
          )}

          {mesCollectes.map(s => (
            <Carte key={s.id} s={s} actions={
              s.status === "en cours" ? (
                <button onClick={() => terminer(s.id, s)} style={{
                  width: "100%", padding: "11px", cursor: "pointer", fontWeight: 800, fontSize: 13,
                  background: "linear-gradient(135deg, #0f2d0f, #166534)", color: "white",
                  border: "none", borderRadius: 12, boxShadow: "0 3px 10px rgba(15,45,15,0.3)"
                }}>
                  <FontAwesomeIcon icon={faCheck} style={{ marginRight: 6 }} />Marquer comme collecté
                </button>
              ) : (
                <div style={{ fontSize: 12, color: "#94a3b8", textAlign: "center", padding: "4px 0" }}>
                  {s.status === "collecté" ? <><FontAwesomeIcon icon={faCheck} style={{ marginRight: 5 }} />Collecte terminée</> : ""}
                </div>
              )
            } />
          ))}
        </div>
      )}
    </div>
  );
}
