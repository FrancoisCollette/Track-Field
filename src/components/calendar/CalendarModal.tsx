// ============================================================
// CalendarModal.tsx
// Modale de création / édition d'une séance d'entraînement.
// Exporte aussi les types SessionForm et CalendarModalState.
//
// Props :
//   - state       : état de la modale (open, date, contexte…)
//   - form        : valeurs du formulaire (titre, description)
//   - saving      : booléen — requête en cours (save)
//   - deleting    : booléen — requête en cours (delete)
//   - onClose     : ferme la modale sans sauvegarder
//   - onSave      : enregistre la séance
//   - onDelete    : supprime la séance (mode édition)
//   - onFormChange: met à jour le formulaire
//   - templates   : liste de templates disponibles (optionnel)
//   - copyTargets : groupes où copier automatiquement (optionnel)
//   - autoCopy    : état du toggle copie auto
//   - onAutoCopyChange : callback toggle copie auto
// ============================================================

import React, { useEffect, useRef } from 'react';
import { X, Trash2, Save, Loader2 } from 'lucide-react';
import './calendar-shared.css';

// ── Types exportés ──────────────────────────────────────────

/** Valeurs du formulaire séance */
export type SessionForm = {
  title: string;
  description: string;
};

/** État d'ouverture de la modale */
export type CalendarModalState = {
  open: boolean;
  date: string;           // ex: "2025-06-15"
  contextLabel: string;   // ex: "1500m-3000m"
  contextColor: string;   // couleur hex du groupe
  sessionId: string | null; // null = création, string = édition
};

// ── Formattage de la date en français ──────────────────────

const JOURS_LONG = ['Dimanche','Lundi','Mardi','Mercredi','Jeudi','Vendredi','Samedi'];
const MOIS_LONG  = ['janvier','février','mars','avril','mai','juin','juillet','août','septembre','octobre','novembre','décembre'];

function formatDateFr(dateStr: string): string {
  // On parse la date sans conversion UTC (YYYY-MM-DD → locale)
  const [y, m, d] = dateStr.split('-').map(Number);
  const date = new Date(y, m - 1, d);
  return `${JOURS_LONG[date.getDay()]} ${date.getDate()} ${MOIS_LONG[date.getMonth()]} ${y}`;
}

// ── Composant ───────────────────────────────────────────────

interface CalendarModalProps {
  state: CalendarModalState;
  form: SessionForm;
  saving: boolean;
  deleting: boolean;
  onClose: () => void;
  onSave: () => void;
  onDelete: () => void;
  onFormChange: (field: keyof SessionForm, value: string) => void;
  // Templates disponibles pour ce groupe (optionnel)
  templates?: Array<{ id: string; title: string; description?: string }>;
  // Groupes cibles de la copie auto (optionnel)
  copyTargets?: string[];
  autoCopy?: boolean;
  onAutoCopyChange?: (value: boolean) => void;
}

const CalendarModal: React.FC<CalendarModalProps> = ({
  state,
  form,
  saving,
  deleting,
  onClose,
  onSave,
  onDelete,
  onFormChange,
  templates = [],
  copyTargets = [],
  autoCopy = false,
  onAutoCopyChange,
}) => {
  // Ref sur le champ titre pour auto-focus à l'ouverture
  const titleRef = useRef<HTMLInputElement>(null);

  // Auto-focus sur le titre quand la modale s'ouvre
  useEffect(() => {
    if (state.open) {
      setTimeout(() => titleRef.current?.focus(), 50);
    }
  }, [state.open]);

  // Fermeture avec Escape
  useEffect(() => {
    const handleKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    if (state.open) document.addEventListener('keydown', handleKey);
    return () => document.removeEventListener('keydown', handleKey);
  }, [state.open, onClose]);

  // Ne rien rendre si la modale est fermée
  if (!state.open) return null;

  const isEditing = state.sessionId !== null;

  return (
    <div
      className="cal-modal-overlay"
      // Clic sur l'overlay ferme la modale
      onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}
    >
      <div className="cal-modal" role="dialog" aria-modal="true">

        {/* ── Header ── */}
        <div className="cal-modal__header">
          <div className="cal-modal__context">
            {/* Pastille couleur groupe */}
            <div
              className="cal-modal__context-dot"
              style={{ background: state.contextColor }}
            />
            <div>
              <div className="cal-modal__context-label">{state.contextLabel}</div>
              <div className="cal-modal__date">{formatDateFr(state.date)}</div>
            </div>
          </div>

          {/* Bouton fermer */}
          <button className="cal-modal__close" onClick={onClose} title="Fermer">
            <X size={18} />
          </button>
        </div>

        {/* ── Templates (si disponibles) ── */}
        {templates.length > 0 && (
          <div className="cal-modal__templates">
            <div className="cal-modal__templates-title">Modèles</div>
            <div className="cal-modal__templates-list">
              {templates.map((tpl) => (
                <button
                  key={tpl.id}
                  className="cal-template-chip"
                  onClick={() => {
                    // Applique le template au formulaire
                    onFormChange('title', tpl.title);
                    if (tpl.description) onFormChange('description', tpl.description);
                  }}
                >
                  {tpl.title}
                </button>
              ))}
            </div>
          </div>
        )}

        {/* ── Corps du formulaire ── */}
        <div className="cal-modal__body">
          {/* Titre */}
          <div className="cal-field">
            <label htmlFor="cal-session-title">Titre de la séance</label>
            <input
              id="cal-session-title"
              ref={titleRef}
              type="text"
              placeholder="Ex: Interval 6×400m"
              value={form.title}
              onChange={(e) => onFormChange('title', e.target.value)}
              // Ctrl+Enter / Cmd+Enter → sauvegarder
              onKeyDown={(e) => {
                if ((e.ctrlKey || e.metaKey) && e.key === 'Enter') onSave();
              }}
            />
          </div>

          {/* Description */}
          <div className="cal-field">
            <label htmlFor="cal-session-desc">Description</label>
            <textarea
              id="cal-session-desc"
              rows={4}
              placeholder="Détails, allures, récupérations…"
              value={form.description}
              onChange={(e) => onFormChange('description', e.target.value)}
            />
          </div>

          {/* Toggle copie automatique (si des groupes cibles existent) */}
          {copyTargets.length > 0 && onAutoCopyChange && (
            <div className="cal-copy-toggle">
              <label className="cal-toggle-switch">
                <input
                  type="checkbox"
                  checked={autoCopy}
                  onChange={(e) => onAutoCopyChange(e.target.checked)}
                />
                <span className="cal-toggle-switch__track" />
              </label>
              <span className="cal-copy-toggle__label">
                Copier automatiquement vers : {copyTargets.join(', ')}
              </span>
            </div>
          )}
        </div>

        {/* ── Footer avec actions ── */}
        <div className="cal-modal__footer">
          {/* Bouton supprimer (uniquement en mode édition) */}
          <div>
            {isEditing && (
              <button
                className="cal-btn cal-btn--danger"
                onClick={onDelete}
                disabled={deleting || saving}
              >
                {deleting
                  ? <Loader2 size={14} style={{ animation: 'spin 1s linear infinite' }} />
                  : <Trash2 size={14} />
                }
                Supprimer
              </button>
            )}
          </div>

          <div className="cal-modal__footer-right">
            {/* Annuler */}
            <button
              className="cal-btn cal-btn--ghost"
              onClick={onClose}
              disabled={saving || deleting}
            >
              Annuler
            </button>

            {/* Sauvegarder */}
            <button
              className="cal-btn cal-btn--primary"
              onClick={onSave}
              disabled={saving || deleting || !form.title.trim()}
            >
              {saving
                ? <Loader2 size={14} style={{ animation: 'spin 1s linear infinite' }} />
                : <Save size={14} />
              }
              {isEditing ? 'Mettre à jour' : 'Créer'}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

// Animation du spinner (utilisée inline via style)
// On l'injecte globalement une fois via une balise <style>
const spinStyle = document.createElement('style');
spinStyle.textContent = `@keyframes spin { from { transform: rotate(0deg); } to { transform: rotate(360deg); } }`;
if (!document.head.querySelector('[data-cal-spin]')) {
  spinStyle.setAttribute('data-cal-spin', '1');
  document.head.appendChild(spinStyle);
}

export default CalendarModal;
