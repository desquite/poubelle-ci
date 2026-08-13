// Marqueurs des signalements citoyens d'insalubrité sur la carte publique.
// Seuls les incidents publics arrivent ici : le filtrage est fait à la source
// par useIncidents, qui ne lit que visibilite == "publique".

import { Marker, Popup } from "react-leaflet";
import { iconIncident } from "./mapIcons";
import { categorie, statut, ancienneteJours, urgence } from "../utils/incidents";
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import { faLocationDot, faUsers, faClock, faCheck } from "@fortawesome/free-solid-svg-icons";

export default function MarqueursIncidents({ incidents, onConfirmer, uid }) {
  return incidents
    .filter((i) => i.lat != null && i.lng != null)
    .map((i) => {
      const cat = categorie(i.type);
      const st = statut(i.statut);
      const jours = ancienneteJours(i);
      const critique = urgence(i) === "critique";
      const dejaConfirme = uid && i.confirmePar?.includes(uid);

      return (
        <Marker key={i.id} position={[i.lat, i.lng]} icon={iconIncident(cat.couleur, critique)}>
          <Popup>
            <div style={{ minWidth: 200, fontFamily: "sans-serif" }}>
              {i.media?.url && (
                i.media.type === "video"
                  ? <video src={i.media.url} controls style={{ width: "100%", height: 110, borderRadius: 10, marginBottom: 8, background: "#000" }} />
                  : <img src={i.media.url} alt="" style={{ width: "100%", height: 110, objectFit: "cover", borderRadius: 10, marginBottom: 8 }} />
              )}

              <div style={{ fontSize: 14, fontWeight: 800, color: "#0f172a", marginBottom: 2 }}>
                {cat.libelle}
              </div>
              <div style={{ fontSize: 11, color: cat.couleur, fontWeight: 700, marginBottom: 6 }}>
                <FontAwesomeIcon icon={faLocationDot} style={{ marginRight: 4 }} />
                {i.commune}{i.quartier ? ` — ${i.quartier}` : ""}
              </div>

              {i.repere && (
                <div style={{ fontSize: 11.5, color: "#475569", marginBottom: 5 }}>{i.repere}</div>
              )}
              {i.details && (
                <div style={{ fontSize: 11, color: "#64748b", marginBottom: 7, lineHeight: 1.45 }}>{i.details}</div>
              )}

              <div style={{ display: "flex", gap: 6, flexWrap: "wrap", marginBottom: 8 }}>
                <span style={{
                  fontSize: 10, fontWeight: 800, padding: "3px 9px", borderRadius: 20,
                  background: st.fond, color: st.couleur, border: `1px solid ${st.bordure}`,
                }}>{st.libelle}</span>

                {i.confirmations > 1 && (
                  <span style={{
                    fontSize: 10, fontWeight: 800, padding: "3px 9px", borderRadius: 20,
                    background: "#f1f5f9", color: "#475569",
                  }}>
                    <FontAwesomeIcon icon={faUsers} style={{ marginRight: 4 }} />
                    {i.confirmations} signalements
                  </span>
                )}

                <span style={{
                  fontSize: 10, fontWeight: 700, padding: "3px 9px", borderRadius: 20,
                  background: critique ? "#fef2f2" : "#f8fafc",
                  color: critique ? "#dc2626" : "#94a3b8",
                }}>
                  <FontAwesomeIcon icon={faClock} style={{ marginRight: 4 }} />
                  {jours === 0 ? "aujourd'hui" : `${jours} j`}
                </span>
              </div>

              {i.statut === "resolu" ? (
                <div style={{ fontSize: 11.5, color: "#16a34a", fontWeight: 700, textAlign: "center", padding: "6px 0" }}>
                  <FontAwesomeIcon icon={faCheck} style={{ marginRight: 5 }} />Problème résolu
                </div>
              ) : onConfirmer && (
                <button onClick={() => onConfirmer(i)} disabled={dejaConfirme} style={{
                  width: "100%", padding: "9px", borderRadius: 10, fontSize: 12, fontWeight: 800,
                  border: dejaConfirme ? "1.5px solid #e2e8f0" : "none",
                  cursor: dejaConfirme ? "default" : "pointer",
                  background: dejaConfirme ? "white" : "linear-gradient(135deg, #16a34a, #15803d)",
                  color: dejaConfirme ? "#94a3b8" : "white",
                }}>
                  {dejaConfirme ? "Déjà confirmé" : "C'est toujours là"}
                </button>
              )}
            </div>
          </Popup>
        </Marker>
      );
    });
}
