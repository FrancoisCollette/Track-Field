// src/lib/ageCategory.ts
// Calcul de la catégorie d'âge selon les règles LBFA
// La catégorie est basée sur l'année civile de naissance
// (pas de coupure en septembre — seule la saison sportive change)

export type AgeCategory = {
  code:  string  // code court ex: 'U16'
  label: string  // label complet ex: 'Cadets (U16)'
}

// Calcule la catégorie à partir de l'année de naissance
// et de l'année en cours
export function getAgeCategory(birthYear: number): AgeCategory {
  const currentYear = new Date().getFullYear()
  const age = currentYear - birthYear
  
  if (age <= 7 ) return { code: 'U8' , label: 'Kangourou' }
  if (age <= 9 ) return { code: 'U10', label: 'Benjamin'  }
  if (age <= 11) return { code: 'U12', label: 'Pupille'   }
  if (age <= 13) return { code: 'U14', label: 'Minime'    }
  if (age <= 15) return { code: 'U16', label: 'Cadet'     }
  if (age <= 17) return { code: 'U18', label: 'Scolaire'  }
  if (age <= 19) return { code: 'U20', label: 'Junior'    }
  if (age <= 22) return { code: 'U23', label: 'Espoir'    }
  if (age <= 34) return { code: 'SEN', label: 'Senior'    }
  return           { code: 'MAS', label: 'Master' }
}

// Année minimum et maximum autorisées dans le formulaire
export const BIRTH_YEAR_MIN = new Date().getFullYear() - 80  // Masters les plus âgés
export const BIRTH_YEAR_MAX = new Date().getFullYear() - 5  // Minimum 5 ans