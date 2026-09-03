import { useState, useEffect, ChangeEvent, KeyboardEvent } from 'react';
import { Save, Plus, X, Bot, MessageSquare, Terminal } from 'lucide-react';
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
    setIsSaving(true);
    setSaveMessage('');
    try {
      await api.authPost('/api/admin/settings', settings);
      setSaveMessage('Pengaturan berhasil disimpan!');
      setTimeout(() => setSaveMessage(''), 3000);
    } catch (err) {
      console.error(err);
      setSaveMessage('Gagal menyimpan pengaturan.');
    } finally {
      setIsSaving(false);
    }
  };

  const addQuickReply = () => {
    if (newQuickReply.trim() && !settings.quick_replies.includes(newQuickReply.trim())) {
      setSettings({
        ...settings,
        quick_replies: [...settings.quick_replies, newQuickReply.trim()]
      });
      setNewQuickReply('');
    }
  };

  const removeQuickReply = (index: number) => {
    const updated = settings.quick_replies.filter((_, i) => i !== index);
    setSettings({ ...settings, quick_replies: updated });
  };

  return (
    <div className="p-6 max-w-4xl">
      <div className="mb-8 flex justify-between items-center">
        <div>
          <h1 className="text-2xl font-bold text-slate-800">Bot Settings</h1>
          <p className="text-slate-500">Sesuaikan kepribadian dan sapaan Lexa Chatbot.</p>
        </div>
        <button 
          onClick={handleSave}
          disabled={isSaving}
          className="flex items-center gap-2 bg-blue-600 hover:bg-blue-700 text-white px-5 py-2.5 rounded-xl font-medium transition-colors shadow-sm disabled:opacity-50"
        >
          <Save className="w-4 h-4" />
          {isSaving ? 'Menyimpan...' : 'Simpan Perubahan'}
        </button>
      </div>

      {saveMessage && (
        <div className={`mb-6 p-4 rounded-xl text-sm font-medium ${saveMessage.includes('berhasil') ? 'bg-green-50 text-green-700 border border-green-200' : 'bg-red-50 text-red-700 border border-red-200'}`}>
          {saveMessage}
        </div>
      )}

      <div className="space-y-6">
        
        {/* Welcome Message */}
        <div className="bg-white rounded-2xl border border-slate-200 p-6 shadow-sm">
          <div className="flex items-center gap-3 mb-4 border-b border-slate-100 pb-4">
            <div className="bg-blue-100 p-2 rounded-lg text-blue-600">
              <MessageSquare className="w-5 h-5" />
            </div>
            <div>
              <h2 className="font-semibold text-slate-800">Welcome Message</h2>
              <p className="text-xs text-slate-500">Pesan sapaan pertama kali saat widget dibuka.</p>
            </div>
          </div>
          <textarea 
            value={settings.welcome_message}
            onChange={(e: ChangeEvent<HTMLTextAreaElement>) => setSettings({...settings, welcome_message: e.target.value})}
            rows={3}
            className="w-full border border-slate-300 rounded-xl p-4 focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none transition-all resize-none text-slate-700"
            placeholder="Halo! Ada yang bisa saya bantu?"
          />
        </div>

        {/* Quick Replies */}
        <div className="bg-white rounded-2xl border border-slate-200 p-6 shadow-sm">
          <div className="flex items-center gap-3 mb-4 border-b border-slate-100 pb-4">
            <div className="bg-purple-100 p-2 rounded-lg text-purple-600">
              <Bot className="w-5 h-5" />
            </div>
            <div>
              <h2 className="font-semibold text-slate-800">Quick Replies</h2>
              <p className="text-xs text-slate-500">Tombol sugesti pertanyaan bagi pengguna.</p>
            </div>
          </div>
          
          <div className="flex flex-wrap gap-2 mb-4">
            {settings.quick_replies.map((reply, i) => (
              <div key={i} className="flex items-center gap-2 bg-slate-100 border border-slate-200 px-3 py-1.5 rounded-full text-sm text-slate-700">
                <span>{reply}</span>
                <button onClick={() => removeQuickReply(i)} className="text-slate-400 hover:text-red-500">
                  <X className="w-4 h-4" />
                </button>
              </div>
            ))}
          </div>

          <div className="flex gap-2">
            <input 
              type="text" 
              value={newQuickReply}
              onChange={(e: ChangeEvent<HTMLInputElement>) => setNewQuickReply(e.target.value)}
              onKeyDown={(e: KeyboardEvent<HTMLInputElement>) => e.key === 'Enter' && addQuickReply()}
              placeholder="Tambah quick reply baru..."
              className="flex-1 border border-slate-300 rounded-xl px-4 py-2 focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none text-sm"
            />
            <button 
              onClick={addQuickReply}
              className="bg-slate-800 text-white px-4 py-2 rounded-xl hover:bg-slate-700 transition-colors flex items-center gap-2 text-sm font-medium"
            >
              <Plus className="w-4 h-4" /> Tambah
            </button>
          </div>
        </div>

        {/* System Prompt */}
        <div className="bg-white rounded-2xl border border-slate-200 p-6 shadow-sm">
          <div className="flex items-center gap-3 mb-4 border-b border-slate-100 pb-4">
            <div className="bg-emerald-100 p-2 rounded-lg text-emerald-600">
              <Terminal className="w-5 h-5" />
            </div>
            <div>
              <h2 className="font-semibold text-slate-800">System Prompt / Persona</h2>
              <p className="text-xs text-slate-500">Instruksi inti untuk mendikte kepribadian dan aturan bot.</p>
            </div>
          </div>
          <textarea 
            value={settings.system_prompt}
            onChange={(e: ChangeEvent<HTMLTextAreaElement>) => setSettings({...settings, system_prompt: e.target.value})}
            rows={8}
            className="w-full bg-slate-900 text-green-400 font-mono text-sm border-0 rounded-xl p-4 focus:ring-2 focus:ring-emerald-500 outline-none transition-all resize-y"
            placeholder="Anda adalah asisten AI..."
          />
          <p className="text-xs text-slate-400 mt-2">Peringatan: Perubahan di sini langsung memengaruhi cara LLM (Groq) merespons pesan.</p>
        </div>

      </div>
    </div>
  );
};

export default Settings;