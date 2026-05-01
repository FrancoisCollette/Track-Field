// RegisterPage.tsx
// Page d'inscription — collecte toutes les infos du profil utilisateur
// en une seule étape : identité, rôle, discipline
// La logique Supabase sera branchée juste après

import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import "./RegisterPage.css";
import DisciplinePicker from "../../components/DisciplinePicker";
import BirthYearInput from "../../components/BirthYearInput";
import { BIRTH_YEAR_MIN, BIRTH_YEAR_MAX } from "../../lib/ageCategory";

// On importe uniquement ce dont on a besoin
// (pas toute la librairie — Vite ne bundle que les icônes utilisées)
import { Users, PersonStanding, Search, UserCheck } from "lucide-react";
import { supabase } from "../../lib/supabase";

// ==============================================================
// Types — on définit la forme des données du formulaire
// C'est une bonne pratique TypeScript : ça évite les fautes de
// frappe et aide l'éditeur à t'aider (autocomplétion)
// ==============================================================

type Role = "coach" | "athlete";

interface RegisterForm {
  firstName: string;
  lastName: string;
  email: string;
  password: string;
  confirmPassword: string;
  roles: Role[]; // tableau : peut contenir les deux
  disciplines: string[]; // tableau — plusieurs disciplines possibles
  birthYear: number | null; // année de naissance — null si non renseignée
}

export default function RegisterPage() {
  const navigate = useNavigate();

  // ------------------------------------------------------------
  // État du formulaire — un seul useState avec un objet
  // Avantage : une seule fonction pour mettre à jour n'importe quel champ
  // ------------------------------------------------------------
  const [form, setForm] = useState<RegisterForm>({
    firstName: "",
    lastName: "",
    email: "",
    password: "",
    confirmPassword: "",
    roles: ["athlete"], // athlète par défaut
    disciplines: [],
    birthYear: null,
  });
  // Coach sélectionné — null = pas de coach
  const [selectedCoachId, setSelectedCoachId] = useState<string | null>(null);
  // Liste des coachs disponibles chargée depuis la DB
  const [coaches, setCoaches] = useState<
    { id: string; first_name: string; last_name: string }[]
  >([]);
  // Recherche dans la liste des coachs
  const [coachSearch, setCoachSearch] = useState("");
  // Chargement de la liste des coachs
  const [loadingCoaches, setLoadingCoaches] = useState(false);

  // Pour afficher les erreurs de validation
  //const [errors, setErrors] = useState<Partial<RegisterForm & { general: string }>>({})

  // Un type dédié aux messages d'erreur — chaque clé est optionnelle et vaut une string
  type FormErrors = Partial<Record<keyof RegisterForm | "general", string>>;
  const [errors, setErrors] = useState<FormErrors>({});
  //Record<keyof RegisterForm, string>` signifie "un objet dont les clés sont les champs du formulaire et les valeurs sont des strings". `Partial` rend tout optionnel. Plus de conflit avec le type `Discipline`.

  // Pour désactiver le bouton pendant l'envoi
  const [loading, setLoading] = useState(false);

  // ------------------------------------------------------------
  // Mise à jour des champs texte simples
  // "keyof RegisterForm" = une clé valide de l'interface (TypeScript)
  // ------------------------------------------------------------
  const handleChange = (field: keyof RegisterForm, value: string) => {
    setForm((prev) => ({ ...prev, [field]: value }));
    // On efface l'erreur du champ dès que l'utilisateur retape
    setErrors((prev) => ({ ...prev, [field]: undefined }));
  };

  // ------------------------------------------------------------
  // Gestion des rôles — toggle : clic ajoute ou retire du tableau
  // ------------------------------------------------------------
  const handleRoleToggle = (role: Role) => {
    setForm((prev) => {
      const already = prev.roles.includes(role);
      if (already) {
        // On ne peut pas avoir 0 rôle — on empêche la déselection du dernier
        if (prev.roles.length === 1) return prev;
        return { ...prev, roles: prev.roles.filter((r) => r !== role) };
      }
      return { ...prev, roles: [...prev.roles, role] };
    });
  };

  // ----------------------------------------------------------
  // Charge la liste de tous les utilisateurs ayant le rôle coach
  // Se déclenche uniquement si l'utilisateur coche le rôle athlète
  // ----------------------------------------------------------
  useEffect(() => {
    // Si l'utilisateur n'est pas athlète, on ne charge pas les coachs
    if (!form.roles.includes("athlete")) return;

    const fetchCoaches = async () => {
      setLoadingCoaches(true);

      try {
        const { data, error } = await supabase.rpc("get_coaches");

        if (error) {
          console.error("Erreur chargement coachs :", error);
          setCoaches([]);
          return;
        }

        // Debug temporaire — vérifie dans la console que les données arrivent
        console.log("Coachs reçus :", data);

        setCoaches(data ?? []);
      } catch (err) {
        console.error("Erreur inattendue :", err);
        setCoaches([]);
      } finally {
        // finally garantit que le loading se termine TOUJOURS,
        // que la requête ait réussi ou échoué
        setLoadingCoaches(false);
      }
    };

    fetchCoaches();
  }, [form.roles]); // se relance si les rôles changent

  // ------------------------------------------------------------
  // Validation avant envoi
  // ------------------------------------------------------------
  const validate = (): boolean => {
    const newErrors: typeof errors = {};

    if (!form.firstName.trim()) newErrors.firstName = "Prénom requis";
    if (!form.lastName.trim()) newErrors.lastName = "Nom requis";
    if (!form.email.includes("@")) newErrors.email = "Email invalide";
    if (form.password.length < 8) newErrors.password = "8 caractères minimum";
    if (form.password !== form.confirmPassword)
      newErrors.confirmPassword = "Les mots de passe ne correspondent pas";
    if (form.disciplines.length === 0)
      newErrors.disciplines = "Choisis au moins une discipline";
    if (!form.birthYear) {
      newErrors.birthYear = "Année de naissance requise";
    } else if (
      form.birthYear < BIRTH_YEAR_MIN ||
      form.birthYear > BIRTH_YEAR_MAX
    ) {
      newErrors.birthYear = `Année entre ${BIRTH_YEAR_MIN} et ${BIRTH_YEAR_MAX}`;
    }

    setErrors(newErrors);
    // Renvoie true si aucune erreur
    return Object.keys(newErrors).length === 0;
  };

  // ------------------------------------------------------------
  // Soumission du form d'inscription
  // ------------------------------------------------------------
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!validate()) return;

    setLoading(true);

    // 1) Crée l'utilisateur dans Supabase Auth
    // On passe first_name et last_name en metadata
    // → le trigger handle_new_user() les récupère pour créer le profil
    const { error: signUpError, data } = await supabase.auth.signUp({
      email: form.email,
      password: form.password,
      options: {
        // cette ligne indique la page de destination après confirmation
        emailRedirectTo: "https://track-field-pi.vercel.app/email-confirmed",
        data: {
          first_name: form.firstName,
          last_name: form.lastName,
          roles: form.roles,
          disciplines: form.disciplines,
          birth_year: form.birthYear,
        },
      },
    });

    if (signUpError) {
      setErrors({ general: signUpError.message });
      setLoading(false);
      return;
    }

    // Si un coach a été sélectionné, crée la demande de relation
    // status 'pending' par défaut — le coach devra valider
    if (selectedCoachId && data.user) {
      localStorage.setItem("pending_coach_id", selectedCoachId);
    }

    // 2) Inscription réussie → redirige vers login
    // L'utilisateur doit confirmer son email si activé dans Supabase
    navigate("/login");
  };

  // Filtre les coachs selon la recherche — insensible à la casse
  const filteredCoaches = coaches.filter((c) =>
    `${c.first_name} ${c.last_name}`
      .toLowerCase()
      .includes(coachSearch.toLowerCase()),
  );

  return (
    <div className="register-page">
      {/* ---- Colonne gauche : branding (identique à LoginPage) ---- */}
      <div className="register-left">
        <div className="register-logo">
          <div className="register-logo-icon">
            <svg viewBox="0 0 24 24" fill="#cbf498" width="22" height="22">
              <path d="M12 2C8.13 2 5 5.13 5 9c0 5.25 7 13 7 13s7-7.75 7-13c0-3.87-3.13-7-7-7zm0 9.5c-1.38 0-2.5-1.12-2.5-2.5s1.12-2.5 2.5-2.5 2.5 1.12 2.5 2.5-1.12 2.5-2.5 2.5z" />
            </svg>
          </div>
          <span className="register-logo-text">TRACK & FIELD</span>
        </div>

        <div className="register-tagline-block">
          <h1 className="register-tagline">
            Rejoins la
            <br />
            communauté
            <br />
            <span>Track & Field.</span>
          </h1>
          <p className="register-sub">
            Crée ton profil en quelques secondes et commence à planifier tes
            entraînements dès aujourd'hui.
          </p>
        </div>

        {/* Étapes visuelles pour guider l'utilisateur */}
        <div className="register-steps">
          <div className="register-step">
            <span className="register-step-num">01</span>
            <span className="register-step-label">Crée ton compte</span>
          </div>
          <div className="register-step-line" />
          <div className="register-step">
            <span className="register-step-num">02</span>
            <span className="register-step-label">Définis ton profil</span>
          </div>
          <div className="register-step-line" />
          <div className="register-step">
            <span className="register-step-num">03</span>
            <span className="register-step-label">Commence à t'entraîner</span>
          </div>
        </div>
        <p className="register-footer-text">© 2025 Track&Field</p>
      </div>

      {/* ---- Colonne droite : formulaire ---- */}
      <div className="register-right">
        <h2 className="register-title">Créer un compte</h2>
        <p className="register-hint">
          Déjà inscrit ?{" "}
          <button
            type="button"
            className="register-login-link"
            onClick={() => navigate("/login")}
          >
            Se connecter →
          </button>
        </p>

        <form onSubmit={handleSubmit} className="register-form">
          {/* Prénom + Nom sur la même ligne */}
          <div className="register-row">
            <div className="register-field">
              <label className="register-label" htmlFor="firstName">
                Prénom
              </label>
              <input
                id="firstName"
                type="text"
                className={`register-input ${errors.firstName ? "input-error" : ""}`}
                placeholder="Marie"
                value={form.firstName}
                onChange={(e) => handleChange("firstName", e.target.value)}
              />
              {/* Affichage conditionnel de l'erreur */}
              {errors.firstName && (
                <span className="register-error">{errors.firstName}</span>
              )}
            </div>

            <div className="register-field">
              <label className="register-label" htmlFor="lastName">
                Nom
              </label>
              <input
                id="lastName"
                type="text"
                className={`register-input ${errors.lastName ? "input-error" : ""}`}
                placeholder="Dupont"
                value={form.lastName}
                onChange={(e) => handleChange("lastName", e.target.value)}
              />
              {errors.lastName && (
                <span className="register-error">{errors.lastName}</span>
              )}
            </div>
          </div>

          {/* Email */}
          <div className="register-field">
            <label className="register-label" htmlFor="reg-email">
              Adresse email
            </label>
            <input
              id="reg-email"
              type="email"
              className={`register-input ${errors.email ? "input-error" : ""}`}
              placeholder="marie@example.com"
              value={form.email}
              onChange={(e) => handleChange("email", e.target.value)}
            />
            {errors.email && (
              <span className="register-error">{errors.email}</span>
            )}
          </div>

          {/* Mot de passe */}
          <div className="register-row">
            <div className="register-field">
              <label className="register-label" htmlFor="reg-password">
                Mot de passe
              </label>
              <input
                id="reg-password"
                type="password"
                className={`register-input ${errors.password ? "input-error" : ""}`}
                placeholder="8 caractères min."
                value={form.password}
                onChange={(e) => handleChange("password", e.target.value)}
              />
              {errors.password && (
                <span className="register-error">{errors.password}</span>
              )}
            </div>

            <div className="register-field">
              <label className="register-label" htmlFor="confirmPassword">
                Confirmation
              </label>
              <input
                id="confirmPassword"
                type="password"
                className={`register-input ${errors.confirmPassword ? "input-error" : ""}`}
                placeholder="Répète le mot de passe"
                value={form.confirmPassword}
                onChange={(e) =>
                  handleChange("confirmPassword", e.target.value)
                }
              />
              {errors.confirmPassword && (
                <span className="register-error">{errors.confirmPassword}</span>
              )}
            </div>
          </div>

          {/* ---- Sélection du rôle ---- */}
          <div className="register-field">
            <label className="register-label">
              Tu es...{" "}
              <span className="register-label-optional">
                (choix multiple possible)
              </span>
            </label>
            <div className="register-toggle-group">
              {/* Bouton Coach */}
              <button
                type="button"
                className={`register-toggle ${form.roles.includes("coach") ? "active" : ""}`}
                onClick={() => handleRoleToggle("coach")}
              >
                {/* Icône lucid-react coach */}
                <Users size={18} />
                Coach
              </button>

              {/* Bouton Athlète */}
              <button
                type="button"
                className={`register-toggle ${form.roles.includes("athlete") ? "active" : ""}`}
                onClick={() => handleRoleToggle("athlete")}
              >
                {/* Icône lucid-react athlète */}
                <PersonStanding size={18} />
                Athlète
              </button>
            </div>
          </div>

          {/* ---- Année de naissance ---- */}
          <div className="register-field">
            <label className="register-label">Année de naissance</label>
            <BirthYearInput
              value={form.birthYear}
              onChange={(birthYear) => {
                setForm((prev) => ({ ...prev, birthYear }));
                setErrors((prev) => ({ ...prev, birthYear: undefined }));
              }}
              error={errors.birthYear}
            />
          </div>

          {/* ---- Sélection des disciplines ---- */}
          <div className="register-field">
            <label className="register-label">
              Disciplines{" "}
              <span className="register-label-optional">(choix multiple)</span>
            </label>
            <DisciplinePicker
              selected={form.disciplines}
              onChange={(disciplines) => {
                setForm((prev) => ({ ...prev, disciplines }));
                setErrors((prev) => ({ ...prev, disciplines: undefined }));
              }}
              error={errors.disciplines}
            />
          </div>

          {/* ---- Choix du coach — visible uniquement si rôle athlète coché ---- */}
          {form.roles.includes("athlete") && (
            <div className="register-field">
              <label className="register-label">
                Ton coach{" "}
                <span className="register-label-optional">(optionnel)</span>
              </label>

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

              <div className="register-coach-list">
                <button
                  type="button"
                  className={`register-coach-item ${selectedCoachId === null ? "active" : ""}`}
                  onClick={() => setSelectedCoachId(null)}
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
                      onClick={() => setSelectedCoachId(coach.id)}
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
            </div>
          )}

          {errors.general && (
            <p className="register-error-general">{errors.general}</p>
          )}

          {/* Bouton de soumission */}
          <button type="submit" className="register-btn" disabled={loading}>
            {/* Affichage conditionnel selon l'état loading */}
            {loading ? "Création du compte..." : "Créer mon compte →"}
          </button>
        </form>
      </div>
    </div>
  );
}
