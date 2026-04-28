// Fonction officielle Supabase pour créer la connexion
import { createClient } from '@supabase/supabase-js'

// Lecture des clés depuis .env via Vite
const supabaseUrl = import.meta.env.VITE_SUPABASE_URL
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY

// Export du client - importable partout dans l'app
export const supabase = createClient(supabaseUrl, supabaseAnonKey)