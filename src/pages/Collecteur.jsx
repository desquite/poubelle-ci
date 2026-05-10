// Ce fichier affiche les signalements avec image à gauche, infos à droite et filtres

import { useState, useEffect } from "react";
import { collection, onSnapshot, doc, updateDoc, query, where } from "firebase/firestore";
import { db } from "../firebase/config";

const STATUS_COLORS = {
  "disponible": { bg: "#dcfce7", text: "#15803d" },
  "en cours":   { bg: "#fef9c3", text: "#92400e" },
  "collecté":   { bg: "#f1f5f9", text: "#64748b" },
};

export default function Collecteur({ utilisateur }) {
  const [disponibles, setDisponibles] = useState([]);
  const [mesCollectes, setMesCollectes] = useState([]);
  const [onglet, setOnglet] = useState("disponibles");
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

  const accepter = async (id) => {
    await updateDoc(doc(db, "signalements", id), {
      status: "en cours",
      collecteurId: utilisateur.uid,
      collecteurNom: utilisateur.nom
    });
  };

  const terminer = async (id) => {
    await updateDoc(doc(db, "signalements", id), { status: "collecté" });
  };

  const communesDisponibles = [...new Set(disponibles.map(s => s.commune).filter(Boolean))].sort();

  const disponiblesFiltres = disponibles
    .filter(s => filtreCommune ? s.commune === filtreCommune : true)
    .filter(s => filtreUrgent ? s.urgent : true);

  const CarteSignalement = ({ s, actions }) => {
    const sc = STATUS_COLORS[s.status] || STATUS_COLORS["disponible"];
    return (
      <div style={{ background: "white", borderRadius: 14, border: `1px solid ${s.urgent ? "#fee2e2" : "#e2f0e2"}`, marginBottom: 12, overflow: "hidden" }}>
        <div style={{ display: "flex" }}>
          {/* Image à gauche */}
          <div style={{ width: 110, minHeight: 110, flexShrink: 0, background: "#f0faf0", position: "relative", overflow: "hidden" }}>
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
            <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
              {s.urgent && <span style={{ background: "#fee2e2", color: "#ef4444", fontSize: 10, fontWeight: 800, padding: "2px 8px", borderRadius: 10 }}>🔴 URGENT</span>}
              <span style={{ background: sc.bg, color: sc.text, fontSize: 10, fontWeight: 700, padding: "2px 8px", borderRadius: 10 }}>{s.status}</span>
            </div>
            <div style={{ fontWeight: 700, fontSize: 13, color: "#1a2e1a" }}>{s.nom}</div>
            <div style={{ fontSize: 12, color: "#6b9e5a" }}>📍 {s.commune} — {s.quartier}</div>
            <div style={{ fontSize: 12, color: "#4a6b3a" }}>🗑️ {s.type} · {s.volume}</div>
            {s.lat && (
              <a href={`https://www.google.com/maps?q=${s.lat},${s.lng}`} target="_blank" rel="noreferrer"
                style={{ fontSize: 11, color: "#4caf50", textDecoration: "none" }}>
                🗺️ Voir sur la carte
              </a>
            )}
            {s.notes && <div style={{ fontSize: 11, color: "#94a3b8" }}>💬 {s.notes}</div>}
          </div>
        </div>

        {/* Bouton action */}
        <div style={{ borderTop: "1px solid #e2f0e2", padding: "10px 12px" }}>
          {actions}
        </div>
      </div>
    );
  };

  if (loading) return <div style={{ padding: 40, textAlign: "center" }}>⏳ Chargement...</div>;

  return (
    <div style={{ padding: 20, maxWidth: 440, margin: "0 auto" }}>

      {/* Stats */}
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 10, marginBottom: 20 }}>
        {[
          { label: "Disponibles", value: disponibles.length, icon: "📦", color: "#22c55e" },
          { label: "En cours", value: mesCollectes.filter(s => s.status === "en cours").length, icon: "⏳", color: "#f59e0b" },
          { label: "Collectés", value: mesCollectes.filter(s => s.status === "collecté").length, icon: "✅", color: "#3b82f6" },
        ].map(s => (
          <div key={s.label} style={{ background: "#f0faf0", borderRadius: 12, padding: "12px 10px", textAlign: "center", border: "1px solid #c8e6c0" }}>
            <div style={{ fontSize: 20 }}>{s.icon}</div>
            <div style={{ fontSize: 22, fontWeight: 800, color: s.color, lineHeight: 1 }}>{s.value}</div>
            <div style={{ fontSize: 10, color: "#4a6b3a", fontWeight: 600 }}>{s.label}</div>
          </div>
        ))}
      </div>

      {/* Onglets */}
      <div style={{ display: "flex", gap: 8, marginBottom: 16 }}>
        {[
          { key: "disponibles", label: "📦 Disponibles" },
          { key: "mescollectes", label: "🚛 Mes collectes" },
        ].map(t => (
          <button key={t.key} onClick={() => setOnglet(t.key)} style={{
            flex: 1, padding: "10px", borderRadius: 10, border: "none", cursor: "pointer",
            background: onglet === t.key ? "#2e7d32" : "#e8f5e3",
            color: onglet === t.key ? "white" : "#4a6b3a",
            fontWeight: 700, fontSize: 13, fontFamily: "sans-serif"
          }}>
            {t.label}
          </button>
        ))}
      </div>

      {/* Disponibles */}
      {onglet === "disponibles" && (
        <div>
          {/* Filtres */}
          <div style={{ display: "flex", gap: 8, marginBottom: 14, flexWrap: "wrap" }}>
            <select value={filtreCommune} onChange={e => setFiltreCommune(e.target.value)}
              style={{ flex: 1, padding: "8px 10px", borderRadius: 10, border: "1.5px solid #c8e6c0", fontSize: 12, color: "#1a2e1a", background: "white", outline: "none" }}>
              <option value="">Toutes les communes</option>
              {communesDisponibles.map(c => <option key={c} value={c}>{c}</option>)}
            </select>

            <button onClick={() => setFiltreUrgent(!filtreUrgent)} style={{
              padding: "8px 12px", borderRadius: 10, border: "1.5px solid #fee2e2",
              background: filtreUrgent ? "#fee2e2" : "white",
              color: filtreUrgent ? "#ef4444" : "#94a3b8",
              fontSize: 12, fontWeight: 700, cursor: "pointer"
            }}>
              🔴 Urgent
            </button>

            {(filtreCommune || filtreUrgent) && (
              <button onClick={() => { setFiltreCommune(""); setFiltreUrgent(false); }} style={{
                padding: "8px 12px", borderRadius: 10, border: "1.5px solid #e2f0e2",
                background: "white", color: "#6b9e5a", fontSize: 12, fontWeight: 700, cursor: "pointer"
              }}>
                ✕ Réinitialiser
              </button>
            )}
          </div>

          {/* Compteur filtré */}
          <div style={{ fontSize: 12, color: "#6b9e5a", marginBottom: 10, textAlign: "right" }}>
            {disponiblesFiltres.length} résultat{disponiblesFiltres.length > 1 ? "s" : ""}
          </div>

          {disponiblesFiltres.length === 0 && (
            <div style={{ textAlign: "center", padding: 40, color: "#6b9e5a", fontSize: 13 }}>
              Aucun signalement pour ce filtre
            </div>
          )}
          {disponiblesFiltres.map(s => (
            <CarteSignalement key={s.id} s={s} actions={
              <button onClick={() => accepter(s.id)} style={{
                width: "100%", padding: "10px", background: "#4caf50", color: "white",
                border: "none", borderRadius: 10, fontWeight: 700, cursor: "pointer", fontSize: 13
              }}>
                ✋ Accepter cette collecte
              </button>
            } />
          ))}
        </div>
      )}

      {/* Mes collectes */}
      {onglet === "mescollectes" && (
        <div>
          {mesCollectes.length === 0 && (
            <div style={{ textAlign: "center", padding: 40, color: "#6b9e5a", fontSize: 13 }}>
              Vous n'avez pas encore de collectes
            </div>
          )}
          {mesCollectes.map(s => (
            <CarteSignalement key={s.id} s={s} actions={
              s.status === "en cours" ? (
                <button onClick={() => terminer(s.id)} style={{
                  width: "100%", padding: "10px", background: "#2e7d32", color: "white",
                  border: "none", borderRadius: 10, fontWeight: 700, cursor: "pointer", fontSize: 13
                }}>
                  ✅ Marquer comme collecté
                </button>
              ) : (
                <div style={{ fontSize: 12, color: "#94a3b8", textAlign: "center" }}>
                  {s.status === "collecté" ? "✅ Collecte terminée" : ""}
                </div>
              )
            } />
          ))}
        </div>
      )}
    </div>
  );
}