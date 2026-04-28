import React, { useState } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "../../hooks/useAuth";
import { useFitParser } from "../../hooks/useFitParser";
import { supabase } from "../../lib/supabase";
import {
  Upload,
  CheckCircle2,
  AlertCircle,
  ArrowLeft,
  UserCircle,
} from "lucide-react";
import "./ActivityUpload.css";

const ActivityUpload = () => {
  const navigate = useNavigate();
  const { user } = useAuth();
  const { parseFitFile, isParsing } = useFitParser();
  const WORKER_URL = import.meta.env.VITE_WORKER_URL;

  const [status, setStatus] = useState<
    "idle" | "parsing" | "uploading" | "success" | "error"
  >("idle");
  const [errorMessage, setErrorMessage] = useState("");

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || !user) return;

    try {
      setStatus("parsing");

      // 1. Parser le fichier localement pour extraire les stats ET les points (streams)
      const activityData: any = await parseFitFile(file);

      setStatus("uploading");

      // 2. Préparer l'objet JSON UNIFIÉ
      const r2Data = {
        streams: activityData.streams, // Déjà formaté par le parser
        laps: activityData.laps, // Nouveau : nos laps formatés
      };

      // 3. Envoyer l'objet JSON vers ton Worker Cloudflare
      const workerResponse = await fetch(`${WORKER_URL}/upload`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          userId: user.id,
          fileName: "manual-upload.json", // Le nom de base, le Worker rajoutera un UUID
          data: r2Data,
        }),
      });

      if (!workerResponse.ok)
        throw new Error("Échec de l'envoi vers Cloudflare");

      // On récupère la clé exacte où le fichier a été rangé sur R2
      const { key, fileName } = await workerResponse.json();

      // --- Logique de génération de titre intelligent ---
      const generateSmartTitle = (date: Date, sport: string): string => {
        const hour = date.getHours();
        let timeOfDay = "";

        if (hour >= 5 && hour < 12) timeOfDay = "le matin";
        else if (hour >= 12 && hour < 18) timeOfDay = "l'après-midi";
        else if (hour >= 18 && hour < 23) timeOfDay = "le soir";
        else timeOfDay = "nocturne";

        const sportNames: Record<string, string> = {
          running: "Course à pied",
          cycling: "Sortie vélo",
          mountain_biking: "Sortie VTT",
          trail: "Trail",
          swimming: "Natation",
          walking: "Marche",
          track_athletics: "Séance sur piste",
          strength_training: "Renforcement musculaire",
        };

        const sportName = sportNames[sport] || "Activité";

        if (timeOfDay.includes("de") || timeOfDay.includes("du")) {
          return `${sportName} ${timeOfDay}`;
        }
        return `${sportName} ${timeOfDay}`;
      };

      // --- Logique de calcul des performances (Identique au webhook) ---
      let avgPace = null;
      let avgSpeedKmh = null;
      const distanceKm = activityData.total_distance_m / 1000;
      const timeHours = activityData.moving_time_s / 3600;
      const sport = activityData.sport;

      if (distanceKm > 0.1 && timeHours > 0) {
        // Vitesse moyenne en km/h pour tout le monde (stockée en base)
        avgSpeedKmh = parseFloat((distanceKm / timeHours).toFixed(2));

        // Calcul de l'allure spécifique (Pace) selon le sport
        const average_speed_ms =
          activityData.total_distance_m / activityData.moving_time_s;

        if (["running", "trail", "track_athletics"].includes(sport)) {
          avgPace = Math.round(1000 / average_speed_ms);
        } else if (["swimming", "open_water_swimming"].includes(sport)) {
          avgPace = Math.round(100 / average_speed_ms);
        }
      }

      // 4. Enregistrer les métadonnées dans Supabase
      const { error: dbError } = await supabase.from("activities").insert({
        user_id: user.id,
        title: generateSmartTitle(new Date(activityData.started_at), sport),
        sport: sport, // Assure-toi que le parser renvoie une valeur de ton ENUM
        started_at: activityData.started_at,
        source: "fit_upload",

        // Stats de performance
        total_distance_m: Math.round(activityData.total_distance_m || 0),
        total_duration_s: Math.round(activityData.total_duration_s || 0),
        moving_time_s: Math.round(activityData.moving_time_s || 0),
        avg_heart_rate: activityData.avg_heart_rate
          ? Math.round(activityData.avg_heart_rate)
          : null,
        max_heart_rate: activityData.max_heart_rate
          ? Math.round(activityData.max_heart_rate)
          : null,
        avg_cadence: activityData.avg_cadence
          ? Math.round(activityData.avg_cadence)
          : null,
        elevation_gain_m: Math.round(activityData.elevation_gain_m || 0),
        total_descent_m: activityData.elevation_loss_m
          ? Math.round(Math.abs(activityData.elevation_loss_m))
          : 0,

        avg_pace_s_per_km: avgPace,
        avg_speed_kmh: avgSpeedKmh,

        // Référence stockage R2
        raw_file_url: key,
        raw_file_name: fileName,
      });

      if (dbError) throw dbError;

      setStatus("success");
    } catch (err: any) {
      console.error(err);
      setErrorMessage(err.message);
      setStatus("error");
    }
  };

  const isLoading = isParsing || status === "uploading";

  // ... le reste du composant (return HTML) reste strictement identique ...
  return (
    <div className="page-wrapper">
      {/* --- BANDEAU VERT --- */}
      <header className="topbar">
        <h1 className="topbar-logo" onClick={() => navigate("/")}>
          TRACK & FIELD
        </h1>
        <div className="topbar-actions">
          <UserCircle
            size={28}
            className="topbar-icon"
            onClick={() => navigate("/profile")}
          />
        </div>
      </header>

      {/* --- CONTENU DE LA PAGE --- */}
      <main className="upload-container">
        {/* Bouton de retour */}
        <div className="upload-header-actions">
          <button className="back-btn" onClick={() => navigate("/")}>
            <ArrowLeft size={20} />
            Retour au tableau de bord
          </button>
        </div>

        {/* Carte d'upload */}
        <div className="upload-card">
          <h2>Importer une activité</h2>
          <p className="upload-subtitle">
            Formats supportés : <strong>.fit</strong> (Garmin, Coros, Polar,
            ...)
          </p>

          <label className={`upload-dropzone ${isLoading ? "loading" : ""}`}>
            <input
              type="file"
              accept=".fit"
              onChange={handleFileChange}
              disabled={isLoading}
            />

            {isParsing && (
              <div className="loader-container">
                <div className="spinner"></div>
                <span>Analyse des données GPS...</span>
              </div>
            )}

            {status === "uploading" && !isParsing && (
              <div className="loader-container">
                <div className="spinner"></div>
                <span>Stockage sur le cloud...</span>
              </div>
            )}

            {status === "idle" && !isParsing && (
              <>
                <Upload size={48} />
                <span>Cliquez pour choisir un fichier .fit</span>
              </>
            )}

            {status === "success" && (
              <div className="status-message success">
                <CheckCircle2 size={48} />
                <span>Activité enregistrée avec succès !</span>
                <span>
                  Vous pouvez continuer à importer d'autres activités.
                </span>
                <Upload size={32} />
              </div>
            )}

            {status === "error" && (
              <div className="status-message error">
                <AlertCircle size={48} />
                <span>Erreur : {errorMessage}</span>
              </div>
            )}
          </label>
        </div>
      </main>
    </div>
  );
};

export default ActivityUpload;
