// Bannière « Nouvelle version disponible » : quand un nouveau service worker
// est prêt, l'utilisateur clique pour recharger immédiatement la dernière version
// (plus besoin de fermer/rouvrir l'app plusieurs fois après un déploiement).

import { useRegisterSW } from "virtual:pwa-register/react";
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import { faArrowsRotate, faXmark } from "@fortawesome/free-solid-svg-icons";

export default function ReloadPrompt() {
  const {
    needRefresh: [needRefresh, setNeedRefresh],
    updateServiceWorker,
  } = useRegisterSW({
    onRegisteredSW(swUrl, r) {
      // Vérifie périodiquement les mises à jour même si l'app reste ouverte
      if (r) setInterval(() => r.update(), 30 * 60 * 1000);
    },
  });

  if (!needRefresh) return null;

  return (
    <div style={{
      position: "fixed", bottom: 16, left: 16, right: 16, zIndex: 3000,
      maxWidth: 440, margin: "0 auto",
      background: "linear-gradient(135deg, #0f2d0f, #166534)",
      borderRadius: 14, padding: "12px 14px",
      display: "flex", alignItems: "center", gap: 12,
      boxShadow: "0 6px 24px rgba(15,45,15,0.4)", fontFamily: "sans-serif"
    }}>
      <div style={{ flex: 1 }}>
        <div style={{ fontSize: 13, fontWeight: 800, color: "#a3e635" }}>
          Nouvelle version disponible
        </div>
        <div style={{ fontSize: 11, color: "#86efac", marginTop: 2 }}>
          Actualisez pour profiter des dernières améliorations.
        </div>
      </div>
      <button onClick={() => updateServiceWorker(true)} style={{
        background: "#a3e635", color: "#14532d", border: "none",
        borderRadius: 10, padding: "9px 16px", fontWeight: 800, fontSize: 13, cursor: "pointer",
        whiteSpace: "nowrap"
      }}>
        <FontAwesomeIcon icon={faArrowsRotate} style={{ marginRight: 6 }} />Actualiser
      </button>
      <button onClick={() => setNeedRefresh(false)} aria-label="Fermer" style={{
        background: "rgba(255,255,255,0.12)", border: "none", color: "white",
        borderRadius: 10, width: 34, height: 34, cursor: "pointer", fontSize: 14, flexShrink: 0
      }}>
        <FontAwesomeIcon icon={faXmark} />
      </button>
    </div>
  );
}
