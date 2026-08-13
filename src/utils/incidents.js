// Signalement citoyen d'insalubrité : caniveaux bouchés, dépôts sauvages,
// fosses septiques qui débordent, bornes vandalisées.
//
// Deux principes portent tout le reste :
//
//  1. Le PROBLÈME est public, la PERSONNE ne l'est jamais. Un signalement qui
//     vise un individu part à la police municipale et ne s'affiche nulle part.
//     Sans ça, la plateforme devient un outil de règlement de comptes entre
//     voisins — et un risque juridique (loi ivoirienne sur les données
//     personnelles, diffamation).
//
//  2. Deux signalements du même problème au même endroit ne font qu'un point,
//     avec un compteur. Ça tue le spam et ça donne à la mairie une mesure de
//     gravité : un point signalé quarante fois passe devant.

import { useState, useEffect } from "react";
import { collection, onSnapshot, query, where } from "firebase/firestore";
import { db } from "../firebase/config";
import { distanceKm } from "./geo";

// Deux signalements de même nature à moins de 30 m sont le même problème.
export const RAYON_REGROUPEMENT_M = 30;

// La vidéo coûte cher en data à Abidjan : la photo reste le défaut.
export const DUREE_VIDEO_MAX_S = 30;
export const TAILLE_MEDIA_MAX_MO = 25;

export const CATEGORIES = {
  caniveau: {
    libelle: "Caniveau bouché",
    description: "Eau stagnante, ordures dans le caniveau",
    couleur: "#0284c7",
    // Priorité maximale : c'est ce qui provoque les inondations en saison des pluies.
    priorite: 1,
    visibilite: "publique",
  },
  depot_sauvage: {
    libelle: "Dépôt sauvage",
    description: "Tas d'ordures hors des bornes",
    couleur: "#d97706",
    priorite: 2,
    visibilite: "publique",
  },
  fosse_septique: {
    libelle: "Fosse septique",
    description: "Eaux usées qui débordent dans la rue",
    couleur: "#7c3aed",
    priorite: 1,
    visibilite: "publique",
  },
  borne_hs: {
    libelle: "Borne endommagée",
    description: "Borne vandalisée ou hors service",
    couleur: "#475569",
    priorite: 3,
    visibilite: "publique",
  },
  incivilite: {
    libelle: "Personne prise sur le fait",
    description: "Quelqu'un déverse ses ordures n'importe où",
    couleur: "#dc2626",
    priorite: 2,
    // Jamais public : ce signalement vise une personne.
    visibilite: "restreinte",
  },
};

export const STATUTS = {
  signale: { libelle: "Signalé", couleur: "#dc2626", fond: "#fef2f2", bordure: "#fecaca" },
  affecte: { libelle: "Affecté", couleur: "#d97706", fond: "#fffbeb", bordure: "#fde68a" },
  en_cours: { libelle: "En cours", couleur: "#0284c7", fond: "#f0f9ff", bordure: "#bae6fd" },
  resolu: { libelle: "Résolu", couleur: "#16a34a", fond: "#f0fdf4", bordure: "#bbf7d0" },
};

export const categorie = (cle) => CATEGORIES[cle] || CATEGORIES.depot_sauvage;
export const statut = (cle) => STATUTS[cle] || STATUTS.signale;

export const estPublic = (incident) =>
  categorie(incident?.type).visibilite === "publique";

// Ancienneté en jours : c'est l'indicateur qui doit virer au rouge et mettre
// la pression, pas la dénonciation d'un voisin.
export function ancienneteJours(incident) {
  const s = incident?.createdAt?.seconds;
  if (!s) return 0;
  return Math.floor((Date.now() - s * 1000) / 86400000);
}

export function urgence(incident) {
  if (incident?.statut === "resolu") return "resolu";
  const j = ancienneteJours(incident);
  if (j >= 14) return "critique";
  if (j >= 7) return "elevee";
  return "normale";
}

/**
 * Cherche un incident déjà signalé, de même nature et à moins de 30 m.
 * Sert à confirmer plutôt qu'à dupliquer.
 */
export function incidentExistant(incidents, type, lat, lng) {
  return incidents.find(
    (i) =>
      i.type === type &&
      i.statut !== "resolu" &&
      i.lat != null &&
      distanceKm(lat, lng, i.lat, i.lng) * 1000 <= RAYON_REGROUPEMENT_M
  ) || null;
}

/** Incidents publics non résolus, pour la carte et la liste. */
export function useIncidents({ inclureResolus = false } = {}) {
  const [incidents, setIncidents] = useState([]);
  const [chargees, setChargees] = useState(false);

  useEffect(() => {
    const q = query(collection(db, "incidents"), where("visibilite", "==", "publique"));
    const unsub = onSnapshot(
      q,
      (snap) => {
        const data = snap.docs.map((d) => ({ id: d.id, ...d.data() }));
        setIncidents(inclureResolus ? data : data.filter((i) => i.statut !== "resolu"));
        setChargees(true);
      },
      // Une base sans collection `incidents` ne doit pas casser la carte.
      () => setChargees(true)
    );
    return () => unsub();
  }, [inclureResolus]);

  return { incidents, chargees };
}

/** Mes propres signalements, y compris ceux qui ne sont pas publics. */
export function useMesIncidents(uid) {
  const [incidents, setIncidents] = useState([]);

  useEffect(() => {
    if (!uid) return;
    const q = query(collection(db, "incidents"), where("uid", "==", uid));
    const unsub = onSnapshot(
      q,
      (snap) => {
        const data = snap.docs.map((d) => ({ id: d.id, ...d.data() }));
        data.sort((a, b) => (b.createdAt?.seconds || 0) - (a.createdAt?.seconds || 0));
        setIncidents(data);
      },
      () => {}
    );
    return () => unsub();
  }, [uid]);

  return incidents;
}
