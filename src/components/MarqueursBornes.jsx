// Marqueurs des bornes connectées, partagés par la carte publique et la carte
// du collecteur. L'anneau du marqueur montre le remplissage, sa couleur l'état.

import { Marker, Popup } from "react-leaflet";
import { iconBorne } from "./mapIcons";
import { styleBorne, etatBorne, placeRestanteKg } from "../utils/bornes";
import { distanceKm, formatDistance } from "../utils/geo";
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import { faLocationDot, faTruck, faClock, faDiamondTurnRight, faTriangleExclamation } from "@fortawesome/free-solid-svg-icons";

const depuis = (ts) => {
  if (!ts?.seconds) return null;
  const diff = Math.floor((Date.now() - ts.seconds * 1000) / 1000);
  if (diff < 3600) return `il y a ${Math.max(1, Math.floor(diff / 60))} min`;
  if (diff < 86400) return `il y a ${Math.floor(diff / 3600)} h`;
  return `il y a ${Math.floor(diff / 86400)} j`;
};

export default function MarqueursBornes({ bornes, maPosition }) {
  return bornes
    .filter((b) => b.lat != null && b.lng != null)
    .map((b) => {
      const st = styleBorne(b);
      const etat = etatBorne(b);
      const pct = b.remplissagePct ?? 0;
      const d = maPosition ? distanceKm(maPosition.lat, maPosition.lng, b.lat, b.lng) : null;

      return (
        <Marker key={b.id} position={[b.lat, b.lng]} icon={iconBorne(pct, st.couleur)}>
          <Popup>
            <div style={{ minWidth: 205, fontFamily: "sans-serif" }}>
              <div style={{ fontSize: 14, fontWeight: 800, color: "#0f172a", marginBottom: 2 }}>
                {b.nom}
              </div>
              <div style={{ fontSize: 11, color: "#16a34a", fontWeight: 700, marginBottom: 8 }}>
                <FontAwesomeIcon icon={faLocationDot} style={{ marginRight: 4 }} />
                {b.commune}{b.quartier ? ` — ${b.quartier}` : ""}
                {d !== null && <span style={{ color: "#94a3b8", fontWeight: 600 }}> · à {formatDistance(d)}</span>}
              </div>

              {/* Jauge de remplissage */}
              <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 6 }}>
                <div style={{ flex: 1, height: 8, borderRadius: 8, background: "#e2e8f0", overflow: "hidden" }}>
                  <div style={{ height: "100%", width: `${Math.min(100, pct)}%`, background: st.couleur, borderRadius: 8 }} />
                </div>
                <span style={{ fontSize: 13, fontWeight: 900, color: st.couleur }}>{Math.round(pct)} %</span>
              </div>

              <div style={{
                display: "inline-block", fontSize: 10, fontWeight: 800, padding: "3px 9px",
                borderRadius: 20, background: st.fond, color: st.couleur, border: `1px solid ${st.bordure}`,
                marginBottom: 8
              }}>
                {etat === "pleine" && <FontAwesomeIcon icon={faTriangleExclamation} style={{ marginRight: 4 }} />}
                {st.libelle}
              </div>

              {etat === "pleine" ? (
                <div style={{ fontSize: 11, color: "#dc2626", fontWeight: 600, marginBottom: 8, lineHeight: 1.45 }}>
                  Les dépôts sont refusés jusqu'au passage du camion.
                </div>
              ) : etat !== "hors_service" && (
                <div style={{ fontSize: 11, color: "#475569", marginBottom: 8 }}>
                  Peut encore recevoir environ <strong>{placeRestanteKg(b)} kg</strong>
                </div>
              )}

              {b.dernierVidageAt && (
                <div style={{ fontSize: 10.5, color: "#94a3b8", marginBottom: 8 }}>
                  <FontAwesomeIcon icon={faTruck} style={{ marginRight: 4 }} />
                  Vidée {depuis(b.dernierVidageAt)}
                </div>
              )}
              {!b.dernierVidageAt && b.vueAt && (
                <div style={{ fontSize: 10.5, color: "#94a3b8", marginBottom: 8 }}>
                  <FontAwesomeIcon icon={faClock} style={{ marginRight: 4 }} />
                  Mesure {depuis(b.vueAt)}
                </div>
              )}

              <a
                href={`https://www.google.com/maps/dir/?api=1&destination=${b.lat},${b.lng}`}
                target="_blank" rel="noreferrer"
                style={{
                  display: "block", textAlign: "center", textDecoration: "none",
                  padding: "9px", borderRadius: 10, fontWeight: 800, fontSize: 12,
                  background: "linear-gradient(135deg, #0f2d0f, #166534)", color: "#a3e635"
                }}>
                <FontAwesomeIcon icon={faDiamondTurnRight} style={{ marginRight: 6 }} />Y aller
              </a>
            </div>
          </Popup>
        </Marker>
      );
    });
}
