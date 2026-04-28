// src/components/BirthYearInput.tsx
// Champ année de naissance avec affichage de la catégorie LBFA calculée
// Réutilisé dans RegisterPage et ProfilePage

import { getAgeCategory, BIRTH_YEAR_MIN, BIRTH_YEAR_MAX } from '../lib/ageCategory'
import './BirthYearInput.css'

interface Props {
  value:    number | null               // année sélectionnée, null si vide
  onChange: (year: number | null) => void
  error?:   string
}

export default function BirthYearInput({ value, onChange, error }: Props) {

  // Calcule la catégorie si une année valide est saisie
  const category = value && value >= BIRTH_YEAR_MIN && value <= BIRTH_YEAR_MAX
    ? getAgeCategory(value)
    : null

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const raw = e.target.value
    if (raw === '') {
      onChange(null)
      return
    }
    const parsed = parseInt(raw, 10)
    // N'appelle onChange que si c'est un nombre valide
    if (!isNaN(parsed)) onChange(parsed)
  }

  return (
    <div className="birth-year-wrap">
      <input
        type="number"
        className={`birth-year-input ${error ? 'birth-year-input--error' : ''}`}
        placeholder="ex: 2001"
        value={value ?? ''}
        onChange={handleChange}
        min={BIRTH_YEAR_MIN}
        max={BIRTH_YEAR_MAX}
      />

      {/* Catégorie calculée — s'affiche dès qu'une année valide est saisie */}
      {category && (
        <div className="birth-year-category">
          <span className="birth-year-category-label">{category.label}</span>
          <span className="birth-year-category-badge">{category.code}</span>
        </div>
      )}

      {/* Message si l'année est hors limites */}
      {value && (value < BIRTH_YEAR_MIN || value > BIRTH_YEAR_MAX) && (
        <p className="birth-year-hint">
          Ton année de naissance doit être comprise entre {BIRTH_YEAR_MIN} et {BIRTH_YEAR_MAX}
        </p>
      )}

      {error && <span className="register-error">{error}</span>}
    </div>
  )
}