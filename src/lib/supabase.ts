// Point d'entrée unique pour le client Supabase
// On l'importe depuis ce fichier dans toute l'app
// pour ne jamais recréer le client plusieurs fois

import { createClient } from '@supabase/supabase-js'

const supabaseUrl  = import.meta.env.VITE_SUPABASE_URL
const supabaseKey  = import.meta.env.VITE_SUPABASE_ANON_KEY

// Vérification au démarrage — plante clairement si les variables manquent
if (!supabaseUrl || !supabaseKey) {
    throw new Error('Variables VITE_SUPABASE_URL ou VITE_SUPABASE_ANON_KEY manquantes dans .env')
}

export const supabase = createClient(supabaseUrl, supabaseKey)