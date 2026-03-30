import { createClient } from '@supabase/supabase-js';

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY;

if (!supabaseUrl || !supabaseAnonKey) {
  console.warn('Supabase credentials missing. Please check your .env file.');
}

export const supabase = createClient(supabaseUrl || '', supabaseAnonKey || '');

export type PunishmentType = 'WARN' | 'BAN' | 'WL-DOWN' | 'SUSPEND';

export interface Punishment {
  id: string;
  created_at: string;
  target_id: string;
  target_name: string;
  type: PunishmentType;
  reason: string;
  details: string;
  evidence_url: string;
  expires_at: string | null;
  admin_discord_id: string;
  admin_name: string;
}

export const PUNISHMENT_REASONS = [
  'Combatlog',
  'NoFear',
  'Mixing',
  'RDM',
  'VDM',
  'FailRP',
  'Powergaming',
  'Metagaming',
  'FearRP',
  'Iné (uvedené v detailoch)'
];

export const PUNISHMENT_TYPES = [
  { label: 'Warn', value: 'WARN', duration: null },
  { label: 'Ban 1d', value: 'BAN', duration: 1 },
  { label: 'Ban 3d', value: 'BAN', duration: 3 },
  { label: 'Ban 7d', value: 'BAN', duration: 7 },
  { label: 'Permaban', value: 'BAN', duration: -1 },
  { label: 'WL-Down', value: 'WL-DOWN', duration: null },
  { label: 'Suspend', value: 'SUSPEND', duration: null },
];
