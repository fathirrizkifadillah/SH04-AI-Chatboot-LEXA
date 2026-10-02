import { useState, useEffect, useCallback } from 'react';
import { Code, Copy, Check, Globe, Palette, ExternalLink, Info } from 'lucide-react';
import api from '../lib/apiClient';

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

const positions = [
  { value: 'bottom-right', label: 'Kanan Bawah' },
  { value: 'bottom-left', label: 'Kiri Bawah' },
  { value: 'top-right', label: 'Kanan Atas' },
  { value: 'top-left', label: 'Kiri Atas' },
];

const themes = [
  { value: 'dark', label: 'Dark Mode' },
  { value: 'light', label: 'Light Mode' },
  { value: 'auto', label: 'Auto (System)' },
];

interface CopyButtonProps {
  text: string;
  field: string;
  isCopied: boolean;
  onCopy: (text: string, field: string) => void;
}

const CopyButton = ({ text, field, isCopied, onCopy }: CopyButtonProps) => (
  <button
    onClick={() => onCopy(text, field)}
    className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium rounded-lg transition-colors
      bg-white/10 hover:bg-white/20 text-white border border-white/10 cursor-pointer"
  >
    {isCopied ? (
      <>
        <Check className="w-3.5 h-3.5 text-green-400" />
        <span className="text-green-400">Tersalin!</span>
      </>
    ) : (
      <>
        <Copy className="w-3.5 h-3.5" />
        Salin
      </>
    )}
  </button>
);

const WidgetSetup = () => {
  const [embedData, setEmbedData] = useState<EmbedCodeResponse | null>(null);
  const [apiUrl, setApiUrl] = useState('');
  const [position, setPosition] = useState('bottom-right');
  const [color, setColor] = useState('#2563eb');
  const [theme, setTheme] = useState('dark');
  const [copiedField, setCopiedField] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

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

  return (
    <div className="p-6 max-w-5xl">
      <div className="mb-8">
        <h1 className="text-2xl font-bold text-slate-800 dark:text-slate-100">Widget Setup</h1>
        <p className="text-slate-500 dark:text-slate-400">Dapatkan kode embed dan sesuaikan tema serta posisi chat widget di website Anda.</p>
      </div>

      {/* Configuration */}
      <div className="bg-white dark:bg-[#152238] rounded-2xl border border-slate-200 dark:border-slate-800 p-6 shadow-sm mb-6 transition-colors">
        <h2 className="font-semibold text-lg text-slate-800 dark:text-slate-100 mb-4 flex items-center gap-2">
          <Globe className="w-5 h-5 text-blue-600 dark:text-blue-400" />
          Konfigurasi Widget
        </h2>
        
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
          <div>
            <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1.5">API URL (opsional)</label>
            <input
              type="text"
              value={apiUrl}
              onChange={(e) => setApiUrl(e.target.value)}
              placeholder={embedData?.config.api_url || 'https://your-domain.com'}
              className="w-full border border-slate-200 dark:border-slate-700 rounded-xl px-4 py-2.5 text-sm bg-white dark:bg-slate-900 text-slate-900 dark:text-slate-100 focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 outline-none"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1.5">Posisi</label>
            <select
              value={position}
              onChange={(e) => setPosition(e.target.value)}
              className="w-full border border-slate-200 dark:border-slate-700 rounded-xl px-4 py-2.5 text-sm bg-white dark:bg-slate-900 text-slate-900 dark:text-slate-100 focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 outline-none"
            >
              {positions.map((p) => (
                <option key={p.value} value={p.value}>{p.label}</option>
              ))}
            </select>
          </div>

          <div>
            <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1.5">Mode Tampilan Widget</label>
            <select
              value={theme}
              onChange={(e) => setTheme(e.target.value)}
              className="w-full border border-slate-200 dark:border-slate-700 rounded-xl px-4 py-2.5 text-sm bg-white dark:bg-slate-900 text-slate-900 dark:text-slate-100 focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 outline-none"
            >
              {themes.map((t) => (
                <option key={t.value} value={t.value}>{t.label}</option>
              ))}
            </select>
          </div>

          <div>
            <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1.5">Warna Aksen</label>
            <div className="flex items-center gap-3">
              <input
                type="color"
                value={color}
                onChange={(e) => setColor(e.target.value)}
                className="w-10 h-10 rounded-lg border border-slate-200 dark:border-slate-700 cursor-pointer bg-transparent"
              />
              <input
                type="text"
                value={color}
                onChange={(e) => setColor(e.target.value)}
                className="flex-1 border border-slate-200 dark:border-slate-700 rounded-xl px-4 py-2.5 text-sm font-mono bg-white dark:bg-slate-900 text-slate-900 dark:text-slate-100 focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 outline-none"
              />
            </div>
          </div>
        </div>
      </div>

      {/* Embed Code */}
      {loading ? (
        <div className="bg-white dark:bg-[#152238] rounded-2xl border border-slate-200 dark:border-slate-800 p-12 shadow-sm text-center">
          <div className="w-8 h-8 border-4 border-blue-200 dark:border-blue-900 border-t-blue-600 rounded-full animate-spin mx-auto mb-3"></div>
          <p className="text-sm text-slate-500 dark:text-slate-400">Memuat kode embed...</p>
        </div>
      ) : embedData && (
        <div className="space-y-6">
          {/* Primary: Script Tag */}
          <div className="bg-slate-900 rounded-2xl overflow-hidden shadow-lg border border-slate-800">
            <div className="flex items-center justify-between px-6 py-4 border-b border-white/10">
              <div className="flex items-center gap-3">
                <div className="bg-blue-500/20 p-2 rounded-lg">
                  <Code className="w-5 h-5 text-blue-400" />
                </div>
                <div>
                  <h3 className="font-semibold text-white text-sm">Script Tag (Recommended)</h3>
                  <p className="text-xs text-slate-400">Copy & paste ke &lt;head&gt; atau &lt;body&gt; website Anda (Mendukung Dark/Light Mode)</p>
                </div>
              </div>
              <CopyButton text={embedData.embed_code} field="script" isCopied={copiedField === 'script'} onCopy={handleCopy} />
            </div>
            <pre className="px-6 py-5 text-sm text-green-400 font-mono overflow-x-auto leading-relaxed">
              {embedData.embed_code}
            </pre>
          </div>

          {/* Secondary: Iframe Fallback */}
          <div className="bg-white dark:bg-[#152238] rounded-2xl border border-slate-200 dark:border-slate-800 overflow-hidden shadow-sm">
            <div className="flex items-center justify-between px-6 py-4 border-b border-slate-100 dark:border-slate-800">
              <div className="flex items-center gap-3">
                <div className="bg-purple-100 dark:bg-purple-950/40 p-2 rounded-lg">
                  <ExternalLink className="w-5 h-5 text-purple-600 dark:text-purple-400" />
                </div>
                <div>
                  <h3 className="font-semibold text-slate-800 dark:text-slate-100 text-sm">Iframe Embed (Fallback)</h3>
                  <p className="text-xs text-slate-500 dark:text-slate-400">Alternatif jika script tag tidak bisa digunakan</p>
                </div>
              </div>
              <CopyButton text={embedData.iframe_fallback} field="iframe" isCopied={copiedField === 'iframe'} onCopy={handleCopy} />
            </div>
            <pre className="px-6 py-5 text-xs text-slate-600 dark:text-slate-300 font-mono bg-slate-50 dark:bg-slate-900/60 overflow-x-auto leading-relaxed">
              {embedData.iframe_fallback}
            </pre>
          </div>

          {/* JS API */}
          <div className="bg-white dark:bg-[#152238] rounded-2xl border border-slate-200 dark:border-slate-800 overflow-hidden shadow-sm">
            <div className="flex items-center justify-between px-6 py-4 border-b border-slate-100 dark:border-slate-800">
              <div className="flex items-center gap-3">
                <div className="bg-emerald-100 dark:bg-emerald-950/40 p-2 rounded-lg">
                  <Palette className="w-5 h-5 text-emerald-600 dark:text-emerald-400" />
                </div>
                <div>
                  <h3 className="font-semibold text-slate-800 dark:text-slate-100 text-sm">JavaScript API</h3>
                  <p className="text-xs text-slate-500 dark:text-slate-400">Kontrol widget secara programmatically</p>
                </div>
              </div>
              <CopyButton text={embedData.js_api_example} field="jsapi" isCopied={copiedField === 'jsapi'} onCopy={handleCopy} />
            </div>
            <pre className="px-6 py-5 text-xs text-slate-600 dark:text-slate-300 font-mono bg-slate-50 dark:bg-slate-900/60 overflow-x-auto leading-relaxed">
              {embedData.js_api_example}
            </pre>
          </div>

          {/* Info Box */}
          <div className="bg-blue-50 dark:bg-blue-950/30 border border-blue-200 dark:border-blue-900/50 rounded-2xl p-5 flex gap-4">
            <Info className="w-5 h-5 text-blue-600 dark:text-blue-400 shrink-0 mt-0.5" />
            <div className="text-sm text-blue-800 dark:text-blue-300 space-y-1">
              <p className="font-semibold">Cara Penggunaan:</p>
              <ol className="list-decimal list-inside space-y-1 text-blue-700 dark:text-blue-400/90">
                <li>Pilih mode tema (Dark, Light, atau Auto), posisi dan warna aksen yang diinginkan</li>
                <li>Copy <strong>Script Tag</strong> di atas</li>
                <li>Paste ke kode HTML website Anda (di dalam <code>&lt;head&gt;</code> atau sebelum <code>&lt;/body&gt;</code>)</li>
                <li>Widget akan muncul otomatis di halaman website dengan tema yang dipilih</li>
              </ol>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default WidgetSetup;
