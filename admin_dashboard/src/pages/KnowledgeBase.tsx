import { useState, useEffect, useRef, useMemo, ChangeEvent } from 'react';
import { useSearchParams } from 'react-router-dom';
import { 
  UploadCloud, FileText, Trash2, RefreshCw, CheckCircle, AlertTriangle, 
  Download, ShieldAlert, Plus, Edit3, Eye, Search, X, Check, Save, 
  Sparkles, BookOpen
} from 'lucide-react';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import api, { API_URL } from '../lib/apiClient';
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
  const [fileToDelete, setFileToDelete] = useState<{ filename: string; isCore?: boolean } | null>(null);
  const [modalError, setModalError] = useState('');
  const [uploadFeedback, setUploadFeedback] = useState<{ type: 'success' | 'error'; message: string; filename?: string } | null>(null);

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
      const errNotice = 'Hanya format berkas .txt, .md, atau .pdf yang didukung.';
      setUploadFeedback({ type: 'error', message: errNotice });
      setSyncStatus({ type: 'error', message: errNotice });
      return;
    }

    const formData = new FormData();
    formData.append('file', file);

    setIsUploading(true);
    setUploadFeedback(null);
    try {
      await api.authUpload('/api/admin/kb/upload', formData);
      fetchFiles();
      setUploadFeedback({
        type: 'success',
        message: `Berkas "${file.name}" berhasil diunggah dan terindeks.`,
        filename: file.name,
      });
      setSyncStatus({ type: 'warning', message: `Dokumen "${file.name}" berhasil diunggah. Klik "Perbarui Basis Pengetahuan" agar langsung aktif di AI.` });
      setTimeout(() => setUploadFeedback(null), 8000);
    } catch (err: any) {
      const errMsg = err?.message || 'Terjadi kendala saat mengunggah file. Silakan coba kembali.';
      setUploadFeedback({ type: 'error', message: `Gagal unggah: ${errMsg}` });
      setSyncStatus({ type: 'error', message: `Gagal unggah: ${errMsg}` });
    } finally {
      setIsUploading(false);
      if (fileInputRef.current) fileInputRef.current.value = '';
    }
  };

  const confirmDeleteFile = async () => {
    if (!canManageKB || !fileToDelete) return;
    const { filename } = fileToDelete;
    
    try {
      await api.authDelete(`/api/admin/kb/files/${filename}`);
      fetchFiles();
      setSyncStatus({ type: 'warning', message: `Dokumen "${filename}" berhasil dihapus. Harap perbarui basis pengetahuan AI.` });
    } catch (err) {
      console.error(err);
      setSyncStatus({ type: 'error', message: `Gagal menghapus dokumen "${filename}".` });
    } finally {
      setFileToDelete(null);
    }
  };

  const handleDelete = (filename: string, isCore?: boolean) => {
    if (!canManageKB) return;
    if (isCore) {
      setSyncStatus({ type: 'warning', message: 'Dokumen utama (Company Profile) dilindungi sistem dan tidak dapat dihapus.' });
      return;
    }
    setFileToDelete({ filename, isCore });
  };

  const handleCreateDocument = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newTitle.trim() || !newContent.trim()) {
      setModalError('Judul dan isi konten dokumen tidak boleh kosong.');
      return;
    }
    setModalError('');

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
        message: 'Dokumen baru berhasil dibuat! Klik "Perbarui Basis Pengetahuan" untuk memperbarui data asisten AI.' 
      });
    } catch (err: any) {
      console.error(err);
      setModalError(err.message || 'Gagal membuat dokumen baru.');
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
      setSyncStatus({ type: 'error', message: 'Gagal memuat isi dokumen dari server.' });
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
    } catch (err: any) {
      console.error(err);
      setModalError(err.message || 'Gagal menyimpan perubahan dokumen.');
    } finally {
      setIsSaving(false);
    }
  };

  const handleReindex = async () => {
    if (!canManageKB) return;
    setIsSyncing(true);
    setSyncStatus({ type: 'warning', message: 'Sedang memperbarui basis pengetahuan AI di latar belakang...' });
    if (pollIntervalRef.current) clearInterval(pollIntervalRef.current);

    try {
      await api.authPost('/api/admin/kb/reindex');
      pollIntervalRef.current = setInterval(async () => {
        try {
          const res = await api.authGet<{ state: string; message: string }>('/api/admin/kb/reindex/status');
          if (res.state === 'success') {
            if (pollIntervalRef.current) clearInterval(pollIntervalRef.current);
            setIsSyncing(false);
            setSyncStatus({ type: 'success', message: res.message || 'Basis pengetahuan berhasil diperbarui dan siap digunakan AI.' });
            fetchFiles();
          } else if (res.state === 'failed') {
            if (pollIntervalRef.current) clearInterval(pollIntervalRef.current);
            setIsSyncing(false);
            setSyncStatus({ type: 'error', message: res.message || 'Gagal memperbarui basis pengetahuan.' });
          } else {
            setSyncStatus({ type: 'warning', message: res.message || 'Sedang membaca dan memproses dokumen...' });
          }
        } catch {
          // ignore transient poll errors
        }
      }, 1500);
    } catch (err) {
      console.error(err);
      setIsSyncing(false);
      setSyncStatus({ type: 'error', message: 'Gagal melakukan sinkronisasi basis pengetahuan.' });
    }
  };

  const handleExport = async () => {
    setIsExporting(true);
    try {
      const token = sessionStorage.getItem('lexa_admin_token') || localStorage.getItem('lexa_admin_token');
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
              Basis Pengetahuan AI
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
                <div className="text-center p-8 border-2 border-dashed border-slate-200 dark:border-white/10 rounded-2xl text-slate-400 bg-slate-50/50 dark:bg-white/[0.01]">
                  <div className="w-12 h-12 rounded-2xl bg-slate-100 dark:bg-slate-800 flex items-center justify-center mx-auto mb-3 text-slate-400 dark:text-slate-500">
                    <FileText className="w-6 h-6" />
                  </div>
                  <p className="text-sm font-bold text-slate-800 dark:text-slate-200">
                    {searchFilter ? 'Tidak ada dokumen yang cocok dengan pencarian.' : 'Knowledge Base Kosong'}
                  </p>
                  <p className="text-xs text-slate-500 dark:text-slate-400 mt-1 max-w-md mx-auto">
                    {searchFilter ? 'Coba gunakan kata kunci pencarian yang berbeda.' : 'Belum ada dokumen di Knowledge Base. Tambahkan dokumen untuk meningkatkan akurasi jawaban AI.'}
                  </p>
                  {canManageKB && !searchFilter && (
                    <button
                      onClick={() => setIsCreateOpen(true)}
                      className="mt-4 px-4 py-2 bg-[#0066FF] hover:bg-[#0052CC] text-white text-xs font-semibold rounded-xl transition-all shadow-sm inline-flex items-center gap-1.5 cursor-pointer"
                    >
                      <Plus className="w-3.5 h-3.5" />
                      <span>Tambah Dokumen</span>
                    </button>
                  )}
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
          
          {/* Quick Create Prompt Card - Informative Tips (Redundant button removed per UX-006) */}
          {canManageKB && (
            <div className="bg-gradient-to-br from-blue-600 to-indigo-700 rounded-2xl p-5 text-white shadow-lg space-y-2">
              <div className="flex items-center gap-2">
                <Sparkles className="w-4 h-4 text-amber-300" />
                <h3 className="font-bold text-sm">Pengetahuan Instan</h3>
              </div>
              <p className="text-xs text-blue-100 leading-relaxed">
                Tulis artikel FAQ atau aturan bisnis baru langsung di dashboard tanpa perlu membuat file manual di komputer. Gunakan tombol "Buat Dokumen Baru" di bagian atas halaman.
              </p>
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

              {/* Dedicated Upload Feedback Banner (UX-007) */}
              {uploadFeedback && (
                <div className={`mt-3 p-3 rounded-xl text-xs font-medium flex items-start gap-2 animate-in fade-in ${
                  uploadFeedback.type === 'success'
                    ? 'bg-emerald-50 dark:bg-emerald-950/40 text-emerald-800 dark:text-emerald-200 border border-emerald-200 dark:border-emerald-800'
                    : 'bg-rose-50 dark:bg-rose-950/40 text-rose-800 dark:text-rose-200 border border-rose-200 dark:border-rose-800'
                }`}>
                  {uploadFeedback.type === 'success' ? (
                    <CheckCircle className="w-4 h-4 text-emerald-600 dark:text-emerald-400 shrink-0 mt-0.5" />
                  ) : (
                    <AlertTriangle className="w-4 h-4 text-rose-600 dark:text-rose-400 shrink-0 mt-0.5" />
                  )}
                  <div className="min-w-0 flex-1">
                    <p className="font-semibold text-xs">{uploadFeedback.type === 'success' ? 'Unggah Berhasil' : 'Unggah Gagal'}</p>
                    <p className="mt-0.5 text-[11px] leading-relaxed opacity-95">{uploadFeedback.message}</p>
                  </div>
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      setUploadFeedback(null);
                    }}
                    className="text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 p-0.5"
                  >
                    <X className="w-3.5 h-3.5" />
                  </button>
                </div>
              )}
            </div>
          )}

          {/* Perbarui Basis Pengetahuan AI */}
          <div className="bg-[#0A1224] text-white rounded-2xl shadow-md p-5 border border-white/10 relative overflow-hidden">
            <div className="flex items-center gap-2 mb-2">
              <RefreshCw className="w-4 h-4 text-emerald-400" />
              <h2 className="font-bold text-sm text-white">Perbarui Basis Pengetahuan AI</h2>
            </div>
            <p className="text-xs text-slate-300 mb-4 leading-relaxed">
              Setelah dokumen dibuat, diubah, atau dihapus, klik tombol di bawah agar asisten AI segera mempelajari materi terbaru.
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
                {isSyncing ? 'Sedang Memperbarui Pengetahuan...' : 'Perbarui Pengetahuan AI'}
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
                    Dokumen akan tersimpan langsung ke basis pengetahuan AI dalam format Markdown (.md)
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
              {modalError && (
                <div className="p-3 bg-rose-500/10 border border-rose-500/30 text-rose-600 dark:text-rose-400 text-xs font-semibold rounded-xl">
                  {modalError}
                </div>
              )}
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
                    Pratinjau Dokumen
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

      {/* MODAL 3: Konfirmasi Hapus Dokumen */}
      {fileToDelete && (
        <div className="fixed inset-0 z-50 bg-slate-950/60 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white dark:bg-[#0D182E] rounded-2xl shadow-2xl w-full max-w-md overflow-hidden border border-slate-200 dark:border-white/10 animate-in fade-in zoom-in-95 p-6 space-y-4">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-rose-500/10 text-rose-600 flex items-center justify-center shrink-0">
                <Trash2 className="w-5 h-5" />
              </div>
              <div>
                <h3 className="text-sm font-bold text-slate-900 dark:text-white">
                  Hapus Dokumen Pengetahuan?
                </h3>
                <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
                  Tindakan ini permanen dan tidak dapat dibatalkan.
                </p>
              </div>
            </div>

            <div className="p-3 bg-slate-50 dark:bg-slate-900/60 rounded-xl border border-slate-200 dark:border-slate-800 text-xs font-mono text-slate-700 dark:text-slate-300 break-all">
              {fileToDelete.filename}
            </div>

            <p className="text-xs text-slate-600 dark:text-slate-400 leading-relaxed">
              Dokumen ini akan dihapus dari server dan tidak akan lagi digunakan oleh AI untuk menjawab pertanyaan pelanggan.
            </p>

            <div className="flex items-center justify-end gap-2.5 pt-2">
              <button
                type="button"
                onClick={() => setFileToDelete(null)}
                className="px-4 py-2 border border-slate-200 dark:border-slate-700 hover:bg-slate-100 dark:hover:bg-slate-800 text-slate-700 dark:text-slate-300 font-semibold text-xs rounded-xl transition-colors cursor-pointer"
              >
                Batal
              </button>
              <button
                type="button"
                onClick={confirmDeleteFile}
                className="px-4 py-2 bg-rose-600 hover:bg-rose-700 text-white font-semibold text-xs rounded-xl shadow-sm transition-all cursor-pointer active:scale-95"
              >
                Hapus Dokumen
              </button>
            </div>
          </div>
        </div>
      )}

    </div>
  );
};

export default KnowledgeBase;
