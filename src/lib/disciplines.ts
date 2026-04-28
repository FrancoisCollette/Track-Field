// src/lib/disciplines.ts
// Liste centralisée des disciplines athlétisme
// Utilisée dans RegisterPage, ProfilePage et l'affichage des notifications

export type Discipline = {
  id: string    // valeur stockée en base
  label: string // valeur affichée à l'utilisateur
  group: string // groupe pour organiser la liste
}

export const DISCIPLINES: Discipline[] = [
  // ---- Sprints ----
  { id: 'sprint_100',   label: '100m',         group: 'Sprint' },
  { id: 'sprint_200',   label: '200m',         group: 'Sprint' },
  { id: 'sprint_400',   label: '400m',         group: 'Sprint' },
  { id: 'hurdles_100',  label: '100m haies',   group: 'Sprint' },
  { id: 'hurdles_110',  label: '110m haies',   group: 'Sprint' },
  { id: 'hurdles_400',  label: '400m haies',   group: 'Sprint' },
  { id: 'relay_4x100',  label: '4x100m',       group: 'Sprint' },
  { id: 'relay_4x400',  label: '4x400m',       group: 'Sprint' },

  // ---- Demi-fond / Fond ----
  { id: 'middle_800',   label: '800m',         group: 'Demi-fond' },
  { id: 'middle_1500',  label: '1500m',        group: 'Demi-fond' },
  { id: 'middle_3000',  label: '3000m',        group: 'Demi-fond' },
  { id: 'sc_3000',      label: '3000m steeple',group: 'Demi-fond' },
  { id: 'long_5000',    label: '5000m',        group: 'Fond' },
  { id: 'long_10000',   label: '10000m',       group: 'Fond' },


  // ---- Route ----
  { id: 'road_5k',      label: 'Route 5km',    group: 'Route' },
  { id: 'road_10k',     label: 'Route 10km',   group: 'Route' },
  { id: 'road_half',    label: 'Semi-marathon', group: 'Route' },
    { id: 'marathon',     label: 'Marathon',     group: 'Route' },
  { id: 'trail',        label: 'Trail',        group: 'Route' },

  // ---- Sauts ----
  { id: 'jump_high',    label: 'Saut en hauteur', group: 'Sauts' },
  { id: 'jump_long',    label: 'Saut en longueur', group: 'Sauts' },
  { id: 'jump_triple',  label: 'Triple saut',  group: 'Sauts' },
  { id: 'jump_pole',    label: 'Saut à la perche', group: 'Sauts' },

  // ---- Lancers ----
  { id: 'throw_shot',   label: 'Lancer du poids',   group: 'Lancers' },
  { id: 'throw_discus', label: 'Lancer du disque',  group: 'Lancers' },
  { id: 'throw_javelin',label: 'Lancer du javelot', group: 'Lancers' },
  { id: 'throw_hammer', label: 'Lancer du marteau', group: 'Lancers' },

  // ---- Combinés ----
  { id: 'combined_heptathlon', label: 'Heptathlon', group: 'Combinés' },
  { id: 'combined_decathlon',  label: 'Décathlon',  group: 'Combinés' },

  // ---- Marche ----
  { id: 'walk_20k',     label: 'Marche 20km',  group: 'Marche' },
  { id: 'walk_50k',     label: 'Marche 50km',  group: 'Marche' },
]

// Utilitaire — retourne le label à partir de l'id
export const getDisciplineLabel = (id: string): string =>
  DISCIPLINES.find(d => d.id === id)?.label ?? id

// Utilitaire — retourne les groupes uniques dans l'ordre
export const DISCIPLINE_GROUPS = [...new Set(DISCIPLINES.map(d => d.group))]