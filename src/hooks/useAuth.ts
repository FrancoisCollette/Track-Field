// Hook personnalisé qui centralise toute la logique d'authentification
// On l'utilisera dans n'importe quel composant avec : const { user, loading } = useAuth()

import { useEffect, useState } from 'react'
import { Session, User } from '@supabase/supabase-js'
import { supabase } from '../lib/supabase'

interface AuthState {
  user:    User | null      // l'utilisateur connecté, ou null
  session: Session | null   // la session Supabase (contient le token JWT)
  loading: boolean          // true pendant la vérification initiale
}

export function useAuth(): AuthState {
  const [user,    setUser]    = useState<User | null>(null)
  const [session, setSession] = useState<Session | null>(null)
  const [loading, setLoading] = useState(true) // true au démarrage

  useEffect(() => {
    // 1) Récupère la session existante au chargement de la page
    // (si l'utilisateur avait déjà un token valide en localStorage)
    supabase.auth.getSession().then(({ data: { session } }) => {
      setSession(session)
      setUser(session?.user ?? null)
      setLoading(false) // on a la réponse, on arrête le loading
    })

    // 2) Écoute les changements d'état en temps réel :
    // connexion, déconnexion, refresh du token...
    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      (_event, session) => {
        setSession(session)
        setUser(session?.user ?? null)
        setLoading(false)
      }
    )

    // Nettoyage : on désabonne quand le composant est détruit
    // (bonne pratique React pour éviter les memory leaks)
    return () => subscription.unsubscribe()
  }, []) // [] = s'exécute une seule fois au montage

  return { user, session, loading }
}