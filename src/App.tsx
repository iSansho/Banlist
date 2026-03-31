import React, { useState, useEffect } from 'react';
import { format, isAfter, parseISO, addHours, addDays } from 'date-fns';
import { sk } from 'date-fns/locale';
import axios from 'axios';
import { GoogleGenAI } from "@google/genai";
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
  ShieldCheck,
  UserPlus,
  FileText,
  Gavel
} from 'lucide-react';
import { cn } from './lib/utils';
import { supabase, Punishment, PunishmentType, PUNISHMENT_REASONS, PUNISHMENT_TYPES, Wanted, Bug, Meeting, Log, Admin, PunishmentReason } from './lib/supabase';

export default function App() {
  const [user, setUser] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [isAdmin, setIsAdmin] = useState(false);
  const [activeSection, setActiveSection] = useState<'DASHBOARD' | 'BANLIST' | 'WANTED' | 'BUGS' | 'MEETINGS' | 'LOGS' | 'SETTINGS'>('DASHBOARD');
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
  const [wantedSearchTerm, setWantedSearchTerm] = useState('');
  const [bugsSearchTerm, setBugsSearchTerm] = useState('');
  const [logsSearchTerm, setLogsSearchTerm] = useState('');
  const [meetingsSearchTerm, setMeetingsSearchTerm] = useState('');
  const [typeFilter, setTypeFilter] = useState<string>('ALL');
  const [wantedFilter, setWantedFilter] = useState<string>('ALL');
  const [bugsFilter, setBugsFilter] = useState<string>('ALL');
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
    let mounted = true;

    // Bezpečnostný timeout pre prípad, že by sa overovanie zaseklo
    const timeoutId = setTimeout(() => {
      if (mounted && loading) {
        console.warn("Auth initialization timed out, forcing load to finish");
        setLoading(false);
      }
    }, 5000);

    const { data: { subscription } } = supabase.auth.onAuthStateChange(async (event, session) => {
      if (!mounted) return;
      
      const currentUser = session?.user ?? null;
      setUser(currentUser);
      
      // Ak URL obsahuje hash s tokenom, odstránime ho pre čistejšiu URL
      if (window.location.hash && window.location.hash.includes('access_token')) {
        window.history.replaceState(null, '', window.location.pathname + window.location.search);
      }
      
      if ((event === 'SIGNED_IN' || event === 'INITIAL_SESSION') && currentUser) {
        setLoading(true);
        await verifyAndFetchData(currentUser);
      } else if (event === 'SIGNED_OUT' || !currentUser) {
        setIsAdmin(false);
        setLoading(false);
      }
    });

    return () => {
      mounted = false;
      clearTimeout(timeoutId);
      subscription.unsubscribe();
    };
  }, []);

  const verifyAndFetchData = async (currentUser: any) => {
    try {
      const rawProviderId = currentUser.user_metadata?.provider_id || currentUser.user_metadata?.sub || currentUser.identities?.[0]?.id || currentUser.id;
      const providerId = String(rawProviderId).trim();
      
      console.log("Verifying admin status for provider ID:", providerId);
      
      const { data, error } = await supabase.from('admins').select('*').eq('discord_id', providerId).maybeSingle();
      
      if (error) {
        console.error("Error checking admin status:", error);
      }
      
      const whitelist = import.meta.env.VITE_ADMIN_WHITELIST?.split(',') || [];
      const isUserAdmin = !!data || whitelist.includes(providerId);
      
      setIsAdmin(isUserAdmin);

      if (isUserAdmin) {
        await fetchData();
        fetchDiscordMembers();
        fetchPunishmentReasons();
      }
    } catch (e) {
      console.error("Exception in verifyAndFetchData:", e);
      setIsAdmin(false);
    } finally {
      setLoading(false);
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

  const fetchDiscordMembers = async () => {
    setIsDiscordLoading(true);
    setDiscordError(null);
    try {
      const { data: { session } } = await supabase.auth.getSession();
      const response = await axios.get('/api/discord/members', {
        headers: {
          Authorization: `Bearer ${session?.access_token}`
        }
      });
      if (Array.isArray(response.data)) {
        setDiscordMembers(response.data);
      } else {
        setDiscordError('Server vrátil neplatné dáta (pravdepodobne chyba smerovania na Verceli).');
      }
    } catch (error: any) {
      console.error('Error fetching Discord members:', error);
      let msg = error.message;
      if (error.response?.data) {
        const data = error.response.data;
        if (typeof data === 'string') {
          msg = data;
        } else if (data.error && typeof data.error === 'string') {
          msg = data.error;
        } else {
          msg = JSON.stringify(data);
        }
      }
      setDiscordError(`Chyba pripojenia k Discord API: ${msg}`);
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
      setIsAdmin(!!data || whitelist.includes(providerId));
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
        fetchMeetings(),
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

  const fetchAdmins = async () => {
    const { data } = await supabase.from('admins').select('*').order('created_at', { ascending: false });
    setAdmins(data || []);
  };

  const handleDeleteAdmin = async (id: string, username: string) => {
    if (!confirm(`Naozaj chcete odobrať prístup adminovi ${username}?`)) return;
    
    const { error } = await supabase.from('admins').delete().eq('id', id);
    if (!error) {
      logAction('ODOBRATIE_ADMINA', username, `Admin ${username} bol odobraný zo systému.`);
      fetchAdmins();
    }
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
                {isDiscordLoading ? 'Načítavam členov...' : 'Žiadni užívatelia nenájdení'}
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
                      {punishments.filter(p => p.discord_id === m.id && p.type === 'WARN' && !isExpired(p.expires_at)).length > 0 && (
                        <span className="text-[9px] bg-yellow-500/10 text-yellow-500 px-1 rounded font-bold">
                          {punishments.filter(p => p.discord_id === m.id && p.type === 'WARN' && !isExpired(p.expires_at)).length} WARNS
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

  const handleLogin = async () => {
    await supabase.auth.signInWithOAuth({
      provider: 'discord',
      options: {
        redirectTo: window.location.origin
      }
    });
  };

  const handleLogout = async () => {
    try {
      await supabase.auth.signOut();
      setUser(null);
      setIsAdmin(false);
    } catch (error) {
      console.error("Logout error:", error);
    } finally {
      // Force clear local storage just in case Supabase fails to clear it
      localStorage.clear();
      window.location.reload();
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!isAdmin || !user) return;

    let table = '';
    let payload: any = {};
    let logMsg = '';
    let targetName = '';

    const adminDiscordId = String(user.user_metadata?.provider_id || user.user_metadata?.sub || user.identities?.[0]?.id || user.id).trim();
    const adminName = user.user_metadata?.full_name || user.user_metadata?.name || user.email;

    switch (activeSection) {
      case 'BANLIST':
        if (!formData.discord_id && !formData.discord_username) {
          alert('Discord ID alebo Discord Username musí byť vyplnené.');
          return;
        }

        // Warn Limit Check
        if (formData.type === 'WARN' && activeWarns >= 3) {
          if (!confirm(`Hráč má už ${activeWarns} aktívne warny. Podľa pravidiel by mal byť 4. trest BAN. Naozaj chcete pokračovať s WARNOM?`)) {
            return;
          }
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
          admin_discord_id: adminDiscordId,
          admin_name: adminName,
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
          admin_name: adminName,
        };
        logMsg = `Level: ${formData.danger_level}, Status: ${formData.status}, WL: ${formData.whitelist_status}`;
        targetName = formData.discord_username || formData.discord_id;
        break;
      case 'SETTINGS':
        if (settingsTab === 'ADMINS') {
          if (!formData.discord_id && !formData.discord_username) {
            alert('Discord ID alebo Discord Username musí byť vyplnené.');
            return;
          }
          table = 'admins';
          payload = {
            discord_id: formData.discord_id,
            username: formData.discord_username,
            added_by: adminName,
          };
          logMsg = `Pridaný nový admin: ${formData.discord_username}`;
          targetName = formData.discord_username;
        } else if (settingsTab === 'REASONS') {
          if (!formData.reason) {
            alert('Názov dôvodu musí byť vyplnený.');
            return;
          }
          table = 'punishment_reasons';
          payload = {
            label: formData.reason
          };
          logMsg = `Pridaný nový dôvod: ${formData.reason}`;
          targetName = formData.reason;
        }
        break;
      case 'BUGS':
        table = 'bugs';
        payload = {
          title: formData.title,
          description: formData.description,
          priority: formData.priority,
          status: formData.bug_status,
          reporter_name: adminName,
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
          organizer_name: adminName,
        };
        logMsg = `Kedy: ${formData.scheduled_at}, Kde: ${formData.location}`;
        targetName = formData.title;
        break;
    }

    let error;
    try {
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
    } catch (e: any) {
      error = e;
    }

    if (error) {
      console.error('Supabase error:', error);
      alert('Chyba pri ukladaní: ' + (error.message || 'Neznáma chyba'));
      return;
    }

    if (activeSection === 'SETTINGS' && settingsTab === 'REASONS') {
      await fetchPunishmentReasons();
    }

    // Send Webhook for Banlist only for now
    if (activeSection === 'BANLIST') {
        try {
          const { data: { session } } = await supabase.auth.getSession();
          
          const embedColor = formData.type === 'BAN' ? 15158332 : (formData.type === 'WARN' ? 16776960 : 15844367);
          const emoji = formData.type === 'BAN' ? '🔨' : (formData.type === 'WARN' ? '⚠️' : '👢');
          const actionText = editingItem ? 'Upravený' : 'Nový';
          
          await fetch('/api/webhook', {
            method: 'POST',
            headers: { 
              'Content-Type': 'application/json',
              'Authorization': `Bearer ${session?.access_token}`
            },
            body: JSON.stringify({
              embeds: [{
                title: `${emoji} ${actionText} Trest | ${formData.type}`,
                description: `Hráč **${formData.discord_username || 'Neznámy'}** dostal trest od administrátora **${adminName}**.`,
                color: embedColor,
                fields: [
                  { name: '👤 Užívateľ', value: formData.discord_id ? `<@${formData.discord_id}>\n(${formData.discord_id})` : 'Neznámy', inline: true },
                  { name: '🛡️ Admin', value: adminName, inline: true },
                  { name: '\u200B', value: '\u200B', inline: true },
                  { name: '📋 Dôvod', value: formData.reason || 'Nezadaný', inline: false },
                  { name: '📝 Detaily', value: formData.details || '*Žiadne dodatočné detaily*', inline: false },
                  { name: '🔗 Dôkaz', value: formData.evidence_url ? `[Klikni sem pre dôkaz](${formData.evidence_url})` : '*Bez dôkazu*', inline: true },
                  { name: '⏳ Expirácia', value: formData.expires_at ? format(new Date(formData.expires_at), 'dd.MM.yyyy HH:mm') : 'Permanentný', inline: true }
                ],
                footer: {
                  text: 'Systém trestov | GenK'
                },
                timestamp: new Date().toISOString()
              }]
            })
          });
        } catch (e) {
          console.error('Webhook failed', e);
        }
      }

      alert('Záznam bol úspešne uložený!');
      setIsModalOpen(false);
      setEditingItem(null);
      resetForm();
      await fetchData();
  };

  const resetForm = () => {
    setFormData({
      discord_id: '',
      discord_username: '',
      type: 'WARN',
      reason: punishmentReasons.length > 0 ? punishmentReasons[0].label : PUNISHMENT_REASONS[0],
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
      case 'SETTINGS':
        if (settingsTab === 'ADMINS') {
          table = 'admins';
          name = admins.find(a => a.id === id)?.username || 'Admin';
        } else if (settingsTab === 'REASONS') {
          table = 'punishment_reasons';
          name = punishmentReasons.find(r => r.id === id)?.label || 'Dôvod';
        }
        break;
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
    } else if (activeSection === 'SETTINGS') {
      if (settingsTab === 'ADMINS') {
        setFormData({
          ...formData,
          discord_id: item.discord_id || '',
          discord_username: item.username || '',
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
    const matchesSearch = (p.discord_username?.toLowerCase().includes(searchTerm.toLowerCase()) || false) || 
                         (p.discord_id?.toLowerCase().includes(searchTerm.toLowerCase()) || false);
    const matchesType = typeFilter === 'ALL' || p.type === typeFilter;
    return matchesSearch && matchesType;
  });

  const filteredWanted = wantedList.filter(w => {
    const matchesSearch = (w.discord_username?.toLowerCase().includes(wantedSearchTerm.toLowerCase()) || false) || 
                         (w.discord_id?.toLowerCase().includes(wantedSearchTerm.toLowerCase()) || false) ||
                         (w.description?.toLowerCase().includes(wantedSearchTerm.toLowerCase()) || false);
    const matchesStatus = wantedFilter === 'ALL' || w.status === wantedFilter;
    return matchesSearch && matchesStatus;
  });

  const filteredBugs = bugs.filter(b => {
    const matchesSearch = (b.title?.toLowerCase().includes(bugsSearchTerm.toLowerCase()) || false) || 
                         (b.description?.toLowerCase().includes(bugsSearchTerm.toLowerCase()) || false) ||
                         (b.reporter_name?.toLowerCase().includes(bugsSearchTerm.toLowerCase()) || false);
    const matchesStatus = bugsFilter === 'ALL' || b.status === bugsFilter;
    return matchesSearch && matchesStatus;
  });

  const filteredLogs = logs.filter(l => {
    const matchesSearch = (l.admin_name?.toLowerCase().includes(logsSearchTerm.toLowerCase()) || false) || 
                         (l.action?.toLowerCase().includes(logsSearchTerm.toLowerCase()) || false) ||
                         (l.target_name?.toLowerCase().includes(logsSearchTerm.toLowerCase()) || false) ||
                         (l.details?.toLowerCase().includes(logsSearchTerm.toLowerCase()) || false);
    return matchesSearch;
  });

  const filteredMeetings = meetings.filter(m => {
    const matchesSearch = (m.title?.toLowerCase().includes(meetingsSearchTerm.toLowerCase()) || false) || 
                         (m.description?.toLowerCase().includes(meetingsSearchTerm.toLowerCase()) || false) ||
                         (m.location?.toLowerCase().includes(meetingsSearchTerm.toLowerCase()) || false);
    return matchesSearch;
  });

  const isExpired = (date: string | null) => {
    if (!date) return false;
    return !isAfter(parseISO(date), new Date());
  };

  const activeWarns = formData.discord_id ? punishments.filter(p => 
    p.discord_id === formData.discord_id && 
    p.type === 'WARN' && 
    !isExpired(p.expires_at)
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

            {/* Test Mode Button - Only visible in development */}
            {import.meta.env.DEV && (
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

  if (user && !isAdmin) {
    return (
      <div className="min-h-screen bg-zinc-950 flex flex-col items-center justify-center p-4 relative overflow-hidden text-center">
        <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[500px] h-[500px] bg-red-600/5 blur-[120px] rounded-full"></div>
        
        <div className="relative z-10 w-full max-w-md">
          <div className="bg-zinc-900 border border-zinc-800 p-8 rounded-3xl shadow-2xl">
            <div className="inline-flex bg-red-600/20 p-4 rounded-2xl mb-6">
              <AlertCircle className="w-10 h-10 text-red-500" />
            </div>
            <h1 className="text-2xl font-black tracking-tight mb-2">Prístup Zamietnutý</h1>
            <p className="text-zinc-500 text-sm mb-8">
              Váš účet ({user.user_metadata?.full_name || user.email}) nemá oprávnenie na prístup do tohto systému. 
              <br/><br/>
              <span className="text-xs text-zinc-600 font-mono bg-zinc-950 px-2 py-1 rounded">
                Vaše ID: {user.user_metadata?.provider_id || user.user_metadata?.sub || user.identities?.[0]?.id || user.id}
              </span>
              <br/><br/>
              Kontaktujte hlavného administrátora pre pridelenie prístupu.
            </p>
            
            <button 
              onClick={handleLogout}
              className="w-full bg-zinc-800 hover:bg-zinc-700 text-white font-bold py-4 rounded-2xl transition-all flex items-center justify-center gap-3"
            >
              <LogOut className="w-5 h-5" /> Odhlásiť sa
            </button>
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
              
              {isAdmin && (
                <div className="flex items-center justify-center gap-3 mt-8">
                  <button 
                    onClick={() => { setActiveSection('BANLIST'); resetForm(); setEditingItem(null); setIsModalOpen(true); }}
                    className="flex items-center gap-2 px-4 py-1.5 bg-red-600/10 border border-red-600/20 rounded-full text-red-500 text-[10px] font-bold uppercase tracking-wider hover:bg-red-600 hover:text-white transition-all"
                  >
                    <Plus className="w-3 h-3" /> Rýchly Ban
                  </button>
                  <button 
                    onClick={() => { setActiveSection('WANTED'); resetForm(); setEditingItem(null); setIsModalOpen(true); }}
                    className="flex items-center gap-2 px-4 py-1.5 bg-orange-600/10 border border-orange-600/20 rounded-full text-orange-500 text-[10px] font-bold uppercase tracking-wider hover:bg-orange-600 hover:text-white transition-all"
                  >
                    <Plus className="w-3 h-3" /> Rýchly Wanted
                  </button>
                </div>
              )}
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
              {/* Banlist Card */}
              <button 
                onClick={() => setActiveSection('BANLIST')}
                className="group bg-zinc-900 border border-zinc-800 p-5 rounded-2xl hover:border-red-600/50 transition-all text-left"
              >
                <div className="flex items-start justify-between mb-4">
                  <div className="bg-red-600/10 p-2 rounded-xl group-hover:bg-red-600 transition-all">
                    <Ban className="w-5 h-5 text-red-500 group-hover:text-white" />
                  </div>
                  <ChevronRight className="w-4 h-4 text-zinc-600 group-hover:text-white transition-all" />
                </div>
                <h3 className="text-base font-bold">Banlist</h3>
                <p className="text-zinc-500 text-xs mt-1">Správa trestov, banov a varovaní pre hráčov.</p>
              </button>

              {/* Wanted Card */}
              <button 
                onClick={() => setActiveSection('WANTED')}
                className="group bg-zinc-900 border border-zinc-800 p-5 rounded-2xl hover:border-orange-600/50 transition-all text-left"
              >
                <div className="flex items-start justify-between mb-4">
                  <div className="bg-orange-600/10 p-2 rounded-xl group-hover:bg-orange-600 transition-all">
                    <Users className="w-5 h-5 text-orange-500 group-hover:text-white" />
                  </div>
                  <ChevronRight className="w-4 h-4 text-zinc-600 group-hover:text-white transition-all" />
                </div>
                <h3 className="text-base font-bold">Wanted</h3>
                <p className="text-zinc-500 text-xs mt-1">Zoznam hľadaných osôb a nebezpečných subjektov.</p>
              </button>

              {/* Bugs Card */}
              <button 
                onClick={() => setActiveSection('BUGS')}
                className="group bg-zinc-900 border border-zinc-800 p-5 rounded-2xl hover:border-blue-600/50 transition-all text-left"
              >
                <div className="flex items-start justify-between mb-4">
                  <div className="bg-blue-600/10 p-2 rounded-xl group-hover:bg-blue-600 transition-all">
                    <BugIcon className="w-5 h-5 text-blue-500 group-hover:text-white" />
                  </div>
                  <ChevronRight className="w-4 h-4 text-zinc-600 group-hover:text-white transition-all" />
                </div>
                <h3 className="text-base font-bold">Bugs</h3>
                <p className="text-zinc-500 text-xs mt-1">Hlásenia chýb a technických problémov servera.</p>
              </button>

              {/* Meetings Card */}
              <button 
                onClick={() => setActiveSection('MEETINGS')}
                className="group bg-zinc-900 border border-zinc-800 p-5 rounded-2xl hover:border-purple-600/50 transition-all text-left"
              >
                <div className="flex items-start justify-between mb-4">
                  <div className="bg-purple-600/10 p-2 rounded-xl group-hover:bg-purple-600 transition-all">
                    <Calendar className="w-5 h-5 text-purple-500 group-hover:text-white" />
                  </div>
                  <ChevronRight className="w-4 h-4 text-zinc-600 group-hover:text-white transition-all" />
                </div>
                <h3 className="text-base font-bold">Meetings</h3>
                <p className="text-zinc-500 text-xs mt-1">Plánované porady a dôležité stretnutia tímu.</p>
              </button>
            </div>
          </div>
        ) : activeSection === 'SETTINGS' ? (
          <div className="space-y-6">
            <div className="flex items-center justify-between">
              <h2 className="text-xl font-bold flex items-center gap-2">
                <Settings className="w-5 h-5 text-indigo-500" /> Nastavenia Systému
              </h2>
              <button 
                onClick={() => setActiveSection('DASHBOARD')}
                className="text-xs text-zinc-500 hover:text-white flex items-center gap-1 transition-colors"
              >
                <ChevronLeft className="w-3 h-3" /> Späť na Dashboard
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
                Správa Adminov
              </button>
              <button 
                onClick={() => setSettingsTab('REASONS')}
                className={cn(
                  "px-4 py-1.5 rounded-lg text-xs font-bold transition-all",
                  settingsTab === 'REASONS' ? "bg-zinc-800 text-white" : "text-zinc-500 hover:text-zinc-300"
                )}
              >
                Dôvody Trestov
              </button>
            </div>

            {settingsTab === 'LOGS' ? (
              <div className="space-y-4">
                <div className="relative max-w-md">
                  <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-zinc-500" />
                  <input 
                    type="text"
                    placeholder="Hľadať v logoch..."
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
                          <th className="px-4 py-3 text-[10px] font-bold uppercase tracking-widest text-zinc-500">Akcia</th>
                          <th className="px-4 py-3 text-[10px] font-bold uppercase tracking-widest text-zinc-500">Cieľ</th>
                          <th className="px-4 py-3 text-[10px] font-bold uppercase tracking-widest text-zinc-500">Dátum</th>
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
                              <span className="text-[10px] text-zinc-500">{format(parseISO(log.created_at), 'd. MMM HH:mm', { locale: sk })}</span>
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
                  <p className="text-xs text-zinc-500">Zoznam používateľov s prístupom do admin panelu.</p>
                  <button 
                    onClick={() => { setEditingItem(null); setFormData({ ...formData, discord_id: '', discord_username: '' }); setIsModalOpen(true); }}
                    className="bg-indigo-600 hover:bg-indigo-700 text-white px-3 py-1.5 rounded-lg text-[10px] font-bold uppercase tracking-wider transition-all flex items-center gap-2"
                  >
                    <UserPlus className="w-3 h-3" /> Pridať Admina
                  </button>
                </div>
                <div className="bg-zinc-900 border border-zinc-800 rounded-2xl overflow-hidden shadow-xl">
                  <div className="overflow-x-auto">
                    <table className="w-full text-left border-collapse">
                      <thead>
                        <tr className="bg-zinc-800/50 border-b border-zinc-800">
                          <th className="px-4 py-3 text-[10px] font-bold uppercase tracking-widest text-zinc-500">Užívateľ</th>
                          <th className="px-4 py-3 text-[10px] font-bold uppercase tracking-widest text-zinc-500">Pridaný</th>
                          <th className="px-4 py-3 text-[10px] font-bold uppercase tracking-widest text-zinc-500 text-right">Akcie</th>
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
                              <div className="flex flex-col">
                                <span className="text-[10px] text-zinc-400">{format(parseISO(admin.created_at), 'd. MMMM yyyy', { locale: sk })}</span>
                                <span className="text-[9px] text-zinc-600">od {admin.added_by}</span>
                              </div>
                            </td>
                            <td className="px-4 py-3 text-right">
                              <div className="flex items-center justify-end gap-2">
                                <button 
                                  onClick={() => handleEdit(admin)}
                                  className="opacity-0 group-hover:opacity-100 p-1.5 text-zinc-500 hover:text-blue-500 transition-all"
                                >
                                  <Edit className="w-3.5 h-3.5" />
                                </button>
                                <button 
                                  onClick={() => handleDelete(admin.id)}
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
            ) : (
              <div className="space-y-4">
                <div className="flex justify-between items-center">
                  <p className="text-xs text-zinc-500">Zoznam preddefinovaných dôvodov pre tresty.</p>
                  <button 
                    onClick={() => { setEditingItem(null); setFormData({ ...formData, reason: '' }); setIsModalOpen(true); }}
                    className="bg-indigo-600 hover:bg-indigo-700 text-white px-3 py-1.5 rounded-lg text-[10px] font-bold uppercase tracking-wider transition-all flex items-center gap-2"
                  >
                    <Plus className="w-3 h-3" /> Pridať Dôvod
                  </button>
                </div>
                <div className="bg-zinc-900 border border-zinc-800 rounded-2xl overflow-hidden shadow-xl">
                  <div className="overflow-x-auto">
                    <table className="w-full text-left border-collapse">
                      <thead>
                        <tr className="bg-zinc-800/50 border-b border-zinc-800">
                          <th className="px-4 py-3 text-[10px] font-bold uppercase tracking-widest text-zinc-500">Dôvod</th>
                          <th className="px-4 py-3 text-[10px] font-bold uppercase tracking-widest text-zinc-500">Dátum Vytvorenia</th>
                          <th className="px-4 py-3 text-[10px] font-bold uppercase tracking-widest text-zinc-500 text-right">Akcie</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-zinc-800">
                        {punishmentReasons.map((reason) => (
                          <tr key={reason.id} className="hover:bg-zinc-800/30 transition-colors group">
                            <td className="px-4 py-3">
                              <span className="text-xs font-bold">{reason.label}</span>
                            </td>
                            <td className="px-4 py-3">
                              <span className="text-[10px] text-zinc-400">{format(parseISO(reason.created_at), 'd. MMMM yyyy', { locale: sk })}</span>
                            </td>
                            <td className="px-4 py-3 text-right">
                              <div className="flex items-center justify-end gap-2">
                                <button 
                                  onClick={() => handleEdit(reason)}
                                  className="opacity-0 group-hover:opacity-100 p-1.5 text-zinc-500 hover:text-blue-500 transition-all"
                                >
                                  <Edit className="w-3.5 h-3.5" />
                                </button>
                                <button 
                                  onClick={() => handleDelete(reason.id)}
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
            )}
          </div>
        ) : activeSection === 'BANLIST' ? (
          <>
            {/* Banlist UI (Existing) */}
            <div className="flex flex-col md:flex-row gap-4 mb-6 items-center justify-between">
              <div className="flex items-center gap-4 w-full md:w-auto">
                <h2 className="text-xl font-bold flex items-center gap-2">
                  <Ban className="w-5 h-5 text-red-500" /> Banlist
                </h2>
                <div className="h-4 w-px bg-zinc-800 hidden md:block" />
                <div className="flex items-center gap-2 flex-1 md:flex-none">
                  <div className="relative flex-1 md:w-64">
                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-zinc-500" />
                    <input 
                      type="text" 
                      placeholder="Hľadať užívateľa..." 
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
                    <option value="ALL">Všetky</option>
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
                  className="w-full md:w-auto bg-red-600 hover:bg-red-700 text-white px-4 py-1.5 rounded-lg text-xs font-bold transition-all flex items-center justify-center gap-2 shadow-lg shadow-red-900/20"
                >
                  <Plus className="w-3.5 h-3.5" /> Pridať Trest
                </button>
              )}
            </div>

            <div className="bg-zinc-900 border border-zinc-800 rounded-2xl overflow-hidden shadow-xl">
              <div className="overflow-x-auto">
                <table className="w-full text-left border-collapse">
                  <thead>
                    <tr className="bg-zinc-800/50 border-b border-zinc-800">
                      <th className="px-4 py-3 text-[10px] font-bold uppercase tracking-widest text-zinc-500">Užívateľ</th>
                      <th className="px-4 py-3 text-[10px] font-bold uppercase tracking-widest text-zinc-500">Typ</th>
                      <th className="px-4 py-3 text-[10px] font-bold uppercase tracking-widest text-zinc-500">Dôvod</th>
                      <th className="px-4 py-3 text-[10px] font-bold uppercase tracking-widest text-zinc-500">Expirácia</th>
                      <th className="px-4 py-3 text-[10px] font-bold uppercase tracking-widest text-zinc-500">Admin</th>
                      <th className="px-4 py-3 text-[10px] font-bold uppercase tracking-widest text-zinc-500 text-right">Akcie</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-zinc-800">
                    {loading ? (
                      <tr>
                        <td colSpan={6} className="px-6 py-12 text-center text-zinc-500 animate-pulse">Načítavam záznamy...</td>
                      </tr>
                    ) : filteredPunishments.length === 0 ? (
                      <tr>
                        <td colSpan={6} className="px-4 py-8 text-center text-zinc-500">Nenašli sa žiadne záznamy.</td>
                      </tr>
                    ) : filteredPunishments.map((p) => {
                      const expired = isExpired(p.expires_at);
                      const isBan = p.type === 'BAN';
                      
                      return (
                        <tr 
                          key={p.id} 
                          className={cn(
                            "group hover:bg-zinc-800/30 transition-colors border-b border-zinc-800/50 last:border-0",
                            isBan && !expired && "border-l-2 border-l-red-600",
                            expired && "opacity-50"
                          )}
                        >
                          <td className="px-4 py-3">
                            <div className="font-bold text-sm text-zinc-100">{p.discord_username || 'Neznámy'}</div>
                            <div className="text-[10px] text-zinc-500 font-mono tracking-tighter">{p.discord_id || 'Neznáme'}</div>
                          </td>
                          <td className="px-4 py-3">
                            <div className="flex items-center gap-1.5">
                              <div className="scale-75 origin-left">{getTypeIcon(p.type)}</div>
                              <span className="text-[11px] font-bold tracking-tight">{p.type}</span>
                            </div>
                          </td>
                          <td className="px-4 py-3">
                            <div className="text-xs text-zinc-300 max-w-[200px] truncate" title={p.reason}>
                              {p.reason}
                            </div>
                            {p.details && <div className="text-[9px] text-zinc-500 truncate max-w-[200px] italic">{p.details}</div>}
                          </td>
                          <td className="px-4 py-3">
                            <div className="flex items-center gap-1.5 text-[11px]">
                              {p.expires_at ? (
                                <>
                                  <span className={cn("font-medium", expired ? "text-zinc-500" : "text-zinc-300")}>
                                    {format(parseISO(p.expires_at), 'dd.MM.yy', { locale: sk })}
                                  </span>
                                  {expired ? (
                                    <span className="text-[9px] text-zinc-600 font-bold uppercase">EXP</span>
                                  ) : (
                                    <span className="text-[9px] text-green-500 font-bold uppercase">AKT</span>
                                  )}
                                </>
                              ) : (
                                <span className="text-red-500 font-black text-[10px] uppercase tracking-tighter">PERMA</span>
                              )}
                            </div>
                          </td>
                          <td className="px-4 py-3">
                            <div className="text-[11px] text-zinc-400">{p.admin_name}</div>
                          </td>
                          <td className="px-4 py-3 text-right">
                            <div className="flex items-center justify-end gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                              {p.evidence_url && (
                                <a 
                                  href={p.evidence_url} 
                                  target="_blank" 
                                  rel="noreferrer"
                                  className="p-1 hover:bg-zinc-700 rounded text-zinc-400 hover:text-blue-400 transition-colors"
                                  title="Dôkaz"
                                >
                                  <ExternalLink className="w-3.5 h-3.5" />
                                </a>
                              )}
                              {isAdmin && (
                                <>
                                  <button 
                                    onClick={() => handleEdit(p)}
                                    className="p-1 hover:bg-zinc-700 rounded text-zinc-400 hover:text-white transition-colors"
                                    title="Upraviť"
                                  >
                                    <Edit2 className="w-3.5 h-3.5" />
                                  </button>
                                  <button 
                                    onClick={() => handleDelete(p.id)}
                                    className="p-1 hover:bg-zinc-700 rounded text-zinc-400 hover:text-red-500 transition-colors"
                                    title="Vymazať"
                                  >
                                    <Trash2 className="w-3.5 h-3.5" />
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
            <div className="flex flex-col md:flex-row gap-4 items-center justify-between mb-6">
              <div className="flex items-center gap-4 w-full md:w-auto">
                <h2 className="text-xl font-bold flex items-center gap-2">
                  <Users className="w-5 h-5 text-orange-500" /> Wanted
                </h2>
                <div className="h-4 w-px bg-zinc-800 hidden md:block" />
                <div className="flex items-center gap-2 flex-1 md:flex-none">
                  <div className="relative flex-1 md:w-64">
                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-zinc-500" />
                    <input 
                      type="text" 
                      placeholder="Hľadať..." 
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
                    <option value="ALL">Všetky</option>
                    <option value="ACTIVE">Aktívne</option>
                    <option value="INACTIVE">Neaktívne</option>
                  </select>
                </div>
              </div>
              {isAdmin && (
                <button 
                  onClick={() => { resetForm(); setEditingItem(null); setIsModalOpen(true); }}
                  className="w-full md:w-auto bg-orange-600 hover:bg-orange-700 text-white px-4 py-1.5 rounded-lg text-xs font-bold transition-all flex items-center justify-center gap-2 shadow-lg shadow-orange-900/20"
                >
                  <Plus className="w-3.5 h-3.5" /> Pridať Wanted
                </button>
              )}
            </div>
            <div className="bg-zinc-900 border border-zinc-800 rounded-2xl overflow-hidden shadow-xl">
              <div className="overflow-x-auto">
                <table className="w-full text-left border-collapse">
                  <thead>
                    <tr className="bg-zinc-800/50 border-b border-zinc-800">
                      <th className="px-4 py-3 text-[10px] font-bold uppercase tracking-widest text-zinc-500">Užívateľ</th>
                      <th className="px-4 py-3 text-[10px] font-bold uppercase tracking-widest text-zinc-500">Úroveň</th>
                      <th className="px-4 py-3 text-[10px] font-bold uppercase tracking-widest text-zinc-500">Popis</th>
                      <th className="px-4 py-3 text-[10px] font-bold uppercase tracking-widest text-zinc-500">Status</th>
                      <th className="px-4 py-3 text-[10px] font-bold uppercase tracking-widest text-zinc-500 text-right">Akcie</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-zinc-800">
                    {filteredWanted.length === 0 ? (
                      <tr>
                        <td colSpan={5} className="px-6 py-12 text-center text-zinc-500">Nenašli sa žiadne záznamy.</td>
                      </tr>
                    ) : filteredWanted.map((w) => (
                      <tr key={w.id} className="hover:bg-zinc-800/30 transition-colors group">
                        <td className="px-6 py-4">
                          <div className="flex flex-col">
                            <span className="font-bold text-sm">{w.discord_username || 'Neznámy'}</span>
                            <span className="text-[10px] text-zinc-500 font-mono">{w.discord_id || 'Neznáme ID'}</span>
                          </div>
                        </td>
                        <td className="px-6 py-4">
                          <span className={cn(
                            "text-[10px] font-bold uppercase px-2 py-1 rounded-md",
                            w.danger_level === 'EXTREME' ? "bg-red-500/10 text-red-500" :
                            w.danger_level === 'HIGH' ? "bg-orange-500/10 text-orange-500" :
                            w.danger_level === 'MEDIUM' ? "bg-yellow-500/10 text-yellow-500" : "bg-zinc-800 text-zinc-500"
                          )}>
                            {w.danger_level}
                          </span>
                        </td>
                        <td className="px-6 py-4">
                          <p className="text-xs text-zinc-400 line-clamp-1 max-w-xs">{w.description}</p>
                        </td>
                        <td className="px-6 py-4">
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
                                WL: {w.whitelist_status === 'ALLOWED' ? 'OK' : 'KO'}
                              </span>
                            )}
                          </div>
                        </td>
                        <td className="px-6 py-4 text-right">
                          {isAdmin && (
                            <div className="flex justify-end gap-2 opacity-0 group-hover:opacity-100 transition-opacity">
                              <button onClick={() => handleEdit(w)} className="p-1.5 hover:bg-zinc-800 rounded-lg text-zinc-500 hover:text-white transition-colors">
                                <Edit2 className="w-4 h-4" />
                              </button>
                              <button onClick={() => handleDelete(w.id)} className="p-1.5 hover:bg-zinc-800 rounded-lg text-zinc-500 hover:text-red-500 transition-colors">
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
          </div>
        ) : activeSection === 'BUGS' ? (
          <div className="space-y-6">
            <div className="flex flex-col md:flex-row gap-4 items-center justify-between mb-6">
              <div className="flex items-center gap-4 w-full md:w-auto">
                <h2 className="text-xl font-bold flex items-center gap-2">
                  <BugIcon className="w-5 h-5 text-blue-500" /> Bugs
                </h2>
                <div className="h-4 w-px bg-zinc-800 hidden md:block" />
                <div className="flex items-center gap-2 flex-1 md:flex-none">
                  <div className="relative flex-1 md:w-64">
                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-zinc-500" />
                    <input 
                      type="text" 
                      placeholder="Hľadať..." 
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
                    <option value="ALL">Všetky</option>
                    <option value="OPEN">Otvorené</option>
                    <option value="IN_PROGRESS">V riešení</option>
                    <option value="FIXED">Opravené</option>
                  </select>
                </div>
              </div>
              {isAdmin && (
                <button 
                  onClick={() => { resetForm(); setEditingItem(null); setIsModalOpen(true); }}
                  className="w-full md:w-auto bg-blue-600 hover:bg-blue-700 text-white px-4 py-1.5 rounded-lg text-xs font-bold transition-all flex items-center justify-center gap-2 shadow-lg shadow-blue-900/20"
                >
                  <Plus className="w-3.5 h-3.5" /> Nahlásiť Bug
                </button>
              )}
            </div>
            <div className="bg-zinc-900 border border-zinc-800 rounded-2xl overflow-hidden shadow-xl">
              <div className="overflow-x-auto">
                <table className="w-full text-left border-collapse">
                  <thead>
                    <tr className="bg-zinc-800/50 border-b border-zinc-800">
                      <th className="px-4 py-3 text-[10px] font-bold uppercase tracking-widest text-zinc-500">Priorita</th>
                      <th className="px-4 py-3 text-[10px] font-bold uppercase tracking-widest text-zinc-500">Názov</th>
                      <th className="px-4 py-3 text-[10px] font-bold uppercase tracking-widest text-zinc-500">Status</th>
                      <th className="px-4 py-3 text-[10px] font-bold uppercase tracking-widest text-zinc-500">Reportér</th>
                      <th className="px-4 py-3 text-[10px] font-bold uppercase tracking-widest text-zinc-500 text-right">Akcie</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-zinc-800">
                    {filteredBugs.length === 0 ? (
                      <tr>
                        <td colSpan={5} className="px-4 py-8 text-center text-zinc-500">Nenašli sa žiadne záznamy.</td>
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
                          <div className="text-sm font-medium text-zinc-200">{b.title}</div>
                          <p className="text-[10px] text-zinc-500 line-clamp-1">{b.description}</p>
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
                              <button onClick={() => handleEdit(b)} className="p-1 hover:bg-zinc-800 rounded text-zinc-500 hover:text-white transition-colors">
                                <Edit2 className="w-3.5 h-3.5" />
                              </button>
                              <button onClick={() => handleDelete(b.id)} className="p-1 hover:bg-zinc-800 rounded text-zinc-500 hover:text-red-500 transition-colors">
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
        ) : activeSection === 'MEETINGS' ? (
          <div className="space-y-6">
            <div className="flex flex-col md:flex-row gap-4 items-center justify-between mb-6">
              <div className="flex items-center gap-4 w-full md:w-auto">
                <h2 className="text-xl font-bold flex items-center gap-2">
                  <Calendar className="w-5 h-5 text-purple-500" /> Meetings
                </h2>
                <div className="h-4 w-px bg-zinc-800 hidden md:block" />
                <div className="relative flex-1 md:w-64">
                  <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-zinc-500" />
                  <input 
                    type="text" 
                    placeholder="Hľadať meeting..." 
                    className="w-full bg-zinc-900 border border-zinc-800 rounded-lg pl-9 pr-4 py-1.5 text-xs focus:ring-1 focus:ring-purple-500 outline-none transition-all"
                    value={meetingsSearchTerm}
                    onChange={(e) => setMeetingsSearchTerm(e.target.value)}
                  />
                </div>
              </div>
              {isAdmin && (
                <button 
                  onClick={() => { resetForm(); setEditingItem(null); setIsModalOpen(true); }}
                  className="w-full md:w-auto bg-purple-600 hover:bg-purple-700 text-white px-4 py-1.5 rounded-lg text-xs font-bold transition-all flex items-center justify-center gap-2 shadow-lg shadow-purple-900/20"
                >
                  <Plus className="w-3.5 h-3.5" /> Naplánovať Meeting
                </button>
              )}
            </div>
            <div className="bg-zinc-900 border border-zinc-800 rounded-2xl overflow-hidden shadow-xl">
              <div className="overflow-x-auto">
                <table className="w-full text-left border-collapse">
                  <thead>
                    <tr className="bg-zinc-800/50 border-b border-zinc-800">
                      <th className="px-4 py-3 text-[10px] font-bold uppercase tracking-widest text-zinc-500">Dátum</th>
                      <th className="px-4 py-3 text-[10px] font-bold uppercase tracking-widest text-zinc-500">Čas</th>
                      <th className="px-4 py-3 text-[10px] font-bold uppercase tracking-widest text-zinc-500">Názov</th>
                      <th className="px-4 py-3 text-[10px] font-bold uppercase tracking-widest text-zinc-500">Lokalita</th>
                      <th className="px-4 py-3 text-[10px] font-bold uppercase tracking-widest text-zinc-500 text-right">Akcie</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-zinc-800">
                    {filteredMeetings.length === 0 ? (
                      <tr>
                        <td colSpan={5} className="px-4 py-8 text-center text-zinc-500">Nenašli sa žiadne záznamy.</td>
                      </tr>
                    ) : filteredMeetings.map((m) => (
                      <tr key={m.id} className="hover:bg-zinc-800/30 transition-colors group">
                        <td className="px-4 py-3">
                          <div className="flex flex-col">
                            <span className="text-xs font-bold text-purple-500 uppercase">{format(parseISO(m.scheduled_at), 'MMM', { locale: sk })}</span>
                            <span className="text-lg font-black leading-none">{format(parseISO(m.scheduled_at), 'dd')}</span>
                          </div>
                        </td>
                        <td className="px-4 py-3 text-xs text-zinc-300 font-mono">
                          {format(parseISO(m.scheduled_at), 'HH:mm')}
                        </td>
                        <td className="px-4 py-3">
                          <div className="text-sm font-bold text-zinc-100">{m.title}</div>
                          <p className="text-[10px] text-zinc-500 line-clamp-1">{m.description}</p>
                        </td>
                        <td className="px-4 py-3 text-xs text-zinc-400">
                          {m.location}
                        </td>
                        <td className="px-4 py-3 text-right">
                          {isAdmin && (
                            <div className="flex justify-end gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                              <button onClick={() => handleEdit(m)} className="p-1 hover:bg-zinc-800 rounded text-zinc-500 hover:text-white transition-colors">
                                <Edit2 className="w-3.5 h-3.5" />
                              </button>
                              <button onClick={() => handleDelete(m.id)} className="p-1 hover:bg-zinc-800 rounded text-zinc-500 hover:text-red-500 transition-colors">
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
                      placeholder="Hľadať v logoch..." 
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
                        <th className="px-4 py-3 text-[10px] font-bold uppercase tracking-widest text-zinc-500">Akcia</th>
                        <th className="px-4 py-3 text-[10px] font-bold uppercase tracking-widest text-zinc-500">Cieľ</th>
                        <th className="px-4 py-3 text-[10px] font-bold uppercase tracking-widest text-zinc-500">Detaily</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-zinc-800">
                      {filteredLogs.length === 0 ? (
                        <tr>
                          <td colSpan={5} className="px-4 py-8 text-center text-zinc-500">Nenašli sa žiadne záznamy.</td>
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
                              log.action.includes('Vymazaný') ? "bg-red-500/10 text-red-500" : 
                              log.action.includes('Upravený') ? "bg-blue-500/10 text-blue-500" : 
                              "bg-green-500/10 text-green-500"
                            )}>
                              {log.action}
                            </span>
                          </td>
                          <td className="px-4 py-3 text-xs text-zinc-300">{log.target_name}</td>
                          <td className="px-4 py-3 text-[10px] text-zinc-500 italic truncate max-w-xs">{log.details}</td>
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
                {editingItem ? 'Upraviť' : 'Pridať'} {
                  activeSection === 'BANLIST' ? 'Trest' :
                  activeSection === 'WANTED' ? 'Hľadaného' :
                  activeSection === 'BUGS' ? 'Bug' : 
                  activeSection === 'SETTINGS' ? (settingsTab === 'ADMINS' ? 'Admina' : 'Dôvod') : 'Meeting'
                }
              </h2>
              <button onClick={() => setIsModalOpen(false)} className="text-zinc-500 hover:text-white transition-colors">
                <XCircle className="w-6 h-6" />
              </button>
            </div>
            
            <form onSubmit={handleSubmit} className="p-6">
              {activeSection === 'BANLIST' && (
                <div className="space-y-6">
                  {/* Warn Limit Alert */}
                  {activeWarns >= 3 && formData.type === 'WARN' && (
                    <div className="bg-red-500/10 border border-red-500/20 rounded-xl p-4 flex items-start gap-3 animate-in slide-in-from-top-2 duration-300">
                      <AlertTriangle className="w-5 h-5 text-red-500 shrink-0 mt-0.5" />
                      <div>
                        <p className="text-sm font-bold text-red-500 uppercase tracking-tight">Upozornenie: Maximálny počet warnov</p>
                        <p className="text-xs text-red-400/80">Tento hráč má už {activeWarns} aktívne warny. Podľa pravidiel by mal byť 4. trest BAN, nie ďalší WARN.</p>
                      </div>
                    </div>
                  )}

                  {/* Target Selection */}
                  <div className="bg-zinc-950/50 border border-zinc-800/50 rounded-2xl p-5 space-y-4">
                    <div className="flex items-center gap-2 mb-2">
                      <Users className="w-4 h-4 text-red-500" />
                      <h3 className="text-xs font-bold text-zinc-400 uppercase tracking-widest">Cieľ trestu</h3>
                    </div>
                    
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      <div className="md:col-span-2">
                        <label className="block text-[10px] font-bold text-zinc-500 uppercase tracking-widest mb-1.5 ml-1">Vybrať z Discordu</label>
                        <DiscordUserSearch 
                          placeholder="Hľadať hráča..."
                          value={formData.discord_username}
                          onSelect={(m) => setFormData({ ...formData, discord_id: m.id, discord_username: m.username })}
                        />
                      </div>
                      
                      <div className="relative">
                        <label className="block text-[10px] font-bold text-zinc-500 uppercase tracking-widest mb-1.5 ml-1">Username</label>
                        <input 
                          type="text" 
                          className="w-full bg-zinc-900 border border-zinc-800 rounded-xl py-2.5 px-4 text-sm focus:outline-none focus:ring-2 focus:ring-red-500/50 transition-all"
                          value={formData.discord_username}
                          onChange={e => setFormData({...formData, discord_username: e.target.value})}
                          placeholder="napr. john_doe"
                        />
                      </div>
                      
                      <div className="relative">
                        <label className="block text-[10px] font-bold text-zinc-500 uppercase tracking-widest mb-1.5 ml-1">Discord ID</label>
                        <input 
                          type="text" 
                          className="w-full bg-zinc-900 border border-zinc-800 rounded-xl py-2.5 px-4 text-sm focus:outline-none focus:ring-2 focus:ring-red-500/50 font-mono transition-all"
                          value={formData.discord_id}
                          onChange={e => setFormData({...formData, discord_id: e.target.value})}
                          placeholder="napr. 1234567890"
                        />
                      </div>
                    </div>
                    <p className="text-[10px] text-zinc-600 italic ml-1">* Vyplňte aspoň jeden z údajov vyššie.</p>
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
                        <label className="block text-[10px] font-bold text-zinc-500 uppercase tracking-widest mb-1.5 ml-1">Dôvod (Pravidlo)</label>
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
                        <label className="block text-[10px] font-bold text-zinc-500 uppercase tracking-widest mb-1.5 ml-1">Dátum Expirácie / Trvanie</label>
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
                          placeholder="Popíšte situáciu a porušené pravidlá..."
                        />
                      </div>
                      
                      <div>
                        <label className="block text-[10px] font-bold text-zinc-500 uppercase tracking-widest mb-1.5 ml-1">Link na dôkaz (Imgur/YouTube/Medal)</label>
                        <input 
                          type="url" 
                          className="w-full bg-zinc-900 border border-zinc-800 rounded-xl py-2.5 px-4 text-sm focus:outline-none focus:ring-2 focus:ring-red-500/50 transition-all"
                          value={formData.evidence_url}
                          onChange={e => setFormData({...formData, evidence_url: e.target.value})}
                          placeholder="https://..."
                        />
                      </div>
                    </div>
                  </div>
                </div>
              )}

              {activeSection === 'WANTED' && (
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  <div className="md:col-span-2">
                    <label className="block text-xs font-bold text-zinc-500 uppercase tracking-widest mb-1.5">Vybrať z Discordu</label>
                    <DiscordUserSearch 
                      placeholder="Hľadať hľadaného..."
                      value={formData.discord_username}
                      onSelect={(m) => setFormData({ ...formData, discord_id: m.id, discord_username: m.username })}
                    />
                  </div>
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

              {activeSection === 'SETTINGS' && settingsTab === 'ADMINS' && (
                <div className="space-y-4">
                  <div>
                    <label className="block text-xs font-bold text-zinc-500 uppercase tracking-widest mb-1.5">Vybrať Admina z Discordu</label>
                    <DiscordUserSearch 
                      placeholder="Hľadať užívateľa..."
                      value={formData.discord_username}
                      onSelect={(m) => setFormData({ ...formData, discord_id: m.id, discord_username: m.username })}
                    />
                  </div>
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <label className="block text-xs font-bold text-zinc-500 uppercase tracking-widest mb-1.5">Discord Username</label>
                      <input 
                        type="text" 
                        readOnly
                        className="w-full bg-zinc-950 border border-zinc-800 rounded-xl py-2 px-4 text-sm text-zinc-400 cursor-not-allowed"
                        value={formData.discord_username}
                      />
                    </div>
                    <div>
                      <label className="block text-xs font-bold text-zinc-500 uppercase tracking-widest mb-1.5">Discord ID</label>
                      <input 
                        type="text" 
                        readOnly
                        className="w-full bg-zinc-950 border border-zinc-800 rounded-xl py-2 px-4 text-sm text-zinc-400 cursor-not-allowed font-mono"
                        value={formData.discord_id}
                      />
                    </div>
                  </div>
                </div>
              )}

              {activeSection === 'SETTINGS' && settingsTab === 'REASONS' && (
                <div className="space-y-4">
                  <div>
                    <label className="block text-xs font-bold text-zinc-500 uppercase tracking-widest mb-1.5">Názov Dôvodu</label>
                    <input 
                      required
                      type="text" 
                      className="w-full bg-zinc-950 border border-zinc-800 rounded-xl py-2 px-4 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500/50"
                      value={formData.reason}
                      onChange={e => setFormData({...formData, reason: e.target.value})}
                      placeholder="napr. Combatlog"
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
                    activeSection === 'SETTINGS' ? "bg-indigo-600 hover:bg-indigo-700 shadow-indigo-900/20" :
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
