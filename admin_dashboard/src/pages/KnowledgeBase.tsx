import { useState, useEffect, useRef, useMemo, ChangeEvent } from 'react';
import { useSearchParams } from 'react-router-dom';
import { 
  UploadCloud, FileText, Trash2, RefreshCw, CheckCircle, AlertTriangle, 
  Download, ShieldAlert, Plus, Edit3, Eye, Search, X, Check, Save, 
  Sparkles, BookOpen
} from 'lucide-react';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import api, { ApiError, API_URL } from '../lib/apiClient';
import type { KBFile } from '../types/api';

interface SyncStatus {
  type: 'success' | 'warning' | 'error';
  message: string;
}

const KnowledgeBase = () => {
  const [searchParams, setSearchParams] = useSearchParams();
  const [files, setFiles] = useState<KBFile[]>([]);
  const [searchFilter, setSearchFilter] = useState('');
  const [isUploading, setIsUploading] = useState(false);
  const [isSyncing, setIsSyncing] = useState(false);
  const [syncStatus, setSyncStatus] = useState<SyncStatus | null>(null);
  const [isExporting, setIsExporting] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const pollIntervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

  // Create Modal State
  const [isCreateOpen, setIsCreateOpen] = useState(false);
  const [newTitle, setNewTitle] = useState('');
  const [newCategory, setNewCategory] = useState('FAQ & Tanya Jawab');
  const [newContent, setNewContent] = useState('');
  const [isCreating, setIsCreating] = useState(false);
  const [createPreview, setCreatePreview] = useState(false);

  // Edit / View Modal State
  const [isEditOpen, setIsEditOpen] = useState(false);
  const [selectedFile, setSelectedFile] = useState<KBFile | null>(null);
  const [fileContent, setFileContent] = useState('');
  const [isLoadingContent, setIsLoadingContent] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [editTab, setEditTab] = useState<'edit' | 'preview'>('edit');
  const [saveSuccessNotice, setSaveSuccessNotice] = useState(false);

  const currentUser = (() => {
    try {
      const u = sessionStorage.getItem('lexa_admin_user');
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

  // Check if query parameter exists (e.g. redirected from Analytics "+ Tambah ke KB")
  useEffect(() => {
    const queryParam = searchParams.get('query');
    if (queryParam) {
      setNewTitle(`Jawaban: ${queryParam.slice(0, 50)}`);
      setNewCategory('FAQ & Tanya Jawab');
      setNewContent(
`# Tanya Jawab: ${queryParam}

## Pertanyaan Pengunjung:
"${queryParam}"

## Jawaban Resmi:
Tuliskan panduan atau informasi lengkap di sini agar AI dapat menjawab pertanyaan pengunjung secara akurat.

### Poin Penting:
- Layanan / Produk: 
- Prosedur / Ketentuan: 
- Narahubung / Dukungan: 
`
      );
      setIsCreateOpen(true);
      // Remove param from URL without reload
      setSearchParams({}, { replace: true });
    }
  }, [searchParams, setSearchParams]);

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
      setSyncStatus({ type: 'warning', message: 'Dokumen baru diunggah. Silakan klik "Sinkronisasi Pengetahuan" agar langsung aktif di AI.' });
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

  const handleDelete = async (filename: string, isCore?: boolean) => {
    if (!canManageKB) return;
    if (isCore) {
      alert('Dokumen utama (Company Profile) dilindungi sistem dan tidak dapat dihapus.');
      return;
    }
    if (!confirm(`Hapus dokumen "${filename}" secara permanen dari Knowledge Base?`)) return;
    
    try {
      await api.authDelete(`/api/admin/kb/files/${filename}`);
      fetchFiles();
      setSyncStatus({ type: 'warning', message: `Dokumen "${filename}" dihapus. Harap sinkronisasi ulang RAG.` });
    } catch (err) {
      console.error(err);
      alert('Gagal menghapus dokumen.');
    }
  };

  const handleCreateDocument = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newTitle.trim() || !newContent.trim()) {
      alert('Judul dan isi konten dokumen tidak boleh kosong.');
      return;
    }

    setIsCreating(true);
    try {
      await api.authPost('/api/admin/kb/create', {
        title: newTitle.trim(),
        category: newCategory,
        content: newContent.trim(),
      });
      setIsCreateOpen(false);
      setNewTitle('');
      setNewContent('');
      fetchFiles();
      setSyncStatus({ 
        type: 'warning', 
        message: 'Dokumen baru berhasil dibuat! Tekan tombol "Sinkronisasi Pengetahuan" untuk memperbarui indeks vektor AI.' 
      });
    } catch (err) {
      console.error(err);
      alert('Gagal membuat dokumen baru.');
    } finally {
      setIsCreating(false);
    }
  };

  const handleOpenEditModal = async (file: KBFile) => {
    setSelectedFile(file);
    setIsEditOpen(true);
    setIsLoadingContent(true);
    setEditTab('edit');
    setSaveSuccessNotice(false);

    try {
      const data = await api.authGet<{ filename: string; content: string; size: number; is_core: boolean }>(`/api/admin/kb/files/${file.filename}`);
      setFileContent(data.content || '');
    } catch (err) {
      console.error(err);
      alert('Gagal memuat isi dokumen.');
      setIsEditOpen(false);
    } finally {
      setIsLoadingContent(false);
    }
  };

  const handleSaveFileContent = async () => {
    if (!selectedFile) return;
    setIsSaving(true);
    try {
      await api.authPut(`/api/admin/kb/files/${selectedFile.filename}`, {
        content: fileContent,
      });
      setSaveSuccessNotice(true);
      setTimeout(() => setSaveSuccessNotice(false), 3000);
      fetchFiles();
      setSyncStatus({ 
        type: 'warning', 
        message: `Isi dokumen "${selectedFile.filename}" berhasil diperbarui. Silakan lakukan sinkronisasi.` 
      });
    } catch (err) {
      console.error(err);
      alert('Gagal menyimpan perubahan dokumen.');
    } finally {
      setIsSaving(false);
    }
  };

  const handleReindex = async () => {
    if (!canManageKB) return;
    setIsSyncing(true);
    setSyncStatus({ type: 'warning', message: 'Memulai proses sinkronisasi RAG di background...' });
    if (pollIntervalRef.current) clearInterval(pollIntervalRef.current);

    try {
      await api.authPost('/api/admin/kb/reindex');
      pollIntervalRef.current = setInterval(async () => {
        try {
          const res = await api.authGet<{ state: string; message: string }>('/api/admin/kb/reindex/status');
          if (res.state === 'success') {
            if (pollIntervalRef.current) clearInterval(pollIntervalRef.current);
            setIsSyncing(false);
            setSyncStatus({ type: 'success', message: res.message || 'Knowledge base berhasil diperbarui dan siap digunakan AI.' });
            fetchFiles();
          } else if (res.state === 'failed') {
            if (pollIntervalRef.current) clearInterval(pollIntervalRef.current);
            setIsSyncing(false);
            setSyncStatus({ type: 'error', message: res.message || 'Gagal membangun index baru.' });
          } else {
            setSyncStatus({ type: 'warning', message: res.message || 'Sedang memproses embedding dokumen...' });
          }
        } catch {
          // ignore transient poll errors
        }
      }, 1500);
    } catch (err) {
      console.error(err);
      setIsSyncing(false);
      setSyncStatus({ type: 'error', message: 'Gagal melakukan sinkronisasi.' });
    }
  };

  const handleExport = async () => {
    setIsExporting(true);
    try {
      const token = sessionStorage.getItem('lexa_admin_token');
      const headers: Record<string, string> = {
        'ngrok-skip-browser-warning': 'true',
      };
      if (token) {
        headers['Authorization'] = `Bearer ${token}`;
      }

      const res = await fetch(`${API_URL}/api/admin/kb/export`, {
        method: 'POST',
        headers,
        credentials: 'include',
      });

      if (!res.ok) {
        let errMsg = `Status ${res.status}`;
        try {
          const errData = await res.json();
          errMsg = errData.detail || errMsg;
        } catch {}
        throw new Error(errMsg);
      }

      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = 'lexa_kb_export.zip';
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
    } catch (err: any) {
      console.error('KB Export Error:', err);
      alert(`Gagal mengunduh knowledge base: ${err.message || 'Terjadi kesalahan'}`);
    } finally {
      setIsExporting(false);
    }
  };

  const filteredFiles = useMemo(() => {
    if (!searchFilter.trim()) return files;
    const q = searchFilter.toLowerCase();
    return files.filter(f => f.filename.toLowerCase().includes(q));
  }, [files, searchFilter]);

  return (
    <div className="p-6 space-y-6 max-w-7xl mx-auto pb-16">
      {/* Header */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 pb-2 border-b border-slate-200/80 dark:border-slate-800/80">
        <div>
          <div className="flex items-center gap-2">
            <h1 className="text-2xl font-bold tracking-tight text-slate-900 dark:text-white">
              Knowledge Base Management
            </h1>
            <span className="px-2.5 py-0.5 rounded-full text-xs font-semibold bg-blue-500/10 text-blue-600 dark:text-blue-400 border border-blue-500/20">
              RAG Engine
            </span>
          </div>
          <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">
            Pusat penyimpanan dokumen referensi AI LEXA. Semua informasi di sini digunakan model untuk menjawab pengunjung secara akurat tanpa halusinasi.
          </p>
        </div>

        {canManageKB && (
          <div className="flex items-center gap-2.5">
            <button
              onClick={() => setIsCreateOpen(true)}
              className="px-4 py-2 bg-[#0066FF] hover:bg-[#0052CC] text-white text-xs font-semibold rounded-xl transition-all shadow-sm flex items-center gap-1.5 cursor-pointer active:scale-95"
            >
              <Plus className="w-4 h-4" />
              <span>Buat Dokumen Baru</span>
            </button>
          </div>
        )}
      </div>

      {!canManageKB && (
        <div className="p-3.5 bg-amber-50 dark:bg-amber-950/40 border border-amber-200 dark:border-amber-800 rounded-xl flex items-center gap-2.5 text-xs text-amber-800 dark:text-amber-300">
          <ShieldAlert className="w-4 h-4 shrink-0" />
          <span>
            Peran akun Anda adalah <strong>CS Agent</strong>. Anda dapat melihat dokumen referensi. Hak membuat, mengedit, menghapus, dan sinkronisasi (re-index) hanya dapat dilakukan oleh <strong>Editor KB</strong> dan <strong>Super Admin</strong>.
          </span>
        </div>
      )}

      {/* Main Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        
        {/* Left Column: Documents Directory (8 cols) */}
        <div className="lg:col-span-8 space-y-4">
          <div className="bg-white dark:bg-[#0A1224] rounded-2xl shadow-xs border border-slate-200/80 dark:border-white/5 p-5">
            
            {/* Top Toolbar */}
            <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 mb-4">
              <div className="flex items-center gap-2">
                <BookOpen className="w-4 h-4 text-[#0066FF]" />
                <h2 className="font-bold text-sm text-slate-900 dark:text-white">
                  Daftar Dokumen Aktif ({filteredFiles.length} dari {files.length})
                </h2>
              </div>

              <div className="flex items-center gap-2 w-full sm:w-auto">
                <div className="relative flex-1 sm:w-56">
                  <Search className="w-3.5 h-3.5 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
                  <input
                    type="text"
                    value={searchFilter}
                    onChange={(e) => setSearchFilter(e.target.value)}
                    placeholder="Cari nama dokumen..."
                    className="w-full pl-8 pr-3 py-1.5 text-xs rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-900 text-slate-900 dark:text-slate-100 outline-none focus:border-[#0066FF]"
                  />
                  {searchFilter && (
                    <button 
                      onClick={() => setSearchFilter('')}
                      className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 text-xs"
                    >
                      ✕
                    </button>
                  )}
                </div>

                {files.length > 0 && (
                  <button
                    onClick={handleExport}
                    disabled={isExporting}
                    className="px-3 py-1.5 bg-slate-100 hover:bg-slate-200 dark:bg-white/5 dark:hover:bg-white/10 text-slate-700 dark:text-slate-300 text-xs font-semibold rounded-xl transition-colors flex items-center gap-1.5 border border-slate-200 dark:border-white/10 shrink-0 cursor-pointer disabled:opacity-50"
                    title="Unduh seluruh dokumen sebagai file ZIP"
                  >
                    {isExporting ? (
                      <>
                        <RefreshCw className="w-3.5 h-3.5 animate-spin text-[#0066FF]" />
                        <span>Mengunduh...</span>
                      </>
                    ) : (
                      <>
                        <Download className="w-3.5 h-3.5" />
                        <span>ZIP</span>
                      </>
                    )}
                  </button>
                )}
              </div>
            </div>

            {/* Documents List */}
            <div className="space-y-2.5">
              {filteredFiles.length === 0 ? (
                <div className="text-center p-10 border-2 border-dashed border-slate-200 dark:border-white/10 rounded-xl text-slate-400">
                  <FileText className="w-10 h-10 mx-auto mb-2 text-slate-300 dark:text-slate-600" />
                  <p className="text-xs font-semibold text-slate-700 dark:text-slate-300">
                    {searchFilter ? 'Tidak ada dokumen yang cocok dengan pencarian.' : 'Belum ada dokumen referensi.'}
                  </p>
                  <p className="text-[11px] text-slate-400 mt-1">
                    {canManageKB ? 'Klik tombol "+ Buat Dokumen Baru" atau unggah berkas di samping.' : 'Hubungi Super Admin untuk menambahkan materi pengetahuan.'}
                  </p>
                </div>
              ) : (
                filteredFiles.map((file, i) => (
                  <div 
                    key={i} 
                    className="flex items-center justify-between p-3.5 bg-slate-50 dark:bg-white/[0.02] border border-slate-200/60 dark:border-white/5 rounded-xl hover:border-blue-500/40 dark:hover:border-blue-500/40 transition-all group"
                  >
                    <div 
                      onClick={() => handleOpenEditModal(file)}
                      className="flex items-center gap-3 min-w-0 cursor-pointer flex-1"
                    >
                      <div className={`p-2 rounded-xl shrink-0 ${file.is_core ? 'bg-amber-500/10 text-amber-600 dark:text-amber-400 border border-amber-500/20' : 'bg-blue-500/10 text-[#0066FF] border border-blue-500/20'}`}>
                        <FileText className="w-4 h-4" />
                      </div>
                      <div className="min-w-0">
                        <div className="flex items-center gap-2">
                          <p className="font-semibold text-slate-900 dark:text-slate-100 text-xs truncate group-hover:text-[#0066FF] transition-colors">
                            {file.filename}
                          </p>
                          {file.is_core && (
                            <span className="px-2 py-0.5 rounded-full text-[9px] font-semibold bg-amber-500/10 text-amber-600 dark:text-amber-400 border border-amber-500/20 shrink-0">
                              Dokumen Inti
                            </span>
                          )}
                        </div>
                        <div className="flex items-center gap-3 text-[10px] text-slate-400 mt-0.5 font-mono">
                          <span>{(file.size / 1024).toFixed(1)} KB</span>
                          {file.last_modified && (
                            <span>• {new Date(file.last_modified).toLocaleDateString('id-ID')}</span>
                          )}
                        </div>
                      </div>
                    </div>

                    <div className="flex items-center gap-1 shrink-0 ml-3">
                      <button
                        onClick={() => handleOpenEditModal(file)}
                        className="p-1.5 text-slate-500 hover:text-[#0066FF] hover:bg-blue-50 dark:hover:bg-blue-950/40 rounded-lg transition-colors cursor-pointer"
                        title={canManageKB ? 'Lihat & Edit Dokumen' : 'Lihat Isi Dokumen'}
                      >
                        {canManageKB ? <Edit3 className="w-3.5 h-3.5" /> : <Eye className="w-3.5 h-3.5" />}
                      </button>

                      {canManageKB && !file.is_core && (
                        <button 
                          onClick={() => handleDelete(file.filename, file.is_core)}
                          className="p-1.5 text-slate-400 hover:text-rose-600 hover:bg-rose-50 dark:hover:bg-rose-950/30 rounded-lg transition-colors cursor-pointer"
                          title="Hapus Dokumen"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      )}
                    </div>
                  </div>
                ))
              )}
            </div>
          </div>
        </div>

        {/* Right Column: Actions (Upload & Re-index RAG) (4 cols) */}
        <div className="lg:col-span-4 space-y-5">
          
          {/* Quick Create Prompt Card */}
          {canManageKB && (
            <div className="bg-gradient-to-br from-blue-600 to-indigo-700 rounded-2xl p-5 text-white shadow-lg space-y-3">
              <div className="flex items-center gap-2">
                <Sparkles className="w-4 h-4 text-amber-300" />
                <h3 className="font-bold text-sm">Pengetahuan Instan</h3>
              </div>
              <p className="text-xs text-blue-100 leading-relaxed">
                Tulis artikel FAQ atau aturan bisnis baru langsung di dashboard tanpa perlu membuat file manual di komputer.
              </p>
              <button
                onClick={() => setIsCreateOpen(true)}
                className="w-full py-2 bg-white text-[#0066FF] font-semibold text-xs rounded-xl shadow-sm hover:bg-blue-50 active:scale-95 transition-all flex items-center justify-center gap-1.5 cursor-pointer"
              >
                <Plus className="w-3.5 h-3.5" />
                <span>+ Buat Dokumen Teks Baru</span>
              </button>
            </div>
          )}

          {/* Upload File Card */}
          {canManageKB && (
            <div className="bg-white dark:bg-[#0A1224] rounded-2xl shadow-xs border border-slate-200/80 dark:border-white/5 p-5 transition-colors">
              <h2 className="font-bold text-sm text-slate-900 dark:text-white mb-2 flex items-center gap-1.5">
                <UploadCloud className="w-4 h-4 text-[#0066FF]" />
                <span>Unggah Berkas Eksternal</span>
              </h2>
              <p className="text-[11px] text-slate-500 dark:text-slate-400 mb-3">
                Mendukung berkas teks Markdown (.md), Plain Text (.txt), atau Dokumen PDF.
              </p>
              
              <div 
                className="border-2 border-dashed border-blue-200 dark:border-blue-900/50 bg-blue-50/40 dark:bg-blue-950/20 hover:bg-blue-50/80 dark:hover:bg-blue-950/40 p-5 rounded-xl text-center cursor-pointer transition-colors relative"
                onClick={() => fileInputRef.current?.click()}
              >
                {isUploading ? (
                  <div className="py-2">
                    <div className="w-6 h-6 border-2 border-blue-200 border-t-blue-600 rounded-full animate-spin mx-auto mb-2"></div>
                    <p className="text-xs text-blue-600 font-semibold">Mengunggah berkas...</p>
                  </div>
                ) : (
                  <>
                    <UploadCloud className="w-7 h-7 text-blue-500 mx-auto mb-1.5" />
                    <p className="text-xs font-semibold text-blue-700 dark:text-blue-400">Pilih Berkas (.MD / .TXT / .PDF)</p>
                    <p className="text-[10px] text-slate-400 mt-0.5">klik untuk membuka file browser</p>
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

          {/* Re-index RAG ChromaDB Card */}
          <div className="bg-[#0A1224] text-white rounded-2xl shadow-md p-5 border border-white/10 relative overflow-hidden">
            <div className="flex items-center gap-2 mb-2">
              <RefreshCw className="w-4 h-4 text-emerald-400" />
              <h2 className="font-bold text-sm text-white">Sinkronisasi Indeks RAG</h2>
            </div>
            <p className="text-xs text-slate-300 mb-4 leading-relaxed">
              Setelah dokumen dibuat, diubah, atau dihapus, klik tombol di bawah agar vector database (ChromaDB) memperbarui data embedding AI.
            </p>
            
            {syncStatus && (
              <div className={`p-3 rounded-xl mb-4 text-xs font-medium flex gap-2 ${
                syncStatus.type === 'success' ? 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/30' :
                syncStatus.type === 'warning' ? 'bg-amber-500/20 text-amber-300 border border-amber-500/30' :
                'bg-rose-500/20 text-rose-300 border border-rose-500/30'
              }`}>
                {syncStatus.type === 'success' ? <CheckCircle className="w-4 h-4 shrink-0" /> : <AlertTriangle className="w-4 h-4 shrink-0" />}
                <span className="leading-snug">{syncStatus.message}</span>
              </div>
            )}

            {canManageKB && (
              <button 
                onClick={handleReindex}
                disabled={isSyncing}
                className="w-full py-2.5 bg-[#0066FF] hover:bg-[#0052CC] disabled:bg-slate-800 text-white text-xs font-semibold rounded-xl transition-all shadow-sm flex items-center justify-center gap-1.5 cursor-pointer active:scale-95"
              >
                <RefreshCw className={`w-3.5 h-3.5 ${isSyncing ? 'animate-spin' : ''}`} />
                {isSyncing ? 'Sedang Memproses Index...' : 'Sinkronisasi Pengetahuan'}
              </button>
            )}
          </div>

        </div>

      </div>

      {/* MODAL 1: Buat Dokumen Baru */}
      {isCreateOpen && (
        <div className="fixed inset-0 z-50 bg-slate-950/60 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white dark:bg-[#0D182E] rounded-2xl shadow-2xl w-full max-w-2xl overflow-hidden border border-slate-200 dark:border-white/10 animate-in fade-in zoom-in-95 flex flex-col max-h-[85vh]">
            {/* Modal Header */}
            <div className="p-4 px-5 border-b border-slate-100 dark:border-white/5 flex items-center justify-between bg-slate-50/50 dark:bg-white/[0.02]">
              <div className="flex items-center gap-2">
                <div className="w-8 h-8 rounded-xl bg-blue-500/10 text-[#0066FF] flex items-center justify-center">
                  <Sparkles className="w-4 h-4" />
                </div>
                <div>
                  <h3 className="text-sm font-bold text-slate-900 dark:text-white">
                    Buat Dokumen Pengetahuan Baru
                  </h3>
                  <p className="text-[11px] text-slate-400">
                    Dokumen akan tersimpan langsung ke sistem RAG dalam format Markdown (.md)
                  </p>
                </div>
              </div>
              <button
                onClick={() => setIsCreateOpen(false)}
                className="text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 p-1 rounded-lg"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {/* Modal Form */}
            <form onSubmit={handleCreateDocument} className="flex-1 overflow-y-auto p-5 space-y-4">
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                <div className="sm:col-span-2">
                  <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1.5">
                    Judul Dokumen <span className="text-rose-500">*</span>
                  </label>
                  <input
                    type="text"
                    required
                    value={newTitle}
                    onChange={(e) => setNewTitle(e.target.value)}
                    placeholder="Contoh: FAQ Garansi Software dan SLA"
                    className="w-full px-3.5 py-2 text-xs rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 text-slate-900 dark:text-slate-100 outline-none focus:border-[#0066FF]"
                  />
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1.5">
                    Kategori
                  </label>
                  <select
                    value={newCategory}
                    onChange={(e) => setNewCategory(e.target.value)}
                    className="w-full px-3.5 py-2 text-xs rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 text-slate-900 dark:text-slate-100 outline-none focus:border-[#0066FF]"
                  >
                    <option value="FAQ & Tanya Jawab">FAQ & Tanya Jawab</option>
                    <option value="Layanan & Harga">Layanan & Harga</option>
                    <option value="Profil Perusahaan">Profil Perusahaan</option>
                    <option value="Kebijakan & Garansi">Kebijakan & Garansi</option>
                    <option value="Teknis & Integrasi">Teknis & Integrasi</option>
                  </select>
                </div>
              </div>

              {/* Mode switch (Editor vs Preview) */}
              <div>
                <div className="flex items-center justify-between mb-1.5">
                  <label className="text-xs font-semibold text-slate-700 dark:text-slate-300">
                    Isi Konten Dokumen (Markdown) <span className="text-rose-500">*</span>
                  </label>
                  <div className="flex items-center gap-1">
                    <button
                      type="button"
                      onClick={() => setCreatePreview(false)}
                      className={`px-2.5 py-1 text-[11px] font-semibold rounded-lg transition-colors cursor-pointer ${
                        !createPreview 
                          ? 'bg-[#0066FF] text-white' 
                          : 'text-slate-500 hover:bg-slate-100 dark:hover:bg-slate-800'
                      }`}
                    >
                      Editor
                    </button>
                    <button
                      type="button"
                      onClick={() => setCreatePreview(true)}
                      className={`px-2.5 py-1 text-[11px] font-semibold rounded-lg transition-colors cursor-pointer ${
                        createPreview 
                          ? 'bg-[#0066FF] text-white' 
                          : 'text-slate-500 hover:bg-slate-100 dark:hover:bg-slate-800'
                      }`}
                    >
                      Pratinjau
                    </button>
                  </div>
                </div>

                {createPreview ? (
                  <div className="w-full min-h-[220px] max-h-[320px] overflow-y-auto p-4 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-900/50 prose prose-xs dark:prose-invert">
                    {newContent.trim() ? (
                      <ReactMarkdown remarkPlugins={[remarkGfm]}>
                        {newContent}
                      </ReactMarkdown>
                    ) : (
                      <span className="text-slate-400 italic">Belum ada konten untuk dipratinjau.</span>
                    )}
                  </div>
                ) : (
                  <textarea
                    required
                    rows={10}
                    value={newContent}
                    onChange={(e) => setNewContent(e.target.value)}
                    placeholder="# Judul Artikel&#10;&#10;Jelaskan informasi secara terperinci. Gunakan heading (#, ##), bullet points (*), dan teks tebal (**teks**) agar AI mudah membagi konteks informasi..."
                    className="w-full px-3.5 py-2.5 text-xs font-mono rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 text-slate-900 dark:text-slate-100 outline-none focus:border-[#0066FF] leading-relaxed resize-y"
                  />
                )}
              </div>

              <div className="p-4 bg-slate-50 dark:bg-white/[0.02] border-t border-slate-100 dark:border-white/5 flex items-center justify-between -mx-5 -mb-5">
                <span className="text-[11px] text-slate-400">
                  Tip: Jawaban yang jelas dan to-the-point meningkatkan akurasi chatbot hingga 99%.
                </span>
                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={() => setIsCreateOpen(false)}
                    className="px-3.5 py-1.5 border border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-300 font-medium rounded-xl text-xs hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors cursor-pointer"
                  >
                    Batal
                  </button>
                  <button
                    type="submit"
                    disabled={isCreating}
                    className="px-4 py-1.5 bg-[#0066FF] hover:bg-[#0052CC] disabled:bg-slate-800 text-white font-semibold rounded-xl text-xs transition-all flex items-center gap-1.5 cursor-pointer"
                  >
                    {isCreating ? <RefreshCw className="w-3.5 h-3.5 animate-spin" /> : <Save className="w-3.5 h-3.5" />}
                    <span>{isCreating ? 'Menyimpan...' : 'Simpan Dokumen'}</span>
                  </button>
                </div>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* MODAL 2: Lihat / Edit Dokumen */}
      {isEditOpen && selectedFile && (
        <div className="fixed inset-0 z-50 bg-slate-950/60 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white dark:bg-[#0D182E] rounded-2xl shadow-2xl w-full max-w-3xl overflow-hidden border border-slate-200 dark:border-white/10 animate-in fade-in zoom-in-95 flex flex-col max-h-[90vh]">
            
            {/* Modal Header */}
            <div className="p-4 px-5 border-b border-slate-100 dark:border-white/5 flex items-center justify-between bg-slate-50/50 dark:bg-white/[0.02]">
              <div className="flex items-center gap-2.5 min-w-0">
                <div className={`p-2 rounded-xl shrink-0 ${selectedFile.is_core ? 'bg-amber-500/10 text-amber-600 border border-amber-500/20' : 'bg-blue-500/10 text-[#0066FF] border border-blue-500/20'}`}>
                  <FileText className="w-4 h-4" />
                </div>
                <div className="min-w-0">
                  <div className="flex items-center gap-2">
                    <h3 className="text-sm font-bold text-slate-900 dark:text-white truncate">
                      {selectedFile.filename}
                    </h3>
                    {selectedFile.is_core && (
                      <span className="px-2 py-0.5 rounded-full text-[9px] font-semibold bg-amber-500/10 text-amber-600 dark:text-amber-400 border border-amber-500/20 shrink-0">
                        Dokumen Inti
                      </span>
                    )}
                  </div>
                  <p className="text-[11px] text-slate-400 font-mono">
                    {(selectedFile.size / 1024).toFixed(1)} KB • {selectedFile.last_modified ? new Date(selectedFile.last_modified).toLocaleString('id-ID') : '-'}
                  </p>
                </div>
              </div>

              <div className="flex items-center gap-2">
                <div className="flex items-center gap-1 bg-slate-100 dark:bg-slate-900 p-1 rounded-xl border border-slate-200 dark:border-slate-800">
                  <button
                    onClick={() => setEditTab('edit')}
                    className={`px-2.5 py-1 text-[11px] font-semibold rounded-lg transition-colors cursor-pointer ${
                      editTab === 'edit' 
                        ? 'bg-[#0066FF] text-white shadow-xs' 
                        : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white'
                    }`}
                  >
                    Editor Teks
                  </button>
                  <button
                    onClick={() => setEditTab('preview')}
                    className={`px-2.5 py-1 text-[11px] font-semibold rounded-lg transition-colors cursor-pointer ${
                      editTab === 'preview' 
                        ? 'bg-[#0066FF] text-white shadow-xs' 
                        : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white'
                    }`}
                  >
                    Pratinjau RAG
                  </button>
                </div>

                <button
                  onClick={() => setIsEditOpen(false)}
                  className="text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 p-1 rounded-lg cursor-pointer"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>
            </div>

            {/* Modal Body */}
            <div className="flex-1 overflow-y-auto p-5">
              {isLoadingContent ? (
                <div className="py-20 text-center text-xs text-slate-400">
                  <RefreshCw className="w-6 h-6 animate-spin mx-auto mb-2 text-[#0066FF]" />
                  <span>Memuat isi dokumen...</span>
                </div>
              ) : editTab === 'preview' ? (
                <div className="p-4 rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-900/60 prose prose-xs dark:prose-invert max-w-none">
                  <ReactMarkdown remarkPlugins={[remarkGfm]}>
                    {fileContent}
                  </ReactMarkdown>
                </div>
              ) : (
                <textarea
                  readOnly={!canManageKB}
                  value={fileContent}
                  onChange={(e) => setFileContent(e.target.value)}
                  className="w-full h-[380px] p-4 text-xs font-mono rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-50/60 dark:bg-slate-950 text-slate-900 dark:text-slate-100 outline-none focus:border-[#0066FF] leading-relaxed resize-none"
                />
              )}
            </div>

            {/* Modal Footer */}
            <div className="p-4 px-5 bg-slate-50 dark:bg-white/[0.02] border-t border-slate-100 dark:border-white/5 flex items-center justify-between">
              <div>
                {saveSuccessNotice && (
                  <span className="text-xs font-semibold text-emerald-500 flex items-center gap-1.5 animate-in fade-in">
                    <Check className="w-3.5 h-3.5" />
                    Perubahan berhasil disimpan!
                  </span>
                )}
              </div>

              <div className="flex items-center gap-2">
                <button
                  onClick={() => setIsEditOpen(false)}
                  className="px-3.5 py-1.5 border border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-300 font-medium rounded-xl text-xs hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors cursor-pointer"
                >
                  Tutup
                </button>
                {canManageKB && (
                  <button
                    onClick={handleSaveFileContent}
                    disabled={isSaving || isLoadingContent}
                    className="px-4 py-1.5 bg-[#0066FF] hover:bg-[#0052CC] disabled:bg-slate-800 text-white font-semibold rounded-xl text-xs transition-all flex items-center gap-1.5 cursor-pointer shadow-sm active:scale-95"
                  >
                    {isSaving ? <RefreshCw className="w-3.5 h-3.5 animate-spin" /> : <Save className="w-3.5 h-3.5" />}
                    <span>{isSaving ? 'Menyimpan...' : 'Simpan Perubahan'}</span>
                  </button>
                )}
              </div>
            </div>

          </div>
        </div>
      )}

    </div>
  );
};

export default KnowledgeBase;
