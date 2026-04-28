// src/lib/calendarUtils.ts
// Fonctions utilitaires pour la gestion du calendrier d'entraînement

import { getAgeCategory } from './ageCategory'

// ----------------------------------------------------------------
// Types
// ----------------------------------------------------------------

export type TrainingSession = {
  id:                string
  coach_id:          string
  date:              string        // format 'YYYY-MM-DD'
  title:             string
  description:       string | null
  target_type:       'group' | 'personal'
  target_group:      string | null
  target_athlete_id: string | null
  template_id:       string | null
}

// ----------------------------------------------------------------
// Génère un tableau de dates — du jour J jusqu'à N semaines plus tard
// ----------------------------------------------------------------

export function generateDateRange(weeksAhead: number = 8): Date[] {
  const dates: Date[] = []
  const today = new Date()
  // On commence au lundi de la semaine en cours
  const startDate = getMonday(today)
  const totalDays = weeksAhead * 7

  for (let i = 0; i < totalDays; i++) {
    const date = new Date(startDate)
    date.setDate(startDate.getDate() + i)
    dates.push(date)
  }
  return dates
}

// Retourne le lundi d'une semaine donnée
export function getMonday(date: Date): Date {
  const d = new Date(date)
  const day = d.getDay()
  // getDay() retourne 0 pour dimanche, 1 pour lundi...
  const diff = day === 0 ? -6 : 1 - day
  d.setDate(d.getDate() + diff)
  d.setHours(0, 0, 0, 0)
  return d
}

// Formate une date en 'YYYY-MM-DD' en utilisant l'heure LOCALE
// (pas UTC — évite le décalage timezone pour la Belgique UTC+1/+2)
export function formatDateKey(date: Date): string {
  const year  = date.getFullYear()
  const month = String(date.getMonth() + 1).padStart(2, '0')
  const day   = String(date.getDate()).padStart(2, '0')
  return `${year}-${month}-${day}`
}

// Formate une date pour l'affichage — ex: "Lun 12 jan"
export function formatDateDisplay(date: Date): string {
  return date.toLocaleDateString('fr-BE', {
    weekday: 'short',
    day:     'numeric',
    month:   'short',
  })
}

// Retourne true si la date est aujourd'hui
export function isToday(date: Date): boolean {
  const today = new Date()
  return formatDateKey(date) === formatDateKey(today)
}

// Retourne true si la date est dans le passé
export function isPast(date: Date): boolean {
  const today = new Date()
  today.setHours(0, 0, 0, 0)
  return date < today
}

// ----------------------------------------------------------------
// Détermine les groupes pertinents pour un athlète
// selon ses disciplines, sa catégorie et la règle de priorité LBFA
// ----------------------------------------------------------------

export function getRelevantGroupsForAthlete(
  disciplines: string[],
  birthYear:   number
): string[] {
  const category = getAgeCategory(birthYear)
  const isYoung  = ['U14', 'U16', 'U18', 'U20'].includes(category.code)

  // Mapping discipline → groupe d'entraînement
  const disciplineToGroup: Record<string, string> = {
    'sprint_100':    'sprint_all',
    'sprint_200':    'sprint_all',
    'sprint_400':    'middle_400',
    'hurdles_100':   'sprint_all',
    'hurdles_110':   'sprint_all',
    'hurdles_400':   'middle_400',
    'relay_4x100':   'sprint_all',
    'relay_4x400':   'middle_400',
    'middle_800':    'middle_800',
    'middle_1500':   'middle_1500_3000',
    'middle_3000':   'middle_1500_3000',
    'sc_3000':       'middle_1500_3000',
    'long_5000':     'middle_3000_5000',
    'long_10000':    'middle_3000_5000',
    'marathon':      'middle_3000_5000',
    'road_5k':       'middle_3000_5000',
    'road_10k':      'middle_3000_5000',
    'road_half':     'middle_3000_5000',
    'trail':         'middle_3000_5000',
    'jump_high':     'jumps_all',
    'jump_long':     'jumps_all',
    'jump_triple':   'jumps_all',
    'jump_pole':     'jumps_all',
    'throw_shot':    'jumps_all',
    'throw_discus':  'jumps_all',
    'throw_javelin': 'jumps_all',
    'throw_hammer':  'jumps_all',
    'combined_heptathlon': 'jumps_all',
    'combined_decathlon':  'jumps_all',
  }

  // Groupe catégorie d'âge
  const categoryGroup: Record<string, string> = {
    'U12': 'pipilles_minimes',
    'U14': 'pipilles_minimes',
    'U16': 'cadets_scolaires',
    'U18': 'cadets_scolaires',
    'U20': 'juniors',
  }

  // Groupes issus des disciplines
  const disciplineGroups = [...new Set(
    disciplines
      .map(d => disciplineToGroup[d])
      .filter(Boolean)
  )]

  // Groupe catégorie si applicable
  const catGroup = categoryGroup[category.code]

  // Règle de priorité LBFA :
  // <= U20 → catégorie prime sur discipline
  // > U20  → discipline prime sur catégorie
  if (isYoung) {
    return catGroup
      ? [catGroup, ...disciplineGroups]
      : disciplineGroups
  } else {
    return catGroup
      ? [...disciplineGroups, catGroup]
      : disciplineGroups
  }
}