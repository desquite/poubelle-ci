// Panneau flottant compact de suivi en direct, côté ménage. S'ouvre
// automatiquement dès qu'un collecteur confirme la collecte (voir Menage.jsx) :
// mini-carte animée avec la poubelle et le collecteur qui se rapproche.
// Déplaçable (barre d'en-tête) et redimensionnable depuis les 4 coins.

import { useState, useEffect, useRef } from "react";
import { MapContainer, TileLayer, Marker, Polyline, useMap } from "react-leaflet";
import { doc, onSnapshot } from "firebase/firestore";
import { db } from "../firebase/config";
import { distanceKm, formatDistance } from "../utils/geo";
import { iconPoubelle, iconPoubelleUrgente, iconCamion } from "./mapIcons";
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import { faXmark, faTruck, faCircleCheck, faClock } from "@fortawesome/free-solid-svg-icons";

const nomAffiche = (nom) => nom?.trim().split(/\s+/).pop() || nom || "";
const clamp = (v, min, max) => Math.max(min, Math.min(v, max));
const MIN_W = 240, MIN_H = 240;

function Ajuster({ points }) {
  const map = useMap();
  const cadre = useRef(false);

  // Recalcule la taille de la carte à chaque changement de dimension du
  // conteneur (animation d'entrée, redimensionnement) → pas de tuiles grises.
  useEffect(() => {
    const el = map.getContainer();
    const ro = new ResizeObserver(() => map.invalidateSize());
    ro.observe(el);
    return () => ro.disconnect();
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

  // box = { x, y, w, h } en pixels une fois déplacé/redimensionné ;
  // null = position et taille par défaut (ancré en bas, largeur responsive).
  const panelRef = useRef(null);
  const drag = useRef(null);
  const resize = useRef(null);
  const [box, setBox] = useState(null);
  const [grabbing, setGrabbing] = useState(false);
  const sized = !!box;

  const rect = () => panelRef.current.getBoundingClientRect();

  // ── Déplacement (poignée = en-tête) ──
  const onHeaderDown = (e) => {
    if (e.target.closest("button")) return;
    const r = rect();
    drag.current = { dx: e.clientX - r.left, dy: e.clientY - r.top, w: r.width, h: r.height };
    setBox({ x: r.left, y: r.top, w: r.width, h: r.height });
    setGrabbing(true);
    e.currentTarget.setPointerCapture?.(e.pointerId);
  };
  const onHeaderMove = (e) => {
    const s = drag.current; if (!s) return;
    setBox({
      x: clamp(e.clientX - s.dx, 6, window.innerWidth - s.w - 6),
      y: clamp(e.clientY - s.dy, 6, window.innerHeight - s.h - 6),
      w: s.w, h: s.h,
    });
  };
  const onHeaderUp = (e) => {
    drag.current = null;
    setGrabbing(false);
    e.currentTarget.releasePointerCapture?.(e.pointerId);
  };

  // ── Redimensionnement (4 coins) ──
  const onResizeDown = (corner) => (e) => {
    e.stopPropagation();
    const r = rect();
    resize.current = { corner, sx: e.clientX, sy: e.clientY, x: r.left, y: r.top, w: r.width, h: r.height };
    setBox({ x: r.left, y: r.top, w: r.width, h: r.height });
    e.currentTarget.setPointerCapture?.(e.pointerId);
  };
  const onResizeMove = (e) => {
    const s = resize.current; if (!s) return;
    const dx = e.clientX - s.sx, dy = e.clientY - s.sy;
    const right = s.x + s.w, bottom = s.y + s.h;
    let { x, y, w, h } = s;
    if (s.corner.includes("e")) w = clamp(s.w + dx, MIN_W, window.innerWidth - s.x - 6);
    if (s.corner.includes("s")) h = clamp(s.h + dy, MIN_H, window.innerHeight - s.y - 6);
    if (s.corner.includes("w")) { w = clamp(s.w - dx, MIN_W, right - 6); x = right - w; }
    if (s.corner.includes("n")) { h = clamp(s.h - dy, MIN_H, bottom - 6); y = bottom - h; }
    setBox({ x, y, w, h });
  };
  const onResizeUp = (e) => {
    resize.current = null;
    e.currentTarget.releasePointerCapture?.(e.pointerId);
  };

  // Re-borne le panneau si la fenêtre change de taille
  useEffect(() => {
    const onWin = () => setBox(b => {
      if (!b) return b;
      const w = Math.min(b.w, window.innerWidth - 12);
      const h = Math.min(b.h, window.innerHeight - 12);
      return { w, h, x: clamp(b.x, 6, window.innerWidth - w - 6), y: clamp(b.y, 6, window.innerHeight - h - 6) };
    });
    window.addEventListener("resize", onWin);
    return () => window.removeEventListener("resize", onWin);
  }, []);

  const poignee = (corner, cursor, { grip, ...pos }) => (
    <div
      onPointerDown={onResizeDown(corner)}
      onPointerMove={onResizeMove}
      onPointerUp={onResizeUp}
      style={{ position: "absolute", width: 22, height: 22, zIndex: 5, cursor, touchAction: "none", ...pos }}
    >
      <div style={{ position: "absolute", width: 11, height: 11, ...grip }} />
    </div>
  );

  const brTop = "2.5px solid rgba(255,255,255,0.85)";
  const brBot = "2.5px solid rgba(15,23,42,0.4)";

  return (
    <>
      <style>{`
        @keyframes suiviUp { from { opacity: 0; transform: translateY(40px); } to { opacity: 1; transform: translateY(0); } }
        @keyframes suiviPulse { 0% { box-shadow: 0 0 0 0 rgba(163,230,53,0.6); } 70% { box-shadow: 0 0 0 7px rgba(163,230,53,0); } 100% { box-shadow: 0 0 0 0 rgba(163,230,53,0); } }
      `}</style>

      <div ref={panelRef} style={{
        position: "fixed", zIndex: 2500, display: "flex", flexDirection: "column",
        ...(sized
          ? { left: box.x, top: box.y, width: box.w, height: box.h }
          : { bottom: 12, left: 12, right: 12, width: "calc(100% - 24px)", maxWidth: 420, margin: "0 auto" }),
        background: "white", borderRadius: 18, overflow: "hidden",
        boxShadow: "0 12px 45px rgba(0,0,0,0.32)", fontFamily: "sans-serif",
        animation: "suiviUp 0.4s cubic-bezier(0.2,0.8,0.2,1)"
      }}>
        {/* En-tête (poignée de déplacement) */}
        <div
          onPointerDown={onHeaderDown}
          onPointerMove={onHeaderMove}
          onPointerUp={onHeaderUp}
          style={{
            background: "linear-gradient(135deg, #0f2d0f, #1a4d1a)", padding: "11px 14px",
            display: "flex", alignItems: "center", justifyContent: "space-between", gap: 10,
            cursor: grabbing ? "grabbing" : "grab", touchAction: "none", userSelect: "none", flexShrink: 0
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
            position: "relative", zIndex: 6,
            background: "rgba(255,255,255,0.14)", border: "none", color: "white",
            borderRadius: 10, width: 32, height: 32, cursor: "pointer", fontSize: 14, flexShrink: 0
          }}>
            <FontAwesomeIcon icon={faXmark} />
          </button>
        </div>

        {/* Mini-carte (occupe l'espace restant quand le panneau est redimensionné) */}
        <div style={{ position: "relative", zIndex: 0, ...(sized ? { flex: 1, minHeight: 0 } : { height: 190 }) }}>
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
        <div style={{ padding: "11px 14px", flexShrink: 0 }}>
          {collecte ? (
            <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 10 }}>
              <span style={{ fontSize: 13, fontWeight: 800, color: "#16a34a" }}>
                <FontAwesomeIcon icon={faCircleCheck} style={{ marginRight: 6 }} />Merci d'utiliser Poubelle-CI !
              </span>
              <button onClick={onClose} style={{
                position: "relative", zIndex: 6,
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

        {/* Poignées de redimensionnement (4 coins) */}
        {poignee("nw", "nwse-resize", { top: 0, left: 0, grip: { top: 5, left: 5, borderTop: brTop, borderLeft: brTop, borderTopLeftRadius: 4 } })}
        {poignee("ne", "nesw-resize", { top: 0, right: 0, grip: { top: 5, right: 5, borderTop: brTop, borderRight: brTop, borderTopRightRadius: 4 } })}
        {poignee("sw", "nesw-resize", { bottom: 0, left: 0, grip: { bottom: 5, left: 5, borderBottom: brBot, borderLeft: brBot, borderBottomLeftRadius: 4 } })}
        {poignee("se", "nwse-resize", { bottom: 0, right: 0, grip: { bottom: 5, right: 5, borderBottom: brBot, borderRight: brBot, borderBottomRightRadius: 4 } })}
      </div>
    </>
  );
}
