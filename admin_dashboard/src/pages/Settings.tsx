import { useState, useEffect, ChangeEvent, KeyboardEvent } from 'react';
import { Save, Plus, X, Bot, MessageSquare, Terminal, ShieldAlert } from 'lucide-react';
import api from '../lib/apiClient';
import type { Settings as SettingsType } from '../types/api';

const Settings = () => {
  const [settings, setSettings] = useState<SettingsType>({
    welcome_message: '',
    quick_replies: [],
    system_prompt: ''
  });
  const [newQuickReply, setNewQuickReply] = useState('');
  const [isSaving, setIsSaving] = useState(false);
  const [saveMessage, setSaveMessage] = useState('');

  const currentUser = (() => {
    try {
      const u = sessionStorage.getItem('lexa_admin_user');
      return u ? JSON.parse(u) : null;
    } catch {
      return null;
    }
  })();
  const isSuperAdmin = currentUser?.role === 'Super Admin';

  useEffect(() => {
    api.authGet<SettingsType>('/api/admin/settings')
      .then(data => {
        setSettings(data);
      })
      .catch(err => {
        console.error('Failed to load settings:', err);
      });
  }, []);

  const handleSave = async () => {
    if (!isSuperAdmin) return;
    setIsSaving(true);
    setSaveMessage('');
    try {
      await api.authPost('/api/admin/settings', settings);
      setSaveMessage('Pengaturan AI berhasil diperbarui!');
      setTimeout(() => setSaveMessage(''), 3000);
    } catch (err) {
      console.error(err);
      setSaveMessage('Gagal menyimpan pengaturan.');
    } finally {
      setIsSaving(false);
    }
  };

  const addQuickReply = () => {
    if (!isSuperAdmin) return;
    if (newQuickReply.trim() && !settings.quick_replies.includes(newQuickReply.trim())) {
      setSettings({
        ...settings,
        quick_replies: [...settings.quick_replies, newQuickReply.trim()]
      });
      setNewQuickReply('');
    }
  };

  const removeQuickReply = (index: number) => {
    if (!isSuperAdmin) return;
    const updated = settings.quick_replies.filter((_, i) => i !== index);
    setSettings({ ...settings, quick_replies: updated });
  };

  return (
    <div className="p-6 max-w-4xl space-y-6">
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-xl font-bold text-slate-900 dark:text-slate-100">Bot Settings</h1>
          <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">Sesuaikan persona AI, sapaan pembuka, dan pertanyaan cepat.</p>
        </div>
        {isSuperAdmin && (
          <button 
            onClick={handleSave}
            disabled={isSaving}
            className="flex items-center gap-2 bg-blue-600 hover:bg-blue-500 text-white px-4 py-2 rounded-xl text-xs font-semibold transition-colors shadow-sm disabled:opacity-50"
          >
            <Save className="w-3.5 h-3.5" />
            {isSaving ? 'Menyimpan...' : 'Simpan Perubahan'}
          </button>
        )}
      </div>

      {!isSuperAdmin && (
        <div className="p-3.5 bg-amber-50 dark:bg-amber-950/40 border border-amber-200 dark:border-amber-800 rounded-xl flex items-center gap-2 text-xs text-amber-800 dark:text-amber-300">
          <ShieldAlert className="w-4 h-4 shrink-0" />
          <span>
            Mode hanya baca: Anda masuk sebagai <strong>{currentUser?.role || 'Staf'}</strong>. Pengubahan prompt dan pengaturan AI hanya dapat dilakukan oleh <strong>Super Admin</strong>.
          </span>
        </div>
      )}

      {saveMessage && (
        <div className={`p-3.5 rounded-xl text-xs font-medium ${saveMessage.includes('berhasil') ? 'bg-emerald-50 dark:bg-emerald-950/40 text-emerald-700 dark:text-emerald-400 border border-emerald-200 dark:border-emerald-800' : 'bg-red-50 dark:bg-red-950/40 text-red-700 dark:text-red-400 border border-red-200 dark:border-red-800'}`}>
          {saveMessage}
        </div>
      )}

      <div className="space-y-6">
        
        {/* Welcome Message */}
        <div className="bg-white dark:bg-slate-800/80 rounded-2xl border border-slate-200/80 dark:border-slate-700/80 p-5 shadow-sm transition-colors">
          <div className="flex items-center gap-3 mb-4 border-b border-slate-100 dark:border-slate-700 pb-3">
            <div className="bg-blue-100 dark:bg-blue-950/50 p-2 rounded-lg text-blue-600 dark:text-blue-400">
              <MessageSquare className="w-4 h-4" />
            </div>
            <div>
              <h2 className="font-semibold text-sm text-slate-900 dark:text-slate-100">Welcome Message</h2>
              <p className="text-xs text-slate-500 dark:text-slate-400">Pesan sapaan otomatis pertama kali saat widget dibuka oleh pelanggan.</p>
            </div>
          </div>
          <textarea 
            value={settings.welcome_message}
            onChange={(e: ChangeEvent<HTMLTextAreaElement>) => isSuperAdmin && setSettings({...settings, welcome_message: e.target.value})}
            readOnly={!isSuperAdmin}
            rows={3}
            className="w-full border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 text-slate-800 dark:text-slate-200 rounded-xl p-3 focus:border-blue-500 outline-none transition-all resize-none text-xs leading-relaxed"
            placeholder="Halo! Ada yang bisa saya bantu?"
          />
        </div>

        {/* Quick Replies */}
        <div className="bg-white dark:bg-slate-800/80 rounded-2xl border border-slate-200/80 dark:border-slate-700/80 p-5 shadow-sm transition-colors">
          <div className="flex items-center gap-3 mb-4 border-b border-slate-100 dark:border-slate-700 pb-3">
            <div className="bg-purple-100 dark:bg-purple-950/50 p-2 rounded-lg text-purple-600 dark:text-purple-400">
              <Bot className="w-4 h-4" />
            </div>
            <div>
              <h2 className="font-semibold text-sm text-slate-900 dark:text-slate-100">Quick Replies</h2>
              <p className="text-xs text-slate-500 dark:text-slate-400">Daftar pertanyaan cepat yang disarankan ke pelanggan.</p>
            </div>
          </div>
          
          <div className="flex flex-wrap gap-2 mb-4">
            {settings.quick_replies.map((reply, i) => (
              <div key={i} className="flex items-center gap-1.5 bg-slate-100 dark:bg-slate-700 border border-slate-200 dark:border-slate-600 px-3 py-1 rounded-full text-xs text-slate-700 dark:text-slate-200">
                <span>{reply}</span>
                {isSuperAdmin && (
                  <button onClick={() => removeQuickReply(i)} className="text-slate-400 hover:text-red-500">
                    <X className="w-3.5 h-3.5" />
                  </button>
                )}
              </div>
            ))}
          </div>

          {isSuperAdmin && (
            <div className="flex gap-2">
              <input 
                type="text" 
                value={newQuickReply}
                onChange={(e: ChangeEvent<HTMLInputElement>) => setNewQuickReply(e.target.value)}
                onKeyDown={(e: KeyboardEvent<HTMLInputElement>) => e.key === 'Enter' && addQuickReply()}
                placeholder="Ketik opsi pertanyaan baru lalu tekan Enter..."
                className="flex-1 border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 text-slate-800 dark:text-slate-200 rounded-xl px-3 py-1.5 focus:border-blue-500 outline-none text-xs"
              />
              <button 
                onClick={addQuickReply}
                className="bg-slate-900 hover:bg-slate-800 dark:bg-blue-600 dark:hover:bg-blue-500 text-white px-3.5 py-1.5 rounded-xl transition-colors flex items-center gap-1.5 text-xs font-medium"
              >
                <Plus className="w-3.5 h-3.5" /> Tambah
              </button>
            </div>
          )}
        </div>

        {/* System Prompt */}
        <div className="bg-white dark:bg-slate-800/80 rounded-2xl border border-slate-200/80 dark:border-slate-700/80 p-5 shadow-sm transition-colors">
          <div className="flex items-center gap-3 mb-4 border-b border-slate-100 dark:border-slate-700 pb-3">
            <div className="bg-emerald-100 dark:bg-emerald-950/50 p-2 rounded-lg text-emerald-600 dark:text-emerald-400">
              <Terminal className="w-4 h-4" />
            </div>
            <div>
              <h2 className="font-semibold text-sm text-slate-900 dark:text-slate-100">System Prompt & Persona LLM</h2>
              <p className="text-xs text-slate-500 dark:text-slate-400">Instruksi sistem yang mendikte batasan pengetahuan dan gaya bicara bot.</p>
            </div>
          </div>
          <textarea 
            value={settings.system_prompt}
            onChange={(e: ChangeEvent<HTMLTextAreaElement>) => isSuperAdmin && setSettings({...settings, system_prompt: e.target.value})}
            readOnly={!isSuperAdmin}
            rows={7}
            className="w-full bg-slate-950 text-emerald-400 font-mono text-xs border border-slate-800 rounded-xl p-3.5 focus:border-emerald-500 outline-none transition-all resize-y leading-relaxed"
            placeholder="Anda adalah asisten AI..."
          />
          <p className="text-[11px] text-slate-400 mt-2">
            Perubahan system prompt langsung memengaruhi instruksi konteks pada model AI Groq.
          </p>
        </div>

      </div>
    </div>
  );
};

export default Settings;