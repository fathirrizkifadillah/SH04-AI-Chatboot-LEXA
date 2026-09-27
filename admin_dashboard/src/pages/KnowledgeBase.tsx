import { useState, useEffect, useRef, ChangeEvent } from 'react';
import { UploadCloud, FileText, Trash2, RefreshCw, CheckCircle, AlertTriangle, Download, ShieldAlert } from 'lucide-react';
import api, { ApiError } from '../lib/apiClient';
import type { KBFile } from '../types/api';

interface SyncStatus {
  type: 'success' | 'warning' | 'error';
  message: string;
}

const KnowledgeBase = () => {
  const [files, setFiles] = useState<KBFile[]>([]);
  const [isUploading, setIsUploading] = useState(false);
  const [isSyncing, setIsSyncing] = useState(false);
  const [syncStatus, setSyncStatus] = useState<SyncStatus | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const pollIntervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const currentUser = (() => {
    try {
      const u = localStorage.getItem('lexa_admin_user');
      return u ? JSON.parse(u) : null;
    } catch {
      return null;
    }
  })();
  const canManageKB = currentUser?.role === 'Super Admin' || currentUser?.role === 'Editor (Knowledge Base)';

  const fetchFiles = () => {
    api.authGet<KBFile[]>('/api/admin/kb/files')
      .then(data => setFiles(data))
      .catch(err => console.error(err));
  };

  useEffect(() => {
    fetchFiles();
    return () => {
      if (pollIntervalRef.current) clearInterval(pollIntervalRef.current);
    };
  }, []);

  const handleFileUpload = async (e: ChangeEvent<HTMLInputElement>) => {
    if (!canManageKB) return;
    const file = e.target.files?.[0];
    if (!file) return;

    if (!file.name.endsWith('.md') && !file.name.endsWith('.txt') && !file.name.endsWith('.pdf')) {
      alert('Hanya file .txt, .md, atau .pdf yang didukung');
      return;
    }

    const formData = new FormData();
    formData.append('file', file);

    setIsUploading(true);
    try {
      await api.authUpload('/api/admin/kb/upload', formData);
      fetchFiles();
      setSyncStatus({ type: 'warning', message: 'Ada dokumen baru. Harap lakukan sinkronisasi (Re-Index).' });
    } catch (err) {
      if (err instanceof ApiError) {
        alert(`Gagal: ${err.message}`);
      } else {
        console.error(err);
        alert('Terjadi kesalahan saat mengunggah file.');
      }
    } finally {
      setIsUploading(false);
      if (fileInputRef.current) fileInputRef.current.value = '';
    }
  };

  const handleDelete = async (filename: string) => {
    if (!canManageKB) return;
    if (!confirm(`Hapus dokumen ${filename}?`)) return;
    
    try {
      await api.authDelete(`/api/admin/kb/files/${filename}`);
      fetchFiles();
      setSyncStatus({ type: 'warning', message: 'Dokumen dihapus. Harap lakukan sinkronisasi (Re-Index).' });
    } catch (err) {
      console.error(err);
    }
  };

  const handleReindex = async () => {
    if (!canManageKB) return;
    setIsSyncing(true);
    setSyncStatus({ type: 'warning', message: 'Memulai proses sinkronisasi di background...' });
    if (pollIntervalRef.current) clearInterval(pollIntervalRef.current);

    try {
      await api.authPost('/api/admin/kb/reindex');
      pollIntervalRef.current = setInterval(async () => {
        try {
          const res = await api.authGet<{ state: string; message: string }>('/api/admin/kb/reindex/status');
          if (res.state === 'success') {
            if (pollIntervalRef.current) clearInterval(pollIntervalRef.current);
            setIsSyncing(false);
            setSyncStatus({ type: 'success', message: res.message || 'Knowledge base berhasil diperbarui.' });
            fetchFiles();
          } else if (res.state === 'failed') {
            if (pollIntervalRef.current) clearInterval(pollIntervalRef.current);
            setIsSyncing(false);
            setSyncStatus({ type: 'error', message: res.message || 'Gagal membangun index baru.' });
          } else {
            setSyncStatus({ type: 'warning', message: res.message || 'Sedang membangun index baru...' });
          }
        } catch {
          // ignore transient errors
        }
      }, 1500);
    } catch (err) {
      console.error(err);
      setIsSyncing(false);
      setSyncStatus({ type: 'error', message: 'Gagal melakukan sinkronisasi.' });
    }
  };

  const handleExport = async () => {
    const exportApiUrl = window.__LEXA_CONFIG__?.apiUrl || window.location.origin;
    try {
      const res = await fetch(`${exportApiUrl}/api/admin/kb/export`, {
        method: 'POST',
        credentials: 'include',
      });
      if (!res.ok) throw new Error('Export failed');
      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = 'lexa_kb_export.zip';
      a.click();
      URL.revokeObjectURL(url);
    } catch (err) {
      console.error(err);
      alert('Gagal mengunduh knowledge base.');
    }
  };

  return (
    <div className="p-6 space-y-6">
      <div>
        <h1 className="text-xl font-bold text-slate-900 dark:text-slate-100">Knowledge Base Management</h1>
        <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">Kelola dokumen sumber pengetahuan untuk pelatihan RAG Chatbot LEXA.</p>
      </div>

      {!canManageKB && (
        <div className="p-3.5 bg-amber-50 dark:bg-amber-950/40 border border-amber-200 dark:border-amber-800 rounded-xl flex items-center gap-2.5 text-xs text-amber-800 dark:text-amber-300">
          <ShieldAlert className="w-4 h-4 shrink-0" />
          <span>
            Peran akun Anda adalah <strong>CS Agent</strong>. Anda hanya dapat melihat dokumen referensi. Hak mengunggah, menghapus, dan sinkronisasi (re-index) hanya dapat dilakukan oleh <strong>Editor KB</strong> dan <strong>Super Admin</strong>.
          </span>
        </div>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        
        {/* Kiri: Daftar File & Status */}
        <div className="lg:col-span-2 space-y-6">
          <div className="bg-white dark:bg-slate-800/80 rounded-2xl shadow-sm border border-slate-200/80 dark:border-slate-700/80 p-6 transition-colors">
            <h2 className="font-semibold text-sm text-slate-900 dark:text-slate-100 mb-4">
              Dokumen Terindeks ({files.length})
            </h2>
            
            <div className="space-y-2.5">
              {files.length === 0 ? (
                <div className="text-center p-8 border-2 border-dashed border-slate-200 dark:border-slate-700 rounded-xl text-slate-400">
                  <FileText className="w-10 h-10 mx-auto mb-2 text-slate-300 dark:text-slate-600" />
                  <p className="text-xs">Belum ada dokumen referensi.</p>
                </div>
              ) : (
                files.map((file, i) => (
                  <div key={i} className="flex items-center justify-between p-3.5 bg-slate-50 dark:bg-slate-900/60 border border-slate-200/60 dark:border-slate-700/60 rounded-xl hover:border-slate-300 dark:hover:border-slate-600 transition-colors">
                    <div className="flex items-center gap-3 min-w-0">
                      <div className="bg-blue-100 dark:bg-blue-950/50 p-2 rounded-lg text-blue-600 dark:text-blue-400 shrink-0">
                        <FileText className="w-4 h-4" />
                      </div>
                      <div className="min-w-0">
                        <p className="font-medium text-slate-800 dark:text-slate-200 text-xs truncate">{file.filename}</p>
                        <p className="text-[10px] text-slate-400">{(file.size / 1024).toFixed(1)} KB</p>
                      </div>
                    </div>
                    {canManageKB && (
                      <button 
                        onClick={() => handleDelete(file.filename)}
                        className="p-1.5 text-slate-400 hover:text-red-600 hover:bg-red-50 dark:hover:bg-red-950/30 rounded-lg transition-colors shrink-0"
                        title="Hapus Dokumen"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    )}
                  </div>
                ))
              )}
            </div>
          </div>
        </div>

        {/* Kanan: Aksi (Upload & Sync) */}
        <div className="space-y-6">
          
          {canManageKB && (
            <div className="bg-white dark:bg-slate-800/80 rounded-2xl shadow-sm border border-slate-200/80 dark:border-slate-700/80 p-6 transition-colors">
              <h2 className="font-semibold text-sm text-slate-900 dark:text-slate-100 mb-4">Unggah Dokumen Baru</h2>
              
              <div 
                className="border-2 border-dashed border-blue-200 dark:border-blue-900/50 bg-blue-50/40 dark:bg-blue-950/20 hover:bg-blue-50 dark:hover:bg-blue-950/40 p-6 rounded-xl text-center cursor-pointer transition-colors relative"
                onClick={() => fileInputRef.current?.click()}
              >
                {isUploading ? (
                  <div className="animate-pulse">
                    <div className="w-8 h-8 border-2 border-blue-200 border-t-blue-600 rounded-full animate-spin mx-auto mb-2"></div>
                    <p className="text-xs text-blue-600 font-medium">Sedang mengunggah...</p>
                  </div>
                ) : (
                  <>
                    <UploadCloud className="w-8 h-8 text-blue-500 mx-auto mb-2" />
                    <p className="text-xs font-semibold text-blue-700 dark:text-blue-400">Pilih Berkas (PDF, TXT, MD)</p>
                    <p className="text-[10px] text-slate-400 mt-1">atau klik untuk membuka file browser</p>
                  </>
                )}
                <input 
                  type="file" 
                  ref={fileInputRef} 
                  className="hidden" 
                  accept=".txt,.md,.pdf"
                  onChange={handleFileUpload}
                />
              </div>
            </div>
          )}

          <div className="bg-slate-900 dark:bg-slate-950 rounded-2xl shadow-md p-6 border border-slate-800 relative overflow-hidden">
            <h2 className="font-semibold text-sm text-white mb-1.5 relative z-10">Sinkronisasi Indeks RAG</h2>
            <p className="text-xs text-slate-400 mb-5 relative z-10">
              Latih ulang vector database Chroma menggunakan seluruh dokumen yang ada pada daftar.
            </p>
            
            {syncStatus && (
              <div className={`p-3 rounded-xl mb-4 text-xs font-medium flex gap-2 ${
                syncStatus.type === 'success' ? 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/30' :
                syncStatus.type === 'warning' ? 'bg-amber-500/20 text-amber-300 border border-amber-500/30' :
                'bg-red-500/20 text-red-300 border border-red-500/30'
              }`}>
                {syncStatus.type === 'success' ? <CheckCircle className="w-4 h-4 shrink-0" /> : <AlertTriangle className="w-4 h-4 shrink-0" />}
                <span>{syncStatus.message}</span>
              </div>
            )}

            <div className="space-y-2.5">
              <button
                onClick={handleExport}
                className="w-full py-2 bg-white/10 hover:bg-white/20 text-white text-xs font-medium rounded-xl transition-colors flex items-center justify-center gap-1.5 border border-white/10"
                title="Download semua dokumen sebagai ZIP"
              >
                <Download className="w-3.5 h-3.5" /> Unduh Arsip Dokumen (ZIP)
              </button>

              {canManageKB && (
                <button 
                  onClick={handleReindex}
                  disabled={isSyncing}
                  className="w-full py-2.5 bg-blue-600 hover:bg-blue-500 disabled:bg-slate-800 text-white text-xs font-semibold rounded-xl transition-colors flex items-center justify-center gap-1.5"
                >
                  <RefreshCw className={`w-3.5 h-3.5 ${isSyncing ? 'animate-spin' : ''}`} />
                  {isSyncing ? 'Sedang Memproses Index...' : 'Sinkronisasi Pengetahuan'}
                </button>
              )}
            </div>
          </div>

        </div>

      </div>
    </div>
  );
};

export default KnowledgeBase;
