// src/lib/trainingGroups.ts
// Configuration des groupes d'entraînement et des templates
// ⚠️  C'est ici qu'on modifie les groupes et les copies automatiques

// ----------------------------------------------------------------
// Types
// ----------------------------------------------------------------

export type TrainingGroup = {
  id:          string   // identifiant stocké en base
  label:       string   // affiché dans le calendrier
  shortLabel:  string   // version courte pour les colonnes étroites
  color:       string   // couleur CSS du groupe
  icon:        string   // emoji représentatif
}

export type TrainingTemplate = {
  id:          string
  title:       string
  description: string
  icon:        string   // emoji type d'entraînement
}

// ----------------------------------------------------------------
// Groupes d'athlètes — modifie ici pour ajouter/retirer des groupes
// ----------------------------------------------------------------

export const TRAINING_GROUPS: TrainingGroup[] = [
    {
    id:         'middle_1500_3000',
    label:      '1500m - 3000m',
    shortLabel: '1500-3k',
    color:      '#17685a',   // eden clair
    icon:       '🏃',
  },
  {
    id:         'middle_3000_5000',
    label:      '3000m - 5000m',
    shortLabel: '3k-5k',
    color:      '#4a7f65',   // eden medium
    icon:       '🏃',
  },
  {
    id:         'middle_800',
    label:      '800m',
    shortLabel: '800',
    color:      '#105749',   // eden — vert foncé
    icon:       '🏃',
  },
  {
    id:         'middle_400',
    label:      '400m - 400m haies',
    shortLabel: '400',
    color:      '#e53e3e',   // rouge
    icon:       '⚡',
  },
  {
    id:         'junior',
    label:      'Juniors (U20)',
    shortLabel: 'JUN',
    color:      '#6b46c1',   // violet
    icon:       '🌟',
  },
  {
    id:         'cadet_scolaire',
    label:      'Cadets - Scolaires',
    shortLabel: 'CAD',
    color:      '#2b6cb0',   // bleu
    icon:       '🌱',
  },
  {
    id:         'sprint_all',
    label:      'Sprints',
    shortLabel: 'SPR',
    color:      '#f97911',   // ecstasy — orange vif
    icon:       '⚡',
  },
  {
    id:         'jumps_all',
    label:      'Sauts',
    shortLabel: 'SAU',
    color:      '#db7c00',   // mango — orange foncé
    icon:       '🦘',
  },
]

// ----------------------------------------------------------------
// Copies automatiques entre groupes — modifie ici pour changer
// quels groupes se copient automatiquement quand le toggle est actif
// Format : { source: 'id_groupe', targets: ['id_groupe1', ...] }
// ----------------------------------------------------------------

export const GROUP_COPY_RULES = [
  {
    // Les entraînements 1500-3000 se copient vers 3000-5000 et inversement
    source:  'middle_1500_3000',
    targets: ['middle_3000_5000'],
  },
  {
    source: 'middle_3000_5000',
    targets: ['middle_1500_3000'],
  },
  {
    // Les entraînements sprints se copient vers 400m
    source:  'sprint_all',
    targets: ['middle_400'],
  },
  {
    // Les entraînements cadets se copient vers juniors et inversement
    source:  'cadet_scolaire',
    targets: ['junior'],
  },
  {
    source:  'junior',
    targets: ['cadet_scolaire'],
  },
]

// ----------------------------------------------------------------
// Templates réutilisables — modifie ici pour ajouter des templates
// ----------------------------------------------------------------

export const DEFAULT_TEMPLATES: Omit<TrainingTemplate, 'id'>[] = [
  {
    title:       'Endurance fondamentale',
    description: '40-50min e1, allure confortable (60-70% FCmax). -> Récupération active.',
    icon:        '🟢',
  },
  {
    title:       'Interval training',
    description: 'Échauffement 20min + éducatifs. Séries courtes à haute intensité. Retour au calme 10min.',
    icon:        '🔴',
  },
  {
    title:       'Seuil',
    description: '25min e3 (80-90% FCmax, sous 2mmol de lactate). Travail de la résistance.',
    icon:        '🟠',
  },
  {
    title:       'Sortie longue',
    description: '70-90min e1 relaché. Constance dans l\'effort.',
    icon:        '🔵',
  },
  {
    title:       'Travail technique',
    description: 'Éducatifs, gammes athlétiques, travail de foulée.',
    icon:        '🟡',
  },
  {
    title:       'Récupération',
    description: 'Footing léger 20-30min + étirements. Intensité très basse.',
    icon:        '⚪',
  },
  {
    title:       'Compétition',
    description: 'Jour de compétition. Échauffement complet 1h avant l\'épreuve.',
    icon:        '🏆',
  },
  {
    title:       'Musculation',
    description: 'Séance de renforcement musculaire. Gainage, pliométrie.',
    icon:        '💪',
  },
  {
    title:       'Repos',
    description: 'Journée de repos complet.',
    icon:        '😴',
  },
]

// ----------------------------------------------------------------
// Utilitaires
// ----------------------------------------------------------------

// Retourne un groupe par son id
export const getGroup = (id: string): TrainingGroup | undefined =>
  TRAINING_GROUPS.find(g => g.id === id)

// Retourne les groupes cibles d'une copie automatique
export const getCopyTargets = (sourceId: string): string[] =>
  GROUP_COPY_RULES
    .filter(rule => rule.source === sourceId)
    .flatMap(rule => rule.targets)