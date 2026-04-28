// EmailConfirmedPage.tsx
// Page affichée après confirmation de l'email
// L'utilisateur arrive ici via le lien dans le mail Supabase
// Si un coach était en attente (stocké dans localStorage), la relation est créée ici

import { useEffect, useState } from "react";
import { supabase } from "../../lib/supabase";
import { useNavigate } from "react-router-dom";
import { CheckCircle } from "lucide-react";
import "./EmailConfirmedPage.css";

export default function EmailConfirmedPage() {
  const navigate = useNavigate();

  // 'loading' pendant qu'on vérifie la session et qu'on crée la relation
  // 'done'    quand tout est prêt — on affiche la carte et le bouton
  // 'error'   si la session est absente (lien invalide ou expiré)
  const [status, setStatus] = useState<"loading" | "done" | "error">("loading");

  useEffect(() => {
    const handleConfirmation = async () => {
      // Supabase crée automatiquement la session quand l'utilisateur
      // clique sur le lien de confirmation — on la récupère ici
      const {
        data: { session },
      } = await supabase.auth.getSession();

      if (!session) {
        // Pas de session = lien invalide, expiré, ou déjà utilisé
        setStatus("error");
        return;
      }

      // Vérifie si un coach était sélectionné pendant l'inscription
      const pendingCoachId = localStorage.getItem("pending_coach_id");

      if (pendingCoachId) {
        const { error } = await supabase
          .from("coach_athlete_relationships")
          .insert({
            coach_id: pendingCoachId,
            athlete_id: session.user.id,
            status: "pending", // le coach devra valider la demande
          });

        if (error) {
          // On log mais on ne bloque pas — l'utilisateur pourra
          // choisir son coach depuis son profil plus tard
          console.error("Erreur création relation coach :", error);
        }

        // Nettoyage dans tous les cas pour éviter une re-tentative
        // si l'utilisateur revient sur cette page
        localStorage.removeItem("pending_coach_id");
      }

      setStatus("done");
    };

    handleConfirmation();
  }, []); // s'exécute une seule fois au montage du composant

  // ----------------------------------------------------------------
  // Rendu selon le statut
  // ----------------------------------------------------------------

  // Pendant la vérification de session + création de la relation
  if (status === "loading") {
    return (
      <div className="confirmed-page">
        <div className="confirmed-logo">
          <span className="confirmed-logo-text">TRACK & FIELD</span>
        </div>
        <div className="confirmed-card">
          <p className="confirmed-sub">Finalisation de ton inscription...</p>
        </div>
      </div>
    );
  }

  // Lien invalide ou expiré
  if (status === "error") {
    return (
      <div className="confirmed-page">
        <div className="confirmed-logo">
          <span className="confirmed-logo-text">TRACK & FIELD</span>
        </div>
        <div className="confirmed-card">
          <h1 className="confirmed-title">Lien invalide</h1>
          <p className="confirmed-sub">
            Ce lien de confirmation est invalide ou a déjà été utilisé.
            <br />
            Connecte-toi directement ou refais une inscription.
          </p>
          <button className="confirmed-btn" onClick={() => navigate("/login")}>
            Se connecter →
          </button>
        </div>
        <p className="confirmed-footer">© 2025 Track &amp; Field</p>
      </div>
    );
  }

  // Tout s'est bien passé — affichage normal
  return (
    <div className="confirmed-page">
      {/* Logo */}
      <div className="confirmed-logo">
        <span className="confirmed-logo-text">TRACK & FIELD</span>
      </div>

      {/* Carte centrale */}
      <div className="confirmed-card">
        <div className="confirmed-icon-wrap">
          <CheckCircle size={48} className="confirmed-icon" />
        </div>

        <h1 className="confirmed-title">Email confirmé !</h1>
        <p className="confirmed-sub">
          Ton adresse email a bien été vérifiée.
          <br />
          Tu peux maintenant accéder à ton compte.
        </p>

        <button className="confirmed-btn" onClick={() => navigate("/login")}>
          Se connecter →
        </button>
      </div>

      {/* Footer */}
      <p className="confirmed-footer">© 2025 Track &amp; Field</p>
    </div>
  );
}
