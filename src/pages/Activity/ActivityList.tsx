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
  Upload,
} from "lucide-react";
import "./ActivityList.css";
import {
  formatDuration,
  calculateAndFormatSpeed,
} from "../../lib/activityUtils";
interface ActivityRecord {
  id: string;
  title: string;
  sport: string;
  started_at: string;
  total_distance_m: number;
  moving_time_s: number;
  elevation_gain_m: number;
  avg_pace_s_per_km: number;
}

const ActivityList: React.FC = () => {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [activities, setActivities] = useState<ActivityRecord[]>([]);
  const [loading, setLoading] = useState(true);

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
          <span>Retour</span>
        </button>
        <h1 className="topbar-logo" onClick={() => navigate("/")}>
          Mes ACtivités
        </h1>
        <div className="topbar-actions">
          <UserCircle
            className="topbar-icon"
            onClick={() => navigate("/profile")}
          />
        </div>
      </header>
      <div className="manual-upload-btn-wrapper">
        <button
          className="manual-upload-btn"
          onClick={() => navigate("/activity/upload")}
        >
          <Upload size={16} style={{ marginRight: "8px" }} />
          Ajouter une activité
        </button>
      </div>
      <div className="activities-container">
        <div className="activities-list">
          {activities.map((act) => (
            <div
              key={act.id}
              className="activity-card"
              onClick={() => navigate(`/activity/${act.id}`)} // À remplacer par une page de détail d'activité plus tard
            >
              <div className="activity-header">
                <div className="activity-header-wrapper">
                  <h3 className="activity-title">{act.title}</h3>
                </div>
                <div className="activity-date">
                  <Calendar className="icon-in-stat" />

                  {new Date(act.started_at).toLocaleDateString("fr-FR", {
                    day: "numeric",
                    month: "short",
                    hour: "2-digit",
                    minute: "2-digit",
                  })}
                </div>
                <ChevronRight
                  size={20}
                  color="#ccc"
                  className="activity-chevron"
                />
              </div>

              <div className="activity-stats">
                <div className="stat-item">
                  <span className="stat-value">
                    {(act.total_distance_m / 1000).toFixed(2)} km
                  </span>
                </div>
                <div className="stat-item">
                  <span className="stat-value">
                    {formatDuration(act.moving_time_s)}
                  </span>
                  <span className="stat-label">
                    <Timer className="icon-in-stat" />
                  </span>
                </div>
                <div className="stat-item">
                  <span className="stat-value">+{act.elevation_gain_m}m</span>
                  <span className="stat-label">
                    <Mountain className="icon-in-stat" />
                  </span>
                </div>

                <div className="stat-item">
                  <span
                    className="stat-value"
                    style={{ color: "var(--color-ecstasy)" }}
                  >
                    {calculateAndFormatSpeed(
                      act.total_distance_m,
                      act.moving_time_s,
                      act.sport,
                    )}
                  </span>
                </div>
              </div>
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
