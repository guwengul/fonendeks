import { createClient } from '@supabase/supabase-js'

// Sadece server-side kullan, client bundle'a girmesin
export function createAdminClient() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  )
}
