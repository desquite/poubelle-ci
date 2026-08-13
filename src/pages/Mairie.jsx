// Back-office mairie : traiter les signalements citoyens jusqu'à leur résolution.
//
// Sans cet écran, la mairie regarde une carte et ne fait rien. Trois choses le
// rendent utile : l'affectation à un service, la preuve de résolution
// obligatoire, et le compteur d'ancienneté qui vire au rouge.

import { useState } from "react";
import { doc, updateDoc, serverTimestamp } from "firebase/firestore";
import { db } from "../firebase/config";
import { MapContainer, Marker, Popup } from "react-leaflet";
import { FondCarte } from "../components/FondCarte";
import { useFondCarte, ZOOM_MAX } from "../utils/fondCarte";
import { iconIncident } from "../components/mapIcons";
import { ABIDJAN_CENTER, COMMUNES } from "../quartiers";
import { useEstBureau, largeur, grilleCartes } from "../utils/ecran";
import {
  useTousIncidents, CATEGORIES, STATUTS, SERVICES, SUITE_STATUT,
  categorie, statut, ancienneteJours, urgence,
  delaiMoyenParCommune, delaiResolutionJours,
} from "../utils/incidents";
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import {
  faLocationDot, faClock, faUsers, faCheck, faCamera, faDiamondTurnRight,
  faTriangleExclamation, faShieldHalved, faChartBar, faXmark, faGaugeHigh,
} from "@fortawesome/free-solid-svg-icons";

const televerser = async (fichier) => {
  const form = new FormData();
  form.append("file", fichier);
  form.append("upload_preset", import.meta.env.VITE_CLOUDINARY_UPLOAD_PRESET);
  const r = await fetch(
    `https://api.cloudinary.com/v1_1/${import.meta.env.VITE_CLOUDINARY_CLOUD_NAME}/auto/upload`,
    { method: "POST", body: form }
  );
  const d = await r.json();
  if (!d.secure_url) throw new Error(d.error?.message || "Envoi impossible");
  return d.secure_url;
};

const jours = (n) => (n < 1 ? `${Math.round(n * 24)} h` : `${n.toFixed(1)} j`);

export default function Mairie({ utilisateur, onglet }) {
  const estBureau = useEstBureau();
  const { incidents, chargees, erreur } = useTousIncidents();
  const [fond] = useFondCarte();

  const [filtreCommune, setFiltreCommune] = useState("");
  const [filtreType, setFiltreType] = useState("");
  const [filtreStatut, setFiltreStatut] = useState("");
  const [enCours, setEnCours] = useState(null);
  const [resolution, setResolution] = useState(null);

  const filtres = incidents
    .filter((i) => (filtreCommune ? i.commune === filtreCommune : true))
    .filter((i) => (filtreType ? i.type === filtreType : true))
    .filter((i) => (filtreStatut ? i.statut === filtreStatut : true));

  // Les plus urgents d'abord : critique, puis ancienneté, puis confirmations.
  const ordonnes = [...filtres].sort((a, b) => {
    if ((a.statut === "resolu") !== (b.statut === "resolu")) return a.statut === "resolu" ? 1 : -1;
    const pa = categorie(a.type).priorite, pb = categorie(b.type).priorite;
    if (pa !== pb) return pa - pb;
    const ca = a.confirmations || 1, cb = b.confirmations || 1;
    if (ca !== cb) return cb - ca;
    return ancienneteJours(b) - ancienneteJours(a);
  });

  const avancer = async (incident, nouveau, extra = {}) => {
    setEnCours(incident.id);
    try {
      await updateDoc(doc(db, "incidents", incident.id), {
        statut: nouveau,
        ...(nouveau === "resolu" ? { resoluAt: serverTimestamp(), resoluPar: utilisateur.uid } : {}),
        ...extra,
      });
    } catch (e) {
      alert("Erreur : " + e.message);
    }
    setEnCours(null);
  };

  if (erreur) return (
    <div style={{ padding: 24, maxWidth: 440, margin: "0 auto" }}>
      <div style={{
        background: "#fef2f2", border: "1.5px solid #fecaca", borderRadius: 14,
        padding: "16px 18px", color: "#b91c1c", fontSize: 13, lineHeight: 1.55,
      }}>
        <FontAwesomeIcon icon={faTriangleExclamation} style={{ marginRight: 7 }} />
        <strong>Accès refusé aux signalements.</strong>
        <div style={{ marginTop: 8, fontWeight: 500 }}>
          Vérifiez que les règles Firestore de la collection <code>incidents</code> sont
          bien déployées dans la console Firebase, et que ce compte a le rôle mairie.
          <div style={{ marginTop: 6, fontSize: 11.5, opacity: 0.8 }}>Code : {erreur}</div>
        </div>
      </div>
    </div>
  );

  if (!chargees) return (
    <div style={{ padding: 60, textAlign: "center", color: "#94a3b8" }}>
      <FontAwesomeIcon icon={faClock} style={{ fontSize: 28 }} />
      <div style={{ fontSize: 13, marginTop: 8 }}>Chargement…</div>
    </div>
  );

  // ── Bilan ──────────────────────────────────────────────────────────────
  if (onglet === "bilan") {
    const resolus = incidents.filter((i) => i.statut === "resolu");
    const delais = delaiMoyenParCommune(incidents);
    const enAttente = incidents.filter((i) => i.statut !== "resolu");
    const critiques = enAttente.filter((i) => urgence(i) === "critique");

    const parCategorie = {};
    enAttente.forEach((i) => { parCategorie[i.type] = (parCategorie[i.type] || 0) + 1; });
    const categoriesTriees = Object.entries(parCategorie).sort((a, b) => b[1] - a[1]);

    const global = resolus.length
      ? resolus.reduce((s, i) => s + (delaiResolutionJours(i) || 0), 0) / resolus.length
      : null;

    return (
      <div style={{ padding: 16, maxWidth: largeur(estBureau), margin: "0 auto" }}>
        <div style={{
          display: "grid", gap: 10, marginBottom: 16,
          gridTemplateColumns: estBureau ? "repeat(4, 1fr)" : "1fr 1fr",
        }}>
          <Tuile libelle="En attente" valeur={enAttente.length} couleur="#dc2626" icone={faTriangleExclamation} />
          <Tuile libelle="Résolus" valeur={resolus.length} couleur="#16a34a" icone={faCheck} />
          <Tuile libelle="Critiques (14 j+)" valeur={critiques.length} couleur="#b91c1c" icone={faClock} />
          <Tuile libelle="Délai moyen" valeur={global === null ? "—" : jours(global)} couleur="#0284c7" icone={faGaugeHigh} />
        </div>

        <div style={{
          display: estBureau ? "grid" : "block",
          gridTemplateColumns: estBureau ? "repeat(auto-fit, minmax(320px, 1fr))" : undefined,
          gap: estBureau ? 16 : 0, alignItems: "start",
        }}>
          <Bloc titre="Délai moyen de résolution par commune" icone={faChartBar}>
            {delais.length === 0 ? (
              <Vide>Aucun signalement résolu pour l'instant.</Vide>
            ) : (
              <>
                {delais.map((d, i) => (
                  <div key={d.commune} style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 10 }}>
                    <Rang n={i + 1} bon={i === 0} />
                    <div style={{ flex: 1 }}>
                      <div style={{ fontSize: 12, fontWeight: 700, color: "#0f172a" }}>{d.commune}</div>
                      <div style={{ height: 4, borderRadius: 4, background: "#f1f5f9", marginTop: 4 }}>
                        <div style={{
                          height: 4, borderRadius: 4,
                          width: `${Math.round((d.moyenneJours / delais[delais.length - 1].moyenneJours) * 100)}%`,
                          background: d.moyenneJours <= 3
                            ? "linear-gradient(90deg, #16a34a, #a3e635)"
                            : d.moyenneJours <= 7
                              ? "linear-gradient(90deg, #d97706, #fbbf24)"
                              : "linear-gradient(90deg, #dc2626, #f87171)",
                        }} />
                      </div>
                    </div>
                    <div style={{ textAlign: "right", minWidth: 62 }}>
                      <div style={{ fontSize: 13, fontWeight: 800, color: "#0f172a" }}>{jours(d.moyenneJours)}</div>
                      <div style={{ fontSize: 10, color: "#94a3b8" }}>{d.nb} résolu{d.nb > 1 ? "s" : ""}</div>
                    </div>
                  </div>
                ))}
                <div style={{ fontSize: 10.5, color: "#94a3b8", marginTop: 10, lineHeight: 1.5 }}>
                  Cet indicateur est destiné à être public : les communes se comparent
                  entre elles, et c'est cette comparaison qui fait avancer les dossiers.
                </div>
              </>
            )}
          </Bloc>

          <Bloc titre="En attente, par nature" icone={faLocationDot}>
            {categoriesTriees.length === 0 ? (
              <Vide>Rien en attente. Tout est traité.</Vide>
            ) : categoriesTriees.map(([cle, n]) => {
              const c = categorie(cle);
              return (
                <div key={cle} style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 10 }}>
                  <span style={{ width: 10, height: 10, borderRadius: "50%", background: c.couleur, flexShrink: 0 }} />
                  <div style={{ flex: 1, fontSize: 12, fontWeight: 700, color: "#0f172a" }}>{c.libelle}</div>
                  <div style={{ fontSize: 13, fontWeight: 800, color: c.couleur }}>{n}</div>
                </div>
              );
            })}
          </Bloc>

          <Bloc titre="Les plus anciens non résolus" icone={faClock}>
            {enAttente.length === 0 ? <Vide>Rien en attente.</Vide> : (
              [...enAttente].sort((a, b) => ancienneteJours(b) - ancienneteJours(a)).slice(0, 6).map((i) => (
                <div key={i.id} style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 9 }}>
                  <span style={{ width: 10, height: 10, borderRadius: "50%", background: categorie(i.type).couleur, flexShrink: 0 }} />
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ fontSize: 12, fontWeight: 700, color: "#0f172a", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>
                      {categorie(i.type).libelle}
                    </div>
                    <div style={{ fontSize: 10.5, color: "#94a3b8" }}>{i.commune}{i.quartier ? ` — ${i.quartier}` : ""}</div>
                  </div>
                  <span style={{
                    fontSize: 11, fontWeight: 800, padding: "3px 9px", borderRadius: 20,
                    background: ancienneteJours(i) >= 14 ? "#fef2f2" : "#f8fafc",
                    color: ancienneteJours(i) >= 14 ? "#dc2626" : "#64748b",
                  }}>{ancienneteJours(i)} j</span>
                </div>
              ))
            )}
          </Bloc>
        </div>
      </div>
    );
  }

  // ── Carte ──────────────────────────────────────────────────────────────
  if (onglet === "carte-mairie") return (
    <div style={{ padding: 16, maxWidth: largeur(estBureau), margin: "0 auto" }}>
      <Filtres {...{ filtreCommune, setFiltreCommune, filtreType, setFiltreType, filtreStatut, setFiltreStatut, nb: filtres.length, estBureau }} />
      <div style={{ position: "relative", zIndex: 0, borderRadius: 16, overflow: "hidden", boxShadow: "0 2px 12px rgba(0,0,0,0.1)" }}>
        <MapContainer center={[ABIDJAN_CENTER.lat, ABIDJAN_CENTER.lng]} zoom={11} maxZoom={ZOOM_MAX}
          style={{ height: estBureau ? "calc(100dvh - 300px)" : 460, minHeight: 380, width: "100%" }}>
          <FondCarte vue={fond} />
          {filtres.filter((i) => i.lat != null).map((i) => (
            <Marker key={i.id} position={[i.lat, i.lng]}
              icon={iconIncident(categorie(i.type).couleur, urgence(i) === "critique")}>
              <Popup>
                <div style={{ minWidth: 190, fontFamily: "sans-serif" }}>
                  <div style={{ fontSize: 13.5, fontWeight: 800, color: "#0f172a" }}>{categorie(i.type).libelle}</div>
                  <div style={{ fontSize: 11, color: "#64748b", marginBottom: 6 }}>
                    {i.commune}{i.quartier ? ` — ${i.quartier}` : ""} · {ancienneteJours(i)} j
                  </div>
                  <PuceStatut i={i} />
                  <a href={`https://www.google.com/maps/dir/?api=1&destination=${i.lat},${i.lng}`}
                    target="_blank" rel="noreferrer" style={{
                      display: "block", marginTop: 8, textAlign: "center", textDecoration: "none",
                      padding: "8px", borderRadius: 10, fontWeight: 800, fontSize: 12,
                      background: "linear-gradient(135deg, #0f2d0f, #166534)", color: "#a3e635",
                    }}>
                    <FontAwesomeIcon icon={faDiamondTurnRight} style={{ marginRight: 5 }} />Y aller
                  </a>
                </div>
              </Popup>
            </Marker>
          ))}
        </MapContainer>
      </div>
    </div>
  );

  // ── Traitement ─────────────────────────────────────────────────────────
  return (
    <div style={{ padding: 16, maxWidth: largeur(estBureau), margin: "0 auto" }}>
      <Filtres {...{ filtreCommune, setFiltreCommune, filtreType, setFiltreType, filtreStatut, setFiltreStatut, nb: filtres.length, estBureau }} />

      {ordonnes.length === 0 ? (
        <div style={{ textAlign: "center", padding: 48, color: "#94a3b8" }}>
          <FontAwesomeIcon icon={faCheck} style={{ fontSize: 34, marginBottom: 10 }} />
          <div style={{ fontSize: 13 }}>Aucun signalement pour ces filtres</div>
        </div>
      ) : (
        <div style={grilleCartes(estBureau, 360)}>
          {ordonnes.map((i) => (
            <FicheIncident
              key={i.id} incident={i}
              occupe={enCours === i.id}
              onAvancer={avancer}
              onResoudre={() => setResolution(i)}
            />
          ))}
        </div>
      )}

      {resolution && (
        <ModaleResolution
          incident={resolution}
          onFermer={() => setResolution(null)}
          onValider={async (preuve) => {
            await avancer(resolution, "resolu", { preuveResolution: preuve });
            setResolution(null);
          }}
          televerser={televerser}
        />
      )}
    </div>
  );
}

// ── Fiche d'un signalement ────────────────────────────────────────────────
function FicheIncident({ incident: i, occupe, onAvancer, onResoudre }) {
  const [service, setService] = useState(i.serviceAffecte || SERVICES[0]);
  const cat = categorie(i.type);
  const age = ancienneteJours(i);
  const critique = urgence(i) === "critique";
  const suite = SUITE_STATUT[i.statut] || [];

  return (
    <div style={{
      background: "white", borderRadius: 16, marginBottom: 12, overflow: "hidden",
      boxShadow: critique ? "0 0 0 2px #fca5a5, 0 4px 14px rgba(220,38,38,0.08)" : "0 2px 10px rgba(0,0,0,0.07)",
    }}>
      {i.media?.url && (
        i.media.type === "video"
          ? <video src={i.media.url} controls style={{ width: "100%", height: 150, background: "#000", display: "block" }} />
          : <img src={i.media.url} alt="" style={{ width: "100%", height: 150, objectFit: "cover", display: "block" }} />
      )}

      <div style={{ padding: "13px 15px" }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", gap: 10, marginBottom: 5 }}>
          <div style={{ display: "flex", alignItems: "center", gap: 8, minWidth: 0 }}>
            <span style={{ width: 9, height: 9, borderRadius: "50%", background: cat.couleur, flexShrink: 0 }} />
            <span style={{ fontSize: 14, fontWeight: 800, color: "#0f172a" }}>{cat.libelle}</span>
          </div>
          <span style={{
            fontSize: 11, fontWeight: 800, padding: "3px 9px", borderRadius: 20, whiteSpace: "nowrap",
            background: critique ? "#fef2f2" : "#f8fafc", color: critique ? "#dc2626" : "#64748b",
          }}>
            <FontAwesomeIcon icon={faClock} style={{ marginRight: 4 }} />{age} j
          </span>
        </div>

        <div style={{ fontSize: 11.5, color: cat.couleur, fontWeight: 700, marginBottom: 5 }}>
          <FontAwesomeIcon icon={faLocationDot} style={{ marginRight: 4 }} />
          {i.commune}{i.quartier ? ` — ${i.quartier}` : ""}
        </div>

        {i.repere && <div style={{ fontSize: 11.5, color: "#475569", marginBottom: 4 }}>{i.repere}</div>}
        {i.details && <div style={{ fontSize: 11, color: "#64748b", marginBottom: 7, lineHeight: 1.45 }}>{i.details}</div>}

        <div style={{ display: "flex", gap: 6, flexWrap: "wrap", marginBottom: 10 }}>
          <PuceStatut i={i} />
          {i.confirmations > 1 && (
            <span style={{ fontSize: 10, fontWeight: 800, padding: "3px 9px", borderRadius: 20, background: "#f1f5f9", color: "#475569" }}>
              <FontAwesomeIcon icon={faUsers} style={{ marginRight: 4 }} />{i.confirmations} signalements
            </span>
          )}
          {i.visibilite === "restreinte" && (
            <span style={{ fontSize: 10, fontWeight: 800, padding: "3px 9px", borderRadius: 20, background: "#fef2f2", color: "#dc2626" }}>
              <FontAwesomeIcon icon={faShieldHalved} style={{ marginRight: 4 }} />Non public
            </span>
          )}
          {i.origine === "galerie" && (
            <span style={{ fontSize: 10, fontWeight: 700, padding: "3px 9px", borderRadius: 20, background: "#fffbeb", color: "#92400e" }}>
              Origine non vérifiée
            </span>
          )}
        </div>

        {i.serviceAffecte && (
          <div style={{ fontSize: 11, color: "#475569", marginBottom: 8 }}>
            Affecté à <strong>{i.serviceAffecte}</strong>
          </div>
        )}

        {i.statut === "resolu" ? (
          <div style={{
            display: "flex", alignItems: "center", gap: 10, padding: "9px 11px",
            background: "#f0fdf4", border: "1px solid #bbf7d0", borderRadius: 11,
          }}>
            {i.preuveResolution && (
              <img src={i.preuveResolution} alt="preuve" style={{ width: 44, height: 44, borderRadius: 9, objectFit: "cover" }} />
            )}
            <div style={{ fontSize: 11.5, color: "#15803d", fontWeight: 700 }}>
              Résolu {delaiResolutionJours(i) !== null && `en ${jours(delaiResolutionJours(i))}`}
            </div>
          </div>
        ) : (
          <>
            {i.statut === "signale" && (
              <select value={service} onChange={(e) => setService(e.target.value)} style={{
                width: "100%", padding: "9px 11px", borderRadius: 10, marginBottom: 8,
                border: "1.5px solid #e2e8f0", fontSize: 12, color: "#0f172a",
                background: "white", outline: "none", fontWeight: 600,
              }}>
                {SERVICES.map((s) => <option key={s} value={s}>{s}</option>)}
              </select>
            )}

            <div style={{ display: "flex", gap: 8 }}>
              <a href={`https://www.google.com/maps/dir/?api=1&destination=${i.lat},${i.lng}`}
                target="_blank" rel="noreferrer" style={{
                  padding: "10px 13px", borderRadius: 10, textDecoration: "none",
                  border: "1.5px solid #e2e8f0", background: "white", color: "#475569",
                  fontSize: 12, fontWeight: 700, whiteSpace: "nowrap",
                }}>
                <FontAwesomeIcon icon={faDiamondTurnRight} />
              </a>

              {suite.filter((s) => s !== "signale").map((s) => (
                <button key={s} disabled={occupe}
                  onClick={() => s === "resolu" ? onResoudre() : onAvancer(i, s, s === "affecte" ? { serviceAffecte: service } : {})}
                  style={{
                    flex: 1, padding: "10px", borderRadius: 10, border: "none",
                    cursor: occupe ? "wait" : "pointer", fontSize: 12.5, fontWeight: 800,
                    background: s === "resolu"
                      ? "linear-gradient(135deg, #16a34a, #15803d)"
                      : "linear-gradient(135deg, #0f2d0f, #166534)",
                    color: s === "resolu" ? "white" : "#a3e635",
                  }}>
                  {occupe ? "…" : s === "affecte" ? "Affecter" : s === "en_cours" ? "Démarrer" : "Marquer résolu"}
                </button>
              ))}
            </div>
          </>
        )}
      </div>
    </div>
  );
}

// ── Preuve de résolution ──────────────────────────────────────────────────
function ModaleResolution({ incident, onFermer, onValider, televerser }) {
  const [apercu, setApercu] = useState(null);
  const [preuve, setPreuve] = useState(null);
  const [envoi, setEnvoi] = useState(false);
  const [erreur, setErreur] = useState("");

  const choisir = async (e) => {
    const f = e.target.files?.[0];
    e.target.value = "";
    if (!f) return;
    if (apercu) URL.revokeObjectURL(apercu);
    setApercu(URL.createObjectURL(f));
    setEnvoi(true);
    setErreur("");
    try {
      setPreuve(await televerser(f));
    } catch (err) {
      setErreur(err.message);
      setApercu(null);
    }
    setEnvoi(false);
  };

  return (
    <div onClick={onFermer} style={{
      position: "fixed", inset: 0, zIndex: 3000, background: "rgba(15,23,42,0.55)",
      display: "flex", alignItems: "center", justifyContent: "center", padding: 16,
    }}>
      <div onClick={(e) => e.stopPropagation()} style={{
        background: "white", borderRadius: 18, padding: 20, width: "100%", maxWidth: 420,
        maxHeight: "88dvh", overflowY: "auto", fontFamily: "sans-serif",
      }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 12 }}>
          <div style={{ fontSize: 16, fontWeight: 900, color: "#0f172a" }}>Preuve de résolution</div>
          <button onClick={onFermer} aria-label="Fermer" style={{
            width: 32, height: 32, borderRadius: 10, border: "none",
            background: "#f1f5f9", color: "#64748b", cursor: "pointer",
          }}><FontAwesomeIcon icon={faXmark} /></button>
        </div>

        <div style={{
          background: "#fffbeb", border: "1.5px solid #fde68a", borderRadius: 12,
          padding: "11px 13px", fontSize: 12, color: "#92400e", lineHeight: 1.5, marginBottom: 14,
        }}>
          Une photo « après » est <strong>obligatoire</strong>. Sans elle, tout le monde
          clique « résolu » et rien n'est fait sur le terrain.
        </div>

        {incident.media?.url && incident.media.type !== "video" && (
          <>
            <div style={{ fontSize: 11, fontWeight: 700, color: "#94a3b8", marginBottom: 5, textTransform: "uppercase", letterSpacing: 0.5 }}>Avant</div>
            <img src={incident.media.url} alt="avant" style={{ width: "100%", height: 130, objectFit: "cover", borderRadius: 12, marginBottom: 14 }} />
          </>
        )}

        <div style={{ fontSize: 11, fontWeight: 700, color: "#16a34a", marginBottom: 5, textTransform: "uppercase", letterSpacing: 0.5 }}>Après</div>
        <label style={{
          display: "block", textAlign: "center", padding: "14px", borderRadius: 12,
          border: "2px dashed #16a34a", background: "#f0fdf4", color: "#16a34a",
          fontSize: 12.5, fontWeight: 800, cursor: "pointer", marginBottom: 12,
        }}>
          <FontAwesomeIcon icon={faCamera} style={{ marginRight: 6 }} />
          {apercu ? "Reprendre la photo" : "Prendre la photo sur place"}
          <input type="file" accept="image/*" capture="environment" onChange={choisir} style={{ display: "none" }} />
        </label>

        {envoi && <div style={{ textAlign: "center", fontSize: 12, color: "#16a34a", fontWeight: 700, marginBottom: 10 }}>Envoi…</div>}
        {apercu && !envoi && (
          <img src={apercu} alt="après" style={{ width: "100%", height: 150, objectFit: "cover", borderRadius: 12, marginBottom: 12 }} />
        )}
        {erreur && (
          <div style={{ background: "#fef2f2", border: "1.5px solid #fecaca", color: "#b91c1c", borderRadius: 11, padding: "10px 12px", fontSize: 12, marginBottom: 12 }}>{erreur}</div>
        )}

        <button disabled={!preuve || envoi} onClick={() => onValider(preuve)} style={{
          width: "100%", padding: "13px", borderRadius: 12, border: "none",
          fontSize: 13.5, fontWeight: 800,
          cursor: !preuve ? "not-allowed" : "pointer",
          background: !preuve ? "#e2e8f0" : "linear-gradient(135deg, #16a34a, #15803d)",
          color: !preuve ? "#94a3b8" : "white",
        }}>
          <FontAwesomeIcon icon={faCheck} style={{ marginRight: 6 }} />Confirmer la résolution
        </button>
      </div>
    </div>
  );
}

// ── Petits éléments partagés ──────────────────────────────────────────────
function Filtres({ filtreCommune, setFiltreCommune, filtreType, setFiltreType, filtreStatut, setFiltreStatut, nb, estBureau }) {
  const sel = {
    flex: 1, minWidth: 130, padding: "9px 12px", borderRadius: 12,
    border: "1.5px solid #e2e8f0", fontSize: 12, color: "#0f172a",
    background: "white", outline: "none", fontWeight: 600,
  };
  const actif = filtreCommune || filtreType || filtreStatut;

  return (
    <div style={{ marginBottom: 14 }}>
      <div style={{ display: "flex", gap: 8, flexWrap: "wrap", marginBottom: 8 }}>
        <select value={filtreCommune} onChange={(e) => setFiltreCommune(e.target.value)} style={sel}>
          <option value="">Toutes les communes</option>
          {COMMUNES.map((c) => <option key={c} value={c}>{c}</option>)}
        </select>
        <select value={filtreType} onChange={(e) => setFiltreType(e.target.value)} style={sel}>
          <option value="">Toutes les natures</option>
          {Object.entries(CATEGORIES).map(([k, c]) => <option key={k} value={k}>{c.libelle}</option>)}
        </select>
        <select value={filtreStatut} onChange={(e) => setFiltreStatut(e.target.value)} style={sel}>
          <option value="">Tous les statuts</option>
          {Object.entries(STATUTS).map(([k, s]) => <option key={k} value={k}>{s.libelle}</option>)}
        </select>
        {actif && (
          <button onClick={() => { setFiltreCommune(""); setFiltreType(""); setFiltreStatut(""); }} style={{
            padding: "9px 12px", borderRadius: 12, border: "1.5px solid #e2e8f0",
            background: "white", color: "#64748b", cursor: "pointer",
          }}><FontAwesomeIcon icon={faXmark} /></button>
        )}
      </div>
      <div style={{ fontSize: 12, color: "#94a3b8", fontWeight: 600 }}>
        {nb} signalement{nb > 1 ? "s" : ""}{estBureau ? "" : ""}
      </div>
    </div>
  );
}

const PuceStatut = ({ i }) => {
  const st = statut(i.statut);
  return (
    <span style={{
      fontSize: 10, fontWeight: 800, padding: "3px 9px", borderRadius: 20,
      background: st.fond, color: st.couleur, border: `1px solid ${st.bordure}`,
    }}>{st.libelle}</span>
  );
};

const Tuile = ({ libelle, valeur, couleur, icone }) => (
  <div style={{ background: "white", borderRadius: 16, padding: "15px 14px", boxShadow: "0 2px 8px rgba(0,0,0,0.06)" }}>
    <div style={{ fontSize: 19, color: couleur }}><FontAwesomeIcon icon={icone} /></div>
    <div style={{ fontSize: 25, fontWeight: 900, color: couleur, lineHeight: 1.1, marginTop: 4 }}>{valeur}</div>
    <div style={{ fontSize: 11, color: "#64748b", fontWeight: 600, marginTop: 3 }}>{libelle}</div>
  </div>
);

const Bloc = ({ titre, icone, children }) => (
  <div style={{ background: "white", borderRadius: 16, padding: 16, marginBottom: 16, boxShadow: "0 2px 12px rgba(0,0,0,0.07)" }}>
    <div style={{ fontSize: 13, fontWeight: 800, color: "#0f172a", marginBottom: 14 }}>
      <FontAwesomeIcon icon={icone} style={{ marginRight: 6 }} />{titre}
    </div>
    {children}
  </div>
);

const Vide = ({ children }) => (
  <div style={{ fontSize: 12, color: "#94a3b8", textAlign: "center", padding: "14px 0" }}>{children}</div>
);

const Rang = ({ n, bon }) => (
  <div style={{
    width: 24, height: 24, borderRadius: 8, color: "white", fontSize: 11, fontWeight: 800,
    display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0,
    background: bon ? "linear-gradient(135deg, #16a34a, #15803d)" : "linear-gradient(135deg, #94a3b8, #64748b)",
  }}>{n}</div>
);
