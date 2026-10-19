import { useState, useEffect, ChangeEvent, KeyboardEvent } from 'react';
import { Save, Plus, X, Bot, MessageSquare, Terminal, ShieldAlert, Check, CheckCircle2, AlertCircle, RefreshCw } from 'lucide-react';
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
  const [savingTarget, setSavingTarget] = useState<'all' | 'welcome' | 'prompt' | 'quick_replies' | null>(null);
  const [savedSection, setSavedSection] = useState<'all' | 'welcome' | 'prompt' | 'quick_replies' | null>(null);
  const [toastMessage, setToastMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

  const currentUser = (() => {
    try {
      const u = sessionStorage.getItem('lexa_admin_user');
      return u ? JSON.parse(u) : null;
    } catch {
      return null;
    }
  })();
  const isSuperAdmin = currentUser?.role === 'Super Admin';

  const loadSettings = () => {
    api.authGet<SettingsType>('/api/admin/settings')
      .then(data => {
        setSettings(data);
      })
      .catch(err => {
        console.error('Failed to load settings:', err);
      });
  };

  useEffect(() => {
    loadSettings();
  }, []);

  const handleSave = async (dataToSave = settings, target: 'all' | 'welcome' | 'prompt' | 'quick_replies' = 'all') => {
    if (!isSuperAdmin) return;
    setIsSaving(true);
    setSavingTarget(target);
    try {
      await api.authPost('/api/admin/settings', dataToSave);
      setSavedSection(target);
      const targetLabel = 
        target === 'prompt' ? 'System Prompt' : 
        target === 'welcome' ? 'Welcome Message' : 
        target === 'quick_replies' ? 'Quick Replies' : 'Seluruh Pengaturan AI';
      
      setToastMessage({
        type: 'success',
        text: `${targetLabel} berhasil disimpan permanen ke database!`
      });

      setTimeout(() => {
        setSavedSection(null);
      }, 3000);
      setTimeout(() => {
        setToastMessage(null);
      }, 4000);
    } catch (err: any) {
      console.error(err);
      setToastMessage({
        type: 'error',
        text: `Gagal menyimpan: ${err.message || 'Terjadi kesalahan'}`
      });
      // Re-sync with database to ensure UI does not stay in inconsistent state
      loadSettings();
      setTimeout(() => setToastMessage(null), 5000);
    } finally {
      setIsSaving(false);
      setSavingTarget(null);
    }
  };

  const addQuickReply = async () => {
    if (!isSuperAdmin) return;
    const trimmed = newQuickReply.trim();
    if (trimmed && !settings.quick_replies.includes(trimmed)) {
      const updated = {
        ...settings,
        quick_replies: [...settings.quick_replies, trimmed]
      };
      setSettings(updated);
      setNewQuickReply('');
      // Auto-save langsung ke database
      await handleSave(updated, 'quick_replies');
    }
  };

  const removeQuickReply = async (index: number) => {
    if (!isSuperAdmin) return;
    const updatedReplies = settings.quick_replies.filter((_, i) => i !== index);
    const updated = { ...settings, quick_replies: updatedReplies };
    setSettings(updated);
    // Auto-save langsung ke database
    await handleSave(updated, 'quick_replies');
  };

  return (
    <div className="p-6 max-w-4xl space-y-6 pb-20">
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-xl font-bold text-slate-900 dark:text-slate-100">Bot Settings</h1>
          <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">Sesuaikan persona AI, sapaan pembuka, dan pertanyaan cepat.</p>
        </div>
        {isSuperAdmin && (
          <button 
            onClick={() => handleSave(settings, 'all')}
            disabled={isSaving}
            className="flex items-center gap-2 bg-[#0066FF] hover:bg-[#0052CC] text-white px-4 py-2 rounded-xl text-xs font-semibold transition-all shadow-sm cursor-pointer disabled:opacity-50"
          >
            {isSaving && savingTarget === 'all' ? (
              <>
                <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                <span>Menyimpan...</span>
              </>
            ) : savedSection === 'all' ? (
              <>
                <Check className="w-3.5 h-3.5 text-emerald-300" />
                <span>Tersimpan!</span>
              </>
            ) : (
              <>
                <Save className="w-3.5 h-3.5" />
                <span>Simpan Semua</span>
              </>
            )}
          </button>
        )}
      </div>

      {/* Floating Toast Notification (Always Visible Regardless of Scroll) */}
      {toastMessage && (
        <div className={`fixed bottom-6 right-6 z-50 flex items-center gap-2.5 px-4 py-3 rounded-2xl shadow-2xl border text-xs font-semibold animate-in fade-in slide-in-from-bottom-3 duration-200 ${
          toastMessage.type === 'success'
            ? 'bg-slate-900 text-emerald-400 border-emerald-500/40 shadow-emerald-950/40'
            : 'bg-slate-900 text-rose-400 border-rose-500/40 shadow-rose-950/40'
        }`}>
          {toastMessage.type === 'success' ? (
            <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0" />
          ) : (
            <AlertCircle className="w-4 h-4 text-rose-400 shrink-0" />
          )}
          <span>{toastMessage.text}</span>
        </div>
      )}

      {!isSuperAdmin && (
        <div className="p-3.5 bg-amber-50 dark:bg-amber-950/40 border border-amber-200 dark:border-amber-800 rounded-xl flex items-center gap-2 text-xs text-amber-800 dark:text-amber-300">
          <ShieldAlert className="w-4 h-4 shrink-0" />
          <span>
            Mode hanya baca: Anda masuk sebagai <strong>{currentUser?.role || 'Staf'}</strong>. Pengubahan prompt dan pengaturan AI hanya dapat dilakukan oleh <strong>Super Admin</strong>.
          </span>
        </div>
      )}

      <div className="space-y-6">
        
        {/* Welcome Message */}
        <div className="bg-white dark:bg-slate-800/80 rounded-2xl border border-slate-200/80 dark:border-slate-700/80 p-5 shadow-sm transition-colors">
          <div className="flex items-center justify-between mb-4 border-b border-slate-100 dark:border-slate-700 pb-3">
            <div className="flex items-center gap-3">
              <div className="bg-blue-100 dark:bg-blue-950/50 p-2 rounded-lg text-blue-600 dark:text-blue-400">
                <MessageSquare className="w-4 h-4" />
              </div>
              <div>
                <h2 className="font-semibold text-sm text-slate-900 dark:text-slate-100">Welcome Message</h2>
                <p className="text-xs text-slate-500 dark:text-slate-400">Pesan sapaan otomatis pertama kali saat widget dibuka oleh pelanggan.</p>
              </div>
            </div>
            {isSuperAdmin && (
              <button
                onClick={() => handleSave(settings, 'welcome')}
                disabled={isSaving}
                className="px-3 py-1.5 bg-blue-50 hover:bg-blue-100 dark:bg-blue-950/50 dark:hover:bg-blue-900/60 text-[#0066FF] dark:text-blue-400 rounded-lg text-xs font-semibold border border-blue-200 dark:border-blue-900/60 transition-colors flex items-center gap-1.5 cursor-pointer disabled:opacity-50"
              >
                {isSaving && savingTarget === 'welcome' ? (
                  <>
                    <RefreshCw className="w-3 h-3 animate-spin" />
                    <span>Menyimpan...</span>
                  </>
                ) : savedSection === 'welcome' ? (
                  <>
                    <Check className="w-3 h-3 text-emerald-600 dark:text-emerald-400" />
                    <span className="text-emerald-700 dark:text-emerald-400 font-bold">Tersimpan!</span>
                  </>
                ) : (
                  <>
                    <Save className="w-3 h-3" />
                    <span>Simpan</span>
                  </>
                )}
              </button>
            )}
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
          <div className="flex items-center justify-between mb-4 border-b border-slate-100 dark:border-slate-700 pb-3">
            <div className="flex items-center gap-3">
              <div className="bg-purple-100 dark:bg-purple-950/50 p-2 rounded-lg text-purple-600 dark:text-purple-400">
                <Bot className="w-4 h-4" />
              </div>
              <div>
                <h2 className="font-semibold text-sm text-slate-900 dark:text-slate-100">Quick Replies</h2>
                <p className="text-xs text-slate-500 dark:text-slate-400">Daftar pertanyaan cepat yang disarankan ke pelanggan (tersimpan otomatis).</p>
              </div>
            </div>
            <span className="text-[11px] font-mono text-emerald-600 dark:text-emerald-400 font-medium bg-emerald-50 dark:bg-emerald-950/40 px-2 py-0.5 rounded-md border border-emerald-200/60 dark:border-emerald-800/40 flex items-center gap-1.5">
              {isSaving && savingTarget === 'quick_replies' ? (
                <>
                  <RefreshCw className="w-3 h-3 animate-spin text-blue-500" />
                  <span>Menyimpan ke DB...</span>
                </>
              ) : savedSection === 'quick_replies' ? (
                <>
                  <Check className="w-3 h-3 text-emerald-500" />
                  <span>Tersimpan ke DB!</span>
                </>
              ) : (
                <span>Auto-Save Aktif</span>
              )}
            </span>
          </div>
          
          <div className="flex flex-wrap gap-2 mb-4">
            {settings.quick_replies.map((reply, i) => (
              <div key={i} className="flex items-center gap-1.5 bg-slate-100 dark:bg-slate-700 border border-slate-200 dark:border-slate-600 px-3 py-1 rounded-full text-xs text-slate-700 dark:text-slate-200">
                <span>{reply}</span>
                {isSuperAdmin && (
                  <button onClick={() => removeQuickReply(i)} className="text-slate-400 hover:text-red-500 cursor-pointer" title="Hapus pertanyaan cepat">
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
                placeholder="Ketik opsi pertanyaan baru lalu tekan Enter atau klik Tambah..."
                className="flex-1 border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 text-slate-800 dark:text-slate-200 rounded-xl px-3 py-1.5 focus:border-blue-500 outline-none text-xs"
              />
              <button 
                onClick={addQuickReply}
                disabled={isSaving}
                className="bg-slate-900 hover:bg-slate-800 dark:bg-[#0066FF] dark:hover:bg-[#0052CC] text-white px-3.5 py-1.5 rounded-xl transition-colors flex items-center gap-1.5 text-xs font-semibold cursor-pointer disabled:opacity-50"
              >
                <Plus className="w-3.5 h-3.5" /> Tambah & Simpan
              </button>
            </div>
          )}
        </div>

        {/* System Prompt */}
        <div className="bg-white dark:bg-slate-800/80 rounded-2xl border border-slate-200/80 dark:border-slate-700/80 p-5 shadow-sm transition-colors">
          <div className="flex items-center justify-between mb-4 border-b border-slate-100 dark:border-slate-700 pb-3">
            <div className="flex items-center gap-3">
              <div className="bg-emerald-100 dark:bg-emerald-950/50 p-2 rounded-lg text-emerald-600 dark:text-emerald-400">
                <Terminal className="w-4 h-4" />
              </div>
              <div>
                <h2 className="font-semibold text-sm text-slate-900 dark:text-slate-100">System Prompt & Persona LLM</h2>
                <p className="text-xs text-slate-500 dark:text-slate-400">Instruksi sistem yang mendikte batasan pengetahuan dan gaya bicara bot.</p>
              </div>
            </div>
            {isSuperAdmin && (
              <button
                onClick={() => handleSave(settings, 'prompt')}
                disabled={isSaving}
                className="px-3.5 py-1.5 bg-emerald-50 hover:bg-emerald-100 dark:bg-emerald-950/50 dark:hover:bg-emerald-900/60 text-emerald-700 dark:text-emerald-400 rounded-lg text-xs font-semibold border border-emerald-200 dark:border-emerald-900/60 transition-colors flex items-center gap-1.5 cursor-pointer disabled:opacity-50"
              >
                {isSaving && savingTarget === 'prompt' ? (
                  <>
                    <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                    <span>Menyimpan...</span>
                  </>
                ) : savedSection === 'prompt' ? (
                  <>
                    <Check className="w-3.5 h-3.5 text-emerald-600 dark:text-emerald-400" />
                    <span className="font-bold text-emerald-700 dark:text-emerald-400">✓ Tersimpan!</span>
                  </>
                ) : (
                  <>
                    <Save className="w-3 h-3" />
                    <span>Simpan Prompt</span>
                  </>
                )}
              </button>
            )}
          </div>
          <textarea 
            value={settings.system_prompt}
            onChange={(e: ChangeEvent<HTMLTextAreaElement>) => isSuperAdmin && setSettings({...settings, system_prompt: e.target.value})}
            readOnly={!isSuperAdmin}
            rows={8}
            className="w-full bg-slate-950 text-emerald-400 font-mono text-xs border border-slate-800 rounded-xl p-3.5 focus:border-emerald-500 outline-none transition-all resize-y leading-relaxed"
            placeholder="Anda adalah asisten AI..."
          />
          <p className="text-[11px] text-slate-400 mt-2">
            Perubahan system prompt langsung memengaruhi instruksi konteks pada model AI Groq dan disimpan permanen di database.
          </p>
        </div>

      </div>
    </div>
  );
};

export default Settings;