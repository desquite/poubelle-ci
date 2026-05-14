import { useState, useEffect } from "react";
import { getAuth, onAuthStateChanged } from "firebase/auth";
import { doc, getDoc, query, where, collection, onSnapshot } from "firebase/firestore";
import { db } from "./firebase/config";
import Menage from "./pages/Menage";
import Collecteur from "./pages/Collecteur";
import Inscription from "./pages/Inscription";
import Connexion from "./pages/Connexion";
import Admin from "./pages/Admin";

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

const auth = getAuth();

function SignalementsPublics({ onInscription }) {
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
    <div style={{ padding: "0 16px 32px" }}>

      {/* Section titre + compteur */}
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 16 }}>
        <div>
          <h3 style={{ margin: 0, fontSize: 16, fontWeight: 800, color: "#0f172a" }}>Signalements actifs</h3>
          <p style={{ margin: 0, fontSize: 12, color: "#64748b" }}>En attente de collecte</p>
        </div>
        <div style={{
          background: "linear-gradient(135deg, #16a34a, #15803d)",
          color: "white", fontSize: 13, fontWeight: 800,
          padding: "6px 14px", borderRadius: 20,
          boxShadow: "0 2px 8px rgba(22,163,74,0.35)"
        }}>
          {filtres.length} dispo{filtres.length > 1 ? "s" : ""}
        </div>
      </div>

      {/* Filtres */}
      <div style={{ display: "flex", gap: 8, marginBottom: 16, flexWrap: "wrap" }}>
        <select value={filtreCommune} onChange={e => setFiltreCommune(e.target.value)} style={{
          flex: 1, minWidth: 140, padding: "9px 12px", borderRadius: 12,
          border: "1.5px solid #e2e8f0", fontSize: 12, color: "#0f172a",
          background: "white", outline: "none", fontWeight: 600,
          boxShadow: "0 1px 3px rgba(0,0,0,0.06)"
        }}>
          <option value="">Toutes les communes</option>
          {communesDisponibles.map(c => <option key={c} value={c}>{c}</option>)}
        </select>

        <button onClick={() => setFiltreUrgent(!filtreUrgent)} style={{
          padding: "9px 14px", borderRadius: 12, cursor: "pointer", fontWeight: 700, fontSize: 12,
          border: filtreUrgent ? "1.5px solid #ef4444" : "1.5px solid #e2e8f0",
          background: filtreUrgent ? "#fef2f2" : "white",
          color: filtreUrgent ? "#ef4444" : "#64748b",
          boxShadow: "0 1px 3px rgba(0,0,0,0.06)"
        }}>
          🔴 Urgent
        </button>

        {(filtreCommune || filtreUrgent) && (
          <button onClick={() => { setFiltreCommune(""); setFiltreUrgent(false); }} style={{
            padding: "9px 12px", borderRadius: 12, border: "1.5px solid #e2e8f0",
            background: "white", color: "#64748b", fontSize: 12, fontWeight: 600, cursor: "pointer"
          }}>✕</button>
        )}
      </div>

      {/* Cartes */}
      {filtres.length === 0 && (
        <div style={{ textAlign: "center", padding: "40px 20px", color: "#94a3b8", fontSize: 13 }}>
          <div style={{ fontSize: 40, marginBottom: 8 }}>🗑️</div>
          Aucun signalement pour ce filtre
        </div>
      )}

      {filtres.map(s => (
        <div key={s.id} style={{
          background: "white", borderRadius: 16, marginBottom: 12, overflow: "hidden",
          boxShadow: s.urgent
            ? "0 0 0 2px #fca5a5, 0 4px 16px rgba(239,68,68,0.1)"
            : "0 2px 12px rgba(0,0,0,0.07)",
          transition: "box-shadow 0.2s"
        }}>
          <div style={{ display: "flex" }}>
            {/* Image */}
            <div style={{ width: 100, minHeight: 110, flexShrink: 0, position: "relative", overflow: "hidden", background: "#f1f5f9" }}>
              {s.photo ? (
                <img src={s.photo} alt="poubelle"
                  style={{ width: "100%", height: "100%", objectFit: "cover", position: "absolute", inset: 0 }} />
              ) : (
                <div style={{
                  position: "absolute", inset: 0, display: "flex", flexDirection: "column",
                  alignItems: "center", justifyContent: "center", gap: 4,
                  background: "linear-gradient(135deg, #f0fdf4, #dcfce7)"
                }}>
                  <span style={{ fontSize: 30 }}>🗑️</span>
                  <span style={{ fontSize: 9, color: "#86efac", fontWeight: 600 }}>Pas de photo</span>
                </div>
              )}
              {/* Badge urgent sur l'image */}
              {s.urgent && (
                <div style={{
                  position: "absolute", top: 6, left: 6,
                  background: "#ef4444", color: "white",
                  fontSize: 9, fontWeight: 800, padding: "2px 6px", borderRadius: 6
                }}>URGENT</div>
              )}
            </div>

            {/* Contenu */}
            <div style={{ flex: 1, padding: "12px 14px", display: "flex", flexDirection: "column", gap: 5 }}>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start" }}>
                <div style={{ fontSize: 15, fontWeight: 800, color: "#0f172a" }}>{nomAffiche(s.nom)}</div>
                <div style={{ fontSize: 10, color: "#94a3b8", whiteSpace: "nowrap", marginLeft: 8 }}>🕐 {timeAgo(s.createdAt)}</div>
              </div>

              <div style={{ fontSize: 12, color: "#16a34a", fontWeight: 700 }}>
                📍 {s.commune} <span style={{ color: "#94a3b8", fontWeight: 400 }}>— {s.quartier}</span>
              </div>

              <div style={{ fontSize: 11, color: "#475569" }}>
                🗑️ {s.type}
              </div>

              <div style={{ display: "flex", gap: 6, flexWrap: "wrap", marginTop: 2 }}>
                <span style={{
                  background: "#f0fdf4", color: "#16a34a", border: "1px solid #bbf7d0",
                  fontSize: 10, fontWeight: 700, padding: "2px 8px", borderRadius: 20
                }}>
                  {s.volume}
                </span>
                {s.lat && (
                  <a href={`https://www.google.com/maps?q=${s.lat},${s.lng}`} target="_blank" rel="noreferrer"
                    style={{ textDecoration: "none" }}>
                    <span style={{
                      background: "#eff6ff", color: "#3b82f6", border: "1px solid #bfdbfe",
                      fontSize: 10, fontWeight: 700, padding: "2px 8px", borderRadius: 20
                    }}>🗺️ GPS</span>
                  </a>
                )}
              </div>
            </div>
          </div>
        </div>
      ))}

      {/* CTA collecteur */}
      <div style={{
        marginTop: 8, padding: "20px 16px", borderRadius: 16, textAlign: "center",
        background: "linear-gradient(135deg, #14532d, #166534)",
        boxShadow: "0 4px 20px rgba(20,83,45,0.3)"
      }}>
        <div style={{ fontSize: 24, marginBottom: 6 }}>🚛</div>
        <p style={{ color: "#86efac", fontSize: 13, fontWeight: 600, margin: "0 0 12px" }}>
          Vous êtes collecteur ? Rejoignez la plateforme !
        </p>
        <button onClick={onInscription} style={{
          background: "#a3e635", color: "#14532d", border: "none",
          borderRadius: 10, padding: "10px 24px", fontWeight: 800, fontSize: 13, cursor: "pointer"
        }}>
          Créer un compte collecteur
        </button>
      </div>
    </div>
  );
}

export default function App() {
  const [mode, setMode] = useState("dashboard");
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
          setMode(userData.role === "admin" ? "dashboard" : userData.role === "menage" ? "menage" : "disponibles");
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
    <div style={{
      background: "linear-gradient(135deg, #0f2d0f, #1a4d1a)",
      padding: "0 20px",
      position: "sticky", top: 0, zIndex: 100,
      boxShadow: "0 2px 20px rgba(0,0,0,0.25)"
    }}>
      <div style={{ maxWidth: 440, margin: "0 auto" }}>
        {showInstall && (
          <div style={{
            background: "#a3e635", padding: "10px 16px",
            display: "flex", justifyContent: "space-between", alignItems: "center",
            borderRadius: 10, margin: "10px 0"
          }}>
            <span style={{ fontSize: 13, fontWeight: 700, color: "#14532d" }}>📲 Installer l'app sur votre téléphone</span>
            <button onClick={handleInstall} style={{
              background: "#14532d", color: "#a3e635", border: "none",
              borderRadius: 8, padding: "6px 14px", fontWeight: 800, cursor: "pointer", fontSize: 12
            }}>Installer</button>
          </div>
        )}

        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "14px 0" }}>
          <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
            <div style={{
              width: 36, height: 36, borderRadius: 10,
              background: "linear-gradient(135deg, #a3e635, #4ade80)",
              display: "flex", alignItems: "center", justifyContent: "center",
              fontSize: 18, boxShadow: "0 2px 8px rgba(163,230,53,0.4)"
            }}>🗑️</div>
            <div>
              <div style={{ fontSize: 18, fontWeight: 900, color: "#a3e635", letterSpacing: -0.5 }}>Poubelle-CI</div>
              <div style={{ fontSize: 10, color: "#4ade80", fontWeight: 500 }}>Collecte propre, ville propre</div>
            </div>
          </div>

          {utilisateur ? (
            <div style={{ textAlign: "right" }}>
              <div style={{
                fontSize: 11, fontWeight: 800, color: "#a3e635",
                background: "rgba(163,230,53,0.1)", padding: "4px 10px", borderRadius: 20, marginBottom: 2
              }}>{nomAffiche(utilisateur.nom)}</div>
              <button onClick={deconnexion} style={{
                fontSize: 10, color: "#4ade80", background: "none",
                border: "none", cursor: "pointer", padding: 0
              }}>Déconnexion</button>
            </div>
          ) : (
            <div style={{ fontSize: 10, color: "#4ade80", fontWeight: 600 }}>
              🌍 Abidjan, CI
            </div>
          )}
        </div>

        {ecran === "app" && (
          <div style={{
            display: "flex", background: "rgba(0,0,0,0.25)",
            borderRadius: "14px 14px 0 0", padding: "4px 4px 0", gap: 4
          }}>
            {(utilisateur?.role === "admin" ? [
              { key: "dashboard", label: "📊 Dashboard", desc: "Vue globale" },
              { key: "signalements", label: "📦 Signalements", desc: "Tous" },
              { key: "utilisateurs", label: "👥 Utilisateurs", desc: "Gérer" },
            ] : utilisateur?.role === "menage" ? [
              { key: "menage", label: "🏠 Signaler", desc: "Nouveau" },
              { key: "mescollectes", label: "📋 Historique", desc: "Mes signalements" },
            ] : [
              { key: "disponibles", label: "📦 Disponibles", desc: "À collecter" },
              { key: "mescollectes", label: "🚛 Mes collectes", desc: "Historique" },
            ]).map(tab => (
              <button key={tab.key} onClick={() => setMode(tab.key)} style={{
                flex: 1, padding: "10px 8px 12px", borderRadius: "12px 12px 0 0",
                border: "none", cursor: "pointer", fontFamily: "sans-serif",
                background: mode === tab.key ? "#f0fdf4" : "transparent",
                color: mode === tab.key ? "#14532d" : "rgba(255,255,255,0.6)",
                fontWeight: 800, fontSize: 12, transition: "all 0.2s"
              }}>
                {tab.label}
                <div style={{ fontSize: 9, opacity: 0.7, marginTop: 1 }}>{tab.desc}</div>
              </button>
            ))}
          </div>
        )}
      </div>
    </div>
  );

  if (ecran === "accueil") return (
    <div style={{ minHeight: "100vh", background: "#f8fafc", fontFamily: "sans-serif" }}>
      <Header />

      {/* Hero */}
      <div style={{
        background: "linear-gradient(160deg, #0f2d0f 0%, #166534 60%, #16a34a 100%)",
        padding: "32px 20px 48px", textAlign: "center", position: "relative", overflow: "hidden"
      }}>
        {/* Cercles décoratifs */}
        <div style={{
          position: "absolute", width: 200, height: 200, borderRadius: "50%",
          background: "rgba(163,230,53,0.06)", top: -60, right: -60
        }} />
        <div style={{
          position: "absolute", width: 140, height: 140, borderRadius: "50%",
          background: "rgba(74,222,128,0.08)", bottom: -40, left: -40
        }} />

        <div style={{
          width: 72, height: 72, borderRadius: 20, margin: "0 auto 16px",
          background: "rgba(163,230,53,0.15)", display: "flex",
          alignItems: "center", justifyContent: "center", fontSize: 36,
          border: "2px solid rgba(163,230,53,0.3)"
        }}>🗑️</div>

        <h2 style={{ color: "white", fontSize: 22, fontWeight: 900, margin: "0 0 8px", letterSpacing: -0.5 }}>
          Signaler, c'est agir pour<br />
          <span style={{ color: "#a3e635" }}>votre quartier</span>
        </h2>
        <p style={{ color: "#86efac", fontSize: 13, margin: "0 0 28px", lineHeight: 1.5 }}>
          La plateforme de collecte et ramassage<br />personnel de déchets en Côte d'Ivoire
        </p>

        <div style={{ display: "flex", gap: 10, maxWidth: 340, margin: "0 auto" }}>
          <button onClick={() => setEcran("inscription")} style={{
            flex: 1, padding: "14px 12px",
            background: "linear-gradient(135deg, #a3e635, #65a30d)",
            color: "#14532d", border: "none", borderRadius: 14,
            fontSize: 13, fontWeight: 800, cursor: "pointer",
            boxShadow: "0 4px 16px rgba(163,230,53,0.4)"
          }}>
            📝 Créer un compte
          </button>
          <button onClick={() => setEcran("connexion")} style={{
            flex: 1, padding: "14px 12px",
            background: "rgba(255,255,255,0.12)", backdropFilter: "blur(8px)",
            color: "white", border: "1.5px solid rgba(255,255,255,0.25)",
            borderRadius: 14, fontSize: 13, fontWeight: 700, cursor: "pointer"
          }}>
            🔐 Se connecter
          </button>
        </div>
      </div>

      {/* Signalements */}
      <div style={{ maxWidth: 440, margin: "0 auto", marginTop: -20 }}>
        <div style={{
          background: "#f8fafc", borderRadius: "20px 20px 0 0",
          padding: "20px 0 0", minHeight: 200
        }}>
          <SignalementsPublics onInscription={() => setEcran("inscription")} />
        </div>
      </div>
    </div>
  );

  if (ecran === "inscription") return (
    <div style={{ minHeight: "100vh", background: "#f8fafc", fontFamily: "sans-serif" }}>
      <Header />
      <Inscription onInscrit={(user) => {
        setUtilisateur(user);
        setMode(user.role === "menage" ? "menage" : "disponibles");
        setEcran("app");
      }} />
      <div style={{ textAlign: "center", padding: 16 }}>
        <span style={{ fontSize: 13, color: "#64748b" }}>Déjà un compte ? </span>
        <button onClick={() => setEcran("connexion")} style={{
          fontSize: 13, color: "#16a34a", fontWeight: 700, background: "none", border: "none", cursor: "pointer"
        }}>Se connecter</button>
      </div>
    </div>
  );

  if (ecran === "connexion") return (
    <div style={{ minHeight: "100vh", background: "#f8fafc", fontFamily: "sans-serif" }}>
      <Header />
      <Connexion onConnecte={(user) => {
        setUtilisateur(user);
        setMode(user.role === "menage" ? "menage" : "disponibles");
        setEcran("app");
      }} />
      <div style={{ textAlign: "center", padding: 16 }}>
        <span style={{ fontSize: 13, color: "#64748b" }}>Pas encore de compte ? </span>
        <button onClick={() => setEcran("inscription")} style={{
          fontSize: 13, color: "#16a34a", fontWeight: 700, background: "none", border: "none", cursor: "pointer"
        }}>S'inscrire</button>
      </div>
    </div>
  );

  return (
    <div style={{ minHeight: "100vh", background: "#f8fafc", fontFamily: "sans-serif" }}>
      <Header />
      <div style={{ maxWidth: 440, margin: "0 auto", paddingBottom: 40 }}>
        {utilisateur?.role === "admin" ? (
          <Admin onglet={mode} />
        ) : utilisateur?.role === "menage" ? (
          <Menage utilisateur={utilisateur} mode={mode} />
        ) : (
          <Collecteur utilisateur={utilisateur} mode={mode} />
        )}
      </div>
    </div>
  );
}
