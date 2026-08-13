// Fond de carte partagé par toutes les cartes de l'app.
//
// Deux vues :
//  - « plan »      : CARTO Voyager, bien plus lisible et coloré que le rendu
//                    OpenStreetMap brut (mêmes données, meilleur habillage).
//  - « satellite » : imagerie aérienne Esri + calque de libellés par-dessus.
//                    Indispensable à Abidjan, où beaucoup de quartiers sont
//                    mal cartographiés en plan : le collecteur reconnaît la
//                    cour, le toit, le mur — pas le nom de la rue.
//
// Les deux fournisseurs sont gratuits et ne demandent pas de clé d'API.

import { TileLayer } from "react-leaflet";
import { ZOOM_MAX } from "../utils/fondCarte";
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import { faMap, faSatellite } from "@fortawesome/free-solid-svg-icons";

const ATTR_CARTO = '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> &copy; <a href="https://carto.com/attributions">CARTO</a>';

export function FondCarte({ vue = "plan" }) {
  if (vue === "satellite") return (
    <>
      <TileLayer
        url="https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}"
        attribution="Imagerie &copy; Esri"
        maxZoom={ZOOM_MAX} maxNativeZoom={19}
      />
      {/* Noms de rues et de quartiers par-dessus l'imagerie */}
      <TileLayer
        url="https://{s}.basemaps.cartocdn.com/rastertiles/voyager_only_labels/{z}/{x}/{y}.png"
        subdomains="abcd"
        attribution={ATTR_CARTO}
        maxZoom={ZOOM_MAX} maxNativeZoom={20}
      />
    </>
  );

  return (
    <TileLayer
      url="https://{s}.basemaps.cartocdn.com/rastertiles/voyager/{z}/{x}/{y}.png"
      subdomains="abcd"
      attribution={ATTR_CARTO}
      maxZoom={ZOOM_MAX} maxNativeZoom={20}
    />
  );
}

// Bascule Plan / Satellite posée sur la carte (au-dessus des contrôles Leaflet).
// `compact` : icône seule, pour la mini-carte du panneau de suivi.
export function BoutonFond({ vue, onChange, compact, style }) {
  const satellite = vue === "satellite";
  const libelle = satellite ? "Afficher le plan" : "Afficher le satellite";
  return (
    <button
      onClick={() => onChange(satellite ? "plan" : "satellite")}
      title={libelle} aria-label={libelle}
      style={{
        position: "absolute", top: compact ? 8 : 12, right: compact ? 8 : 12, zIndex: 1000,
        display: "flex", alignItems: "center", justifyContent: "center", gap: 7,
        background: "white", color: "#14532d",
        border: "1.5px solid rgba(15,45,15,0.12)", borderRadius: compact ? 10 : 12,
        padding: compact ? "7px 9px" : "8px 13px", fontSize: 12, fontWeight: 800,
        fontFamily: "sans-serif", cursor: "pointer",
        boxShadow: "0 3px 12px rgba(0,0,0,0.18)",
        ...style
      }}>
      <FontAwesomeIcon icon={satellite ? faMap : faSatellite} />
      {!compact && (satellite ? "Plan" : "Satellite")}
    </button>
  );
}
