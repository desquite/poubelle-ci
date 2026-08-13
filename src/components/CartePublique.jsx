// Carte publique (visiteurs non connectés) : positions approximatives et popups
// réduits — pas de nom, pas de photo, pas de coordonnées exactes, pour protéger
// la vie privée des ménages. Le GPS précis est réservé aux collecteurs connectés.

import { useEffect, useRef } from "react";
import { MapContainer, Marker, Popup, useMap } from "react-leaflet";
import { ABIDJAN_CENTER, COMMUNES_COORDS } from "../quartiers";
import { iconPoubelle, iconPoubelleUrgente } from "./mapIcons";
import { FondCarte, BoutonFond } from "./FondCarte";
import { useFondCarte, ZOOM_MAX } from "../utils/fondCarte";
import MarqueursBornes from "./MarqueursBornes";
import { useBornes } from "../utils/bornes";
import MarqueursIncidents from "./MarqueursIncidents";
import { useIncidents } from "../utils/incidents";
import { formatFCFA } from "../utils/format";
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import { faLocationDot, faClock, faUserPlus, faTrash, faCoins } from "@fortawesome/free-solid-svg-icons";

const timeAgo = (timestamp) => {
  if (!timestamp?.seconds) return "";
  const diff = Math.floor((Date.now() - timestamp.seconds * 1000) / 1000);
  if (diff < 60) return "À l'instant";
  if (diff < 3600) return `${Math.floor(diff / 60)} min`;
  if (diff < 86400) return `${Math.floor(diff / 3600)} h`;
  return `${Math.floor(diff / 86400)} j`;
};

const hashId = (str) => {
  let h = 0;
  for (let i = 0; i < str.length; i++) h = (h * 31 + str.charCodeAt(i)) | 0;
  return h;
};

// Décale chaque position de 60 à 140 m, de façon stable (même décalage à chaque
// affichage pour un même signalement), pour ne pas révéler le domicile exact.
const positionApproximative = (s) => {
  const h = hashId(s.id);
  const angle = ((h % 360) * Math.PI) / 180;
  const dist = 60 + (Math.abs(h >> 8) % 80);
  return {
    aLat: s.lat + (dist / 111320) * Math.sin(angle),
    aLng: s.lng + (dist / (111320 * Math.cos((s.lat * Math.PI) / 180))) * Math.cos(angle),
  };
};

function Cadrer({ commune, points }) {
  const map = useMap();
  const initFait = useRef(false);
  const prevCommune = useRef("");
  const pointsRef = useRef(points);
  useEffect(() => { pointsRef.current = points; }, [points]);

  // Cadrage initial sur l'ensemble des signalements (une seule fois)
  useEffect(() => {
    if (initFait.current || commune || !points.length) return;
    initFait.current = true;
    if (points.length === 1) {
      map.setView([points[0].aLat, points[0].aLng], 14);
    } else {
      map.fitBounds(points.map(p => [p.aLat, p.aLng]), { padding: [50, 50], maxZoom: 15 });
    }
  }, [points, commune, map]);

  // Vol animé quand le filtre commune change (même effet que la carte du
  // collecteur) : cadre les signalements de la commune, ou son centre s'il
  // n'y en a aucun ; retour à la vue d'ensemble quand le filtre est retiré.
  useEffect(() => {
    const pts = pointsRef.current;
    const volerVersPoints = () => {
      if (pts.length > 1) {
        map.flyToBounds(pts.map(p => [p.aLat, p.aLng]), { padding: [50, 50], maxZoom: 15 });
      } else if (pts.length === 1) {
        map.flyTo([pts[0].aLat, pts[0].aLng], 14);
      }
    };

    if (commune && COMMUNES_COORDS[commune]) {
      initFait.current = true;
      if (pts.length) {
        volerVersPoints();
      } else {
        map.flyTo([COMMUNES_COORDS[commune].lat, COMMUNES_COORDS[commune].lng], 12.5);
      }
    } else if (prevCommune.current && !commune) {
      if (pts.length) {
        volerVersPoints();
      } else {
        map.flyTo([ABIDJAN_CENTER.lat, ABIDJAN_CENTER.lng], 11);
      }
    }
    prevCommune.current = commune;
  }, [commune, map]);

  return null;
}

export default function CartePublique({ signalements, commune, onInscription }) {
  const [fond, setFond] = useFondCarte();
  const { bornes } = useBornes();
  const { incidents } = useIncidents();

  const bornesVisibles = commune ? bornes.filter((b) => b.commune === commune) : bornes;
  const incidentsVisibles = commune ? incidents.filter((i) => i.commune === commune) : incidents;

  const points = signalements
    .filter(s => s.lat && s.lng)
    .map(s => ({ ...s, ...positionApproximative(s) }));

  return (
    <div style={{ marginBottom: 12 }}>
      <div style={{ position: "relative", zIndex: 0, borderRadius: 16, overflow: "hidden", boxShadow: "0 2px 12px rgba(0,0,0,0.1)" }}>
        <MapContainer center={[ABIDJAN_CENTER.lat, ABIDJAN_CENTER.lng]} zoom={11} maxZoom={ZOOM_MAX}
          style={{ height: 420, width: "100%" }}>
          <FondCarte vue={fond} />
          <Cadrer commune={commune} points={points} />

          <MarqueursBornes bornes={bornesVisibles} />
          <MarqueursIncidents incidents={incidentsVisibles} />

          {points.map(s => (
            <Marker key={s.id} position={[s.aLat, s.aLng]} icon={s.urgent ? iconPoubelleUrgente : iconPoubelle}>
              <Popup>
                <div style={{ minWidth: 170, fontFamily: "sans-serif" }}>
                  <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 4 }}>
                    <span style={{ fontSize: 13, fontWeight: 800, color: "#16a34a" }}>
                      <FontAwesomeIcon icon={faLocationDot} style={{ marginRight: 4 }} />{s.commune}
                    </span>
                    {s.urgent && (
                      <span style={{ background: "#ef4444", color: "white", fontSize: 9, fontWeight: 800, padding: "2px 6px", borderRadius: 6 }}>URGENT</span>
                    )}
                  </div>
                  <div style={{ fontSize: 11, color: "#475569", marginBottom: 2 }}>{s.quartier}</div>
                  <div style={{ fontSize: 11, color: "#475569", marginBottom: 2 }}>
                    <FontAwesomeIcon icon={faTrash} style={{ marginRight: 4 }} />{s.type} · {s.volume}
                  </div>
                  {formatFCFA(s.prix) && (
                    <div style={{ fontSize: 14, fontWeight: 900, color: "#16a34a", marginBottom: 2 }}>
                      <FontAwesomeIcon icon={faCoins} style={{ marginRight: 5 }} />{formatFCFA(s.prix)}
                    </div>
                  )}
                  <div style={{ fontSize: 10, color: "#94a3b8", marginBottom: 8 }}>
                    <FontAwesomeIcon icon={faClock} style={{ marginRight: 4 }} />{timeAgo(s.createdAt)} · Position approximative
                  </div>
                  <button onClick={onInscription} style={{
                    width: "100%", padding: "9px", borderRadius: 10, cursor: "pointer",
                    fontWeight: 800, fontSize: 12, border: "none",
                    background: "linear-gradient(135deg, #16a34a, #15803d)", color: "white"
                  }}>
                    <FontAwesomeIcon icon={faUserPlus} style={{ marginRight: 5 }} />Devenir collecteur
                  </button>
                </div>
              </Popup>
            </Marker>
          ))}
        </MapContainer>

        <BoutonFond vue={fond} onChange={setFond} />
      </div>

      {bornesVisibles.length > 0 && (
        <div style={{
          display: "flex", justifyContent: "center", flexWrap: "wrap", gap: 14,
          marginTop: 10, fontSize: 10.5, color: "#475569", fontWeight: 600
        }}>
          <span style={{ color: "#94a3b8" }}>Bornes :</span>
          {[
            { c: "#16a34a", l: "disponible" },
            { c: "#d97706", l: "bientôt pleine" },
            { c: "#dc2626", l: "pleine" },
          ].map(x => (
            <span key={x.l} style={{ display: "inline-flex", alignItems: "center", gap: 5 }}>
              <span style={{
                width: 11, height: 11, borderRadius: "50%",
                border: `3px solid ${x.c}`, background: "white", display: "inline-block"
              }} />
              {x.l}
            </span>
          ))}
        </div>
      )}

      <div style={{ fontSize: 10, color: "#94a3b8", textAlign: "center", marginTop: 8 }}>
        Les positions des demandes de collecte sont approximatives. Créez un compte collecteur pour voir les positions exactes.
      </div>
    </div>
  );
}
