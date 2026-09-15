import { useState, useEffect } from 'react';
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
  };
}

const positions = [
  { value: 'bottom-right', label: 'Kanan Bawah' },
  { value: 'bottom-left', label: 'Kiri Bawah' },
  { value: 'top-right', label: 'Kanan Atas' },
  { value: 'top-left', label: 'Kiri Atas' },
];

const WidgetSetup = () => {
  const [embedData, setEmbedData] = useState<EmbedCodeResponse | null>(null);
  const [apiUrl, setApiUrl] = useState('');
  const [position, setPosition] = useState('bottom-right');
  const [color, setColor] = useState('#2563eb');
  const [copiedField, setCopiedField] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  const fetchEmbedCode = async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams({ position, color });
      if (apiUrl) params.set('api_url', apiUrl);
      const data = await api.authGet<EmbedCodeResponse>(`/api/admin/widget/embed-code?${params}`);
      setEmbedData(data);
    } catch (err) {
      console.error('Failed to fetch embed code:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchEmbedCode();
  }, [position, color]);

  const handleCopy = async (text: string, field: string) => {
    await navigator.clipboard.writeText(text);
    setCopiedField(field);
    setTimeout(() => setCopiedField(null), 2000);
  };

  const CopyButton = ({ text, field }: { text: string; field: string }) => (
    <button
      onClick={() => handleCopy(text, field)}
      className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium rounded-lg transition-colors
        bg-white/10 hover:bg-white/20 text-white border border-white/10"
    >
      {copiedField === field ? (
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

  return (
    <div className="p-6 max-w-5xl">
      <div className="mb-8">
        <h1 className="text-2xl font-bold text-slate-800">Widget Setup</h1>
        <p className="text-slate-500">Dapatkan kode embed untuk memasang chat widget di website Anda.</p>
      </div>

      {/* Configuration */}
      <div className="bg-white rounded-2xl border border-slate-200 p-6 shadow-sm mb-6">
        <h2 className="font-semibold text-lg text-slate-800 mb-4 flex items-center gap-2">
          <Globe className="w-5 h-5 text-blue-600" />
          Konfigurasi Widget
        </h2>
        
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1.5">API URL (opsional)</label>
            <input
              type="text"
              value={apiUrl}
              onChange={(e) => setApiUrl(e.target.value)}
              placeholder={embedData?.config.api_url || 'https://your-domain.com'}
              className="w-full border border-slate-200 rounded-xl px-4 py-2.5 text-sm focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 outline-none"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1.5">Posisi</label>
            <select
              value={position}
              onChange={(e) => setPosition(e.target.value)}
              className="w-full border border-slate-200 rounded-xl px-4 py-2.5 text-sm focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 outline-none"
            >
              {positions.map((p) => (
                <option key={p.value} value={p.value}>{p.label}</option>
              ))}
            </select>
          </div>

          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1.5">Warna Aksen</label>
            <div className="flex items-center gap-3">
              <input
                type="color"
                value={color}
                onChange={(e) => setColor(e.target.value)}
                className="w-10 h-10 rounded-lg border border-slate-200 cursor-pointer"
              />
              <input
                type="text"
                value={color}
                onChange={(e) => setColor(e.target.value)}
                className="flex-1 border border-slate-200 rounded-xl px-4 py-2.5 text-sm font-mono focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 outline-none"
              />
            </div>
          </div>
        </div>
      </div>

      {/* Embed Code */}
      {loading ? (
        <div className="bg-white rounded-2xl border border-slate-200 p-12 shadow-sm text-center">
          <div className="w-8 h-8 border-4 border-blue-200 border-t-blue-600 rounded-full animate-spin mx-auto mb-3"></div>
          <p className="text-sm text-slate-500">Memuat kode embed...</p>
        </div>
      ) : embedData && (
        <div className="space-y-6">
          {/* Primary: Script Tag */}
          <div className="bg-slate-900 rounded-2xl overflow-hidden shadow-lg">
            <div className="flex items-center justify-between px-6 py-4 border-b border-white/10">
              <div className="flex items-center gap-3">
                <div className="bg-blue-500/20 p-2 rounded-lg">
                  <Code className="w-5 h-5 text-blue-400" />
                </div>
                <div>
                  <h3 className="font-semibold text-white text-sm">Script Tag (Recommended)</h3>
                  <p className="text-xs text-slate-400">Copy & paste ke &lt;head&gt; atau &lt;body&gt; website Anda</p>
                </div>
              </div>
              <CopyButton text={embedData.embed_code} field="script" />
            </div>
            <pre className="px-6 py-5 text-sm text-green-400 font-mono overflow-x-auto leading-relaxed">
              {embedData.embed_code}
            </pre>
          </div>

          {/* Secondary: Iframe Fallback */}
          <div className="bg-white rounded-2xl border border-slate-200 overflow-hidden shadow-sm">
            <div className="flex items-center justify-between px-6 py-4 border-b border-slate-100">
              <div className="flex items-center gap-3">
                <div className="bg-purple-100 p-2 rounded-lg">
                  <ExternalLink className="w-5 h-5 text-purple-600" />
                </div>
                <div>
                  <h3 className="font-semibold text-slate-800 text-sm">Iframe Embed (Fallback)</h3>
                  <p className="text-xs text-slate-500">Alternatif jika script tag tidak bisa digunakan</p>
                </div>
              </div>
              <CopyButton text={embedData.iframe_fallback} field="iframe" />
            </div>
            <pre className="px-6 py-5 text-xs text-slate-600 font-mono bg-slate-50 overflow-x-auto leading-relaxed">
              {embedData.iframe_fallback}
            </pre>
          </div>

          {/* JS API */}
          <div className="bg-white rounded-2xl border border-slate-200 overflow-hidden shadow-sm">
            <div className="flex items-center justify-between px-6 py-4 border-b border-slate-100">
              <div className="flex items-center gap-3">
                <div className="bg-emerald-100 p-2 rounded-lg">
                  <Palette className="w-5 h-5 text-emerald-600" />
                </div>
                <div>
                  <h3 className="font-semibold text-slate-800 text-sm">JavaScript API</h3>
                  <p className="text-xs text-slate-500">Kontrol widget secara programmatically</p>
                </div>
              </div>
              <CopyButton text={embedData.js_api_example} field="jsapi" />
            </div>
            <pre className="px-6 py-5 text-xs text-slate-600 font-mono bg-slate-50 overflow-x-auto leading-relaxed">
              {embedData.js_api_example}
            </pre>
          </div>

          {/* Info Box */}
          <div className="bg-blue-50 border border-blue-200 rounded-2xl p-5 flex gap-4">
            <Info className="w-5 h-5 text-blue-600 shrink-0 mt-0.5" />
            <div className="text-sm text-blue-800 space-y-1">
              <p className="font-semibold">Cara Penggunaan:</p>
              <ol className="list-decimal list-inside space-y-1 text-blue-700">
                <li>Pilih posisi dan warna yang diinginkan</li>
                <li>Copy <strong>Script Tag</strong> di atas</li>
                <li>Paste ke kode HTML website Anda (di dalam <code>&lt;head&gt;</code> atau sebelum <code>&lt;/body&gt;</code>)</li>
                <li>Widget akan muncul otomatis di halaman website</li>
              </ol>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default WidgetSetup;
