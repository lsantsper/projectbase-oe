import { create } from 'zustand'
import type { User } from '@supabase/supabase-js'
import { supabase } from '@/lib/supabase'
import type { DbProfile } from '@/types/database'

interface AuthState {
  user: User | null
  profile: DbProfile | null
  loading: boolean
  setUser: (user: User | null) => void
  signInWithGoogle: () => Promise<void>
  signOut: () => Promise<void>
  loadProfile: () => Promise<void>
}

export const useAuthStore = create<AuthState>((set, get) => ({
  user: null,
  profile: null,
  loading: true,

  setUser: (user) => set({ user, profile: user ? get().profile : null }),

  signInWithGoogle: async () => {
    await supabase.auth.signInWithOAuth({
      provider: 'google',
      options: { redirectTo: window.location.origin + '/auth/callback' },
    })
  },

  signOut: async () => {
    await supabase.auth.signOut()
    set({ user: null, profile: null })
  },

  loadProfile: async () => {
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) { set({ user: null, profile: null, loading: false }); return }

    set({ user })
    const { data: profile } = await supabase
      .from('profiles')
      .select('*')
      .eq('id', user.id)
      .single()

    set({ profile: profile as DbProfile | null, loading: false })
  },
}))
