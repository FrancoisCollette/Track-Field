// src/components/DisciplinePicker.tsx
// Sélecteur multi-disciplines avec search bar et groupes
// Réutilisé dans RegisterPage et ProfilePage

import { useState } from 'react'
import { Search, X } from 'lucide-react'
import { DISCIPLINES, DISCIPLINE_GROUPS, getDisciplineLabel } from '../lib/disciplines'
import './DisciplinePicker.css'

interface Props {
  selected: string[]                        // disciplines déjà sélectionnées
  onChange: (disciplines: string[]) => void // callback quand la sélection change
  error?: string                            // message d'erreur éventuel
}

export default function DisciplinePicker({ selected, onChange, error }: Props) {
  const [search, setSearch] = useState('')
  const [open, setOpen]     = useState(false)

  // Filtre les disciplines selon la recherche — insensible à la casse
  const filtered = DISCIPLINES.filter(d =>
    d.label.toLowerCase().includes(search.toLowerCase()) ||
    d.group.toLowerCase().includes(search.toLowerCase())
  )

  // Groupes présents dans les résultats filtrés
  const visibleGroups = DISCIPLINE_GROUPS.filter(g =>
    filtered.some(d => d.group === g)
  )

  const toggle = (id: string) => {
    if (selected.includes(id)) {
      // Retire la discipline
      onChange(selected.filter(d => d !== id))
    } else {
      // Ajoute la discipline
      onChange([...selected, id])
    }
  }

  return (
    <div className="disc-picker">

      {/* ---- Tags des disciplines sélectionnées ---- */}
      <div className="disc-picker-tags">
        {selected.length === 0 ? (
          <span className="disc-picker-placeholder">Aucune discipline sélectionnée</span>
        ) : (
          selected.map(id => (
            <span key={id} className="disc-picker-tag">
              {getDisciplineLabel(id)}
              {/* Croix pour retirer directement depuis le tag */}
              <button
                type="button"
                className="disc-picker-tag-remove"
                onClick={() => toggle(id)}
              >
                <X size={11} />
              </button>
            </span>
          ))
        )}
      </div>

      {/* ---- Bouton pour ouvrir/fermer le dropdown ---- */}
      <button
        type="button"
        className={`disc-picker-trigger ${error ? 'disc-picker-trigger--error' : ''}`}
        onClick={() => setOpen(o => !o)}
      >
        <Search size={14} />
        {open ? 'Fermer' : 'Choisir des disciplines'}
      </button>

      {error && <span className="register-error">{error}</span>}

      {/* ---- Dropdown ---- */}
      {open && (
        <div className="disc-picker-dropdown">

          {/* Search bar */}
          <div className="disc-picker-search-wrap">
            <Search size={13} className="disc-picker-search-icon" />
            <input
              type="text"
              className="disc-picker-search-input"
              placeholder="Rechercher une discipline..."
              value={search}
              onChange={e => setSearch(e.target.value)}
              // Autofocus quand le dropdown s'ouvre
              autoFocus
            />
            {search && (
              <button
                type="button"
                className="disc-picker-search-clear"
                onClick={() => setSearch('')}
              >
                <X size={12} />
              </button>
            )}
          </div>

          {/* Liste groupée */}
          <div className="disc-picker-list">
            {visibleGroups.map(group => (
              <div key={group} className="disc-picker-group">

                {/* En-tête du groupe */}
                <p className="disc-picker-group-label">{group}</p>

                {/* Disciplines du groupe */}
                {filtered
                  .filter(d => d.group === group)
                  .map(d => (
                    <button
                      key={d.id}
                      type="button"
                      className={`disc-picker-item ${selected.includes(d.id) ? 'active' : ''}`}
                      onClick={() => toggle(d.id)}
                    >
                      {/* Checkbox visuelle */}
                      <span className="disc-picker-checkbox">
                        {selected.includes(d.id) && '✓'}
                      </span>
                      {d.label}
                    </button>
                  ))
                }
              </div>
            ))}

            {/* Aucun résultat */}
            {visibleGroups.length === 0 && (
              <p className="disc-picker-empty">
                Aucune discipline pour "{search}"
              </p>
            )}
          </div>
        </div>
      )}
    </div>
  )
}