// Ce fichier gère la navigation principale et l'état de connexion de l'utilisateur

import { useState, useEffect } from "react";
import { getAuth, onAuthStateChanged } from "firebase/auth";
import { doc, getDoc, query, where, collection, onSnapshot } from "firebase/firestore";
import { db } from "./firebase/config";
import Menage from "./pages/Menage";
import Collecteur from "./pages/Collecteur";
import Inscription from "./pages/Inscription";
import Connexion from "./pages/Connexion";



const timeAgo = (timestamp) => {
  if (!timestamp?.seconds) return "";
  const now = Date.now();
  const diff = Math.floor((now - timestamp.seconds * 1000) / 1000);
  if (diff < 60) return "Il y a quelques secondes";
  if (diff < 3600) return `Il y a ${Math.floor(diff / 60)} min`;
  if (diff < 86400) return `Il y a ${Math.floor(diff / 3600)} h`;
  return `Il y a ${Math.floor(diff / 86400)} j`;
};

const auth = getAuth();

function SignalementsPublics() {
  const [signalements, setSignalements] = useState([]);
  const [filtreCommune, setFiltreCommune] = useState("");
  const [filtreUrgent, setFiltreUrgent] = useState(false);

  useEffect(() => {
    const q = query(collection(db, "signalements"), where("status", "==", "disponible"));
    const unsub = onSnapshot(q, (snapshot) => {
      const data = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
      data.sort((a, b) => (b.urgent ? 1 : 0) - (a.urgent ? 1 : 0));
      setSignalements(data);
    });
    return () => unsub();
  }, []);

  const communesDisponibles = [...new Set(signalements.map(s => s.commune).filter(Boolean))].sort();

  const filtres = signalements
    .filter(s => filtreCommune ? s.commune === filtreCommune : true)
    .filter(s => filtreUrgent ? s.urgent : true);

  return (
    <div>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 12 }}>
        <h3 style={{ fontSize: 14, fontWeight: 800, color: "#1a2e1a", margin: 0 }}>
          📦 Signalements en cours
        </h3>
        <span style={{ background: "#dcfce7", color: "#15803d", fontSize: 11, fontWeight: 700, padding: "2px 10px", borderRadius: 20 }}>
          {filtres.length} disponible{filtres.length > 1 ? "s" : ""}
        </span>
      </div>

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

      {filtres.length === 0 && (
        <div style={{ textAlign: "center", padding: 30, color: "#6b9e5a", fontSize: 13 }}>
          Aucun signalement pour ce filtre
        </div>
      )}

      {filtres.map(s => (
        <div key={s.id} style={{
          background: "white", borderRadius: 14, marginBottom: 10,
          border: `1px solid ${s.urgent ? "#fee2e2" : "#e2f0e2"}`,
          overflow: "hidden"
        }}>
          <div style={{ display: "flex" }}>
            <div style={{ width: 80, minHeight: 80, flexShrink: 0, background: "#f0faf0", position: "relative", overflow: "hidden" }}>
              {s.photo ? (
                <img src={s.photo} alt="poubelle"
                  style={{ width: "100%", height: "100%", objectFit: "cover", position: "absolute", inset: 0 }} />
              ) : (
                <div style={{ position: "absolute", inset: 0, display: "flex", alignItems: "center", justifyContent: "center" }}>
                  <span style={{ fontSize: 22 }}>🗑️</span>
                </div>
              )}
            </div>
            <div style={{ flex: 1, padding: "8px 12px", display: "flex", flexDirection: "column", gap: 3 }}>
              <div style={{ display: "flex", gap: 5, flexWrap: "wrap" }}>
                {s.urgent && <span style={{ background: "#fee2e2", color: "#ef4444", fontSize: 10, fontWeight: 800, padding: "1px 7px", borderRadius: 10 }}>🔴 URGENT</span>}
                <span style={{ background: "#dcfce7", color: "#15803d", fontSize: 10, fontWeight: 700, padding: "1px 7px", borderRadius: 10 }}>disponible</span>
              </div>
              <div style={{ fontWeight: 700, fontSize: 13, color: "#1a2e1a" }}>{s.nom}</div>
              <div style={{ fontSize: 11, color: "#6b9e5a" }}>📍 {s.commune} — {s.quartier}</div>
              <div style={{ fontSize: 11, color: "#4a6b3a" }}>🗑️ {s.type} · {s.volume}</div>
              <div style={{ fontSize: 10, color: "#94a3b8" }}>🕐 {timeAgo(s.createdAt)}</div>
            </div>
          </div>
        </div>
      ))}

      <div style={{ textAlign: "center", marginTop: 16, padding: 16, background: "#f0fdf4", borderRadius: 12, border: "1px solid #c8e6c0" }}>
        <p style={{ fontSize: 13, color: "#2e7d32", fontWeight: 600, margin: 0 }}>
          🚛 Vous êtes collecteur ? Inscrivez-vous pour accepter des collectes !
        </p>
      </div>
    </div>
  );
}

export default function App() {
  const [mode, setMode] = useState("menage");
  const [ecran, setEcran] = useState("accueil");
  const [utilisateur, setUtilisateur] = useState(null);
  const [installPrompt, setInstallPrompt] = useState(null);
  const [showInstall, setShowInstall] = useState(false);

  useEffect(() => {
    window.addEventListener("beforeinstallprompt", (e) => {
      e.preventDefault();
      setInstallPrompt(e);
      setShowInstall(true);
    });

    const unsub = onAuthStateChanged(auth, async (user) => {
      if (user) {
        const snap = await getDoc(doc(db, "utilisateurs", user.uid));
        if (snap.exists()) {
          const userData = { uid: user.uid, ...snap.data() };
          setUtilisateur(userData);
          setMode(userData.role === "menage" ? "menage" : "disponibles");
          setEcran("app");
        }
      }
    });
    return () => unsub();
  }, []);

  const handleInstall = () => {
    if (installPrompt) {
      installPrompt.prompt();
      installPrompt.userChoice.then(() => {
        setInstallPrompt(null);
        setShowInstall(false);
      });
    }
  };

  const deconnexion = () => {
    auth.signOut();
    setUtilisateur(null);
    setEcran("accueil");
  };

  const Header = () => (
    <div style={{ background: "linear-gradient(135deg, #1a3a1a, #2e5d2e)", padding: "16px 20px 0", position: "sticky", top: 0, zIndex: 100 }}>
      <div style={{ maxWidth: 440, margin: "0 auto" }}>
        {showInstall && (
          <div style={{ background: "#a3e635", padding: "10px 16px", display: "flex", justifyContent: "space-between", alignItems: "center", borderRadius: 10, marginBottom: 10 }}>
            <span style={{ fontSize: 13, fontWeight: 700, color: "#1a3a1a" }}>📲 Installer l'app</span>
            <button onClick={handleInstall} style={{ background: "#1a3a1a", color: "#a3e635", border: "none", borderRadius: 8, padding: "6px 12px", fontWeight: 700, cursor: "pointer" }}>
              Installer
            </button>
          </div>
        )}
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 16 }}>
          <div>
            <h1 style={{ margin: 0, fontSize: 22, fontWeight: 800, color: "#a3e635" }}>🗑️ Poubelle-CI</h1>
            <p style={{ margin: 0, fontSize: 11, color: "#86efac" }}>Collecte propre, ville propre</p>
          </div>
          {utilisateur && (
            <div style={{ textAlign: "right" }}>
              <div style={{ fontSize: 12, color: "#a3e635", fontWeight: 700 }}>{utilisateur.nom}</div>
              <button onClick={deconnexion} style={{ fontSize: 10, color: "#86efac", background: "none", border: "none", cursor: "pointer", padding: 0 }}>
                Déconnexion
              </button>
            </div>
          )}
        </div>

        {ecran === "app" && (
          <div style={{ display: "flex", background: "rgba(0,0,0,0.2)", borderRadius: "12px 12px 0 0", padding: 4, gap: 4 }}>
            {(utilisateur?.role === "menage" ? [
              { key: "menage", label: "🏠 Signaler", desc: "Nouveau" },
              { key: "mescollectes", label: "📋 Mes signalements", desc: "Historique" },
            ] : [
              { key: "disponibles", label: "📦 Disponibles", desc: "Collecter" },
              { key: "mescollectes", label: "🚛 Mes collectes", desc: "Historique" },
            ]).map(tab => (
              <button key={tab.key} onClick={() => setMode(tab.key)} style={{
                flex: 1, padding: "10px 16px", borderRadius: "10px 10px 0 0",
                border: "none", cursor: "pointer",
                background: mode === tab.key ? "#f0fdf4" : "transparent",
                color: mode === tab.key ? "#1a3a1a" : "rgba(255,255,255,0.7)",
                fontWeight: 800, fontSize: 13, fontFamily: "sans-serif"
              }}>
                {tab.label}
                <div style={{ fontSize: 9, opacity: 0.7 }}>{tab.desc}</div>
              </button>
            ))}
          </div>
        )}
      </div>
    </div>
  );

  if (ecran === "accueil") return (
    <div style={{ minHeight: "100vh", background: "#f5fdf5", fontFamily: "sans-serif" }}>
      <Header />
      <div style={{ maxWidth: 440, margin: "0 auto", padding: "20px 16px" }}>
        <div style={{ textAlign: "center", marginBottom: 24 }}>
          <div style={{ fontSize: 60, marginBottom: 8 }}>🗑️</div>
          <h2 style={{ color: "#1a2e1a", marginBottom: 4, fontSize: 20 }}>Bienvenue sur Poubelle-CI</h2>
          <p style={{ color: "#6b9e5a", fontSize: 13, marginBottom: 20 }}>La plateforme de collecte de déchets en Côte d'Ivoire</p>
          <div style={{ display: "flex", gap: 10 }}>
            <button onClick={() => setEcran("inscription")} style={{
              flex: 1, padding: 14, background: "#4caf50", color: "white",
              border: "none", borderRadius: 12, fontSize: 14, fontWeight: 700, cursor: "pointer"
            }}>
              📝 Créer un compte
            </button>
            <button onClick={() => setEcran("connexion")} style={{
              flex: 1, padding: 14, background: "white", color: "#2e7d32",
              border: "2px solid #4caf50", borderRadius: 12, fontSize: 14, fontWeight: 700, cursor: "pointer"
            }}>
              🔐 Se connecter
            </button>
          </div>
        </div>
        <SignalementsPublics />
      </div>
    </div>
  );

  if (ecran === "inscription") return (
    <div style={{ minHeight: "100vh", background: "#f5fdf5", fontFamily: "sans-serif" }}>
      <Header />
      <Inscription onInscrit={(user) => {
        setUtilisateur(user);
        setMode(user.role === "menage" ? "menage" : "disponibles");
        setEcran("app");
      }} />
      <div style={{ textAlign: "center", padding: 16 }}>
        <span style={{ fontSize: 13, color: "#6b9e5a" }}>Déjà un compte ? </span>
        <button onClick={() => setEcran("connexion")} style={{ fontSize: 13, color: "#2e7d32", fontWeight: 700, background: "none", border: "none", cursor: "pointer" }}>
          Se connecter
        </button>
      </div>
    </div>
  );

  if (ecran === "connexion") return (
    <div style={{ minHeight: "100vh", background: "#f5fdf5", fontFamily: "sans-serif" }}>
      <Header />
      <Connexion onConnecte={(user) => {
        setUtilisateur(user);
        setMode(user.role === "menage" ? "menage" : "disponibles");
        setEcran("app");
      }} />
      <div style={{ textAlign: "center", padding: 16 }}>
        <span style={{ fontSize: 13, color: "#6b9e5a" }}>Pas encore de compte ? </span>
        <button onClick={() => setEcran("inscription")} style={{ fontSize: 13, color: "#2e7d32", fontWeight: 700, background: "none", border: "none", cursor: "pointer" }}>
          S'inscrire
        </button>
      </div>
    </div>
  );

  return (
    <div style={{ minHeight: "100vh", background: "#f5fdf5", fontFamily: "sans-serif" }}>
      <Header />
      <div style={{ maxWidth: 440, margin: "0 auto", paddingBottom: 40 }}>
        {utilisateur?.role === "menage" ? (
          <Menage utilisateur={utilisateur} mode={mode} />
        ) : (
          <Collecteur utilisateur={utilisateur} mode={mode} />
        )}
      </div>
    </div>
  );
}