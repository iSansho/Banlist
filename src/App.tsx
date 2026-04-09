import React, { useState, useEffect, useRef } from 'react';
import { format, isAfter, parseISO, addHours, addDays } from 'date-fns';
import { sk, cs } from 'date-fns/locale';
import axios from 'axios';
import { GoogleGenAI } from "@google/genai";
import { Toaster, toast } from 'sonner';
import { 
  Search, 
  Plus, 
  LogOut, 
  Shield, 
  ShieldCheck,
  AlertTriangle, 
  Ban,
  Eye,
  UserMinus, 
  Clock,
  Filter,
  ExternalLink,
  Trash2,
  Edit2,
  Edit,
  CheckCircle2,
  XCircle,
  Users,
  Bug as BugIcon,
  Calendar,
  History,
  Settings,
  ChevronLeft,
  ChevronRight,
  LayoutDashboard,
  AlertCircle,
  UserPlus,
  FileText,
  Gavel,
  Loader2,
  MessageSquare,
  Key,
  Inbox,
  ListTodo,
  Archive,
  User,
  Lock,
  Copy,
  Image,
  Video,
  ThumbsUp,
  ThumbsDown,
  Link as LinkIcon,
  X
} from 'lucide-react';
import { cn } from './lib/utils';
import { supabase, Punishment, PunishmentType, PUNISHMENT_REASONS, PUNISHMENT_TYPES, Wanted, Bug, AgendaItem, Log, Admin, PunishmentReason, SuggestionComment, SystemSetting, AgendaRead, AgendaComment, AgendaVote } from './lib/supabase';

const DISCORD_ROLES = [
  { id: '1336047749938020442', name: 'Project Management' },
  { id: '1413570330987073576', name: 'Dev' },
  { id: '1405965334602715257', name: 'Senior Staff Team' },
  { id: '1367490395545534536', name: 'Staff Team' },
  { id: '1367962791360860215', name: 'Staff Test' }
];

// Utility pro sanitizaci HTML proti XSS
const escapeHtml = (unsafe: string | null | undefined) => {
  if (!unsafe) return '';
  return unsafe
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#039;");
};

const EmptyState = ({ icon: Icon, title, description }: { icon: any, title: string, description: string }) => (
  <div className="text-center py-16 text-zinc-500 bg-zinc-900/30 rounded-2xl border border-zinc-800/50 border-dashed">
    <Icon className="w-12 h-12 mx-auto mb-4 opacity-20" />
    <p className="font-medium text-zinc-300">{title}</p>
    <p className="text-xs mt-1 opacity-60">{description}</p>
  </div>
);

export default function App() {
  const [user, setUser] = useState<any>(null);
  const [userRank, setUserRank] = useState<number>(3);
  const [loading, setLoading] = useState(() => {
    if (typeof window === 'undefined') return true;
    // Rýchla synchrónna kontrola existencie session v localStorage
    const hasToken = Object.keys(localStorage).some(key => key.includes('-auth-token'));
    const wasVerified = localStorage.getItem('is_verified') === 'true' || sessionStorage.getItem('session_verified') === 'true';
    
    // Ak bol overený a má token, loading je false (optimistický štart)
    if (hasToken && wasVerified) return false;
    
    // Ak nemá token, loading je false (ukážeme login panel)
    if (!hasToken) return false;
    
    // Inak čakáme na overenie
    return true;
  });
  const [isAdmin, setIsAdmin] = useState(false);
  const [isVerified, setIsVerified] = useState(() => {
    if (typeof window === 'undefined') return false;
    // Optimistické načítanie stavu overenia z localStorage pre okamžitý štart
    return localStorage.getItem('is_verified') === 'true' || sessionStorage.getItem('session_verified') === 'true';
  });

  useEffect(() => {
    isVerifiedRef.current = isVerified;
  }, [isVerified]);
  const [activeSection, setActiveSection] = useState<'DASHBOARD' | 'PLAYERS' | 'FEEDBACK' | 'AGENDA' | 'LOGS' | 'SETTINGS'>('DASHBOARD');
  const [playersTab, setPlayersTab] = useState<'BANLIST' | 'WATCHLIST'>('BANLIST');
  const [feedbackTab, setFeedbackTab] = useState<'BUGS' | 'SUGGESTIONS'>('BUGS');
  const [settingsTab, setSettingsTab] = useState<'LOGS' | 'ADMINS' | 'REASONS' | 'SYSTEM' | 'ACCOUNT'>('LOGS');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [isUpdatingPassword, setIsUpdatingPassword] = useState(false);
  const [authMethod, setAuthMethod] = useState<'discord' | 'email'>('discord');
  
  // Data states
  const [punishments, setPunishments] = useState<Punishment[]>([]);
  const [wantedList, setWantedList] = useState<Wanted[]>([]);
  const [bugs, setBugs] = useState<Bug[]>([]);
  const [suggestionComments, setSuggestionComments] = useState<SuggestionComment[]>([]);
  const [selectedSuggestion, setSelectedSuggestion] = useState<Bug | null>(null);
  const [agendaItems, setAgendaItems] = useState<AgendaItem[]>([]);
  const [systemSettings, setSystemSettings] = useState<SystemSetting[]>([]);
  const [agendaReads, setAgendaReads] = useState<AgendaRead[]>([]);
  const [agendaComments, setAgendaComments] = useState<AgendaComment[]>([]);
  const [agendaVotes, setAgendaVotes] = useState<AgendaVote[]>([]);
  const [showArchive, setShowArchive] = useState(false);
  const [viewingAgendaItem, setViewingAgendaItem] = useState<AgendaItem | null>(null);
  const [newAgendaComment, setNewAgendaComment] = useState('');
  const [logs, setLogs] = useState<Log[]>([]);
  const [admins, setAdmins] = useState<Admin[]>([]);
  const [punishmentReasons, setPunishmentReasons] = useState<PunishmentReason[]>([]);
  const [discordMembers, setDiscordMembers] = useState<any[]>([]);
  const [isDiscordLoading, setIsDiscordLoading] = useState(false);
  const [discordError, setDiscordError] = useState<string | null>(null);

  const [searchTerm, setSearchTerm] = useState('');
  const [wantedSearchTerm, setWantedSearchTerm] = useState('');
  const [bugsSearchTerm, setBugsSearchTerm] = useState('');
  const [logsSearchTerm, setLogsSearchTerm] = useState('');
  const [agendaSearchTerm, setAgendaSearchTerm] = useState('');
  const [agendaFilter, setAgendaFilter] = useState<string>('ALL');
  const [typeFilter, setTypeFilter] = useState<string>('ALL');
  const [wantedFilter, setWantedFilter] = useState<string>('ALL');
  const [bugsFilter, setBugsFilter] = useState<string>('ALL');
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingItem, setEditingItem] = useState<any>(null);
  const [deleteConfirmation, setDeleteConfirmation] = useState<{id: string, table: string, name: string} | null>(null);
  const [archiveConfirmation, setArchiveConfirmation] = useState(false);
  const [warnConfirmation, setWarnConfirmation] = useState<{activeWarns: number, proceed: () => void} | null>(null);
  const [viewingPunishment, setViewingPunishment] = useState<Punishment | null>(null);
  const [viewingWanted, setViewingWanted] = useState<Wanted | null>(null);
  const [selectedPlayerHistory, setSelectedPlayerHistory] = useState<{discord_id: string, discord_username: string} | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [showValidationErrors, setShowValidationErrors] = useState(false);
  const isVerifyingRef = useRef(false);
  const isVerifiedRef = useRef(false);
  const isLoggingOutRef = useRef(false);

  // Form state
  const [formData, setFormData] = useState({
    // Shared / Punishment
    discord_id: '',
    discord_username: '',
    type: 'WARN' as PunishmentType,
    reason: PUNISHMENT_REASONS[0],
    details: '',
    proof_urls: [''],
    expires_at: '' as string | null,

    // Wanted
    description: '',
    danger_level: 'LOW' as 'LOW' | 'MEDIUM' | 'HIGH' | 'EXTREME',
    status: 'ACTIVE' as any,
    whitelist_status: 'NONE' as 'DENIED' | 'ALLOWED' | 'NONE',

    // Bug / Suggestion
    title: '',
    priority: 'LOW' as 'LOW' | 'MEDIUM' | 'HIGH',
    bug_status: 'OPEN' as any,
    feedback_type: 'BUG' as 'BUG' | 'SUGGESTION',

    // Agenda
    category: 'BUG' as 'BUG' | 'SUGGESTION' | 'COMPLAINT' | 'OTHER',
    meeting_status: 'INBOX' as 'INBOX' | 'AGENDA' | 'RESOLVED' | 'ARCHIVED',
    ping_roles: [] as string[],
    agenda_media_urls: [''],
    
    // Admin
    rank: 3,
    email: '',
    password: '',
  });

    useEffect(() => {
    // --- VERSION SHIELD: Automatické čistenie cache pri zmene verzie ---
    const APP_VERSION = '2.0'; 
    const savedVersion = localStorage.getItem('app_version');

    if (savedVersion && savedVersion !== APP_VERSION) {
      console.log(`[System] Nová verzia aplikácie (${APP_VERSION}). Čistím cache...`);
      localStorage.clear();
      sessionStorage.clear();
      localStorage.setItem('app_version', APP_VERSION);
      window.location.reload();
      return;
    } else if (!savedVersion) {
      localStorage.setItem('app_version', APP_VERSION);
    }

    // --- AUTH INITIALIZATION & LISTENER ---
    const initAuth = async () => {
      const sessionVerified = sessionStorage.getItem('session_verified') === 'true';
      
      try {
        const { data: { session }, error } = await supabase.auth.getSession();
        if (error) throw error;

        if (session?.user) {
          setUser(session.user);
          if (sessionVerified) {
            setIsVerified(true);
            setIsAdmin(true);
            setLoading(false);
            fetchData();
            fetchPunishmentReasons();
            fetchDiscordMembers();
          } else {
            await verifyAndFetchData(session.user);
          }
        } else {
          setLoading(false);
        }
      } catch (error) {
        console.error("[Auth] Chyba pri inicializácii auth:", error);
        setLoading(false);
      }
    };

    const isAuthRedirect = window.location.hash.includes('access_token=') || window.location.search.includes('code=');
    if (!isAuthRedirect) {
      initAuth();
    }

    const { data: { subscription } } = supabase.auth.onAuthStateChange(async (event, session) => {
      console.log(`[Auth] Event: ${event}`);
      
      if (event === 'SIGNED_OUT') {
        handleLogout();
        return;
      }

      if (event === 'SIGNED_IN' || event === 'INITIAL_SESSION') {
        if (session?.user) {
          setUser(session.user);
          if (!isVerifiedRef.current && !isVerifyingRef.current) {
            await verifyAndFetchData(session.user);
          }
        }
      }
    });

    return () => subscription.unsubscribe();
  }, []); // Prázdne pole - spustí sa len raz pri mountnutí

  // Real-time listener for Agenda Detail Modal
  useEffect(() => {
    if (!viewingAgendaItem) return;

    const channel = supabase.channel(`agenda-detail-${viewingAgendaItem.id}`)
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'agenda_comments',
          filter: `agenda_id=eq.${viewingAgendaItem.id}`
        },
        (payload) => {
          setAgendaComments((prev) => {
            if (prev.some(c => c.id === payload.new.id)) return prev;
            return [...prev, payload.new as AgendaComment];
          });
        }
      )
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'agenda_votes',
          filter: `agenda_id=eq.${viewingAgendaItem.id}`
        },
        (payload) => {
          if (payload.eventType === 'INSERT') {
            setAgendaVotes(prev => {
              if (prev.some(v => v.agenda_id === payload.new.agenda_id && v.admin_id === payload.new.admin_id)) return prev;
              return [...prev, payload.new as AgendaVote];
            });
          } else if (payload.eventType === 'UPDATE') {
            setAgendaVotes(prev => prev.map(v => 
              (v.agenda_id === payload.new.agenda_id && v.admin_id === payload.new.admin_id) 
                ? payload.new as AgendaVote 
                : v
            ));
          } else if (payload.eventType === 'DELETE') {
            setAgendaVotes(prev => prev.filter(v => 
              !(v.agenda_id === payload.old.agenda_id && v.admin_id === payload.old.admin_id)
            ));
          }
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [viewingAgendaItem]);

    const verifyAndFetchData = async (currentUser: any) => {
    if (isVerifyingRef.current || isVerified) return;
    
    isVerifyingRef.current = true;
    setLoading(true);
    const startTime = Date.now();
    console.log(`[Auth] Starting verification for ${currentUser.email}`);
    
    const timeoutId = setTimeout(() => {
      if (isVerifyingRef.current) {
        console.warn("[Auth] Verification timeout reached");
        setLoading(false);
        isVerifyingRef.current = false;
        toast.error("Overovanie trvá príliš dlho. Skúste obnoviť stránku.");
      }
    }, 20000); // 20 seconds timeout

    try {
      const providerId = String(
        currentUser.user_metadata?.provider_id || 
        currentUser.user_metadata?.sub || 
        currentUser.identities?.find((i: any) => i.provider === 'discord')?.id ||
        currentUser.id
      ).trim();
      
      const isSuperAdmin = currentUser.email === 'Floutic@gmail.com' || currentUser.user_metadata?.email === 'Floutic@gmail.com'; 
      
      // Skúsime nájsť admina podľa Discord ID alebo Emailu
      const { data: adminData, error: adminError } = await supabase
        .from('admins')
        .select('*')
        .or(`discord_id.eq.${providerId},email.eq.${currentUser.email}`)
        .maybeSingle();

      if (adminError) throw adminError;

      const isUserAdmin = isSuperAdmin || !!adminData;
      setIsAdmin(isUserAdmin);
      
      const rank = isSuperAdmin ? 1 : (adminData?.rank || 3);
      setUserRank(rank);

      if (isUserAdmin) {
        console.log("[Auth] Access granted.");
        setIsVerified(true);
        sessionStorage.setItem('session_verified', 'true');
        setLoading(false);
        
        fetchData();
        fetchPunishmentReasons();
        fetchDiscordMembers(); 
      } else {
        console.log("[Auth] Access denied.");
        setIsVerified(false);
        sessionStorage.removeItem('session_verified');
        setLoading(false);
        toast.error(`Prístup zamietnutý. Vaše ID/Email nie je v zozname administrátorov.`);
      }
    } catch (e: any) {
      console.error("[Auth] Kritická chyba pri overovaní prístupu:", e);
      setIsAdmin(false);
      setIsVerified(false);
      sessionStorage.removeItem('session_verified');
      setLoading(false);
      toast.error("Chyba pri overovaní prístupu.");
    } finally {
      clearTimeout(timeoutId);
      isVerifyingRef.current = false;
      console.log(`[Auth] Verification finished in ${Date.now() - startTime}ms`);
    }
  };

  const fetchPunishmentReasons = async () => {
    const { data, error } = await supabase
      .from('punishment_reasons')
      .select('*')
      .order('created_at', { ascending: true });
    
    if (error) {
      console.error('Error fetching punishment reasons:', error);
      return;
    }
    setPunishmentReasons(data || []);
  };

  const fetchSuggestionComments = async (suggestionId: string) => {
    try {
      const { data, error } = await supabase
        .from('suggestion_comments')
        .select('*')
        .eq('suggestion_id', suggestionId)
        .order('created_at', { ascending: true });
      
      if (error) throw error;
      setSuggestionComments(data || []);
    } catch (error) {
      console.error("Chyba pri načítaní komentárov:", error);
    }
  };

  const toggleCommentValidity = async (id: string, isValid: boolean) => {
    try {
      const { error } = await supabase
        .from('suggestion_comments')
        .update({ is_valid: isValid })
        .eq('id', id);
      
      if (error) throw error;
      setSuggestionComments(prev => prev.map(c => c.id === id ? { ...c, is_valid: isValid } : c));
      toast.success('Komentár upravený');
    } catch (error) {
      toast.error('Chyba pri úprave komentára');
    }
  };

  const deleteComment = async (id: string) => {
    try {
      const { error } = await supabase
        .from('suggestion_comments')
        .delete()
        .eq('id', id);
      
      if (error) throw error;
      setSuggestionComments(prev => prev.filter(c => c.id !== id));
      toast.success('Komentár zmazaný');
    } catch (error) {
      toast.error('Chyba pri mazaní komentára');
    }
  };

  const fetchDiscordMembers = async () => {
    setIsDiscordLoading(true);
    setDiscordError(null);
    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) return;

      const response = await axios.get('/api/discord/members', {
        headers: {
          Authorization: `Bearer ${session.access_token}`
        }
      });

      if (Array.isArray(response.data)) {
        setDiscordMembers(response.data);
      } else {
        setDiscordError('Server vrátil neplatné dáta.');
      }
    } catch (error: any) {
      console.error('Chyba Discord API:', error);
      setDiscordError(error.response?.data?.error || error.message);
    } finally {
      setIsDiscordLoading(false);
    }
  };

  // checkAdminStatus is now integrated into verifyAndFetchData
  // Keeping a simplified version if it's called from elsewhere, though it shouldn't be needed
  const checkAdminStatus = async (user: any) => {
    if (!user) {
      setIsAdmin(false);
      return;
    }
    const rawProviderId = user.user_metadata?.provider_id || user.user_metadata?.sub || user.identities?.[0]?.id || user.id;
    const providerId = String(rawProviderId).trim();
    try {
      const { data } = await supabase.from('admins').select('*').eq('discord_id', providerId).maybeSingle();
      const whitelist = import.meta.env.VITE_ADMIN_WHITELIST?.split(',') || [];
      setIsAdmin(!!data || 
                 whitelist.includes(providerId) || 
                 user.email === 'Floutic@gmail.com' || 
                 user.user_metadata?.email === 'Floutic@gmail.com' ||
                 providerId === '325261048103829515' ||
                 user.id === '325261048103829515');
    } catch (e) {
      setIsAdmin(false);
    }
  };

  const fetchData = async () => {
    try {
      await Promise.all([
        fetchPunishments(),
        fetchWanted(),
        fetchBugs(),
        fetchAgendaItems(),
        fetchSystemSettings(),
        fetchAgendaReads(),
        fetchAgendaComments(),
        fetchAgendaVotes(),
        fetchLogs(),
        fetchAdmins()
      ]);
    } catch (error) {
      console.error('Error fetching data:', error);
    }
  };

  const logAction = async (action: string, target: string, details: string) => {
    if (!user) return;
    const adminDiscordId = String(user.user_metadata?.provider_id || user.user_metadata?.sub || user.identities?.[0]?.id || user.id).trim();
    const adminName = user.user_metadata?.full_name || user.user_metadata?.name || user.email;

    await supabase.from('logs').insert([{
      admin_name: adminName,
      admin_discord_id: adminDiscordId,
      action,
      target_name: target,
      details
    }]);
    fetchLogs();
  };

  const fetchPunishments = async () => {
    const { data, error } = await supabase
      .from('punishments')
      .select('*')
      .order('created_at', { ascending: false })
      .limit(1000);
    if (error) console.error('Error fetching punishments:', error);
    setPunishments(data || []);
  };

  const fetchWanted = async () => {
    const { data } = await supabase.from('wanted').select('*').order('created_at', { ascending: false });
    setWantedList(data || []);
  };

  const fetchBugs = async () => {
    const { data } = await supabase.from('bugs').select('*').order('created_at', { ascending: false });
    setBugs(data || []);
  };

  const fetchAgendaItems = async () => {
    const { data } = await supabase.from('meetings').select('*').order('created_at', { ascending: false });
    setAgendaItems(data || []);
  };

  const fetchSystemSettings = async () => {
    const { data } = await supabase.from('system_settings').select('*');
    setSystemSettings(data || []);
  };

  const fetchAgendaReads = async () => {
    const { data } = await supabase.from('agenda_reads').select('*');
    setAgendaReads(data || []);
  };

  const fetchAgendaComments = async () => {
    const { data } = await supabase.from('agenda_comments').select('*').order('created_at', { ascending: true });
    setAgendaComments(data || []);
  };

  const handleAddAgendaComment = async () => {
    if (!newAgendaComment.trim() || !viewingAgendaItem) return;
    const adminName = user?.user_metadata?.full_name || user?.user_metadata?.name || user?.email || 'Admin';
    const commentText = newAgendaComment.trim();
    
    // Optimistic update
    const tempId = Date.now().toString();
    const newComment: AgendaComment = {
      id: tempId,
      agenda_id: viewingAgendaItem.id,
      author_name: adminName,
      content: commentText,
      created_at: new Date().toISOString()
    };
    setAgendaComments(prev => [...prev, newComment]);
    setNewAgendaComment('');

    const { error } = await supabase.from('agenda_comments').insert({
      agenda_id: viewingAgendaItem.id,
      author_name: adminName,
      content: commentText
    });

    if (error) {
      toast.error('Chyba při odesílání komentáře.');
      setAgendaComments(prev => prev.filter(c => c.id !== tempId)); // Revert
    } else {
      fetchAgendaComments();
      
      const mentionRegex = /@[\w.]+/g;
      const mentions = commentText.match(mentionRegex);
      
      const webhookUrl = systemSettings.find(s => s.key === 'agenda_webhook')?.value;
      if (webhookUrl) {
        try {
          const payload = {
            content: mentions && mentions.length > 0 ? mentions.join(' ') : "Nová zmínka v diskuzi",
            embeds: [{
              title: '🔔 Nová zmínka v diskuzi',
              color: parseInt('f1c40f', 16),
              fields: [
                { name: 'Komentář od', value: adminName, inline: true },
                { name: 'Označení uživatelé', value: mentions && mentions.length > 0 ? mentions.join(', ') : 'Nikdo', inline: true },
                { name: 'Text', value: commentText.length > 100 ? commentText.substring(0, 100) + '...' : commentText },
                { name: 'Odkaz', value: `[Otevřít podnět na webu](${window.location.origin})` }
              ]
            }]
          };
          console.log("Discord Payload:", payload);
          await fetch(webhookUrl, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(payload)
          });
        } catch (err) {
          console.error('Failed to send mention webhook:', err);
        }
      }
    }
  };

  const fetchAgendaVotes = async () => {
    const { data } = await supabase.from('agenda_votes').select('*');
    setAgendaVotes(data || []);
  };

  const fetchLogs = async () => {
    const { data } = await supabase
      .from('logs')
      .select('*')
      .order('created_at', { ascending: false })
      .limit(200);
    setLogs(data || []);
  };

  const fetchAdmins = async () => {
    const { data } = await supabase.from('admins').select('*').order('created_at', { ascending: false });
    setAdmins(data || []);
  };

  const DiscordUserSearch = ({ onSelect, value, placeholder }: { onSelect: (user: any) => void, value: string, placeholder: string }) => {
    const [search, setSearch] = useState(value);
    const [isOpen, setIsOpen] = useState(false);

    const filtered = discordMembers.filter(m => 
      m.username.toLowerCase().includes(search.toLowerCase()) ||
      (m.global_name && m.global_name.toLowerCase().includes(search.toLowerCase())) ||
      m.id.includes(search)
    ).slice(0, 5);

    return (
      <div className="relative">
        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-zinc-500" />
          <input 
            type="text"
            placeholder={placeholder}
            value={search}
            onChange={(e) => {
              setSearch(e.target.value);
              setIsOpen(true);
            }}
            onFocus={() => setIsOpen(true)}
            className="w-full bg-zinc-800 border border-zinc-700 rounded-xl py-2 pl-9 pr-4 text-sm focus:outline-none focus:border-zinc-500 transition-all"
          />
          <div className="absolute right-3 top-1/2 -translate-y-1/2 flex items-center gap-2">
            {isDiscordLoading ? (
              <div className="w-3 h-3 border-2 border-zinc-500 border-t-transparent rounded-full animate-spin" />
            ) : (
              <span className="text-[10px] text-zinc-600 font-mono">{discordMembers.length}</span>
            )}
          </div>
        </div>
        {isOpen && search.length > 0 && (
          <div className="absolute z-50 w-full mt-1 bg-zinc-800 border border-zinc-700 rounded-xl shadow-2xl overflow-hidden">
            {discordError ? (
              <div className="p-3 text-xs text-red-400 bg-red-400/10 border-b border-red-400/20">
                {discordError}
              </div>
            ) : null}
            {filtered.length === 0 ? (
              <div className="p-3 text-xs text-zinc-500 text-center">
                {isDiscordLoading ? 'Načítám členy...' : 'Žádní uživatelé nenalezeni'}
              </div>
            ) : (
              filtered.map((m) => (
                <button
                  key={m.id}
                  type="button"
                  onClick={() => {
                    onSelect(m);
                    setSearch(m.username);
                    setIsOpen(false);
                  }}
                  className="w-full p-2 hover:bg-zinc-700 text-left flex items-center gap-3 transition-colors"
                >
                  <div className="w-8 h-8 rounded-full bg-zinc-900 flex items-center justify-center overflow-hidden">
                    {m.avatar ? (
                      <img src={`https://cdn.discordapp.com/avatars/${m.id}/${m.avatar}.png`} alt="" className="w-full h-full object-cover" />
                    ) : (
                      <Users className="w-4 h-4 text-zinc-600" />
                    )}
                  </div>
                  <div className="flex flex-col">
                    <span className="text-xs font-bold text-white">{m.global_name || m.username}</span>
                    <div className="flex items-center gap-2">
                      <span className="text-[10px] text-zinc-500">@{m.username} • {m.id}</span>
                      {punishments.filter(p => p.player_discord_id === m.id && p.type === 'WARN' && !isExpired(p.expiry_date)).length > 0 && (
                        <span className="text-[9px] bg-yellow-500/10 text-yellow-500 px-1 rounded font-bold">
                          {punishments.filter(p => p.player_discord_id === m.id && p.type === 'WARN' && !isExpired(p.expiry_date)).length} WARNS
                        </span>
                      )}
                    </div>
                  </div>
                </button>
              ))
            )}
          </div>
        )}
      </div>
    );
  };

  const [showEmailForm, setShowEmailForm] = useState(false);
  const [isSignUp, setIsSignUp] = useState(false);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');

  const handleLogin = async () => {
    console.log("[Auth] Initiating Discord login...");
    try {
      const { error } = await supabase.auth.signInWithOAuth({
        provider: 'discord',
        options: {
          redirectTo: window.location.origin,
          scopes: 'identify email'
        }
      });
      if (error) throw error;
    } catch (error: any) {
      console.error("[Auth] Discord login error:", error);
      toast.error("Chyba prihlásenia cez Discord: " + error.message);
    }
  };

  const handleEmailLogin = async (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    if (!showEmailForm) {
      setShowEmailForm(true);
      return;
    }

    if (!email || !password) {
      toast.error('Prosím vyplňte email a heslo');
      return;
    }

    try {
      if (isSignUp) {
        const { error } = await supabase.auth.signUp({
          email,
          password,
        });
        if (error) throw error;
        toast.success('Registrace úspěšná. Nyní se můžete přihlásit.');
        setIsSignUp(false);
      } else {
        const { error } = await supabase.auth.signInWithPassword({
          email,
          password,
        });
        if (error) throw error;
        toast.success('Prihlásenie úspešné');
      }
    } catch (error: any) {
      toast.error('Chyba: ' + error.message);
    }
  };

  const handleUpdatePassword = async () => {
    if (!newPassword || !confirmPassword) {
      toast.error('Prosím vyplňte obě pole pro heslo');
      return;
    }

    if (newPassword !== confirmPassword) {
      toast.error('Hesla se neshodují');
      return;
    }

    if (newPassword.length < 6) {
      toast.error('Heslo musí mít alespoň 6 znaků');
      return;
    }

    setIsUpdatingPassword(true);
    try {
      const { error } = await supabase.auth.updateUser({
        password: newPassword
      });

      if (error) throw error;

      toast.success('Heslo bylo úspěšně aktualizováno');
      setNewPassword('');
      setConfirmPassword('');
    } catch (error: any) {
      console.error("[Auth] Password update error:", error);
      toast.error('Chyba při aktualizaci hesla: ' + error.message);
    } finally {
      setIsUpdatingPassword(false);
    }
  };

  const handleDragStart = (e: React.DragEvent, id: string) => {
    e.dataTransfer.setData('meetingId', id);
  };

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
  };

  const handleViewAgendaItem = async (item: AgendaItem) => {
    setViewingAgendaItem(item);
    if (user) {
      const adminId = user.id;
      const adminName = user.user_metadata?.full_name || user.user_metadata?.name || user.email || 'Admin';
      
      const alreadyRead = agendaReads.some(r => r.agenda_id === item.id && r.admin_id === adminId);
      if (!alreadyRead) {
        const { error } = await supabase.from('agenda_reads').insert({
          agenda_id: item.id,
          admin_id: adminId,
          admin_name: adminName
        });
        if (!error) {
          fetchAgendaReads();
        }
      }
    }
  };

  const handleDrop = async (e: React.DragEvent, newStatus: 'INBOX' | 'AGENDA' | 'RESOLVED') => {
    e.preventDefault();
    const id = e.dataTransfer.getData('meetingId');
    if (!id) return;

    const agendaItem = agendaItems.find(m => m.id === id);
    if (!agendaItem || agendaItem.status === newStatus) return;

    // Optimistic update
    setAgendaItems(agendaItems.map(m => m.id === id ? { ...m, status: newStatus } : m));

    const { error } = await supabase
      .from('meetings')
      .update({ status: newStatus })
      .eq('id', id);

    if (error) {
      toast.error('Chyba při přesunu: ' + error.message);
      fetchData(); // Revert
    } else {
      logAction('Přesun Agendy', agendaItem.title, `Nový status: ${newStatus}`);
    }
  };

  const archiveResolved = async () => {
    setArchiveConfirmation(true);
  };

  const confirmArchive = async () => {
    const resolvedItems = agendaItems.filter(m => m.status === 'RESOLVED');
    if (resolvedItems.length === 0) {
      setArchiveConfirmation(false);
      return;
    }

    setIsSubmitting(true);

    const { error } = await supabase
      .from('meetings')
      .update({ status: 'ARCHIVED' })
      .in('id', resolvedItems.map(m => m.id));

    if (error) {
      toast.error('Chyba při archivaci: ' + error.message);
    } else {
      // Optimistic update
      setAgendaItems(prev => prev.map(m => m.status === 'RESOLVED' ? { ...m, status: 'ARCHIVED' } : m));
      toast.success('Podněty byly archivovány.');
      logAction('Archivace Agendy', 'Hromadná akce', `${resolvedItems.length} podnětů`);
    }
    
    setArchiveConfirmation(false);
    setIsSubmitting(false);
  };

  const handleLogout = async () => {
    if (isLoggingOutRef.current) return;
    isLoggingOutRef.current = true;

    console.log("[Auth] handleLogout triggered");
    const toastId = toast.loading("Odhlašování...");
    
    try {
      await supabase.auth.signOut();
    } catch (error) {
      console.error("[Auth] handleLogout error:", error);
    } finally {
      setUser(null);
      setIsAdmin(false);
      setIsVerified(false);
      localStorage.clear();
      sessionStorage.clear();
      toast.success("Odhlášeno", { id: toastId });
      
      // Use a small delay to ensure toast is visible before reload
      setTimeout(() => {
        window.location.href = window.location.origin;
      }, 500);
    }
  };

  const handleSubmit = async (e: React.FormEvent, skipWarnCheck = false) => {
    e.preventDefault();
    if (!isAdmin || !user) return;

    // Validation
    let isValid = true;
    switch (activeSection) {
      case 'PLAYERS':
        if (!formData.discord_id && !formData.discord_username) isValid = false;
        break;
      case 'SETTINGS':
        if (settingsTab === 'ADMINS' && !formData.discord_id && !formData.discord_username) isValid = false;
        if (settingsTab === 'REASONS' && !formData.reason) isValid = false;
        break;
      case 'FEEDBACK':
        if (!formData.title || !formData.description) isValid = false;
        break;
      case 'AGENDA':
        if (!formData.title || !formData.category || !formData.priority) isValid = false;
        break;
    }

    if (!isValid) {
      setShowValidationErrors(true);
      toast.error('Prosím vyplňte všechna povinná pole.');
      return;
    }

    setIsSubmitting(true);
    let table = '';
    let payload: any = {};
    let logMsg = '';
    let targetName = '';

    const adminDiscordId = String(user.user_metadata?.provider_id || user.user_metadata?.sub || user.identities?.[0]?.id || user.id).trim();
    const adminName = user.user_metadata?.full_name || user.user_metadata?.name || user.email;

    switch (activeSection) {
      case 'PLAYERS':
        if (playersTab === 'BANLIST') {
          // Warn Limit Check
          if (!skipWarnCheck && formData.type === 'WARN' && activeWarns >= 3) {
            setWarnConfirmation({
              activeWarns,
              proceed: () => handleSubmit(e, true)
            });
            setIsSubmitting(false);
            return;
          }

          // Discord Name Resolver Fallback
          let finalPlayerName = formData.discord_username;
          if (!finalPlayerName && formData.discord_id) {
             const member = discordMembers.find(m => m.id === formData.discord_id);
             if (member) {
               finalPlayerName = member.username;
             } else {
               // Fallback to Discord ID if name cannot be resolved
               finalPlayerName = formData.discord_id;
             }
          }

          table = 'punishments';
          payload = {
            player_discord_id: formData.discord_id,
            player_name: finalPlayerName,
            type: formData.type,
            reason: formData.reason,
            details: formData.details,
            proof_url: formData.proof_urls.filter(url => url.trim() !== ''),
            expiry_date: formData.expires_at ? new Date(formData.expires_at).toISOString() : null,
            admin_name: adminName,
          };
          logMsg = `${formData.type}: ${formData.reason}`;
          targetName = formData.discord_id;
        } else {
          table = 'wanted';
          payload = {
            discord_id: formData.discord_id,
            discord_username: formData.discord_username,
            description: formData.description,
            danger_level: formData.danger_level,
            status: formData.status,
            whitelist_status: formData.whitelist_status,
            admin_name: adminName,
          };
          logMsg = `Level: ${formData.danger_level}, Status: ${formData.status}, WL: ${formData.whitelist_status}`;
          targetName = formData.discord_username || formData.discord_id;
        }
        break;
      case 'SETTINGS':
        if (settingsTab === 'ADMINS') {
          table = 'admins';
          if (authMethod === 'discord') {
            payload = {
              discord_id: formData.discord_id,
              username: formData.discord_username,
              rank: formData.rank ?? 3,
              added_by: adminName,
            };
            logMsg = `Admin: ${formData.discord_username} (Rank: ${formData.rank ?? 3})`;
            targetName = formData.discord_username;
          } else {
            payload = {
              discord_id: '',
              username: formData.email,
              email: formData.email,
              rank: formData.rank ?? 3,
              added_by: adminName,
            };
            logMsg = `Admin Email: ${formData.email} (Rank: ${formData.rank ?? 3})`;
            targetName = formData.email;
          }
        } else if (settingsTab === 'REASONS') {
          table = 'punishment_reasons';
          payload = {
            label: formData.reason
          };
          logMsg = `Přidán nový důvod: ${formData.reason}`;
          targetName = formData.reason;
        }
        break;
      case 'FEEDBACK':
        table = 'bugs';
        payload = {
          title: formData.title,
          description: formData.description,
          priority: formData.priority,
          status: formData.bug_status,
          reporter_name: adminName,
          type: feedbackTab === 'BUGS' ? 'BUG' : 'SUGGESTION'
        };
        logMsg = `Type: ${payload.type}, Priority: ${formData.priority}, Status: ${formData.bug_status}`;
        targetName = formData.title;
        break;
      case 'AGENDA':
        table = 'meetings';
        payload = {
          title: formData.title,
          description: formData.description,
          category: formData.category,
          priority: formData.priority,
          status: formData.meeting_status,
          organizer_name: adminName,
          media_urls: formData.agenda_media_urls.filter(url => url.trim() !== ''),
        };
        logMsg = `Kategorie: ${formData.category}, Priorita: ${formData.priority}`;
        targetName = formData.title;
        break;
    }

    let error;
    try {
      if (editingItem) {
        const { data, error: updateError } = await supabase
          .from(table)
          .update(payload)
          .eq('id', editingItem.id)
          .select()
          .single();
        error = updateError;
        if (!error) {
          logAction(`Upraven ${activeSection}${activeSection === 'PLAYERS' ? ` (${playersTab})` : activeSection === 'FEEDBACK' ? ` (${feedbackTab})` : ''}`, targetName, logMsg);
          // Optimistic UI update
          if (table === 'punishments') setPunishments(prev => prev.map(i => i.id === editingItem.id ? data : i));
          if (table === 'wanted') setWantedList(prev => prev.map(i => i.id === editingItem.id ? data : i));
          if (table === 'bugs') setBugs(prev => prev.map(i => i.id === editingItem.id ? data : i));
          if (table === 'meetings') setAgendaItems(prev => prev.map(i => i.id === editingItem.id ? data : i));
          if (table === 'admins') setAdmins(prev => prev.map(i => i.id === editingItem.id ? data : i));
          if (table === 'punishment_reasons') setPunishmentReasons(prev => prev.map(i => i.id === editingItem.id ? data : i));
        }
      } else {
        const { data, error: insertError } = await supabase
          .from(table)
          .insert([payload])
          .select()
          .single();
        error = insertError;
        if (!error) {
          logAction(`Nový ${activeSection}${activeSection === 'PLAYERS' ? ` (${playersTab})` : activeSection === 'FEEDBACK' ? ` (${feedbackTab})` : ''}`, targetName, logMsg);
          // Optimistic UI update
          if (table === 'punishments') setPunishments(prev => [data, ...prev]);
          if (table === 'wanted') setWantedList(prev => [data, ...prev]);
          if (table === 'bugs') setBugs(prev => [data, ...prev]);
          if (table === 'meetings') setAgendaItems(prev => [data, ...prev]);
          if (table === 'admins') setAdmins(prev => [data, ...prev]);
          if (table === 'punishment_reasons') setPunishmentReasons(prev => [data, ...prev]);
        }
      }
    } catch (e: any) {
      error = e;
    }

    if (error) {
      console.error('Supabase error:', error);
      toast.error('Chyba při ukládání: ' + (error.message || 'Neznámá chyba'));
      setIsSubmitting(false);
      return;
    }

    if (activeSection === 'SETTINGS' && settingsTab === 'REASONS') {
      await fetchPunishmentReasons();
    }

    // Send Webhook for Banlist
    if (activeSection === 'PLAYERS' && playersTab === 'BANLIST') {
        try {
          const webhookUrl = systemSettings.find(s => s.key === 'banlist_webhook')?.value;
          if (webhookUrl) {
            const embedColor = formData.type === 'BAN' ? parseInt('e74c3c', 16) : (formData.type === 'WARN' ? parseInt('f1c40f', 16) : parseInt('f39c12', 16));
            const emoji = formData.type === 'BAN' ? '🔨' : (formData.type === 'WARN' ? '⚠️' : '👢');
            const actionText = editingItem ? 'Upraven' : 'Nový';
            
            const payload = {
              content: `Hráč ${formData.discord_id ? `<@${formData.discord_id}>` : `**${formData.discord_username || 'Neznámý'}**`} dostal trest od administrátora ${adminDiscordId ? `<@${adminDiscordId}>` : `**${adminName}**`}.`,
              embeds: [{
                title: `${emoji} ${actionText} Trest | ${formData.type}`,
                color: embedColor,
                fields: [
                  { name: '👤 Uživatel', value: formData.discord_id ? `<@${formData.discord_id}>\n(${formData.discord_id})` : 'Neznámý', inline: true },
                  { name: '🛡️ Admin', value: adminName, inline: true },
                  { name: '\u200B', value: '\u200B', inline: true },
                  { name: '📋 Důvod', value: formData.reason || 'Nezadán', inline: false },
                  { name: '📝 Detaily', value: formData.details || '*Žádné dodatečné detaily*', inline: false },
                  { name: '🔗 Důkaz', value: formData.proof_urls.filter(url => url.trim() !== '').length > 0 ? formData.proof_urls.filter(url => url.trim() !== '').map((url, i) => `[Důkaz ${i+1}](${url})`).join(', ') : '*Bez důkazu*', inline: true },
                  { name: '⏳ Expirace', value: formData.expires_at ? format(new Date(formData.expires_at), 'dd.MM.yyyy HH:mm') : 'Permanentní', inline: true }
                ],
                footer: {
                  text: 'Systém trestů | GenK'
                },
                timestamp: new Date().toISOString()
              }]
            };
            
            console.log("Discord Payload:", payload);
            
            await fetch(webhookUrl, {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify(payload)
            });
          }
        } catch (e) {
          console.error('Webhook failed', e);
        }
      }

      // Send Webhook for Agenda
      if (activeSection === 'AGENDA' && !editingItem) {
        try {
          const webhookUrl = systemSettings.find(s => s.key === 'agenda_webhook')?.value;
          if (webhookUrl) {
            const embedColor = formData.priority === 'HIGH' ? parseInt('e74c3c', 16) : (formData.priority === 'MEDIUM' ? parseInt('f1c40f', 16) : parseInt('3498db', 16));
            const pingContent = (formData.ping_roles || []).map(id => `<@&${id}>`).join(' ');
            
            const payload = {
              content: pingContent ? `🔔 Nový podnět v Agendě! ${pingContent}` : `🔔 Nový podnět v Agendě!`,
              embeds: [{
                title: `📋 ${formData.title}`,
                ...(formData.description ? { description: formData.description } : {}),
                color: embedColor,
                url: window.location.origin,
                fields: [
                  { name: 'Kategorie', value: formData.category, inline: true },
                  { name: 'Priorita', value: formData.priority, inline: true },
                  { name: 'Autor', value: adminName, inline: true }
                ],
                footer: {
                  text: 'Admin Panel | Agenda'
                },
                timestamp: new Date().toISOString()
              }]
            };
            
            console.log("Discord Payload:", payload);
            
            await fetch(webhookUrl, {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify(payload)
            });
          }
        } catch (e) {
          console.error('Agenda Webhook failed', e);
        }
      }

      // Send Webhook for Feedback
      if (activeSection === 'FEEDBACK' && !editingItem) {
        try {
          const webhookUrl = systemSettings.find(s => s.key === 'feedback_webhook')?.value;
          if (webhookUrl) {
            const embedColor = feedbackTab === 'BUGS' ? parseInt('e74c3c', 16) : parseInt('3498db', 16);
            const typeLabel = feedbackTab === 'BUGS' ? 'Bug Report' : 'Návrh';
            
            const payload = {
              content: `🔔 Nový ${typeLabel}!`,
              embeds: [{
                title: `📝 ${formData.title}`,
                ...(formData.description ? { description: formData.description } : {}),
                color: embedColor,
                url: window.location.origin,
                fields: [
                  { name: 'Autor', value: adminName, inline: true }
                ],
                footer: {
                  text: 'Admin Panel | Zpětná vazba'
                },
                timestamp: new Date().toISOString()
              }]
            };
            
            console.log("Discord Payload:", payload);
            
            await fetch(webhookUrl, {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify(payload)
            });
          }
        } catch (e) {
          console.error('Feedback Webhook failed', e);
        }
      }

      toast.success('Záznam byl úspěšně uložen!');
      setIsModalOpen(false);
      setEditingItem(null);
      resetForm();
      setShowValidationErrors(false);
      setIsSubmitting(false);
      
      if (activeSection === 'PLAYERS' && table === 'punishments') {
        setPlayersTab('BANLIST');
      }
      await fetchData();
  };

  const resetForm = () => {
    setFormData({
      discord_id: '',
      discord_username: '',
      type: 'WARN',
      reason: punishmentReasons.length > 0 ? punishmentReasons[0].label : PUNISHMENT_REASONS[0],
      details: '',
      proof_urls: [''],
      expires_at: '',
      description: '',
      danger_level: 'LOW',
      status: 'ACTIVE',
      whitelist_status: 'NONE',
      title: '',
      priority: 'LOW',
      bug_status: 'OPEN',
      category: 'BUG',
      meeting_status: 'INBOX',
      ping_roles: [],
      agenda_media_urls: [''],
      feedback_type: 'BUG',
      rank: 3,
      email: '',
      password: ''
    });
  };

  const handleDelete = async (id: string) => {
    if (!isAdmin) return;
    
    let table = '';
    let name = '';
    
    if (activeSection === 'PLAYERS') {
      if (playersTab === 'BANLIST') {
        table = 'punishments';
        name = punishments.find(p => p.id === id)?.player_name || 'Trest';
      } else {
        table = 'wanted';
        name = wantedList.find(w => w.id === id)?.discord_username || 'Wanted';
      }
    } else {
      switch(activeSection) {
        case 'BANLIST': table = 'punishments'; name = punishments.find(p => p.id === id)?.player_name || 'Trest'; break;
        case 'WANTED': table = 'wanted'; name = wantedList.find(w => w.id === id)?.discord_username || 'Wanted'; break;
        case 'FEEDBACK': 
          table = 'bugs'; 
          name = bugs.find(b => b.id === id)?.title || 'Záznam'; 
          break;
        case 'AGENDA': table = 'meetings'; name = agendaItems.find(m => m.id === id)?.title || 'Agenda'; break;
        case 'SETTINGS':
          if (settingsTab === 'ADMINS') {
            table = 'admins';
            name = admins.find(a => a.id === id)?.username || 'Admin';
          } else if (settingsTab === 'REASONS') {
            table = 'punishment_reasons';
            name = punishmentReasons.find(r => r.id === id)?.label || 'Důvod';
          }
          break;
      }
    }

    if (!table) {
      console.error("[System] Could not determine table for deletion. Section:", activeSection, "Tab:", playersTab);
      return;
    }

    setDeleteConfirmation({ id, table, name });
  };

  const confirmDelete = async () => {
    if (!deleteConfirmation) return;
    const { id, table, name } = deleteConfirmation;
    setIsSubmitting(true);
    
    const { error } = await supabase.from(table).delete().eq('id', id);
    
    if (error) {
      console.error('Error deleting:', error);
      toast.error('Chyba při mazání záznamu.');
    } else {
      // Optimistic UI update
      if (table === 'punishments') setPunishments(prev => prev.filter(i => i.id !== id));
      if (table === 'wanted') setWantedList(prev => prev.filter(i => i.id !== id));
      if (table === 'bugs') setBugs(prev => prev.filter(i => i.id !== id));
      if (table === 'meetings') setAgendaItems(prev => prev.filter(i => i.id !== id));
      if (table === 'admins') setAdmins(prev => prev.filter(i => i.id !== id));
      if (table === 'punishment_reasons') setPunishmentReasons(prev => prev.filter(i => i.id !== id));
      
      toast.success('Záznam byl úspěšně smazán!');
      logAction(`Smazán ${activeSection}`, name, `ID: ${id}`);
    }
    
    setDeleteConfirmation(null);
    setIsSubmitting(false);
  };

  const formatExpiration = (dateStr: string | null) => {
    if (!dateStr) return null;
    const date = parseISO(dateStr);
    const now = new Date();
    
    if (isAfter(now, date)) return 'VYPRŠELÉ';
    
    const diffMs = date.getTime() - now.getTime();
    const diffHours = Math.floor(diffMs / (1000 * 60 * 60));
    const diffDays = Math.floor(diffHours / 24);
    
    if (diffDays > 0) {
      return `(zostáva ${diffDays} d${diffDays === 1 ? 'eň' : (diffDays > 1 && diffDays < 5 ? 'ni' : 'ní')})`;
    } else {
      return `(zostáva ${diffHours} hod${diffHours === 1 ? 'ina' : (diffHours > 1 && diffHours < 5 ? 'iny' : 'ín')})`;
    }
  };

  const handleCopyId = (e: React.MouseEvent, id: string) => {
    e.stopPropagation();
    navigator.clipboard.writeText(id);
    toast.success('Discord ID skopírované!');
  };

  const handleEdit = (item: any) => {
    setEditingItem(item);
    
    // Determine what we're editing based on the item's properties
    if (item.danger_level) {
      // It's a watchlist entry
      setPlayersTab('WATCHLIST');
      setFormData({
        ...formData,
        description: item.description,
        discord_id: item.discord_id || '',
        discord_username: item.discord_username || '',
        danger_level: item.danger_level,
        status: item.status,
        whitelist_status: item.whitelist_status,
      });
    } else if (item.type === 'WARN' || item.type === 'BAN' || item.type === 'SUSPEND' || item.type === 'WL-DOWN') {
      // It's a punishment
      setPlayersTab('BANLIST');
      setFormData({
        ...formData,
        discord_id: item.player_discord_id || '',
        discord_username: item.player_name || '',
        type: item.type,
        reason: item.reason,
        details: item.details,
        proof_urls: Array.isArray(item.proof_url) && item.proof_url.length > 0 ? item.proof_url : [''],
        expires_at: item.expiry_date ? new Date(item.expiry_date).toISOString().slice(0, 16) : '',
      });
    } else if (activeSection === 'FEEDBACK' || (item.type === 'BUG' || item.type === 'SUGGESTION')) {
      setFormData({
        ...formData,
        title: item.title,
        description: item.description,
        priority: item.priority,
        bug_status: item.status,
        feedback_type: item.type,
      });
      if (item.type === 'SUGGESTION') {
        setSelectedSuggestion(item);
        fetchSuggestionComments(item.id);
      }
    } else if (activeSection === 'AGENDA' || item.category) {
      setFormData({
        ...formData,
        title: item.title,
        description: item.description,
        category: item.category || 'BUG',
        priority: item.priority || 'LOW',
        meeting_status: item.status || 'INBOX',
        agenda_media_urls: Array.isArray(item.media_urls) && item.media_urls.length > 0 ? item.media_urls : [''],
      });
    } else if (activeSection === 'SETTINGS') {
      if (settingsTab === 'ADMINS') {
        setFormData({
          ...formData,
          discord_id: item.discord_id || '',
          discord_username: item.username || '',
          rank: item.rank || 3,
        });
      } else if (settingsTab === 'REASONS') {
        setFormData({
          ...formData,
          reason: item.label,
        });
      }
    }
    setIsModalOpen(true);
  };

  const filteredPunishments = punishments.filter(p => {
    const matchesSearch = ((p.player_discord_id || '').toLowerCase().includes(searchTerm.toLowerCase())) || 
                          ((p.player_name || '').toLowerCase().includes(searchTerm.toLowerCase()));
    const matchesType = typeFilter === 'ALL' || p.type === typeFilter;
    return matchesSearch && matchesType;
  });

  const filteredWanted = wantedList.filter(w => {
    const matchesSearch = ((w.discord_username || '').toLowerCase().includes(wantedSearchTerm.toLowerCase())) || 
                         ((w.discord_id || '').toLowerCase().includes(wantedSearchTerm.toLowerCase())) ||
                         ((w.description || '').toLowerCase().includes(wantedSearchTerm.toLowerCase()));
    const matchesStatus = wantedFilter === 'ALL' || w.status === wantedFilter;
    return matchesSearch && matchesStatus;
  });

  const filteredBugs = bugs.filter(b => {
    const matchesSearch = ((b.title || '').toLowerCase().includes(bugsSearchTerm.toLowerCase())) || 
                         ((b.description || '').toLowerCase().includes(bugsSearchTerm.toLowerCase())) ||
                         ((b.reporter_name || '').toLowerCase().includes(bugsSearchTerm.toLowerCase()));
    const matchesStatus = bugsFilter === 'ALL' || b.status === bugsFilter;
    const matchesType = b.type === (feedbackTab === 'BUGS' ? 'BUG' : 'SUGGESTION');
    return matchesSearch && matchesStatus && matchesType;
  });

  const filteredLogs = logs.filter(l => {
    const matchesSearch = (l.admin_name?.toLowerCase().includes(logsSearchTerm.toLowerCase()) || false) || 
                         (l.action?.toLowerCase().includes(logsSearchTerm.toLowerCase()) || false) ||
                         (l.target_name?.toLowerCase().includes(logsSearchTerm.toLowerCase()) || false) ||
                         (l.details?.toLowerCase().includes(logsSearchTerm.toLowerCase()) || false);
    return matchesSearch;
  });

  const filteredAgendaItems = agendaItems.filter(m => {
    const matchesSearch = (m.title?.toLowerCase().includes(agendaSearchTerm.toLowerCase()) || false) || 
                         (m.description?.toLowerCase().includes(agendaSearchTerm.toLowerCase()) || false) ||
                         (m.organizer_name?.toLowerCase().includes(agendaSearchTerm.toLowerCase()) || false);
    const matchesFilter = agendaFilter === 'ALL' || m.category === agendaFilter;
    return matchesSearch && matchesFilter;
  });

  const isExpired = (date: string | null) => {
    if (!date) return false;
    return !isAfter(parseISO(date), new Date());
  };

  const activeWarns = formData.discord_id ? punishments.filter(p => 
    p.player_discord_id === formData.discord_id && 
    p.type === 'WARN'
  ).length : 0;

  const getTypeIcon = (type: PunishmentType) => {
    switch (type) {
      case 'WARN': return <AlertTriangle className="w-4 h-4 text-yellow-500" />;
      case 'BAN': return <Ban className="w-4 h-4 text-red-500" />;
      case 'WL-DOWN': return <UserMinus className="w-4 h-4 text-orange-500" />;
      case 'SUSPEND': return <Clock className="w-4 h-4 text-blue-500" />;
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-zinc-950 flex items-center justify-center">
        <div className="flex flex-col items-center gap-4">
          <div className="w-12 h-12 border-4 border-red-600 border-t-transparent rounded-full animate-spin"></div>
          <p className="text-zinc-500 font-medium animate-pulse">Ověřuji přístup...</p>
        </div>
      </div>
    );
  }

  if (!user || !isAdmin || !isVerified) {
    return (
      <div className="min-h-screen bg-zinc-950 flex flex-col items-center justify-center p-4 relative overflow-hidden">
        {/* Dekoratívne pozadie (Glow effect) */}
        <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[500px] h-[500px] bg-red-600/10 blur-[120px] rounded-full pointer-events-none"></div>
        
        <div className="relative z-10 w-full max-w-md">
          <div className="bg-zinc-900 border border-zinc-800 p-8 rounded-3xl shadow-2xl text-center backdrop-blur-sm bg-zinc-900/80">
            <div className="inline-flex bg-red-600 p-4 rounded-2xl shadow-xl shadow-red-900/40 mb-6 transform transition-transform hover:scale-110 duration-300">
              <Shield className="w-10 h-10 text-white" />
            </div>
            
            <h1 className="text-3xl font-black tracking-tight mb-2">Genk Admin Panel</h1>
            <p className="text-zinc-500 text-sm mb-8 font-medium">Zabezpečený prístup pre administrátorov</p>
            
            <div className="space-y-4">
              {!showEmailForm ? (
                <>
                  {/* Discord Button s efektami */}
                  <button 
                    onClick={handleLogin}
                    className="w-full bg-indigo-600 hover:bg-indigo-500 active:scale-[0.98] text-white font-bold py-4 rounded-2xl transition-all duration-200 flex items-center justify-center gap-3 shadow-lg shadow-indigo-900/20 group"
                  >
                    <svg className="w-6 h-6 fill-current transition-transform group-hover:rotate-12" viewBox="0 0 24 24">
                      <path d="M20.317 4.37a19.791 19.791 0 0 0-4.885-1.515.074.074 0 0 0-.079.037c-.21.375-.444.864-.608 1.25a18.27 18.27 0 0 0-5.487 0 12.64 12.64 0 0 0-.617-1.25.077.077 0 0 0-.079-.037A19.736 19.736 0 0 0 3.677 4.37a.07.07 0 0 0-.032.027C.533 9.046-.32 13.58.099 18.057a.082.082 0 0 0 .031.057 19.9 19.9 0 0 0 5.993 3.03.078.078 0 0 0 .084-.028 14.09 14.09 0 0 0 1.226-1.994.076.076 0 0 0-.041-.106 13.107 13.107 0 0 1-1.872-.892.077.077 0 0 1-.008-.128 10.2 10.2 0 0 0 .372-.292.074.074 0 0 1 .077-.01c3.928 1.793 8.18 1.793 12.062 0a.074.074 0 0 1 .078.01c.12.098.246.198.373.292a.077.077 0 0 1-.006.127 12.299 12.299 0 0 1-1.873.892.077.077 0 0 0-.041.107c.36.698.772 1.362 1.225 1.993a.076.076 0 0 0 .084.028 19.839 19.839 0 0 0 6.002-3.03.077.077 0 0 0 .032-.054c.5-5.177-.838-9.674-3.549-13.66a.061.061 0 0 0-.031-.03zM8.02 15.33c-1.183 0-2.157-1.085-2.157-2.419 0-1.333.956-2.419 2.157-2.419 1.21 0 2.176 1.096 2.157 2.42 0 1.333-.956 2.419-2.157 2.419zm7.975 0c-1.183 0-2.157-1.085-2.157-2.419 0-1.333.955-2.419 2.157-2.419 1.21 0 2.176 1.096 2.157 2.42 0 1.333-.946 2.419-2.157 2.419z"/>
                    </svg>
                    Prihlásiť cez Discord
                  </button>
                  
                  <div className="relative py-4">
                    <div className="absolute inset-0 flex items-center px-4"><span className="w-full border-t border-zinc-800"></span></div>
                    <div className="relative flex justify-center text-xs uppercase tracking-widest"><span className="bg-zinc-900 px-3 text-zinc-600 font-bold">Admin Login</span></div>
                  </div>

                  {/* Email Button s efektami */}
                  <button 
                    onClick={() => setShowEmailForm(true)}
                    className="w-full bg-zinc-800 hover:bg-zinc-700 active:scale-[0.98] text-white font-bold py-3 rounded-2xl transition-all duration-200 flex items-center justify-center gap-3 border border-zinc-700 hover:border-zinc-500"
                  >
                    <FileText className="w-5 h-5 text-zinc-500" />
                    Prihlásiť cez Email
                  </button>
                </>
              ) : (
                <form onSubmit={handleEmailLogin} className="space-y-4 animate-in fade-in slide-in-from-bottom-4 duration-300">
                  <div className="space-y-2 text-left">
                    <label className="text-[10px] font-bold text-zinc-500 uppercase tracking-widest ml-1">Email</label>
                    <input 
                      type="email" 
                      value={email}
                      onChange={(e) => setEmail(e.target.value)}
                      className="w-full bg-zinc-950 border border-zinc-800 rounded-xl py-3 px-4 text-sm focus:outline-none focus:ring-2 focus:ring-red-500/50 transition-all"
                      placeholder="admin@genk.rp"
                      required
                    />
                  </div>
                  <div className="space-y-2 text-left">
                    <label className="text-[10px] font-bold text-zinc-500 uppercase tracking-widest ml-1">Heslo</label>
                    <input 
                      type="password" 
                      value={password}
                      onChange={(e) => setPassword(e.target.value)}
                      className="w-full bg-zinc-950 border border-zinc-800 rounded-xl py-3 px-4 text-sm focus:outline-none focus:ring-2 focus:ring-red-500/50 transition-all"
                      placeholder="••••••••"
                      required
                    />
                  </div>
                  <div className="flex gap-2 pt-2">
                    <button 
                      type="button"
                      onClick={() => setShowEmailForm(false)}
                      className="flex-1 bg-zinc-800 hover:bg-zinc-700 text-white font-bold py-3 rounded-xl transition-all text-xs"
                    >
                      Späť
                    </button>
                    <button 
                      type="submit"
                      className="flex-[2] bg-red-600 hover:bg-red-500 text-white font-bold py-3 rounded-xl transition-all text-xs shadow-lg shadow-red-900/20"
                    >
                      {isSignUp ? 'Registrovať sa' : 'Prihlásiť sa'}
                    </button>
                  </div>
                  <button
                    type="button"
                    onClick={() => setIsSignUp(!isSignUp)}
                    className="text-[10px] font-bold text-zinc-500 hover:text-zinc-300 uppercase tracking-widest transition-colors mt-2"
                  >
                    {isSignUp ? 'Už máte účet? Prihláste sa' : 'Nemáte účet? Registrujte sa'}
                  </button>
                </form>
              )}
            </div>
            
            <div className="mt-8 pt-6 border-t border-zinc-800/50 flex flex-col items-center gap-2">
              <p className="text-[10px] text-zinc-600 uppercase tracking-[0.2em] font-bold">Zabezpečený systém Genk RP</p>
            </div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-zinc-950 text-zinc-100 font-sans selection:bg-red-500/30">
      {/* Header */}
      <header className="border-b border-zinc-800 bg-zinc-900/50 backdrop-blur-md sticky top-0 z-40">
        <div className="max-w-7xl mx-auto px-4 h-16 flex items-center justify-between">
          <div className="flex items-center gap-3 cursor-pointer" onClick={() => setActiveSection('DASHBOARD')}>
            <div className="bg-red-600 p-2 rounded-lg shadow-lg shadow-red-900/20">
              <Shield className="w-6 h-6 text-white" />
            </div>
            <div>
              <h1 className="font-bold text-lg tracking-tight">Genk Admin Panel</h1>
              <p className="text-xs text-zinc-500 uppercase tracking-widest font-semibold">Interní Systém</p>
            </div>
          </div>

          <div className="flex items-center gap-4">
            {activeSection !== 'DASHBOARD' && (
              <button 
                onClick={() => setActiveSection('DASHBOARD')}
                className="hidden md:flex items-center gap-2 text-sm text-zinc-400 hover:text-white transition-colors mr-4"
              >
                <ChevronLeft className="w-4 h-4" /> Zpět na výběr
              </button>
            )}
            {user ? (
              <div className="flex items-center gap-4">
                <div className="hidden md:block text-right">
                  <p className="text-sm font-medium">{user.user_metadata?.full_name || user.email}</p>
                  <p className="text-[10px] text-zinc-500 uppercase tracking-wider">
                    {isAdmin ? 'Administrátor' : 'Uživatel'}
                  </p>
                </div>
                {isAdmin && (
                  <button 
                    onClick={() => setActiveSection('SETTINGS')}
                    className={cn(
                      "p-2 rounded-full transition-colors",
                      activeSection === 'SETTINGS' ? "bg-red-600 text-white" : "text-zinc-400 hover:text-white hover:bg-zinc-800"
                    )}
                    title="Admin Nastavenia / Logy"
                  >
                    <Settings className="w-5 h-5" />
                  </button>
                )}
                <button 
                  onClick={(e) => {
                    e.stopPropagation();
                    handleLogout();
                  }}
                  className="p-2 hover:bg-zinc-800 rounded-full transition-colors text-zinc-400 hover:text-white"
                  title="Odhlásit se"
                >
                  <LogOut className="w-5 h-5" />
                </button>
              </div>
            ) : (
              <button 
                onClick={handleLogin}
                className="bg-indigo-600 hover:bg-indigo-700 text-white px-4 py-2 rounded-lg text-sm font-medium transition-all flex items-center gap-2"
              >
                Přihlásit přes Discord
              </button>
            )}
          </div>
        </div>
      </header>

      <main className="max-w-7xl mx-auto px-4 py-8">
        {activeSection === 'DASHBOARD' ? (
          <div className="flex flex-col items-center justify-center min-h-[60vh] space-y-12">
            {/* Statistics Row */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6 w-full max-w-5xl">
              <div className="bg-zinc-900 border border-zinc-800 p-6 rounded-3xl shadow-xl flex items-center gap-4">
                <div className="bg-red-500/10 p-4 rounded-2xl">
                  <Ban className="w-8 h-8 text-red-500" />
                </div>
                <div>
                  <p className="text-zinc-500 text-sm font-bold uppercase tracking-widest">Aktuálne Banov</p>
                  <p className="text-3xl font-black text-white">
                    {punishments.filter(p => p.type === 'BAN' && !isExpired(p.expiry_date)).length}
                  </p>
                </div>
              </div>
              <div className="bg-zinc-900 border border-zinc-800 p-6 rounded-3xl shadow-xl flex items-center gap-4">
                <div className="bg-yellow-500/10 p-4 rounded-2xl">
                  <ListTodo className="w-8 h-8 text-yellow-500" />
                </div>
                <div>
                  <p className="text-zinc-500 text-sm font-bold uppercase tracking-widest">Otevřená Agenda</p>
                  <p className="text-3xl font-black text-white">
                    {agendaItems.filter(m => m.status === 'INBOX' || m.status === 'AGENDA').length}
                  </p>
                </div>
              </div>
              <div className="bg-zinc-900 border border-zinc-800 p-6 rounded-3xl shadow-xl flex items-center gap-4">
                <div className="bg-orange-500/10 p-4 rounded-2xl">
                  <Eye className="w-8 h-8 text-orange-500" />
                </div>
                <div>
                  <p className="text-zinc-500 text-sm font-bold uppercase tracking-widest">Hráči na Watchliste</p>
                  <p className="text-3xl font-black text-white">
                    {wantedList.filter(w => w.status === 'ACTIVE').length}
                  </p>
                </div>
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6 w-full max-w-5xl">
              {/* Players Card */}
              <div className="group relative bg-zinc-900 border border-zinc-800 p-6 rounded-3xl hover:border-red-600/50 transition-all shadow-2xl flex flex-col">
                <button 
                  onClick={() => setActiveSection('PLAYERS')}
                  className="flex-1 text-left"
                >
                  <div className="flex items-start justify-between mb-4">
                    <div className="bg-red-600/10 p-3 rounded-2xl group-hover:bg-red-600 transition-all">
                      <Users className="w-6 h-6 text-red-500 group-hover:text-white" />
                    </div>
                    <ChevronRight className="w-5 h-5 text-zinc-600 group-hover:text-white transition-all" />
                  </div>
                  <h3 className="text-xl font-bold">Hráči</h3>
                  <p className="text-zinc-500 text-sm mt-2">Banlist a Watchlist pro sledování problémových hráčů.</p>
                </button>

                {isAdmin && (
                  <div className="mt-6 pt-6 border-t border-zinc-800 flex flex-col gap-2">
                    <button 
                      onClick={(e) => { e.stopPropagation(); setActiveSection('PLAYERS'); setPlayersTab('BANLIST'); resetForm(); setEditingItem(null); setIsModalOpen(true); }}
                      className="flex items-center justify-center gap-2 px-4 py-2 bg-red-600/10 border border-red-600/20 rounded-xl text-red-500 text-[10px] font-bold uppercase tracking-wider hover:bg-red-600 hover:text-white transition-all"
                    >
                      <Plus className="w-3.5 h-3.5" /> Rychlý Ban
                    </button>
                    <button 
                      onClick={(e) => { e.stopPropagation(); setActiveSection('PLAYERS'); setPlayersTab('WATCHLIST'); resetForm(); setEditingItem(null); setIsModalOpen(true); }}
                      className="flex items-center justify-center gap-2 px-4 py-2 bg-orange-600/10 border border-orange-600/20 rounded-xl text-orange-500 text-[10px] font-bold uppercase tracking-wider hover:bg-orange-600 hover:text-white transition-all"
                    >
                      <Plus className="w-3.5 h-3.5" /> Přidat na Watchlist
                    </button>
                  </div>
                )}
              </div>

              {/* Feedback Card */}
              {userRank <= 3 && (
                <div 
                  className="relative group bg-zinc-900 border border-zinc-800 p-6 rounded-3xl text-left shadow-2xl overflow-hidden"
                >
                  <div className="absolute inset-0 bg-black/60 backdrop-blur-sm flex flex-col items-center justify-center z-10">
                    <Lock className="w-8 h-8 text-zinc-400 mb-2" />
                    <span className="text-zinc-300 font-bold tracking-widest">IN DEVELOPMENT</span>
                  </div>
                  <div className="opacity-50">
                    <div className="flex items-start justify-between mb-4">
                      <div className="bg-blue-600/10 p-3 rounded-2xl">
                        <BugIcon className="w-6 h-6 text-blue-500" />
                      </div>
                      <ChevronRight className="w-5 h-5 text-zinc-600" />
                    </div>
                    <h3 className="text-xl font-bold">Zpětná vazba</h3>
                    <p className="text-zinc-500 text-sm mt-2">Hlášení chyb a návrhy na zlepšení serveru.</p>
                  </div>
                </div>
              )}

              {/* Agenda Card */}
              {userRank <= 3 && (
                <button 
                  onClick={() => setActiveSection('AGENDA')}
                  className="group bg-zinc-900 border border-zinc-800 p-6 rounded-3xl hover:border-purple-600/50 transition-all text-left shadow-2xl"
                >
                  <div className="flex items-start justify-between mb-4">
                    <div className="bg-purple-600/10 p-3 rounded-2xl group-hover:bg-purple-600 transition-all">
                      <Calendar className="w-6 h-6 text-purple-500 group-hover:text-white" />
                    </div>
                    <ChevronRight className="w-5 h-5 text-zinc-600 group-hover:text-white transition-all" />
                  </div>
                  <h3 className="text-xl font-bold">Agenda</h3>
                  <p className="text-zinc-500 text-sm mt-2">Plánované porady, zápisy a důležité výstupy.</p>
                </button>
              )}

              {/* Logs Card (Rank 2) */}
              {userRank === 2 && (
                <button 
                  onClick={() => { setActiveSection('SETTINGS'); setSettingsTab('LOGS'); }}
                  className="group bg-zinc-900 border border-zinc-800 p-6 rounded-3xl hover:border-red-600/50 transition-all text-left shadow-2xl"
                >
                  <div className="flex items-start justify-between mb-4">
                    <div className="bg-red-600/10 p-3 rounded-2xl group-hover:bg-red-600 transition-all">
                      <History className="w-6 h-6 text-red-500 group-hover:text-white" />
                    </div>
                    <ChevronRight className="w-5 h-5 text-zinc-600 group-hover:text-white transition-all" />
                  </div>
                  <h3 className="text-xl font-bold">Systémové Logy</h3>
                  <p className="text-zinc-500 text-sm mt-2">Sledování administrátorských akcí a změn v systému.</p>
                </button>
              )}
            </div>
          </div>
        ) : activeSection === 'SETTINGS' ? (
          <div className="space-y-6">
            <div className="flex items-center justify-between">
              <h2 className="text-xl font-bold flex items-center gap-2">
                <Settings className="w-5 h-5 text-indigo-500" /> Nastavení Systému
              </h2>
              <button 
                onClick={() => setActiveSection('DASHBOARD')}
                className="text-xs text-zinc-500 hover:text-white flex items-center gap-1 transition-colors"
              >
                <ChevronLeft className="w-3 h-3" /> Zpět na Dashboard
              </button>
            </div>

            <div className="flex gap-2 p-1 bg-zinc-900 border border-zinc-800 rounded-xl w-fit">
              <button 
                onClick={() => setSettingsTab('LOGS')}
                className={cn(
                  "px-4 py-1.5 rounded-lg text-xs font-bold transition-all",
                  settingsTab === 'LOGS' ? "bg-zinc-800 text-white" : "text-zinc-500 hover:text-zinc-300"
                )}
              >
                Systémové Logy
              </button>
              <button 
                onClick={() => setSettingsTab('ADMINS')}
                className={cn(
                  "px-4 py-1.5 rounded-lg text-xs font-bold transition-all",
                  settingsTab === 'ADMINS' ? "bg-zinc-800 text-white" : "text-zinc-500 hover:text-zinc-300"
                )}
              >
                Správa Adminů
              </button>
              <button 
                onClick={() => setSettingsTab('REASONS')}
                className={cn(
                  "px-4 py-1.5 rounded-lg text-xs font-bold transition-all",
                  settingsTab === 'REASONS' ? "bg-zinc-800 text-white" : "text-zinc-500 hover:text-zinc-300"
                )}
              >
                Důvody Trestů
              </button>
              <button 
                onClick={() => setSettingsTab('SYSTEM')}
                className={cn(
                  "px-4 py-1.5 rounded-lg text-xs font-bold transition-all",
                  settingsTab === 'SYSTEM' ? "bg-zinc-800 text-white" : "text-zinc-500 hover:text-zinc-300"
                )}
              >
                Systém
              </button>
              <button 
                onClick={() => setSettingsTab('ACCOUNT')}
                className={cn(
                  "px-4 py-1.5 rounded-lg text-xs font-bold transition-all",
                  settingsTab === 'ACCOUNT' ? "bg-zinc-800 text-white" : "text-zinc-500 hover:text-zinc-300"
                )}
              >
                Můj Účet
              </button>
            </div>

            {settingsTab === 'LOGS' ? (
              <div className="space-y-4">
                <div className="relative max-w-md">
                  <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-zinc-500" />
                  <input 
                    type="text"
                    placeholder="Hledat v lozích..."
                    value={logsSearchTerm}
                    onChange={(e) => setLogsSearchTerm(e.target.value)}
                    className="w-full bg-zinc-900 border border-zinc-800 rounded-xl py-2 pl-9 pr-4 text-sm focus:outline-none focus:border-zinc-600 transition-all"
                  />
                </div>
                <div className="bg-zinc-900 border border-zinc-800 rounded-2xl overflow-hidden shadow-xl">
                  <div className="overflow-x-auto">
                    <table className="w-full text-left border-collapse">
                      <thead>
                        <tr className="bg-zinc-800/50 border-b border-zinc-800">
                          <th className="px-4 py-3 text-[10px] font-bold uppercase tracking-widest text-zinc-500">Admin</th>
                          <th className="px-4 py-3 text-[10px] font-bold uppercase tracking-widest text-zinc-500">Akce</th>
                          <th className="px-4 py-3 text-[10px] font-bold uppercase tracking-widest text-zinc-500">Cíl</th>
                          <th className="px-4 py-3 text-[10px] font-bold uppercase tracking-widest text-zinc-500">Datum</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-zinc-800">
                        {logs.filter(l => 
                          l.admin_name.toLowerCase().includes(logsSearchTerm.toLowerCase()) ||
                          l.action.toLowerCase().includes(logsSearchTerm.toLowerCase()) ||
                          l.target_name.toLowerCase().includes(logsSearchTerm.toLowerCase())
                        ).map((log) => (
                          <tr key={log.id} className="hover:bg-zinc-800/30 transition-colors">
                            <td className="px-4 py-3">
                              <div className="flex flex-col">
                                <span className="text-xs font-bold">{log.admin_name}</span>
                                <span className="text-[10px] text-zinc-500 font-mono">{log.admin_discord_id}</span>
                              </div>
                            </td>
                            <td className="px-4 py-3">
                              <span className="text-xs text-zinc-300">{log.action}</span>
                            </td>
                            <td className="px-4 py-3">
                              <span className="text-xs text-zinc-400">{log.target_name}</span>
                            </td>
                            <td className="px-4 py-3">
                              <span className="text-[10px] text-zinc-500">{format(parseISO(log.created_at), 'd. MMM HH:mm', { locale: cs })}</span>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              </div>
            ) : settingsTab === 'ADMINS' ? (
              <div className="space-y-4">
                <div className="flex justify-between items-center">
                  <p className="text-xs text-zinc-500">Seznam uživatelů s přístupem do admin panelu.</p>
                  <button 
                    onClick={() => { setEditingItem(null); setFormData({ ...formData, discord_id: '', discord_username: '' }); setIsModalOpen(true); }}
                    className="bg-indigo-600 hover:bg-indigo-700 text-white px-3 py-1.5 rounded-lg text-[10px] font-bold uppercase tracking-wider transition-all flex items-center gap-2"
                  >
                    <UserPlus className="w-3 h-3" /> Přidat Admina
                  </button>
                </div>
                <div className="bg-zinc-900 border border-zinc-800 rounded-2xl overflow-hidden shadow-xl">
                  <div className="overflow-x-auto">
                    <table className="w-full text-left border-collapse">
                      <thead>
                        <tr className="bg-zinc-800/50 border-b border-zinc-800">
                          <th className="px-4 py-3 text-[10px] font-bold uppercase tracking-widest text-zinc-500">Uživatel</th>
                          <th className="px-4 py-3 text-[10px] font-bold uppercase tracking-widest text-zinc-500">Rank</th>
                          <th className="px-4 py-3 text-[10px] font-bold uppercase tracking-widest text-zinc-500">Přidán</th>
                          <th className="px-4 py-3 text-[10px] font-bold uppercase tracking-widest text-zinc-500 text-right">Akce</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-zinc-800">
                        {admins.map((admin) => (
                          <tr key={admin.id} className="hover:bg-zinc-800/30 transition-colors group">
                            <td className="px-4 py-3">
                              <div className="flex flex-col">
                                <span className="text-xs font-bold">{admin.username}</span>
                                <span className="text-[10px] text-zinc-500 font-mono">{admin.discord_id}</span>
                              </div>
                            </td>
                            <td className="px-4 py-3">
                              <span className={`px-2 py-0.5 rounded-md text-[9px] font-bold uppercase tracking-widest ${
                                admin.rank === 1 ? 'bg-red-500/20 text-red-400' :
                                admin.rank === 2 ? 'bg-orange-500/20 text-orange-400' :
                                'bg-zinc-800 text-zinc-400'
                              }`}>
                                {admin.rank === 1 ? 'Majitel' : admin.rank === 2 ? 'Vedení' : 'Admin'}
                              </span>
                            </td>
                            <td className="px-4 py-3">
                              <div className="flex flex-col">
                                <span className="text-[10px] text-zinc-400">{format(parseISO(admin.created_at), 'd. MMMM yyyy', { locale: cs })}</span>
                                <span className="text-[9px] text-zinc-600">od {admin.added_by}</span>
                              </div>
                            </td>
                            <td className="px-4 py-3 text-right">
                              <div className="flex items-center justify-end gap-2">
                                <button 
                                  onClick={(e) => { e.stopPropagation(); handleEdit(admin); }}
                                  className="opacity-0 group-hover:opacity-100 p-1.5 text-zinc-500 hover:text-blue-500 transition-all"
                                >
                                  <Edit className="w-3.5 h-3.5" />
                                </button>
                                <button 
                                  onClick={(e) => { e.stopPropagation(); handleDelete(admin.id); }}
                                  className="opacity-0 group-hover:opacity-100 p-1.5 text-zinc-500 hover:text-red-500 transition-all"
                                >
                                  <Trash2 className="w-3.5 h-3.5" />
                                </button>
                              </div>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              </div>
            ) : settingsTab === 'REASONS' ? (
              <div className="space-y-4">
                <div className="flex justify-between items-center">
                  <p className="text-xs text-zinc-500">Seznam předdefinovaných důvodů pro tresty.</p>
                  <button 
                    onClick={() => { setEditingItem(null); setFormData({ ...formData, reason: '' }); setIsModalOpen(true); }}
                    className="bg-indigo-600 hover:bg-indigo-700 text-white px-3 py-1.5 rounded-lg text-[10px] font-bold uppercase tracking-wider transition-all flex items-center gap-2"
                  >
                    <Plus className="w-3 h-3" /> Přidat Důvod
                  </button>
                </div>
                <div className="bg-zinc-900 border border-zinc-800 rounded-2xl overflow-hidden shadow-xl">
                  <div className="overflow-x-auto">
                    <table className="w-full text-left border-collapse">
                      <thead>
                        <tr className="bg-zinc-800/50 border-b border-zinc-800">
                          <th className="px-4 py-3 text-[10px] font-bold uppercase tracking-widest text-zinc-500">Důvod</th>
                          <th className="px-4 py-3 text-[10px] font-bold uppercase tracking-widest text-zinc-500">Datum Vytvoření</th>
                          <th className="px-4 py-3 text-[10px] font-bold uppercase tracking-widest text-zinc-500 text-right">Akce</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-zinc-800">
                        {punishmentReasons.map((reason) => (
                          <tr key={reason.id} className="hover:bg-zinc-800/30 transition-colors group">
                            <td className="px-4 py-3">
                              <span className="text-xs font-bold">{reason.label}</span>
                            </td>
                            <td className="px-4 py-3">
                              <span className="text-[10px] text-zinc-400">{format(parseISO(reason.created_at), 'd. MMMM yyyy', { locale: cs })}</span>
                            </td>
                            <td className="px-4 py-3 text-right">
                              <div className="flex items-center justify-end gap-2">
                                <button 
                                  onClick={(e) => { e.stopPropagation(); handleEdit(reason); }}
                                  className="opacity-0 group-hover:opacity-100 p-1.5 text-zinc-500 hover:text-blue-500 transition-all"
                                >
                                  <Edit className="w-3.5 h-3.5" />
                                </button>
                                <button 
                                  onClick={(e) => { e.stopPropagation(); handleDelete(reason.id); }}
                                  className="opacity-0 group-hover:opacity-100 p-1.5 text-zinc-500 hover:text-red-500 transition-all"
                                >
                                  <Trash2 className="w-3.5 h-3.5" />
                                </button>
                              </div>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              </div>
            ) : settingsTab === 'SYSTEM' ? (
              <div className="space-y-6">
                <div className="bg-zinc-900 border border-zinc-800 rounded-2xl p-6 shadow-xl">
                  <h3 className="text-lg font-bold text-white mb-4 flex items-center gap-2">
                    <Settings className="w-5 h-5 text-indigo-500" /> Discord Integrace (Webhooks)
                  </h3>
                  <p className="text-xs text-zinc-500 mb-6">Nastavte Discord Webhook URL adresy pro automatické odesílání notifikací do různých kanálů.</p>
                  
                  <div className="space-y-6">
                    {[
                      { key: 'agenda_webhook', label: 'Agenda Webhook', desc: 'Notifikace při vytvoření nového podnětu v Agendě.' },
                      { key: 'banlist_webhook', label: 'Banlist & Tresty Webhook', desc: 'Notifikace při uložení trestu (Ban, Warn, atd.).' },
                      { key: 'feedback_webhook', label: 'Zpětná vazba Webhook', desc: 'Notifikace při odeslání zpětné vazby / bug reportu.' }
                    ].map(webhook => (
                      <div key={webhook.key} className="bg-zinc-950/50 p-4 rounded-xl border border-zinc-800/50">
                        <label className="block text-sm font-bold text-zinc-300 mb-1">{webhook.label}</label>
                        <p className="text-[10px] text-zinc-500 mb-3">{webhook.desc}</p>
                        <div className="flex gap-3">
                          <input 
                            type="text" 
                            value={systemSettings.find(s => s.key === webhook.key)?.value || ''}
                            onChange={(e) => {
                              const val = e.target.value;
                              setSystemSettings(prev => {
                                const existing = prev.find(s => s.key === webhook.key);
                                if (existing) return prev.map(s => s.key === webhook.key ? { ...s, value: val } : s);
                                return [...prev, { key: webhook.key, value: val }];
                              });
                            }}
                            placeholder="https://discord.com/api/webhooks/..."
                            className="flex-1 bg-zinc-900 border border-zinc-800 rounded-xl py-2 px-4 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500/50 transition-all font-mono"
                          />
                          <button 
                            onClick={async () => {
                              const webhookUrl = systemSettings.find(s => s.key === webhook.key)?.value;
                              if (!webhookUrl) {
                                toast.error('Webhook URL není nastavena.');
                                return;
                              }
                              try {
                                const res = await fetch(webhookUrl, {
                                  method: 'POST',
                                  headers: { 'Content-Type': 'application/json' },
                                  body: JSON.stringify({
                                    content: "🔔 **Testovací zpráva z Admin Panelu**",
                                    embeds: [{
                                      title: `${webhook.label} je správně nastaven!`,
                                      description: webhook.desc,
                                      color: 5814783
                                    }]
                                  })
                                });
                                if (res.ok) {
                                  toast.success('Testovací zpráva byla odeslána.');
                                } else {
                                  toast.error('Chyba při odesílání zprávy.');
                                }
                              } catch (e) {
                                toast.error('Chyba při odesílání zprávy.');
                              }
                            }}
                            className="bg-zinc-800 hover:bg-zinc-700 text-white px-4 py-2 rounded-xl text-xs font-bold transition-all whitespace-nowrap"
                          >
                            Testovat
                          </button>
                        </div>
                      </div>
                    ))}
                  </div>
                  <button 
                    onClick={async () => {
                      setIsSubmitting(true);
                      try {
                        const promises = systemSettings.map(setting => 
                          supabase.from('system_settings').upsert({ key: setting.key, value: setting.value })
                        );
                        await Promise.all(promises);
                        toast.success('Nastavení bylo úspěšně uloženo!');
                      } catch (error) {
                        console.error('Error saving settings:', error);
                        toast.error('Chyba při ukládání nastavení.');
                      } finally {
                        setIsSubmitting(false);
                      }
                    }}
                    disabled={isSubmitting}
                    className="mt-6 w-full py-3 bg-indigo-600 hover:bg-indigo-500 text-white font-bold rounded-xl transition-all shadow-lg shadow-indigo-500/20 disabled:opacity-50 flex items-center justify-center gap-2"
                  >
                    {isSubmitting ? (
                      <>
                        <Loader2 className="w-5 h-5 animate-spin" />
                        Ukládám...
                      </>
                    ) : (
                      'Uložit nastavení'
                    )}
                  </button>
                </div>
              </div>
            ) : (
              <div className="space-y-6">
                <div className="bg-zinc-900/50 border border-zinc-800 p-6 rounded-2xl">
                  <h3 className="text-lg font-bold mb-4 flex items-center gap-2">
                    <Shield className="w-5 h-5 text-red-500" />
                    Změna hesla
                  </h3>
                  <div className="space-y-4">
                    <div>
                      <label className="block text-xs font-bold text-zinc-500 uppercase tracking-widest mb-1.5">Nové heslo</label>
                      <input 
                        type="password" 
                        className="w-full bg-zinc-950 border border-zinc-800 rounded-xl py-2 px-4 text-sm focus:outline-none focus:ring-2 focus:ring-red-500/50 transition-all"
                        value={newPassword}
                        onChange={(e) => setNewPassword(e.target.value)}
                        placeholder="••••••••"
                      />
                    </div>
                    <div>
                      <label className="block text-xs font-bold text-zinc-500 uppercase tracking-widest mb-1.5">Potvrdit heslo</label>
                      <input 
                        type="password" 
                        className="w-full bg-zinc-950 border border-zinc-800 rounded-xl py-2 px-4 text-sm focus:outline-none focus:ring-2 focus:ring-red-500/50 transition-all"
                        value={confirmPassword}
                        onChange={(e) => setConfirmPassword(e.target.value)}
                        placeholder="••••••••"
                      />
                    </div>
                    <button 
                      onClick={handleUpdatePassword}
                      disabled={isUpdatingPassword}
                      className="w-full bg-red-600 hover:bg-red-500 disabled:opacity-50 text-white font-bold py-3 rounded-xl transition-all shadow-lg shadow-red-900/20 flex items-center justify-center gap-2"
                    >
                      {isUpdatingPassword ? (
                        <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                      ) : (
                        <Key className="w-4 h-4" />
                      )}
                      Aktualizovat heslo
                    </button>
                  </div>
                </div>

                <div className="bg-zinc-900/50 border border-zinc-800 p-6 rounded-2xl">
                  <h3 className="text-lg font-bold mb-4 flex items-center gap-2">
                    <Users className="w-5 h-5 text-zinc-500" />
                    Informace o účtu
                  </h3>
                  <div className="space-y-2 text-sm">
                    <div className="flex justify-between py-2 border-b border-zinc-800/50">
                      <span className="text-zinc-500">Email:</span>
                      <span className="text-white font-medium">{user?.email}</span>
                    </div>
                    <div className="flex justify-between py-2 border-b border-zinc-800/50">
                      <span className="text-zinc-500">ID:</span>
                      <span className="text-zinc-400 font-mono text-xs">{user?.id}</span>
                    </div>
                    <div className="flex justify-between py-2">
                      <span className="text-zinc-500">Rank:</span>
                      <span className="text-red-500 font-bold">
                        {userRank === 1 ? 'Majitel' : userRank === 2 ? 'Vedení' : 'Admin'}
                      </span>
                    </div>
                  </div>
                </div>
              </div>
            )}
          </div>
        ) : activeSection === 'PLAYERS' ? (
          <div className="space-y-6">
            <div className="flex flex-col md:flex-row gap-4 items-center justify-between mb-6">
              <div className="flex items-center gap-4 w-full md:w-auto">
                <h2 className="text-xl font-bold flex items-center gap-2">
                  <Users className="w-5 h-5 text-indigo-500" /> Správa Hráčů
                </h2>
                <button 
                  onClick={() => setActiveSection('DASHBOARD')}
                  className="text-xs text-zinc-500 hover:text-white flex items-center gap-1 transition-colors ml-4"
                >
                  <ChevronLeft className="w-3 h-3" /> Zpět na Dashboard
                </button>
                <div className="h-4 w-px bg-zinc-800 hidden md:block" />
                <div className="flex gap-1 p-1 bg-zinc-900 border border-zinc-800 rounded-xl">
                  <button 
                    onClick={() => setPlayersTab('BANLIST')}
                    className={cn(
                      "px-4 py-1.5 rounded-lg text-[10px] font-bold uppercase tracking-wider transition-all",
                      playersTab === 'BANLIST' ? "bg-red-600 text-white shadow-lg shadow-red-900/20" : "text-zinc-500 hover:text-zinc-300"
                    )}
                  >
                    Banlist
                  </button>
                  <button 
                    onClick={() => setPlayersTab('WATCHLIST')}
                    className={cn(
                      "px-4 py-1.5 rounded-lg text-[10px] font-bold uppercase tracking-wider transition-all",
                      playersTab === 'WATCHLIST' ? "bg-orange-600 text-white shadow-lg shadow-orange-900/20" : "text-zinc-500 hover:text-zinc-300"
                    )}
                  >
                    Watchlist
                  </button>
                </div>
              </div>

              {isAdmin && (
                <button 
                  onClick={() => { resetForm(); setEditingItem(null); setIsModalOpen(true); }}
                  className={cn(
                    "w-full md:w-auto text-white px-4 py-1.5 rounded-lg text-xs font-bold transition-all flex items-center justify-center gap-2 shadow-lg",
                    playersTab === 'BANLIST' ? "bg-red-600 hover:bg-red-700 shadow-red-900/20" : "bg-orange-600 hover:bg-orange-700 shadow-orange-900/20"
                  )}
                >
                  <Plus className="w-3.5 h-3.5" /> {playersTab === 'BANLIST' ? 'Přidat Trest' : 'Přidat na Watchlist'}
                </button>
              )}
            </div>

            {playersTab === 'BANLIST' ? (
              <>
                <div className="flex flex-col md:flex-row gap-4 mb-6 items-center justify-between">
                  <div className="flex items-center gap-2 w-full md:w-auto">
                    <div className="relative flex-1 md:w-64">
                      <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-zinc-500" />
                      <input 
                        type="text" 
                        placeholder="Hledat uživatele..." 
                        className="w-full bg-zinc-900 border border-zinc-800 rounded-lg pl-9 pr-4 py-1.5 text-xs focus:ring-1 focus:ring-red-500 outline-none transition-all"
                        value={searchTerm}
                        onChange={(e) => setSearchTerm(e.target.value)}
                      />
                    </div>
                    <select 
                      className="bg-zinc-900 border border-zinc-800 rounded-lg px-3 py-1.5 text-xs focus:ring-1 focus:ring-red-500 outline-none transition-all cursor-pointer"
                      value={typeFilter}
                      onChange={(e) => setTypeFilter(e.target.value)}
                    >
                      <option value="ALL">Všechny</option>
                      <option value="WARN">Warn</option>
                      <option value="BAN">Ban</option>
                      <option value="WL-DOWN">WL-Down</option>
                      <option value="SUSPEND">Suspend</option>
                    </select>
                  </div>
                </div>

                <div className="space-y-4">
                  {loading ? (
                    <div className="text-center py-12 text-zinc-500 animate-pulse">Načítám záznamy...</div>
                  ) : filteredPunishments.length === 0 ? (
                    <EmptyState icon={Shield} title="Zatím zde nejsou žádné záznamy" description="Seznam trestů je momentálně prázdný." />
                  ) : (
                    <div className="flex flex-col gap-1">
                      {filteredPunishments.map((p) => {
                        const expired = isExpired(p.expiry_date);
                        const isBan = p.type === 'BAN';
                        const proofUrls = Array.isArray(p.proof_url) ? p.proof_url : (typeof p.proof_url === 'string' && p.proof_url ? [p.proof_url] : []);
                        
                        return (
                          <div 
                            key={p.id} 
                            className="group flex items-center justify-between bg-zinc-950 hover:bg-zinc-900 border border-zinc-800/50 hover:border-zinc-700 rounded-lg py-3 px-4 cursor-pointer transition-all"
                            onClick={() => setViewingPunishment(p)}
                          >
                            <div className="flex items-center gap-4 flex-1 min-w-0">
                              <div className="flex items-center gap-3 w-48 shrink-0">
                                <div className={cn(
                                  "w-2 h-2 rounded-full",
                                  p.type === 'BAN' ? "bg-red-500" :
                                  p.type === 'WARN' ? "bg-orange-500" :
                                  p.type === 'SUSPEND' ? "bg-purple-500" :
                                  p.type === 'WL-DOWN' ? "bg-blue-500" :
                                  "bg-zinc-500"
                                )} />
                                <span className="text-sm font-bold text-zinc-100 truncate">
                                  {p.player_name || 'Neznámý'}
                                </span>
                              </div>
                              
                              <div className="flex-1 min-w-0 flex items-center gap-2">
                                <span className="text-[10px] font-bold text-zinc-500 uppercase tracking-wider shrink-0">{p.type}</span>
                                <span className="text-sm text-zinc-300 truncate">{escapeHtml(p.reason)}</span>
                              </div>
                            </div>
                            
                            <div className="flex items-center gap-4 shrink-0">
                              {proofUrls.length > 0 && (
                                <div className="flex items-center gap-1 text-zinc-500" title="Obsahuje důkazy">
                                  <LinkIcon className="w-3.5 h-3.5" />
                                  <span className="text-[10px] font-bold">{proofUrls.length}</span>
                                </div>
                              )}
                              
                              <div className="w-24 text-right">
                                {p.expiry_date ? (
                                  <span className={cn(
                                    "text-[10px] font-bold uppercase",
                                    expired ? "text-zinc-600" : "text-green-500"
                                  )}>
                                    {expired ? 'Vypršelo' : format(parseISO(p.expiry_date), 'dd.MM.yyyy')}
                                  </span>
                                ) : (
                                  <span className="text-[10px] font-bold uppercase text-red-500">
                                    Permanentní
                                  </span>
                                )}
                              </div>
                              
                              <div className="w-32 text-right">
                                <span className="text-xs text-zinc-500 truncate block">{p.admin_name}</span>
                              </div>
                              
                              {isAdmin && (
                                <button 
                                  onClick={(e) => { e.stopPropagation(); handleDelete(p.id); }} 
                                  className="p-1.5 opacity-0 group-hover:opacity-100 bg-zinc-800 hover:bg-zinc-700 rounded-md text-zinc-400 hover:text-red-500 transition-all ml-2"
                                >
                                  <Trash2 className="w-3.5 h-3.5" />
                                </button>
                              )}
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  )}
                </div>
              </>
            ) : (
              <>
                <div className="flex flex-col md:flex-row gap-4 mb-6 items-center justify-between">
                  <div className="flex items-center gap-2 w-full md:w-auto">
                    <div className="relative flex-1 md:w-64">
                      <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-zinc-500" />
                      <input 
                        type="text" 
                        placeholder="Hledat na watchlistu..." 
                        className="w-full bg-zinc-900 border border-zinc-800 rounded-lg pl-9 pr-4 py-1.5 text-xs focus:ring-1 focus:ring-orange-500 outline-none transition-all"
                        value={wantedSearchTerm}
                        onChange={(e) => setWantedSearchTerm(e.target.value)}
                      />
                    </div>
                    <select 
                      className="bg-zinc-900 border border-zinc-800 rounded-lg px-3 py-1.5 text-xs focus:ring-1 focus:ring-orange-500 outline-none transition-all cursor-pointer"
                      value={wantedFilter}
                      onChange={(e) => setWantedFilter(e.target.value)}
                    >
                      <option value="ALL">Všechny</option>
                      <option value="ACTIVE">Aktivní</option>
                      <option value="INACTIVE">Neaktivní</option>
                    </select>
                  </div>
                </div>

                <div className="space-y-4">
                  {filteredWanted.length === 0 ? (
                    <EmptyState icon={Eye} title="Zatím zde nejsou žádné záznamy" description="Watchlist je momentálně prázdný." />
                  ) : (
                    <div className="flex flex-col gap-1">
                      {filteredWanted.map((w) => (
                        <div 
                          key={w.id} 
                          className="group flex items-center justify-between bg-zinc-950 hover:bg-zinc-900 border border-zinc-800/50 hover:border-zinc-700 rounded-lg py-3 px-4 cursor-pointer transition-all"
                          onClick={() => setViewingWanted(w)}
                        >
                          <div className="flex items-center gap-4 flex-1 min-w-0">
                            <div className="flex items-center gap-3 w-48 shrink-0">
                              <div className={cn(
                                "w-2 h-2 rounded-full",
                                w.danger_level === 'EXTREME' ? "bg-red-500" :
                                w.danger_level === 'HIGH' ? "bg-orange-500" :
                                w.danger_level === 'MEDIUM' ? "bg-yellow-500" : "bg-zinc-500"
                              )} />
                              <span className="text-sm font-bold text-zinc-100 truncate">
                                {w.discord_username || 'Neznámý'}
                              </span>
                            </div>
                            
                            <div className="flex-1 min-w-0 flex items-center gap-2">
                              <span className={cn(
                                "text-[10px] font-bold uppercase tracking-wider shrink-0",
                                w.status === 'ACTIVE' ? "text-green-500" : "text-zinc-500"
                              )}>
                                {w.status}
                              </span>
                              {w.whitelist_status !== 'NONE' && (
                                <span className={cn(
                                  "text-[10px] font-bold uppercase tracking-wider shrink-0",
                                  w.whitelist_status === 'REVOKED' ? "text-red-500" : "text-yellow-500"
                                )}>
                                  WL: {w.whitelist_status}
                                </span>
                              )}
                              <span className="text-sm text-zinc-300 truncate ml-2">{escapeHtml(w.description)}</span>
                            </div>
                          </div>
                          
                          <div className="flex items-center gap-4 shrink-0">
                            <div className="w-24 text-right">
                              <span className="text-[10px] font-bold uppercase text-zinc-500">
                                {format(parseISO(w.created_at), 'dd.MM.yyyy')}
                              </span>
                            </div>
                            
                            {isAdmin && (
                              <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-all ml-2">
                                <button 
                                  onClick={(e) => { e.stopPropagation(); handleEdit(w); }} 
                                  className="p-1.5 bg-zinc-800 hover:bg-zinc-700 rounded-md text-zinc-400 hover:text-white transition-all"
                                >
                                  <Edit2 className="w-3.5 h-3.5" />
                                </button>
                                <button 
                                  onClick={(e) => { e.stopPropagation(); handleDelete(w.id); }} 
                                  className="p-1.5 bg-zinc-800 hover:bg-zinc-700 rounded-md text-zinc-400 hover:text-red-500 transition-all"
                                >
                                  <Trash2 className="w-3.5 h-3.5" />
                                </button>
                              </div>
                            )}
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              </>
            )}
          </div>
        ) : activeSection === 'FEEDBACK' ? (
          <div className="space-y-6">
            <div className="flex flex-col md:flex-row gap-4 items-center justify-between mb-6">
              <div className="flex items-center gap-4 w-full md:w-auto">
                <h2 className="text-xl font-bold flex items-center gap-2">
                  <MessageSquare className="w-5 h-5 text-blue-500" /> Feedback
                </h2>
                <button 
                  onClick={() => setActiveSection('DASHBOARD')}
                  className="text-xs text-zinc-500 hover:text-white flex items-center gap-1 transition-colors ml-4"
                >
                  <ChevronLeft className="w-3 h-3" /> Zpět na Dashboard
                </button>
                <div className="h-4 w-px bg-zinc-800 hidden md:block" />
                <div className="flex gap-1 p-1 bg-zinc-900 border border-zinc-800 rounded-xl">
                  <button 
                    onClick={() => setFeedbackTab('BUGS')}
                    className={cn(
                      "px-4 py-1.5 rounded-lg text-[10px] font-bold uppercase tracking-wider transition-all",
                      feedbackTab === 'BUGS' ? "bg-blue-600 text-white shadow-lg shadow-blue-900/20" : "text-zinc-500 hover:text-zinc-300"
                    )}
                  >
                    Bugs
                  </button>
                  <button 
                    onClick={() => setFeedbackTab('SUGGESTIONS')}
                    className={cn(
                      "px-4 py-1.5 rounded-lg text-[10px] font-bold uppercase tracking-wider transition-all",
                      feedbackTab === 'SUGGESTIONS' ? "bg-emerald-600 text-white shadow-lg shadow-emerald-900/20" : "text-zinc-500 hover:text-zinc-300"
                    )}
                  >
                    Návrhy
                  </button>
                </div>
              </div>

              {isAdmin && (
                <button 
                  onClick={() => { resetForm(); setEditingItem(null); setIsModalOpen(true); }}
                  className={cn(
                    "w-full md:w-auto text-white px-4 py-1.5 rounded-lg text-xs font-bold transition-all flex items-center justify-center gap-2 shadow-lg",
                    feedbackTab === 'BUGS' ? "bg-blue-600 hover:bg-blue-700 shadow-blue-900/20" : "bg-emerald-600 hover:bg-emerald-700 shadow-emerald-900/20"
                  )}
                >
                  <Plus className="w-3.5 h-3.5" /> {feedbackTab === 'BUGS' ? 'Nahlásit Bug' : 'Přidat Návrh'}
                </button>
              )}
            </div>

            <div className="flex flex-col md:flex-row gap-4 mb-6 items-center justify-between">
              <div className="flex items-center gap-2 w-full md:w-auto">
                <div className="relative flex-1 md:w-64">
                  <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-zinc-500" />
                  <input 
                    type="text" 
                    placeholder="Hledat..." 
                    className="w-full bg-zinc-900 border border-zinc-800 rounded-lg pl-9 pr-4 py-1.5 text-xs focus:ring-1 focus:ring-blue-500 outline-none transition-all"
                    value={bugsSearchTerm}
                    onChange={(e) => setBugsSearchTerm(e.target.value)}
                  />
                </div>
                <select 
                  className="bg-zinc-900 border border-zinc-800 rounded-lg px-3 py-1.5 text-xs focus:ring-1 focus:ring-blue-500 outline-none transition-all cursor-pointer"
                  value={bugsFilter}
                  onChange={(e) => setBugsFilter(e.target.value)}
                >
                  <option value="ALL">Všechny</option>
                  <option value="OPEN">Otevřené</option>
                  <option value="IN_PROGRESS">V řešení</option>
                  <option value="FIXED">Opravené</option>
                </select>
              </div>
            </div>

            <div className="bg-zinc-900 border border-zinc-800 rounded-2xl overflow-hidden shadow-xl">
              <div className="overflow-x-auto">
                <table className="w-full text-left border-collapse">
                  <thead>
                    <tr className="bg-zinc-800/50 border-b border-zinc-800">
                      <th className="px-4 py-3 text-[10px] font-bold uppercase tracking-widest text-zinc-500">Priorita</th>
                      <th className="px-4 py-3 text-[10px] font-bold uppercase tracking-widest text-zinc-500">Název</th>
                      <th className="px-4 py-3 text-[10px] font-bold uppercase tracking-widest text-zinc-500">Status</th>
                      <th className="px-4 py-3 text-[10px] font-bold uppercase tracking-widest text-zinc-500">Reportér</th>
                      <th className="px-4 py-3 text-[10px] font-bold uppercase tracking-widest text-zinc-500 text-right">Akce</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-zinc-800">
                    {filteredBugs.length === 0 ? (
                      <tr>
                        <td colSpan={5} className="px-4 py-8">
                          <EmptyState icon={BugIcon} title="Nenašly se žádné záznamy" description="Seznam zpětné vazby je momentálně prázdný." />
                        </td>
                      </tr>
                    ) : filteredBugs.map((b) => (
                      <tr key={b.id} className="hover:bg-zinc-800/30 transition-colors group">
                        <td className="px-4 py-3">
                          <span className={cn(
                            "text-[9px] font-bold uppercase px-1.5 py-0.5 rounded",
                            b.priority === 'HIGH' ? "bg-red-500/10 text-red-500" :
                            b.priority === 'MEDIUM' ? "bg-yellow-500/10 text-yellow-500" : "bg-blue-500/10 text-blue-500"
                          )}>
                            {b.priority}
                          </span>
                        </td>
                        <td className="px-4 py-3">
                          <div className="text-sm font-medium text-zinc-200">{escapeHtml(b.title)}</div>
                          <p className="text-[10px] text-zinc-500 line-clamp-1">{escapeHtml(b.description)}</p>
                        </td>
                        <td className="px-4 py-3">
                          <span className={cn(
                            "text-[9px] font-bold uppercase px-1.5 py-0.5 rounded",
                            b.status === 'FIXED' ? "bg-green-500/10 text-green-500" :
                            b.status === 'IN_PROGRESS' ? "bg-blue-500/10 text-blue-500" : "bg-zinc-800 text-zinc-500"
                          )}>
                            {b.status}
                          </span>
                        </td>
                        <td className="px-4 py-3 text-xs text-zinc-400">{b.reporter_name}</td>
                        <td className="px-4 py-3 text-right">
                          {isAdmin && (
                            <div className="flex justify-end gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                              <button 
                                onClick={(e) => { e.stopPropagation(); handleEdit(b); }} 
                                className="p-1 hover:bg-zinc-800 rounded text-zinc-500 hover:text-white transition-colors"
                              >
                                <Edit2 className="w-3.5 h-3.5" />
                              </button>
                              <button 
                                onClick={(e) => { e.stopPropagation(); handleDelete(b.id); }} 
                                className="p-1 hover:bg-zinc-800 rounded text-zinc-500 hover:text-red-500 transition-colors"
                              >
                                <Trash2 className="w-3.5 h-3.5" />
                              </button>
                            </div>
                          )}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        ) : activeSection === 'AGENDA' ? (
          <div className="space-y-6">
            <div className="flex flex-col md:flex-row gap-4 items-center justify-between mb-6">
              <div className="flex items-center gap-4 w-full md:w-auto">
                <h2 className="text-xl font-bold flex items-center gap-2">
                  <Calendar className="w-5 h-5 text-purple-500" /> Agenda
                </h2>
                <button 
                  onClick={() => setActiveSection('DASHBOARD')}
                  className="text-xs text-zinc-500 hover:text-white flex items-center gap-1 transition-colors ml-4"
                >
                  <ChevronLeft className="w-3 h-3" /> Zpět na Dashboard
                </button>
                <div className="h-4 w-px bg-zinc-800 hidden md:block" />
                <div className="relative flex-1 md:w-64">
                  <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-zinc-500" />
                  <input 
                    type="text" 
                    placeholder="Hledat podnět..." 
                    className="w-full bg-zinc-900 border border-zinc-800 rounded-lg pl-9 pr-4 py-1.5 text-xs focus:ring-1 focus:ring-purple-500 outline-none transition-all"
                    value={agendaSearchTerm}
                    onChange={(e) => setAgendaSearchTerm(e.target.value)}
                  />
                </div>
              </div>
              <div className="flex items-center gap-2 w-full md:w-auto">
                {isAdmin && (
                  <>
                    <button 
                      onClick={archiveResolved}
                      className="flex-1 md:flex-none bg-zinc-800 hover:bg-zinc-700 text-white px-4 py-1.5 rounded-lg text-xs font-bold transition-all flex items-center justify-center gap-2 border border-zinc-700"
                    >
                      <Archive className="w-3.5 h-3.5" /> Archivovat vyřešené
                    </button>
                    <button 
                      onClick={() => setShowArchive(!showArchive)}
                      className="flex-1 md:flex-none bg-zinc-800 hover:bg-zinc-700 text-white px-4 py-1.5 rounded-lg text-xs font-bold transition-all flex items-center justify-center gap-2 border border-zinc-700"
                    >
                      <Archive className="w-3.5 h-3.5" /> {showArchive ? 'Zpět na Agendu' : '🗄️ Zobraziť archív'}
                    </button>
                    <button 
                      onClick={() => { resetForm(); setEditingItem(null); setIsModalOpen(true); }}
                      className="flex-1 md:flex-none bg-purple-600 hover:bg-purple-700 text-white px-4 py-1.5 rounded-lg text-xs font-bold transition-all flex items-center justify-center gap-2 shadow-lg shadow-purple-900/20"
                    >
                      <Plus className="w-3.5 h-3.5" /> Nový podnět
                    </button>
                  </>
                )}
              </div>
            </div>

            {/* Agenda Filter Bar */}
            {!showArchive && (
              <div className="flex items-center gap-2 mb-6 overflow-x-auto pb-2 scrollbar-hide">
                {[
                  { id: 'ALL', label: 'Všechny' },
                  { id: 'BUG', label: 'Bugy' },
                  { id: 'SUGGESTION', label: 'Návrhy' },
                  { id: 'COMPLAINT', label: 'Stížnosti' }
                ].map(filter => (
                  <button
                    key={filter.id}
                    onClick={() => setAgendaFilter(filter.id)}
                    className={cn(
                      "px-4 py-1.5 rounded-full text-xs font-bold transition-all whitespace-nowrap border",
                      agendaFilter === filter.id
                        ? "bg-purple-500/20 text-purple-400 border-purple-500/50"
                        : "bg-zinc-900 text-zinc-400 border-zinc-800 hover:border-zinc-700 hover:text-zinc-300"
                    )}
                  >
                    {filter.label}
                  </button>
                ))}
              </div>
            )}

            {showArchive ? (
              <div className="bg-zinc-900/50 border border-zinc-800 rounded-2xl p-6">
                <h3 className="text-lg font-bold text-zinc-300 mb-6 flex items-center gap-2">
                  <Archive className="w-5 h-5 text-zinc-500" /> Archivované podněty
                </h3>
                <div className="space-y-4">
                  {filteredAgendaItems.filter(m => m.status === 'ARCHIVED').map((m) => (
                    <div 
                      key={m.id}
                      onClick={() => handleViewAgendaItem(m)}
                      className="bg-zinc-950 border border-zinc-800 rounded-xl p-4 cursor-pointer hover:border-zinc-700 transition-all flex items-center justify-between"
                    >
                      <div>
                        <div className="flex items-center gap-2 mb-1">
                          <span className={cn(
                            "text-[10px] font-bold px-2 py-0.5 rounded-full uppercase tracking-wider",
                            m.priority === 'HIGH' ? 'bg-red-500/10 text-red-500' : 
                            m.priority === 'MEDIUM' ? 'bg-yellow-500/10 text-yellow-500' : 
                            'bg-blue-500/10 text-blue-500'
                          )}>
                            {m.priority}
                          </span>
                          <span className="text-[10px] font-bold text-zinc-500 uppercase tracking-wider bg-zinc-800 px-2 py-0.5 rounded-full">
                            {m.category}
                          </span>
                        </div>
                        <h4 className="font-bold text-zinc-200">{m.title}</h4>
                        <p className="text-xs text-zinc-500 mt-1">Od: {m.organizer_name} • {format(parseISO(m.created_at), 'dd.MM.yyyy HH:mm', { locale: cs })}</p>
                      </div>
                      <div className="flex items-center gap-4">
                        <div className="flex items-center gap-2 text-xs font-bold">
                          <span className="text-green-500 flex items-center gap-1"><ThumbsUp className="w-3 h-3" /> {agendaVotes.filter(v => v.agenda_id === m.id && v.vote === 'UP').length}</span>
                          <span className="text-red-500 flex items-center gap-1"><ThumbsDown className="w-3 h-3" /> {agendaVotes.filter(v => v.agenda_id === m.id && v.vote === 'DOWN').length}</span>
                        </div>
                        {isAdmin && (
                          <button 
                            onClick={(e) => {
                              e.stopPropagation();
                              handleDelete(m.id);
                            }}
                            className="p-2 text-zinc-500 hover:text-red-500 hover:bg-red-500/10 rounded-lg transition-all"
                            title="Smazat z archivu"
                          >
                            <Trash2 className="w-4 h-4" />
                          </button>
                        )}
                        <ChevronRight className="w-5 h-5 text-zinc-600" />
                      </div>
                    </div>
                  ))}
                  {filteredAgendaItems.filter(m => m.status === 'ARCHIVED').length === 0 && (
                    <EmptyState icon={Archive} title="Archiv je prázdný" description="Zatím zde nejsou žádné archivované podněty." />
                  )}
                </div>
              </div>
            ) : (
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
              {['INBOX', 'AGENDA', 'RESOLVED'].map((status) => (
                <div 
                  key={status} 
                  className="bg-zinc-900/50 border border-zinc-800 rounded-2xl p-4 flex flex-col h-[600px]"
                  onDragOver={handleDragOver}
                  onDrop={(e) => handleDrop(e, status as any)}
                >
                  <div className="flex items-center justify-between mb-4">
                    <h3 className="text-sm font-bold text-zinc-300 uppercase tracking-widest flex items-center gap-2">
                      {status === 'INBOX' && <Inbox className="w-4 h-4 text-blue-500" />}
                      {status === 'AGENDA' && <ListTodo className="w-4 h-4 text-yellow-500" />}
                      {status === 'RESOLVED' && <CheckCircle2 className="w-4 h-4 text-green-500" />}
                      {status}
                    </h3>
                    <span className="bg-zinc-800 text-zinc-400 text-[10px] font-bold px-2 py-0.5 rounded-full">
                      {filteredAgendaItems.filter(m => m.status === status).length}
                    </span>
                  </div>
                  
                  <div className="flex-1 overflow-y-auto space-y-3 pr-2 custom-scrollbar">
                    {filteredAgendaItems.filter(m => m.status === status).length === 0 ? (
                      <EmptyState icon={Inbox} title="Žádné záznamy" description="V tomto sloupci nejsou žádné podněty." />
                    ) : (
                      filteredAgendaItems.filter(m => m.status === status).map((m) => (
                        <div 
                          key={m.id}
                          draggable={isAdmin}
                          onDragStart={(e) => handleDragStart(e, m.id)}
                          onClick={() => handleViewAgendaItem(m)}
                        className={cn(
                          "bg-zinc-950 border border-zinc-800 rounded-xl p-4 cursor-grab active:cursor-grabbing hover:border-zinc-700 transition-all group",
                          m.priority === 'HIGH' ? 'border-l-2 border-l-red-500' : 
                          m.priority === 'MEDIUM' ? 'border-l-2 border-l-yellow-500' : 
                          'border-l-2 border-l-blue-500'
                        )}
                      >
                        <div className="flex justify-between items-start mb-2">
                          <div className="flex items-center gap-1.5">
                            <span className={cn(
                              "text-[9px] font-bold uppercase tracking-widest px-2 py-0.5 rounded-full",
                              m.priority === 'HIGH' ? "bg-red-500/10 text-red-500" :
                              m.priority === 'MEDIUM' ? "bg-yellow-500/10 text-yellow-500" :
                              "bg-blue-500/10 text-blue-500"
                            )}>
                              {m.priority}
                            </span>
                            <span className="text-[9px] font-bold uppercase tracking-widest px-2 py-0.5 rounded-full bg-zinc-800 text-zinc-400">
                              {m.category}
                            </span>
                            {m.ping_roles && m.ping_roles.length > 0 && (
                              <span className="text-[9px] font-bold uppercase tracking-widest px-2 py-0.5 rounded-full bg-indigo-500/10 text-indigo-400 flex items-center gap-1" title="Adresováno pro specifické role">
                                @Role ({m.ping_roles.length})
                              </span>
                            )}
                          </div>
                          {isAdmin && (
                            <div className="flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                              <button onClick={(e) => { e.stopPropagation(); handleEdit(m); }} className="text-zinc-500 hover:text-white"><Edit2 className="w-3 h-3" /></button>
                              <button onClick={(e) => { e.stopPropagation(); handleDelete(m.id); }} className="text-zinc-500 hover:text-red-500"><Trash2 className="w-3 h-3" /></button>
                            </div>
                          )}
                        </div>
                        <h4 className="text-sm font-bold text-zinc-100 mb-1">{escapeHtml(m.title)}</h4>
                        <p className="text-xs text-zinc-500 line-clamp-2 mb-3">{escapeHtml(m.description)}</p>
                        
                        <div className="flex items-center justify-between text-[10px] text-zinc-600 mt-3 pt-3 border-t border-zinc-800/50">
                          <div className="flex items-center gap-3">
                            <span className="flex items-center gap-1 text-green-500 font-bold"><ThumbsUp className="w-3 h-3" /> {agendaVotes.filter(v => v.agenda_id === m.id && v.vote === 'UP').length}</span>
                            <span className="flex items-center gap-1 text-red-500 font-bold"><ThumbsDown className="w-3 h-3" /> {agendaVotes.filter(v => v.agenda_id === m.id && v.vote === 'DOWN').length}</span>
                          </div>
                          <div className="flex items-center gap-1">
                            {agendaReads.filter(r => r.agenda_id === m.id).slice(0, 3).map((read, idx) => (
                              <div key={idx} className="w-5 h-5 rounded-full bg-zinc-800 border border-zinc-700 flex items-center justify-center text-[8px] font-bold text-zinc-400" title={read.admin_name}>
                                {read.admin_name.substring(0, 2).toUpperCase()}
                              </div>
                            ))}
                            {agendaReads.filter(r => r.agenda_id === m.id).length > 3 && (
                              <div className="w-5 h-5 rounded-full bg-zinc-800 border border-zinc-700 flex items-center justify-center text-[8px] font-bold text-zinc-400">
                                +{agendaReads.filter(r => r.agenda_id === m.id).length - 3}
                              </div>
                            )}
                          </div>
                        </div>
                      </div>
                    ))
                  )}
                </div>
              </div>
            ))}
            </div>
            )}
          </div>
        ) : activeSection === 'LOGS' ? (
          isAdmin ? (
            <div className="space-y-6">
              <div className="flex flex-col md:flex-row gap-4 items-center justify-between mb-6">
                <div className="flex items-center gap-4 w-full md:w-auto">
                  <h2 className="text-xl font-bold flex items-center gap-2">
                    <History className="w-5 h-5 text-red-500" /> Admin Logy
                  </h2>
                  <div className="h-4 w-px bg-zinc-800 hidden md:block" />
                  <div className="relative flex-1 md:w-80">
                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-zinc-500" />
                    <input 
                      type="text" 
                      placeholder="Hledat v lozích..." 
                      className="w-full bg-zinc-900 border border-zinc-800 rounded-lg pl-9 pr-4 py-1.5 text-xs focus:ring-1 focus:ring-red-500 outline-none transition-all"
                      value={logsSearchTerm}
                      onChange={(e) => setLogsSearchTerm(e.target.value)}
                    />
                  </div>
                </div>
              </div>
              <div className="bg-zinc-900 border border-zinc-800 rounded-2xl overflow-hidden shadow-xl">
                <div className="overflow-x-auto">
                  <table className="w-full text-left border-collapse">
                    <thead>
                      <tr className="bg-zinc-800/50 border-b border-zinc-800">
                        <th className="px-4 py-3 text-[10px] font-bold uppercase tracking-widest text-zinc-500">Čas</th>
                        <th className="px-4 py-3 text-[10px] font-bold uppercase tracking-widest text-zinc-500">Admin</th>
                        <th className="px-4 py-3 text-[10px] font-bold uppercase tracking-widest text-zinc-500">Akce</th>
                        <th className="px-4 py-3 text-[10px] font-bold uppercase tracking-widest text-zinc-500">Cíl</th>
                        <th className="px-4 py-3 text-[10px] font-bold uppercase tracking-widest text-zinc-500">Detaily</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-zinc-800">
                      {filteredLogs.length === 0 ? (
                        <tr>
                          <td colSpan={5} className="px-4 py-8">
                            <EmptyState icon={FileText} title="Nenašly se žádné záznamy" description="Seznam logů je momentálně prázdný." />
                          </td>
                        </tr>
                      ) : filteredLogs.map((log) => (
                        <tr key={log.id} className="hover:bg-zinc-800/30 transition-colors">
                          <td className="px-4 py-3 text-[10px] text-zinc-500 font-mono">
                            {format(parseISO(log.created_at), 'dd.MM HH:mm')}
                          </td>
                          <td className="px-4 py-3">
                            <div className="text-xs font-bold">{log.admin_name}</div>
                          </td>
                          <td className="px-4 py-3">
                            <span className={cn(
                              "text-[9px] font-bold uppercase px-1.5 py-0.5 rounded",
                              log.action.includes('Smazán') ? "bg-red-500/10 text-red-500" : 
                              log.action.includes('Upraven') ? "bg-blue-500/10 text-blue-500" : 
                              "bg-green-500/10 text-green-500"
                            )}>
                              {log.action}
                            </span>
                          </td>
                          <td className="px-4 py-3 text-xs text-zinc-300">{escapeHtml(log.target_name)}</td>
                          <td className="px-4 py-3 text-[10px] text-zinc-500 italic truncate max-w-xs">{escapeHtml(log.details)}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            </div>
          ) : (
            <div className="flex flex-col items-center justify-center py-20 text-center space-y-4">
              <div className="bg-zinc-900 p-6 rounded-full border border-zinc-800">
                <XCircle className="w-12 h-12 text-red-500" />
              </div>
              <h2 className="text-2xl font-bold">Přístup Odepřen</h2>
              <p className="text-zinc-500 max-w-md">Tuto sekci mohou vidět pouze administrátoři.</p>
              <button 
                onClick={() => setActiveSection('DASHBOARD')}
                className="bg-zinc-800 hover:bg-zinc-700 text-white px-6 py-2 rounded-xl transition-all"
              >
                Zpět na Dashboard
              </button>
            </div>
          )
        ) : (
          <div className="flex flex-col items-center justify-center py-20 text-center space-y-4">
            <div className="bg-zinc-900 p-6 rounded-full border border-zinc-800">
              <AlertCircle className="w-12 h-12 text-zinc-700" />
            </div>
            <h2 className="text-2xl font-bold">Sekce ve vývoji</h2>
            <p className="text-zinc-500 max-w-md">Sekce {activeSection} je momentálně v přípravě. Brzy zde přibude plná funkcionalita.</p>
            <button 
              onClick={() => setActiveSection('DASHBOARD')}
              className="bg-zinc-800 hover:bg-zinc-700 text-white px-6 py-2 rounded-xl transition-all"
            >
              Zpět na Dashboard
            </button>
          </div>
        )}
      </main>

      {/* Modal */}
      {selectedPlayerHistory && (
        <div 
          className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm"
          onClick={() => setSelectedPlayerHistory(null)}
        >
          <div 
            className="bg-zinc-900 border border-zinc-800 w-full max-w-4xl rounded-2xl shadow-2xl overflow-hidden animate-in fade-in zoom-in duration-200 flex flex-col max-h-[90vh]"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="px-6 py-4 border-b border-zinc-800 flex items-center justify-between bg-zinc-800/30 shrink-0">
              <h2 className="text-lg font-bold flex items-center gap-2">
                <History className="w-5 h-5 text-blue-500" />
                Historie trestů: {selectedPlayerHistory.discord_username}
                <span className="text-xs text-zinc-500 font-mono font-normal ml-2">({selectedPlayerHistory.discord_id})</span>
              </h2>
              <button onClick={() => setSelectedPlayerHistory(null)} className="text-zinc-500 hover:text-white transition-colors">
                <XCircle className="w-6 h-6" />
              </button>
            </div>
            <div className="p-6 overflow-y-auto custom-scrollbar">
              <div className="space-y-4">
                {punishments.filter(p => p.player_discord_id === selectedPlayerHistory.discord_id).length === 0 ? (
                  <EmptyState icon={History} title="Žádné záznamy" description="Hráč nemá žádné záznamy o trestech." />
                ) : (
                  <div className="relative border-l border-zinc-800 ml-3 space-y-6 pb-4">
                    {punishments
                      .filter(p => p.player_discord_id === selectedPlayerHistory.discord_id)
                      .sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime())
                      .map((p, idx) => {
                        const expired = isExpired(p.expiry_date);
                        return (
                          <div key={p.id} className="relative pl-6">
                            <div 
                              className={cn(
                                "bg-zinc-950 border border-zinc-800/50 rounded-xl p-4 transition-all",
                                p.type === 'BAN' ? "border-l-4 border-l-red-600 bg-red-600/5" :
                                p.type === 'WARN' ? "border-l-4 border-l-orange-500 bg-orange-500/5" :
                                p.type === 'SUSPEND' ? "border-l-4 border-l-purple-500 bg-purple-500/5" :
                                p.type === 'WL-DOWN' ? "border-l-4 border-l-blue-500 bg-blue-500/5" :
                                "border-l-4 border-l-zinc-500 bg-zinc-500/5"
                              )}
                            >
                              <div className="flex flex-wrap items-center justify-between gap-4 mb-2">
                                <div className="flex items-center gap-2">
                                  <span className={cn(
                                    "text-[10px] font-bold uppercase px-2 py-0.5 rounded-md",
                                    p.type === 'BAN' ? "bg-red-500/10 text-red-500" :
                                    p.type === 'WARN' ? "bg-orange-500/10 text-orange-500" :
                                    p.type === 'KICK' ? "bg-yellow-500/10 text-yellow-500" : "bg-blue-500/10 text-blue-500"
                                  )}>
                                    {p.type}
                                  </span>
                                  <span className="text-xs text-zinc-400 font-medium">
                                    {format(parseISO(p.created_at), 'dd.MM.yyyy HH:mm')}
                                  </span>
                                </div>
                                <div className="flex items-center gap-2 text-xs">
                                  <span className="text-zinc-500">Uděleno:</span>
                                  <span className="text-zinc-300 font-bold">{p.admin_name}</span>
                                </div>
                              </div>
                              <div className="mb-3">
                                <h4 className="text-sm font-bold text-zinc-100 mb-1">{escapeHtml(p.reason)}</h4>
                                {p.details && <p className="text-xs text-zinc-400">{escapeHtml(p.details)}</p>}
                              </div>
                              <div className="flex flex-wrap items-center justify-between gap-4 pt-3 border-t border-zinc-800/50">
                                <div className="flex items-center gap-2">
                                  {p.expiry_date ? (
                                    <span className={cn(
                                      "text-[10px] font-bold uppercase px-2 py-0.5 rounded-md border",
                                      expired ? "bg-zinc-800 text-zinc-500 border-zinc-700/50" : "bg-green-500/10 text-green-500 border-green-500/20"
                                    )}>
                                      {expired ? 'VYPRŠELÉ' : `AKTIVNÍ DO ${format(parseISO(p.expiry_date), 'dd.MM.yyyy')} ${formatExpiration(p.expiry_date)}`}
                                    </span>
                                  ) : (
                                    <span className="text-[10px] font-bold uppercase px-2 py-0.5 rounded-md bg-red-500/10 text-red-500 border border-red-500/20">
                                      Permanentní
                                    </span>
                                  )}
                                </div>
                                {(() => {
                                  const proofUrls = Array.isArray(p.proof_url) ? p.proof_url : (typeof p.proof_url === 'string' && p.proof_url ? [p.proof_url] : []);
                                  if (proofUrls.length === 0) return null;
                                  
                                  return (
                                    <div className="flex items-center gap-1.5">
                                      {proofUrls.map((url, idx) => {
                                        let Icon = FileText;
                                        if (url.includes('imgur.com') || url.includes('prnt.sc') || url.match(/\.(jpeg|jpg|gif|png)$/i)) Icon = Image;
                                        else if (url.includes('youtube.com') || url.includes('youtu.be') || url.includes('medal.tv')) Icon = Video;
                                        
                                        return (
                                          <a 
                                            key={idx}
                                            href={url} 
                                            target="_blank" 
                                            rel="noreferrer"
                                            onClick={(e) => e.stopPropagation()}
                                            className="flex items-center justify-center w-7 h-7 bg-zinc-900 hover:bg-zinc-800 text-zinc-400 hover:text-white rounded-lg border border-zinc-800 transition-colors"
                                            title={`Důkaz ${idx + 1}`}
                                          >
                                            <Icon className="w-3.5 h-3.5" />
                                          </a>
                                        );
                                      })}
                                    </div>
                                  );
                                })()}
                              </div>
                            </div>
                          </div>
                        );
                      })}
                  </div>
                )}
              </div>
            </div>
            <div className="px-6 py-4 border-t border-zinc-800 bg-zinc-800/30 flex justify-end shrink-0">
              <button 
                onClick={() => setSelectedPlayerHistory(null)}
                className="px-4 py-2 bg-zinc-800 hover:bg-zinc-700 text-white rounded-lg text-sm font-bold transition-colors"
              >
                Zavřít
              </button>
            </div>
          </div>
        </div>
      )}

      {isModalOpen && (
        <div 
          className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm"
          onClick={() => setIsModalOpen(false)}
        >
          <div 
            className="bg-zinc-900 border border-zinc-800 w-full max-w-2xl rounded-2xl shadow-2xl overflow-hidden animate-in fade-in zoom-in duration-200"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="px-6 py-4 border-b border-zinc-800 flex items-center justify-between bg-zinc-800/30">
              <h2 className="text-lg font-bold">
                {editingItem ? 'Upravit' : 'Přidat'} {
                  activeSection === 'PLAYERS' ? (playersTab === 'BANLIST' ? 'Trest' : 'Hledaného') :
                  activeSection === 'FEEDBACK' ? (feedbackTab === 'BUGS' ? 'Bug' : 'Návrh') : 
                  activeSection === 'SETTINGS' ? (settingsTab === 'ADMINS' ? 'Admina' : 'Důvod') : 'Podnět'
                }
              </h2>
              <button onClick={() => setIsModalOpen(false)} className="text-zinc-500 hover:text-white transition-colors">
                <XCircle className="w-6 h-6" />
              </button>
            </div>
            
            <form onSubmit={handleSubmit} className="p-6">
              {activeSection === 'PLAYERS' && playersTab === 'BANLIST' && (
                <div className="space-y-6">
                  {/* Warn Limit Alert */}
                  {activeWarns >= 3 && formData.type === 'WARN' && (
                    <div className="bg-red-500/10 border border-red-500/20 rounded-xl p-4 flex items-start gap-3 animate-in slide-in-from-top-2 duration-300">
                      <AlertTriangle className="w-5 h-5 text-red-500 shrink-0 mt-0.5" />
                      <div>
                        <p className="text-sm font-bold text-red-500 uppercase tracking-tight">Upozornění: Maximální počet warnů</p>
                        <p className="text-xs text-red-400/80">Hráč už má 3 varovania, nasleduje BAN!</p>
                      </div>
                    </div>
                  )}

                  {/* Watchlist Double-Checker */}
                  {activeSection === 'PLAYERS' && playersTab === 'BANLIST' && (formData.discord_id || formData.discord_username) && (
                    (() => {
                      const watchlistEntry = wantedList.find(w => 
                        (formData.discord_id && w.discord_id === formData.discord_id) || 
                        (formData.discord_username && w.discord_username?.toLowerCase() === formData.discord_username?.toLowerCase())
                      );
                      
                      if (watchlistEntry) {
                        return (
                          <div className="bg-orange-500/10 border border-orange-500/20 rounded-xl p-4 flex items-start gap-3 animate-in fade-in zoom-in duration-300">
                            <div className="p-2 bg-orange-500/20 rounded-lg">
                              <Eye className="w-5 h-5 text-orange-500" />
                            </div>
                            <div className="flex-1">
                              <h4 className="text-sm font-bold text-orange-500 uppercase tracking-tight">Hráč je na Watchlistu!</h4>
                              <p className="text-xs text-zinc-400 mt-1 line-clamp-2">{watchlistEntry.description}</p>
                              <button 
                                type="button"
                                onClick={() => {
                                  // Switch to watchlist and edit this entry
                                  setPlayersTab('WATCHLIST');
                                  handleEdit(watchlistEntry);
                                }}
                                className="text-[10px] font-bold text-orange-500 hover:text-orange-400 uppercase tracking-wider mt-2 flex items-center gap-1 transition-colors"
                              >
                                <ExternalLink className="w-3 h-3" /> Zobrazit záznam na watchlistu
                              </button>
                            </div>
                          </div>
                        );
                      }
                      return null;
                    })()
                  )}

                  {/* Target Selection */}
                  <div className="bg-zinc-950/50 border border-zinc-800/50 rounded-2xl p-5 space-y-4">
                    <div className="flex items-center gap-2 mb-2">
                      <Users className="w-4 h-4 text-red-500" />
                      <h3 className="text-xs font-bold text-zinc-400 uppercase tracking-widest">Cíl trestu</h3>
                    </div>
                    
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      <div className="md:col-span-2">
                        <label className="block text-[10px] font-bold text-zinc-500 uppercase tracking-widest mb-1.5 ml-1">Vybrat z Discordu</label>
                        <DiscordUserSearch 
                          placeholder="Hledat hráče..."
                          value={formData.discord_username}
                          onSelect={(m) => setFormData({ ...formData, discord_id: m.id, discord_username: m.username })}
                        />
                      </div>
                      
                      <div className="relative">
                        <label className="block text-[10px] font-bold text-zinc-500 uppercase tracking-widest mb-1.5 ml-1">Username</label>
                        <input 
                          type="text" 
                          className={cn(
                            "w-full bg-zinc-900 border rounded-xl py-2.5 px-4 text-sm focus:outline-none focus:ring-2 transition-all",
                            showValidationErrors && !formData.discord_id && !formData.discord_username
                              ? "border-red-500 focus:ring-red-500/50"
                              : "border-zinc-800 focus:ring-red-500/50"
                          )}
                          value={formData.discord_username}
                          onChange={e => setFormData({...formData, discord_username: e.target.value})}
                          placeholder="např. john_doe"
                        />
                      </div>
                      
                      <div className="relative">
                        <label className="block text-[10px] font-bold text-zinc-500 uppercase tracking-widest mb-1.5 ml-1">Discord ID</label>
                        <input 
                          type="text" 
                          className={cn(
                            "w-full bg-zinc-900 border rounded-xl py-2.5 px-4 text-sm focus:outline-none focus:ring-2 font-mono transition-all",
                            showValidationErrors && !formData.discord_id && !formData.discord_username
                              ? "border-red-500 focus:ring-red-500/50"
                              : "border-zinc-800 focus:ring-red-500/50"
                          )}
                          value={formData.discord_id}
                          onChange={e => {
                            const newId = e.target.value;
                            const member = discordMembers.find(m => m.id === newId);
                            setFormData({
                              ...formData, 
                              discord_id: newId, 
                              ...(member ? { discord_username: member.username } : {})
                            });
                          }}
                          placeholder="např. 1234567890"
                        />
                      </div>
                    </div>
                    {showValidationErrors && !formData.discord_id && !formData.discord_username && (
                      <p className="text-[10px] text-red-500 mt-1 flex items-center gap-1 ml-1">
                        <AlertCircle className="w-3 h-3" /> Vyplňte alespoň jeden z údajů (Username nebo ID)
                      </p>
                    )}
                    <p className="text-[10px] text-zinc-600 italic ml-1">* Vyplňte alespoň jeden z údajů výše.</p>
                  </div>

                  {/* Punishment Details */}
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                    <div className="space-y-4">
                      <div>
                        <label className="block text-[10px] font-bold text-zinc-500 uppercase tracking-widest mb-1.5 ml-1">Typ Trestu</label>
                        <div className="grid grid-cols-2 gap-2">
                          {['WARN', 'BAN', 'SUSPEND', 'WL-DOWN'].map((type) => (
                            <button
                              key={type}
                              type="button"
                              onClick={() => setFormData({ ...formData, type: type as PunishmentType })}
                              className={cn(
                                "py-2 px-3 rounded-xl text-xs font-bold border transition-all flex items-center justify-center gap-2",
                                formData.type === type 
                                  ? "bg-red-500/20 border-red-500 text-red-500 shadow-lg shadow-red-500/10" 
                                  : "bg-zinc-900 border-zinc-800 text-zinc-500 hover:border-zinc-700"
                              )}
                            >
                              {type === 'WARN' && <AlertTriangle className="w-3.5 h-3.5" />}
                              {type === 'BAN' && <Ban className="w-3.5 h-3.5" />}
                              {type === 'SUSPEND' && <Clock className="w-3.5 h-3.5" />}
                              {type === 'WL-DOWN' && <UserMinus className="w-3.5 h-3.5" />}
                              {type}
                            </button>
                          ))}
                        </div>
                      </div>

                      <div>
                        <label className="block text-[10px] font-bold text-zinc-500 uppercase tracking-widest mb-1.5 ml-1">Důvod (Pravidlo)</label>
                        <select 
                          className="w-full bg-zinc-900 border border-zinc-800 rounded-xl py-2.5 px-4 text-sm focus:outline-none focus:ring-2 focus:ring-red-500/50 appearance-none cursor-pointer"
                          value={formData.reason}
                          onChange={e => setFormData({...formData, reason: e.target.value})}
                        >
                          {(punishmentReasons.length > 0 ? punishmentReasons.map(r => r.label) : PUNISHMENT_REASONS).map(r => (
                            <option key={r} value={r}>{r}</option>
                          ))}
                        </select>
                      </div>
                    </div>

                    <div className="space-y-4">
                      <div>
                        <label className="block text-[10px] font-bold text-zinc-500 uppercase tracking-widest mb-1.5 ml-1">Datum Expirace / Trvání</label>
                        <div className="space-y-3">
                          <input 
                            type="datetime-local" 
                            className="w-full bg-zinc-900 border border-zinc-800 rounded-xl py-2.5 px-4 text-sm focus:outline-none focus:ring-2 focus:ring-red-500/50 transition-all"
                            value={formData.expires_at || ''}
                            onChange={e => setFormData({...formData, expires_at: e.target.value})}
                          />
                          
                          <div className="flex flex-wrap gap-1.5">
                            {[
                              { label: '1h', value: () => addHours(new Date(), 1) },
                              { label: '24h', value: () => addDays(new Date(), 1) },
                              { label: '3d', value: () => addDays(new Date(), 3) },
                              { label: '7d', value: () => addDays(new Date(), 7) },
                              { label: '30d', value: () => addDays(new Date(), 30) },
                              { label: 'Perma', value: () => null },
                            ].map((preset) => (
                              <button
                                key={preset.label}
                                type="button"
                                onClick={() => {
                                  const date = preset.value();
                                  setFormData({ ...formData, expires_at: date ? format(date, "yyyy-MM-dd'T'HH:mm") : null });
                                }}
                                className="px-2 py-1 bg-zinc-800 hover:bg-zinc-700 border border-zinc-700 rounded-lg text-[10px] font-bold text-zinc-400 transition-colors"
                              >
                                {preset.label}
                              </button>
                            ))}
                          </div>
                        </div>
                      </div>
                    </div>

                    <div className="md:col-span-2 space-y-4">
                      <div>
                        <label className="block text-[10px] font-bold text-zinc-500 uppercase tracking-widest mb-1.5 ml-1">Podrobný Popis</label>
                        <textarea 
                          className="w-full bg-zinc-900 border border-zinc-800 rounded-xl py-3 px-4 text-sm focus:outline-none focus:ring-2 focus:ring-red-500/50 h-24 resize-none transition-all"
                          value={formData.details}
                          onChange={e => setFormData({...formData, details: e.target.value})}
                          placeholder="Popište situaci a porušená pravidla..."
                        />
                      </div>
                      
                      <div>
                        <div className="flex items-center justify-between mb-1.5 ml-1">
                          <label className="block text-[10px] font-bold text-zinc-500 uppercase tracking-widest">Linky na důkazy (Imgur/YouTube/Medal)</label>
                          <button
                            type="button"
                            onClick={() => setFormData({ ...formData, proof_urls: [...formData.proof_urls, ''] })}
                            className="text-[10px] bg-zinc-800 hover:bg-zinc-700 text-zinc-300 px-2 py-1 rounded transition-colors flex items-center gap-1"
                          >
                            <Plus className="w-3 h-3" /> Přidat důkaz
                          </button>
                        </div>
                        <div className="space-y-2">
                          {formData.proof_urls.map((url, idx) => (
                            <div key={idx} className="flex items-center gap-2">
                              <input 
                                type="url" 
                                className="flex-1 bg-zinc-900 border border-zinc-800 rounded-xl py-2.5 px-4 text-sm focus:outline-none focus:ring-2 focus:ring-red-500/50 transition-all"
                                value={url}
                                onChange={e => {
                                  const newUrls = [...formData.proof_urls];
                                  newUrls[idx] = e.target.value;
                                  setFormData({...formData, proof_urls: newUrls});
                                }}
                                placeholder="https://..."
                              />
                              {formData.proof_urls.length > 1 && (
                                <button
                                  type="button"
                                  onClick={() => {
                                    const newUrls = formData.proof_urls.filter((_, i) => i !== idx);
                                    setFormData({...formData, proof_urls: newUrls});
                                  }}
                                  className="p-2.5 bg-zinc-900 hover:bg-red-500/20 text-zinc-500 hover:text-red-500 rounded-xl transition-colors border border-zinc-800"
                                >
                                  <XCircle className="w-4 h-4" />
                                </button>
                              )}
                            </div>
                          ))}
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
              )}

              {activeSection === 'PLAYERS' && playersTab === 'WATCHLIST' && (
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  <div className="md:col-span-2">
                    <label className="block text-xs font-bold text-zinc-500 uppercase tracking-widest mb-1.5">Vybrat z Discordu</label>
                    <DiscordUserSearch 
                      placeholder="Hledat na watchlistu..."
                      value={formData.discord_username}
                      onSelect={(m) => setFormData({ ...formData, discord_id: m.id, discord_username: m.username })}
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-bold text-zinc-500 uppercase tracking-widest mb-1.5">Discord Username</label>
                    <input 
                      type="text" 
                      className={cn(
                        "w-full bg-zinc-950 border rounded-xl py-2 px-4 text-sm focus:outline-none focus:ring-2 transition-all",
                        showValidationErrors && !formData.discord_id && !formData.discord_username
                          ? "border-red-500 focus:ring-red-500/50"
                          : "border-zinc-800 focus:ring-orange-500/50"
                      )}
                      value={formData.discord_username}
                      onChange={e => setFormData({...formData, discord_username: e.target.value})}
                      placeholder="např. john_doe"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-bold text-zinc-500 uppercase tracking-widest mb-1.5">Discord ID</label>
                    <input 
                      type="text" 
                      className={cn(
                        "w-full bg-zinc-950 border rounded-xl py-2 px-4 text-sm focus:outline-none focus:ring-2 transition-all",
                        showValidationErrors && !formData.discord_id && !formData.discord_username
                          ? "border-red-500 focus:ring-red-500/50"
                          : "border-zinc-800 focus:ring-orange-500/50"
                      )}
                      value={formData.discord_id}
                      onChange={e => setFormData({...formData, discord_id: e.target.value})}
                      placeholder="např. 123456789012345678"
                    />
                  </div>
                  {showValidationErrors && !formData.discord_id && !formData.discord_username && (
                    <div className="md:col-span-2">
                      <p className="text-[10px] text-red-500 flex items-center gap-1">
                        <AlertCircle className="w-3 h-3" /> Vyplňte alespoň jeden z údajů (Username nebo ID)
                      </p>
                    </div>
                  )}
                  <div>
                    <label className="block text-xs font-bold text-zinc-500 uppercase tracking-widest mb-1.5">Whitelist Status</label>
                    <select 
                      className="w-full bg-zinc-950 border border-zinc-800 rounded-xl py-2 px-4 text-sm focus:outline-none focus:ring-2 focus:ring-orange-500/50"
                      value={formData.whitelist_status}
                      onChange={e => setFormData({...formData, whitelist_status: e.target.value as any})}
                    >
                      <option value="NONE">Žádný</option>
                      <option value="ALLOWED">Povolený</option>
                      <option value="DENIED">Zamítnutý</option>
                    </select>
                  </div>
                  <div>
                    <label className="block text-xs font-bold text-zinc-500 uppercase tracking-widest mb-1.5">Úroveň Nebezpečí</label>
                    <select 
                      className="w-full bg-zinc-950 border border-zinc-800 rounded-xl py-2 px-4 text-sm focus:outline-none focus:ring-2 focus:ring-orange-500/50"
                      value={formData.danger_level}
                      onChange={e => setFormData({...formData, danger_level: e.target.value as any})}
                    >
                      <option value="LOW">Low</option>
                      <option value="MEDIUM">Medium</option>
                      <option value="HIGH">High</option>
                      <option value="EXTREME">Extreme</option>
                    </select>
                  </div>
                  <div>
                    <label className="block text-xs font-bold text-zinc-500 uppercase tracking-widest mb-1.5">Status</label>
                    <select 
                      className="w-full bg-zinc-950 border border-zinc-800 rounded-xl py-2 px-4 text-sm focus:outline-none focus:ring-2 focus:ring-orange-500/50"
                      value={formData.status}
                      onChange={e => setFormData({...formData, status: e.target.value as any})}
                    >
                      <option value="ACTIVE">Active</option>
                      <option value="CAPTURED">Captured</option>
                      <option value="DECEASED">Deceased</option>
                    </select>
                  </div>
                  <div className="md:col-span-2">
                    <label className="block text-xs font-bold text-zinc-500 uppercase tracking-widest mb-1.5">Popis / Důvod</label>
                    <textarea 
                      className="w-full bg-zinc-950 border border-zinc-800 rounded-xl py-2 px-4 text-sm focus:outline-none focus:ring-2 focus:ring-orange-500/50 h-24 resize-none"
                      value={formData.description}
                      onChange={e => setFormData({...formData, description: e.target.value})}
                    />
                  </div>
                </div>
              )}

              {activeSection === 'SETTINGS' && settingsTab === 'ADMINS' && (
                <div className="space-y-6">
                  <div className="flex items-center gap-4 bg-zinc-950/50 p-1 rounded-xl border border-zinc-800">
                    <button
                      type="button"
                      onClick={() => setAuthMethod('discord')}
                      className={cn(
                        "flex-1 py-2 rounded-lg text-xs font-bold transition-all flex items-center justify-center gap-2",
                        authMethod === 'discord' ? "bg-indigo-600 text-white shadow-lg" : "text-zinc-500 hover:text-zinc-300"
                      )}
                    >
                      <Users className="w-3.5 h-3.5" /> Discord
                    </button>
                    <button
                      type="button"
                      onClick={() => setAuthMethod('email')}
                      className={cn(
                        "flex-1 py-2 rounded-lg text-xs font-bold transition-all flex items-center justify-center gap-2",
                        authMethod === 'email' ? "bg-indigo-600 text-white shadow-lg" : "text-zinc-500 hover:text-zinc-300"
                      )}
                    >
                      <FileText className="w-3.5 h-3.5" /> Email
                    </button>
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                    {authMethod === 'discord' ? (
                      <>
                        <div className="md:col-span-2">
                          <label className="block text-xs font-bold text-zinc-500 uppercase tracking-widest mb-1.5">Vybrat z Discordu</label>
                          <DiscordUserSearch 
                            placeholder="Hledat admina..."
                            value={formData.discord_username}
                            onSelect={(m) => setFormData({ ...formData, discord_id: m.id, discord_username: m.username })}
                          />
                        </div>
                        <div>
                          <label className="block text-xs font-bold text-zinc-500 uppercase tracking-widest mb-1.5">Discord Username</label>
                          <input 
                            required
                            type="text" 
                            className={cn(
                              "w-full bg-zinc-950 border rounded-xl py-2 px-4 text-sm focus:outline-none focus:ring-2 transition-all",
                              showValidationErrors && !formData.discord_username ? "border-red-500 focus:ring-red-500/50" : "border-zinc-800 focus:ring-indigo-500/50"
                            )}
                            value={formData.discord_username}
                            onChange={e => setFormData({...formData, discord_username: e.target.value})}
                          />
                        </div>
                        <div>
                          <label className="block text-xs font-bold text-zinc-500 uppercase tracking-widest mb-1.5">Discord ID</label>
                          <input 
                            required
                            type="text" 
                            className={cn(
                              "w-full bg-zinc-950 border rounded-xl py-2 px-4 text-sm focus:outline-none focus:ring-2 transition-all",
                              showValidationErrors && !formData.discord_id ? "border-red-500 focus:ring-red-500/50" : "border-zinc-800 focus:ring-indigo-500/50"
                            )}
                            value={formData.discord_id}
                            onChange={e => setFormData({...formData, discord_id: e.target.value})}
                          />
                        </div>
                      </>
                    ) : (
                      <>
                        <div className="md:col-span-2">
                          <label className="block text-xs font-bold text-zinc-500 uppercase tracking-widest mb-1.5">Email</label>
                          <input 
                            required
                            type="email" 
                            className={cn(
                              "w-full bg-zinc-950 border rounded-xl py-2 px-4 text-sm focus:outline-none focus:ring-2 transition-all",
                              showValidationErrors && !formData.email ? "border-red-500 focus:ring-red-500/50" : "border-zinc-800 focus:ring-indigo-500/50"
                            )}
                            value={formData.email}
                            onChange={e => setFormData({...formData, email: e.target.value})}
                            placeholder="admin@example.com"
                          />
                        </div>
                        <div className="md:col-span-2">
                          <label className="block text-xs font-bold text-zinc-500 uppercase tracking-widest mb-1.5">Dočasné heslo</label>
                          <input 
                            required={!editingItem}
                            type="text" 
                            className={cn(
                              "w-full bg-zinc-950 border rounded-xl py-2 px-4 text-sm focus:outline-none focus:ring-2 transition-all",
                              showValidationErrors && !formData.password && !editingItem ? "border-red-500 focus:ring-red-500/50" : "border-zinc-800 focus:ring-indigo-500/50"
                            )}
                            value={formData.password}
                            onChange={e => setFormData({...formData, password: e.target.value})}
                            placeholder="Minimálně 6 znaků"
                          />
                        </div>
                      </>
                    )}
                    <div className="md:col-span-2">
                      <label className="block text-xs font-bold text-zinc-500 uppercase tracking-widest mb-1.5">Rank</label>
                      <select 
                        className="w-full bg-zinc-950 border border-zinc-800 rounded-xl py-2 px-4 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500/50"
                        value={formData.rank}
                        onChange={e => setFormData({...formData, rank: parseInt(e.target.value)})}
                      >
                        <option value={3}>Admin</option>
                        <option value={2}>Vedení</option>
                        <option value={1}>Majitel</option>
                      </select>
                    </div>
                  </div>
                </div>
              )}

              {activeSection === 'SETTINGS' && settingsTab === 'REASONS' && (
                <div className="space-y-4">
                  <div>
                    <label className="block text-xs font-bold text-zinc-500 uppercase tracking-widest mb-1.5">Název Důvodu</label>
                    <input 
                      required
                      type="text" 
                      className={cn(
                        "w-full bg-zinc-950 border rounded-xl py-2 px-4 text-sm focus:outline-none focus:ring-2 transition-all",
                        showValidationErrors && !formData.reason ? "border-red-500 focus:ring-red-500/50" : "border-zinc-800 focus:ring-indigo-500/50"
                      )}
                      value={formData.reason}
                      onChange={e => setFormData({...formData, reason: e.target.value})}
                      placeholder="např. RDM / VDM"
                    />
                  </div>
                </div>
              )}

              {activeSection === 'FEEDBACK' && (
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  <div className="md:col-span-2">
                    <label className="block text-xs font-bold text-zinc-500 uppercase tracking-widest mb-1.5">
                      {feedbackTab === 'BUGS' ? 'Název Chyby' : 'Název Návrhu'}
                    </label>
                    <input 
                      required
                      type="text" 
                      className={cn(
                        "w-full bg-zinc-950 border rounded-xl py-2 px-4 text-sm focus:outline-none focus:ring-2 transition-all",
                        showValidationErrors && !formData.title
                          ? "border-red-500 focus:ring-red-500/50"
                          : feedbackTab === 'BUGS' ? "border-zinc-800 focus:ring-blue-500/50" : "border-zinc-800 focus:ring-emerald-500/50"
                      )}
                      value={formData.title}
                      onChange={e => setFormData({...formData, title: e.target.value})}
                      placeholder={feedbackTab === 'BUGS' ? "např. Nefunguje otevírání dveří" : "např. Přidat nové vozidlo"}
                    />
                    {showValidationErrors && !formData.title && (
                      <p className="text-[10px] text-red-500 mt-1 flex items-center gap-1">
                        <AlertCircle className="w-3 h-3" /> Toto pole je povinné
                      </p>
                    )}
                  </div>
                  <div>
                    <label className="block text-xs font-bold text-zinc-500 uppercase tracking-widest mb-1.5">Priorita</label>
                    <select 
                      className={cn(
                        "w-full bg-zinc-950 border border-zinc-800 rounded-xl py-2 px-4 text-sm focus:outline-none focus:ring-2",
                        feedbackTab === 'BUGS' ? "focus:ring-blue-500/50" : "focus:ring-emerald-500/50"
                      )}
                      value={formData.priority}
                      onChange={e => setFormData({...formData, priority: e.target.value as any})}
                    >
                      <option value="LOW">Low</option>
                      <option value="MEDIUM">Medium</option>
                      <option value="HIGH">High</option>
                    </select>
                  </div>
                  <div>
                    <label className="block text-xs font-bold text-zinc-500 uppercase tracking-widest mb-1.5">Status</label>
                    <select 
                      className={cn(
                        "w-full bg-zinc-950 border border-zinc-800 rounded-xl py-2 px-4 text-sm focus:outline-none focus:ring-2",
                        feedbackTab === 'BUGS' ? "focus:ring-blue-500/50" : "focus:ring-emerald-500/50"
                      )}
                      value={formData.bug_status}
                      onChange={e => setFormData({...formData, bug_status: e.target.value as any})}
                    >
                      <option value="OPEN">Open</option>
                      <option value="IN_PROGRESS">In Progress</option>
                      <option value="FIXED">Fixed</option>
                      <option value="CLOSED">Closed</option>
                    </select>
                  </div>
                  <div className="md:col-span-2">
                    <label className="block text-xs font-bold text-zinc-500 uppercase tracking-widest mb-1.5">
                      {feedbackTab === 'BUGS' ? 'Popis Chyby' : 'Popis Návrhu'}
                    </label>
                    <textarea 
                      required
                      className={cn(
                        "w-full bg-zinc-950 border rounded-xl py-2 px-4 text-sm focus:outline-none focus:ring-2 h-24 resize-none transition-all",
                        showValidationErrors && !formData.description
                          ? "border-red-500 focus:ring-red-500/50"
                          : feedbackTab === 'BUGS' ? "border-zinc-800 focus:ring-blue-500/50" : "border-zinc-800 focus:ring-emerald-500/50"
                      )}
                      value={formData.description}
                      onChange={e => setFormData({...formData, description: e.target.value})}
                      placeholder={feedbackTab === 'BUGS' ? "Podrobný popis chyby..." : "Podrobný popis vašeho návrhu..."}
                    />
                    {showValidationErrors && !formData.description && (
                      <p className="text-[10px] text-red-500 mt-1 flex items-center gap-1">
                        <AlertCircle className="w-3 h-3" /> Toto pole je povinné
                      </p>
                    )}
                  </div>
                </div>
              )}

              {activeSection === 'AGENDA' && (
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  <div className="md:col-span-2">
                    <label className="block text-xs font-bold text-zinc-500 uppercase tracking-widest mb-1.5">Titulok</label>
                    <input 
                      required
                      type="text" 
                      className={cn(
                        "w-full bg-zinc-950 border rounded-xl py-2 px-4 text-sm focus:outline-none focus:ring-2 transition-all",
                        showValidationErrors && !formData.title
                          ? "border-red-500 focus:ring-red-500/50"
                          : "border-zinc-800 focus:ring-purple-500/50"
                      )}
                      value={formData.title}
                      onChange={e => setFormData({...formData, title: e.target.value})}
                    />
                    {showValidationErrors && !formData.title && (
                      <p className="text-[10px] text-red-500 mt-1 flex items-center gap-1">
                        <AlertCircle className="w-3 h-3" /> Toto pole je povinné
                      </p>
                    )}
                  </div>
                  <div>
                    <label className="block text-xs font-bold text-zinc-500 uppercase tracking-widest mb-1.5">Kategória</label>
                    <select 
                      className="w-full bg-zinc-950 border border-zinc-800 rounded-xl py-2 px-4 text-sm focus:outline-none focus:ring-2 focus:ring-purple-500/50"
                      value={formData.category}
                      onChange={e => setFormData({...formData, category: e.target.value as any})}
                    >
                      <option value="BUG">Bug</option>
                      <option value="SUGGESTION">Návrh</option>
                      <option value="COMPLAINT">Sťažnosť</option>
                    </select>
                  </div>
                  <div>
                    <label className="block text-xs font-bold text-zinc-500 uppercase tracking-widest mb-1.5">Priorita</label>
                    <select 
                      className="w-full bg-zinc-950 border border-zinc-800 rounded-xl py-2 px-4 text-sm focus:outline-none focus:ring-2 focus:ring-purple-500/50"
                      value={formData.priority}
                      onChange={e => setFormData({...formData, priority: e.target.value as any})}
                    >
                      <option value="LOW">Nízka</option>
                      <option value="MEDIUM">Stredná</option>
                      <option value="HIGH">Vysoká</option>
                    </select>
                  </div>
                  <div className="md:col-span-2">
                    <label className="block text-xs font-bold text-zinc-500 uppercase tracking-widest mb-1.5">Popis</label>
                    <textarea 
                      required
                      className="w-full bg-zinc-950 border border-zinc-800 rounded-xl py-2 px-4 text-sm focus:outline-none focus:ring-2 focus:ring-purple-500/50 h-24 resize-none"
                      value={formData.description}
                      onChange={e => setFormData({...formData, description: e.target.value})}
                      placeholder="Detailný popis..."
                    />
                  </div>
                  {!editingItem && (
                    <div className="md:col-span-2">
                      <label className="block text-xs font-bold text-zinc-500 uppercase tracking-widest mb-1.5">Ping Role (Discord)</label>
                      <div className="flex flex-wrap gap-2">
                        {[
                          { id: '1336047749938020442', name: 'Project Management' },
                          { id: '1413570330987073576', name: 'Dev' },
                          { id: '1405965334602715257', name: 'Senior Staff Team' },
                          { id: '1367490395545534536', name: 'Staff Team' },
                          { id: '1367962791360860215', name: 'Staff Test' }
                        ].map(role => (
                          <button
                            key={role.id}
                            type="button"
                            onClick={() => {
                              const roles = formData.ping_roles || [];
                              if (roles.includes(role.id)) {
                                setFormData({...formData, ping_roles: roles.filter(r => r !== role.id)});
                              } else {
                                setFormData({...formData, ping_roles: [...roles, role.id]});
                              }
                            }}
                            className={cn(
                              "px-3 py-1.5 rounded-lg text-xs font-bold transition-all border",
                              (formData.ping_roles || []).includes(role.id)
                                ? "bg-indigo-500/20 text-indigo-400 border-indigo-500/50"
                                : "bg-zinc-900 text-zinc-500 border-zinc-800 hover:border-zinc-700"
                            )}
                          >
                            @{role.name}
                          </button>
                        ))}
                      </div>
                    </div>
                  )}
                  <div className="md:col-span-2">
                    <label className="block text-xs font-bold text-zinc-500 uppercase tracking-widest mb-1.5">Média a Odkazy (Volitelné)</label>
                    {formData.agenda_media_urls.map((url, index) => (
                      <div key={index} className="flex gap-2 mb-2">
                        <input 
                          type="url" 
                          className="flex-1 bg-zinc-950 border border-zinc-800 rounded-xl py-2 px-4 text-sm focus:outline-none focus:ring-2 focus:ring-purple-500/50"
                          value={url}
                          onChange={e => {
                            const newUrls = [...formData.agenda_media_urls];
                            newUrls[index] = e.target.value;
                            setFormData({...formData, agenda_media_urls: newUrls});
                          }}
                          placeholder="https://..."
                        />
                        {formData.agenda_media_urls.length > 1 && (
                          <button 
                            type="button"
                            onClick={() => {
                              const newUrls = formData.agenda_media_urls.filter((_, i) => i !== index);
                              setFormData({...formData, agenda_media_urls: newUrls});
                            }}
                            className="p-2 bg-red-500/10 text-red-500 hover:bg-red-500 hover:text-white rounded-xl transition-colors"
                          >
                            <Trash2 className="w-4 h-4" />
                          </button>
                        )}
                      </div>
                    ))}
                    <button 
                      type="button"
                      onClick={() => setFormData({...formData, agenda_media_urls: [...formData.agenda_media_urls, '']})}
                      className="text-xs font-bold text-purple-500 hover:text-purple-400 flex items-center gap-1 mt-2"
                    >
                      <Plus className="w-3 h-3" /> Přidat další odkaz
                    </button>
                  </div>
                </div>
              )}

              <div className="mt-8 flex gap-3">
                <button 
                  type="button"
                  onClick={() => setIsModalOpen(false)}
                  className="flex-1 bg-zinc-800 hover:bg-zinc-700 text-white font-bold py-3 rounded-xl transition-all"
                >
                  Zrušit
                </button>
                <button 
                  type="submit"
                  disabled={isSubmitting}
                  className={cn(
                    "flex-[2] text-white font-bold py-3 rounded-xl transition-all shadow-lg flex items-center justify-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed",
                    activeSection === 'PLAYERS' ? (playersTab === 'BANLIST' ? "bg-red-600 hover:bg-red-700 shadow-red-900/20" : "bg-orange-600 hover:bg-orange-700 shadow-orange-900/20") :
                    activeSection === 'FEEDBACK' ? (feedbackTab === 'BUGS' ? "bg-blue-600 hover:bg-blue-700 shadow-blue-900/20" : "bg-emerald-600 hover:bg-emerald-700 shadow-emerald-900/20") :
                    activeSection === 'SETTINGS' ? "bg-indigo-600 hover:bg-indigo-700 shadow-indigo-900/20" :
                    "bg-purple-600 hover:bg-purple-700 shadow-purple-900/20"
                  )}
                >
                  {isSubmitting ? (
                    <>
                      <Loader2 className="w-5 h-5 animate-spin" />
                      Ukládám...
                    </>
                  ) : (
                    editingItem ? 'Uložit Změny' : 'Uložit Záznam'
                  )}
                </button>
              </div>

              {activeSection === 'FEEDBACK' && formData.feedback_type === 'SUGGESTION' && editingItem && (
                <div className="mt-8 pt-8 border-t border-zinc-800 space-y-4">
                  <h3 className="text-sm font-bold flex items-center gap-2">
                    <MessageSquare className="w-4 h-4 text-blue-500" /> Komentáre k návrhu
                  </h3>
                  <div className="space-y-3 max-h-60 overflow-y-auto pr-2">
                    {suggestionComments.length === 0 ? (
                      <p className="text-xs text-zinc-500 italic">Žiadne komentáre.</p>
                    ) : (
                      suggestionComments.map((comment) => (
                        <div key={comment.id} className={cn(
                          "p-3 rounded-xl border transition-all",
                          comment.is_valid ? "bg-zinc-800/50 border-zinc-700" : "bg-red-950/20 border-red-900/30 opacity-50"
                        )}>
                          <div className="flex items-center justify-between mb-1">
                            <span className="text-[10px] font-bold text-zinc-400">{comment.author_name}</span>
                            <div className="flex items-center gap-2">
                              <button 
                                type="button"
                                onClick={() => toggleCommentValidity(comment.id, !comment.is_valid)}
                                className="text-[9px] font-bold uppercase hover:text-white transition-colors"
                              >
                                {comment.is_valid ? 'Zneplatniť' : 'Platný'}
                              </button>
                              <button 
                                type="button"
                                onClick={() => deleteComment(comment.id)}
                                className="text-red-500 hover:text-red-400 transition-colors"
                              >
                                <Trash2 className="w-3 h-3" />
                              </button>
                            </div>
                          </div>
                          <p className="text-xs text-zinc-300">{comment.content}</p>
                        </div>
                      ))
                    )}
                  </div>
                </div>
              )}
            </form>
          </div>
        </div>
      )}

      {/* Punishment Details Modal */}
      {viewingPunishment && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm animate-in fade-in duration-200">
          <div className="bg-zinc-900 border border-zinc-800 w-full max-w-lg rounded-3xl shadow-2xl overflow-hidden animate-in zoom-in-95 duration-200">
            <div className="p-6 border-b border-zinc-800 flex items-center justify-between bg-zinc-800/30">
              <div className="flex items-center gap-3">
                <div className="bg-red-600/10 p-2 rounded-xl">
                  <FileText className="w-5 h-5 text-red-500" />
                </div>
                <div>
                  <h2 className="text-xl font-bold">Detail Trestu</h2>
                  <p className="text-[10px] text-zinc-500 font-mono uppercase tracking-widest">ID: {viewingPunishment.id}</p>
                </div>
              </div>
              <button 
                onClick={() => setViewingPunishment(null)}
                className="p-2 hover:bg-zinc-700 rounded-full transition-colors text-zinc-400 hover:text-white"
              >
                <XCircle className="w-6 h-6" />
              </button>
            </div>
            
            <div className="p-8 space-y-6">
              <div className="grid grid-cols-2 gap-6">
                <div>
                  <label className="block text-[10px] font-bold text-zinc-500 uppercase tracking-widest mb-1">Hráč</label>
                  <p className="text-lg font-bold text-zinc-100">{viewingPunishment.player_name || 'Neznámý'}</p>
                  <p className="text-xs text-zinc-500 font-mono">{viewingPunishment.player_discord_id || 'Neznámé ID'}</p>
                </div>
                <div>
                  <label className="block text-[10px] font-bold text-zinc-500 uppercase tracking-widest mb-1">Typ Trestu</label>
                  <div className="flex items-center gap-2">
                    {getTypeIcon(viewingPunishment.type)}
                    <span className="text-lg font-bold">{viewingPunishment.type}</span>
                  </div>
                </div>
              </div>

              <div className="h-px bg-zinc-800" />

              <div>
                <label className="block text-[10px] font-bold text-zinc-500 uppercase tracking-widest mb-1">Důvod</label>
                <p className="text-zinc-200 font-medium">{viewingPunishment.reason}</p>
              </div>

              {viewingPunishment.details && (
                <div>
                  <label className="block text-[10px] font-bold text-zinc-500 uppercase tracking-widest mb-1">Detaily</label>
                  <div className="bg-zinc-950 border border-zinc-800 p-4 rounded-2xl text-sm text-zinc-400 leading-relaxed italic">
                    {viewingPunishment.details}
                  </div>
                </div>
              )}

              <div className="grid grid-cols-2 gap-6">
                <div>
                  <label className="block text-[10px] font-bold text-zinc-500 uppercase tracking-widest mb-1">Administrátor</label>
                  <p className="text-sm font-bold text-zinc-300">{viewingPunishment.admin_name}</p>
                </div>
                <div>
                  <label className="block text-[10px] font-bold text-zinc-500 uppercase tracking-widest mb-1">Expirace</label>
                  <p className="text-sm font-bold text-zinc-300">
                    {viewingPunishment.expiry_date 
                      ? format(parseISO(viewingPunishment.expiry_date), 'dd.MM.yyyy HH:mm', { locale: cs })
                      : 'Permanentní'}
                  </p>
                  {viewingPunishment.expiry_date && (
                    <p className={cn(
                      "text-[10px] font-bold uppercase mt-0.5",
                      isExpired(viewingPunishment.expiry_date) ? "text-zinc-600" : "text-green-500"
                    )}>
                      {isExpired(viewingPunishment.expiry_date) ? 'Trest vypršel' : 'Aktivní trest'}
                    </p>
                  )}
                </div>
              </div>

              {(() => {
                const proofUrls = Array.isArray(viewingPunishment.proof_url) ? viewingPunishment.proof_url : (typeof viewingPunishment.proof_url === 'string' && viewingPunishment.proof_url ? [viewingPunishment.proof_url] : []);
                if (proofUrls.length === 0) return null;
                
                return (
                  <div className="pt-4 space-y-2">
                    <label className="block text-[10px] font-bold text-zinc-500 uppercase tracking-widest mb-1">Důkazy</label>
                    {proofUrls.map((url, idx) => (
                      <a 
                        key={idx}
                        href={url}
                        target="_blank"
                        rel="noreferrer"
                        className="w-full bg-zinc-800 hover:bg-zinc-700 text-white font-bold py-3 rounded-xl transition-all flex items-center justify-center gap-2 border border-zinc-700"
                      >
                        <ExternalLink className="w-4 h-4" /> 
                        {proofUrls.length === 1 ? 'Zobrazit Důkaz' : `Zobrazit Důkaz ${idx + 1}`}
                      </a>
                    ))}
                  </div>
                );
              })()}
            </div>
            
            <div className="p-4 bg-zinc-800/30 border-t border-zinc-800 flex justify-end gap-3">
              {isAdmin && (
                <button 
                  onClick={() => {
                    setEditingItem(viewingPunishment);
                    setFormData({
                      ...formData,
                      discord_id: viewingPunishment.player_discord_id || '',
                      discord_username: viewingPunishment.player_name || '',
                      type: viewingPunishment.type,
                      reason: viewingPunishment.reason,
                      details: viewingPunishment.details,
                      proof_urls: Array.isArray(viewingPunishment.proof_url) && viewingPunishment.proof_url.length > 0 ? viewingPunishment.proof_url : [''],
                      expires_at: viewingPunishment.expiry_date ? new Date(viewingPunishment.expiry_date).toISOString().slice(0, 16) : '',
                    });
                    setViewingPunishment(null);
                    setIsModalOpen(true);
                  }}
                  className="px-6 py-2 bg-indigo-600 hover:bg-indigo-700 text-white font-bold rounded-xl transition-all text-sm flex items-center gap-2"
                >
                  <Edit2 className="w-4 h-4" /> Upravit
                </button>
              )}
              <button 
                onClick={() => setViewingPunishment(null)}
                className="px-6 py-2 bg-zinc-800 hover:bg-zinc-700 text-white font-bold rounded-xl transition-all text-sm"
              >
                Zavřít
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Delete Confirmation Modal */}
      {deleteConfirmation && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm animate-in fade-in duration-200">
          <div className="bg-zinc-900 border border-zinc-800 w-full max-w-md rounded-3xl shadow-2xl overflow-hidden animate-in zoom-in-95 duration-200">
            <div className="p-6 text-center">
              <div className="w-16 h-16 bg-red-500/10 rounded-full flex items-center justify-center mx-auto mb-4">
                <AlertTriangle className="w-8 h-8 text-red-500" />
              </div>
              <h2 className="text-xl font-bold text-white mb-2">Opravdu smazat?</h2>
              <p className="text-sm text-zinc-400 mb-6">
                Chystáte se smazat záznam <strong className="text-white">{deleteConfirmation.name}</strong>. Tato akce je nevratná.
              </p>
              <div className="flex gap-3">
                <button 
                  onClick={() => setDeleteConfirmation(null)}
                  disabled={isSubmitting}
                  className="flex-1 px-4 py-3 bg-zinc-800 hover:bg-zinc-700 text-white font-bold rounded-xl transition-all disabled:opacity-50"
                >
                  Zrušit
                </button>
                <button 
                  onClick={confirmDelete}
                  disabled={isSubmitting}
                  className="flex-1 px-4 py-3 bg-red-600 hover:bg-red-500 text-white font-bold rounded-xl transition-all disabled:opacity-50 flex items-center justify-center gap-2"
                >
                  {isSubmitting ? (
                    <><div className="w-4 h-4 border-2 border-white/20 border-t-white rounded-full animate-spin" /> Mažu...</>
                  ) : (
                    <><Trash2 className="w-4 h-4" /> Smazat</>
                  )}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Archive Confirmation Modal */}
      {archiveConfirmation && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm animate-in fade-in duration-200">
          <div className="bg-zinc-900 border border-zinc-800 w-full max-w-md rounded-3xl shadow-2xl overflow-hidden animate-in zoom-in-95 duration-200">
            <div className="p-6 text-center">
              <div className="w-16 h-16 bg-blue-500/10 rounded-full flex items-center justify-center mx-auto mb-4">
                <Archive className="w-8 h-8 text-blue-500" />
              </div>
              <h3 className="text-xl font-bold text-white mb-2">Opravdu archivovat?</h3>
              <p className="text-sm text-zinc-400 mb-6">
                Chystáte se archivovat všechny vyřešené podněty. Tato akce přesune podněty do archivu.
              </p>
              <div className="flex gap-3">
                <button
                  onClick={() => setArchiveConfirmation(false)}
                  disabled={isSubmitting}
                  className="flex-1 px-4 py-3 bg-zinc-800 hover:bg-zinc-700 text-white font-bold rounded-xl transition-all disabled:opacity-50"
                >
                  Zrušit
                </button>
                <button
                  onClick={confirmArchive}
                  disabled={isSubmitting}
                  className="flex-1 px-4 py-3 bg-blue-600 hover:bg-blue-500 text-white font-bold rounded-xl transition-all shadow-lg shadow-blue-500/20 disabled:opacity-50 flex items-center justify-center gap-2"
                >
                  {isSubmitting ? (
                    <>
                      <Loader2 className="w-4 h-4 animate-spin" />
                      Archivuji...
                    </>
                  ) : (
                    <>
                      <Archive className="w-4 h-4" />
                      Archivovat
                    </>
                  )}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Warn Confirmation Modal */}
      {warnConfirmation && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm animate-in fade-in duration-200">
          <div className="bg-zinc-900 border border-zinc-800 w-full max-w-md rounded-3xl shadow-2xl overflow-hidden animate-in zoom-in-95 duration-200">
            <div className="p-6 text-center">
              <div className="w-16 h-16 bg-yellow-500/10 rounded-full flex items-center justify-center mx-auto mb-4">
                <AlertTriangle className="w-8 h-8 text-yellow-500" />
              </div>
              <h3 className="text-xl font-bold text-white mb-2">Příliš mnoho varování</h3>
              <p className="text-sm text-zinc-400 mb-6">
                Hráč má již <strong className="text-white">{warnConfirmation.activeWarns}</strong> aktivních warnů. Odporúčaný trest je BAN. Opravdu chcete pokračovat a udělit další WARN?
              </p>
              <div className="flex gap-3">
                <button
                  onClick={() => setWarnConfirmation(null)}
                  disabled={isSubmitting}
                  className="flex-1 px-4 py-3 bg-zinc-800 hover:bg-zinc-700 text-white font-bold rounded-xl transition-all disabled:opacity-50"
                >
                  Zrušit
                </button>
                <button
                  onClick={() => {
                    setWarnConfirmation(null);
                    warnConfirmation.proceed();
                  }}
                  disabled={isSubmitting}
                  className="flex-1 px-4 py-3 bg-yellow-600 hover:bg-yellow-500 text-white font-bold rounded-xl transition-all shadow-lg shadow-yellow-500/20 disabled:opacity-50 flex items-center justify-center gap-2"
                >
                  Pokračovat s WARN
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Viewing Wanted Modal */}
      {viewingWanted && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm animate-in fade-in duration-200">
          <div className="bg-zinc-900 border border-zinc-800 w-full max-w-lg rounded-3xl shadow-2xl overflow-hidden animate-in zoom-in-95 duration-200">
            <div className="p-6 border-b border-zinc-800 flex items-center justify-between bg-zinc-800/30">
              <div className="flex items-center gap-3">
                <div className="bg-orange-600/10 p-2 rounded-xl">
                  <AlertTriangle className="w-5 h-5 text-orange-500" />
                </div>
                <div>
                  <h2 className="text-xl font-bold">Detail Watchlistu</h2>
                  <p className="text-[10px] text-zinc-500 font-mono uppercase tracking-widest">ID: {viewingWanted.id}</p>
                </div>
              </div>
              <button 
                onClick={() => setViewingWanted(null)}
                className="p-2 hover:bg-zinc-700 rounded-full transition-colors text-zinc-400 hover:text-white"
              >
                <XCircle className="w-6 h-6" />
              </button>
            </div>
            
            <div className="p-6 space-y-6">
              <div className="flex items-center justify-between">
                <div>
                  <label className="block text-[10px] font-bold text-zinc-500 uppercase tracking-widest mb-1">Hráč</label>
                  <p className="text-lg font-bold text-zinc-100">{viewingWanted.discord_username || 'Neznámý'}</p>
                  <p className="text-xs text-zinc-500 font-mono">{viewingWanted.discord_id || 'Neznámé ID'}</p>
                </div>
                <div className="text-right">
                  <label className="block text-[10px] font-bold text-zinc-500 uppercase tracking-widest mb-1">Nebezpečnost</label>
                  <span className={cn(
                    "text-sm font-bold uppercase px-3 py-1 rounded-lg",
                    viewingWanted.danger_level === 'EXTREME' ? "bg-red-500/10 text-red-500" :
                    viewingWanted.danger_level === 'HIGH' ? "bg-orange-500/10 text-orange-500" :
                    viewingWanted.danger_level === 'MEDIUM' ? "bg-yellow-500/10 text-yellow-500" : "bg-zinc-800 text-zinc-500"
                  )}>
                    {viewingWanted.danger_level}
                  </span>
                </div>
              </div>

              <div className="h-px bg-zinc-800" />

              <div>
                <label className="block text-[10px] font-bold text-zinc-500 uppercase tracking-widest mb-1">Popis / Důvod</label>
                <div className="bg-zinc-950 border border-zinc-800 p-4 rounded-2xl text-sm text-zinc-300 leading-relaxed">
                  {viewingWanted.description}
                </div>
              </div>

              <div className="grid grid-cols-2 gap-6">
                <div>
                  <label className="block text-[10px] font-bold text-zinc-500 uppercase tracking-widest mb-1">Status</label>
                  <span className={cn(
                    "text-sm font-bold uppercase",
                    viewingWanted.status === 'ACTIVE' ? "text-green-500" : "text-zinc-500"
                  )}>
                    {viewingWanted.status}
                  </span>
                </div>
                <div>
                  <label className="block text-[10px] font-bold text-zinc-500 uppercase tracking-widest mb-1">Whitelist</label>
                  <span className={cn(
                    "text-sm font-bold uppercase",
                    viewingWanted.whitelist_status === 'REVOKED' ? "text-red-500" : 
                    viewingWanted.whitelist_status === 'AT_RISK' ? "text-yellow-500" : "text-zinc-500"
                  )}>
                    {viewingWanted.whitelist_status}
                  </span>
                </div>
              </div>
            </div>
            
            <div className="p-4 bg-zinc-800/30 border-t border-zinc-800 flex justify-end gap-3">
              {isAdmin && (
                <button 
                  onClick={() => {
                    handleEdit(viewingWanted);
                    setViewingWanted(null);
                  }}
                  className="px-6 py-2 bg-indigo-600 hover:bg-indigo-700 text-white font-bold rounded-xl transition-all text-sm flex items-center gap-2"
                >
                  <Edit2 className="w-4 h-4" /> Upravit
                </button>
              )}
              <button 
                onClick={() => setViewingWanted(null)}
                className="px-6 py-2 bg-zinc-800 hover:bg-zinc-700 text-white font-bold rounded-xl transition-all text-sm"
              >
                Zavřít
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Viewing Agenda Item Modal */}
      {viewingAgendaItem && (
        <div className="fixed inset-0 bg-black/80 backdrop-blur-sm flex items-center justify-center p-4 z-50">
          <div className="bg-zinc-900 border border-zinc-800 rounded-3xl w-full max-w-2xl overflow-hidden shadow-2xl flex flex-col max-h-[90vh]">
            <div className="p-6 border-b border-zinc-800/50 flex justify-between items-start bg-zinc-900/30">
              <div className="flex-1 pr-8">
                <h2 className="text-3xl font-bold text-white mb-4 leading-tight">{viewingAgendaItem.title}</h2>
                <div className="flex flex-wrap items-center gap-3 text-xs text-zinc-500 font-medium">
                  <span className="flex items-center gap-1.5 text-zinc-300">
                    <div className="w-5 h-5 rounded-full bg-zinc-800 flex items-center justify-center text-[10px] text-zinc-400">
                      {viewingAgendaItem.organizer_name.charAt(0).toUpperCase()}
                    </div>
                    {viewingAgendaItem.organizer_name}
                  </span>
                  <span className="text-zinc-700">•</span>
                  <span className="flex items-center gap-1">
                    {format(parseISO(viewingAgendaItem.created_at), 'dd.MM.yyyy HH:mm', { locale: cs })}
                  </span>
                  <span className="text-zinc-700">•</span>
                  <span className={cn(
                    "px-2 py-0.5 rounded-full uppercase tracking-wider text-[10px] font-bold",
                    viewingAgendaItem.priority === 'HIGH' ? "bg-red-500/10 text-red-500" :
                    viewingAgendaItem.priority === 'MEDIUM' ? "bg-yellow-500/10 text-yellow-500" :
                    "bg-blue-500/10 text-blue-500"
                  )}>
                    {viewingAgendaItem.priority}
                  </span>
                  <span className="px-2 py-0.5 rounded-full uppercase tracking-wider text-[10px] font-bold bg-zinc-800/50 text-zinc-400">
                    {viewingAgendaItem.category}
                  </span>
                  <span className="px-2 py-0.5 rounded-full uppercase tracking-wider text-[10px] font-bold bg-zinc-800/50 text-zinc-400">
                    {viewingAgendaItem.status}
                  </span>
                  {viewingAgendaItem.ping_roles && viewingAgendaItem.ping_roles.length > 0 && (
                    <>
                      <span className="text-zinc-700">•</span>
                      <span className="text-indigo-400 flex items-center gap-1">
                        Adresováno pro: {viewingAgendaItem.ping_roles.map((roleId: string) => {
                          const role = DISCORD_ROLES.find(r => r.id === roleId);
                          return role ? `@${role.name}` : `@Role`;
                        }).join(', ')}
                      </span>
                    </>
                  )}
                </div>
              </div>
              <button 
                onClick={() => setViewingAgendaItem(null)}
                className="p-2 hover:bg-zinc-800 rounded-xl transition-colors shrink-0"
              >
                <X className="w-5 h-5 text-zinc-400" />
              </button>
            </div>
            
            <div className="flex-1 overflow-y-auto custom-scrollbar flex flex-col">
              <div className="p-8 space-y-8 flex-1">
                {/* Description */}
                <div className="text-base text-zinc-200 leading-relaxed whitespace-pre-wrap font-medium">
                  {viewingAgendaItem.description}
                </div>

                {/* Media Section */}
                {Array.isArray(viewingAgendaItem.media_urls) && viewingAgendaItem.media_urls.length > 0 && (
                  <div className="pt-4">
                    <div className="grid grid-cols-1 gap-4">
                      {viewingAgendaItem.media_urls.map((url, idx) => {
                        const isImage = /\.(jpeg|jpg|gif|png|webp)$/i.test(url) || url.includes('imgur.com') || url.includes('prnt.sc');
                        const isDirectVideo = /\.(mp4|webm|ogg)$/i.test(url);
                        
                        // YouTube
                        const ytMatch = url.match(/^.*(youtu.be\/|v\/|u\/\w\/|embed\/|watch\?v=|&v=)([^#&?]*).*/);
                        const ytId = (ytMatch && ytMatch[2].length === 11) ? ytMatch[2] : null;

                        // Medal.tv
                        const medalMatch = url.match(/medal\.tv\/games\/[^/]+\/clips\/([^/]+)\/([^/?]+)/);
                        const medalId = medalMatch ? `${medalMatch[1]}/${medalMatch[2]}` : null;
                        
                        if (ytId) {
                          return (
                            <div key={idx} className="w-full aspect-video rounded-xl overflow-hidden border border-zinc-800">
                              <iframe 
                                src={`https://www.youtube.com/embed/${ytId}`} 
                                title="YouTube video player" 
                                frameBorder="0" 
                                allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture" 
                                allowFullScreen
                                className="w-full h-full"
                              ></iframe>
                            </div>
                          );
                        }

                        if (medalId) {
                          return (
                            <div key={idx} className="w-full aspect-video rounded-xl overflow-hidden border border-zinc-800 relative">
                              <iframe 
                                src={`https://medal.tv/clip/${medalId}?autoplay=0&muted=0&loop=0`} 
                                frameBorder="0" 
                                allow="autoplay; encrypted-media" 
                                allowFullScreen
                                className="w-full h-full absolute top-0 left-0"
                              ></iframe>
                            </div>
                          );
                        }

                        if (isDirectVideo) {
                          return (
                            <div key={idx} className="w-full aspect-video rounded-xl overflow-hidden border border-zinc-800 bg-black">
                              <video controls className="w-full h-full">
                                <source src={url} />
                                Váš prohlížeč nepodporuje přehrávání videa.
                              </video>
                            </div>
                          );
                        }

                        if (isImage) {
                          return (
                            <a key={idx} href={url} target="_blank" rel="noreferrer" className="block rounded-xl overflow-hidden border border-zinc-800 hover:border-zinc-600 transition-all group">
                              <img src={url} alt={`Příloha ${idx + 1}`} className="w-full h-auto max-h-96 object-contain bg-zinc-900 group-hover:scale-[1.02] transition-transform duration-300" />
                            </a>
                          );
                        }
                        
                        return (
                          <a 
                            key={idx}
                            href={url}
                            target="_blank"
                            rel="noreferrer"
                            className="bg-zinc-900/50 border border-zinc-800 hover:border-zinc-700 text-zinc-300 hover:text-white p-4 rounded-xl transition-all flex items-center gap-3"
                          >
                            <LinkIcon className="w-5 h-5 text-zinc-500" />
                            <span className="text-sm font-medium truncate">Otevřít přílohu {idx + 1}</span>
                          </a>
                        );
                      })}
                    </div>
                  </div>
                )}

                {/* Voting Section */}
                <div className="flex items-center gap-3 pt-6 border-t border-zinc-800/50">
                  <button 
                    onClick={async () => {
                      if (viewingAgendaItem.status === 'ARCHIVED') return;
                      const adminId = user?.id;
                      if (!adminId) return;
                      
                      const existingVote = agendaVotes.find(v => v.agenda_id === viewingAgendaItem.id && v.admin_id === adminId);
                      
                      if (existingVote?.vote === 'UP') {
                        await supabase.from('agenda_votes').delete().eq('agenda_id', viewingAgendaItem.id).eq('admin_id', adminId);
                      } else {
                        if (existingVote) {
                          await supabase.from('agenda_votes').update({ vote: 'UP' }).eq('agenda_id', viewingAgendaItem.id).eq('admin_id', adminId);
                        } else {
                          await supabase.from('agenda_votes').insert({ agenda_id: viewingAgendaItem.id, admin_id: adminId, vote: 'UP' });
                        }
                      }
                      fetchAgendaVotes();
                    }}
                    disabled={viewingAgendaItem.status === 'ARCHIVED'}
                    className={cn(
                      "px-4 py-1.5 rounded-full text-sm font-bold flex items-center gap-2 transition-all border",
                      agendaVotes.find(v => v.agenda_id === viewingAgendaItem.id && v.admin_id === user?.id)?.vote === 'UP'
                        ? "bg-green-500/10 text-green-500 border-green-500/30"
                        : "bg-zinc-900 text-zinc-400 border-zinc-800 hover:bg-zinc-800 hover:text-zinc-200",
                      viewingAgendaItem.status === 'ARCHIVED' && "opacity-50 cursor-not-allowed"
                    )}
                  >
                    👍 {agendaVotes.filter(v => v.agenda_id === viewingAgendaItem.id && v.vote === 'UP').length}
                  </button>
                  <button 
                    onClick={async () => {
                      if (viewingAgendaItem.status === 'ARCHIVED') return;
                      const adminId = user?.id;
                      if (!adminId) return;
                      
                      const existingVote = agendaVotes.find(v => v.agenda_id === viewingAgendaItem.id && v.admin_id === adminId);
                      
                      if (existingVote?.vote === 'DOWN') {
                        await supabase.from('agenda_votes').delete().eq('agenda_id', viewingAgendaItem.id).eq('admin_id', adminId);
                      } else {
                        if (existingVote) {
                          await supabase.from('agenda_votes').update({ vote: 'DOWN' }).eq('agenda_id', viewingAgendaItem.id).eq('admin_id', adminId);
                        } else {
                          await supabase.from('agenda_votes').insert({ agenda_id: viewingAgendaItem.id, admin_id: adminId, vote: 'DOWN' });
                        }
                      }
                      fetchAgendaVotes();
                    }}
                    disabled={viewingAgendaItem.status === 'ARCHIVED'}
                    className={cn(
                      "px-4 py-1.5 rounded-full text-sm font-bold flex items-center gap-2 transition-all border",
                      agendaVotes.find(v => v.agenda_id === viewingAgendaItem.id && v.admin_id === user?.id)?.vote === 'DOWN'
                        ? "bg-red-500/10 text-red-500 border-red-500/30"
                        : "bg-zinc-900 text-zinc-400 border-zinc-800 hover:bg-zinc-800 hover:text-zinc-200",
                      viewingAgendaItem.status === 'ARCHIVED' && "opacity-50 cursor-not-allowed"
                    )}
                  >
                    👎 {agendaVotes.filter(v => v.agenda_id === viewingAgendaItem.id && v.vote === 'DOWN').length}
                  </button>
                </div>

                {/* Comments Section */}
                <div className="pt-8 border-t border-zinc-800/50">
                  <h3 className="text-sm font-bold text-zinc-100 mb-6 flex items-center gap-2">
                    <MessageSquare className="w-4 h-4 text-zinc-500" /> Diskusia
                  </h3>
                  <div className="space-y-6">
                    {agendaComments.filter(c => c.agenda_id === viewingAgendaItem.id).map(comment => (
                      <div key={comment.id} className="flex gap-4">
                        <div className="w-8 h-8 rounded-full bg-zinc-800 flex items-center justify-center text-xs font-bold text-zinc-400 shrink-0 mt-1">
                          {comment.author_name.charAt(0).toUpperCase()}
                        </div>
                        <div className="flex-1">
                          <div className="flex items-baseline gap-2 mb-1">
                            <span className="text-sm font-bold text-zinc-200">{comment.author_name}</span>
                            <span className="text-xs text-zinc-500">{format(parseISO(comment.created_at), 'dd.MM. HH:mm')}</span>
                          </div>
                          <p className="text-sm text-zinc-300 leading-relaxed">{comment.content}</p>
                        </div>
                      </div>
                    ))}
                    {agendaComments.filter(c => c.agenda_id === viewingAgendaItem.id).length === 0 && (
                      <EmptyState icon={MessageSquare} title="Žádné komentáře" description="Zatím žádné komentáře." />
                    )}
                  </div>
                </div>
              </div>

              {/* Sticky Comment Input */}
              {viewingAgendaItem.status !== 'ARCHIVED' && (
                <div className="p-4 border-t border-zinc-800 bg-zinc-900/95 backdrop-blur-sm sticky bottom-0">
                  <div className="flex gap-3">
                    <div className="w-8 h-8 rounded-full bg-zinc-800 flex items-center justify-center text-xs font-bold text-zinc-400 shrink-0">
                      {(user?.user_metadata?.full_name || user?.user_metadata?.name || user?.email || 'A').charAt(0).toUpperCase()}
                    </div>
                    <div className="flex-1 relative">
                      <input 
                        type="text"
                        value={newAgendaComment}
                        onChange={(e) => setNewAgendaComment(e.target.value)}
                        onKeyDown={(e) => {
                          if (e.key === 'Enter') {
                            handleAddAgendaComment();
                          }
                        }}
                        placeholder="Přidat komentář..."
                        className="w-full bg-zinc-950 border border-zinc-800 rounded-xl pl-4 pr-12 py-2.5 text-sm text-zinc-200 focus:outline-none focus:border-zinc-600 transition-all"
                      />
                      <button 
                        onClick={handleAddAgendaComment}
                        disabled={!newAgendaComment.trim()}
                        className="absolute right-2 top-1/2 -translate-y-1/2 p-1.5 bg-zinc-800 hover:bg-zinc-700 disabled:opacity-50 disabled:hover:bg-zinc-800 text-white rounded-lg transition-all"
                      >
                        <MessageSquare className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Footer */}
      <footer className="max-w-7xl mx-auto px-4 py-12 border-t border-zinc-900 mt-12">
        <div className="flex flex-col md:flex-row justify-between items-center gap-4 text-zinc-600 text-xs font-medium uppercase tracking-widest">
          <p>© 2026 Genk RP Admin System</p>
          <div className="flex gap-6">
            <a href="https://genk.cz/pravidla/redm-pravidla/" target="_blank" rel="noreferrer" className="hover:text-zinc-400 transition-colors">Pravidla</a>
            <a href="https://discord.gg/GPSpeD6UzQ" target="_blank" rel="noreferrer" className="hover:text-zinc-400 transition-colors">Discord</a>
          </div>
        </div>
      </footer>
    </div>
  );
}
