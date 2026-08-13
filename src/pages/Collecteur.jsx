import { useState, useEffect, useMemo } from "react";
import { collection, onSnapshot, doc, updateDoc, query, where, setDoc, deleteDoc, serverTimestamp, increment } from "firebase/firestore";
import { db } from "../firebase/config";
import CarteCollecteur from "../components/CarteCollecteur";
import CarteSignalement from "../components/CarteSignalement";
import { distanceKm } from "../utils/geo";
import { useEstBureau, largeur } from "../utils/ecran";
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import {
  faLocationDot, faClock, faMap, faXmark,
  faTruck, faCheck, faBasketShopping, faCircleCheck
} from "@fortawesome/free-solid-svg-icons";

export default function Collecteur({ utilisateur, mode, onChangeMode }) {
  const estBureau = useEstBureau();
  const [disponibles, setDisponibles] = useState([]);
  const [mesCollectes, setMesCollectes] = useState([]);
  const [corbeille, setCorbeille] = useState([]);
  const [loading, setLoading] = useState(true);
  const [maPosition, setMaPosition] = useState(null);

  // Position du collecteur pour afficher la distance sur les cartes de la corbeille
  useEffect(() => {
    navigator.geolocation?.getCurrentPosition(
      (pos) => setMaPosition({ lat: pos.coords.latitude, lng: pos.coords.longitude }),
      () => {},
      { enableHighAccuracy: true, timeout: 10000 }
    );
  }, []);

  useEffect(() => {
    const q = query(collection(db, "signalements"), where("status", "==", "disponible"));
    const unsub = onSnapshot(q, (snapshot) => {
      const data = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
      data.sort((a, b) => (b.urgent ? 1 : 0) - (a.urgent ? 1 : 0));
      setDisponibles(data);
      setLoading(false);
    });
    return () => unsub();
  }, []);

  useEffect(() => {
    if (!utilisateur?.uid) return;
    const q = query(collection(db, "signalements"), where("collecteurId", "==", utilisateur.uid));
    const unsub = onSnapshot(q, (snapshot) => {
      const data = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
      data.sort((a, b) => (b.createdAt?.seconds || 0) - (a.createdAt?.seconds || 0));
      setMesCollectes(data);
    });
    return () => unsub();
  }, [utilisateur]);

  // Ma corbeille (brouillons)
  useEffect(() => {
    if (!utilisateur?.uid) return;
    const q = query(collection(db, "corbeilles"), where("collecteurId", "==", utilisateur.uid));
    const unsub = onSnapshot(q, (snapshot) => {
      const data = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
      data.sort((a, b) => (b.addedAt?.seconds || 0) - (a.addedAt?.seconds || 0));
      setCorbeille(data);
    });
    return () => unsub();
  }, [utilisateur]);

  // Nettoyage auto : retire de la corbeille les signalements pris par un autre ou supprimés
  useEffect(() => {
    if (loading) return;
    corbeille
      .filter(e => !disponibles.some(s => s.id === e.signalementId))
      .forEach(e => deleteDoc(doc(db, "corbeilles", e.id)).catch(() => {}));
  }, [loading, disponibles, corbeille]);

  // Publication de la position tant qu'une collecte est en cours (suivi par le ménage)
  const aCollecteEnCours = mesCollectes.some(s => s.status === "en cours");
  useEffect(() => {
    if (!aCollecteEnCours || !utilisateur?.uid || !navigator.geolocation) return;
    let derniereMaj = 0;
    const watchId = navigator.geolocation.watchPosition(
      (pos) => {
        const now = Date.now();
        if (now - derniereMaj < 10000) return;
        derniereMaj = now;
        setDoc(doc(db, "positions", utilisateur.uid), {
          lat: pos.coords.latitude, lng: pos.coords.longitude,
          nom: utilisateur.nom || "", updatedAt: serverTimestamp()
        }).catch(() => {});
      },
      () => {},
      { enableHighAccuracy: true, maximumAge: 5000 }
    );
    return () => navigator.geolocation.clearWatch(watchId);
  }, [aCollecteEnCours, utilisateur?.uid, utilisateur?.nom]);

  const corbeilleIds = useMemo(() => new Set(corbeille.map(e => e.signalementId)), [corbeille]);

  const ajouterCorbeille = async (s) => {
    await setDoc(doc(db, "corbeilles", `${utilisateur.uid}_${s.id}`), {
      collecteurId: utilisateur.uid, signalementId: s.id, addedAt: serverTimestamp()
    });
    updateDoc(doc(db, "signalements", s.id), { corbeillesCount: increment(1) }).catch(() => {});
  };

  const retirerCorbeille = async (signalementId) => {
    await deleteDoc(doc(db, "corbeilles", `${utilisateur.uid}_${signalementId}`));
    updateDoc(doc(db, "signalements", signalementId), { corbeillesCount: increment(-1) }).catch(() => {});
  };

  // Les notifications WhatsApp partent du serveur : on n'envoie que l'id,
  // le contenu et le destinataire sont relus depuis Firestore côté API.
  const notifier = (type, signalementId) =>
    fetch("/api/notifier-collecte", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ type, signalementId })
    }).catch((e) => console.error("Notification erreur:", e.message));

  const valider = async (s) => {
    await updateDoc(doc(db, "signalements", s.id), { status: "en cours", collecteurId: utilisateur.uid, collecteurNom: utilisateur.nom });
    await retirerCorbeille(s.id).catch(() => {});
    await notifier("acceptation", s.id);
  };

  const terminer = async (id) => {
    await updateDoc(doc(db, "signalements", id), { status: "collecté" });
    await notifier("collecte_terminee", id);
  };

  // Signalements de ma corbeille encore disponibles (joints aux brouillons)
  const corbeilleItems = corbeille
    .map(e => disponibles.find(s => s.id === e.signalementId))
    .filter(Boolean);

  if (loading) return (
    <div style={{ padding: 60, textAlign: "center", color: "#94a3b8" }}>
      <div style={{ fontSize: 32, marginBottom: 8 }}><FontAwesomeIcon icon={faClock} /></div>
      <div style={{ fontSize: 13 }}>Chargement...</div>
    </div>
  );

  return (
    // Seule la carte profite du grand écran : les listes restent en colonne.
    <div style={{ padding: "16px 16px", maxWidth: mode === "carte" ? largeur(estBureau) : 440, margin: "0 auto" }}>

      {/* Stats (hors vue carte) */}
      {mode !== "carte" && (
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 10, marginBottom: 20 }}>
          {[
            { label: "Corbeille", value: corbeilleItems.length, icon: faBasketShopping, color: "#d97706", bg: "linear-gradient(135deg, #fffbeb, #fef3c7)", border: "#fde68a" },
            { label: "En cours", value: mesCollectes.filter(s => s.status === "en cours").length, icon: faClock, color: "#16a34a", bg: "linear-gradient(135deg, #f0fdf4, #dcfce7)", border: "#bbf7d0" },
            { label: "Collectés", value: mesCollectes.filter(s => s.status === "collecté").length, icon: faCheck, color: "#3b82f6", bg: "linear-gradient(135deg, #eff6ff, #dbeafe)", border: "#bfdbfe" },
          ].map(s => (
            <div key={s.label} style={{ background: s.bg, borderRadius: 14, padding: "14px 8px", textAlign: "center", border: `1px solid ${s.border}`, boxShadow: "0 2px 8px rgba(0,0,0,0.05)" }}>
              <div style={{ fontSize: 18 }}><FontAwesomeIcon icon={s.icon} /></div>
              <div style={{ fontSize: 24, fontWeight: 900, color: s.color, lineHeight: 1.1 }}>{s.value}</div>
              <div style={{ fontSize: 10, color: "#64748b", fontWeight: 600, marginTop: 2 }}>{s.label}</div>
            </div>
          ))}
        </div>
      )}

      {/* Vue Carte */}
      {mode === "carte" && (
        <CarteCollecteur
          signalements={disponibles}
          corbeilleIds={corbeilleIds}
          onAjouter={ajouterCorbeille}
          onRetirer={retirerCorbeille}
          nbCorbeille={corbeilleItems.length}
          onVoirCorbeille={() => onChangeMode?.("corbeille")}
          utilisateur={utilisateur}
        />
      )}

      {/* Vue Corbeille (brouillons à valider) */}
      {mode === "corbeille" && (
        <div>
          {corbeilleItems.length === 0 ? (
            <div style={{ textAlign: "center", padding: 48, color: "#94a3b8" }}>
              <div style={{ fontSize: 36, marginBottom: 8 }}><FontAwesomeIcon icon={faBasketShopping} /></div>
              <div style={{ fontSize: 13, marginBottom: 16 }}>Votre corbeille est vide.<br />Ajoutez des signalements depuis la carte.</div>
              <button onClick={() => onChangeMode?.("carte")} style={{
                padding: "11px 22px", borderRadius: 12, border: "none", cursor: "pointer",
                background: "linear-gradient(135deg, #16a34a, #15803d)", color: "white",
                fontWeight: 800, fontSize: 13, boxShadow: "0 3px 10px rgba(22,163,74,0.3)"
              }}>
                <FontAwesomeIcon icon={faMap} style={{ marginRight: 6 }} />Voir la carte
              </button>
            </div>
          ) : (
            <>
              <div style={{
                background: "#fffbeb", border: "1px solid #fde68a", borderRadius: 12,
                padding: "10px 14px", marginBottom: 14, fontSize: 12, color: "#92400e", fontWeight: 600
              }}>
                <FontAwesomeIcon icon={faBasketShopping} style={{ marginRight: 6 }} />
                Ce sont des brouillons : validez pour vous engager. Le ménage sera notifié par WhatsApp.
              </div>

              {corbeilleItems.map(s => (
                <CarteSignalement key={s.id} s={s} showPhone
                  distance={maPosition && s.lat ? distanceKm(maPosition.lat, maPosition.lng, s.lat, s.lng) : null}
                  actions={
                    <div style={{ display: "flex", gap: 8 }}>
                      <button onClick={() => retirerCorbeille(s.id)} style={{
                        flex: 1, padding: "11px", cursor: "pointer", fontWeight: 700, fontSize: 12,
                        background: "white", color: "#64748b", border: "1px solid #e2e8f0", borderRadius: 12
                      }}>
                        <FontAwesomeIcon icon={faXmark} style={{ marginRight: 5 }} />Retirer
                      </button>
                      <button onClick={() => {
                        if (window.confirm("Valider cette collecte ?\n\n📍 " + s.commune + " — " + s.quartier + "\n🗑️ " + s.type + " · " + s.volume + "\n\nLe ménage sera notifié et pourra suivre votre position.")) {
                          valider(s);
                        }
                      }} style={{
                        flex: 2, padding: "11px", cursor: "pointer", fontWeight: 800, fontSize: 13,
                        background: "linear-gradient(135deg, #16a34a, #15803d)", color: "white",
                        border: "none", borderRadius: 12, boxShadow: "0 3px 10px rgba(22,163,74,0.3)"
                      }}>
                        <FontAwesomeIcon icon={faCircleCheck} style={{ marginRight: 6 }} />
                        {Number(s.prix) > 0 ? `Valider · ${Number(s.prix).toLocaleString("fr-FR")} F` : "Valider la collecte"}
                      </button>
                    </div>
                  } />
              ))}
            </>
          )}
        </div>
      )}

      {/* Vue Mes collectes */}
      {mode === "mescollectes" && (
        <div>
          {aCollecteEnCours && (
            <div style={{
              background: "#f0fdf4", border: "1px solid #bbf7d0", borderRadius: 12,
              padding: "10px 14px", marginBottom: 14, fontSize: 12, color: "#15803d", fontWeight: 600
            }}>
              <FontAwesomeIcon icon={faLocationDot} style={{ marginRight: 6 }} />
              Votre position est partagée avec les ménages en attente, jusqu'à la fin du ramassage.
            </div>
          )}

          {mesCollectes.length === 0 && (
            <div style={{ textAlign: "center", padding: 48, color: "#94a3b8" }}>
              <div style={{ fontSize: 36, marginBottom: 8 }}><FontAwesomeIcon icon={faTruck} /></div>
              <div style={{ fontSize: 13 }}>Vous n'avez pas encore de collectes</div>
            </div>
          )}

          {mesCollectes.map(s => (
            <CarteSignalement key={s.id} s={s} showPhone actions={
              s.status === "en cours" ? (
                <button onClick={() => terminer(s.id)} style={{
                  width: "100%", padding: "11px", cursor: "pointer", fontWeight: 800, fontSize: 13,
                  background: "linear-gradient(135deg, #0f2d0f, #166534)", color: "white",
                  border: "none", borderRadius: 12, boxShadow: "0 3px 10px rgba(15,45,15,0.3)"
                }}>
                  <FontAwesomeIcon icon={faCheck} style={{ marginRight: 6 }} />Marquer comme collecté
                </button>
              ) : null
            } />
          ))}
        </div>
      )}
    </div>
  );
}
