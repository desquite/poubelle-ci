// Formatage monétaire en francs CFA (séparateur de milliers par espace).

export const formatFCFA = (montant) => {
  const n = Number(montant);
  if (!n || n <= 0) return null;
  return `${n.toLocaleString("fr-FR")} FCFA`;
};
