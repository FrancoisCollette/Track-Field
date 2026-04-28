// ResetPasswordPage.tsx
// Page de réinitialisation du mot de passe
// L'utilisateur arrive ici via le lien dans le mail "reset password"
// Supabase a déjà validé le token dans l'URL — on peut directement
// appeler updateUser() pour changer le mot de passe

import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { Lock, CheckCircle } from "lucide-react";
import { supabase } from "../../lib/supabase";
import "./ResetPasswordPage.css";

export default function ResetPasswordPage() {
  const navigate = useNavigate();

  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [loading, setLoading] = useState(false);
  const [success, setSuccess] = useState(false);
  const [sessionReady, setSessionReady] = useState(false);

  // ----------------------------------------------------------
  // Lit le token dans le hash de l'URL et établit la session
  // Supabase envoie : /reset-password#access_token=xxx&type=recovery
  // ----------------------------------------------------------
  useEffect(() => {
    // Debug temporaire — on supprimera après
    console.log("Hash URL:", window.location.hash);
    console.log("Search URL:", window.location.search);

    const params = new URLSearchParams(window.location.search);
    const tokenHash = params.get("token_hash");
    const type = params.get("type");

    console.log("tokenHash:", tokenHash, "type:", type);

    if (tokenHash && type === "recovery") {
      // Échange le token contre une session active
      supabase.auth
        .verifyOtp({
          token_hash: tokenHash,
          type: "recovery",
        })
        .then(({ data, error }) => {
          console.log("verifyOtp result:", data, error);
          if (error) {
            setErrors({ general: "Lien invalide ou expiré." });
            setSessionReady(true);
          } else {
            setSessionReady(true);
          }
        });
    } else {
      navigate("/login");
    }
  }, []);

  const validate = (): boolean => {
    const newErrors: Record<string, string> = {};
    if (password.length < 10) newErrors.password = "10 caractères minimum";
    else if (!/[A-Z]/.test(password))
      newErrors.password = "Au moins une majuscule requise";
    else if (!/[0-9]/.test(password))
      newErrors.password = "Au moins un chiffre requis";
    if (password !== confirmPassword)
      newErrors.confirmPassword = "Les mots de passe ne correspondent pas";
    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!validate()) return;

    setLoading(true);
    setErrors({});

    // Supabase a automatiquement récupéré le token depuis l'URL
    // et créé une session temporaire — updateUser fonctionne directement
    const { error } = await supabase.auth.updateUser({ password });

    setLoading(false);

    if (error) {
      setErrors({ general: error.message });
      return;
    }

    // Affiche le message de succès avant de rediriger
    setSuccess(true);
    setTimeout(() => navigate("/login"), 3000);
  };

  // Écran d'attente pendant que le token est lu dans l'URL
  if (!sessionReady && !success) {
    return (
      <div className="reset-page">
        <div className="confirmed-logo">
          <span className="confirmed-logo-text">TRACK & FIELD</span>
        </div>
        <div className="confirmed-card">
          <div className="confirmed-icon-wrap">
            <Lock size={48} className="confirmed-icon" />
          </div>
          <h1 className="confirmed-title">Chargement...</h1>
          <p className="confirmed-sub">Vérification du lien en cours.</p>
        </div>
      </div>
    );
  }

  return (
    <div className="reset-page">
      {/* Logo */}
      <div className="confirmed-logo">
        <span className="confirmed-logo-text">TRACK & FIELD</span>
      </div>

      <div className="confirmed-card">
        {/* ---- État succès ---- */}
        {success ? (
          <>
            <div className="confirmed-icon-wrap">
              <CheckCircle size={48} className="confirmed-icon" />
            </div>
            <h1 className="confirmed-title">Mot de passe mis à jour !</h1>
            <p className="confirmed-sub">
              Tu vas être redirigé vers la page de connexion
              <br />
              dans quelques secondes...
            </p>
            <button
              className="confirmed-btn"
              onClick={() => navigate("/login")}
            >
              Se connecter →
            </button>
          </>
        ) : (
          /* ---- Formulaire ---- */
          <>
            <div className="confirmed-icon-wrap">
              <Lock size={48} className="confirmed-icon" />
            </div>

            <h1 className="confirmed-title">Nouveau mot de passe</h1>
            <p className="confirmed-sub">
              Choisis un mot de passe sécurisé
              <br />
              pour ton compte Track &amp; Field.
            </p>

            <form onSubmit={handleSubmit} className="reset-form">
              <div className="reset-field">
                <label className="reset-label">Nouveau mot de passe</label>
                <input
                  type="password"
                  className={`reset-input ${errors.password ? "reset-input--error" : ""}`}
                  placeholder="10 caractères min., 1 majuscule, 1 chiffre"
                  value={password}
                  onChange={(e) => {
                    setPassword(e.target.value);
                    setErrors((prev) => ({ ...prev, password: "" }));
                  }}
                />
                {errors.password && (
                  <span className="reset-error">{errors.password}</span>
                )}
              </div>

              <div className="reset-field">
                <label className="reset-label">Confirmation</label>
                <input
                  type="password"
                  className={`reset-input ${errors.confirmPassword ? "reset-input--error" : ""}`}
                  placeholder="Répète le mot de passe"
                  value={confirmPassword}
                  onChange={(e) => {
                    setConfirmPassword(e.target.value);
                    setErrors((prev) => ({ ...prev, confirmPassword: "" }));
                  }}
                />
                {errors.confirmPassword && (
                  <span className="reset-error">{errors.confirmPassword}</span>
                )}
              </div>

              {errors.general && (
                <p className="reset-error-general">{errors.general}</p>
              )}

              <button
                type="submit"
                className="confirmed-btn"
                disabled={loading}
              >
                {loading ? "Mise à jour..." : "Mettre à jour →"}
              </button>
            </form>
          </>
        )}
      </div>

      <p className="confirmed-footer">© 2025 Track &amp; Field</p>
    </div>
  );
}
