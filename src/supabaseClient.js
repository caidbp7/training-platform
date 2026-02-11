import { createClient } from '@supabase/supabase-js'

export const supabaseUrl = 'https://mrqyikuumoslcmsqhucz.supabase.co'
export const supabaseKey = 'sb_publishable_aOvohhIMlkNN-7EsR0MVlg_cx4Bm5BE'

export const supabase = createClient(supabaseUrl, supabaseKey)
