import { createClient } from '@supabase/supabase-js';
import { ENV } from './config';

// Používame SERVICE_ROLE_KEY, pretože bot beží na zabezpečenom serveri
// a potrebuje obísť RLS pre zápis/čítanie všetkých ticketov.
export const supabase = createClient(ENV.SUPABASE_URL, ENV.SUPABASE_SERVICE_ROLE_KEY, {
  auth: {
    autoRefreshToken: false,
    persistSession: false
  }
});
