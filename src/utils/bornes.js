// Lecture temps réel des bornes connectées et code couleur de leur remplissage.
// Les seuils sont les mêmes que côté serveur (api/_bornes.js) : si tu en changes
// un, change-le aux deux endroits.

import { useState, useEffect } from "react";
import { collection, onSnapshot } from "firebase/firestore";
import { db } from "../firebase/config";

export const SEUIL_ALERTE_PCT = 80;
export const SEUIL_PLEINE_PCT = 95;

export const ETATS = {
  hors_service: { libelle: "Hors service", couleur: "#64748b", fond: "#f1f5f9", bordure: "#cbd5e1" },
  pleine: { libelle: "Pleine", couleur: "#dc2626", fond: "#fef2f2", bordure: "#fecaca" },
  alerte: { libelle: "Bientôt pleine", couleur: "#d97706", fond: "#fffbeb", bordure: "#fde68a" },
  ok: { libelle: "Disponible", couleur: "#16a34a", fond: "#f0fdf4", bordure: "#bbf7d0" },
};

export function etatBorne(borne) {
  if (borne?.etat === "hors_service") return "hors_service";
  const pct = borne?.remplissagePct ?? 0;
  if (pct >= SEUIL_PLEINE_PCT) return "pleine";
  if (pct >= SEUIL_ALERTE_PCT) return "alerte";
  return "ok";
}

export const styleBorne = (borne) => ETATS[etatBorne(borne)];

// Nombre de kilos encore acceptables, pour l'exploitant.
export const placeRestanteKg = (borne) =>
  Math.max(0, Math.round((borne?.capaciteKg || 0) - (borne?.poidsNetKg || 0)));

export function useBornes() {
  const [bornes, setBornes] = useState([]);
  const [chargees, setChargees] = useState(false);

  useEffect(() => {
    const unsub = onSnapshot(
      collection(db, "bornes"),
      (snap) => {
        setBornes(snap.docs.map((d) => ({ id: d.id, ...d.data() })));
        setChargees(true);
      },
      // Une base sans collection `bornes` (avant le déploiement du parc) ne doit
      // pas casser la carte : on reste simplement sans borne.
      () => setChargees(true)
    );
    return () => unsub();
  }, []);

  return { bornes, chargees };
}
