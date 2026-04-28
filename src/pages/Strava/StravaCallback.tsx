import React, { useEffect, useState } from "react";
import { useSearchParams, useNavigate } from "react-router-dom";
import { useAuth } from "../../hooks/useAuth";
import { CheckCircle2, Loader2, AlertCircle } from "lucide-react";
//import "./StravaCallback.css"; // Optionnel pour le style

// 1. Ajout d'une variable en dehors du composant pour traquer l'exécution
let isProcessing = false;

const StravaCallback = () => {
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const { user } = useAuth();
  const [status, setStatus] = useState<"loading" | "success" | "error">(
    "loading",
  );

  useEffect(() => {
    const errorParam = searchParams.get("error"); // On récupère l'erreur éventuelle
    if (errorParam) {
      console.log(
        "L'utilisateur a annulé ou une erreur est survenue:",
        errorParam,
      );
      setStatus("error");
      isProcessing = false;
      return; // On s'arrête là
    }

    const code = searchParams.get("code");
    const scope = searchParams.get("scope");

    // On attend d'avoir le code ET le user avant de lancer l'appel au Worker
    // On vérifie si on est déjà en train de traiter ou si c'est déjà fait
    if (!code || !user || isProcessing || status === "success") return;
    isProcessing = true; // On active le verrou
    console.log("Tentative de liaison de" + user.id + "avec le code:", code);
    console.log("Scope reçu de Strava:", scope);

    fetch("https://r2-upload-api.francoiscollette07.workers.dev/auth/strava", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        code: code,
        userId: user.id,
      }),
    })
      .then(async (response) => {
        if (!response.ok) throw new Error("Échec de la liaison Strava");
        const data = await response.json();
        console.log("Réponse Worker Strava:", data);
        setStatus("success");
      })
      .catch((err) => {
        console.error("Erreur Callback:", err);
        // Si ça échoue vraiment, on permet de réessayer
        isProcessing = false;
        setStatus("error");
      });

    if (!code && !errorParam && user) {
      // Si après 2 secondes on n'a toujours rien, on bascule en erreur
      const timer = setTimeout(() => {
        if (status === "loading") setStatus("error");
      }, 3000);
      return () => clearTimeout(timer);
    }
  }, [searchParams, user, status]);

  return (
    <div className="callback-container">
      <div className="callback-card">
        {status === "loading" && (
          <>
            <Loader2 className="spinner" size={48} />
            <h2>Connexion avec Strava...</h2>
            <p>Veuillez patienter pendant que nous lions vos comptes.</p>
          </>
        )}

        {status === "success" && (
          <>
            <CheckCircle2 size={64} color="#105749" />
            <h2 style={{ color: "var(--color-eden)" }}>Connexion réussie !</h2>
            <p>Ton compte Strava est maintenant lié à Track & Field.</p>
            <button
              className="primary-btn"
              onClick={() => navigate("/")}
              style={{ marginTop: "20px" }}
            >
              Retour au Dashboard
            </button>
          </>
        )}

        {status === "error" && (
          <>
            <AlertCircle size={64} color="#650901" />
            <h2>Oups !</h2>
            <p>La liaison a échoué ou l'autorisation a été annulée.</p>
            <button
              className="primary-btn"
              onClick={() => navigate("/profile")}
              style={{ marginTop: "20px" }}
            >
              Réessayer
            </button>
          </>
        )}
      </div>
    </div>
  );
};

export default StravaCallback;
