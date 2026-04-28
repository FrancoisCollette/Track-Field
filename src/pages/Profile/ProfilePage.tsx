// Page de profil utilisateur
// Permet de modifier : prénom/nom, rôles, discipline, mot de passe

import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "../../hooks/useAuth";
import { supabase } from "../../lib/supabase";
import {
  ArrowLeft,
  User,
  Users,
  PersonStanding,
  Lock,
  Save,
  CheckCircle,
  Trash2,
  Mail,
  Search,
  UserCheck,
} from "lucide-react";
import DisciplinePicker from "../../components/DisciplinePicker";
import BirthYearInput from "../../components/BirthYearInput";
import { BIRTH_YEAR_MIN, BIRTH_YEAR_MAX } from "../../lib/ageCategory";
import "./ProfilePage.css";

// Reprend les mêmes types que RegisterPage
type Role = "coach" | "athlete";

interface ProfileData {
  firstName: string;
  lastName: string;
  roles: Role[];
  disciplines: string[];
  birthYear: number | null;
  strava_athlete_id: string | null;
}

export default function ProfilePage() {
  const { user } = useAuth();
  const navigate = useNavigate();

  // Données du profil chargées depuis la DB
  const [profile, setProfile] = useState<ProfileData>({
    firstName: "",
    lastName: "",
    roles: ["athlete"],
    disciplines: [],
    birthYear: null,
    strava_athlete_id: null,
  });

  // Champs mot de passe — séparés du profil car envoyés différemment
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");

  // Confirmation de suppression — on demande à l'utilisateur de confirmer la suppression de son compte sur la Database
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [deleting, setDeleting] = useState(false);

  // États UI
  const [loading, setLoading] = useState(true); // chargement initial
  const [saving, setSaving] = useState(false); // sauvegarde en cours
  const [passwordSaving, setPasswordSaving] = useState(false);
  const [successMsg, setSuccessMsg] = useState(""); // message de succès
  const [errors, setErrors] = useState<Record<string, string | undefined>>({});
  const [showEmailForm, setShowEmailForm] = useState(false);
  const [newEmail, setNewEmail] = useState("");
  const [emailSaving, setEmailSaving] = useState(false);
  // ---- États pour la section coach ----
  const [currentCoach, setCurrentCoach] = useState<{
    id: string;
    first_name: string;
    last_name: string;
    status: string;
  } | null>(null); // Coach actuellement lié à l'athlète (relation acceptée ou en attente)
  const [coaches, setCoaches] = useState<
    { id: string; first_name: string; last_name: string }[]
  >([]); // Liste de tous les coachs disponibles
  const [coachSearch, setCoachSearch] = useState(""); // Recherche dans la liste
  const [selectedCoachId, setSelectedCoachId] = useState<string | null>(null); // Coach sélectionné dans la liste (pas encore sauvegardé)
  const [showCoachPicker, setShowCoachPicker] = useState(false); // Affichage du panneau de changement de coach
  const [loadingCoaches, setLoadingCoaches] = useState(false); // Chargement de la liste des coachs
  const [savingCoach, setSavingCoach] = useState(false); // Sauvegarde du nouveau coach en cours

  // Lien pour se connecter à Strava (utilise les variables d'environnement pour le client ID et le redirect URI)
  const clientID = import.meta.env.VITE_STRAVA_CLIENT_ID;
  const redirectURI = encodeURIComponent(
    import.meta.env.VITE_STRAVA_REDIRECT_URI,
  );
  const scope = "read,activity:read_all"; // Autorisations nécessaires
  const stravaAuthUrl = `https://www.strava.com/oauth/authorize?client_id=${clientID}&redirect_uri=${redirectURI}&response_type=code&scope=${scope}&approval_prompt=force`;

  // ----------------------------------------------------------
  // Chargement du profil depuis Supabase au montage du composant
  // ----------------------------------------------------------
  useEffect(() => {
    if (!user) return;

    const fetchProfile = async () => {
      // get_my_profile() utilise auth.uid() côté SQL — pas de risque
      // de problème de format sur le tableau roles
      const { data: profileData, error } = await supabase.rpc("get_my_profile");

      if (error) {
        console.error("Erreur chargement profil:", error);
      } else {
        const data = profileData?.[0];
        if (data) {
          setProfile({
            firstName: data.first_name ?? "",
            lastName: data.last_name ?? "",
            roles: data.roles ?? ["athlete"],
            disciplines: data.discipline ?? [],
            birthYear: data.birth_year ?? null,
            strava_athlete_id: data.strava_athlete_id ?? null,
          });
        }
      }
      setLoading(false);

      // Charge la relation coach de l'athlète si applicable
      // On le fait ici pour avoir le profil (rôles) déjà chargé
      const fetchCurrentCoach = async () => {
        // Récupère la relation active (pending ou accepted) la plus récente
        const { data: rel } = await supabase
          .from("coach_athlete_relationships")
          .select("id, status, coach_id")
          .eq("athlete_id", user.id)
          .in("status", ["pending", "accepted"])
          .order("updated_at", { ascending: false })
          .limit(1)
          .maybeSingle();

        if (!rel) return;

        // Récupère le profil du coach séparément (RLS autorise grâce
        // à la politique "Lecture profils liés" qu'on a créée)
        const { data: coachProfile } = await supabase
          .from("profiles")
          .select("id, first_name, last_name")
          .eq("id", rel.coach_id)
          .single();

        if (coachProfile) {
          setCurrentCoach({
            id: coachProfile.id,
            first_name: coachProfile.first_name,
            last_name: coachProfile.last_name,
            status: rel.status,
          });
        }
      };

      fetchCurrentCoach();
    };

    fetchProfile();
  }, [user?.id]); // se relance si user change

  // Charge la liste des coachs disponibles quand le picker s'ouvre
  const fetchCoaches = async () => {
    setLoadingCoaches(true);
    try {
      const { data, error } = await supabase.rpc("get_coaches");
      if (error) {
        console.error("Erreur chargement coachs :", error);
        return;
      }
      setCoaches(data ?? []);
    } finally {
      setLoadingCoaches(false);
    }
  };

  // Sauvegarde la nouvelle relation coach/athlète
  const handleSaveCoach = async () => {
    // Vérifie que le coach sélectionné est différent du coach actuel
    if (selectedCoachId === currentCoach?.id) {
      setErrors({ general: "Ce coach est déjà ton coach actuel !" });
      return;
    }

    setSavingCoach(true);

    // Supprime toute relation existante en attente ou acceptée
    // avant d'en créer une nouvelle
    await supabase
      .from("coach_athlete_relationships")
      .delete()
      .eq("athlete_id", user!.id)
      .in("status", ["pending", "accepted"]);

    if (selectedCoachId) {
      // Crée la nouvelle demande
      const { error } = await supabase
        .from("coach_athlete_relationships")
        .insert({
          coach_id: selectedCoachId,
          athlete_id: user!.id,
          status: "pending",
        });

      if (error) {
        setErrors({
          general: "Erreur lors du changement de coach : " + error.message,
        });
        setSavingCoach(false);
        return;
      }

      // Met à jour l'affichage local sans recharger la page
      const newCoach = coaches.find((c) => c.id === selectedCoachId);
      if (newCoach) {
        setCurrentCoach({ ...newCoach, status: "pending" });
      }
    } else {
      // L'athlète a choisi "sans coach"
      setCurrentCoach(null);
    }

    setSavingCoach(false);
    setShowCoachPicker(false);
    setSelectedCoachId(null);
    setCoachSearch("");
    showSuccess(
      selectedCoachId ? "Demande envoyée au coach !" : "Coach retiré",
    );
  };

  // Liste filtrée selon la recherche
  const filteredCoaches = coaches.filter((c) =>
    `${c.first_name} ${c.last_name}`
      .toLowerCase()
      .includes(coachSearch.toLowerCase()),
  );

  // ----------------------------------------------------------
  // Changement d'email via Supabase Auth
  // Supabase envoie un mail de confirmation à la nouvelle adresse
  // ----------------------------------------------------------
  const handleSaveEmail = async () => {
    const newErrors: Record<string, string> = {};
    if (!newEmail.includes("@")) newErrors.email = "Email invalide";
    if (newEmail === user?.email)
      newErrors.email = "C'est déjà ton adresse email";
    if (Object.keys(newErrors).length > 0) {
      setErrors(newErrors);
      return;
    }

    setEmailSaving(true);
    setErrors({});

    // Supabase Auth envoie un mail de confirmation
    // profiles.email sera synchronisé automatiquement après confirmation
    const { error } = await supabase.auth.updateUser({ email: newEmail }); //new_email est un champ Supabase qui stocke le nouvel email en attente de confirmation
    console.log("updateUser error:", error);

    // Vérifie aussi la session actuelle
    const {
      data: { user: currentUser },
    } = await supabase.auth.getUser();
    console.log(
      "User après updateUser: \n",
      "ancien mail : ",
      currentUser?.email,
      "nouveau mail en attente de confirmation : ",
      currentUser?.new_email,
    );

    setEmailSaving(false);

    if (error) {
      setErrors({ email: error.message });
      return;
    }

    setNewEmail("");
    setShowEmailForm(false);
    showSuccess("Email de confirmation envoyé à " + newEmail);
  };

  // ----------------------------------------------------------
  // Sauvegarde des données personnelles + rôles + discipline
  // ----------------------------------------------------------
  const handleSaveProfile = async () => {
    // Validation simple
    const newErrors: Record<string, string> = {};
    if (!profile.firstName.trim()) newErrors.firstName = "Prénom requis";
    if (!profile.lastName.trim()) newErrors.lastName = "Nom requis";
    if (!profile.disciplines) newErrors.discipline = "Choisis une discipline";
    if (Object.keys(newErrors).length > 0) {
      setErrors(newErrors);
      return;
    }
    if (!profile.birthYear) {
      newErrors.birthYear = "Année de naissance requise";
    } else if (
      profile.birthYear < BIRTH_YEAR_MIN ||
      profile.birthYear > BIRTH_YEAR_MAX
    ) {
      newErrors.birthYear = `Année entre ${BIRTH_YEAR_MIN} et ${BIRTH_YEAR_MAX}`;
    }

    setSaving(true);
    setErrors({});

    const { error } = await supabase
      .from("profiles")
      .update({
        first_name: profile.firstName,
        last_name: profile.lastName,
        roles: profile.roles,
        discipline: profile.disciplines,
        birth_year: profile.birthYear,
      })
      .eq("id", user!.id);

    setSaving(false);

    if (error) {
      setErrors({ general: error.message });
    } else {
      showSuccess("Profil mis à jour !");
    }
  };

  // ----------------------------------------------------------
  // Changement de mot de passe via Supabase Auth
  // ----------------------------------------------------------
  const handleSavePassword = async () => {
    const newErrors: Record<string, string> = {};
    if (newPassword.length < 8) newErrors.newPassword = "8 caractères minimum";
    if (newPassword !== confirmPassword)
      newErrors.confirmPassword = "Les mots de passe ne correspondent pas";
    if (Object.keys(newErrors).length > 0) {
      setErrors(newErrors);
      return;
    }

    setPasswordSaving(true);
    setErrors({});

    // updateUser met à jour l'utilisateur dans Supabase Auth directement
    const { error } = await supabase.auth.updateUser({ password: newPassword });

    setPasswordSaving(false);

    if (error) {
      setErrors({ password: error.message });
    } else {
      setNewPassword("");
      setConfirmPassword("");
      showSuccess("Mot de passe mis à jour !");
    }
  };

  // ----------------------------------------------------------
  // Suppression du compte — supprime auth + profil (CASCADE)
  // ----------------------------------------------------------
  const handleDeleteAccount = async () => {
    setDeleting(true);

    // Supabase ne permet pas à un utilisateur de se supprimer lui-même
    // via le client JS — on passe par une fonction RPC qu'on va créer
    const { error } = await supabase.rpc("delete_own_account");

    if (error) {
      setErrors({
        general: "Erreur lors de la suppression : " + error.message,
      });
      setDeleting(false);
      setShowDeleteConfirm(false);
      return;
    }

    // Pas besoin de signOut() pour se déconnecter — delete_own_account() supprime le compte
    // dans auth.users ce qui invalide la session automatiquement. Ensuite redirection vers login
    navigate("/login");
  };

  // Toggle rôle — même logique que RegisterPage
  const handleRoleToggle = (role: Role) => {
    setProfile((prev) => {
      const already = prev.roles.includes(role);
      if (already && prev.roles.length === 1) return prev;
      return {
        ...prev,
        roles: already
          ? prev.roles.filter((r) => r !== role)
          : [...prev.roles, role],
      };
    });
  };

  // Affiche un message de succès pendant 3 secondes
  const showSuccess = (msg: string) => {
    setSuccessMsg(msg);
    setTimeout(() => setSuccessMsg(""), 7000); // 7 secondes d'affichage pour laisser le temps de lire le message
  };

  // ----------------------------------------------------------
  // Affichage pendant le chargement
  // ----------------------------------------------------------
  if (loading) {
    return (
      <div className="profile-loading">
        <p>Chargement du profil...</p>
      </div>
    );
  }

  return (
    <div className="profile-page">
      {/* ---- Header ---- */}
      <header className="profile-header">
        <button
          className="profile-back-btn"
          onClick={() => navigate("/dashboard")}
        >
          <ArrowLeft size={20} />
          Retour
        </button>
        <span className="profile-header-title">Mon profil</span>
        <div style={{ width: 80 }} /> {/* spacer pour centrer le titre */}
      </header>

      <main className="profile-main">
        {/* Message de succès global */}
        {successMsg && (
          <div className="profile-success">
            <CheckCircle size={16} />
            {successMsg}
          </div>
        )}

        {/* Bouton sauvegarde — en dehors du cadre, centré */}
        <div className="profile-save-wrap">
          <button
            className="profile-save-btn-main"
            onClick={handleSaveProfile}
            disabled={saving}
          >
            <Save size={18} />
            {saving ? "Sauvegarde..." : "Sauvegarder le profil"}
          </button>
        </div>

        {/* ---- Section : Informations personnelles ---- */}
        <section className="profile-section">
          <div className="profile-section-header">
            <User size={20} className="profile-section-icon" />
            <h2>Informations personnelles</h2>
          </div>

          <div className="profile-row">
            <div className="profile-field">
              <label className="profile-label">Prénom</label>
              <input
                type="text"
                className={`profile-input ${errors.firstName ? "input-error" : ""}`}
                value={profile.firstName}
                onChange={(e) =>
                  setProfile((p) => ({ ...p, firstName: e.target.value }))
                }
              />
              {errors.firstName && (
                <span className="profile-error">{errors.firstName}</span>
              )}
            </div>

            <div className="profile-field">
              <label className="profile-label">Nom</label>
              <input
                type="text"
                className={`profile-input ${errors.lastName ? "input-error" : ""}`}
                value={profile.lastName}
                onChange={(e) =>
                  setProfile((p) => ({ ...p, lastName: e.target.value }))
                }
              />
              {errors.lastName && (
                <span className="profile-error">{errors.lastName}</span>
              )}
            </div>
          </div>

          {/* Email — affiché mais non modifiable (géré par Supabase Auth) */}
          <div className="profile-field">
            <label className="profile-label">Email</label>
            <input
              type="email"
              className="profile-input profile-input--readonly"
              value={user?.email ?? ""}
              readOnly
            />
            <span className="profile-field-hint">
              Adresse email actuellement associée à ton compte
            </span>

            {/* Bouton pour afficher/masquer le formulaire de changement */}
            <button
              type="button"
              className="profile-save-btn"
              onClick={() => {
                setShowEmailForm((prev) => !prev);
                setNewEmail("");
                setErrors((prev) => ({ ...prev, email: "" }));
              }}
            >
              <Mail size={16} />
              {showEmailForm ? "Annuler" : "Changer d'adresse email"}
            </button>

            {/* Formulaire de changement — affiché conditionnellement */}
            {showEmailForm && (
              <div className="profile-email-form">
                <input
                  type="email"
                  className={`profile-input ${errors.email ? "input-error" : ""}`}
                  placeholder="nouvelle@adresse.com"
                  value={newEmail}
                  onChange={(e) => {
                    setNewEmail(e.target.value);
                    setErrors((prev) => ({ ...prev, email: "" }));
                  }}
                />
                {errors.email && (
                  <span className="profile-error">{errors.email}</span>
                )}
                <button
                  type="button"
                  className="profile-save-btn"
                  onClick={handleSaveEmail}
                  disabled={emailSaving}
                >
                  <Save size={16} />
                  {emailSaving ? "Envoi..." : "Envoyer le lien de confirmation"}
                </button>
              </div>
            )}
          </div>
        </section>

        {/* Section Strava Dynamique */}
        <section className="profile-section">
          <div className="profile-section-header">
            <img
              src="https://upload.wikimedia.org/wikipedia/commons/c/cb/Strava_Logo.svg"
              alt="Strava"
              style={{ width: 80, height: 30, marginRight: 10 }}
            />
            <h2>Connexion Strava</h2>
          </div>

          <p
            className="profile-field-hint"
            style={{ marginBottom: "12px", fontSize: "14px" }}
          >
            {profile?.strava_athlete_id
              ? "Ton compte est actuellement synchronisé avec Strava."
              : "Connecte ton compte Strava pour synchroniser automatiquement tes activités."}
          </p>

          {profile?.strava_athlete_id ? (
            <div className="strava-status-container">
              <div className="strava-connected-badge">
                <CheckCircle size={16} color="#4bb543" />
                <span>Déjà connecté (ID: {profile.strava_athlete_id})</span>
              </div>

              <a href={stravaAuthUrl} className="strava-reconnect-link">
                Changer de compte Strava
              </a>
            </div>
          ) : (
            <a href={stravaAuthUrl} className="strava-connect-btn">
              Connecter avec Strava
            </a>
          )}
        </section>

        {/* ---- Section : Rôle & Discipline ---- */}
        <section className="profile-section">
          <div className="profile-section-header">
            <Users size={20} className="profile-section-icon" />
            <h2>Rôle &amp; Disciplines</h2>
          </div>

          <div className="profile-field">
            <label className="profile-label">
              Tu es...{" "}
              <span className="profile-field-hint">(choix multiple)</span>
            </label>
            <div className="profile-toggle-group">
              <button
                type="button"
                className={`profile-toggle ${profile.roles.includes("coach") ? "active" : ""}`}
                onClick={() => handleRoleToggle("coach")}
              >
                <Users size={18} /> Coach
              </button>
              <button
                type="button"
                className={`profile-toggle ${profile.roles.includes("athlete") ? "active" : ""}`}
                onClick={() => handleRoleToggle("athlete")}
              >
                <PersonStanding size={18} /> Athlète
              </button>
            </div>
            <br />
          </div>

          {/* ---- Année de naissance ---- */}
          <div className="profile-field">
            <label className="profile-label">
              Année de naissance{" "}
              <span className="profile-field-hint">
                (Détermine ta catégorie LBFA)
              </span>
            </label>
            <BirthYearInput
              value={profile.birthYear}
              onChange={(birthYear) => {
                setProfile((p) => ({ ...p, birthYear }));
                setErrors((prev) => ({ ...prev, birthYear: undefined }));
              }}
              error={errors.birthYear}
            />
            <br />
          </div>

          {/* ---- Disciplines ---- */}
          <div className="profile-field">
            <label className="profile-label">
              Disciplines{" "}
              <span className="profile-field-hint">(choix multiple)</span>
            </label>
            <DisciplinePicker
              selected={profile.disciplines}
              onChange={(disciplines) => {
                setProfile((p) => ({ ...p, disciplines }));
                setErrors((prev) => ({ ...prev, disciplines: undefined }));
              }}
              error={errors.disciplines}
            />
            <br />
          </div>

          {/* ---- Section coach — visible uniquement si rôle athlète ---- */}
          {profile.roles.includes("athlete") && (
            <div className="profile-field">
              <label className="profile-label">Ton coach</label>

              {/* Affichage du coach actuel */}
              {currentCoach ? (
                <div className="profile-coach-current">
                  <span className="profile-coach-avatar">
                    {currentCoach.first_name[0]}
                    {currentCoach.last_name[0]}
                  </span>
                  <div className="profile-coach-info">
                    <span className="profile-coach-name">
                      {currentCoach.first_name} {currentCoach.last_name}
                    </span>
                    <span
                      className={`profile-coach-status profile-coach-status--${currentCoach.status}`}
                    >
                      {currentCoach.status === "accepted"
                        ? "✓ Accepté"
                        : "⏳ En attente de confirmation"}
                    </span>
                  </div>
                </div>
              ) : (
                <p className="profile-coach-none">Aucun coach pour l'instant</p>
              )}

              {/* Bouton pour ouvrir/fermer le picker */}
              <button
                type="button"
                className="profile-save-btn"
                onClick={() => {
                  if (!showCoachPicker) fetchCoaches(); // charge la liste à l'ouverture
                  setShowCoachPicker((prev) => !prev);
                  setSelectedCoachId(null);
                  setCoachSearch("");
                }}
              >
                <Users size={16} />
                {showCoachPicker
                  ? "Annuler"
                  : currentCoach
                    ? "Changer de coach"
                    : "Choisir un coach"}
              </button>

              {/* Picker — identique au RegisterPage */}
              {showCoachPicker && (
                <div className="profile-coach-picker">
                  {/* Barre de recherche */}
                  <div className="register-coach-search-wrap">
                    <Search size={15} className="register-coach-search-icon" />
                    <input
                      type="text"
                      className="register-input register-coach-search-input"
                      placeholder="Recherche par nom..."
                      value={coachSearch}
                      onChange={(e) => setCoachSearch(e.target.value)}
                    />
                  </div>

                  {/* Liste */}
                  <div className="register-coach-list">
                    {/* Option sans coach */}
                    <button
                      type="button"
                      className={`register-coach-item ${selectedCoachId === null ? "active" : ""}`}
                      onClick={() => {
                        setSelectedCoachId(null);
                        setErrors({}); // efface l'erreur dès qu'une nouvelle sélection est faite
                      }}
                    >
                      <UserCheck size={16} />
                      <span>Sans coach pour l'instant</span>
                      {selectedCoachId === null && (
                        <span className="register-coach-check">✓</span>
                      )}
                    </button>

                    {loadingCoaches ? (
                      <p className="register-coach-loading">
                        Chargement des coachs...
                      </p>
                    ) : filteredCoaches.length === 0 && coachSearch ? (
                      <p className="register-coach-empty">
                        Aucun coach trouvé pour "{coachSearch}"
                      </p>
                    ) : (
                      filteredCoaches.map((coach) => (
                        <button
                          key={coach.id}
                          type="button"
                          className={`register-coach-item ${selectedCoachId === coach.id ? "active" : ""}`}
                          onClick={() => {
                            setSelectedCoachId(coach.id);
                            setErrors({}); // efface l'erreur dès qu'une nouvelle sélection est faite
                          }}
                        >
                          <span className="register-coach-avatar">
                            {coach.first_name[0]}
                            {coach.last_name[0]}
                          </span>
                          <span>
                            {coach.first_name} {coach.last_name}
                          </span>
                          {selectedCoachId === coach.id && (
                            <span className="register-coach-check">✓</span>
                          )}
                        </button>
                      ))
                    )}
                  </div>

                  {/* Bouton de confirmation */}
                  <button
                    type="button"
                    className="profile-save-btn-main"
                    onClick={handleSaveCoach}
                    disabled={savingCoach}
                    style={{ marginTop: "12px", width: "100%" }}
                  >
                    <Save size={16} />
                    {savingCoach ? "Sauvegarde..." : "Confirmer le changement"}
                  </button>
                </div>
              )}
            </div>
          )}

          {errors.general && (
            <p className="profile-error-general">{errors.general}</p>
          )}
        </section>

        {/* ---- Section : Mot de passe ---- */}
        <section className="profile-section">
          <div className="profile-section-header">
            <Lock size={20} className="profile-section-icon" />
            <h2>Changer le mot de passe</h2>
          </div>

          {/* Entoure les inputs dans un form pour satisfaire les navigateurs */}
          <form
            onSubmit={(e) => {
              e.preventDefault();
              handleSavePassword();
            }}
          >
            {/* Champ username caché — requis par les navigateurs pour les gestionnaires de mots de passe */}
            <input
              type="text"
              name="username"
              autoComplete="username"
              value={user?.email ?? ""}
              readOnly
              style={{ display: "none" }}
            />
            <div className="profile-row">
              <div className="profile-field">
                <label className="profile-label">Nouveau mot de passe</label>
                <input
                  type="password"
                  name="new-password"
                  autoComplete="new-password"
                  className={`profile-input ${errors.newPassword ? "input-error" : ""}`}
                  placeholder="8 caractères minimum"
                  value={newPassword}
                  onChange={(e) => setNewPassword(e.target.value)}
                />
                {errors.newPassword && (
                  <span className="profile-error">{errors.newPassword}</span>
                )}
              </div>

              <div className="profile-field">
                <label className="profile-label">Confirmation</label>
                <input
                  type="password"
                  name="new-password"
                  autoComplete="new-password"
                  className={`profile-input ${errors.confirmPassword ? "input-error" : ""}`}
                  placeholder="Répète le mot de passe"
                  value={confirmPassword}
                  onChange={(e) => setConfirmPassword(e.target.value)}
                />
                {errors.confirmPassword && (
                  <span className="profile-error">
                    {errors.confirmPassword}
                  </span>
                )}
              </div>
            </div>

            {errors.password && (
              <p className="profile-error-general">{errors.password}</p>
            )}

            <button
              className="profile-save-btn"
              onClick={handleSavePassword}
              disabled={passwordSaving}
            >
              <Lock size={16} />
              {passwordSaving ? "Mise à jour..." : "Changer le mot de passe"}
            </button>
          </form>
        </section>

        {/* ---- Section : Supprimer le compte ---- */}
        <section className="profile-section profile-section--danger">
          <div className="profile-section-header">
            <Trash2 size={20} className="profile-section-icon--danger" />
            <h2 className="profile-section-title--danger">
              Supprimer le compte
            </h2>
          </div>

          <p className="profile-delete-warning">
            Cette action est <strong>irréversible</strong> — toutes tes données
            (profil, entraînements, activités) seront définitivement supprimées.
          </p>

          {/* Affiche soit le bouton initial, soit la confirmation */}
          {!showDeleteConfirm ? (
            <button
              className="profile-delete-btn"
              onClick={() => setShowDeleteConfirm(true)}
            >
              <Trash2 size={16} />
              Supprimer mon compte
            </button>
          ) : (
            <div className="profile-delete-confirm">
              <p className="profile-delete-confirm-text">
                Es-tu vraiment sûr ? Cette action ne peut pas être annulée.
              </p>
              <div className="profile-delete-confirm-actions">
                {/* Annuler */}
                <button
                  className="profile-delete-cancel-btn"
                  onClick={() => setShowDeleteConfirm(false)}
                  disabled={deleting}
                >
                  Annuler
                </button>
                {/* Confirmer la suppression */}
                <button
                  className="profile-delete-confirm-btn"
                  onClick={handleDeleteAccount}
                  disabled={deleting}
                >
                  <Trash2 size={16} />
                  {deleting
                    ? "Suppression..."
                    : "Oui, supprimer définitivement"}
                </button>
              </div>
            </div>
          )}
        </section>
      </main>
    </div>
  );
}
