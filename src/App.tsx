// Routeur principal de l'application
// BrowserRouter gère l'historique de navigation (URL du navigateur)
// ProtectedRoute redirige vers /login si l'utilisateur n'est pas connecté

import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom";
import { useAuth } from "./hooks/useAuth";
import LoginPage from "./pages/Login_Register/LoginPage";
import RegisterPage from "./pages/Login_Register/RegisterPage";
import EmailConfirmedPage from "./pages/Profile/EmailConfirmedPage";
import ResetPasswordPage from "./pages/Profile/ResetPasswordPage";
import Dashboard from "./pages/Dashboard/Dashboard";
import ProfilePage from "./pages/Profile/ProfilePage";
//import EditCalendarCoach from "./pages/Calendar/EditCalendarCoach";
//import EditPersonalCalendarCoach from "./pages/Calendar/EditPersonalCalendarCoach";
import ActivityUpload from "./pages/Activity/ActivityUpload";
import StravaCallback from "./pages/Strava/StravaCallback";
import ActivityList from "./pages/Activity/ActivityList";

// ==============================================================
// Composant ProtectedRoute
// Enveloppe les pages qui nécessitent d'être connecté
// Si pas connecté → redirige vers /login
// Si loading → affiche rien le temps de vérifier la session
// ==============================================================
function ProtectedRoute({ children }: { children: React.ReactNode }) {
  const { user, loading } = useAuth();

  if (loading) return null; // ou un spinner plus tard

  // "replace" évite que /login apparaisse dans l'historique
  if (!user) return <Navigate to="/login" replace />;

  return <>{children}</>;
}

function App() {
  return (
    <BrowserRouter>
      <Routes>
        {/* Routes publiques — accessibles sans être connecté */}
        <Route path="/login" element={<LoginPage />} />
        <Route path="/register" element={<RegisterPage />} />
        <Route path="/email-confirmed" element={<EmailConfirmedPage />} />
        <Route path="/reset-password" element={<ResetPasswordPage />} />

        {/* Route par défaut — redirige / vers /dashboard pour l'instant */}
        <Route path="/" element={<Navigate to="/dashboard" replace />} />

        {/* Routes protégées — redirigent vers /login si non connecté */}
        <Route
          path="/dashboard"
          element={
            <ProtectedRoute>
              <Dashboard />
            </ProtectedRoute>
          }
        />
        <Route
          path="/profile"
          element={
            <ProtectedRoute>
              <ProfilePage />
            </ProtectedRoute>
          }
        />

        {/* 
        <Route path="/coach/calendar" element={<EditCalendarCoach />} />
        <Route
          path="/coach/calendar/personal"
          element={<EditPersonalCalendarCoach />}
        /> */}
        <Route
          path="/activity/upload"
          element={
            <ProtectedRoute>
              <ActivityUpload />
            </ProtectedRoute>
          }
        />
        <Route
          path="/activity/list"
          element={
            <ProtectedRoute>
              <ActivityList />
            </ProtectedRoute>
          }
        />
        <Route path="/strava-callback" element={<StravaCallback />} />
        {/* 404 — page non trouvée */}
        <Route path="*" element={<Navigate to="/dashboard" replace />} />
      </Routes>
    </BrowserRouter>
  );
}

export default App;
