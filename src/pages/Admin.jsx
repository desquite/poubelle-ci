import { useState, useEffect } from "react";
import { collection, onSnapshot, doc, updateDoc, query, orderBy } from "firebase/firestore";
import { db } from "../firebase/config";
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import {
  faTrash, faLocationDot, faTruck, faHouse, faBox, faChartBar,
  faClipboardList, faPhone, faTriangleExclamation, faCheck,
  faBan, faUnlock, faTrophy
} from "@fortawesome/free-solid-svg-icons";

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

export default function Admin({ onglet }) {
  const [signalements, setSignalements] = useState([]);
  const [utilisateurs, setUtilisateurs] = useState([]);
  const [filtreStatut, setFiltreStatut] = useState("");
  const [filtreCommune, setFiltreCommune] = useState("");
  const [filtreRole, setFiltreRole] = useState("");
  const [recherche, setRecherche] = useState("");

  useEffect(() => {
    const unsub = onSnapshot(collection(db, "signalements"), (snap) => {
      const data = snap.docs.map(d => ({ id: d.id, ...d.data() }));
      data.sort((a, b) => (b.createdAt?.seconds || 0) - (a.createdAt?.seconds || 0));
      setSignalements(data);
    });
    return () => unsub();
  }, []);

  useEffect(() => {
    const unsub = onSnapshot(collection(db, "utilisateurs"), (snap) => {
      setUtilisateurs(snap.docs.map(d => ({ id: d.id, ...d.data() })));
    });
    return () => unsub();
  }, []);

  const bloquer = async (uid, bloque) => {
    const label = bloque ? "Débloquer" : "Bloquer";
    if (!window.confirm(`${label} cet utilisateur ?`)) return;
    await updateDoc(doc(db, "utilisateurs", uid), { bloque: !bloque });
  };

  const communes = [...new Set(signalements.map(s => s.commune).filter(Boolean))].sort();

  const signalementsFiltrés = signalements
    .filter(s => filtreStatut ? s.status === filtreStatut : true)
    .filter(s => filtreCommune ? s.commune === filtreCommune : true);

  const utilisateursFiltres = utilisateurs
    .filter(u => filtreRole ? u.role === filtreRole : true)
    .filter(u => recherche ? (u.nom?.toLowerCase().includes(recherche.toLowerCase()) || u.telephone?.includes(recherche)) : true);

  // Stats
  const stats = {
    total: signalements.length,
    disponibles: signalements.filter(s => s.status === "disponible").length,
    enCours: signalements.filter(s => s.status === "en cours").length,
    collectes: signalements.filter(s => s.status === "collecté").length,
    menages: utilisateurs.filter(u => u.role === "menage").length,
    collecteurs: utilisateurs.filter(u => u.role === "collecteur").length,
    urgents: signalements.filter(s => s.urgent && s.status === "disponible").length,
    tauxCollecte: signalements.length > 0 ? Math.round((signalements.filter(s => s.status === "collecté").length / signalements.length) * 100) : 0,
  };

  // Top communes
  const parCommune = {};
  signalements.forEach(s => { if (s.commune) parCommune[s.commune] = (parCommune[s.commune] || 0) + 1; });
  const topCommunes = Object.entries(parCommune).sort((a, b) => b[1] - a[1]).slice(0, 5);

  // Top collecteurs
  const parCollecteur = {};
  signalements.filter(s => s.status === "collecté" && s.collecteurNom).forEach(s => {
    parCollecteur[s.collecteurNom] = (parCollecteur[s.collecteurNom] || 0) + 1;
  });
  const topCollecteurs = Object.entries(parCollecteur).sort((a, b) => b[1] - a[1]).slice(0, 5);

  // ── Dashboard ──
  if (onglet === "dashboard") return (
    <div style={{ padding: "16px", maxWidth: 440, margin: "0 auto" }}>

      {/* Stats principales */}
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10, marginBottom: 16 }}>
        {[
          { label: "Total signalements", value: stats.total, icon: faBox, color: "#0f172a", bg: "linear-gradient(135deg, #f8fafc, #f1f5f9)", border: "#e2e8f0" },
          { label: "Taux de collecte", value: `${stats.tauxCollecte}%`, icon: faChartBar, color: "#16a34a", bg: "linear-gradient(135deg, #f0fdf4, #dcfce7)", border: "#bbf7d0" },
          { label: "Ménages inscrits", value: stats.menages, icon: faHouse, color: "#3b82f6", bg: "linear-gradient(135deg, #eff6ff, #dbeafe)", border: "#bfdbfe" },
          { label: "Collecteurs actifs", value: stats.collecteurs, icon: faTruck, color: "#d97706", bg: "linear-gradient(135deg, #fffbeb, #fef3c7)", border: "#fde68a" },
        ].map(s => (
          <div key={s.label} style={{ background: s.bg, borderRadius: 16, padding: "16px 14px", border: `1px solid ${s.border}`, boxShadow: "0 2px 8px rgba(0,0,0,0.05)" }}>
            <div style={{ fontSize: 22 }}><FontAwesomeIcon icon={s.icon} /></div>
            <div style={{ fontSize: 28, fontWeight: 900, color: s.color, lineHeight: 1.1, marginTop: 4 }}>{s.value}</div>
            <div style={{ fontSize: 11, color: "#64748b", fontWeight: 600, marginTop: 4 }}>{s.label}</div>
          </div>
        ))}
      </div>

      {/* Statuts */}
      <div style={{ background: "white", borderRadius: 16, padding: "16px", marginBottom: 16, boxShadow: "0 2px 12px rgba(0,0,0,0.07)" }}>
        <div style={{ fontSize: 13, fontWeight: 800, color: "#0f172a", marginBottom: 14 }}><FontAwesomeIcon icon={faClipboardList} style={{ marginRight: 6 }} />État des signalements</div>
        {[
          { label: "Disponibles", value: stats.disponibles, color: "#16a34a", bg: "#f0fdf4" },
          { label: "En cours", value: stats.enCours, color: "#d97706", bg: "#fffbeb" },
          { label: "Collectés", value: stats.collectes, color: "#64748b", bg: "#f8fafc" },
          { label: "Urgents en attente", value: stats.urgents, color: "#ef4444", bg: "#fef2f2", icon: faTriangleExclamation },
        ].map(s => (
          <div key={s.label} style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "10px 12px", background: s.bg, borderRadius: 10, marginBottom: 8 }}>
            <span style={{ fontSize: 12, fontWeight: 600, color: "#475569" }}>{s.label}</span>
            <span style={{ fontSize: 16, fontWeight: 900, color: s.color }}>{s.value}</span>
          </div>
        ))}
      </div>

      {/* Top communes */}
      {topCommunes.length > 0 && (
        <div style={{ background: "white", borderRadius: 16, padding: "16px", marginBottom: 16, boxShadow: "0 2px 12px rgba(0,0,0,0.07)" }}>
          <div style={{ fontSize: 13, fontWeight: 800, color: "#0f172a", marginBottom: 14 }}><FontAwesomeIcon icon={faLocationDot} style={{ marginRight: 6 }} />Top communes actives</div>
          {topCommunes.map(([commune, count], i) => (
            <div key={commune} style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 10 }}>
              <div style={{ width: 24, height: 24, borderRadius: 8, background: "linear-gradient(135deg, #16a34a, #15803d)", color: "white", fontSize: 11, fontWeight: 800, display: "flex", alignItems: "center", justifyContent: "center" }}>{i + 1}</div>
              <div style={{ flex: 1 }}>
                <div style={{ fontSize: 12, fontWeight: 700, color: "#0f172a" }}>{commune}</div>
                <div style={{ height: 4, borderRadius: 4, background: "#f1f5f9", marginTop: 4 }}>
                  <div style={{ height: 4, borderRadius: 4, background: "linear-gradient(90deg, #16a34a, #a3e635)", width: `${Math.round((count / topCommunes[0][1]) * 100)}%` }} />
                </div>
              </div>
              <div style={{ fontSize: 13, fontWeight: 800, color: "#16a34a" }}>{count}</div>
            </div>
          ))}
        </div>
      )}

      {/* Top collecteurs */}
      {topCollecteurs.length > 0 && (
        <div style={{ background: "white", borderRadius: 16, padding: "16px", boxShadow: "0 2px 12px rgba(0,0,0,0.07)" }}>
          <div style={{ fontSize: 13, fontWeight: 800, color: "#0f172a", marginBottom: 14 }}><FontAwesomeIcon icon={faTruck} style={{ marginRight: 6 }} />Meilleurs collecteurs</div>
          {topCollecteurs.map(([nom, count], i) => (
            <div key={nom} style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 10 }}>
              <div style={{ width: 24, height: 24, borderRadius: 8, background: i === 0 ? "linear-gradient(135deg, #f59e0b, #d97706)" : "linear-gradient(135deg, #94a3b8, #64748b)", color: "white", fontSize: 11, fontWeight: 800, display: "flex", alignItems: "center", justifyContent: "center" }}>{i === 0 ? <FontAwesomeIcon icon={faTrophy} /> : i + 1}</div>
              <div style={{ flex: 1, fontSize: 12, fontWeight: 700, color: "#0f172a" }}>{nom}</div>
              <div style={{ fontSize: 13, fontWeight: 800, color: "#d97706" }}>{count} collectes</div>
            </div>
          ))}
        </div>
      )}
    </div>
  );

  // ── Signalements ──
  if (onglet === "signalements") return (
    <div style={{ padding: "16px", maxWidth: 440, margin: "0 auto" }}>
      <div style={{ display: "flex", gap: 8, marginBottom: 14, flexWrap: "wrap" }}>
        <select value={filtreStatut} onChange={e => setFiltreStatut(e.target.value)} style={{ flex: 1, minWidth: 120, padding: "9px 12px", borderRadius: 12, border: "1.5px solid #e2e8f0", fontSize: 12, color: "#0f172a", background: "white", outline: "none", fontWeight: 600 }}>
          <option value="">Tous les statuts</option>
          <option value="disponible">Disponible</option>
          <option value="en cours">En cours</option>
          <option value="collecté">Collecté</option>
        </select>
        <select value={filtreCommune} onChange={e => setFiltreCommune(e.target.value)} style={{ flex: 1, minWidth: 120, padding: "9px 12px", borderRadius: 12, border: "1.5px solid #e2e8f0", fontSize: 12, color: "#0f172a", background: "white", outline: "none", fontWeight: 600 }}>
          <option value="">Toutes communes</option>
          {communes.map(c => <option key={c} value={c}>{c}</option>)}
        </select>
        {(filtreStatut || filtreCommune) && (
          <button onClick={() => { setFiltreStatut(""); setFiltreCommune(""); }} style={{ padding: "9px 12px", borderRadius: 12, border: "1.5px solid #e2e8f0", background: "white", color: "#64748b", fontSize: 12, cursor: "pointer" }}>✕</button>
        )}
      </div>

      <div style={{ fontSize: 12, color: "#94a3b8", marginBottom: 12, fontWeight: 600 }}>{signalementsFiltrés.length} signalement{signalementsFiltrés.length > 1 ? "s" : ""}</div>

      {signalementsFiltrés.map(s => {
        const st = STATUS[s.status] || STATUS["disponible"];
        return (
          <div key={s.id} style={{ background: "white", borderRadius: 16, marginBottom: 10, overflow: "hidden", boxShadow: s.urgent ? "0 0 0 2px #fca5a5, 0 4px 12px rgba(239,68,68,0.08)" : "0 2px 10px rgba(0,0,0,0.07)" }}>
            <div style={{ display: "flex" }}>
              <div style={{ width: 90, minHeight: 100, flexShrink: 0, position: "relative", background: "#f1f5f9" }}>
                {s.photo ? <img src={s.photo} alt="" style={{ width: "100%", height: "100%", objectFit: "cover", position: "absolute", inset: 0 }} /> : (
                  <div style={{ position: "absolute", inset: 0, display: "flex", alignItems: "center", justifyContent: "center", background: "linear-gradient(135deg, #f0fdf4, #dcfce7)" }}>
                    <span style={{ fontSize: 24, color: "#86efac" }}><FontAwesomeIcon icon={faTrash} /></span>
                  </div>
                )}
                {s.urgent && <div style={{ position: "absolute", top: 5, left: 5, background: "#ef4444", color: "white", fontSize: 8, fontWeight: 800, padding: "2px 5px", borderRadius: 5 }}>URGENT</div>}
              </div>
              <div style={{ flex: 1, padding: "10px 12px", display: "flex", flexDirection: "column", gap: 4 }}>
                <div style={{ display: "flex", justifyContent: "space-between" }}>
                  <div style={{ fontSize: 13, fontWeight: 800, color: "#0f172a" }}>{s.nom}</div>
                  <div style={{ fontSize: 10, color: "#94a3b8" }}>{timeAgo(s.createdAt)}</div>
                </div>
                <div style={{ fontSize: 11, color: "#16a34a", fontWeight: 700 }}><FontAwesomeIcon icon={faLocationDot} style={{ marginRight: 4 }} />{s.commune} — {s.quartier}</div>
                <div style={{ fontSize: 11, color: "#475569" }}><FontAwesomeIcon icon={faTrash} style={{ marginRight: 4 }} />{s.type} · {s.volume}</div>
                {s.collecteurNom && <div style={{ fontSize: 11, color: "#64748b" }}><FontAwesomeIcon icon={faTruck} style={{ marginRight: 4 }} />{s.collecteurNom}</div>}
                <div style={{ display: "flex", gap: 6, marginTop: 2 }}>
                  <span style={{ background: st.bg, color: st.text, border: `1px solid ${st.border}`, fontSize: 10, fontWeight: 700, padding: "2px 8px", borderRadius: 20 }}>{s.status}</span>
                </div>
              </div>
            </div>
          </div>
        );
      })}
    </div>
  );

  // ── Utilisateurs ──
  if (onglet === "utilisateurs") return (
    <div style={{ padding: "16px", maxWidth: 440, margin: "0 auto" }}>
      <div style={{ display: "flex", gap: 8, marginBottom: 14 }}>
        <input value={recherche} onChange={e => setRecherche(e.target.value)} placeholder="Rechercher par nom ou téléphone..." style={{ flex: 1, padding: "9px 12px", borderRadius: 12, border: "1.5px solid #e2e8f0", fontSize: 12, outline: "none", color: "#0f172a" }} />
        <select value={filtreRole} onChange={e => setFiltreRole(e.target.value)} style={{ padding: "9px 12px", borderRadius: 12, border: "1.5px solid #e2e8f0", fontSize: 12, color: "#0f172a", background: "white", outline: "none", fontWeight: 600 }}>
          <option value="">Tous</option>
          <option value="menage">Ménages</option>
          <option value="collecteur">Collecteurs</option>
        </select>
      </div>

      <div style={{ fontSize: 12, color: "#94a3b8", marginBottom: 12, fontWeight: 600 }}>{utilisateursFiltres.length} utilisateur{utilisateursFiltres.length > 1 ? "s" : ""}</div>

      {utilisateursFiltres.map(u => (
        <div key={u.id} style={{ background: "white", borderRadius: 16, padding: "14px 16px", marginBottom: 10, boxShadow: "0 2px 10px rgba(0,0,0,0.07)", opacity: u.bloque ? 0.6 : 1 }}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start" }}>
            <div style={{ flex: 1 }}>
              <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 4 }}>
                <div style={{ fontSize: 14, fontWeight: 800, color: "#0f172a" }}>{u.nom}</div>
                {u.bloque && <span style={{ background: "#fef2f2", color: "#ef4444", fontSize: 9, fontWeight: 800, padding: "2px 6px", borderRadius: 6 }}>BLOQUÉ</span>}
              </div>
              <div style={{ fontSize: 11, color: "#94a3b8" }}><FontAwesomeIcon icon={faPhone} style={{ marginRight: 4 }} />+{u.telephone}</div>
              <div style={{ fontSize: 11, color: "#64748b", marginTop: 2 }}><FontAwesomeIcon icon={faLocationDot} style={{ marginRight: 4 }} />{u.commune} — {u.quartier}</div>
              <div style={{ marginTop: 6 }}>
                <span style={{
                  fontSize: 10, fontWeight: 700, padding: "3px 10px", borderRadius: 20,
                  background: u.role === "collecteur" ? "linear-gradient(135deg, #fffbeb, #fef3c7)" : "linear-gradient(135deg, #eff6ff, #dbeafe)",
                  color: u.role === "collecteur" ? "#d97706" : "#3b82f6",
                  border: `1px solid ${u.role === "collecteur" ? "#fde68a" : "#bfdbfe"}`
                }}>
                  {u.role === "collecteur" ? <><FontAwesomeIcon icon={faTruck} style={{ marginRight: 5 }} />Collecteur</> : <><FontAwesomeIcon icon={faHouse} style={{ marginRight: 5 }} />Ménage</>}
                </span>
              </div>
            </div>
            {u.role !== "admin" && (
              <button onClick={() => bloquer(u.id, u.bloque)} style={{
                padding: "8px 12px", borderRadius: 10, border: "none", cursor: "pointer", fontWeight: 700, fontSize: 11,
                background: u.bloque ? "#f0fdf4" : "#fef2f2",
                color: u.bloque ? "#16a34a" : "#ef4444"
              }}>
                {u.bloque ? <><FontAwesomeIcon icon={faUnlock} style={{ marginRight: 5 }} />Débloquer</> : <><FontAwesomeIcon icon={faBan} style={{ marginRight: 5 }} />Bloquer</>}
              </button>
            )}
          </div>
        </div>
      ))}
    </div>
  );

  return null;
}
