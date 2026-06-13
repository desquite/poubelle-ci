// Panneau flottant compact de suivi en direct, côté ménage. S'ouvre
// automatiquement dès qu'un collecteur confirme la collecte (voir Menage.jsx) :
// mini-carte animée avec la poubelle et le collecteur qui se rapproche.

import { useState, useEffect, useRef } from "react";
import { MapContainer, TileLayer, Marker, Polyline, useMap } from "react-leaflet";
import { doc, onSnapshot } from "firebase/firestore";
import { db } from "../firebase/config";
import { distanceKm, formatDistance } from "../utils/geo";
import { iconPoubelle, iconPoubelleUrgente, iconCamion } from "./mapIcons";
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import { faXmark, faTruck, faCircleCheck, faClock } from "@fortawesome/free-solid-svg-icons";

const nomAffiche = (nom) => nom?.trim().split(/\s+/).pop() || nom || "";

function Ajuster({ points }) {
  const map = useMap();
  const cadre = useRef(false);

  // La carte est montée dans un conteneur animé : on recalcule sa taille
  // après l'animation d'entrée pour éviter les tuiles grises.
  useEffect(() => {
    const t1 = setTimeout(() => map.invalidateSize(), 150);
    const t2 = setTimeout(() => map.invalidateSize(), 450);
    return () => { clearTimeout(t1); clearTimeout(t2); };
  }, [map]);

  useEffect(() => {
    if (points.length < 2 || cadre.current) return;
    cadre.current = true;
    map.fitBounds(points.map(p => [p.lat, p.lng]), { padding: [35, 35], maxZoom: 16 });
  }, [points, map]);

  return null;
}

export default function SuiviCompact({ signalement, onClose }) {
  const [posCollecteur, setPosCollecteur] = useState(null);

  useEffect(() => {
    if (!signalement?.collecteurId) return;
    const unsub = onSnapshot(doc(db, "positions", signalement.collecteurId), (snap) => {
      if (snap.exists()) setPosCollecteur(snap.data());
    });
    return () => unsub();
  }, [signalement?.collecteurId]);

  const poubelle = { lat: signalement.lat, lng: signalement.lng };
  const d = posCollecteur ? distanceKm(poubelle.lat, poubelle.lng, posCollecteur.lat, posCollecteur.lng) : null;
  const collecte = signalement.status === "collecté";
  const points = posCollecteur ? [poubelle, posCollecteur] : [poubelle];

  return (
    <>
      <style>{`
        @keyframes suiviUp { from { opacity: 0; transform: translateY(40px); } to { opacity: 1; transform: translateY(0); } }
        @keyframes suiviPulse { 0% { box-shadow: 0 0 0 0 rgba(163,230,53,0.6); } 70% { box-shadow: 0 0 0 7px rgba(163,230,53,0); } 100% { box-shadow: 0 0 0 0 rgba(163,230,53,0); } }
      `}</style>

      <div style={{
        position: "fixed", bottom: 12, left: 12, right: 12, zIndex: 2500,
        maxWidth: 420, margin: "0 auto",
        background: "white", borderRadius: 18, overflow: "hidden",
        boxShadow: "0 12px 45px rgba(0,0,0,0.32)", fontFamily: "sans-serif",
        animation: "suiviUp 0.4s cubic-bezier(0.2,0.8,0.2,1)"
      }}>
        {/* En-tête */}
        <div style={{
          background: "linear-gradient(135deg, #0f2d0f, #1a4d1a)", padding: "11px 14px",
          display: "flex", alignItems: "center", justifyContent: "space-between", gap: 10
        }}>
          <div style={{ display: "flex", alignItems: "center", gap: 10, minWidth: 0 }}>
            {!collecte && (
              <span style={{
                width: 9, height: 9, borderRadius: "50%", background: "#a3e635",
                flexShrink: 0, animation: "suiviPulse 1.6s infinite"
              }} />
            )}
            <div style={{ minWidth: 0 }}>
              <div style={{ fontSize: 13, fontWeight: 900, color: "#a3e635", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>
                <FontAwesomeIcon icon={collecte ? faCircleCheck : faTruck} style={{ marginRight: 7 }} />
                {collecte ? "Poubelle collectée !" : "Votre collecteur arrive"}
              </div>
              <div style={{ fontSize: 10.5, color: "#86efac", marginTop: 1, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>
                {nomAffiche(signalement.collecteurNom)} · {signalement.commune} — {signalement.quartier}
              </div>
            </div>
          </div>
          <button onClick={onClose} aria-label="Fermer" style={{
            background: "rgba(255,255,255,0.14)", border: "none", color: "white",
            borderRadius: 10, width: 32, height: 32, cursor: "pointer", fontSize: 14, flexShrink: 0
          }}>
            <FontAwesomeIcon icon={faXmark} />
          </button>
        </div>

        {/* Mini-carte */}
        <div style={{ height: 190, position: "relative", zIndex: 0 }}>
          <MapContainer center={[poubelle.lat, poubelle.lng]} zoom={15} maxZoom={21}
            zoomControl={false} style={{ height: "100%", width: "100%" }}>
            <TileLayer
              url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
              attribution='&copy; OpenStreetMap'
              maxZoom={21} maxNativeZoom={19}
            />
            <Ajuster points={points} />

            <Marker position={[poubelle.lat, poubelle.lng]} icon={signalement.urgent ? iconPoubelleUrgente : iconPoubelle} />
            {posCollecteur && (
              <>
                <Marker position={[posCollecteur.lat, posCollecteur.lng]} icon={iconCamion} />
                <Polyline
                  positions={[[poubelle.lat, poubelle.lng], [posCollecteur.lat, posCollecteur.lng]]}
                  pathOptions={{ color: "#16a34a", weight: 3, dashArray: "8 8" }} />
              </>
            )}
          </MapContainer>
        </div>

        {/* Bandeau d'état */}
        <div style={{ padding: "11px 14px" }}>
          {collecte ? (
            <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 10 }}>
              <span style={{ fontSize: 13, fontWeight: 800, color: "#16a34a" }}>
                <FontAwesomeIcon icon={faCircleCheck} style={{ marginRight: 6 }} />Merci d'utiliser Poubelle-CI !
              </span>
              <button onClick={onClose} style={{
                padding: "8px 16px", borderRadius: 10, border: "none", cursor: "pointer",
                background: "linear-gradient(135deg, #16a34a, #15803d)", color: "white", fontWeight: 800, fontSize: 12
              }}>Fermer</button>
            </div>
          ) : posCollecteur ? (
            <div style={{ display: "flex", alignItems: "center", gap: 11 }}>
              <div style={{
                width: 38, height: 38, borderRadius: 11, flexShrink: 0,
                background: "linear-gradient(135deg, #f0fdf4, #dcfce7)", border: "1px solid #bbf7d0",
                display: "flex", alignItems: "center", justifyContent: "center", color: "#16a34a", fontSize: 16
              }}>
                <FontAwesomeIcon icon={faTruck} />
              </div>
              <div>
                <div style={{ fontSize: 14, fontWeight: 800, color: "#0f172a" }}>
                  Le collecteur est à {formatDistance(d)}
                </div>
                <div style={{ fontSize: 10.5, color: "#94a3b8" }}>Position mise à jour en direct</div>
              </div>
            </div>
          ) : (
            <div style={{ fontSize: 12.5, color: "#d97706", fontWeight: 600, textAlign: "center", padding: "3px 0" }}>
              <FontAwesomeIcon icon={faClock} style={{ marginRight: 6 }} />En attente de la position du collecteur…
            </div>
          )}
        </div>
      </div>
    </>
  );
}
