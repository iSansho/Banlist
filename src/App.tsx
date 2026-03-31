import React, { useState, useEffect, useRef } from 'react';
import { format, isAfter, parseISO, addHours, addDays } from 'date-fns';
import { sk, cs } from 'date-fns/locale';
import axios from 'axios';
import { Toaster, toast } from 'sonner';
import { 
  Search, Plus, LogOut, Shield, ShieldCheck, AlertTriangle, Ban, 
  UserMinus, Clock, ExternalLink, Trash2, Edit, Users, 
  Bug as BugIcon, Calendar, History, Settings, ChevronLeft, 
  ChevronRight, AlertCircle, UserPlus, FileText, Loader2, MessageSquare 
} from 'lucide-react';
import { cn } from './lib/utils';
import { supabase, Punishment, PunishmentType, PUNISHMENT_REASONS, Wanted, Bug, Meeting, Log, Admin, PunishmentReason } from './lib/supabase';

export default function App() {
  const [user, setUser] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [isAdmin, setIsAdmin] = useState(false);
  const [isVerified, setIsVerified] = useState(false);
  const [activeSection, setActiveSection] = useState<'DASHBOARD' | 'PLAYERS' | 'FEEDBACK' | 'MEETINGS' | 'LOGS' | 'SETTINGS'>('DASHBOARD');
  const [playersTab, setPlayersTab] = useState<'BANLIST' | 'WATCHLIST'>('BANLIST');
  const [feedbackTab, setFeedbackTab] = useState<'BUGS' | 'SUGGESTIONS'>('BUGS');
  const [settingsTab, setSettingsTab] = useState<'LOGS' | 'ADMINS' | 'REASONS'>('LOGS');
  
  // Data states
  const [punishments, setPunishments] = useState<Punishment[]>([]);
  const [wantedList, setWantedList] = useState<Wanted[]>([]);
  const [bugs, setBugs] = useState<Bug[]>([]);
  const [meetings, setMeetings] = useState<Meeting[]>([]);
  const [logs, setLogs] = useState<Log[]>([]);
  const [admins, setAdmins] = useState<Admin[]>([]);
  const [punishmentReasons, setPunishmentReasons] = useState<PunishmentReason[]>([]);
  const [discordMembers, setDiscordMembers] = useState<any[]>([]);
  const [isDiscordLoading, setIsDiscordLoading] = useState(false);
  const [discordError, setDiscordError] = useState<string | null>(null);

  const [searchTerm, setSearchTerm] = useState('');
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingItem, setEditingItem] = useState<any>(null);
  const [viewingPunishment, setViewingPunishment] = useState<Punishment | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const isVerifyingRef = useRef(false);

  const [formData, setFormData] = useState({
    discord_id: '', discord_username: '', type: 'WARN' as PunishmentType,
    reason: PUNISHMENT_REASONS[0], details: '', evidence_url: '', expires_at: '' as string | null,
    description: '', danger_level: 'LOW' as any, status: 'ACTIVE' as any,
    whitelist_status: 'NONE' as any, title: '', priority: 'LOW' as any,
    bug_status: 'OPEN' as any, scheduled_at: '', location: '', summary: ''
  });

  // --- 1. OPRAVENÉ NAČÍTANIE DISCORD ČLENOV ---
  const fetchDiscordMembers = async () => {
    setIsDiscordLoading(true);
    setDiscordError(null);
    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) throw new Error("Relácia vypršala");

      const response = await axios.get('/api/discord/members', {
        headers: { Authorization: `Bearer ${session.access_token}` }
      });

      if (Array.isArray(response.data)) {
        setDiscordMembers(response.data);
      }
    } catch (error: any) {
      setDiscordError(error.response?.data?.error || error.message);
    } finally {
      setIsDiscordLoading(false);
    }
  };

  // --- 2. OPRAVENÉ OVEROVANIE ADMINA ---
  const verifyAndFetchData = async (currentUser: any) => {
    if (isVerifyingRef.current) return;
    isVerifyingRef.current = true;
    
    try {
      const providerId = currentUser.user_metadata?.provider_id || currentUser.id;
      const isSuperAdmin = currentUser.email === 'Floutic@gmail.com'; 
      
      const { data: adminData } = await supabase
        .from('admins').select('*').eq('discord_id', providerId).maybeSingle();

      const isUserAdmin = isSuperAdmin || !!adminData;
      setIsAdmin(isUserAdmin);

      if (isUserAdmin) {
        await fetchData();
        await fetchDiscordMembers(); // Načítame členov pre vyhľadávanie
        setIsVerified(true);
      }
    } catch (e) {
      console.error("Chyba overovania:", e);
      handleLogout();
    } finally {
      setLoading(false);
      isVerifyingRef.current = false;
    }
  };

  // --- 3. OPRAVENÝ AUTH EFFECT ---
  useEffect(() => {
    const { data: { subscription } } = supabase.auth.onAuthStateChange(async (event, session) => {
      if (session?.user) {
        setUser(session.user);
        if (!isVerified || event === 'SIGNED_IN') {
          await verifyAndFetchData(session.user);
        }
      } else {
        setUser(null);
        setIsAdmin(false);
        setIsVerified(false);
        setLoading(false);
      }
    });
    return () => subscription.unsubscribe();
  }, [isVerified]);

  const fetchData = async () => {
    const [p, w, b, m, l, a, r] = await Promise.all([
      supabase.from('punishments').select('*').order('created_at', { ascending: false }),
      supabase.from('wanted').select('*').order('created_at', { ascending: false }),
      supabase.from('bugs').select('*').order('created_at', { ascending: false }),
      supabase.from('meetings').select('*').order('created_at', { ascending: false }),
      supabase.from('logs').select('*').order('created_at', { ascending: false }),
      supabase.from('admins').select('*').order('created_at', { ascending: false }),
      supabase.from('punishment_reasons').select('*').order('created_at', { ascending: true })
    ]);
    setPunishments(p.data || []);
    setWantedList(w.data || []);
    setBugs(b.data || []);
    setMeetings(m.data || []);
    setLogs(l.data || []);
    setAdmins(a.data || []);
    setPunishmentReasons(r.data || []);
  };

  const handleLogout = async () => {
    await supabase.auth.signOut();
    localStorage.clear();
    sessionStorage.clear();
    window.location.href = '/';
  };

  const handleLogin = () => supabase.auth.signInWithOAuth({ 
    provider: 'discord', options: { redirectTo: window.location.origin } 
  });

  const handleEmailLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    const email = prompt("Zadaj email:");
    const password = prompt("Zadaj heslo:");
    if (email && password) {
      setLoading(true);
      const { error } = await supabase.auth.signInWithPassword({ email, password });
      if (error) {
        toast.error("Chyba: " + error.message);
        setLoading(false);
      }
    }
  };

  // --- ZVYŠOK UI A FUNKCIÍ ZOSTÁVA (handleSubmit, Modaly, atď.) ---
  // Kvôli dĺžke tu pokračuj svojím pôvodným kódom od riadku s handleSubmit...

  if (loading) return (
    <div className="min-h-screen bg-zinc-950 flex items-center justify-center">
      <div className="w-12 h-12 border-4 border-red-600 border-t-transparent rounded-full animate-spin"></div>
    </div>
  );

  if (!user) return (
    <div className="min-h-screen bg-zinc-950 flex flex-col items-center justify-center p-4 text-center">
      <div className="bg-zinc-900 border border-zinc-800 p-8 rounded-3xl shadow-2xl w-full max-w-md">
        <Shield className="w-12 h-12 text-red-600 mx-auto mb-6" />
        <h1 className="text-3xl font-black mb-8">Genk Admin Panel</h1>
        <div className="space-y-4">
          <button onClick={handleLogin} className="w-full bg-indigo-600 py-4 rounded-2xl font-bold flex items-center justify-center gap-3">
             Prihlásiť cez Discord
          </button>
          <button onClick={handleEmailLogin} className="w-full bg-zinc-800 py-3 rounded-2xl font-bold text-sm text-zinc-400">
             Prihlásiť cez Email (Superadmin)
          </button>
        </div>
      </div>
    </div>
  );

  return (
    <div className="min-h-screen bg-zinc-950 text-zinc-100">
       {/* Tu pokračuj s celým svojím <main> a <header> blokom */}
       <header className="border-b border-zinc-800 p-4">
          <div className="max-w-7xl mx-auto flex justify-between items-center">
             <h1 className="font-bold">Genk Admin</h1>
             <button onClick={handleLogout}><LogOut /></button>
          </div>
       </header>
       <main className="p-8">
          {/* Tvoj kód pre Dashboard / Tabuľky */}
          <h2 className="text-2xl font-bold mb-4">Vitaj, {user.email}</h2>
          {/* Tu vlož zvyšok svojej pôvodnej HTML štruktúry */}
       </main>
    </div>
  );
}