import { useState, useEffect, useCallback } from 'react';
import { Copy, Check, Palette, ExternalLink, Info, Monitor } from 'lucide-react';
import api from '../lib/apiClient';
import { useLanguage } from '../lib/i18n';

interface EmbedCodeResponse {
  embed_code: string;
  iframe_fallback: string;
  js_api_example: string;
  config: {
    api_url: string;
    position: string;
    color: string;
    theme?: string;
  };
}

interface CopyButtonProps {
  text: string;
  field: string;
  isCopied: boolean;
  onCopy: (text: string, field: string) => void;
}

const CopyButton = ({ text, field, isCopied, onCopy }: CopyButtonProps) => (
  <button
    onClick={() => onCopy(text, field)}
    className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold rounded-lg transition-colors
      bg-white/10 hover:bg-white/20 text-white border border-white/10 cursor-pointer shadow-xs active:scale-95"
  >
    {isCopied ? (
      <>
        <Check className="w-3.5 h-3.5 text-emerald-400" />
        <span className="text-emerald-400">Tersalin!</span>
      </>
    ) : (
      <>
        <Copy className="w-3.5 h-3.5" />
        Salin Kode
      </>
    )}
  </button>
);

const WidgetSetup = () => {
  const { lang, t } = useLanguage();
  const [embedData, setEmbedData] = useState<EmbedCodeResponse | null>(null);
  const [apiUrl, setApiUrl] = useState('');
  const [position, setPosition] = useState('bottom-right');
  const [color, setColor] = useState('#0066FF');
  const [theme, setTheme] = useState('dark');
  const [copiedField, setCopiedField] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState<'html' | 'wordpress' | 'react' | 'iframe'>('html');
  const [previewChatOpen, setPreviewChatOpen] = useState(true);

  const isDarkTheme = theme === 'dark' || (theme === 'auto' && typeof window !== 'undefined' && window.matchMedia('(prefers-color-scheme: dark)').matches);

  const positions = [
    { value: 'bottom-right', label: t.pos_bottom_right },
    { value: 'bottom-left', label: t.pos_bottom_left },
  ];

  const themes = [
    { value: 'dark', label: t.theme_dark },
    { value: 'light', label: t.theme_light },
    { value: 'auto', label: t.theme_auto },
  ];

  const fetchEmbedCode = useCallback(async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams({ position, color, theme });
      if (apiUrl) params.set('api_url', apiUrl);
      const data = await api.authGet<EmbedCodeResponse>(`/api/admin/widget/embed-code?${params}`);
      setEmbedData(data);
    } catch (err) {
      console.error('Failed to fetch embed code:', err);
    } finally {
      setLoading(false);
    }
  }, [position, color, apiUrl, theme]);

  useEffect(() => {
    fetchEmbedCode();
  }, [fetchEmbedCode]);

  const handleCopy = async (text: string, field: string) => {
    await navigator.clipboard.writeText(text);
    setCopiedField(field);
    setTimeout(() => setCopiedField(null), 2000);
  };

  const reactSnippet = `// Next.js (App Router / Pages) atau React Vite
import Script from 'next/script'; // atau useEffect biasa di React

export default function ChatWidget() {
  return (
    <Script
      src="${embedData?.config.api_url || 'https://gianni-subvitalised-lauditorily.ngrok-free.dev'}/widget/widget-loader.js"
      data-api-url="${embedData?.config.api_url || 'https://gianni-subvitalised-lauditorily.ngrok-free.dev'}"
      data-position="${position}"
      data-color="${color}"
      data-theme="${theme}"
      strategy="lazyOnload"
    />
  );
}`;

  const dynamicIframeSnippet = `<!-- Fallback: Direct iframe embed (${position === 'bottom-left' ? 'Kiri Bawah' : 'Kanan Bawah'} / ${theme.toUpperCase()}) -->
<iframe src="${embedData?.config.api_url || 'https://gianni-subvitalised-lauditorily.ngrok-free.dev'}/widget/?theme=${theme}&color=${encodeURIComponent(color)}&position=${position}"
        style="position:fixed;bottom:24px;${position === 'bottom-left' ? 'left:24px;' : 'right:24px;'}z-index:99999;border:none;width:380px;height:640px;border-radius:24px;box-shadow:0 20px 60px -15px rgba(0,0,0,0.3);max-width:calc(100vw - 32px);"
        title="Lexa Chat Widget">
</iframe>`;

  const wordpressGuide = `<!-- Panduan WordPress:
1. Pasang plugin gratis "WPCode - Insert Headers and Footers" dari Menu Plugins.
2. Buka menu Code Snippets -> Header & Footer.
3. Tempelkan script berikut ke kolom "Footer": -->

${embedData?.embed_code || ''}`;

  return (
    <div className="p-6 max-w-6xl mx-auto space-y-6 pb-16">
      {/* Title & Informative Brief */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 pb-2 border-b border-slate-200/80 dark:border-slate-800/80">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-slate-900 dark:text-white">
            {t.widget_setup_title}
          </h1>
          <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">
            {t.widget_setup_subtitle}
          </p>
        </div>

        <a
          href="https://lexa-chatbot.vercel.app"
          target="_blank"
          rel="noopener noreferrer"
          className="inline-flex items-center gap-2 px-3.5 py-1.5 bg-[#0066FF] hover:bg-[#0052CC] text-white text-xs font-semibold rounded-xl transition-all shadow-sm cursor-pointer"
        >
          <ExternalLink className="w-3.5 h-3.5" />
          <span>{t.try_live_widget}</span>
        </a>
      </div>

      {/* Explanatory 3-Step Guide (Truly Informative for Admins) */}
      <div className="p-5 rounded-2xl bg-white dark:bg-[#0A1224] border border-slate-200/80 dark:border-white/5 shadow-xs">
        <h2 className="text-sm font-bold text-slate-900 dark:text-white flex items-center gap-2 mb-1">
          <Info className="w-4 h-4 text-[#0066FF]" />
          {t.how_it_works_title}
        </h2>
        <p className="text-xs text-slate-600 dark:text-slate-300 mb-4 leading-relaxed max-w-4xl">
          {t.how_it_works_desc}
        </p>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 pt-3 border-t border-slate-100 dark:border-white/5">
          <div className="p-3.5 rounded-xl bg-slate-50 dark:bg-white/[0.02] border border-slate-200/60 dark:border-white/5">
            <span className="text-xs font-bold text-[#0066FF] block mb-1">{t.step_1}</span>
            <p className="text-[11px] text-slate-500 dark:text-slate-400 leading-relaxed">
              {t.step_1_desc}
            </p>
          </div>

          <div className="p-3.5 rounded-xl bg-slate-50 dark:bg-white/[0.02] border border-slate-200/60 dark:border-white/5">
            <span className="text-xs font-bold text-[#0066FF] block mb-1">{t.step_2}</span>
            <p className="text-[11px] text-slate-500 dark:text-slate-400 leading-relaxed">
              {t.step_2_desc}
            </p>
          </div>

          <div className="p-3.5 rounded-xl bg-slate-50 dark:bg-white/[0.02] border border-slate-200/60 dark:border-white/5">
            <span className="text-xs font-bold text-emerald-600 dark:text-emerald-400 block mb-1">{t.step_3}</span>
            <p className="text-[11px] text-slate-500 dark:text-slate-400 leading-relaxed">
              {t.step_3_desc}
            </p>
          </div>
        </div>
      </div>

      {/* Configuration & Live Preview Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        
        {/* Left: Customization Form (5 cols) */}
        <div className="lg:col-span-5 space-y-5">
          <div className="bg-white dark:bg-[#0A1224] rounded-2xl border border-slate-200/80 dark:border-white/5 p-5 shadow-xs space-y-4">
            <h3 className="font-bold text-sm text-slate-900 dark:text-white flex items-center gap-2">
              <Palette className="w-4 h-4 text-[#0066FF]" />
              {t.config_widget}
            </h3>

            {/* Accent Color */}
            <div>
              <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1.5">
                {t.accent_color}
              </label>
              <div className="flex items-center gap-3">
                <input
                  type="color"
                  value={color}
                  onChange={(e) => setColor(e.target.value)}
                  className="w-10 h-10 rounded-xl border border-slate-200 dark:border-slate-700 cursor-pointer bg-transparent"
                />
                <input
                  type="text"
                  value={color}
                  onChange={(e) => setColor(e.target.value)}
                  className="flex-1 border border-slate-200 dark:border-slate-700 rounded-xl px-3.5 py-2 text-xs font-mono bg-white dark:bg-slate-900 text-slate-900 dark:text-slate-100 outline-none focus:border-[#0066FF]"
                />
              </div>
            </div>

            {/* Position */}
            <div>
              <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1.5">
                {t.pos_screen || (lang === 'id' ? 'Posisi Tombol di Layar' : 'Button Screen Position')}
              </label>
              <div className="grid grid-cols-2 gap-2 mb-2">
                <button
                  type="button"
                  onClick={() => setPosition('bottom-left')}
                  className={`px-3 py-2 rounded-xl text-xs font-semibold flex items-center justify-center gap-1.5 transition-all cursor-pointer border ${
                    position === 'bottom-left'
                      ? 'bg-[#0066FF] text-white border-[#0066FF] shadow-sm'
                      : 'bg-slate-50 dark:bg-slate-800/60 text-slate-600 dark:text-slate-300 border-slate-200 dark:border-slate-700 hover:bg-slate-100'
                  }`}
                >
                  <span>↙ {t.pos_bottom_left}</span>
                </button>
                <button
                  type="button"
                  onClick={() => setPosition('bottom-right')}
                  className={`px-3 py-2 rounded-xl text-xs font-semibold flex items-center justify-center gap-1.5 transition-all cursor-pointer border ${
                    position === 'bottom-right'
                      ? 'bg-[#0066FF] text-white border-[#0066FF] shadow-sm'
                      : 'bg-slate-50 dark:bg-slate-800/60 text-slate-600 dark:text-slate-300 border-slate-200 dark:border-slate-700 hover:bg-slate-100'
                  }`}
                >
                  <span>↘ {t.pos_bottom_right}</span>
                </button>
              </div>
              <select
                value={position}
                onChange={(e) => setPosition(e.target.value)}
                className="w-full border border-slate-200 dark:border-slate-700 rounded-xl px-3.5 py-2 text-xs bg-white dark:bg-slate-900 text-slate-900 dark:text-slate-100 outline-none focus:border-[#0066FF]"
              >
                {positions.map((p) => (
                  <option key={p.value} value={p.value}>{p.label}</option>
                ))}
              </select>
            </div>

            {/* Theme */}
            <div>
              <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1.5">
                {t.theme_chat || (lang === 'id' ? 'Tema Warna Chat' : 'Chat Appearance Theme')}
              </label>
              <div className="grid grid-cols-3 gap-2 mb-2">
                <button
                  type="button"
                  onClick={() => setTheme('light')}
                  className={`px-2 py-2 rounded-xl text-[11px] font-semibold flex items-center justify-center gap-1 transition-all cursor-pointer border ${
                    theme === 'light'
                      ? 'bg-[#0066FF] text-white border-[#0066FF] shadow-sm'
                      : 'bg-slate-50 dark:bg-slate-800/60 text-slate-600 dark:text-slate-300 border-slate-200 dark:border-slate-700 hover:bg-slate-100'
                  }`}
                >
                  <span>☀️ {t.theme_light}</span>
                </button>
                <button
                  type="button"
                  onClick={() => setTheme('dark')}
                  className={`px-2 py-2 rounded-xl text-[11px] font-semibold flex items-center justify-center gap-1 transition-all cursor-pointer border ${
                    theme === 'dark'
                      ? 'bg-[#0066FF] text-white border-[#0066FF] shadow-sm'
                      : 'bg-slate-50 dark:bg-slate-800/60 text-slate-600 dark:text-slate-300 border-slate-200 dark:border-slate-700 hover:bg-slate-100'
                  }`}
                >
                  <span>🌙 {t.theme_dark}</span>
                </button>
                <button
                  type="button"
                  onClick={() => setTheme('auto')}
                  className={`px-2 py-2 rounded-xl text-[11px] font-semibold flex items-center justify-center gap-1 transition-all cursor-pointer border ${
                    theme === 'auto'
                      ? 'bg-[#0066FF] text-white border-[#0066FF] shadow-sm'
                      : 'bg-slate-50 dark:bg-slate-800/60 text-slate-600 dark:text-slate-300 border-slate-200 dark:border-slate-700 hover:bg-slate-100'
                  }`}
                >
                  <span>💻 {t.theme_auto}</span>
                </button>
              </div>
              <select
                value={theme}
                onChange={(e) => setTheme(e.target.value)}
                className="w-full border border-slate-200 dark:border-slate-700 rounded-xl px-3.5 py-2 text-xs bg-white dark:bg-slate-900 text-slate-900 dark:text-slate-100 outline-none focus:border-[#0066FF]"
              >
                {themes.map((tItem) => (
                  <option key={tItem.value} value={tItem.value}>{tItem.label}</option>
                ))}
              </select>
            </div>

            {/* API Endpoint */}
            <div>
              <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1.5">
                {lang === 'id' ? 'Host API Backend (Otomatis)' : 'Backend API Host (Auto)'}
              </label>
              <input
                type="text"
                value={apiUrl}
                onChange={(e) => setApiUrl(e.target.value)}
                placeholder={embedData?.config.api_url || 'https://gianni-subvitalised-lauditorily.ngrok-free.dev'}
                className="w-full border border-slate-200 dark:border-slate-700 rounded-xl px-3.5 py-2 text-xs font-mono bg-white dark:bg-slate-900 text-slate-900 dark:text-slate-100 outline-none focus:border-[#0066FF]"
              />
            </div>
          </div>
        </div>

        {/* Right: Interactive Live Simulation Box (7 cols) */}
        <div className="lg:col-span-7">
          <div className={`rounded-2xl border p-5 shadow-xs h-full flex flex-col justify-between transition-colors duration-300 ${
            isDarkTheme
              ? 'bg-[#0A1224] border-blue-500/20 text-white shadow-xl'
              : 'bg-white border-slate-200/80 text-slate-900'
          }`}>
            <div className={`flex items-center justify-between pb-3 border-b mb-3 ${
              isDarkTheme ? 'border-white/10' : 'border-slate-100'
            }`}>
              <div className="flex items-center gap-2">
                <Monitor className="w-4 h-4 text-[#0066FF]" />
                <h3 className={`font-bold text-sm ${isDarkTheme ? 'text-white' : 'text-slate-900'}`}>
                  {t.live_preview}
                </h3>
              </div>
              <div className="flex items-center gap-2">
                <span className={`text-[10px] font-mono px-2 py-0.5 rounded-full border ${
                  isDarkTheme ? 'bg-blue-950/60 text-blue-300 border-blue-500/30' : 'bg-slate-100 text-slate-600 border-slate-200'
                }`}>
                  {position === 'bottom-right' ? t.pos_bottom_right : t.pos_bottom_left}
                </span>
                <span className={`text-[10px] font-mono px-2 py-0.5 rounded-full border ${
                  isDarkTheme ? 'bg-indigo-950/60 text-indigo-300 border-indigo-500/30' : 'bg-slate-100 text-slate-600 border-slate-200'
                }`}>
                  {theme.toUpperCase()}
                </span>
              </div>
            </div>

            {/* Simulated Web Page */}
            <div className={`relative w-full h-[360px] rounded-xl overflow-hidden flex flex-col shadow-inner select-none transition-colors duration-300 ${
              isDarkTheme
                ? 'dark bg-[#070D1D] text-slate-100 border border-white/10'
                : 'bg-slate-50 text-slate-900 border border-slate-200'
            }`}>
              {/* Fake Browser Top Bar */}
              <div className={`h-7 px-3 flex items-center gap-1.5 border-b transition-colors ${
                isDarkTheme ? 'bg-slate-900 border-white/10 text-slate-400' : 'bg-slate-200/80 border-slate-300/60 text-slate-600'
              }`}>
                <div className="w-2 h-2 rounded-full bg-rose-400"></div>
                <div className="w-2 h-2 rounded-full bg-amber-400"></div>
                <div className="w-2 h-2 rounded-full bg-emerald-400"></div>
                <div className={`mx-auto px-4 py-0.5 rounded-md text-[10px] font-mono border w-60 text-center truncate ${
                  isDarkTheme ? 'bg-slate-950/70 text-slate-300 border-white/10' : 'bg-white/80 text-slate-600 border-slate-300/50'
                }`}>
                  https://perusahaan-anda.com
                </div>
              </div>

              {/* Fake Website Content */}
              <div className="p-4 flex-1 overflow-hidden space-y-3">
                {/* Mock Navbar */}
                <div className={`flex items-center justify-between pb-2 border-b ${
                  isDarkTheme ? 'border-white/10' : 'border-slate-200/60'
                }`}>
                  <div className="flex items-center gap-2">
                    <img src="/lexa_icon.png" alt="Company Logo" className="w-5 h-5 rounded-md object-contain" onError={(e)=>{ (e.target as HTMLElement).style.display = 'none'; }} />
                    <span className={`text-xs font-bold ${isDarkTheme ? 'text-white' : 'text-slate-800'}`}>Acme Enterprise</span>
                  </div>
                  <div className="flex items-center gap-3 text-[10px] text-slate-400">
                    <span>Produk</span>
                    <span>Solusi</span>
                    <span>Kontak</span>
                    <span className="px-2 py-0.5 rounded bg-blue-600 text-white font-medium">Login</span>
                  </div>
                </div>

                {/* Mock Hero Section */}
                <div className={`p-4 rounded-xl border ${
                  isDarkTheme 
                    ? 'bg-blue-950/30 border-blue-500/20 text-white' 
                    : 'bg-gradient-to-r from-blue-600/10 via-indigo-600/5 to-transparent border-blue-500/15 text-slate-900'
                }`}>
                  <span className="inline-block px-2 py-0.5 rounded-full text-[9px] font-semibold bg-blue-500/10 text-blue-600 dark:text-blue-400 mb-1.5">
                    🚀 Next-Gen Digital Platform
                  </span>
                  <h4 className={`text-sm font-extrabold leading-tight ${isDarkTheme ? 'text-white' : 'text-slate-900'}`}>
                    Transformasi Bisnis Lebih Cepat dengan AI
                  </h4>
                  <p className={`text-[11px] mt-1 max-w-sm line-clamp-2 ${isDarkTheme ? 'text-slate-400' : 'text-slate-500'}`}>
                    Otomasi layanan pelanggan, manajemen pengetahuan, dan komunikasi 24/7 tanpa henti.
                  </p>
                </div>

                {/* Mock Content Cards */}
                <div className="grid grid-cols-3 gap-2.5">
                  <div className={`p-2.5 rounded-lg border ${
                    isDarkTheme ? 'bg-slate-900/90 border-white/10 text-slate-200' : 'bg-white border-slate-200/70 text-slate-800'
                  }`}>
                    <div className="w-6 h-6 rounded bg-emerald-500/10 text-emerald-500 flex items-center justify-center text-[10px] font-bold mb-1">✓</div>
                    <div className={`text-[10px] font-bold ${isDarkTheme ? 'text-slate-200' : 'text-slate-800'}`}>99.9% Uptime</div>
                    <div className="text-[9px] text-slate-400">Handal & Teruji</div>
                  </div>
                  <div className={`p-2.5 rounded-lg border ${
                    isDarkTheme ? 'bg-slate-900/90 border-white/10 text-slate-200' : 'bg-white border-slate-200/70 text-slate-800'
                  }`}>
                    <div className="w-6 h-6 rounded bg-blue-500/10 text-blue-500 flex items-center justify-center text-[10px] font-bold mb-1">⚡</div>
                    <div className={`text-[10px] font-bold ${isDarkTheme ? 'text-slate-200' : 'text-slate-800'}`}>&lt; 1s Response</div>
                    <div className="text-[9px] text-slate-400">Instan & Akurat</div>
                  </div>
                  <div className={`p-2.5 rounded-lg border ${
                    isDarkTheme ? 'bg-slate-900/90 border-white/10 text-slate-200' : 'bg-white border-slate-200/70 text-slate-800'
                  }`}>
                    <div className="w-6 h-6 rounded bg-violet-500/10 text-violet-500 flex items-center justify-center text-[10px] font-bold mb-1">🔒</div>
                    <div className={`text-[10px] font-bold ${isDarkTheme ? 'text-slate-200' : 'text-slate-800'}`}>Bank-Grade</div>
                    <div className="text-[9px] text-slate-400">Enkripsi Aman</div>
                  </div>
                </div>
              </div>

              {/* Floating Chat Bubble Simulation */}
              <div
                className={`absolute bottom-4 ${
                  position === 'bottom-right' ? 'right-4' : 'left-4'
                } flex flex-col ${position === 'bottom-right' ? 'items-end' : 'items-start'} gap-2 z-20`}
              >
                {/* Popover Preview if clicked */}
                {previewChatOpen && (
                  <div className={`w-72 rounded-2xl p-3.5 shadow-2xl text-left border transition-all duration-300 animate-in fade-in slide-in-from-bottom-2 ${
                    isDarkTheme 
                      ? 'bg-[#0D182E] border-blue-500/30 text-white shadow-[0_20px_50px_rgba(0,0,0,0.85)]' 
                      : 'bg-white border-slate-200 text-slate-900 shadow-[0_20px_50px_rgba(0,0,0,0.15)]'
                  }`}>
                    <div className={`flex items-center justify-between pb-2 border-b mb-2.5 ${isDarkTheme ? 'border-white/10' : 'border-slate-100'}`}>
                      <div className="flex items-center gap-2">
                        <div className="relative w-7 h-7 rounded-full bg-blue-600/20 p-0.5 border border-blue-500/30 overflow-hidden flex items-center justify-center">
                          <img 
                            src="/lexa_bot_transparent.png" 
                            alt="LEXA AI" 
                            className="w-full h-full object-contain"
                            onError={(e) => { (e.target as HTMLImageElement).src = '/lexa_icon.png'; }}
                          />
                        </div>
                        <div>
                          <span className={`text-xs font-bold block leading-tight ${isDarkTheme ? 'text-white' : 'text-slate-900'}`}>LEXA AI</span>
                          <span className="text-[9px] text-emerald-500 font-medium flex items-center gap-1">
                            <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse"></span>
                            Online Siap Membantu
                          </span>
                        </div>
                      </div>
                      <button 
                        onClick={() => setPreviewChatOpen(false)}
                        className={`text-xs p-1 rounded-md transition-colors ${isDarkTheme ? 'text-slate-400 hover:text-white' : 'text-slate-400 hover:text-slate-700'}`}
                      >
                        ✕
                      </button>
                    </div>

                    <div className="space-y-2">
                      <div className={`p-2.5 rounded-xl text-[11px] leading-relaxed border ${
                        isDarkTheme 
                          ? 'bg-slate-900/90 text-slate-200 border-white/10' 
                          : 'bg-slate-100 text-slate-800 border-slate-200/60'
                      }`}>
                        Halo! 👋 Selamat datang di layanan kami. Ada informasi produk atau solusi yang ingin Anda tanyakan?
                      </div>
                      <div className="flex flex-wrap gap-1">
                        <span 
                          style={{ borderColor: `${color}50`, color: isDarkTheme ? '#93c5fd' : color }}
                          className={`text-[9px] px-2 py-0.5 rounded-full border cursor-pointer ${isDarkTheme ? 'bg-white/5' : 'bg-blue-50/60'}`}
                        >
                          Info Layanan
                        </span>
                        <span 
                          style={{ borderColor: `${color}50`, color: isDarkTheme ? '#93c5fd' : color }}
                          className={`text-[9px] px-2 py-0.5 rounded-full border cursor-pointer ${isDarkTheme ? 'bg-white/5' : 'bg-blue-50/60'}`}
                        >
                          Hubungi Tim Sales
                        </span>
                      </div>
                    </div>
                  </div>
                )}

                {/* Floating Action Button */}
                <button
                  onClick={() => setPreviewChatOpen(prev => !prev)}
                  style={{ backgroundColor: color }}
                  className="relative group w-12 h-12 rounded-full text-white shadow-xl flex items-center justify-center cursor-pointer hover:scale-105 active:scale-95 transition-all overflow-hidden border-2 border-white/20"
                  title="Klik untuk mencoba simulasi buka/tutup balon obrolan"
                >
                  <img
                    src="/lexa_bot_transparent.png"
                    alt="Chat Bot"
                    className="w-8 h-8 object-contain transition-transform group-hover:scale-110 drop-shadow-md"
                    onError={(e) => {
                      (e.target as HTMLElement).style.display = 'none';
                    }}
                  />
                  <span className="absolute -top-0.5 -right-0.5 w-3 h-3 bg-emerald-400 border-2 border-white dark:border-slate-900 rounded-full"></span>
                </button>
              </div>
            </div>

            <p className="text-[11px] text-slate-400 text-center mt-3">
              {lang === 'id' ? 'Klik tombol bulat di atas untuk mensimulasikan buka/tutup balon obrolan.' : 'Click the circular bubble above to simulate open/close.'}
            </p>
          </div>
        </div>

      </div>

      {/* Tabbed Embed Code Section */}
      <div className="bg-white dark:bg-[#0A1224] rounded-2xl border border-slate-200/80 dark:border-white/5 shadow-xs overflow-hidden">
        <div className="flex items-center gap-1 p-2 bg-slate-50 dark:bg-white/[0.02] border-b border-slate-100 dark:border-white/5 overflow-x-auto">
          <button
            onClick={() => setActiveTab('html')}
            className={`px-4 py-2 rounded-xl text-xs font-semibold transition-all cursor-pointer whitespace-nowrap ${
              activeTab === 'html'
                ? 'bg-[#0066FF] text-white shadow-xs'
                : 'text-slate-600 dark:text-slate-400 hover:bg-slate-200/60 dark:hover:bg-white/5'
            }`}
          >
            {t.tab_html}
          </button>
          <button
            onClick={() => setActiveTab('wordpress')}
            className={`px-4 py-2 rounded-xl text-xs font-semibold transition-all cursor-pointer whitespace-nowrap ${
              activeTab === 'wordpress'
                ? 'bg-[#0066FF] text-white shadow-xs'
                : 'text-slate-600 dark:text-slate-400 hover:bg-slate-200/60 dark:hover:bg-white/5'
            }`}
          >
            {t.tab_wordpress}
          </button>
          <button
            onClick={() => setActiveTab('react')}
            className={`px-4 py-2 rounded-xl text-xs font-semibold transition-all cursor-pointer whitespace-nowrap ${
              activeTab === 'react'
                ? 'bg-[#0066FF] text-white shadow-xs'
                : 'text-slate-600 dark:text-slate-400 hover:bg-slate-200/60 dark:hover:bg-white/5'
            }`}
          >
            {t.tab_react}
          </button>
          <button
            onClick={() => setActiveTab('iframe')}
            className={`px-4 py-2 rounded-xl text-xs font-semibold transition-all cursor-pointer whitespace-nowrap ${
              activeTab === 'iframe'
                ? 'bg-[#0066FF] text-white shadow-xs'
                : 'text-slate-600 dark:text-slate-400 hover:bg-slate-200/60 dark:hover:bg-white/5'
            }`}
          >
            {t.tab_iframe}
          </button>
        </div>

        {loading ? (
          <div className="p-12 text-center text-xs text-slate-400">
            Memuat kode embed...
          </div>
        ) : embedData && (
          <div className="p-5">
            {activeTab === 'html' && (
              <div className="bg-[#060D1E] rounded-xl overflow-hidden border border-white/10">
                <div className="flex items-center justify-between px-5 py-3 border-b border-white/10 bg-white/[0.02]">
                  <span className="text-xs text-slate-400 font-mono">index.html (sebelum &lt;/body&gt;)</span>
                  <CopyButton
                    text={embedData.embed_code}
                    field="html"
                    isCopied={copiedField === 'html'}
                    onCopy={handleCopy}
                  />
                </div>
                <pre className="p-5 text-xs text-emerald-400 font-mono overflow-x-auto leading-relaxed">
                  {embedData.embed_code}
                </pre>
              </div>
            )}

            {activeTab === 'wordpress' && (
              <div className="bg-[#060D1E] rounded-xl overflow-hidden border border-white/10">
                <div className="flex items-center justify-between px-5 py-3 border-b border-white/10 bg-white/[0.02]">
                  <span className="text-xs text-slate-400 font-mono">WordPress WPCode / Theme Footer</span>
                  <CopyButton
                    text={embedData.embed_code}
                    field="wp"
                    isCopied={copiedField === 'wp'}
                    onCopy={handleCopy}
                  />
                </div>
                <pre className="p-5 text-xs text-blue-300 font-mono overflow-x-auto leading-relaxed">
                  {wordpressGuide}
                </pre>
              </div>
            )}

            {activeTab === 'react' && (
              <div className="bg-[#060D1E] rounded-xl overflow-hidden border border-white/10">
                <div className="flex items-center justify-between px-5 py-3 border-b border-white/10 bg-white/[0.02]">
                  <span className="text-xs text-slate-400 font-mono">ChatWidget.tsx (React / Next.js)</span>
                  <CopyButton
                    text={reactSnippet}
                    field="react"
                    isCopied={copiedField === 'react'}
                    onCopy={handleCopy}
                  />
                </div>
                <pre className="p-5 text-xs text-violet-300 font-mono overflow-x-auto leading-relaxed">
                  {reactSnippet}
                </pre>
              </div>
            )}

            {activeTab === 'iframe' && (
              <div className="bg-[#060D1E] rounded-xl overflow-hidden border border-white/10">
                <div className="flex items-center justify-between px-5 py-3 border-b border-white/10 bg-white/[0.02]">
                  <div className="flex items-center gap-2">
                    <span className="text-xs text-slate-400 font-mono">Iframe Fallback</span>
                    <span className="text-[10px] font-mono px-2 py-0.5 rounded-full bg-blue-500/10 text-blue-400 border border-blue-500/20">
                      {position === 'bottom-left' ? 'Kiri Bawah' : 'Kanan Bawah'} • {theme.toUpperCase()}
                    </span>
                  </div>
                  <CopyButton
                    text={dynamicIframeSnippet}
                    field="iframe"
                    isCopied={copiedField === 'iframe'}
                    onCopy={handleCopy}
                  />
                </div>
                <pre className="p-5 text-xs text-amber-300 font-mono overflow-x-auto leading-relaxed">
                  {dynamicIframeSnippet}
                </pre>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
};

export default WidgetSetup;
