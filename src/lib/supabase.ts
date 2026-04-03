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
  discord_id: string;
  discord_username: string;
  type: PunishmentType;
  reason: string;
  details: string;
  evidence_url: string;
  expires_at: string | null;
  admin_discord_id: string;
  admin_name: string;
}

export interface Wanted {
  id: string;
  created_at: string;
  description: string;
  discord_id: string;
  discord_username: string;
  danger_level: 'LOW' | 'MEDIUM' | 'HIGH' | 'EXTREME';
  status: 'ACTIVE' | 'CAPTURED' | 'DECEASED';
  whitelist_status: 'DENIED' | 'ALLOWED' | 'NONE';
  admin_name: string;
}

export interface Bug {
  id: string;
  created_at: string;
  title: string;
  description: string;
  priority: 'LOW' | 'MEDIUM' | 'HIGH';
  status: 'OPEN' | 'IN_PROGRESS' | 'FIXED' | 'CLOSED';
  reporter_name: string;
  type: 'BUG' | 'SUGGESTION';
}

export interface Meeting {
  id: string;
  created_at: string;
  title: string;
  description: string;
  category: 'BUG' | 'SUGGESTION' | 'COMPLAINT';
  priority: 'LOW' | 'MEDIUM' | 'HIGH';
  status: 'INBOX' | 'AGENDA' | 'RESOLVED' | 'ARCHIVED';
  organizer_name: string; // Author
}

export interface Log {
  id: string;
  created_at: string;
  admin_name: string;
  admin_discord_id: string;
  action: string;
  target_name: string;
  details: string;
}

export interface Admin {
  id: string;
  created_at: string;
  discord_id: string;
  username: string; // This will be used for email if discord_id is missing
  email?: string;
  added_by: string;
  rank: number;
}

export interface SuggestionComment {
  id: string;
  suggestion_id: string;
  author_name: string;
  content: string;
  created_at: string;
  is_valid: boolean;
}

export interface PunishmentReason {
  id: string;
  created_at: string;
  label: string;
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
  'Jiné (uvedeno v detailech)'
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
