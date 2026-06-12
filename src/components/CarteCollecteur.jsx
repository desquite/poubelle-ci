// Vue carte du collecteur : sa position, un rayon réglable, les signalements autour,
// et l'ajout en corbeille (brouillon) depuis les popups.

import { useState, useEffect } from "react";
import { MapContainer, TileLayer, Marker, Popup, Circle, useMap } from "react-leaflet";
import { doc, setDoc, serverTimestamp } from "firebase/firestore";
import { db } from "../firebase/config";
import { COMMUNES, COMMUNES_COORDS, ABIDJAN_CENTER } from "../quartiers";
import { distanceKm, formatDistance } from "../utils/geo";
import { formatFCFA } from "../utils/format";
import { iconPoubelle, iconPoubelleUrgente, iconPoubelleCorbeille, iconCamion } from "./mapIcons";
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import {
  faLocationDot, faPlus, faXmark, faBasketShopping, faLocationCrosshairs, faTrash, faClock, faCoins
} from "@fortawesome/free-solid-svg-icons";

const timeAgo = (timestamp) => {
  if (!timestamp?.seconds) return "";
  const diff = Math.floor((Date.now() - timestamp.seconds * 1000) / 1000);
  if (diff < 60) return "À l'instant";
  if (diff < 3600) return `${Math.floor(diff / 60)} min`;
  if (diff < 86400) return `${Math.floor(diff / 3600)} h`;
  return `${Math.floor(diff / 86400)} j`;
};

function Recentrer({ centre }) {
  const map = useMap();
  useEffect(() => {
    map.flyTo([centre.lat, centre.lng], map.getZoom());
  }, [centre.lat, centre.lng, map]);
  return null;
}

// Écarte en cercle les signalements situés au même endroit (~10 m),
// sinon les marqueurs s'empilent et seul celui du dessus est cliquable.
// lat/lng restent les vraies coordonnées ; posLat/posLng servent à l'affichage.
const eclaterPositions = (signalements) => {
  const groupes = {};
  signalements.forEach(s => {
    const cle = `${s.lat.toFixed(4)}_${s.lng.toFixed(4)}`;
    (groupes[cle] = groupes[cle] || []).push(s);
  });
  const resultat = [];
  Object.values(groupes).forEach(groupe => {
    if (groupe.length === 1) {
      const s = groupe[0];
      resultat.push({ ...s, posLat: s.lat, posLng: s.lng });
      return;
    }
    const rayon = 0.00018; // ≈ 20 m
    groupe.forEach((s, i) => {
      const angle = (2 * Math.PI * i) / groupe.length;
      resultat.push({
        ...s,
        posLat: s.lat + rayon * Math.sin(angle),
        posLng: s.lng + (rayon * Math.cos(angle)) / Math.cos((s.lat * Math.PI) / 180),
      });
    });
  });
  return resultat;
};

export default function CarteCollecteur({ signalements, corbeilleIds, onAjouter, onRetirer, nbCorbeille, onVoirCorbeille, utilisateur }) {
  const [maPosition, setMaPosition] = useState(null);
  const [gpsErreur, setGpsErreur] = useState(() => !("geolocation" in navigator));
  const [commune, setCommune] = useState("");
  const [rayon, setRayon] = useState(() => {
    const v = parseFloat(localStorage.getItem("rayonKm"));
    return v >= 0.5 && v <= 10 ? v : 1;
  });

  const localiser = () => {
    if (!navigator.geolocation) return;
    navigator.geolocation.getCurrentPosition(
      (pos) => { setMaPosition({ lat: pos.coords.latitude, lng: pos.coords.longitude }); setGpsErreur(false); },
      () => setGpsErreur(true),
      { enableHighAccuracy: true, timeout: 10000 }
    );
  };

  useEffect(() => { localiser(); }, []);
  useEffect(() => { localStorage.setItem("rayonKm", rayon); }, [rayon]);

  // Mémorise la dernière position GPS + rayon du collecteur dans son profil,
  // pour que le serveur puisse le notifier des signalements proches (WhatsApp).
  useEffect(() => {
    if (!utilisateur?.uid || !maPosition) return;
    const t = setTimeout(() => {
      setDoc(doc(db, "utilisateurs", utilisateur.uid), {
        lastLat: maPosition.lat, lastLng: maPosition.lng,
        rayonKm: rayon, lastPositionAt: serverTimestamp(),
      }, { merge: true }).catch(() => {});
    }, 1500);
    return () => clearTimeout(t);
  }, [utilisateur?.uid, maPosition, rayon]);

  const centre = commune ? COMMUNES_COORDS[commune] : (maPosition || ABIDJAN_CENTER);
  const avecGps = eclaterPositions(signalements.filter(s => s.lat && s.lng));
  const nbDansRayon = avecGps.filter(s => distanceKm(centre.lat, centre.lng, s.lat, s.lng) <= rayon).length;

  const nbParCommune = {};
  signalements.forEach(s => { if (s.commune) nbParCommune[s.commune] = (nbParCommune[s.commune] || 0) + 1; });

  return (
    <div>
      {/* Contrôles : commune + rayon */}
      <div style={{
        background: "white", borderRadius: 16, padding: "12px 14px", marginBottom: 12,
        boxShadow: "0 2px 12px rgba(0,0,0,0.07)"
      }}>
        <div style={{ display: "flex", gap: 8, marginBottom: 10 }}>
          <select value={commune} onChange={e => setCommune(e.target.value)} style={{
            flex: 1, padding: "9px 12px", borderRadius: 12, border: "1.5px solid #e2e8f0",
            fontSize: 12, color: "#0f172a", background: "white", outline: "none", fontWeight: 600
          }}>
            <option value="">Autour de ma position</option>
            {COMMUNES.map(c => <option key={c} value={c}>{c}{nbParCommune[c] ? ` (${nbParCommune[c]})` : ""}</option>)}
          </select>
          <button onClick={() => { setCommune(""); localiser(); }} title="Me localiser" style={{
            padding: "9px 13px", borderRadius: 12, border: "1.5px solid #bbf7d0",
            background: "#f0fdf4", color: "#16a34a", cursor: "pointer", fontSize: 14
          }}>
            <FontAwesomeIcon icon={faLocationCrosshairs} />
          </button>
        </div>

        <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
          <span style={{ fontSize: 11, fontWeight: 700, color: "#16a34a", whiteSpace: "nowrap" }}>
            Rayon : {rayon} km
          </span>
          <input type="range" min="0.5" max="10" step="0.5" value={rayon}
            onChange={e => setRayon(parseFloat(e.target.value))}
            style={{ flex: 1, accentColor: "#16a34a" }} />
          <span style={{
            fontSize: 11, fontWeight: 800, color: "#16a34a", background: "#f0fdf4",
            border: "1px solid #bbf7d0", padding: "3px 9px", borderRadius: 20, whiteSpace: "nowrap"
          }}>
            {nbDansRayon} <FontAwesomeIcon icon={faTrash} style={{ fontSize: 9 }} />
          </span>
        </div>

        {gpsErreur && !commune && (
          <div style={{ fontSize: 11, color: "#d97706", marginTop: 8 }}>
            <FontAwesomeIcon icon={faLocationDot} style={{ marginRight: 4 }} />
            Position GPS indisponible — choisissez une commune ou activez le GPS.
          </div>
        )}
      </div>

      {/* Carte */}
      <div style={{ position: "relative", zIndex: 0, borderRadius: 16, overflow: "hidden", boxShadow: "0 2px 12px rgba(0,0,0,0.1)" }}>
        <MapContainer center={[centre.lat, centre.lng]} zoom={14} maxZoom={21}
          style={{ height: "calc(100dvh - 330px)", minHeight: 380, width: "100%" }}>
          <TileLayer
            url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
            attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>'
            maxZoom={21} maxNativeZoom={19}
          />
          <Recentrer centre={centre} />

          {/* Rayon d'action */}
          <Circle center={[centre.lat, centre.lng]} radius={rayon * 1000}
            pathOptions={{ color: "#16a34a", weight: 1.5, fillColor: "#16a34a", fillOpacity: 0.07 }} />

          {/* Moi (le collecteur) */}
          {maPosition && (
            <Marker position={[maPosition.lat, maPosition.lng]} icon={iconCamion}>
              <Popup><b>Vous êtes ici</b></Popup>
            </Marker>
          )}

          {/* Signalements */}
          {avecGps.map(s => {
            const d = distanceKm(centre.lat, centre.lng, s.lat, s.lng);
            const dans = d <= rayon;
            const enCorbeille = corbeilleIds.has(s.id);
            return (
              <Marker key={s.id} position={[s.posLat, s.posLng]}
                icon={enCorbeille ? iconPoubelleCorbeille : s.urgent ? iconPoubelleUrgente : iconPoubelle}
                opacity={dans ? 1 : 0.35}>
                <Popup>
                  <div style={{ minWidth: 185, fontFamily: "sans-serif" }}>
                    {s.photo && (
                      <img src={s.photo} alt="poubelle"
                        style={{ width: "100%", height: 90, objectFit: "cover", borderRadius: 10, marginBottom: 8 }} />
                    )}
                    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 4 }}>
                      <span style={{ fontSize: 14, fontWeight: 800, color: "#0f172a" }}>
                        {s.nom?.trim().split(/\s+/).pop() || ""}
                      </span>
                      {s.urgent && (
                        <span style={{ background: "#ef4444", color: "white", fontSize: 9, fontWeight: 800, padding: "2px 6px", borderRadius: 6 }}>URGENT</span>
                      )}
                    </div>
                    <div style={{ fontSize: 12, color: "#16a34a", fontWeight: 700, marginBottom: 2 }}>
                      <FontAwesomeIcon icon={faLocationDot} style={{ marginRight: 4 }} />{s.commune} — {s.quartier}
                    </div>
                    <div style={{ fontSize: 11, color: "#475569", marginBottom: 2 }}>{s.type} · {s.volume}</div>
                    {formatFCFA(s.prix) && (
                      <div style={{ fontSize: 15, fontWeight: 900, color: "#16a34a", marginBottom: 4 }}>
                        <FontAwesomeIcon icon={faCoins} style={{ marginRight: 5 }} />{formatFCFA(s.prix)}
                      </div>
                    )}
                    <div style={{ fontSize: 11, color: "#94a3b8", marginBottom: 8 }}>
                      <FontAwesomeIcon icon={faClock} style={{ marginRight: 4 }} />{timeAgo(s.createdAt)} · à {formatDistance(d)}
                    </div>

                    {dans ? (
                      enCorbeille ? (
                        <button onClick={() => onRetirer(s.id)} style={{
                          width: "100%", padding: "9px", borderRadius: 10, cursor: "pointer",
                          fontWeight: 800, fontSize: 12, border: "1.5px solid #fde68a",
                          background: "#fffbeb", color: "#d97706"
                        }}>
                          <FontAwesomeIcon icon={faXmark} style={{ marginRight: 5 }} />Retirer de ma corbeille
                        </button>
                      ) : (
                        <button onClick={() => onAjouter(s)} style={{
                          width: "100%", padding: "9px", borderRadius: 10, cursor: "pointer",
                          fontWeight: 800, fontSize: 12, border: "none",
                          background: "linear-gradient(135deg, #16a34a, #15803d)", color: "white"
                        }}>
                          <FontAwesomeIcon icon={faPlus} style={{ marginRight: 5 }} />Ajouter à ma corbeille
                        </button>
                      )
                    ) : (
                      <div style={{ fontSize: 11, color: "#94a3b8", textAlign: "center", padding: "6px 0" }}>
                        Hors de votre rayon ({formatDistance(d)})
                      </div>
                    )}
                  </div>
                </Popup>
              </Marker>
            );
          })}
        </MapContainer>

        {/* Bouton flottant corbeille */}
        <button onClick={onVoirCorbeille} style={{
          position: "absolute", bottom: 16, right: 16, zIndex: 1000,
          display: "flex", alignItems: "center", gap: 8,
          background: "linear-gradient(135deg, #0f2d0f, #166534)", color: "#a3e635",
          border: "none", borderRadius: 14, padding: "12px 18px",
          fontWeight: 800, fontSize: 13, cursor: "pointer",
          boxShadow: "0 4px 16px rgba(15,45,15,0.4)"
        }}>
          <FontAwesomeIcon icon={faBasketShopping} />
          Corbeille
          <span style={{
            background: "#a3e635", color: "#14532d", borderRadius: 20,
            padding: "1px 8px", fontSize: 12, fontWeight: 900
          }}>{nbCorbeille}</span>
        </button>
      </div>
    </div>
  );
}
