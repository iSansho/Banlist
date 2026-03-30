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
  XCircle
} from 'lucide-react';
import { supabase, Punishment, PunishmentType, PUNISHMENT_REASONS, PUNISHMENT_TYPES } from './lib/supabase';
import { cn } from './lib/utils';
import { format, isAfter, parseISO } from 'date-fns';
import { sk } from 'date-fns/locale';

export default function App() {
  const [user, setUser] = useState<any>(null);
  const [punishments, setPunishments] = useState<Punishment[]>([]);
  const [loading, setLoading] = useState(true);
  const [isAdmin, setIsAdmin] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');
  const [typeFilter, setTypeFilter] = useState<string>('ALL');
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingPunishment, setEditingPunishment] = useState<Punishment | null>(null);

  // Form state
  const [formData, setFormData] = useState({
    target_id: '',
    target_name: '',
    type: 'WARN' as PunishmentType,
    reason: PUNISHMENT_REASONS[0],
    details: '',
    evidence_url: '',
    expires_at: '' as string | null,
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

    fetchPunishments();

    return () => subscription.unsubscribe();
  }, []);

  const checkAdminStatus = (user: any) => {
    if (!user) {
      setIsAdmin(false);
      return;
    }
    const whitelist = import.meta.env.VITE_ADMIN_WHITELIST?.split(',') || [];
    const discordId = user.user_metadata?.provider_id || user.id;
    setIsAdmin(whitelist.includes(discordId));
  };

  const fetchPunishments = async () => {
    setLoading(true);
    const { data, error } = await supabase
      .from('punishments')
      .select('*')
      .order('created_at', { ascending: false });

    if (error) {
      console.error('Error fetching punishments:', error);
    } else {
      setPunishments(data || []);
    }
    setLoading(false);
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

    const payload = {
      ...formData,
      admin_discord_id: user.user_metadata?.provider_id || user.id,
      admin_name: user.user_metadata?.full_name || user.email,
    };

    let error;
    if (editingPunishment) {
      const { error: updateError } = await supabase
        .from('punishments')
        .update(payload)
        .eq('id', editingPunishment.id);
      error = updateError;
    } else {
      const { error: insertError } = await supabase
        .from('punishments')
        .insert([payload]);
      error = insertError;
    }

    if (error) {
      alert('Chyba pri ukladaní: ' + error.message);
    } else {
      // Send Webhook
      try {
        await fetch('/api/webhook', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            embeds: [{
              title: `${editingPunishment ? 'Upravený' : 'Nový'} Trest: ${formData.type}`,
              color: formData.type === 'BAN' ? 15158332 : 15844367,
              fields: [
                { name: 'Hráč', value: formData.target_name, inline: true },
                { name: 'Identifikácia', value: formData.target_id, inline: true },
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

      setIsModalOpen(false);
      setEditingPunishment(null);
      resetForm();
      fetchPunishments();
    }
  };

  const resetForm = () => {
    setFormData({
      target_id: '',
      target_name: '',
      type: 'WARN',
      reason: PUNISHMENT_REASONS[0],
      details: '',
      evidence_url: '',
      expires_at: '',
    });
  };

  const handleDelete = async (id: string) => {
    if (!isAdmin || !confirm('Naozaj chcete vymazať tento záznam?')) return;
    const { error } = await supabase.from('punishments').delete().eq('id', id);
    if (error) alert('Chyba: ' + error.message);
    else fetchPunishments();
  };

  const handleEdit = (p: Punishment) => {
    setEditingPunishment(p);
    setFormData({
      target_id: p.target_id,
      target_name: p.target_name,
      type: p.type,
      reason: p.reason,
      details: p.details,
      evidence_url: p.evidence_url,
      expires_at: p.expires_at ? new Date(p.expires_at).toISOString().slice(0, 16) : '',
    });
    setIsModalOpen(true);
  };

  const filteredPunishments = punishments.filter(p => {
    const matchesSearch = p.target_name.toLowerCase().includes(searchTerm.toLowerCase()) || 
                         p.target_id.toLowerCase().includes(searchTerm.toLowerCase());
    const matchesType = typeFilter === 'ALL' || p.type === typeFilter;
    return matchesSearch && matchesType;
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
            <h1 className="text-3xl font-black tracking-tight mb-2">RedM Admin Panel</h1>
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
            
            <div className="mt-8 pt-8 border-t border-zinc-800">
              <p className="text-[10px] text-zinc-600 uppercase tracking-[0.2em] font-bold">Zabezpečený prístup</p>
            </div>
          </div>
        </div>
      </div>
    );
  }

  if (!isAdmin) {
    return (
      <div className="min-h-screen bg-zinc-950 flex flex-col items-center justify-center p-4">
        <div className="bg-zinc-900 border border-zinc-800 p-8 rounded-3xl shadow-2xl text-center max-w-md">
          <div className="inline-flex bg-zinc-800 p-4 rounded-2xl mb-6">
            <XCircle className="w-10 h-10 text-red-500" />
          </div>
          <h1 className="text-2xl font-bold mb-2">Prístup Odmietnutý</h1>
          <p className="text-zinc-500 text-sm mb-8">Váš účet ({user.user_metadata?.full_name || user.email}) sa nenachádza na zozname administrátorov.</p>
          
          <div className="space-y-3">
            <button 
              onClick={handleLogout}
              className="w-full bg-zinc-800 hover:bg-zinc-700 text-white font-bold py-3 rounded-xl transition-all"
            >
              Odhlásiť sa
            </button>
            <p className="text-[10px] text-zinc-600">ID: {user.user_metadata?.provider_id || user.id}</p>
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
          <div className="flex items-center gap-3">
            <div className="bg-red-600 p-2 rounded-lg shadow-lg shadow-red-900/20">
              <Shield className="w-6 h-6 text-white" />
            </div>
            <div>
              <h1 className="font-bold text-lg tracking-tight">RedM Admin Panel</h1>
              <p className="text-xs text-zinc-500 uppercase tracking-widest font-semibold">Interný Systém</p>
            </div>
          </div>

          <div className="flex items-center gap-4">
            {user ? (
              <div className="flex items-center gap-4">
                <div className="hidden md:block text-right">
                  <p className="text-sm font-medium">{user.user_metadata?.full_name || user.email}</p>
                  <p className="text-[10px] text-zinc-500 uppercase tracking-wider">
                    {isAdmin ? 'Administrátor' : 'Používateľ'}
                  </p>
                </div>
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
        {/* Stats / Actions */}
        <div className="flex flex-col md:flex-row gap-4 mb-8 items-center justify-between">
          <div className="flex flex-wrap gap-2 w-full md:w-auto">
            <div className="relative flex-1 md:w-80">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-zinc-500" />
              <input 
                type="text" 
                placeholder="Hľadať podľa Steam Hex / Mena..." 
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
              onClick={() => { resetForm(); setEditingPunishment(null); setIsModalOpen(true); }}
              className="w-full md:w-auto bg-red-600 hover:bg-red-700 text-white px-6 py-2.5 rounded-xl text-sm font-bold transition-all flex items-center justify-center gap-2 shadow-lg shadow-red-900/20"
            >
              <Plus className="w-4 h-4" /> Pridať Trest
            </button>
          )}
        </div>

        {/* Table */}
        <div className="bg-zinc-900 border border-zinc-800 rounded-2xl overflow-hidden shadow-xl">
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="bg-zinc-800/50 border-b border-zinc-800">
                  <th className="px-6 py-4 text-[11px] font-bold uppercase tracking-widest text-zinc-500">Hráč</th>
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
                        <div className="font-medium text-zinc-100">{p.target_name}</div>
                        <div className="text-xs text-zinc-500 font-mono">{p.target_id}</div>
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
      </main>

      {/* Modal */}
      {isModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm">
          <div className="bg-zinc-900 border border-zinc-800 w-full max-w-2xl rounded-2xl shadow-2xl overflow-hidden animate-in fade-in zoom-in duration-200">
            <div className="px-6 py-4 border-b border-zinc-800 flex items-center justify-between bg-zinc-800/30">
              <h2 className="text-lg font-bold">{editingPunishment ? 'Upraviť Trest' : 'Pridať Nový Trest'}</h2>
              <button onClick={() => setIsModalOpen(false)} className="text-zinc-500 hover:text-white transition-colors">
                <XCircle className="w-6 h-6" />
              </button>
            </div>
            
            <form onSubmit={handleSubmit} className="p-6">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                {/* Target Info */}
                <div className="space-y-4">
                  <div>
                    <label className="block text-xs font-bold text-zinc-500 uppercase tracking-widest mb-1.5">Meno Hráča</label>
                    <input 
                      required
                      type="text" 
                      className="w-full bg-zinc-950 border border-zinc-800 rounded-xl py-2 px-4 text-sm focus:outline-none focus:ring-2 focus:ring-red-500/50"
                      value={formData.target_name}
                      onChange={e => setFormData({...formData, target_name: e.target.value})}
                      placeholder="napr. John Doe"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-bold text-zinc-500 uppercase tracking-widest mb-1.5">Steam Hex / Rockstar ID</label>
                    <input 
                      required
                      type="text" 
                      className="w-full bg-zinc-950 border border-zinc-800 rounded-xl py-2 px-4 text-sm focus:outline-none focus:ring-2 focus:ring-red-500/50 font-mono"
                      value={formData.target_id}
                      onChange={e => setFormData({...formData, target_id: e.target.value})}
                      placeholder="steam:1100001..."
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
                  className="flex-[2] bg-red-600 hover:bg-red-700 text-white font-bold py-3 rounded-xl transition-all shadow-lg shadow-red-900/20"
                >
                  {editingPunishment ? 'Uložiť Zmeny' : 'Uložiť Trest'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Footer */}
      <footer className="max-w-7xl mx-auto px-4 py-12 border-t border-zinc-900 mt-12">
        <div className="flex flex-col md:flex-row justify-between items-center gap-4 text-zinc-600 text-xs font-medium uppercase tracking-widest">
          <p>© 2026 RedM RP Admin System</p>
          <div className="flex gap-6">
            <a href="#" className="hover:text-zinc-400 transition-colors">Pravidlá</a>
            <a href="#" className="hover:text-zinc-400 transition-colors">Discord</a>
            <a href="#" className="hover:text-zinc-400 transition-colors">Podpora</a>
          </div>
        </div>
      </footer>
    </div>
  );
}
