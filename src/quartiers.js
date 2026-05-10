// Ce fichier contient la liste de toutes les communes et quartiers d'Abidjan

export const COMMUNES_QUARTIERS = {
  "ABOBO": [
    "Agbekoi", "Avocatier", "Baoulé", "Cité Anador", "Cité SIM",
    "Cité Vie Nouvelle", "Djékanou", "Héliport", "N'Dotré",
    "PK18", "Sagbé", "Sogefiha"
  ],
  "ADJAMÉ": [
    "Anono", "Cité des Arts", "Habitat", "Liberté",
    "Marché Adjamé", "Résidentiel", "Williamsville"
  ],
  "ATTÉCOUBÉ": [
    "Boribana", "Cité Verte", "Fond de Bié", "KM17",
    "Santé", "Ségréfou"
  ],
  "COCODY": [
    "Ambassades", "Angré", "Blockhaus", "Bonoumin",
    "Cité des Cadres", "Cité Mermoz", "Cité SCI",
    "Danga", "Deux Plateaux", "Lauriers", "Palmeraie",
    "Riviera 1", "Riviera 2", "Riviera 3", "Riviera 4",
    "Saint-Jean"
  ],
  "KOUMASSI": [
    "Cité Fié", "Cité Renault", "Cité Unicao",
    "Grand Campement", "Résidentiel", "Zone Industrielle"
  ],
  "MARCORY": [
    "Anoumabo", "Belle Vue", "Biétry", "Cité Biétry",
    "Cité SETU", "Résidentiel", "Zone 4"
  ],
  "PLATEAU": [
    "Centre Ville", "Cité Administrative"
  ],
  "PORT-BOUËT": [
    "Abouabou", "Adjouffou", "Cité Aéroport",
    "Gonzagueville", "Koumassi Remblais",
    "Petit Bassam", "Vridi"
  ],
  "TREICHVILLE": [
    "Arras", "Biafra", "Cité Derrière Rail",
    "Marché de Treichville", "Zone Portuaire"
  ],
  "YOPOUGON": [
    "Andokoi", "Attié", "Banco Nord", "Banco Sud",
    "California", "Cité Génie", "Cité Lorraine",
    "Cité Millionnaire", "Cité Sicogi", "Cité Sogefiha",
    "Cité SIR", "Cité SOTRA", "Cité Verte",
    "Djao Séhi", "Doukouré", "Ficgayo", "Gesco",
    "Katmandou", "Kouté", "Las Vegas", "Localité",
    "Maroc", "Niangon Nord", "Niangon Sud",
    "Petit Bouaké", "Port Bouët 2", "Quartier Hévea","Selmer",
    "Sicobois", "Siporex", "Toits Rouges",
    "Vatican", "Wassakara"
  ]
};

export const COMMUNES = Object.keys(COMMUNES_QUARTIERS).sort();