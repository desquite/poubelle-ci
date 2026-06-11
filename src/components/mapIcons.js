// Icônes personnalisées Leaflet (divIcon avec SVG inline, pas d'images externes)

import L from "leaflet";

const TRASH_PATH = "M135.2 17.7L128 32H32C14.3 32 0 46.3 0 64S14.3 96 32 96H416c17.7 0 32-14.3 32-32s-14.3-32-32-32H320l-7.2-14.3C307.4 6.8 296.3 0 284.2 0H163.8c-12.1 0-23.2 6.8-28.6 17.7zM416 128H32L53.2 467c1.6 25.3 22.6 45 47.9 45H346.9c25.3 0 46.3-19.7 47.9-45L416 128z";
const TRUCK_PATH = "M48 0C21.5 0 0 21.5 0 48V368c0 26.5 21.5 48 48 48H64c0 53 43 96 96 96s96-43 96-96H384c0 53 43 96 96 96s96-43 96-96h32c17.7 0 32-14.3 32-32s-14.3-32-32-32V288 256 237.3c0-17-6.7-33.3-18.7-45.3L512 114.7c-12-12-28.3-18.7-45.3-18.7H416V48c0-26.5-21.5-48-48-48H48zM416 160h50.7L544 237.3V256H416V160zM112 416a48 48 0 1 1 96 0 48 48 0 1 1 -96 0zm368-48a48 48 0 1 1 0 96 48 48 0 1 1 0-96z";
const CHECK_PATH = "M438.6 105.4c12.5 12.5 12.5 32.8 0 45.3l-256 256c-12.5 12.5-32.8 12.5-45.3 0l-128-128c-12.5-12.5-12.5-32.8 0-45.3s32.8-12.5 45.3 0L160 338.7 393.4 105.4c12.5-12.5 32.8-12.5 45.3 0z";

const svgIcon = (path, viewBox, bg, size = 34, badge = null) =>
  L.divIcon({
    className: "",
    html: `<div style="width:${size}px;height:${size}px;border-radius:50%;background:${bg};border:2.5px solid white;box-shadow:0 2px 8px rgba(0,0,0,0.35);display:flex;align-items:center;justify-content:center;position:relative;">
      <svg viewBox="${viewBox}" width="${Math.round(size * 0.48)}" height="${Math.round(size * 0.48)}" fill="white"><path d="${path}"/></svg>
      ${badge ? `<div style="position:absolute;top:-4px;right:-4px;width:15px;height:15px;border-radius:50%;background:#f59e0b;border:2px solid white;display:flex;align-items:center;justify-content:center;"><svg viewBox="0 0 448 512" width="8" height="8" fill="white"><path d="${CHECK_PATH}"/></svg></div>` : ""}
    </div>`,
    iconSize: [size, size],
    iconAnchor: [size / 2, size / 2],
    popupAnchor: [0, -size / 2],
  });

export const iconPoubelle = svgIcon(TRASH_PATH, "0 0 448 512", "linear-gradient(135deg, #16a34a, #15803d)");
export const iconPoubelleUrgente = svgIcon(TRASH_PATH, "0 0 448 512", "linear-gradient(135deg, #ef4444, #dc2626)");
export const iconPoubelleCorbeille = svgIcon(TRASH_PATH, "0 0 448 512", "linear-gradient(135deg, #16a34a, #15803d)", 34, true);
export const iconCamion = svgIcon(TRUCK_PATH, "0 0 640 512", "linear-gradient(135deg, #0f2d0f, #1a4d1a)", 42);
