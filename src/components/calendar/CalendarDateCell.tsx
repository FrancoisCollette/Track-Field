// ============================================================
// CalendarDateCell.tsx
// Cellule de date sticky à gauche dans la grille.
// Affiche : numéro du jour, nom du jour, mois si 1er du mois.
// Props :
//   - date     : objet Date
//   - todayRef : ref à attacher si c'est aujourd'hui (pour scroll auto)
//   - compact  : version réduite pour mobile
// ============================================================

import React from 'react';
import './calendar-shared.css';

// Jours et mois en français
const JOURS = ['Dim', 'Lun', 'Mar', 'Mer', 'Jeu', 'Ven', 'Sam'];
const MOIS  = ['Jan','Fév','Mar','Avr','Mai','Jun','Jul','Aoû','Sep','Oct','Nov','Déc'];

interface CalendarDateCellProps {
  date: Date;
  todayRef?: React.RefObject<HTMLTableCellElement>;
  compact?: boolean;
}

const CalendarDateCell: React.FC<CalendarDateCellProps> = ({ date, todayRef, compact }) => {
  const today     = new Date();
  const isToday   = date.toDateString() === today.toDateString();
  const isPast    = date < today && !isToday;
  const isSunday  = date.getDay() === 0;
  const isFirst   = date.getDate() === 1; // 1er du mois → on affiche le mois

  // Construction des classes CSS
  const classes = [
    'cal-date-cell',
    isToday  ? 'cal-date-cell--today'  : '',
    isPast   ? 'cal-date-cell--past'   : '',
    isSunday ? 'cal-date-cell--sunday' : '',
  ].filter(Boolean).join(' ');

  return (
    <td
      className={classes}
      // On attache la ref sur la cellule du jour actuel
      ref={isToday ? todayRef : undefined}
    >
      {/* Numéro du jour */}
      <div className="cal-date-cell__day-num">
        {date.getDate()}
      </div>

      {/* Nom du jour abrégé */}
      {!compact && (
        <div className="cal-date-cell__day-name">
          {JOURS[date.getDay()]}
        </div>
      )}

      {/* Mois — affiché seulement le 1er du mois */}
      {isFirst && (
        <div className="cal-date-cell__month">
          {MOIS[date.getMonth()]}
        </div>
      )}

      {/* Point "aujourd'hui" */}
      {isToday && (
        <div style={{
          width: 4, height: 4,
          borderRadius: '50%',
          background: '#cbf498',
          margin: '3px auto 0',
        }} />
      )}
    </td>
  );
};

export default CalendarDateCell;
