// Carte de signalement partagée (collecteur, ménage, page publique).
// Design : bandeau urgent en haut, prix mis en avant dans un encadré vert,
// distance sur la photo, statut en point coloré, badges réduits au minimum.

import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import {
  faTrash, faLocationDot, faClock, faTriangleExclamation, faPhone, faComment, faRoute
} from "@fortawesome/free-solid-svg-icons";
import { formatFCFA } from "../utils/format";
import { formatDistance } from "../utils/geo";

const nomAffiche = (nom) => nom?.trim().split(/\s+/).pop() || nom || "";

const timeAgo = (timestamp) => {
  if (!timestamp?.seconds) return "";
  const diff = Math.floor((Date.now() - timestamp.seconds * 1000) / 1000);
  if (diff < 60) return "À l'instant";
  if (diff < 3600) return `${Math.floor(diff / 60)} min`;
  if (diff < 86400) return `${Math.floor(diff / 3600)} h`;
  return `${Math.floor(diff / 86400)} j`;
};

// « Moyen (1-2 sacs) » → « 1-2 sacs »
const volumeCourt = (v) => v?.match(/\((.+)\)/)?.[1] || v || "";

const STATUS = {
  "disponible": { dot: "#16a34a", label: "Disponible" },
  "en cours":   { dot: "#d97706", label: "En cours" },
  "collecté":   { dot: "#94a3b8", label: "Collecté" },
};

export default function CarteSignalement({ s, titre, distance, showPhone, actions }) {
  const st = STATUS[s.status] || STATUS["disponible"];
  const nbCorbeilles = Math.max(0, s.corbeillesCount || 0);

  return (
    <div style={{
      background: "white", borderRadius: 16, marginBottom: 12, overflow: "hidden",
      border: s.urgent ? "1px solid #fecaca" : "1px solid #f1f5f9",
      boxShadow: "0 2px 12px rgba(0,0,0,0.06)"
    }}>
      {s.urgent && (
        <div style={{ background: "#fef2f2", padding: "5px 14px", display: "flex", alignItems: "center", gap: 6 }}>
          <FontAwesomeIcon icon={faTriangleExclamation} style={{ fontSize: 11, color: "#dc2626" }} />
          <span style={{ fontSize: 10, fontWeight: 800, color: "#dc2626", letterSpacing: 0.5 }}>SIGNALEMENT URGENT</span>
        </div>
      )}

      <div style={{ display: "flex" }}>
        {/* Photo */}
        <div style={{ width: 96, minHeight: 116, flexShrink: 0, position: "relative", overflow: "hidden", background: "#f1f5f9" }}>
          {s.photo ? (
            <img src={s.photo} alt="poubelle" style={{ width: "100%", height: "100%", objectFit: "cover", position: "absolute", inset: 0 }} />
          ) : (
            <div style={{ position: "absolute", inset: 0, display: "flex", alignItems: "center", justifyContent: "center", background: "linear-gradient(135deg, #f0fdf4, #dcfce7)" }}>
              <FontAwesomeIcon icon={faTrash} style={{ fontSize: 26, color: "#86efac" }} />
            </div>
          )}
          {distance != null && (
            <div style={{
              position: "absolute", bottom: 6, left: 6, right: 6,
              background: "rgba(15,23,42,0.75)", color: "white",
              fontSize: 10, fontWeight: 700, padding: "3px 0", borderRadius: 8, textAlign: "center"
            }}>
              <FontAwesomeIcon icon={faRoute} style={{ marginRight: 4 }} />à {formatDistance(distance)}
            </div>
          )}
        </div>

        {/* Contenu */}
        <div style={{ flex: 1, padding: "12px 14px", display: "flex", flexDirection: "column", gap: 6 }}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start" }}>
            <div>
              <div style={{ fontSize: 15, fontWeight: 800, color: "#0f172a" }}>{titre || nomAffiche(s.nom)}</div>
              <div style={{ fontSize: 12, color: "#16a34a", fontWeight: 700, marginTop: 2 }}>
                <FontAwesomeIcon icon={faLocationDot} style={{ marginRight: 4 }} />{s.commune} <span style={{ color: "#94a3b8", fontWeight: 400 }}>· {s.quartier}</span>
              </div>
            </div>
            <div style={{ fontSize: 10, color: "#94a3b8", whiteSpace: "nowrap", marginLeft: 6 }}>
              <FontAwesomeIcon icon={faClock} style={{ marginRight: 3 }} />{timeAgo(s.createdAt)}
            </div>
          </div>

          {/* Type · volume · prix */}
          <div style={{
            background: "#f0fdf4", border: "1px solid #bbf7d0", borderRadius: 10,
            padding: "7px 10px", display: "flex", justifyContent: "space-between", alignItems: "center", gap: 8
          }}>
            <span style={{ fontSize: 11, color: "#475569" }}>{s.type}{s.volume ? ` · ${volumeCourt(s.volume)}` : ""}</span>
            {formatFCFA(s.prix) && (
              <span style={{ fontSize: 16, fontWeight: 900, color: "#15803d", whiteSpace: "nowrap" }}>
                {Number(s.prix).toLocaleString("fr-FR")} <span style={{ fontSize: 10 }}>FCFA</span>
              </span>
            )}
          </div>

          {showPhone && s.uid && (
            <div style={{ fontSize: 11, color: "#0f172a", fontWeight: 700 }}>
              <FontAwesomeIcon icon={faPhone} style={{ marginRight: 4 }} />+{s.uid}
            </div>
          )}

          {s.notes && (
            <div style={{ fontSize: 11, color: "#94a3b8", fontStyle: "italic" }}>
              <FontAwesomeIcon icon={faComment} style={{ marginRight: 4 }} />{s.notes}
            </div>
          )}

          <div style={{ fontSize: 10, color: "#94a3b8" }}>
            <span style={{ display: "inline-block", width: 7, height: 7, borderRadius: "50%", background: st.dot, marginRight: 5 }} />
            {st.label}
            {s.status === "disponible" && nbCorbeilles > 0 && ` · ajouté à ${nbCorbeilles} corbeille${nbCorbeilles > 1 ? "s" : ""}`}
          </div>
        </div>
      </div>

      {actions && <div style={{ borderTop: "1px solid #f1f5f9", padding: "10px 14px" }}>{actions}</div>}
    </div>
  );
}
