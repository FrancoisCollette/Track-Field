// Page de connexion — point d'entrée de l'application
// Utilise Supabase Auth pour authentifier l'utilisateur
// Les imports Supabase sont préparés mais commentés jusqu'à l'étape suivante

import { useNavigate } from "react-router-dom";
import { useState } from "react";
import "./LoginPage.css";

import { supabase } from "../../lib/supabase";
// On importe uniquement ce dont on a besoin
// (pas toute la librairie — Vite ne bundle que les icônes utilisées)
import { Mail, Lock } from "lucide-react";

// ==============================================================
// Typage des props — pour l'instant la page ne reçoit rien,
// mais on prépare la structure pour React Router plus tard
// ==============================================================

export default function LoginPage() {
  const navigate = useNavigate(); // hook React Router pour naviguer

  // State pour les erreurs et le loading
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  const handleLogin = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setError("");
    setLoading(true);

    // Récupère les valeurs directement depuis le formulaire
    const formData = new FormData(e.currentTarget);
    const email = formData.get("email") as string;
    const password = formData.get("password") as string;

    const { error } = await supabase.auth.signInWithPassword({
      email,
      password,
    });

    if (error) {
      // Traduit les messages d'erreur Supabase en français
      setError(
        error.message === "Invalid login credentials"
          ? "Email ou mot de passe incorrect"
          : error.message,
      );
      setLoading(false);
      return;
    }

    // Connexion réussie → redirige vers le dashboard
    navigate("/dashboard");
  };

  const handleForgotPassword = async () => {
    const email = (document.getElementById("email") as HTMLInputElement)?.value;
    if (!email) {
      setError("Entre ton email d'abord");
      return;
    }

    await supabase.auth.resetPasswordForEmail(email);
    setError("");
    alert("Email de réinitialisation envoyé !");
  };

  return (
    <div className="login-page">
      {/* ---- Colonne gauche : branding ---- */}
      <div className="login-left">
        {/* Logo */}
        <div className="login-logo">
          <div className="login-logo-icon">
            {/* Icône SVG inline — pas besoin de librairie externe */}
            <svg viewBox="0 0 24 24" fill="#cbf498" width="22" height="22">
              <path d="M12 2C8.13 2 5 5.13 5 9c0 5.25 7 13 7 13s7-7.75 7-13c0-3.87-3.13-7-7-7zm0 9.5c-1.38 0-2.5-1.12-2.5-2.5s1.12-2.5 2.5-2.5 2.5 1.12 2.5 2.5-1.12 2.5-2.5 2.5z" />
            </svg>
          </div>
          <span className="login-logo-text">TRACK & FIELD</span>
        </div>

        {/* Accroche */}
        <div className="login-tagline-block">
          <h1 className="login-tagline">
            Entraîne-toi
            <br />
            avec <span>intention.</span>
          </h1>
          <p className="login-sub">
            Planification, suivi d'activités et analyse de performances pour
            athlètes et coachs.
          </p>
        </div>

        <p className="login-footer-text">© 2025 Track&Field</p>
      </div>

      {/* ---- Colonne droite : formulaire ---- */}
      <div className="login-right">
        <h2 className="login-title">Connexion</h2>
        <p className="login-hint">
          Content de te revoir — entre tes identifiants.
        </p>

        {/* 
          onSubmit sur le <form> est la bonne pratique React :
          ça capture aussi la touche Entrée du clavier automatiquement
        */}
        <form onSubmit={handleLogin} className="login-form">
          {/* Champ email */}
          <div className="login-field">
            <label className="login-label" htmlFor="email">
              Adresse email
            </label>
            <div className="login-input-wrap">
              <Mail className="login-input-icon" size={16} />
              <input
                id="email"
                name="email" /* name nécessaire pour récupérer la valeur dans handleLogin */
                type="email"
                className="login-input"
                placeholder="athlete@example.com"
                required
                autoComplete="email"
              />
            </div>
          </div>

          {/* Champ mot de passe */}
          <div className="login-field">
            <label className="login-label" htmlFor="password">
              Mot de passe
            </label>
            <div className="login-input-wrap">
              <Lock className="login-input-icon" size={16} />
              <input
                id="password"
                name="password" /* name nécessaire pour récupérer la valeur dans handleLogin */
                type="password"
                className="login-input"
                placeholder="••••••••"
                required
                autoComplete="current-password"
              />
            </div>
          </div>

          {/* 
            type="button" important ici : évite que ce bouton soumette le form
            (par défaut, tout bouton dans un form est type="submit")
          */}
          <button
            type="button"
            className="login-forgot"
            onClick={handleForgotPassword}
          >
            Mot de passe oublié ?
          </button>

          {error && <p className="login-error">{error}</p>}
          <button type="submit" className="login-btn" disabled={loading}>
            {loading ? "Connexion..." : "Se connecter →"}
          </button>
        </form>

        {/* Séparateur */}
        <div className="login-divider">
          <span className="login-divider-line" />
          <span className="login-divider-text">Pas encore inscrit ?</span>
          <span className="login-divider-line" />
        </div>

        {/* Lien vers l'inscription */}
        <p className="login-register">
          <button
            type="button"
            className="login-register-link"
            onClick={() => navigate("/register")}
          >
            Créer un compte →
          </button>
        </p>
      </div>
    </div>
  );
}
