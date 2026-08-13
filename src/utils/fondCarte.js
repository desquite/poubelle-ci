// Choix du fond de carte (plan / satellite), mémorisé d'un écran à l'autre
// comme le rayon du collecteur. Voir components/FondCarte.jsx pour le rendu.

import { useState, useEffect } from "react";

export const ZOOM_MAX = 21;

export function useFondCarte() {
  const [vue, setVue] = useState(() => localStorage.getItem("fondCarte") === "satellite" ? "satellite" : "plan");
  useEffect(() => { localStorage.setItem("fondCarte", vue); }, [vue]);
  return [vue, setVue];
}
