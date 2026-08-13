// Deux gabarits, pas un seul étiré.
//
//  - Terrain (téléphone)  : signaler, collecter, déposer. Une colonne, au pouce,
//                           dehors. C'est le gabarit d'origine, on n'y touche pas.
//  - Bureau (écran large) : administration, exploitation des bornes, mairie.
//                           Personne ne traite deux cents signalements sur un
//                           téléphone — et une démo au vidéoprojecteur ne doit
//                           pas ressembler à une capture d'écran de mobile.

import { useSyncExternalStore } from "react";

export const BUREAU_MIN_PX = 1024;
export const LARGEUR_TERRAIN = 440;
export const LARGEUR_BUREAU = 1180;

const REQUETE = `(min-width: ${BUREAU_MIN_PX}px)`;

// useSyncExternalStore est fait pour ça : s'abonner à une source extérieure à
// React (ici la media query) sans appeler setState depuis un effet, ce qui
// laissait le hook sur une valeur périmée quand la fenêtre changeait de taille.
const abonner = (rappel) => {
  const mq = window.matchMedia(REQUETE);
  mq.addEventListener("change", rappel);
  return () => mq.removeEventListener("change", rappel);
};

const lire = () => window.matchMedia(REQUETE).matches;

export function useEstBureau() {
  return useSyncExternalStore(abonner, lire, () => false);
}

// Largeur du conteneur : terrain par défaut, large quand l'écran le permet.
export const largeur = (estBureau) => (estBureau ? LARGEUR_BUREAU : LARGEUR_TERRAIN);

// Grille responsive de cartes, pour les listes qui gagnent à s'étaler.
export const grilleCartes = (estBureau, minPx = 330) =>
  estBureau
    ? { display: "grid", gridTemplateColumns: `repeat(auto-fill, minmax(${minPx}px, 1fr))`, gap: 4, alignItems: "start" }
    : {};
