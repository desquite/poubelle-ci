// Vue ménage : suivi en temps réel du collecteur sur la carte,
// de la validation jusqu'au ramassage de la poubelle.

import { useState, useEffect, useRef } from "react";
import { MapContainer, TileLayer, Marker, Popup, Polyline, useMap } from "react-leaflet";
import { doc, onSnapshot } from "firebase/firestore";
import { db } from "../firebase/config";
import { distanceKm, formatDistance } from "../utils/geo";
import { iconPoubelle, iconPoubelleUrgente, iconCamion } from "./mapIcons";
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import { faXmark, faTruck, faCircleCheck, faClock, faLocationDot } from "@fortawesome/free-solid-svg-icons";

const nomAffiche = (nom) => nom?.trim().split(/\s+/).pop() || nom || "";

function CadrerCarte({ points }) {
  const map = useMap();
  const fait = useRef(false);
  useEffect(() => {
    if (points.length < 2 || fait.current) return;
    fait.current = true;
    map.fitBounds(points.map(p => [p.lat, p.lng]), { padding: [70, 70] });
  }, [points, map]);
  return null;
}

export default function SuiviCollecte({ signalement, onClose }) {
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
    <div style={{ position: "fixed", inset: 0, zIndex: 2000, background: "#f8fafc", display: "flex", flexDirection: "column", fontFamily: "sans-serif" }}>

      {/* En-tête */}
      <div style={{
        background: "linear-gradient(135deg, #0f2d0f, #1a4d1a)", padding: "14px 16px",
        display: "flex", justifyContent: "space-between", alignItems: "center"
      }}>
        <div>
          <div style={{ fontSize: 15, fontWeight: 900, color: "#a3e635" }}>
            <FontAwesomeIcon icon={faTruck} style={{ marginRight: 8 }} />
            Suivi de votre collecte
          </div>
          <div style={{ fontSize: 11, color: "#4ade80", marginTop: 2 }}>
            Collecteur : {nomAffiche(signalement.collecteurNom)} · {signalement.commune} — {signalement.quartier}
          </div>
        </div>
        <button onClick={onClose} style={{
          background: "rgba(255,255,255,0.12)", border: "1.5px solid rgba(255,255,255,0.2)",
          borderRadius: 10, padding: "8px 13px", color: "white", fontSize: 14, cursor: "pointer"
        }}>
          <FontAwesomeIcon icon={faXmark} />
        </button>
      </div>

      {/* Carte */}
      <div style={{ flex: 1, position: "relative", zIndex: 0 }}>
        <MapContainer center={[poubelle.lat, poubelle.lng]} zoom={15} maxZoom={21} style={{ height: "100%", width: "100%" }}>
          <TileLayer
            url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
            attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>'
            maxZoom={21} maxNativeZoom={19}
          />
          <CadrerCarte points={points} />

          <Marker position={[poubelle.lat, poubelle.lng]} icon={signalement.urgent ? iconPoubelleUrgente : iconPoubelle}>
            <Popup><b>Votre poubelle</b><br />{signalement.type} · {signalement.volume}</Popup>
          </Marker>

          {posCollecteur && (
            <>
              <Marker position={[posCollecteur.lat, posCollecteur.lng]} icon={iconCamion}>
                <Popup><b>{nomAffiche(signalement.collecteurNom)}</b><br />Votre collecteur</Popup>
              </Marker>
              <Polyline
                positions={[[poubelle.lat, poubelle.lng], [posCollecteur.lat, posCollecteur.lng]]}
                pathOptions={{ color: "#16a34a", weight: 3, dashArray: "8 8" }} />
            </>
          )}
        </MapContainer>
      </div>

      {/* Bandeau d'état */}
      <div style={{ padding: "14px 16px", background: "white", boxShadow: "0 -2px 12px rgba(0,0,0,0.08)" }}>
        {collecte ? (
          <div style={{ textAlign: "center" }}>
            <div style={{ fontSize: 14, fontWeight: 800, color: "#16a34a", marginBottom: 10 }}>
              <FontAwesomeIcon icon={faCircleCheck} style={{ marginRight: 6 }} />
              Votre poubelle a été collectée !
            </div>
            <button onClick={onClose} style={{
              width: "100%", padding: "12px", borderRadius: 12, border: "none", cursor: "pointer",
              background: "linear-gradient(135deg, #16a34a, #15803d)", color: "white", fontWeight: 800, fontSize: 13
            }}>
              Fermer
            </button>
          </div>
        ) : posCollecteur ? (
          <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
            <div style={{
              width: 40, height: 40, borderRadius: 12, flexShrink: 0,
              background: "linear-gradient(135deg, #f0fdf4, #dcfce7)", border: "1px solid #bbf7d0",
              display: "flex", alignItems: "center", justifyContent: "center", color: "#16a34a", fontSize: 17
            }}>
              <FontAwesomeIcon icon={faTruck} />
            </div>
            <div>
              <div style={{ fontSize: 14, fontWeight: 800, color: "#0f172a" }}>
                Le collecteur est à {formatDistance(d)}
              </div>
              <div style={{ fontSize: 11, color: "#94a3b8" }}>
                <FontAwesomeIcon icon={faLocationDot} style={{ marginRight: 4 }} />
                Position mise à jour en temps réel
              </div>
            </div>
          </div>
        ) : (
          <div style={{ textAlign: "center", fontSize: 13, color: "#d97706", fontWeight: 600, padding: "4px 0" }}>
            <FontAwesomeIcon icon={faClock} style={{ marginRight: 6 }} />
            En attente de la position du collecteur…
          </div>
        )}
      </div>
    </div>
  );
}
