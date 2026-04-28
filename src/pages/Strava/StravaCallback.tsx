import { useEffect, useState } from "react";
import { useSearchParams, useNavigate } from "react-router-dom";
import { useAuth } from "../../hooks/useAuth";
import { CheckCircle2, Loader2, AlertCircle, ArrowLeft } from "lucide-react";
import "./StravaCallback.css";

// 1. Ajout d'une variable en dehors du composant pour traquer l'exécution
let isProcessing = false;

const StravaCallback = () => {
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const { user } = useAuth();
  const [status, setStatus] = useState<"loading" | "success" | "error">(
    "loading",
  );
  const WORKER_URL = import.meta.env.VITE_WORKER_URL;

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

    fetch(`${WORKER_URL}/auth/strava`, {
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
    <div className="strava-page">
      {/* Bandeau Header */}
      <header className="strava-header">
        <button onClick={() => navigate("/")} className="back-button">
          <ArrowLeft size={20} />
          <span>Accueil</span>
        </button>
        <div className="header-spacer1"></div>
        <h1 className="header-title">Connexion Strava</h1>
        <div className="header-spacer2"></div> {/* Équilibre visuel */}
      </header>

      <main className="strava-content">
        <div className="status-card">
          {status === "loading" && (
            <div className="status-item">
              <Loader2 className="spinner-icon" size={60} />
              <h2>Synchronisation...</h2>
              <p>Nous finalisons la liaison avec votre compte Strava.</p>
            </div>
          )}

          {status === "success" && (
            <div className="status-item animate-in">
              <CheckCircle2 size={70} className="success-icon" />
              <h2>C'est tout bon !</h2>
              <p>
                Tes activités Strava vont maintenant se synchroniser avec Track
                & Field.
              </p>
              <button
                className="action-btn success"
                onClick={() => navigate("/")}
              >
                Aller au Dashboard
              </button>
            </div>
          )}

          {status === "error" && (
            <div className="status-item animate-in">
              <AlertCircle size={70} className="error-icon" />
              <h2>Une erreur est survenue...</h2>
              <p>L'autorisation a été refusée ou le lien a expiré.</p>
              <button
                className="action-btn error"
                onClick={() => navigate("/profile")}
              >
                Réessayer la liaison
              </button>
            </div>
          )}
        </div>
      </main>
    </div>
  );
};

export default StravaCallback;
