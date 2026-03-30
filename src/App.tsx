import React, { useState, useEffect } from 'react';
import { 
  Search, 
  Plus, 
  LogOut, 
  Shield, 
  AlertTriangle, 
  Ban, 
  UserMinus, 
  Clock,
  Filter,
  ExternalLink,
  Trash2,
  Edit2,
  CheckCircle2,
  XCircle,
  Users,
  Bug as BugIcon,
  Calendar,
  History,
  Settings,
  ChevronLeft,
  LayoutDashboard,
  AlertCircle
} from 'lucide-react';
import { supabase, Punishment, PunishmentType, PUNISHMENT_REASONS, PUNISHMENT_TYPES, Wanted, Bug, Meeting, Log } from './lib/supabase';
import { cn } from './lib/utils';
import { format, isAfter, parseISO } from 'date-fns';
import { sk } from 'date-fns/locale';

export default function App() {
  const [user, setUser] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [isAdmin, setIsAdmin] = useState(false);
  const [activeSection, setActiveSection] = useState<'DASHBOARD' | 'BANLIST' | 'WANTED' | 'BUGS' | 'MEETINGS' | 'LOGS'>('DASHBOARD');
  
  // Data states
  const [punishments, setPunishments] = useState<Punishment[]>([]);
  const [wantedList, setWantedList] = useState<Wanted[]>([]);
  const [bugs, setBugs] = useState<Bug[]>([]);
  const [meetings, setMeetings] = useState<Meeting[]>([]);
  const [logs, setLogs] = useState<Log[]>([]);

  const [searchTerm, setSearchTerm] = useState('');
  const [typeFilter, setTypeFilter] = useState<string>('ALL');
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingItem, setEditingItem] = useState<any>(null);

  // Form state
  const [formData, setFormData] = useState({
    // Shared / Punishment
    discord_id: '',
    discord_username: '',
    type: 'WARN' as PunishmentType,
    reason: PUNISHMENT_REASONS[0],
    details: '',
    evidence_url: '',
    expires_at: '' as string | null,

    // Wanted
    description: '',
    danger_level: 'LOW' as 'LOW' | 'MEDIUM' | 'HIGH' | 'EXTREME',
    status: 'ACTIVE' as any,
    whitelist_status: 'NONE' as 'DENIED' | 'ALLOWED' | 'NONE',

    // Bug
    title: '',
    priority: 'LOW' as 'LOW' | 'MEDIUM' | 'HIGH',
    bug_status: 'OPEN' as any,

    // Meeting
    scheduled_at: '',
    location: ''
  });

  useEffect(() => {
    // Check auth session
    supabase.auth.getSession().then(({ data: { session } }) => {
      setUser(session?.user ?? null);
      checkAdminStatus(session?.user);
    });

    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      setUser(session?.user ?? null);
      checkAdminStatus(session?.user);
    });

    fetchData();

    return () => subscription.unsubscribe();
  }, []);

  const checkAdminStatus = (user: any) => {
    if (!user) {
      setIsAdmin(false);
      return;
    }
    const whitelist = import.meta.env.VITE_ADMIN_WHITELIST?.split(',') || [];
    const providerId = user.user_metadata?.provider_id || user.id;
    setIsAdmin(whitelist.includes(providerId));
  };

  const fetchData = async () => {
    setLoading(true);
    await Promise.all([
      fetchPunishments(),
      fetchWanted(),
      fetchBugs(),
      fetchMeetings(),
      fetchLogs()
    ]);
    setLoading(false);
  };

  const logAction = async (action: string, target: string, details: string) => {
    if (!user) return;
    await supabase.from('logs').insert([{
      admin_name: user.user_metadata?.full_name || user.email,
      admin_discord_id: user.user_metadata?.provider_id || user.id,
      action,
      target_name: target,
      details
    }]);
    fetchLogs();
  };

  const fetchPunishments = async () => {
    const { data } = await supabase.from('punishments').select('*').order('created_at', { ascending: false });
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

  const fetchMeetings = async () => {
    const { data } = await supabase.from('meetings').select('*').order('created_at', { ascending: false });
    setMeetings(data || []);
  };

  const fetchLogs = async () => {
    const { data } = await supabase.from('logs').select('*').order('created_at', { ascending: false });
    setLogs(data || []);
  };

  const handleLogin = async () => {
    await supabase.auth.signInWithOAuth({
      provider: 'discord',
      options: {
        redirectTo: window.location.origin
      }
    });
  };

  const handleLogout = async () => {
    await supabase.auth.signOut();
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!isAdmin) return;

    let table = '';
    let payload: any = {};
    let logMsg = '';
    let targetName = '';

    switch (activeSection) {
      case 'BANLIST':
        if (!formData.discord_id && !formData.discord_username) {
          alert('Discord ID alebo Discord Username musí byť vyplnené.');
          return;
        }
        table = 'punishments';
        payload = {
          discord_id: formData.discord_id,
          discord_username: formData.discord_username,
          type: formData.type,
          reason: formData.reason,
          details: formData.details,
          evidence_url: formData.evidence_url,
          expires_at: formData.expires_at || null,
          admin_discord_id: user.user_metadata?.provider_id || user.id,
          admin_name: user.user_metadata?.full_name || user.email,
        };
        logMsg = `${formData.type}: ${formData.reason}`;
        targetName = formData.discord_username || formData.discord_id;
        break;
      case 'WANTED':
        if (!formData.discord_id && !formData.discord_username) {
          alert('Discord ID alebo Discord Username musí byť vyplnené.');
          return;
        }
        table = 'wanted';
        payload = {
          discord_id: formData.discord_id,
          discord_username: formData.discord_username,
          description: formData.description,
          danger_level: formData.danger_level,
          status: formData.status,
          whitelist_status: formData.whitelist_status,
          admin_name: user.user_metadata?.full_name || user.email,
        };
        logMsg = `Level: ${formData.danger_level}, Status: ${formData.status}, WL: ${formData.whitelist_status}`;
        targetName = formData.discord_username || formData.discord_id;
        break;
      case 'BUGS':
        table = 'bugs';
        payload = {
          title: formData.title,
          description: formData.description,
          priority: formData.priority,
          status: formData.bug_status,
          reporter_name: user.user_metadata?.full_name || user.email,
        };
        logMsg = `Priority: ${formData.priority}, Status: ${formData.bug_status}`;
        targetName = formData.title;
        break;
      case 'MEETINGS':
        table = 'meetings';
        payload = {
          title: formData.title,
          description: formData.description,
          scheduled_at: formData.scheduled_at,
          location: formData.location,
          organizer_name: user.user_metadata?.full_name || user.email,
        };
        logMsg = `Kedy: ${formData.scheduled_at}, Kde: ${formData.location}`;
        targetName = formData.title;
        break;
    }

    let error;
    if (editingItem) {
      const { error: updateError } = await supabase
        .from(table)
        .update(payload)
        .eq('id', editingItem.id);
      error = updateError;
      if (!error) logAction(`Upravený ${activeSection}`, targetName, logMsg);
    } else {
      const { error: insertError } = await supabase
        .from(table)
        .insert([payload]);
      error = insertError;
      if (!error) logAction(`Nový ${activeSection}`, targetName, logMsg);
    }

    if (error) {
      alert('Chyba pri ukladaní: ' + error.message);
    } else {
      // Send Webhook for Banlist only for now
      if (activeSection === 'BANLIST') {
        try {
          await fetch('/api/webhook', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              embeds: [{
                title: `${editingItem ? 'Upravený' : 'Nový'} Trest: ${formData.type}`,
                color: formData.type === 'BAN' ? 15158332 : 15844367,
                fields: [
                  { name: 'Užívateľ', value: formData.discord_username || 'Neznámy', inline: true },
                  { name: 'Discord ID', value: formData.discord_id || 'Neznáme', inline: true },
                  { name: 'Dôvod', value: formData.reason },
                  { name: 'Detaily', value: formData.details || 'Žiadne' },
                  { name: 'Dôkaz', value: formData.evidence_url || 'Žiadny' },
                  { name: 'Expirácia', value: formData.expires_at ? format(new Date(formData.expires_at), 'dd.MM.yyyy HH:mm') : 'Permanentný' },
                  { name: 'Admin', value: payload.admin_name }
                ],
                timestamp: new Date().toISOString()
              }]
            })
          });
        } catch (e) {
          console.error('Webhook failed', e);
        }
      }

      setIsModalOpen(false);
      setEditingItem(null);
      resetForm();
      fetchData();
    }
  };

  const resetForm = () => {
    setFormData({
      discord_id: '',
      discord_username: '',
      type: 'WARN',
      reason: PUNISHMENT_REASONS[0],
      details: '',
      evidence_url: '',
      expires_at: '',
      description: '',
      danger_level: 'LOW',
      status: 'ACTIVE',
      whitelist_status: 'NONE',
      title: '',
      priority: 'LOW',
      bug_status: 'OPEN',
      scheduled_at: '',
      location: ''
    });
  };

  const handleDelete = async (id: string) => {
    if (!isAdmin || !confirm('Naozaj chcete vymazať tento záznam?')) return;
    
    let table = '';
    let name = '';
    switch(activeSection) {
      case 'BANLIST': table = 'punishments'; name = punishments.find(p => p.id === id)?.target_name || 'Trest'; break;
      case 'WANTED': table = 'wanted'; name = wantedList.find(w => w.id === id)?.target_name || 'Wanted'; break;
      case 'BUGS': table = 'bugs'; name = bugs.find(b => b.id === id)?.title || 'Bug'; break;
      case 'MEETINGS': table = 'meetings'; name = meetings.find(m => m.id === id)?.title || 'Meeting'; break;
    }

    const { error } = await supabase.from(table).delete().eq('id', id);
    if (error) alert('Chyba: ' + error.message);
    else {
      logAction(`Vymazaný ${activeSection}`, name, `ID: ${id}`);
      fetchData();
    }
  };

  const handleEdit = (item: any) => {
    setEditingItem(item);
    if (activeSection === 'BANLIST') {
      setFormData({
        ...formData,
        discord_id: item.discord_id || '',
        discord_username: item.discord_username || '',
        type: item.type,
        reason: item.reason,
        details: item.details,
        evidence_url: item.evidence_url,
        expires_at: item.expires_at ? new Date(item.expires_at).toISOString().slice(0, 16) : '',
      });
    } else if (activeSection === 'WANTED') {
      setFormData({
        ...formData,
        description: item.description,
        discord_id: item.discord_id || '',
        discord_username: item.discord_username || '',
        danger_level: item.danger_level,
        status: item.status,
        whitelist_status: item.whitelist_status,
      });
    } else if (activeSection === 'BUGS') {
      setFormData({
        ...formData,
        title: item.title,
        description: item.description,
        priority: item.priority,
        bug_status: item.status,
      });
    } else if (activeSection === 'MEETINGS') {
      setFormData({
        ...formData,
        title: item.title,
        description: item.description,
        scheduled_at: item.scheduled_at ? new Date(item.scheduled_at).toISOString().slice(0, 16) : '',
        location: item.location,
      });
    }
    setIsModalOpen(true);
  };

  const filteredPunishments = punishments.filter(p => {
    const matchesSearch = (p.discord_username?.toLowerCase().includes(searchTerm.toLowerCase()) || false) || 
                         (p.discord_id?.toLowerCase().includes(searchTerm.toLowerCase()) || false);
    const matchesType = typeFilter === 'ALL' || p.type === typeFilter;
    return matchesSearch && matchesType;
  });

  const filteredWanted = wantedList.filter(w => {
    const matchesSearch = (w.discord_username?.toLowerCase().includes(searchTerm.toLowerCase()) || false) || 
                         (w.discord_id?.toLowerCase().includes(searchTerm.toLowerCase()) || false) ||
                         (w.description?.toLowerCase().includes(searchTerm.toLowerCase()) || false);
    return matchesSearch;
  });

  const isExpired = (date: string | null) => {
    if (!date) return false;
    return !isAfter(parseISO(date), new Date());
  };

  const getTypeIcon = (type: PunishmentType) => {
    switch (type) {
      case 'WARN': return <AlertTriangle className="w-4 h-4 text-yellow-500" />;
      case 'BAN': return <Ban className="w-4 h-4 text-red-500" />;
      case 'WL-DOWN': return <UserMinus className="w-4 h-4 text-orange-500" />;
      case 'SUSPEND': return <Clock className="w-4 h-4 text-blue-500" />;
    }
  };

  if (loading && !user) {
    return (
      <div className="min-h-screen bg-zinc-950 flex items-center justify-center">
        <div className="flex flex-col items-center gap-4">
          <div className="w-12 h-12 border-4 border-red-600 border-t-transparent rounded-full animate-spin"></div>
          <p className="text-zinc-500 font-medium animate-pulse">Overujem prístup...</p>
        </div>
      </div>
    );
  }

  if (!user) {
    return (
      <div className="min-h-screen bg-zinc-950 flex flex-col items-center justify-center p-4 relative overflow-hidden">
        {/* Background Glow */}
        <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[500px] h-[500px] bg-red-600/10 blur-[120px] rounded-full"></div>
        
        <div className="relative z-10 w-full max-w-md">
          <div className="bg-zinc-900 border border-zinc-800 p-8 rounded-3xl shadow-2xl text-center">
            <div className="inline-flex bg-red-600 p-4 rounded-2xl shadow-xl shadow-red-900/20 mb-6">
              <Shield className="w-10 h-10 text-white" />
            </div>
            <h1 className="text-3xl font-black tracking-tight mb-2">Genk Admin Panel</h1>
            <p className="text-zinc-500 text-sm mb-8">Prihláste sa pomocou vášho Discord účtu pre prístup k internému systému.</p>
            
            <button 
              onClick={handleLogin}
              className="w-full bg-indigo-600 hover:bg-indigo-700 text-white font-bold py-4 rounded-2xl transition-all flex items-center justify-center gap-3 shadow-lg shadow-indigo-900/20 group"
            >
              <svg className="w-6 h-6 fill-current" viewBox="0 0 24 24">
                <path d="M20.317 4.37a19.791 19.791 0 0 0-4.885-1.515.074.074 0 0 0-.079.037c-.21.375-.444.864-.608 1.25a18.27 18.27 0 0 0-5.487 0 12.64 12.64 0 0 0-.617-1.25.077.077 0 0 0-.079-.037A19.736 19.736 0 0 0 3.677 4.37a.07.07 0 0 0-.032.027C.533 9.046-.32 13.58.099 18.057a.082.082 0 0 0 .031.057 19.9 19.9 0 0 0 5.993 3.03.078.078 0 0 0 .084-.028 14.09 14.09 0 0 0 1.226-1.994.076.076 0 0 0-.041-.106 13.107 13.107 0 0 1-1.872-.892.077.077 0 0 1-.008-.128 10.2 10.2 0 0 0 .372-.292.074.074 0 0 1 .077-.01c3.928 1.793 8.18 1.793 12.062 0a.074.074 0 0 1 .078.01c.12.098.246.198.373.292a.077.077 0 0 1-.006.127 12.299 12.299 0 0 1-1.873.892.077.077 0 0 0-.041.107c.36.698.772 1.362 1.225 1.993a.076.076 0 0 0 .084.028 19.839 19.839 0 0 0 6.002-3.03.077.077 0 0 0 .032-.054c.5-5.177-.838-9.674-3.549-13.66a.061.061 0 0 0-.031-.03zM8.02 15.33c-1.183 0-2.157-1.085-2.157-2.419 0-1.333.956-2.419 2.157-2.419 1.21 0 2.176 1.096 2.157 2.42 0 1.333-.956 2.419-2.157 2.419zm7.975 0c-1.183 0-2.157-1.085-2.157-2.419 0-1.333.955-2.419 2.157-2.419 1.21 0 2.176 1.096 2.157 2.42 0 1.333-.946 2.419-2.157 2.419z"/>
              </svg>
              Prihlásiť cez Discord
            </button>

            {/* Test Mode Button - Only visible in development or via query param */}
            {(import.meta.env.DEV || window.location.search.includes('test=true')) && (
              <button 
                onClick={() => {
                  const mockUser = {
                    id: 'test-admin-id',
                    email: 'test@admin.local',
                    user_metadata: {
                      full_name: 'Test Admin',
                      provider_id: import.meta.env.VITE_ADMIN_WHITELIST?.split(',')[0] || 'test-admin-id'
                    }
                  };
                  setUser(mockUser);
                  setIsAdmin(true);
                  setLoading(false);
                }}
                className="w-full mt-4 bg-zinc-800 hover:bg-zinc-700 text-zinc-400 hover:text-white font-medium py-3 rounded-2xl border border-zinc-700 border-dashed transition-all flex items-center justify-center gap-2"
              >
                <Shield className="w-4 h-4" /> Simulovať Admin Prístup (Test)
              </button>
            )}
            
            <div className="mt-8 pt-8 border-t border-zinc-800">
              <p className="text-[10px] text-zinc-600 uppercase tracking-[0.2em] font-bold">Zabezpečený prístup</p>
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
              <p className="text-xs text-zinc-500 uppercase tracking-widest font-semibold">Interný Systém</p>
            </div>
          </div>

          <div className="flex items-center gap-4">
            {activeSection !== 'DASHBOARD' && (
              <button 
                onClick={() => setActiveSection('DASHBOARD')}
                className="hidden md:flex items-center gap-2 text-sm text-zinc-400 hover:text-white transition-colors mr-4"
              >
                <ChevronLeft className="w-4 h-4" /> Späť na výber
              </button>
            )}
            {user ? (
              <div className="flex items-center gap-4">
                <div className="hidden md:block text-right">
                  <p className="text-sm font-medium">{user.user_metadata?.full_name || user.email}</p>
                  <p className="text-[10px] text-zinc-500 uppercase tracking-wider">
                    {isAdmin ? 'Administrátor' : 'Používateľ'}
                  </p>
                </div>
                {isAdmin && (
                  <button 
                    onClick={() => setActiveSection('LOGS')}
                    className={cn(
                      "p-2 rounded-full transition-colors",
                      activeSection === 'LOGS' ? "bg-red-600 text-white" : "text-zinc-400 hover:text-white hover:bg-zinc-800"
                    )}
                    title="Admin Nastavenia / Logy"
                  >
                    <Settings className="w-5 h-5" />
                  </button>
                )}
                <button 
                  onClick={handleLogout}
                  className="p-2 hover:bg-zinc-800 rounded-full transition-colors text-zinc-400 hover:text-white"
                  title="Odhlásiť sa"
                >
                  <LogOut className="w-5 h-5" />
                </button>
              </div>
            ) : (
              <button 
                onClick={handleLogin}
                className="bg-indigo-600 hover:bg-indigo-700 text-white px-4 py-2 rounded-lg text-sm font-medium transition-all flex items-center gap-2"
              >
                Prihlásiť cez Discord
              </button>
            )}
          </div>
        </div>
      </header>

      <main className="max-w-7xl mx-auto px-4 py-8">
        {activeSection === 'DASHBOARD' ? (
          <div className="space-y-8">
            <div className="text-center space-y-2 mb-12">
              <h2 className="text-4xl font-black tracking-tight">Vitajte, {user.user_metadata?.full_name?.split(' ')[0] || 'Admin'}</h2>
              <p className="text-zinc-500">Vyberte sekciu, ktorú chcete spravovať.</p>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 xl:grid-cols-5 gap-6">
              {/* Banlist Card */}
              <button 
                onClick={() => setActiveSection('BANLIST')}
                className="group relative bg-zinc-900 border border-zinc-800 p-8 rounded-3xl hover:border-red-600/50 transition-all text-left overflow-hidden"
              >
                <div className="absolute top-0 right-0 p-6 opacity-10 group-hover:opacity-20 transition-opacity">
                  <Ban className="w-24 h-24 text-red-600" />
                </div>
                <div className="relative z-10">
                  <div className="bg-red-600/10 p-3 rounded-2xl w-fit mb-6 group-hover:bg-red-600 group-hover:text-white transition-all">
                    <Ban className="w-6 h-6 text-red-500 group-hover:text-white" />
                  </div>
                  <h3 className="text-xl font-bold mb-2">Banlist</h3>
                  <p className="text-zinc-500 text-sm">Správa trestov, banov a varovaní pre hráčov.</p>
                  <div className="mt-6 flex items-center gap-2 text-xs font-bold text-red-500 uppercase tracking-widest opacity-0 group-hover:opacity-100 transition-all translate-y-2 group-hover:translate-y-0">
                    Otvoriť sekciu <ChevronLeft className="w-4 h-4 rotate-180" />
                  </div>
                </div>
              </button>

              {/* Wanted Card */}
              <button 
                onClick={() => setActiveSection('WANTED')}
                className="group relative bg-zinc-900 border border-zinc-800 p-8 rounded-3xl hover:border-orange-600/50 transition-all text-left overflow-hidden"
              >
                <div className="absolute top-0 right-0 p-6 opacity-10 group-hover:opacity-20 transition-opacity">
                  <Users className="w-24 h-24 text-orange-600" />
                </div>
                <div className="relative z-10">
                  <div className="bg-orange-600/10 p-3 rounded-2xl w-fit mb-6 group-hover:bg-orange-600 group-hover:text-white transition-all">
                    <Users className="w-6 h-6 text-orange-500 group-hover:text-white" />
                  </div>
                  <h3 className="text-xl font-bold mb-2">Wanted</h3>
                  <p className="text-zinc-500 text-sm">Zoznam hľadaných osôb a nebezpečných subjektov.</p>
                  <div className="mt-6 flex items-center gap-2 text-xs font-bold text-orange-500 uppercase tracking-widest opacity-0 group-hover:opacity-100 transition-all translate-y-2 group-hover:translate-y-0">
                    Otvoriť sekciu <ChevronLeft className="w-4 h-4 rotate-180" />
                  </div>
                </div>
              </button>

              {/* Bugs Card */}
              <button 
                onClick={() => setActiveSection('BUGS')}
                className="group relative bg-zinc-900 border border-zinc-800 p-8 rounded-3xl hover:border-blue-600/50 transition-all text-left overflow-hidden"
              >
                <div className="absolute top-0 right-0 p-6 opacity-10 group-hover:opacity-20 transition-opacity">
                  <BugIcon className="w-24 h-24 text-blue-600" />
                </div>
                <div className="relative z-10">
                  <div className="bg-blue-600/10 p-3 rounded-2xl w-fit mb-6 group-hover:bg-blue-600 group-hover:text-white transition-all">
                    <BugIcon className="w-6 h-6 text-blue-500 group-hover:text-white" />
                  </div>
                  <h3 className="text-xl font-bold mb-2">Bugs</h3>
                  <p className="text-zinc-500 text-sm">Hlásenia chýb a technických problémov servera.</p>
                  <div className="mt-6 flex items-center gap-2 text-xs font-bold text-blue-500 uppercase tracking-widest opacity-0 group-hover:opacity-100 transition-all translate-y-2 group-hover:translate-y-0">
                    Otvoriť sekciu <ChevronLeft className="w-4 h-4 rotate-180" />
                  </div>
                </div>
              </button>

              {/* Meetings Card */}
              <button 
                onClick={() => setActiveSection('MEETINGS')}
                className="group relative bg-zinc-900 border border-zinc-800 p-8 rounded-3xl hover:border-purple-600/50 transition-all text-left overflow-hidden"
              >
                <div className="absolute top-0 right-0 p-6 opacity-10 group-hover:opacity-20 transition-opacity">
                  <Calendar className="w-24 h-24 text-purple-600" />
                </div>
                <div className="relative z-10">
                  <div className="bg-purple-600/10 p-3 rounded-2xl w-fit mb-6 group-hover:bg-purple-600 group-hover:text-white transition-all">
                    <Calendar className="w-6 h-6 text-purple-500 group-hover:text-white" />
                  </div>
                  <h3 className="text-xl font-bold mb-2">Meetings</h3>
                  <p className="text-zinc-500 text-sm">Plánované porady a dôležité stretnutia tímu.</p>
                  <div className="mt-6 flex items-center gap-2 text-xs font-bold text-purple-500 uppercase tracking-widest opacity-0 group-hover:opacity-100 transition-all translate-y-2 group-hover:translate-y-0">
                    Otvoriť sekciu <ChevronLeft className="w-4 h-4 rotate-180" />
                  </div>
                </div>
              </button>

              {/* Logs Card (Admin Only) */}
              {isAdmin && (
                <button 
                  onClick={() => setActiveSection('LOGS')}
                  className="group relative bg-zinc-900 border border-zinc-800 p-8 rounded-3xl hover:border-zinc-500/50 transition-all text-left overflow-hidden"
                >
                  <div className="absolute top-0 right-0 p-6 opacity-10 group-hover:opacity-20 transition-opacity">
                    <History className="w-24 h-24 text-zinc-600" />
                  </div>
                  <div className="relative z-10">
                    <div className="bg-zinc-600/10 p-3 rounded-2xl w-fit mb-6 group-hover:bg-zinc-600 group-hover:text-white transition-all">
                      <History className="w-6 h-6 text-zinc-500 group-hover:text-white" />
                    </div>
                    <h3 className="text-xl font-bold mb-2">Admin Logy</h3>
                    <p className="text-zinc-500 text-sm">História všetkých akcií vykonaných administrátormi.</p>
                    <div className="mt-6 flex items-center gap-2 text-xs font-bold text-zinc-500 uppercase tracking-widest opacity-0 group-hover:opacity-100 transition-all translate-y-2 group-hover:translate-y-0">
                      Otvoriť sekciu <ChevronLeft className="w-4 h-4 rotate-180" />
                    </div>
                  </div>
                </button>
              )}
            </div>
          </div>
        ) : activeSection === 'BANLIST' ? (
          <>
            {/* Banlist UI (Existing) */}
            <div className="flex flex-col md:flex-row gap-4 mb-8 items-center justify-between">
              <div className="flex flex-wrap gap-2 w-full md:w-auto">
                <div className="relative flex-1 md:w-80">
                  <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-zinc-500" />
                  <input 
                    type="text" 
                    placeholder="Hľadať podľa Discordu..." 
                    className="w-full bg-zinc-900 border border-zinc-800 rounded-xl py-2.5 pl-10 pr-4 text-sm focus:outline-none focus:ring-2 focus:ring-red-500/50 transition-all"
                    value={searchTerm}
                    onChange={(e) => setSearchTerm(e.target.value)}
                  />
                </div>
                <div className="relative">
                  <Filter className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-zinc-500" />
                  <select 
                    className="bg-zinc-900 border border-zinc-800 rounded-xl py-2.5 pl-10 pr-8 text-sm focus:outline-none focus:ring-2 focus:ring-red-500/50 appearance-none cursor-pointer"
                    value={typeFilter}
                    onChange={(e) => setTypeFilter(e.target.value)}
                  >
                    <option value="ALL">Všetky typy</option>
                    <option value="WARN">Warn</option>
                    <option value="BAN">Ban</option>
                    <option value="WL-DOWN">WL-Down</option>
                    <option value="SUSPEND">Suspend</option>
                  </select>
                </div>
              </div>

              {isAdmin && (
                <button 
                  onClick={() => { resetForm(); setEditingItem(null); setIsModalOpen(true); }}
                  className="w-full md:w-auto bg-red-600 hover:bg-red-700 text-white px-6 py-2.5 rounded-xl text-sm font-bold transition-all flex items-center justify-center gap-2 shadow-lg shadow-red-900/20"
                >
                  <Plus className="w-4 h-4" /> Pridať Trest
                </button>
              )}
            </div>

            <div className="bg-zinc-900 border border-zinc-800 rounded-2xl overflow-hidden shadow-xl">
              <div className="overflow-x-auto">
                <table className="w-full text-left border-collapse">
                  <thead>
                    <tr className="bg-zinc-800/50 border-b border-zinc-800">
                      <th className="px-6 py-4 text-[11px] font-bold uppercase tracking-widest text-zinc-500">Užívateľ</th>
                      <th className="px-6 py-4 text-[11px] font-bold uppercase tracking-widest text-zinc-500">Typ</th>
                      <th className="px-6 py-4 text-[11px] font-bold uppercase tracking-widest text-zinc-500">Dôvod</th>
                      <th className="px-6 py-4 text-[11px] font-bold uppercase tracking-widest text-zinc-500">Expirácia</th>
                      <th className="px-6 py-4 text-[11px] font-bold uppercase tracking-widest text-zinc-500">Admin</th>
                      <th className="px-6 py-4 text-[11px] font-bold uppercase tracking-widest text-zinc-500 text-right">Akcie</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-zinc-800">
                    {loading ? (
                      <tr>
                        <td colSpan={6} className="px-6 py-12 text-center text-zinc-500 animate-pulse">Načítavam záznamy...</td>
                      </tr>
                    ) : filteredPunishments.length === 0 ? (
                      <tr>
                        <td colSpan={6} className="px-6 py-12 text-center text-zinc-500">Nenašli sa žiadne záznamy.</td>
                      </tr>
                    ) : filteredPunishments.map((p) => {
                      const expired = isExpired(p.expires_at);
                      const isBan = p.type === 'BAN';
                      
                      return (
                        <tr 
                          key={p.id} 
                          className={cn(
                            "group hover:bg-zinc-800/30 transition-colors",
                            isBan && !expired && "border-l-4 border-l-red-600",
                            expired && "opacity-60"
                          )}
                        >
                          <td className="px-6 py-4">
                            <div className="font-medium text-zinc-100">{p.discord_username || 'Neznámy'}</div>
                            <div className="text-xs text-zinc-500 font-mono">{p.discord_id || 'Neznáme'}</div>
                          </td>
                          <td className="px-6 py-4">
                            <div className="flex items-center gap-2">
                              {getTypeIcon(p.type)}
                              <span className="text-sm font-semibold">{p.type}</span>
                            </div>
                          </td>
                          <td className="px-6 py-4">
                            <div className="text-sm text-zinc-300 max-w-xs truncate" title={p.reason}>
                              {p.reason}
                            </div>
                            {p.details && <div className="text-[10px] text-zinc-500 truncate max-w-xs">{p.details}</div>}
                          </td>
                          <td className="px-6 py-4">
                            <div className="flex items-center gap-2 text-sm">
                              {p.expires_at ? (
                                <>
                                  <Clock className="w-3.5 h-3.5 text-zinc-500" />
                                  <span className={cn(expired ? "text-zinc-500" : "text-zinc-300")}>
                                    {format(parseISO(p.expires_at), 'dd.MM.yyyy', { locale: sk })}
                                  </span>
                                  {expired ? (
                                    <XCircle className="w-3.5 h-3.5 text-zinc-600" title="Vypršané" />
                                  ) : (
                                    <CheckCircle2 className="w-3.5 h-3.5 text-green-500" title="Aktívne" />
                                  )}
                                </>
                              ) : (
                                <span className="text-red-500 font-bold text-xs uppercase tracking-tighter">Permanentný</span>
                              )}
                            </div>
                          </td>
                          <td className="px-6 py-4">
                            <div className="text-sm text-zinc-400">{p.admin_name}</div>
                            <div className="text-[10px] text-zinc-600 font-mono">{p.admin_discord_id}</div>
                          </td>
                          <td className="px-6 py-4 text-right">
                            <div className="flex items-center justify-end gap-2 opacity-0 group-hover:opacity-100 transition-opacity">
                              {p.evidence_url && (
                                <a 
                                  href={p.evidence_url} 
                                  target="_blank" 
                                  rel="noreferrer"
                                  className="p-1.5 hover:bg-zinc-700 rounded-lg text-zinc-400 hover:text-blue-400 transition-colors"
                                  title="Dôkaz"
                                >
                                  <ExternalLink className="w-4 h-4" />
                                </a>
                              )}
                              {isAdmin && (
                                <>
                                  <button 
                                    onClick={() => handleEdit(p)}
                                    className="p-1.5 hover:bg-zinc-700 rounded-lg text-zinc-400 hover:text-white transition-colors"
                                    title="Upraviť"
                                  >
                                    <Edit2 className="w-4 h-4" />
                                  </button>
                                  <button 
                                    onClick={() => handleDelete(p.id)}
                                    className="p-1.5 hover:bg-zinc-700 rounded-lg text-zinc-400 hover:text-red-500 transition-colors"
                                    title="Vymazať"
                                  >
                                    <Trash2 className="w-4 h-4" />
                                  </button>
                                </>
                              )}
                            </div>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </div>
          </>
        ) : activeSection === 'WANTED' ? (
          <div className="space-y-6">
            <div className="flex flex-col md:flex-row gap-4 items-center justify-between">
              <h2 className="text-2xl font-bold flex items-center gap-3">
                <Users className="w-6 h-6 text-orange-500" /> Wanted List
              </h2>
              <div className="flex flex-col md:flex-row gap-4 w-full md:w-auto">
                <div className="relative flex-1 md:w-80">
                  <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-zinc-500" />
                  <input 
                    type="text" 
                    placeholder="Hľadať v Wanted..." 
                    className="w-full bg-zinc-900 border border-zinc-800 rounded-xl py-2.5 pl-10 pr-4 text-sm focus:outline-none focus:ring-2 focus:ring-orange-500/50 transition-all"
                    value={searchTerm}
                    onChange={(e) => setSearchTerm(e.target.value)}
                  />
                </div>
                {isAdmin && (
                  <button 
                    onClick={() => { resetForm(); setEditingItem(null); setIsModalOpen(true); }}
                    className="w-full md:w-auto bg-orange-600 hover:bg-orange-700 text-white px-6 py-2.5 rounded-xl text-sm font-bold transition-all flex items-center justify-center gap-2 shadow-lg shadow-orange-900/20"
                  >
                    <Plus className="w-4 h-4" /> Pridať Hľadaného
                  </button>
                )}
              </div>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
              {filteredWanted.map((w) => (
                <div key={w.id} className="bg-zinc-900 border border-zinc-800 rounded-2xl p-6 relative group overflow-hidden">
                  <div className={cn(
                    "absolute top-0 right-0 px-4 py-1 text-[10px] font-bold uppercase tracking-widest rounded-bl-xl",
                    w.danger_level === 'EXTREME' ? "bg-red-600 text-white" :
                    w.danger_level === 'HIGH' ? "bg-orange-600 text-white" :
                    w.danger_level === 'MEDIUM' ? "bg-yellow-600 text-black" : "bg-zinc-700 text-zinc-300"
                  )}>
                    {w.danger_level}
                  </div>
                  <h3 className="text-xl font-bold mb-1">{w.discord_username || w.discord_id || 'Neznámy'}</h3>
                  <div className="flex flex-col gap-1 mb-4">
                    {w.discord_username && w.discord_id && <p className="text-xs text-zinc-500 font-mono">ID: {w.discord_id}</p>}
                  </div>
                  <p className="text-sm text-zinc-300 mb-6 line-clamp-3">{w.description}</p>
                  <div className="flex items-center justify-between pt-4 border-t border-zinc-800">
                    <div className="flex gap-2">
                      <span className={cn(
                        "text-[10px] font-bold uppercase px-2 py-1 rounded-md",
                        w.status === 'ACTIVE' ? "bg-green-500/10 text-green-500" : "bg-zinc-800 text-zinc-500"
                      )}>
                        {w.status}
                      </span>
                      {w.whitelist_status !== 'NONE' && (
                        <span className={cn(
                          "text-[10px] font-bold uppercase px-2 py-1 rounded-md",
                          w.whitelist_status === 'ALLOWED' ? "bg-blue-500/10 text-blue-500" : "bg-red-500/10 text-red-500"
                        )}>
                          WL: {w.whitelist_status === 'ALLOWED' ? 'POVOLENÝ' : 'ZAMITNUTÝ'}
                        </span>
                      )}
                    </div>
                    {isAdmin && (
                      <div className="flex gap-2">
                        <button onClick={() => handleEdit(w)} className="p-1.5 hover:bg-zinc-800 rounded-lg text-zinc-500 hover:text-white transition-colors">
                          <Edit2 className="w-4 h-4" />
                        </button>
                        <button onClick={() => handleDelete(w.id)} className="p-1.5 hover:bg-zinc-800 rounded-lg text-zinc-500 hover:text-red-500 transition-colors">
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </div>
                    )}
                  </div>
                </div>
              ))}
            </div>
          </div>
        ) : activeSection === 'BUGS' ? (
          <div className="space-y-6">
            <div className="flex flex-col md:flex-row gap-4 items-center justify-between">
              <h2 className="text-2xl font-bold flex items-center gap-3">
                <BugIcon className="w-6 h-6 text-blue-500" /> Bug Tracker
              </h2>
              {isAdmin && (
                <button 
                  onClick={() => { resetForm(); setEditingItem(null); setIsModalOpen(true); }}
                  className="w-full md:w-auto bg-blue-600 hover:bg-blue-700 text-white px-6 py-2.5 rounded-xl text-sm font-bold transition-all flex items-center justify-center gap-2 shadow-lg shadow-blue-900/20"
                >
                  <Plus className="w-4 h-4" /> Nahlásiť Bug
                </button>
              )}
            </div>
            <div className="bg-zinc-900 border border-zinc-800 rounded-2xl overflow-hidden">
              <table className="w-full text-left">
                <thead>
                  <tr className="bg-zinc-800/50 border-b border-zinc-800">
                    <th className="px-6 py-4 text-[11px] font-bold uppercase tracking-widest text-zinc-500">Priorita</th>
                    <th className="px-6 py-4 text-[11px] font-bold uppercase tracking-widest text-zinc-500">Názov</th>
                    <th className="px-6 py-4 text-[11px] font-bold uppercase tracking-widest text-zinc-500">Status</th>
                    <th className="px-6 py-4 text-[11px] font-bold uppercase tracking-widest text-zinc-500">Reportér</th>
                    <th className="px-6 py-4 text-[11px] font-bold uppercase tracking-widest text-zinc-500 text-right">Akcie</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-zinc-800">
                  {bugs.map((b) => (
                    <tr key={b.id} className="hover:bg-zinc-800/30 transition-colors">
                      <td className="px-6 py-4">
                        <span className={cn(
                          "text-[10px] font-bold uppercase px-2 py-1 rounded-md",
                          b.priority === 'HIGH' ? "bg-red-500/10 text-red-500" :
                          b.priority === 'MEDIUM' ? "bg-yellow-500/10 text-yellow-500" : "bg-blue-500/10 text-blue-500"
                        )}>
                          {b.priority}
                        </span>
                      </td>
                      <td className="px-6 py-4">
                        <div className="text-sm font-medium">{b.title}</div>
                        <div className="text-xs text-zinc-500 truncate max-w-xs">{b.description}</div>
                      </td>
                      <td className="px-6 py-4">
                        <span className="text-xs font-semibold text-zinc-400">{b.status}</span>
                      </td>
                      <td className="px-6 py-4 text-sm text-zinc-500">{b.reporter_name}</td>
                      <td className="px-6 py-4 text-right">
                        {isAdmin && (
                          <div className="flex justify-end gap-2">
                            <button onClick={() => handleEdit(b)} className="p-1.5 hover:bg-zinc-800 rounded-lg text-zinc-500 hover:text-white transition-colors">
                              <Edit2 className="w-4 h-4" />
                            </button>
                            <button onClick={() => handleDelete(b.id)} className="p-1.5 hover:bg-zinc-800 rounded-lg text-zinc-500 hover:text-red-500 transition-colors">
                              <Trash2 className="w-4 h-4" />
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
        ) : activeSection === 'MEETINGS' ? (
          <div className="space-y-6">
            <div className="flex flex-col md:flex-row gap-4 items-center justify-between">
              <h2 className="text-2xl font-bold flex items-center gap-3">
                <Calendar className="w-6 h-6 text-purple-500" /> Meetings
              </h2>
              {isAdmin && (
                <button 
                  onClick={() => { resetForm(); setEditingItem(null); setIsModalOpen(true); }}
                  className="w-full md:w-auto bg-purple-600 hover:bg-purple-700 text-white px-6 py-2.5 rounded-xl text-sm font-bold transition-all flex items-center justify-center gap-2 shadow-lg shadow-purple-900/20"
                >
                  <Plus className="w-4 h-4" /> Naplánovať Meeting
                </button>
              )}
            </div>
            <div className="space-y-4">
              {meetings.map((m) => (
                <div key={m.id} className="bg-zinc-900 border border-zinc-800 rounded-2xl p-6 flex flex-col md:flex-row gap-6 items-start md:items-center">
                  <div className="bg-zinc-800 p-4 rounded-2xl text-center min-w-[100px]">
                    <div className="text-xs font-bold text-purple-500 uppercase tracking-widest mb-1">
                      {format(parseISO(m.scheduled_at), 'MMM', { locale: sk })}
                    </div>
                    <div className="text-2xl font-black">{format(parseISO(m.scheduled_at), 'dd')}</div>
                  </div>
                  <div className="flex-1 space-y-1">
                    <h3 className="text-xl font-bold">{m.title}</h3>
                    <p className="text-sm text-zinc-500 flex items-center gap-4">
                      <span className="flex items-center gap-1.5"><Clock className="w-3.5 h-3.5" /> {format(parseISO(m.scheduled_at), 'HH:mm')}</span>
                      <span className="flex items-center gap-1.5"><Shield className="w-3.5 h-3.5" /> {m.location}</span>
                    </p>
                    <p className="text-sm text-zinc-400 pt-2">{m.description}</p>
                  </div>
                  {isAdmin && (
                    <div className="flex gap-2">
                      <button onClick={() => handleEdit(m)} className="p-2 hover:bg-zinc-800 rounded-xl text-zinc-500 hover:text-white transition-colors border border-zinc-800">
                        <Edit2 className="w-4 h-4" />
                      </button>
                      <button onClick={() => handleDelete(m.id)} className="p-2 hover:bg-zinc-800 rounded-xl text-zinc-500 hover:text-red-500 transition-colors border border-zinc-800">
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </div>
                  )}
                </div>
              ))}
            </div>
          </div>
        ) : activeSection === 'LOGS' ? (
          isAdmin ? (
            <div className="space-y-6">
              <div className="flex items-center justify-between">
                <h2 className="text-2xl font-bold flex items-center gap-3">
                  <History className="w-6 h-6 text-red-500" /> Admin Logy
                </h2>
              </div>
              <div className="bg-zinc-900 border border-zinc-800 rounded-2xl overflow-hidden shadow-xl">
                <div className="overflow-x-auto">
                  <table className="w-full text-left border-collapse">
                    <thead>
                      <tr className="bg-zinc-800/50 border-b border-zinc-800">
                        <th className="px-6 py-4 text-[11px] font-bold uppercase tracking-widest text-zinc-500">Čas</th>
                        <th className="px-6 py-4 text-[11px] font-bold uppercase tracking-widest text-zinc-500">Admin</th>
                        <th className="px-6 py-4 text-[11px] font-bold uppercase tracking-widest text-zinc-500">Akcia</th>
                        <th className="px-6 py-4 text-[11px] font-bold uppercase tracking-widest text-zinc-500">Cieľ</th>
                        <th className="px-6 py-4 text-[11px] font-bold uppercase tracking-widest text-zinc-500">Detaily</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-zinc-800">
                      {logs.map((log) => (
                        <tr key={log.id} className="hover:bg-zinc-800/30 transition-colors">
                          <td className="px-6 py-4 text-xs text-zinc-500 font-mono">
                            {format(parseISO(log.created_at), 'dd.MM HH:mm:ss')}
                          </td>
                          <td className="px-6 py-4">
                            <div className="text-sm font-medium">{log.admin_name}</div>
                            <div className="text-[10px] text-zinc-600 font-mono">{log.admin_discord_id}</div>
                          </td>
                          <td className="px-6 py-4">
                            <span className={cn(
                              "text-[10px] font-bold uppercase px-2 py-1 rounded-md",
                              log.action.includes('Vymazaný') ? "bg-red-500/10 text-red-500" : 
                              log.action.includes('Upravený') ? "bg-blue-500/10 text-blue-500" : 
                              "bg-green-500/10 text-green-500"
                            )}>
                              {log.action}
                            </span>
                          </td>
                          <td className="px-6 py-4 text-sm text-zinc-300">{log.target_name}</td>
                          <td className="px-6 py-4 text-xs text-zinc-500">{log.details}</td>
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
              <h2 className="text-2xl font-bold">Prístup Odmietnutý</h2>
              <p className="text-zinc-500 max-w-md">Túto sekciu môžu vidieť iba administrátori.</p>
              <button 
                onClick={() => setActiveSection('DASHBOARD')}
                className="bg-zinc-800 hover:bg-zinc-700 text-white px-6 py-2 rounded-xl transition-all"
              >
                Späť na Dashboard
              </button>
            </div>
          )
        ) : (
          <div className="flex flex-col items-center justify-center py-20 text-center space-y-4">
            <div className="bg-zinc-900 p-6 rounded-full border border-zinc-800">
              <AlertCircle className="w-12 h-12 text-zinc-700" />
            </div>
            <h2 className="text-2xl font-bold">Sekcia vo vývoji</h2>
            <p className="text-zinc-500 max-w-md">Sekcia {activeSection} je momentálne v príprave. Čoskoro tu pribudne plná funkcionalita.</p>
            <button 
              onClick={() => setActiveSection('DASHBOARD')}
              className="bg-zinc-800 hover:bg-zinc-700 text-white px-6 py-2 rounded-xl transition-all"
            >
              Späť na Dashboard
            </button>
          </div>
        )}
      </main>

      {/* Modal */}
      {isModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm">
          <div className="bg-zinc-900 border border-zinc-800 w-full max-w-2xl rounded-2xl shadow-2xl overflow-hidden animate-in fade-in zoom-in duration-200">
            <div className="px-6 py-4 border-b border-zinc-800 flex items-center justify-between bg-zinc-800/30">
              <h2 className="text-lg font-bold">
                {editingItem ? 'Upraviť' : 'Pridať'} {
                  activeSection === 'BANLIST' ? 'Trest' :
                  activeSection === 'WANTED' ? 'Hľadaného' :
                  activeSection === 'BUGS' ? 'Bug' : 'Meeting'
                }
              </h2>
              <button onClick={() => setIsModalOpen(false)} className="text-zinc-500 hover:text-white transition-colors">
                <XCircle className="w-6 h-6" />
              </button>
            </div>
            
            <form onSubmit={handleSubmit} className="p-6">
              {activeSection === 'BANLIST' && (
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  {/* Target Info */}
                  <div className="space-y-4">
                    <div>
                      <label className="block text-xs font-bold text-zinc-500 uppercase tracking-widest mb-1.5">Discord Username</label>
                      <input 
                        type="text" 
                        className="w-full bg-zinc-950 border border-zinc-800 rounded-xl py-2 px-4 text-sm focus:outline-none focus:ring-2 focus:ring-red-500/50"
                        value={formData.discord_username}
                        onChange={e => setFormData({...formData, discord_username: e.target.value})}
                        placeholder="napr. john_doe"
                      />
                    </div>
                    <div>
                      <label className="block text-xs font-bold text-zinc-500 uppercase tracking-widest mb-1.5">Discord ID</label>
                      <input 
                        type="text" 
                        className="w-full bg-zinc-950 border border-zinc-800 rounded-xl py-2 px-4 text-sm focus:outline-none focus:ring-2 focus:ring-red-500/50 font-mono"
                        value={formData.discord_id}
                        onChange={e => setFormData({...formData, discord_id: e.target.value})}
                        placeholder="napr. 123456789012345678"
                      />
                    </div>
                  </div>

                  {/* Punishment Info */}
                  <div className="space-y-4">
                    <div>
                      <label className="block text-xs font-bold text-zinc-500 uppercase tracking-widest mb-1.5">Typ Trestu</label>
                      <select 
                        className="w-full bg-zinc-950 border border-zinc-800 rounded-xl py-2 px-4 text-sm focus:outline-none focus:ring-2 focus:ring-red-500/50"
                        value={PUNISHMENT_TYPES.find(t => t.value === formData.type && (t.duration === null || (formData.expires_at ? true : t.duration === -1)))?.label || 'Warn'}
                        onChange={e => {
                          const type = PUNISHMENT_TYPES.find(t => t.label === e.target.value);
                          if (type) {
                            let expiry = '';
                            if (type.duration && type.duration !== -1) {
                              const d = new Date();
                              d.setDate(d.getDate() + type.duration);
                              expiry = d.toISOString().slice(0, 16);
                            }
                            setFormData({...formData, type: type.value as PunishmentType, expires_at: expiry || null});
                          }
                        }}
                      >
                        {PUNISHMENT_TYPES.map(t => (
                          <option key={t.label} value={t.label}>{t.label}</option>
                        ))}
                      </select>
                    </div>
                    <div>
                      <label className="block text-xs font-bold text-zinc-500 uppercase tracking-widest mb-1.5">Dátum Expirácie</label>
                      <input 
                        type="datetime-local" 
                        className="w-full bg-zinc-950 border border-zinc-800 rounded-xl py-2 px-4 text-sm focus:outline-none focus:ring-2 focus:ring-red-500/50"
                        value={formData.expires_at || ''}
                        onChange={e => setFormData({...formData, expires_at: e.target.value})}
                      />
                      <p className="text-[10px] text-zinc-600 mt-1">Ponechajte prázdne pre permanentný trest.</p>
                    </div>
                  </div>

                  {/* Details */}
                  <div className="md:col-span-2 space-y-4">
                    <div>
                      <label className="block text-xs font-bold text-zinc-500 uppercase tracking-widest mb-1.5">Dôvod (Pravidlo)</label>
                      <select 
                        className="w-full bg-zinc-950 border border-zinc-800 rounded-xl py-2 px-4 text-sm focus:outline-none focus:ring-2 focus:ring-red-500/50"
                        value={formData.reason}
                        onChange={e => setFormData({...formData, reason: e.target.value})}
                      >
                        {PUNISHMENT_REASONS.map(r => (
                          <option key={r} value={r}>{r}</option>
                        ))}
                      </select>
                    </div>
                    <div>
                      <label className="block text-xs font-bold text-zinc-500 uppercase tracking-widest mb-1.5">Podrobný Popis</label>
                      <textarea 
                        className="w-full bg-zinc-950 border border-zinc-800 rounded-xl py-2 px-4 text-sm focus:outline-none focus:ring-2 focus:ring-red-500/50 h-24 resize-none"
                        value={formData.details}
                        onChange={e => setFormData({...formData, details: e.target.value})}
                        placeholder="Popíšte situáciu..."
                      />
                    </div>
                    <div>
                      <label className="block text-xs font-bold text-zinc-500 uppercase tracking-widest mb-1.5">Link na Dôkaz (Imgur/Youtube/Medal)</label>
                      <input 
                        type="url" 
                        className="w-full bg-zinc-950 border border-zinc-800 rounded-xl py-2 px-4 text-sm focus:outline-none focus:ring-2 focus:ring-red-500/50"
                        value={formData.evidence_url}
                        onChange={e => setFormData({...formData, evidence_url: e.target.value})}
                        placeholder="https://..."
                      />
                    </div>
                  </div>
                </div>
              )}

              {activeSection === 'WANTED' && (
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  <div>
                    <label className="block text-xs font-bold text-zinc-500 uppercase tracking-widest mb-1.5">Discord Username</label>
                    <input 
                      type="text" 
                      className="w-full bg-zinc-950 border border-zinc-800 rounded-xl py-2 px-4 text-sm focus:outline-none focus:ring-2 focus:ring-orange-500/50"
                      value={formData.discord_username}
                      onChange={e => setFormData({...formData, discord_username: e.target.value})}
                      placeholder="napr. john_doe"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-bold text-zinc-500 uppercase tracking-widest mb-1.5">Discord ID</label>
                    <input 
                      type="text" 
                      className="w-full bg-zinc-950 border border-zinc-800 rounded-xl py-2 px-4 text-sm focus:outline-none focus:ring-2 focus:ring-orange-500/50"
                      value={formData.discord_id}
                      onChange={e => setFormData({...formData, discord_id: e.target.value})}
                      placeholder="napr. 123456789012345678"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-bold text-zinc-500 uppercase tracking-widest mb-1.5">Whitelist Status</label>
                    <select 
                      className="w-full bg-zinc-950 border border-zinc-800 rounded-xl py-2 px-4 text-sm focus:outline-none focus:ring-2 focus:ring-orange-500/50"
                      value={formData.whitelist_status}
                      onChange={e => setFormData({...formData, whitelist_status: e.target.value as any})}
                    >
                      <option value="NONE">Žiadny</option>
                      <option value="ALLOWED">Povolený</option>
                      <option value="DENIED">Zamitnutý</option>
                    </select>
                  </div>
                  <div>
                    <label className="block text-xs font-bold text-zinc-500 uppercase tracking-widest mb-1.5">Úroveň Nebezpečenstva</label>
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
                    <label className="block text-xs font-bold text-zinc-500 uppercase tracking-widest mb-1.5">Popis / Dôvod</label>
                    <textarea 
                      className="w-full bg-zinc-950 border border-zinc-800 rounded-xl py-2 px-4 text-sm focus:outline-none focus:ring-2 focus:ring-orange-500/50 h-24 resize-none"
                      value={formData.description}
                      onChange={e => setFormData({...formData, description: e.target.value})}
                    />
                  </div>
                </div>
              )}

              {activeSection === 'BUGS' && (
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  <div className="md:col-span-2">
                    <label className="block text-xs font-bold text-zinc-500 uppercase tracking-widest mb-1.5">Názov Chyby</label>
                    <input 
                      required
                      type="text" 
                      className="w-full bg-zinc-950 border border-zinc-800 rounded-xl py-2 px-4 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500/50"
                      value={formData.title}
                      onChange={e => setFormData({...formData, title: e.target.value})}
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-bold text-zinc-500 uppercase tracking-widest mb-1.5">Priorita</label>
                    <select 
                      className="w-full bg-zinc-950 border border-zinc-800 rounded-xl py-2 px-4 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500/50"
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
                      className="w-full bg-zinc-950 border border-zinc-800 rounded-xl py-2 px-4 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500/50"
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
                    <label className="block text-xs font-bold text-zinc-500 uppercase tracking-widest mb-1.5">Popis Chyby</label>
                    <textarea 
                      required
                      className="w-full bg-zinc-950 border border-zinc-800 rounded-xl py-2 px-4 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500/50 h-24 resize-none"
                      value={formData.description}
                      onChange={e => setFormData({...formData, description: e.target.value})}
                    />
                  </div>
                </div>
              )}

              {activeSection === 'MEETINGS' && (
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  <div className="md:col-span-2">
                    <label className="block text-xs font-bold text-zinc-500 uppercase tracking-widest mb-1.5">Názov Meetingu</label>
                    <input 
                      required
                      type="text" 
                      className="w-full bg-zinc-950 border border-zinc-800 rounded-xl py-2 px-4 text-sm focus:outline-none focus:ring-2 focus:ring-purple-500/50"
                      value={formData.title}
                      onChange={e => setFormData({...formData, title: e.target.value})}
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-bold text-zinc-500 uppercase tracking-widest mb-1.5">Dátum a Čas</label>
                    <input 
                      required
                      type="datetime-local" 
                      className="w-full bg-zinc-950 border border-zinc-800 rounded-xl py-2 px-4 text-sm focus:outline-none focus:ring-2 focus:ring-purple-500/50"
                      value={formData.scheduled_at}
                      onChange={e => setFormData({...formData, scheduled_at: e.target.value})}
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-bold text-zinc-500 uppercase tracking-widest mb-1.5">Lokalita</label>
                    <input 
                      required
                      type="text" 
                      className="w-full bg-zinc-950 border border-zinc-800 rounded-xl py-2 px-4 text-sm focus:outline-none focus:ring-2 focus:ring-purple-500/50"
                      value={formData.location}
                      onChange={e => setFormData({...formData, location: e.target.value})}
                      placeholder="napr. Discord / In-game"
                    />
                  </div>
                  <div className="md:col-span-2">
                    <label className="block text-xs font-bold text-zinc-500 uppercase tracking-widest mb-1.5">Agenda / Popis</label>
                    <textarea 
                      required
                      className="w-full bg-zinc-950 border border-zinc-800 rounded-xl py-2 px-4 text-sm focus:outline-none focus:ring-2 focus:ring-purple-500/50 h-24 resize-none"
                      value={formData.description}
                      onChange={e => setFormData({...formData, description: e.target.value})}
                    />
                  </div>
                </div>
              )}

              <div className="mt-8 flex gap-3">
                <button 
                  type="button"
                  onClick={() => setIsModalOpen(false)}
                  className="flex-1 bg-zinc-800 hover:bg-zinc-700 text-white font-bold py-3 rounded-xl transition-all"
                >
                  Zrušiť
                </button>
                <button 
                  type="submit"
                  className={cn(
                    "flex-[2] text-white font-bold py-3 rounded-xl transition-all shadow-lg",
                    activeSection === 'BANLIST' ? "bg-red-600 hover:bg-red-700 shadow-red-900/20" :
                    activeSection === 'WANTED' ? "bg-orange-600 hover:bg-orange-700 shadow-orange-900/20" :
                    activeSection === 'BUGS' ? "bg-blue-600 hover:bg-blue-700 shadow-blue-900/20" :
                    "bg-purple-600 hover:bg-purple-700 shadow-purple-900/20"
                  )}
                >
                  {editingItem ? 'Uložiť Zmeny' : 'Uložiť Záznam'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Footer */}
      <footer className="max-w-7xl mx-auto px-4 py-12 border-t border-zinc-900 mt-12">
        <div className="flex flex-col md:flex-row justify-between items-center gap-4 text-zinc-600 text-xs font-medium uppercase tracking-widest">
          <p>© 2026 Genk RP Admin System</p>
          <div className="flex gap-6">
            <a href="https://genk.cz/pravidla/redm-pravidla/" target="_blank" rel="noreferrer" className="hover:text-zinc-400 transition-colors">Pravidlá</a>
            <a href="https://discord.gg/GPSpeD6UzQ" target="_blank" rel="noreferrer" className="hover:text-zinc-400 transition-colors">Discord</a>
          </div>
        </div>
      </footer>
    </div>
  );
}
