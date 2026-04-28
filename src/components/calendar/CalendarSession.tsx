// ============================================================
// CalendarSession.tsx
// Bloc représentant une séance dans la grille calendrier.
// Props :
//   - session     : objet TrainingSession
//   - color       : couleur du groupe (hex)
//   - onClick     : ouvre la modale d'édition
//   - onCopy      : callback copie manuelle (optionnel)
//   - showCopyBtn : affiche le bouton copie (défaut false)
//   - readOnly    : vue athlète — pas d'édition possible
// ============================================================

import React from 'react';
import { Copy, Pencil } from 'lucide-react';
import { TrainingSession } from '../../lib/calendarUtils'; // adapte le chemin si besoin
import './calendar-shared.css';

interface CalendarSessionProps {
  session: TrainingSession;
  color?: string;
  onClick: (session: TrainingSession) => void;
  onCopy?: (session: TrainingSession, e: React.MouseEvent) => void;
  showCopyBtn?: boolean;
  readOnly?: boolean;
}

const CalendarSession: React.FC<CalendarSessionProps> = ({
  session,
  color = '#4a7f65',
  onClick,
  onCopy,
  showCopyBtn = false,
  readOnly = false,
}) => {
  return (
    <div
      className={`cal-session${readOnly ? ' cal-session--readonly' : ''}`}
      // Bordure gauche colorée = indicateur du groupe
      style={{ borderLeftColor: color }}
      onClick={() => !readOnly && onClick(session)}
      role={readOnly ? 'article' : 'button'}
      tabIndex={readOnly ? -1 : 0}
      // Accessibilité clavier
      onKeyDown={(e) => {
        if (!readOnly && (e.key === 'Enter' || e.key === ' ')) {
          e.preventDefault();
          onClick(session);
        }
      }}
    >
      {/* Titre de la séance */}
      <div className="cal-session__title">{session.title}</div>

      {/* Description (si présente) */}
      {session.description && (
        <div className="cal-session__desc">{session.description}</div>
      )}

      {/* Boutons d'action — visibles au hover (sauf readOnly) */}
      {!readOnly && (
        <div className="cal-session__actions">
          {/* Bouton copie manuelle */}
          {showCopyBtn && onCopy && (
            <button
              className="cal-session__action-btn"
              title="Copier la séance"
              onClick={(e) => { e.stopPropagation(); onCopy(session, e); }}
            >
              <Copy size={12} />
            </button>
          )}
          {/* Indicateur édition */}
          <button
            className="cal-session__action-btn"
            title="Modifier la séance"
            onClick={(e) => { e.stopPropagation(); onClick(session); }}
          >
            <Pencil size={12} />
          </button>
        </div>
      )}
    </div>
  );
};

export default CalendarSession;
