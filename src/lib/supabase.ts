import { createClient } from '@supabase/supabase-js'

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL as string | undefined
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY as string | undefined

// Temporary debug — remove after confirming env vars are present in production
console.log('Supabase URL:', supabaseUrl)

if (!supabaseUrl || !supabaseAnonKey) {
  throw new Error('Supabase env vars não configuradas: VITE_SUPABASE_URL e VITE_SUPABASE_ANON_KEY são obrigatórias')
}

export const supabase = createClient(supabaseUrl, supabaseAnonKey)
