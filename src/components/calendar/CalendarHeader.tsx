// ============================================================
// CalendarHeader.tsx
// Header vert partagé pour toutes les pages calendrier.
// Props :
//   - title       : titre affiché au centre
//   - onBack      : callback bouton retour
//   - backLabel   : texte du bouton retour (défaut: "Dashboard")
//   - children    : slot pour les actions à droite (boutons, etc.)
// ============================================================

import React from 'react';
import { ArrowLeft } from 'lucide-react';
import './calendar-shared.css';

interface CalendarHeaderProps {
  title: string;
  onBack: () => void;
  backLabel?: string;
  children?: React.ReactNode;
}

const CalendarHeader: React.FC<CalendarHeaderProps> = ({
  title,
  onBack,
  backLabel = 'Dashboard',
  children,
}) => {
  return (
    <header className="cal-header">
      {/* Bouton retour — colonne gauche */}
      <button className="cal-header__back" onClick={onBack}>
        <ArrowLeft size={16} />
        <span>{backLabel}</span>
      </button>

      {/* Titre centré absolument (indépendant des colonnes) */}
      <h1 className="cal-header__title">{title}</h1>

      {/* Actions droite — colonne droite */}
      <div className="cal-header__actions">
        {children}
      </div>
    </header>
  );
};

export default CalendarHeader;
