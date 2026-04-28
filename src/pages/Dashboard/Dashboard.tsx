// Page d'accueil après connexion
// Affiche un message de bienvenue personnalisé
// et un accès rapide au profil utilisateur

import { useNavigate } from "react-router-dom";
import { useState, useEffect } from "react";
import { useAuth } from "../../hooks/useAuth";
import { supabase } from "../../lib/supabase";
import { getDisciplineLabel } from "../../lib/disciplines";
import {
  UserCircle,
  LogOut,
  Timer,
  Calendar,
  Activity,
  Bell,
  Check,
  X,
  ChevronRight,
} from "lucide-react";
import "./Dashboard.css";

export default function Dashboard() {
  const { user } = useAuth();
  const navigate = useNavigate();

  // ---- Types ----
  // Représente une demande en attente reçue par un coach
  type CoachRequest = {
    id: string;
    athlete_id: string;
    first_name: string;
    last_name: string;
    discipline: string[];
  };

  // Représente le statut de la demande envoyée par un athlète
  type AthleteStatus = {
    id: string;
    coach_first_name: string;
    coach_last_name: string;
    status: "pending" | "accepted" | "rejected";
  };

  // ---- États ----
  const [notifOpen, setNotifOpen] = useState(false);
  const [coachRequests, setCoachRequests] = useState<CoachRequest[]>([]);
  const [athleteStatus, setAthleteStatus] = useState<AthleteStatus | null>(
    null,
  );
  const [notifCount, setNotifCount] = useState(0);
  const [userRoles, setUserRoles] = useState<string[]>([]);
  const [loadingNotifs, setLoadingNotifs] = useState(true);
  const [firstName, setFirstName] = useState("");

  // Charge les rôles de l'utilisateur et les notifications associées
  useEffect(() => {
    if (!user) return;

    const fetchNotifications = async () => {
      setLoadingNotifs(true);

      // Double vérification — évite les appels si user.id est absent
      if (!user?.id) {
        setLoadingNotifs(false);
        return;
      }

      // Récupère le profil complet via RPC — robuste quel que soit
      // le format de stockage des rôles dans PostgreSQL
      const { data: profileData } = await supabase.rpc("get_my_profile");
      const myProfile = profileData?.[0];

      const roles: string[] = myProfile?.roles ?? [];
      setUserRoles(roles);
      // Stocke le prénom pour l'afficher dans le message de bienvenue
      setFirstName(myProfile?.first_name ?? "");

      // ---- CAS COACH : demandes en attente ----
      if (roles.includes("coach")) {
        // Étape 1 — récupère les IDs des demandes en attente
        const { data: requests } = await supabase
          .from("coach_athlete_relationships")
          .select("id, athlete_id")
          .eq("coach_id", user.id)
          .eq("status", "pending");

        if (requests && requests.length > 0) {
          // Étape 2 — récupère les profils des athlètes séparément
          // (la nouvelle politique RLS autorise maintenant cette lecture)
          const athleteIds = requests.map((r: any) => r.athlete_id);

          const { data: athleteProfiles } = await supabase
            .from("profiles")
            .select("id, first_name, last_name, discipline")
            .in("id", athleteIds);

          if (athleteProfiles) {
            // Fusionne les deux tableaux par athlete_id
            const formatted: CoachRequest[] = requests
              .map((r: any) => {
                const p = athleteProfiles.find(
                  (ap: any) => ap.id === r.athlete_id,
                );
                if (!p) return null;
                return {
                  id: r.id,
                  athlete_id: r.athlete_id,
                  first_name: p.first_name ?? "?",
                  last_name: p.last_name ?? "?",
                  discipline: p.discipline ?? "Non renseignée",
                };
              })
              .filter(Boolean) as CoachRequest[];

            setCoachRequests(formatted);
            setNotifCount(formatted.length);
          }
        }
      }

      // ---- CAS ATHLÈTE : statut de sa demande ----
      if (roles.includes("athlete")) {
        const { data: rel } = await supabase
          .from("coach_athlete_relationships")
          .select(
            `
            id,
            status,
            profiles!coach_athlete_relationships_coach_id_fkey (
              first_name,
              last_name
            )
          `,
          )
          .eq("athlete_id", user.id)
          .in("status", ["accepted", "rejected"])
          .order("updated_at", { ascending: false })
          .limit(1)
          .maybeSingle();

        if (rel) {
          setAthleteStatus({
            id: rel.id,
            coach_first_name: (rel.profiles as any).first_name,
            coach_last_name: (rel.profiles as any).last_name,
            status: rel.status,
          });
          // Badge uniquement si la demande vient d'être traitée (refusée)
          if (rel.status === "rejected") setNotifCount((c) => c + 1);
        }
      }

      setLoadingNotifs(false);
    };

    fetchNotifications();
    // On dépend de user.id pour reloader (string stable) plutôt que de user (objet
    // qui peut être recréé à chaque render par useAuth)
  }, [user?.id]);

  // ---- Actions coach ----
  const handleCoachDecision = async (
    requestId: string,
    decision: "accepted" | "rejected",
  ) => {
    await supabase
      .from("coach_athlete_relationships")
      .update({ status: decision })
      .eq("id", requestId);

    // Retire la demande de la liste localement sans recharger
    setCoachRequests((prev) => prev.filter((r) => r.id !== requestId));
    setNotifCount((prev) => Math.max(0, prev - 1));
  };

  // ---- Action athlète : refaire une demande ----
  const handleRetryCoach = async () => {
    if (!athleteStatus) return;
    // Remet le statut en pending pour le même coach
    await supabase
      .from("coach_athlete_relationships")
      .update({ status: "pending" })
      .eq("id", athleteStatus.id);

    setAthleteStatus((prev) => (prev ? { ...prev, status: "pending" } : null));
    setNotifCount((prev) => Math.max(0, prev - 1));
  };

  // Déconnexion via Supabase Auth
  // useAuth() détectera le changement et App.tsx redirigera vers /login
  const handleLogout = async () => {
    await supabase.auth.signOut();
    navigate("/login");
  };

  return (
    <div className="dashboard">
      {/* ---- Header ---- */}
      <header className="dashboard-header">
        <div className="dashboard-logo">
          <span className="dashboard-logo-text">TRACK & FIELD</span>
        </div>

        <div className="dashboard-header-actions">
          {/* ---- Cloche notifications ---- */}
          <div style={{ position: "relative" }}>
            <button
              className="dashboard-icon-btn"
              onClick={() => setNotifOpen((o) => !o)}
              title="Notifications"
            >
              <Bell size={24} />
              {/* Badge rouge avec le nombre de notifications */}
              {notifCount > 0 && (
                <span className="dashboard-notif-badge">{notifCount}</span>
              )}
            </button>

            {/* ---- Modale notifications ---- */}
            {notifOpen && (
              <>
                {/* Overlay transparent pour fermer en cliquant ailleurs */}
                <div
                  className="dashboard-notif-overlay"
                  onClick={() => setNotifOpen(false)}
                />

                <div className="dashboard-notif-panel">
                  <p className="dashboard-notif-title">Notifications</p>

                  {loadingNotifs ? (
                    <p className="dashboard-notif-empty">Chargement...</p>
                  ) : (
                    <>
                      {/* ---- VUE COACH : demandes en attente ---- */}
                      {userRoles.includes("coach") && (
                        <>
                          {coachRequests.length === 0 ? (
                            <p className="dashboard-notif-empty">
                              Aucune demande en attente
                            </p>
                          ) : (
                            coachRequests.map((req) => (
                              <div
                                key={req.id}
                                className="dashboard-notif-item"
                              >
                                <div className="dashboard-notif-item-info">
                                  {/* Initiales */}
                                  <span className="dashboard-notif-avatar">
                                    {req.first_name[0]}
                                    {req.last_name[0]}
                                  </span>
                                  <div>
                                    <p className="dashboard-notif-name">
                                      {req.first_name} {req.last_name}
                                    </p>
                                    <p className="dashboard-notif-discipline">
                                      {Array.isArray(req.discipline)
                                        ? req.discipline
                                            .map(getDisciplineLabel)
                                            .join(", ")
                                        : getDisciplineLabel(req.discipline)}
                                    </p>
                                  </div>
                                </div>
                                {/* Boutons accepter / refuser */}
                                <div className="dashboard-notif-actions">
                                  <button
                                    className="dashboard-notif-btn dashboard-notif-btn--accept"
                                    onClick={() =>
                                      handleCoachDecision(req.id, "accepted")
                                    }
                                    title="Accepter"
                                  >
                                    <Check size={14} />
                                  </button>
                                  <button
                                    className="dashboard-notif-btn dashboard-notif-btn--reject"
                                    onClick={() =>
                                      handleCoachDecision(req.id, "rejected")
                                    }
                                    title="Refuser"
                                  >
                                    <X size={14} />
                                  </button>
                                </div>
                              </div>
                            ))
                          )}
                        </>
                      )}

                      {/* ---- VUE ATHLÈTE : statut de sa demande ---- */}
                      {userRoles.includes("athlete") && athleteStatus && (
                        <div className="dashboard-notif-item dashboard-notif-item--status">
                          <div className="dashboard-notif-item-info">
                            <span
                              className={`dashboard-notif-avatar dashboard-notif-avatar--${athleteStatus.status}`}
                            >
                              {athleteStatus.coach_first_name[0]}
                              {athleteStatus.coach_last_name[0]}
                            </span>
                            <div>
                              <p className="dashboard-notif-name">
                                {athleteStatus.coach_first_name}{" "}
                                {athleteStatus.coach_last_name}
                              </p>
                              <p
                                className={`dashboard-notif-status dashboard-notif-status--${athleteStatus.status}`}
                              >
                                {athleteStatus.status === "accepted"
                                  ? "✓ A accepté ta demande"
                                  : "✗ A refusé ta demande"}
                              </p>
                            </div>
                          </div>

                          {/* Actions selon le statut */}
                          {athleteStatus.status === "rejected" && (
                            <div className="dashboard-notif-actions dashboard-notif-actions--col">
                              <button
                                className="dashboard-notif-btn-text"
                                onClick={handleRetryCoach}
                              >
                                Réessayer
                              </button>
                              <button
                                className="dashboard-notif-btn-text dashboard-notif-btn-text--muted"
                                onClick={() => {
                                  setNotifOpen(false);
                                  navigate("/profile");
                                }}
                              >
                                Changer <ChevronRight size={12} />
                              </button>
                            </div>
                          )}
                        </div>
                      )}

                      {/* Aucune notification du tout */}
                      {!userRoles.includes("coach") && !athleteStatus && (
                        <p className="dashboard-notif-empty">
                          Aucune notification
                        </p>
                      )}
                    </>
                  )}
                </div>
              </>
            )}
          </div>

          {/* Bouton profil */}
          <button
            className="dashboard-icon-btn"
            onClick={() => navigate("/profile")}
            title="Mon profil"
          >
            <UserCircle size={28} />
          </button>

          {/* Bouton déconnexion */}
          <button
            className="dashboard-icon-btn dashboard-icon-btn--logout"
            onClick={handleLogout}
            title="Se déconnecter"
          >
            <LogOut size={24} />
          </button>
        </div>
      </header>

      {/* ---- Contenu principal ---- */}
      <main className="dashboard-main">
        {/* Message de bienvenue */}
        <section className="dashboard-welcome">
          <h1 className="dashboard-welcome-title">Bienvenue 👋</h1>
          <p className="dashboard-welcome-sub">
            {/* On affiche l'email en attendant de charger le prénom depuis le profil */}
            Content de te revoir, <strong>{firstName || user?.email}</strong> !
          </p>
        </section>

        {/* Cartes de navigation rapide — placeholders pour les futures sections */}
        <section className="dashboard-cards">
          <div
            className="dashboard-card"
            onClick={() => navigate("/")}
            style={{ cursor: "pointer" }}
          >
            <Calendar size={32} className="dashboard-card-icon" />
            <h3>Calendrier</h3>
            <p>Gérer les entraînements des groupes</p>
            {/* Badge à retirer quand réparé ! */}
            <span className="dashboard-soon-badge">
              En traveaux... j'ai tout cassé :(
            </span>
          </div>

          <div
            className="dashboard-card"
            onClick={() => navigate("/activity/list")}
            style={{ cursor: "pointer" }}
          >
            <Activity size={32} className="dashboard-card-icon" />
            <h3>Activités</h3>
            <p>Uploade et consulte tes sorties FIT/GPX</p>
          </div>

          <div className="dashboard-card dashboard-card--soon">
            <Timer size={32} className="dashboard-card-icon" />
            <h3>Calculateur</h3>
            <p>Allures, VMA et splits de course</p>
            <span className="dashboard-soon-badge">Bientôt</span>
          </div>
        </section>
      </main>
    </div>
  );
}
