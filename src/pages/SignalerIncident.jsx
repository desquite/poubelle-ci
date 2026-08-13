// Signalement citoyen d'insalubrité : caniveau bouché, dépôt sauvage, fosse
// septique, borne endommagée.
//
// Deux garde-fous portent la crédibilité de ce qui remonte à la mairie :
//   - la capture se fait dans l'app (attribut capture), pas depuis la galerie :
//     on ne peut pas reposter une vieille photo ou une image trouvée en ligne ;
//     un import galerie est marqué « origine non vérifiée » et n'est pas publié.
//   - le GPS est relevé au moment de la prise de vue, pas à l'envoi.

import { useState } from "react";
import { collection, addDoc, doc, updateDoc, serverTimestamp, increment, arrayUnion, getDocs, query, where } from "firebase/firestore";
import { db } from "../firebase/config";
import { COMMUNES_QUARTIERS, COMMUNES, COMMUNES_COORDS } from "../quartiers";
import { distanceKm } from "../utils/geo";
import {
  CATEGORIES, categorie, incidentExistant,
  DUREE_VIDEO_MAX_S, TAILLE_MEDIA_MAX_MO, RAYON_REGROUPEMENT_M,
} from "../utils/incidents";
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import {
  faCamera, faVideo, faLocationDot, faSatelliteDish, faCheck, faCircleCheck,
  faTriangleExclamation, faClock, faXmark, faShieldHalved, faUsers,
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
  if (!d.secure_url) throw new Error(d.error?.message || "Envoi du média impossible");
  return { url: d.secure_url, type: d.resource_type === "video" ? "video" : "photo", duree: d.duration || null };
};

export default function SignalerIncident({ utilisateur, onFini }) {
  const [etape, setEtape] = useState(0);
  const [type, setType] = useState("");
  const [commune, setCommune] = useState(utilisateur?.commune || "");
  const [quartier, setQuartier] = useState(utilisateur?.quartier || "");
  const [repere, setRepere] = useState("");
  const [details, setDetails] = useState("");
  const [pos, setPos] = useState(null);
  const [gpsEnCours, setGpsEnCours] = useState(false);
  const [media, setMedia] = useState(null);
  const [apercu, setApercu] = useState(null);
  const [origineGalerie, setOrigineGalerie] = useState(false);
  const [envoiMedia, setEnvoiMedia] = useState(false);
  const [envoi, setEnvoi] = useState(false);
  const [erreur, setErreur] = useState("");
  const [doublon, setDoublon] = useState(null);
  const [resultat, setResultat] = useState(null);

  const cat = type ? categorie(type) : null;

  const inp = {
    width: "100%", padding: "12px 14px", borderRadius: 12, border: "1.5px solid #e2e8f0",
    fontSize: 13, outline: "none", boxSizing: "border-box", color: "#0f172a",
    background: "white", fontFamily: "sans-serif", marginBottom: 12,
  };
  const lbl = {
    fontSize: 11, fontWeight: 700, color: "#16a34a", display: "block",
    marginBottom: 5, textTransform: "uppercase", letterSpacing: 0.5,
  };

  const localiser = () => {
    if (!navigator.geolocation) { setErreur("GPS non disponible sur cet appareil."); return; }
    setGpsEnCours(true);
    navigator.geolocation.getCurrentPosition(
      (p) => { setPos({ lat: p.coords.latitude, lng: p.coords.longitude }); setGpsEnCours(false); setErreur(""); },
      () => { setErreur("Impossible d'obtenir votre position. Activez le GPS."); setGpsEnCours(false); },
      { enableHighAccuracy: true, timeout: 15000 }
    );
  };

  // Le GPS se relève à l'entrée dans le parcours : la position doit être celle
  // du lieu photographié, pas celle de l'endroit où on appuie sur « envoyer ».
  const choisirCategorie = (cle) => {
    setType(cle);
    setEtape(1);
    if (!pos) localiser();
  };

  const choisirMedia = (galerie) => async (e) => {
    const f = e.target.files?.[0];
    e.target.value = "";
    if (!f) return;

    if (f.size > TAILLE_MEDIA_MAX_MO * 1024 * 1024) {
      setErreur(`Fichier trop lourd (${Math.round(f.size / 1048576)} Mo). Maximum ${TAILLE_MEDIA_MAX_MO} Mo — filmez plus court.`);
      return;
    }

    if (f.type.startsWith("video/")) {
      const duree = await dureeVideo(f).catch(() => null);
      if (duree && duree > DUREE_VIDEO_MAX_S + 1) {
        setErreur(`Vidéo de ${Math.round(duree)} s. Maximum ${DUREE_VIDEO_MAX_S} s — l'essentiel suffit.`);
        return;
      }
    }

    setErreur("");
    setOrigineGalerie(galerie);
    // Le gestionnaire est recréé à chaque rendu : `apercu` est donc à jour et
    // on peut libérer l'aperçu précédent sans passer par une référence.
    if (apercu?.url) URL.revokeObjectURL(apercu.url);
    setApercu({ url: URL.createObjectURL(f), video: f.type.startsWith("video/") });
    setEnvoiMedia(true);
    try {
      setMedia(await televerser(f));
    } catch (err) {
      setErreur(err.message);
      setApercu(null);
    }
    setEnvoiMedia(false);
  };

  const dureeVideo = (fichier) =>
    new Promise((res, rej) => {
      const v = document.createElement("video");
      v.preload = "metadata";
      v.onloadedmetadata = () => { URL.revokeObjectURL(v.src); res(v.duration); };
      v.onerror = rej;
      v.src = URL.createObjectURL(fichier);
    });

  // Cohérence commune déclarée / GPS, comme au signalement de poubelle.
  const communeSuggeree = (() => {
    if (!pos || !commune) return null;
    const d = COMMUNES_COORDS[commune];
    if (!d || distanceKm(pos.lat, pos.lng, d.lat, d.lng) <= 4) return null;
    let proche = null, min = Infinity;
    Object.entries(COMMUNES_COORDS).forEach(([c, p]) => {
      const dist = distanceKm(pos.lat, pos.lng, p.lat, p.lng);
      if (dist < min) { min = dist; proche = c; }
    });
    return proche !== commune ? proche : null;
  })();

  // Avant d'envoyer, on regarde si le problème est déjà signalé tout près.
  const verifierDoublon = async () => {
    if (!pos || !type) return null;
    try {
      const snap = await getDocs(query(collection(db, "incidents"), where("type", "==", type)));
      const proches = snap.docs.map((d) => ({ id: d.id, ...d.data() }));
      return incidentExistant(proches, type, pos.lat, pos.lng);
    } catch {
      return null;
    }
  };

  const continuerVersDetails = async () => {
    const existant = await verifierDoublon();
    if (existant) { setDoublon(existant); return; }
    setEtape(2);
  };

  // Confirmer plutôt que dupliquer : un point signalé plusieurs fois monte en
  // priorité au lieu de polluer la carte.
  const confirmer = async () => {
    setEnvoi(true);
    try {
      await updateDoc(doc(db, "incidents", doublon.id), {
        confirmations: increment(1),
        confirmePar: arrayUnion(utilisateur.uid),
        derniereConfirmationAt: serverTimestamp(),
      });
      setResultat({ confirme: true, total: (doublon.confirmations || 1) + 1 });
      setEtape(3);
    } catch (e) {
      setErreur(e.message);
    }
    setEnvoi(false);
  };

  const envoyer = async () => {
    if (!type || !pos || !commune) return;
    setEnvoi(true);
    try {
      const visibilite = origineGalerie ? "restreinte" : cat.visibilite;
      await addDoc(collection(db, "incidents"), {
        type, commune, quartier: quartier || null, repere: repere || null,
        details: details || null,
        lat: pos.lat, lng: pos.lng,
        media: media || null,
        origine: origineGalerie ? "galerie" : "capture",
        visibilite,
        statut: "signale",
        confirmations: 1,
        confirmePar: [utilisateur.uid],
        uid: utilisateur.uid,
        createdAt: serverTimestamp(),
      });
      setResultat({ confirme: false, visibilite });
      setEtape(3);
    } catch (e) {
      setErreur(e.message);
    }
    setEnvoi(false);
  };

  const reinitialiser = () => {
    setEtape(0); setType(""); setRepere(""); setDetails("");
    setMedia(null); setApercu(null); setOrigineGalerie(false);
    setDoublon(null); setResultat(null); setErreur("");
  };

  // ── Étape 0 : quelle est la nature du problème ──
  if (etape === 0) return (
    <div style={{ padding: 16, maxWidth: 440, margin: "0 auto" }}>
      <div style={{
        background: "linear-gradient(135deg, #0f2d0f, #166534)", borderRadius: 20,
        padding: "24px 20px", marginBottom: 18, textAlign: "center",
      }}>
        <div style={{ fontSize: 40, color: "#a3e635", marginBottom: 10 }}>
          <FontAwesomeIcon icon={faTriangleExclamation} />
        </div>
        <h3 style={{ color: "white", fontSize: 18, fontWeight: 900, margin: "0 0 6px" }}>
          Signaler une insalubrité
        </h3>
        <p style={{ color: "#86efac", fontSize: 12.5, margin: 0, lineHeight: 1.5 }}>
          Un caniveau bouché aujourd'hui, c'est une rue inondée à la saison des pluies.
        </p>
      </div>

      <label style={lbl}>De quoi s'agit-il ?</label>
      <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
        {Object.entries(CATEGORIES).map(([cle, c]) => (
          <button key={cle} onClick={() => choisirCategorie(cle)} style={{
            display: "flex", alignItems: "center", gap: 12, textAlign: "left",
            padding: "13px 14px", borderRadius: 14, cursor: "pointer",
            border: "1.5px solid #e2e8f0", background: "white", width: "100%",
          }}>
            <span style={{
              width: 10, height: 10, borderRadius: "50%",
              background: c.couleur, flexShrink: 0,
            }} />
            <span style={{ flex: 1 }}>
              <span style={{ display: "block", fontSize: 14, fontWeight: 800, color: "#0f172a" }}>{c.libelle}</span>
              <span style={{ display: "block", fontSize: 11, color: "#94a3b8", marginTop: 1 }}>{c.description}</span>
            </span>
            {c.visibilite === "restreinte" && (
              <FontAwesomeIcon icon={faShieldHalved} style={{ color: "#dc2626", fontSize: 13 }} />
            )}
          </button>
        ))}
      </div>

      <div style={{ marginTop: 14, fontSize: 11, color: "#94a3b8", lineHeight: 1.5 }}>
        <FontAwesomeIcon icon={faShieldHalved} style={{ marginRight: 5, color: "#dc2626" }} />
        Les signalements qui visent une personne ne sont jamais publiés : ils partent
        uniquement à la police municipale.
      </div>
    </div>
  );

  // ── Étape 1 : preuve et position ──
  if (etape === 1) return (
    <div style={{ padding: 16, maxWidth: 440, margin: "0 auto" }}>
      <EnTete cat={cat} numero={1} onRetour={() => setEtape(0)} />

      {cat.visibilite === "restreinte" && (
        <Bandeau ton="alerte">
          <FontAwesomeIcon icon={faShieldHalved} style={{ marginRight: 6 }} />
          Ce signalement vise une personne : il ne sera <strong>pas publié</strong> et
          partira uniquement à la police municipale.
        </Bandeau>
      )}

      <label style={lbl}>Photo ou vidéo</label>
      <div style={{ display: "flex", gap: 8, marginBottom: 10 }}>
        <label style={{
          flex: 1, textAlign: "center", padding: "14px 10px", borderRadius: 12,
          border: "2px dashed #16a34a", background: "#f0fdf4", color: "#16a34a",
          fontSize: 12.5, fontWeight: 800, cursor: "pointer",
        }}>
          <FontAwesomeIcon icon={faCamera} style={{ marginRight: 6 }} />Photo
          <input type="file" accept="image/*" capture="environment"
            onChange={choisirMedia(false)} style={{ display: "none" }} />
        </label>
        <label style={{
          flex: 1, textAlign: "center", padding: "14px 10px", borderRadius: 12,
          border: "2px dashed #16a34a", background: "#f0fdf4", color: "#16a34a",
          fontSize: 12.5, fontWeight: 800, cursor: "pointer",
        }}>
          <FontAwesomeIcon icon={faVideo} style={{ marginRight: 6 }} />Vidéo
          <input type="file" accept="video/*" capture="environment"
            onChange={choisirMedia(false)} style={{ display: "none" }} />
        </label>
      </div>

      <div style={{ fontSize: 10.5, color: "#94a3b8", marginBottom: 12, textAlign: "center" }}>
        Vidéo de {DUREE_VIDEO_MAX_S} s maximum. La photo suffit dans la plupart des cas.
      </div>

      {envoiMedia && (
        <div style={{ textAlign: "center", color: "#16a34a", fontSize: 12, marginBottom: 12, fontWeight: 700 }}>
          <FontAwesomeIcon icon={faClock} style={{ marginRight: 6 }} />Envoi du média…
        </div>
      )}

      {apercu && !envoiMedia && (
        <div style={{ position: "relative", marginBottom: 12 }}>
          {apercu.video
            ? <video src={apercu.url} controls style={{ width: "100%", borderRadius: 12, maxHeight: 220 }} />
            : <img src={apercu.url} alt="aperçu" style={{ width: "100%", borderRadius: 12, maxHeight: 220, objectFit: "cover" }} />}
          <button onClick={() => {
            URL.revokeObjectURL(apercu.url);
            setApercu(null); setMedia(null); setOrigineGalerie(false);
          }}
            aria-label="Retirer le média" style={{
              position: "absolute", top: 8, right: 8, width: 30, height: 30,
              borderRadius: 10, border: "none", cursor: "pointer",
              background: "rgba(15,23,42,0.75)", color: "white",
            }}><FontAwesomeIcon icon={faXmark} /></button>
        </div>
      )}

      {origineGalerie && media && (
        <Bandeau ton="alerte">
          Média importé depuis la galerie : il sera marqué <strong>origine non vérifiée</strong>
          {" "}et ne sera pas affiché publiquement.
        </Bandeau>
      )}

      <details style={{ marginBottom: 14 }}>
        <summary style={{ fontSize: 11.5, color: "#64748b", cursor: "pointer" }}>
          Je ne peux pas prendre la photo maintenant
        </summary>
        <label style={{
          display: "block", marginTop: 8, textAlign: "center", padding: "10px",
          borderRadius: 10, border: "1.5px solid #e2e8f0", background: "white",
          color: "#64748b", fontSize: 12, fontWeight: 700, cursor: "pointer",
        }}>
          Importer depuis la galerie
          <input type="file" accept="image/*,video/*" onChange={choisirMedia(true)} style={{ display: "none" }} />
        </label>
      </details>

      <label style={lbl}>Position</label>
      <button onClick={localiser} disabled={gpsEnCours} style={{
        width: "100%", padding: "12px", borderRadius: 12, cursor: "pointer",
        fontWeight: 700, fontSize: 13, marginBottom: 12,
        border: pos ? "none" : "2px dashed #16a34a",
        background: pos ? "linear-gradient(135deg, #f0fdf4, #dcfce7)" : "white",
        color: "#16a34a",
      }}>
        {gpsEnCours
          ? <><FontAwesomeIcon icon={faSatelliteDish} style={{ marginRight: 6 }} />Localisation…</>
          : pos
            ? <><FontAwesomeIcon icon={faCheck} style={{ marginRight: 6 }} />Position obtenue</>
            : <><FontAwesomeIcon icon={faLocationDot} style={{ marginRight: 6 }} />Relever ma position</>}
      </button>

      <label style={lbl}>Commune</label>
      <select value={commune} onChange={(e) => { setCommune(e.target.value); setQuartier(""); }} style={inp}>
        <option value="">Choisir…</option>
        {COMMUNES.map((c) => <option key={c} value={c}>{c}</option>)}
      </select>

      {commune && (
        <>
          <label style={lbl}>Quartier</label>
          <select value={quartier} onChange={(e) => setQuartier(e.target.value)} style={inp}>
            <option value="">Choisir…</option>
            {COMMUNES_QUARTIERS[commune].map((q) => <option key={q} value={q}>{q}</option>)}
          </select>
        </>
      )}

      {communeSuggeree && (
        <Bandeau ton="alerte">
          <FontAwesomeIcon icon={faTriangleExclamation} style={{ marginRight: 6 }} />
          Votre position semble être à <strong>{communeSuggeree}</strong>.
          <button onClick={() => { setCommune(communeSuggeree); setQuartier(""); }} style={{
            marginLeft: 8, padding: "5px 11px", borderRadius: 8, border: "none",
            background: "#16a34a", color: "white", fontSize: 11, fontWeight: 800, cursor: "pointer",
          }}>Corriger</button>
        </Bandeau>
      )}

      {erreur && <Bandeau ton="erreur">{erreur}</Bandeau>}

      {doublon && (
        <Bandeau ton="info">
          <FontAwesomeIcon icon={faUsers} style={{ marginRight: 6 }} />
          Ce problème est déjà signalé à moins de {RAYON_REGROUPEMENT_M} m
          {doublon.confirmations > 1 ? ` par ${doublon.confirmations} personnes` : ""}.
          Confirmer le rend plus prioritaire pour la mairie.
          <div style={{ display: "flex", gap: 8, marginTop: 10 }}>
            <button onClick={confirmer} disabled={envoi} style={{
              flex: 2, padding: "10px", borderRadius: 10, border: "none", cursor: "pointer",
              background: "linear-gradient(135deg, #16a34a, #15803d)", color: "white",
              fontSize: 12, fontWeight: 800,
            }}>{envoi ? "…" : "Je confirme, c'est toujours là"}</button>
            <button onClick={() => { setDoublon(null); setEtape(2); }} style={{
              flex: 1, padding: "10px", borderRadius: 10, cursor: "pointer",
              border: "1.5px solid #bae6fd", background: "white", color: "#075985",
              fontSize: 12, fontWeight: 700,
            }}>C'est autre chose</button>
          </div>
        </Bandeau>
      )}

      <button onClick={continuerVersDetails} disabled={!pos || !commune || envoiMedia} style={{
        width: "100%", padding: "14px", borderRadius: 12, border: "none",
        fontSize: 13.5, fontWeight: 800,
        cursor: (!pos || !commune) ? "not-allowed" : "pointer",
        background: (!pos || !commune) ? "#e2e8f0" : "linear-gradient(135deg, #16a34a, #15803d)",
        color: (!pos || !commune) ? "#94a3b8" : "white",
      }}>Continuer →</button>
    </div>
  );

  // ── Étape 2 : précisions et envoi ──
  if (etape === 2) return (
    <div style={{ padding: 16, maxWidth: 440, margin: "0 auto" }}>
      <EnTete cat={cat} numero={2} onRetour={() => setEtape(1)} />

      <label style={lbl}>Point de repère (optionnel)</label>
      <input value={repere} onChange={(e) => setRepere(e.target.value)}
        placeholder="Ex : en face de la pharmacie" style={inp} />

      <label style={lbl}>Précisions (optionnel)</label>
      <textarea value={details} onChange={(e) => setDetails(e.target.value)} rows={4}
        placeholder="Depuis combien de temps ? Odeur, eau stagnante, passage d'enfants…"
        style={{ ...inp, resize: "none" }} />

      <div style={{
        background: "#f0fdf4", border: "1px solid #bbf7d0", borderRadius: 12,
        padding: "12px 14px", marginBottom: 14,
      }}>
        <div style={{ fontSize: 12.5, fontWeight: 800, color: "#0f172a", marginBottom: 3 }}>
          {cat.libelle}
        </div>
        <div style={{ fontSize: 11.5, color: "#16a34a", fontWeight: 700 }}>
          <FontAwesomeIcon icon={faLocationDot} style={{ marginRight: 4 }} />
          {commune}{quartier ? ` — ${quartier}` : ""}
        </div>
        <div style={{ display: "flex", gap: 6, marginTop: 7, flexWrap: "wrap" }}>
          <Puce ok>GPS</Puce>
          {media && <Puce ok>{media.type === "video" ? "Vidéo" : "Photo"}</Puce>}
          {!media && <Puce>Sans média</Puce>}
          {cat.visibilite === "restreinte" && <Puce alerte>Non public</Puce>}
        </div>
      </div>

      {erreur && <Bandeau ton="erreur">{erreur}</Bandeau>}

      <button onClick={envoyer} disabled={envoi} style={{
        width: "100%", padding: "14px", borderRadius: 12, border: "none",
        fontSize: 13.5, fontWeight: 800, cursor: "pointer",
        background: "linear-gradient(135deg, #16a34a, #15803d)", color: "white",
      }}>
        {envoi ? "Envoi…" : <><FontAwesomeIcon icon={faCheck} style={{ marginRight: 6 }} />Envoyer le signalement</>}
      </button>
    </div>
  );

  // ── Étape 3 : confirmation ──
  return (
    <div style={{ padding: 16, maxWidth: 440, margin: "0 auto" }}>
      <div style={{
        background: "linear-gradient(135deg, #0f2d0f, #166534)", borderRadius: 20,
        padding: "36px 24px", textAlign: "center",
      }}>
        <div style={{ fontSize: 52, color: "#a3e635", marginBottom: 12 }}>
          <FontAwesomeIcon icon={faCircleCheck} />
        </div>
        <h3 style={{ color: "white", fontSize: 19, fontWeight: 900, margin: "0 0 8px" }}>
          {resultat?.confirme ? "Confirmation enregistrée" : "Signalement envoyé"}
        </h3>
        <p style={{ color: "#86efac", fontSize: 12.5, margin: "0 0 22px", lineHeight: 1.55 }}>
          {resultat?.confirme
            ? `Vous êtes ${resultat.total} à signaler ce point. Il remonte en priorité pour la mairie.`
            : resultat?.visibilite === "restreinte"
              ? "Il a été transmis à la police municipale. Il n'apparaîtra pas publiquement."
              : "Il est visible de tous sur la carte, et suivi jusqu'à sa résolution."}
        </p>
        <div style={{ display: "flex", gap: 10, justifyContent: "center", flexWrap: "wrap" }}>
          <button onClick={reinitialiser} style={{
            padding: "12px 22px", background: "linear-gradient(135deg, #a3e635, #65a30d)",
            color: "#14532d", border: "none", borderRadius: 12, fontWeight: 900,
            fontSize: 13, cursor: "pointer",
          }}>Signaler autre chose</button>
          {onFini && (
            <button onClick={onFini} style={{
              padding: "12px 22px", background: "rgba(255,255,255,0.12)",
              color: "white", border: "1.5px solid rgba(255,255,255,0.25)",
              borderRadius: 12, fontWeight: 700, fontSize: 13, cursor: "pointer",
            }}>Voir la carte</button>
          )}
        </div>
      </div>
    </div>
  );
}

function Bandeau({ children, ton = "info" }) {
  const tons = {
    info: { bg: "#f0f9ff", bd: "#bae6fd", tx: "#075985" },
    alerte: { bg: "#fffbeb", bd: "#fde68a", tx: "#92400e" },
    erreur: { bg: "#fef2f2", bd: "#fecaca", tx: "#b91c1c" },
  }[ton];
  return (
    <div style={{
      background: tons.bg, border: `1.5px solid ${tons.bd}`, color: tons.tx,
      borderRadius: 12, padding: "11px 14px", fontSize: 12, fontWeight: 600,
      lineHeight: 1.5, marginBottom: 14,
    }}>{children}</div>
  );
}

function EnTete({ cat, numero, onRetour }) {
  return (
    <div style={{ display: "flex", alignItems: "center", gap: 11, marginBottom: 16 }}>
      <button onClick={onRetour} aria-label="Retour" style={{
        width: 34, height: 34, borderRadius: 11, cursor: "pointer",
        border: "1.5px solid #e2e8f0", background: "white", color: "#64748b", flexShrink: 0,
      }}>←</button>
      <div style={{ width: 10, height: 10, borderRadius: "50%", background: cat.couleur, flexShrink: 0 }} />
      <div>
        <div style={{ fontSize: 15, fontWeight: 800, color: "#0f172a" }}>{cat.libelle}</div>
        <div style={{ fontSize: 11, color: "#94a3b8" }}>Étape {numero} sur 2</div>
      </div>
    </div>
  );
}

function Puce({ children, ok, alerte }) {
  const c = alerte
    ? { bg: "#fef2f2", tx: "#dc2626" }
    : ok
      ? { bg: "#dcfce7", tx: "#16a34a" }
      : { bg: "#f1f5f9", tx: "#64748b" };
  return (
    <span style={{
      fontSize: 10, background: c.bg, color: c.tx, padding: "3px 9px",
      borderRadius: 20, fontWeight: 700,
    }}>{children}</span>
  );
}
