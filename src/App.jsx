import { useState, useEffect } from "react";
import { getAuth, onAuthStateChanged } from "firebase/auth";
import { doc, getDoc, query, where, collection, onSnapshot } from "firebase/firestore";
import { db } from "./firebase/config";
import Menage from "./pages/Menage";
import Collecteur from "./pages/Collecteur";
import Inscription from "./pages/Inscription";
import Connexion from "./pages/Connexion";
import Admin from "./pages/Admin";
import CartePublique from "./components/CartePublique";
import CarteSignalement from "./components/CarteSignalement";
import Logo from "./components/Logo";
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import {
  faTrash, faClock, faMap, faTriangleExclamation, faXmark,
  faTruck, faHouse, faBox, faChartBar, faUsers, faClipboardList,
  faLock, faUserPlus, faMobileScreen, faGlobe, faArrowLeft,
  faBasketShopping, faArrowUpFromBracket
} from "@fortawesome/free-solid-svg-icons";

const nomAffiche = (nom) => nom?.trim().split(/\s+/).pop() || nom || "";

const auth = getAuth();

function SignalementsPublics({ onInscription }) {
  const [signalements, setSignalements] = useState([]);
  const [filtreCommune, setFiltreCommune] = useState("");
  const [filtreUrgent, setFiltreUrgent] = useState(false);
  const [vue, setVue] = useState("liste");

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

  const nbParCommune = {};
  signalements.forEach(s => { if (s.commune) nbParCommune[s.commune] = (nbParCommune[s.commune] || 0) + 1; });

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

      {/* Toggle Liste / Carte */}
      <div style={{ display: "flex", gap: 4, marginBottom: 12, background: "#e2e8f0", borderRadius: 12, padding: 4 }}>
        {[
          { key: "liste", icon: faClipboardList, label: "Liste" },
          { key: "carte", icon: faMap, label: "Carte" },
        ].map(v => (
          <button key={v.key} onClick={() => setVue(v.key)} style={{
            flex: 1, padding: "9px", borderRadius: 9, border: "none", cursor: "pointer",
            fontWeight: 800, fontSize: 12,
            background: vue === v.key ? "white" : "transparent",
            color: vue === v.key ? "#14532d" : "#64748b",
            boxShadow: vue === v.key ? "0 1px 4px rgba(0,0,0,0.12)" : "none",
            transition: "all 0.15s"
          }}>
            <FontAwesomeIcon icon={v.icon} style={{ marginRight: 6 }} />{v.label}
          </button>
        ))}
      </div>

      {/* Filtres */}
      <div style={{ display: "flex", gap: 8, marginBottom: 16, flexWrap: "wrap" }}>
        <select value={filtreCommune} onChange={e => setFiltreCommune(e.target.value)} style={{
          flex: 1, minWidth: 140, padding: "9px 12px", borderRadius: 12,
          border: "1.5px solid #e2e8f0", fontSize: 12, color: "#0f172a",
          background: "white", outline: "none", fontWeight: 600,
          boxShadow: "0 1px 3px rgba(0,0,0,0.06)"
        }}>
          <option value="">Toutes les communes ({signalements.length})</option>
          {communesDisponibles.map(c => <option key={c} value={c}>{c} ({nbParCommune[c]})</option>)}
        </select>

        <button onClick={() => setFiltreUrgent(!filtreUrgent)} style={{
          padding: "9px 14px", borderRadius: 12, cursor: "pointer", fontWeight: 700, fontSize: 12,
          border: filtreUrgent ? "1.5px solid #ef4444" : "1.5px solid #e2e8f0",
          background: filtreUrgent ? "#fef2f2" : "white",
          color: filtreUrgent ? "#ef4444" : "#64748b",
          boxShadow: "0 1px 3px rgba(0,0,0,0.06)"
        }}>
          <FontAwesomeIcon icon={faTriangleExclamation} style={{ marginRight: 5 }} />Urgent
        </button>

        {(filtreCommune || filtreUrgent) && (
          <button onClick={() => { setFiltreCommune(""); setFiltreUrgent(false); }} style={{
            padding: "9px 12px", borderRadius: 12, border: "1.5px solid #e2e8f0",
            background: "white", color: "#64748b", fontSize: 12, fontWeight: 600, cursor: "pointer"
          }}><FontAwesomeIcon icon={faXmark} /></button>
        )}
      </div>

      {/* Vue carte (positions approximatives) */}
      {vue === "carte" && (
        <CartePublique signalements={filtres} commune={filtreCommune} onInscription={onInscription} />
      )}

      {/* Vue liste */}
      {vue === "liste" && filtres.length === 0 && (
        <div style={{ textAlign: "center", padding: "40px 20px", color: "#94a3b8", fontSize: 13 }}>
          <div style={{ fontSize: 40, marginBottom: 8 }}><FontAwesomeIcon icon={faTrash} /></div>
          Aucun signalement pour ce filtre
        </div>
      )}

      {vue === "liste" && filtres.map(s => (
        <CarteSignalement key={s.id} s={s} />
      ))}

      {/* CTA collecteur */}
      <div style={{
        marginTop: 8, padding: "20px 16px", borderRadius: 16, textAlign: "center",
        background: "linear-gradient(135deg, #14532d, #166534)",
        boxShadow: "0 4px 20px rgba(20,83,45,0.3)"
      }}>
        <div style={{ fontSize: 24, marginBottom: 6, color: "#86efac" }}><FontAwesomeIcon icon={faTruck} /></div>
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
  const [authChecked, setAuthChecked] = useState(false);
  const [installPrompt, setInstallPrompt] = useState(null);
  const [showInstall, setShowInstall] = useState(false);
  const [showIosInstall, setShowIosInstall] = useState(false);

  useEffect(() => {
    window.addEventListener("beforeinstallprompt", (e) => {
      e.preventDefault();
      setInstallPrompt(e);
      setShowInstall(true);
    });

    // iOS ne déclenche pas beforeinstallprompt : on guide l'utilisateur Safari
    // (la seule voie d'installation sur iPhone) tant que l'app n'est pas installée.
    const isIos = /iphone|ipad|ipod/i.test(navigator.userAgent);
    const isSafari = /safari/i.test(navigator.userAgent) && !/crios|fxios|edgios/i.test(navigator.userAgent);
    const dejaInstallee = window.matchMedia("(display-mode: standalone)").matches || window.navigator.standalone;
    if (isIos && isSafari && !dejaInstallee && !localStorage.getItem("iosInstallFerme")) {
      setShowIosInstall(true);
    }

    const unsub = onAuthStateChanged(auth, async (user) => {
      try {
        if (user) {
          const snap = await getDoc(doc(db, "utilisateurs", user.uid));
          if (snap.exists()) {
            const userData = { uid: user.uid, ...snap.data() };
            setUtilisateur(userData);
            setMode(userData.role === "admin" ? "dashboard" : userData.role === "menage" ? "menage" : "carte");
            setEcran("app");
          }
        }
      } finally {
        setAuthChecked(true);
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
            <span style={{ fontSize: 13, fontWeight: 700, color: "#14532d" }}><FontAwesomeIcon icon={faMobileScreen} style={{ marginRight: 6 }} />Installer l'app sur votre téléphone</span>
            <button onClick={handleInstall} style={{
              background: "#14532d", color: "#a3e635", border: "none",
              borderRadius: 8, padding: "6px 14px", fontWeight: 800, cursor: "pointer", fontSize: 12
            }}>Installer</button>
          </div>
        )}

        {showIosInstall && (
          <div style={{
            background: "#a3e635", padding: "10px 14px",
            display: "flex", alignItems: "center", gap: 10,
            borderRadius: 10, margin: "10px 0"
          }}>
            <span style={{ fontSize: 12, fontWeight: 700, color: "#14532d", flex: 1, lineHeight: 1.4 }}>
              <FontAwesomeIcon icon={faMobileScreen} style={{ marginRight: 6 }} />
              Pour installer : appuyez sur <FontAwesomeIcon icon={faArrowUpFromBracket} style={{ margin: "0 3px" }} />
              Partager, puis « Sur l'écran d'accueil »
            </span>
            <button onClick={() => { setShowIosInstall(false); localStorage.setItem("iosInstallFerme", "1"); }}
              aria-label="Fermer" style={{
                background: "#14532d", color: "#a3e635", border: "none",
                borderRadius: 8, width: 28, height: 28, fontWeight: 800, cursor: "pointer", fontSize: 12, flexShrink: 0
              }}><FontAwesomeIcon icon={faXmark} /></button>
          </div>
        )}

        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "14px 0" }}>
          <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
            <Logo size={40} withBadge={false} />
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
          ) : (ecran === "inscription" || ecran === "connexion") ? (
            <button onClick={() => setEcran("accueil")} style={{
              display: "flex", alignItems: "center", gap: 6,
              background: "rgba(255,255,255,0.12)", border: "1.5px solid rgba(255,255,255,0.2)",
              borderRadius: 10, padding: "8px 14px", color: "white",
              fontSize: 13, fontWeight: 700, cursor: "pointer"
            }}>
              <FontAwesomeIcon icon={faArrowLeft} />
            </button>
          ) : (
            <div style={{ fontSize: 10, color: "#4ade80", fontWeight: 600 }}>
              <FontAwesomeIcon icon={faGlobe} style={{ marginRight: 4 }} />Abidjan, CI
            </div>
          )}
        </div>

        {ecran === "app" && (
          <div style={{
            display: "flex", background: "rgba(0,0,0,0.25)",
            borderRadius: "14px 14px 0 0", padding: "4px 4px 0", gap: 4
          }}>
            {(utilisateur?.role === "admin" ? [
              { key: "dashboard", icon: faChartBar, label: "Dashboard", desc: "Vue globale" },
              { key: "signalements", icon: faBox, label: "Signalements", desc: "Tous" },
              { key: "utilisateurs", icon: faUsers, label: "Utilisateurs", desc: "Gérer" },
            ] : utilisateur?.role === "menage" ? [
              { key: "menage", icon: faHouse, label: "Signaler", desc: "Nouveau" },
              { key: "mescollectes", icon: faClipboardList, label: "Historique", desc: "Mes signalements" },
            ] : [
              { key: "carte", icon: faMap, label: "Carte", desc: "Autour de moi" },
              { key: "corbeille", icon: faBasketShopping, label: "Corbeille", desc: "Brouillons" },
              { key: "mescollectes", icon: faTruck, label: "Collectes", desc: "Historique" },
            ]).map(tab => (
              <button key={tab.key} onClick={() => setMode(tab.key)} style={{
                flex: 1, padding: "10px 8px 12px", borderRadius: "12px 12px 0 0",
                border: "none", cursor: "pointer", fontFamily: "sans-serif",
                background: mode === tab.key ? "#f0fdf4" : "transparent",
                color: mode === tab.key ? "#14532d" : "rgba(255,255,255,0.6)",
                fontWeight: 800, fontSize: 12, transition: "all 0.2s"
              }}>
                <FontAwesomeIcon icon={tab.icon} style={{ marginRight: 5 }} />{tab.label}
                <div style={{ fontSize: 9, opacity: 0.7, marginTop: 1 }}>{tab.desc}</div>
              </button>
            ))}
          </div>
        )}
      </div>
    </div>
  );

  // Écran de chargement tant que Firebase n'a pas confirmé la session,
  // pour éviter le « flash » de la page déconnectée au rafraîchissement.
  if (!authChecked) return (
    <div style={{
      minHeight: "100vh", background: "linear-gradient(160deg, #0f2d0f 0%, #166534 100%)",
      display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center",
      gap: 16, fontFamily: "sans-serif"
    }}>
      <Logo size={80} withBadge={false} />
      <div style={{ fontSize: 20, fontWeight: 900, color: "#a3e635", letterSpacing: -0.5 }}>Poubelle-CI</div>
      <div style={{ fontSize: 13, color: "#86efac" }}>
        <FontAwesomeIcon icon={faClock} style={{ marginRight: 6 }} />Chargement…
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

        <div style={{ marginBottom: 16 }}><Logo size={84} withBadge={false} /></div>

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
            <FontAwesomeIcon icon={faUserPlus} style={{ marginRight: 6 }} />Créer un compte
          </button>
          <button onClick={() => setEcran("connexion")} style={{
            flex: 1, padding: "14px 12px",
            background: "rgba(255,255,255,0.12)", backdropFilter: "blur(8px)",
            color: "white", border: "1.5px solid rgba(255,255,255,0.25)",
            borderRadius: 14, fontSize: 13, fontWeight: 700, cursor: "pointer"
          }}>
            <FontAwesomeIcon icon={faLock} style={{ marginRight: 6 }} />Se connecter
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
        setMode(user.role === "menage" ? "menage" : "carte");
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
        setMode(user.role === "menage" ? "menage" : "carte");
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
          <Collecteur utilisateur={utilisateur} mode={mode} onChangeMode={setMode} />
        )}
      </div>
    </div>
  );
}
