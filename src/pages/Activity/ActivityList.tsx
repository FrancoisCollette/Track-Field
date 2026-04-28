import React, { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "../../lib/supabase";
import { useAuth } from "../../hooks/useAuth";
import {
  Timer,
  Mountain,
  Calendar,
  ChevronRight,
  UserCircle,
  ArrowLeft,
} from "lucide-react";
import "./ActivityList.css";

interface ActivityRecord {
  id: string;
  title: string;
  started_at: string;
  total_distance_m: number;
  moving_time_s: number;
  elevation_gain_m: number;
}

const ActivityList: React.FC = () => {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [activities, setActivities] = useState<ActivityRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [testResult, setTestResult] = useState<string>("");
  const WORKER_URL = "https://r2-upload-api.francoiscollette07.workers.dev";

  useEffect(() => {
    if (user) fetchActivities();
  }, [user]);

  const fetchActivities = async () => {
    if (!user) return;
    try {
      setLoading(true);
      const { data, error } = await supabase
        .from("activities")
        .select("*")
        .eq("user_id", user.id) // FILTRE : Uniquement mes activités
        .order("started_at", { ascending: false });

      if (error) throw error;
      setActivities(data || []);
    } catch (err: any) {
      console.error("Erreur Supabase:", err.message);
    } finally {
      setLoading(false);
    }
  };

  // TEST DU WORKER : Récupère le JSON complet
  const testWorkerAccess = async (activityId: string) => {
    setTestResult("Chargement du JSON via Worker...");
    try {
      const {
        data: { session },
      } = await supabase.auth.getSession();

      const response = await fetch(`${WORKER_URL}/activity/${activityId}`, {
        method: "GET",
        headers: {
          Authorization: `Bearer ${session?.access_token}`,
        },
      });

      if (!response.ok) {
        const errData = await response.json();
        throw new Error(errData.error || "Erreur Worker");
      }

      const json = await response.json();
      console.log("Données R2 reçues:", json);
      setTestResult(
        `Succès ! Reçu ${json.laps?.length || 0} tours et ${json.streams?.time?.length || 0} points GPS.`,
      );
    } catch (err: any) {
      setTestResult(`Erreur Worker : ${err.message}`);
    }
  };

  const formatPace = (m: number, s: number) => {
    if (m === 0) return "0:00";
    const pace = s / 60 / (m / 1000);
    const mins = Math.floor(pace);
    const secs = Math.round((pace - mins) * 60);
    return `${mins}:${secs.toString().padStart(2, "0")}/km`;
  };

  if (loading) return <div className="activities-container">Chargement...</div>;

  return (
    <div className="page-wrapper">
      {/* --- BANDEAU VERT --- */}
      <header className="topbar">
        <button
          className="profile-back-btn"
          onClick={() => navigate("/dashboard")}
        >
          <ArrowLeft size={20} />
          Retour
        </button>
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
      <div className="activities-container">
        <h2
          style={{
            fontFamily: "var(--font-display)",
            color: "var(--color-eden)",
          }}
        >
          Mes Activités
        </h2>

        <div
          style={{
            marginBottom: "20px",
            padding: "10px",
            background: "#eee",
            borderRadius: "8px",
          }}
        >
          <strong>Résultat du test Worker :</strong> {testResult}
        </div>

        <div className="activities-list">
          {activities.map((act) => (
            <div key={act.id} className="activity-card">
              <div className="activity-header">
                <div className="activity-header-wrapper">
                  <h3 className="activity-title">{act.title}</h3>
                  <div className="activity-date">
                    <Calendar className="icon-in-stat" />

                    {new Date(act.started_at).toLocaleDateString("fr-FR", {
                      day: "numeric",
                      month: "short",
                      hour: "2-digit",
                      minute: "2-digit",
                    })}
                  </div>
                </div>
                <ChevronRight size={20} color="#ccc" />
              </div>

              <div className="activity-stats">
                <div className="stat-item">
                  <span className="stat-value">
                    {(act.total_distance_m / 1000).toFixed(2)} km
                  </span>
                </div>
                <div className="stat-item">
                  <span className="stat-label">
                    <Timer className="icon-in-stat" />
                  </span>
                  <span className="stat-value">
                    {Math.floor(act.moving_time_s / 60)}:
                    {(act.moving_time_s % 60).toString().padStart(2, "0")}
                  </span>
                </div>
                <div className="stat-item">
                  <span className="stat-label">
                    <Mountain className="icon-in-stat" />
                  </span>
                  <span className="stat-value">+{act.elevation_gain_m}m</span>
                </div>
                <div className="stat-item">
                  <span
                    className="stat-value"
                    style={{ color: "var(--color-ecstasy)" }}
                  >
                    {formatPace(act.total_distance_m, act.moving_time_s)}
                  </span>
                </div>
              </div>
              <button
                onClick={() => testWorkerAccess(act.id)}
                style={{
                  marginTop: "10px",
                  padding: "8px 12px",
                  cursor: "pointer",
                  background: "#105749",
                  color: "white",
                  border: "none",
                  borderRadius: "4px",
                }}
              >
                Tester accès JSON (R2)
              </button>
            </div>
          ))}

          {activities.length === 0 && (
            <p style={{ textAlign: "center", color: "#666" }}>
              Aucune activité pour le moment.
            </p>
          )}
        </div>
      </div>
    </div>
  );
};

export default ActivityList;
