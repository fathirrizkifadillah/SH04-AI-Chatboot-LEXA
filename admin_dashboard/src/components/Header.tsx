import { useState, useEffect, useCallback, useRef, FormEvent } from 'react';
import { Search, Bell, HelpCircle, Menu, X, Sun, Moon, LogOut, User, Shield, ChevronDown, BookOpen, MessageSquare, LayoutDashboard, BarChart3, Settings, Code, Users, KeyRound, Loader2, Check } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import api from '../lib/apiClient';

interface Notification {
  id: string;
  message: string;
  session_id?: string;
  timestamp: Date;
  read: boolean;
}

interface HeaderProps {
  onToggleSidebar?: () => void;
  sidebarCollapsed?: boolean;
}

interface SearchItem {
  title: string;
  description: string;
  path: string;
  icon: any;
  roles?: string[];
}

const Header = ({ onToggleSidebar }: HeaderProps) => {
  const navigate = useNavigate();
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [showNotificationDropdown, setShowNotificationDropdown] = useState(false);
  const [showProfileDropdown, setShowProfileDropdown] = useState(false);
  const [showHelpModal, setShowHelpModal] = useState(false);
  const [showSearchModal, setShowSearchModal] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [isDark, setIsDark] = useState(() => localStorage.getItem('lexa_dark_mode') === 'true');

  // Password change state
  const [showPasswordModal, setShowPasswordModal] = useState(false);
  const [oldPassword, setOldPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [pwdLoading, setPwdLoading] = useState(false);
  const [pwdError, setPwdError] = useState('');
  const [pwdSuccess, setPwdSuccess] = useState('');

  const notificationDropdownRef = useRef<HTMLDivElement>(null);
  const profileDropdownRef = useRef<HTMLDivElement>(null);
  const searchInputRef = useRef<HTMLInputElement>(null);

  // Read current authenticated user from sessionStorage
  const [currentUser] = useState<{ name: string; email: string; role: string }>(() => {
    try {
      const u = sessionStorage.getItem('lexa_admin_user');
      return u ? JSON.parse(u) : { name: 'Pengguna', email: '', role: 'CS Agent' };
    } catch {
      return { name: 'Pengguna', email: '', role: 'CS Agent' };
    }
  });

  const unreadCount = notifications.filter(n => !n.read).length;

  useEffect(() => {
    if (isDark) {
      document.documentElement.classList.add('dark');
    } else {
      document.documentElement.classList.remove('dark');
    }
    localStorage.setItem('lexa_dark_mode', String(isDark));
  }, [isDark]);

  // Global shortcut Cmd+K / Ctrl+K
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 'k') {
        e.preventDefault();
        setShowSearchModal(prev => !prev);
      } else if (e.key === 'Escape') {
        setShowSearchModal(false);
        setShowHelpModal(false);
        setShowNotificationDropdown(false);
        setShowProfileDropdown(false);
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, []);

  useEffect(() => {
    if (showSearchModal) {
      setTimeout(() => searchInputRef.current?.focus(), 50);
    }
  }, [showSearchModal]);

  useEffect(() => {
    const wsUrl = `${window.location.protocol === 'https:' ? 'wss:' : 'ws:'}//${window.location.host}/ws/admin`;
    const ws = new WebSocket(wsUrl);

    ws.onmessage = (event) => {
      try {
        const data = JSON.parse(event.data);
        if (data.type === 'handoff_request') {
          setNotifications(prev => [{
            id: crypto.randomUUID(),
            message: `Pelanggan meminta bantuan CS manusia (Sesi: ${data.session_id ? data.session_id.slice(0, 8) : 'Baru'})`,
            session_id: data.session_id,
            timestamp: new Date(),
            read: false,
          }, ...prev]);
        }
      } catch {}
    };

    return () => ws.close();
  }, []);

  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (notificationDropdownRef.current && !notificationDropdownRef.current.contains(e.target as Node)) {
        setShowNotificationDropdown(false);
      }
      if (profileDropdownRef.current && !profileDropdownRef.current.contains(e.target as Node)) {
        setShowProfileDropdown(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const markAllRead = useCallback(() => {
    setNotifications(prev => prev.map(n => ({ ...n, read: true })));
  }, []);

  const clearAll = useCallback(() => {
    setNotifications([]);
  }, []);

  const handleLogout = () => {
    sessionStorage.removeItem('lexa_admin_user');
    sessionStorage.removeItem('lexa_admin_token');
    localStorage.removeItem('lexa_admin_user');
    localStorage.removeItem('lexa_admin_token');
    api.post('/api/auth/logout').catch(() => {});
    navigate('/login');
  };

  const handleChangePassword = async (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setPwdError('');
    setPwdSuccess('');

    if (newPassword.length < 6) {
      setPwdError('Password baru minimal 6 karakter.');
      return;
    }
    if (newPassword !== confirmPassword) {
      setPwdError('Konfirmasi password tidak cocok.');
      return;
    }

    setPwdLoading(true);
    try {
      await api.post('/api/admin/change-password', {
        old_password: currentUser.role === 'Super Admin' ? (oldPassword || undefined) : oldPassword,
        new_password: newPassword,
      });
      setPwdSuccess('Password Anda berhasil diperbarui!');
      setOldPassword('');
      setNewPassword('');
      setConfirmPassword('');
      setTimeout(() => {
        setShowPasswordModal(false);
        setPwdSuccess('');
      }, 1500);
    } catch (err: any) {
      setPwdError(err.message || 'Gagal mengubah password. Pastikan password lama sesuai.');
    } finally {
      setPwdLoading(false);
    }
  };

  const allSearchItems: SearchItem[] = [
    { title: 'Dashboard', description: 'Ringkasan metriks, KPI, dan performa AI', path: '/', icon: LayoutDashboard },
    { title: 'Conversations', description: 'Pantau obrolan aktif dan live chat pelanggan', path: '/conversations', icon: MessageSquare, roles: ['Super Admin', 'CS Agent'] },
    { title: 'Knowledge Base', description: 'Kelola dokumen dan sinkronisasi data RAG', path: '/kb', icon: BookOpen, roles: ['Super Admin', 'Editor (Knowledge Base)'] },
    { title: 'Analytics', description: 'Laporan kepuasan dan tren percakapan', path: '/analytics', icon: BarChart3 },
    { title: 'Users & Roles', description: 'Kelola anggota tim dan hak akses', path: '/users', icon: Users, roles: ['Super Admin'] },
    { title: 'Widget Setup', description: 'Panduan integrasi dan kode embed widget', path: '/widget', icon: Code },
    { title: 'Settings', description: 'Konfigurasi prompt dan parameter model AI', path: '/settings', icon: Settings },
  ];

  const searchItems = allSearchItems
    .filter(item => !item.roles || item.roles.includes(currentUser.role))
    .filter(item => 
      item.title.toLowerCase().includes(searchQuery.toLowerCase()) || 
      item.description.toLowerCase().includes(searchQuery.toLowerCase())
    );

  return (
    <header className="h-16 bg-white dark:bg-slate-900 border-b border-slate-200 dark:border-slate-800 flex items-center justify-between px-6 sticky top-0 z-40 transition-colors">
      <div className="flex items-center gap-3 shrink-0">
        <button
          onClick={onToggleSidebar}
          className="lg:hidden text-slate-500 dark:text-slate-400 hover:text-slate-800 dark:hover:text-slate-200 p-1.5 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors"
        >
          <Menu className="w-5 h-5" />
        </button>
        <div className="flex items-center gap-2">
          <span className="w-2 h-2 rounded-full bg-blue-600"></span>
          <h2 className="text-sm font-semibold text-slate-900 dark:text-slate-100 tracking-tight">
            LEXA Console
          </h2>
        </div>
      </div>

      {/* Global Search Bar */}
      <div className="flex-1 max-w-md mx-6">
        <button
          onClick={() => setShowSearchModal(true)}
          className="w-full flex items-center justify-between bg-slate-100/90 dark:bg-slate-800/90 border border-slate-200 dark:border-slate-700 text-xs rounded-xl py-2 px-3 hover:border-blue-400 dark:hover:border-blue-500 transition-all text-slate-500 dark:text-slate-400 shadow-none cursor-pointer"
        >
          <div className="flex items-center gap-2">
            <Search className="w-3.5 h-3.5 text-slate-400" />
            <span>Cari menu, halaman, aksi...</span>
          </div>
          <span className="text-[10px] font-mono font-medium text-slate-400 dark:text-slate-500 bg-white dark:bg-slate-700 border border-slate-200 dark:border-slate-600 rounded px-1.5 py-0.5">
            ⌘K
          </span>
        </button>
      </div>

      <div className="flex items-center gap-2 shrink-0">
        {/* Dark Mode Toggle */}
        <button
          onClick={() => setIsDark(!isDark)}
          className="w-8 h-8 rounded-lg border border-slate-200 dark:border-slate-700/80 bg-slate-50 dark:bg-slate-800 flex items-center justify-center text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-700 transition-colors"
          title={isDark ? 'Beralih ke Light Mode' : 'Beralih ke Dark Mode'}
        >
          {isDark ? <Sun className="w-4 h-4 text-amber-400" /> : <Moon className="w-4 h-4 text-slate-600" />}
        </button>

        {/* Notification Bell */}
        <div className="relative" ref={notificationDropdownRef}>
          <button
            onClick={() => setShowNotificationDropdown(!showNotificationDropdown)}
            className="w-8 h-8 rounded-lg border border-slate-200 dark:border-slate-700/80 bg-slate-50 dark:bg-slate-800 flex items-center justify-center text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-700 transition-colors relative"
            title="Notifikasi"
          >
            <Bell className="w-4 h-4" />
            {unreadCount > 0 && (
              <span className="absolute -top-1 -right-1 min-w-[15px] h-[15px] bg-blue-600 text-white text-[9px] font-bold rounded-full flex items-center justify-center px-1">
                {unreadCount}
              </span>
            )}
          </button>

          {showNotificationDropdown && (
            <div className="absolute right-0 top-full mt-2 w-80 bg-white dark:bg-slate-900 rounded-xl shadow-xl border border-slate-200 dark:border-slate-800 overflow-hidden z-50 animate-in fade-in slide-in-from-top-2">
              <div className="flex items-center justify-between px-4 py-3 border-b border-slate-100 dark:border-slate-800">
                <span className="font-semibold text-xs text-slate-800 dark:text-slate-200 uppercase tracking-wider">Notifikasi</span>
                <div className="flex gap-2">
                  {unreadCount > 0 && (
                    <button onClick={markAllRead} className="text-[11px] text-blue-600 hover:text-blue-700 font-medium">
                      Tandai dibaca
                    </button>
                  )}
                  {notifications.length > 0 && (
                    <button onClick={clearAll} className="text-[11px] text-slate-400 hover:text-slate-600">
                      Bersihkan
                    </button>
                  )}
                </div>
              </div>

              <div className="max-h-64 overflow-y-auto">
                {notifications.length === 0 ? (
                  <div className="py-8 text-center text-slate-400 dark:text-slate-500 text-xs">
                    Tidak ada notifikasi baru
                  </div>
                ) : (
                  notifications.map((n) => (
                    <div
                      key={n.id}
                      onClick={() => {
                        if (n.session_id) {
                          navigate('/conversations');
                          setShowNotificationDropdown(false);
                        }
                      }}
                      className={`px-4 py-3 border-b border-slate-50 dark:border-slate-800 hover:bg-slate-50 dark:hover:bg-slate-800/60 transition-colors cursor-pointer ${
                        !n.read ? 'bg-blue-50/40 dark:bg-blue-950/20' : ''
                      }`}
                    >
                      <div className="flex items-start gap-2.5">
                        {!n.read && (
                          <span className="mt-1.5 w-1.5 h-1.5 bg-blue-600 rounded-full shrink-0" />
                        )}
                        <div className="flex-1 min-w-0">
                          <p className="text-xs text-slate-700 dark:text-slate-300 leading-relaxed">{n.message}</p>
                          <p className="text-[10px] text-slate-400 dark:text-slate-500 mt-1">
                            {n.timestamp.toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit' })}
                          </p>
                        </div>
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            setNotifications(prev => prev.filter(x => x.id !== n.id));
                          }}
                          className="text-slate-400 hover:text-slate-600 dark:hover:text-slate-300 shrink-0 p-0.5"
                        >
                          <X className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    </div>
                  ))
                )}
              </div>
            </div>
          )}
        </div>

        {/* Help Center Button */}
        <button
          onClick={() => setShowHelpModal(true)}
          className="w-8 h-8 rounded-lg border border-slate-200 dark:border-slate-700/80 bg-slate-50 dark:bg-slate-800 flex items-center justify-center text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-700 transition-colors"
          title="Pusat Bantuan"
        >
          <HelpCircle className="w-4 h-4" />
        </button>

        <div className="h-5 w-[1px] bg-slate-200 dark:bg-slate-800 mx-1"></div>

        {/* Profile / Account Dropdown */}
        <div className="relative" ref={profileDropdownRef}>
          <button
            onClick={() => setShowProfileDropdown(!showProfileDropdown)}
            className="flex items-center gap-2 p-1.5 rounded-xl border border-slate-200 dark:border-slate-700/80 bg-slate-50 dark:bg-slate-800 hover:bg-slate-100 dark:hover:bg-slate-700 transition-colors group text-left cursor-pointer"
          >
            <div className="w-6 h-6 rounded-md bg-blue-600 flex items-center justify-center text-white font-semibold text-[11px] tracking-wider">
              {currentUser.name ? currentUser.name.charAt(0).toUpperCase() : 'A'}
            </div>
            <div className="hidden md:block pr-1">
              <div className="flex items-center gap-1">
                <span className="text-xs font-semibold text-slate-800 dark:text-slate-200 leading-tight">
                  {currentUser.name}
                </span>
                <ChevronDown className="w-3 h-3 text-slate-400" />
              </div>
            </div>
          </button>

          {showProfileDropdown && (
            <div className="absolute right-0 top-full mt-2 w-64 bg-white dark:bg-slate-900 rounded-xl shadow-xl border border-slate-200 dark:border-slate-800 overflow-hidden z-50 animate-in fade-in slide-in-from-top-2">
              <div className="p-3.5 border-b border-slate-100 dark:border-slate-800">
                <p className="text-xs font-medium text-slate-900 dark:text-slate-100">{currentUser.name}</p>
                <p className="text-[11px] text-slate-500 dark:text-slate-400 truncate">{currentUser.email}</p>
                <div className="mt-2 inline-flex items-center gap-1 px-2 py-0.5 rounded bg-slate-100 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-[10px] font-medium text-slate-600 dark:text-slate-300">
                  <Shield className="w-2.5 h-2.5" />
                  {currentUser.role}
                </div>
              </div>

              <div className="p-1.5">
                <button
                  onClick={() => {
                    setShowProfileDropdown(false);
                    setShowPasswordModal(true);
                    setPwdError('');
                    setPwdSuccess('');
                  }}
                  className="w-full flex items-center gap-2.5 px-3 py-2 text-xs font-medium text-slate-700 dark:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-lg transition-colors"
                >
                  <KeyRound className="w-3.5 h-3.5 text-blue-500" />
                  Ganti Password Saya
                </button>
                <button
                  onClick={() => {
                    setShowProfileDropdown(false);
                    handleLogout();
                  }}
                  className="w-full flex items-center gap-2.5 px-3 py-2 text-xs font-medium text-amber-700 dark:text-amber-400 hover:bg-amber-50 dark:hover:bg-amber-950/30 rounded-lg transition-colors"
                >
                  <User className="w-3.5 h-3.5" />
                  Ganti Akun Lain
                </button>
                <button
                  onClick={handleLogout}
                  className="w-full flex items-center gap-2.5 px-3 py-2 text-xs font-medium text-red-600 dark:text-red-400 hover:bg-red-50 dark:hover:bg-red-950/30 rounded-lg transition-colors"
                >
                  <LogOut className="w-3.5 h-3.5" />
                  Keluar dari Sistem
                </button>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Global Search Modal */}
      {showSearchModal && (
        <div className="fixed inset-0 z-50 bg-slate-950/40 dark:bg-slate-950/70 backdrop-blur-sm flex items-start justify-center pt-24 px-4">
          <div className="w-full max-w-xl bg-white dark:bg-slate-900 rounded-2xl shadow-2xl border border-slate-200 dark:border-slate-800 overflow-hidden animate-in fade-in zoom-in-95">
            <div className="flex items-center px-4 py-3 border-b border-slate-100 dark:border-slate-800">
              <Search className="w-4 h-4 text-slate-400 mr-3" />
              <input
                ref={searchInputRef}
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Cari halaman, fitur, atau navigasi..."
                className="w-full bg-transparent text-sm text-slate-800 dark:text-slate-200 placeholder-slate-400 focus:outline-none"
              />
              <button
                onClick={() => setShowSearchModal(false)}
                className="p-1 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 rounded-md"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="max-h-80 overflow-y-auto p-2">
              {searchItems.length === 0 ? (
                <div className="py-8 text-center text-slate-400 dark:text-slate-500 text-xs">
                  Tidak ada menu yang sesuai dengan "{searchQuery}"
                </div>
              ) : (
                searchItems.map((item) => {
                  const Icon = item.icon;
                  return (
                    <button
                      key={item.path}
                      onClick={() => {
                        navigate(item.path);
                        setShowSearchModal(false);
                        setSearchQuery('');
                      }}
                      className="w-full flex items-center gap-3 px-3.5 py-2.5 rounded-xl hover:bg-slate-100 dark:hover:bg-slate-800/80 transition-colors text-left group"
                    >
                      <div className="w-8 h-8 rounded-lg bg-slate-100 dark:bg-slate-800 flex items-center justify-center text-slate-600 dark:text-slate-400 group-hover:bg-blue-500 group-hover:text-white transition-colors">
                        <Icon className="w-4 h-4" />
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="text-xs font-semibold text-slate-800 dark:text-slate-200 group-hover:text-blue-600 dark:group-hover:text-blue-400 transition-colors">
                          {item.title}
                        </p>
                        <p className="text-[11px] text-slate-400 truncate">{item.description}</p>
                      </div>
                    </button>
                  );
                })
              )}
            </div>

            <div className="px-4 py-2.5 bg-slate-50 dark:bg-slate-950/50 border-t border-slate-100 dark:border-slate-800 flex items-center justify-between text-[11px] text-slate-400">
              <span>Gunakan tanda panah atau klik untuk membuka menu</span>
              <span>ESC untuk menutup</span>
            </div>
          </div>
        </div>
      )}

      {/* Help & Documentation Modal */}
      {showHelpModal && (
        <div className="fixed inset-0 z-50 bg-slate-950/40 dark:bg-slate-950/70 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="w-full max-w-2xl bg-white dark:bg-slate-900 rounded-2xl shadow-2xl border border-slate-200 dark:border-slate-800 overflow-hidden animate-in fade-in zoom-in-95">
            <div className="flex items-center justify-between px-6 py-4 border-b border-slate-100 dark:border-slate-800">
              <div className="flex items-center gap-2.5">
                <HelpCircle className="w-5 h-5 text-blue-600 dark:text-blue-400" />
                <h3 className="font-semibold text-sm text-slate-900 dark:text-slate-100">
                  Panduan & Tata Kelola Sistem LEXA
                </h3>
              </div>
              <button
                onClick={() => setShowHelpModal(false)}
                className="text-slate-400 hover:text-slate-600 dark:hover:text-slate-300 p-1 rounded-md"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="p-6 space-y-4 max-h-[75vh] overflow-y-auto text-xs text-slate-600 dark:text-slate-300 leading-relaxed">
              <div>
                <h4 className="font-semibold text-slate-900 dark:text-slate-100 mb-1 text-sm">
                  1. Peran dan Hak Akses (Role-Based Access Control)
                </h4>
                <div className="grid grid-cols-1 md:grid-cols-3 gap-2 mt-2">
                  <div className="p-3 bg-slate-50 dark:bg-slate-800/60 rounded-xl border border-slate-200/60 dark:border-slate-700/60">
                    <p className="font-semibold text-slate-800 dark:text-slate-200 mb-1">Super Admin</p>
                    <p className="text-[11px] text-slate-500 dark:text-slate-400">
                      Akses tak terbatas: konfigurasi AI prompt, manajemen anggota tim, pengawasan obrolan, dan update basis pengetahuan.
                    </p>
                  </div>
                  <div className="p-3 bg-slate-50 dark:bg-slate-800/60 rounded-xl border border-slate-200/60 dark:border-slate-700/60">
                    <p className="font-semibold text-slate-800 dark:text-slate-200 mb-1">CS Agent</p>
                    <p className="text-[11px] text-slate-500 dark:text-slate-400">
                      Fokus layanan: memantau percakapan langsung pelanggan, menangani permohonan handoff manusia, dan menutup tiket sesi.
                    </p>
                  </div>
                  <div className="p-3 bg-slate-50 dark:bg-slate-800/60 rounded-xl border border-slate-200/60 dark:border-slate-700/60">
                    <p className="font-semibold text-slate-800 dark:text-slate-200 mb-1">Editor KB</p>
                    <p className="text-[11px] text-slate-500 dark:text-slate-400">
                      Fokus konten: mengunggah dokumen referensi (.txt, .md, .pdf), memelihara FAQ, dan memperbarui indeks Chroma vector.
                    </p>
                  </div>
                </div>
              </div>

              <div>
                <h4 className="font-semibold text-slate-900 dark:text-slate-100 mb-1 text-sm">
                  2. Definisi "Unanswered Queries"
                </h4>
                <p className="text-slate-500 dark:text-slate-400">
                  Pertanyaan pelanggan dikategorikan sebagai <strong className="text-slate-700 dark:text-slate-300">Unanswered Query</strong> apabila mesin RAG tidak menemukan potongan konteks referensi yang relevan pada Knowledge Base, atau bot membalas bahwa informasi belum tersedia. Administrator dan Editor KB disarankan memeriksa daftar ini dan menambahkan informasi tersebut ke dokumen Knowledge Base.
                </p>
              </div>

              <div>
                <h4 className="font-semibold text-slate-900 dark:text-slate-100 mb-1 text-sm">
                  3. Pintasan Cepat (Shortcuts)
                </h4>
                <p className="text-slate-500 dark:text-slate-400">
                  Tekan <kbd className="px-1.5 py-0.5 bg-slate-100 dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded font-mono text-[10px]">⌘K</kbd> atau <kbd className="px-1.5 py-0.5 bg-slate-100 dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded font-mono text-[10px]">Ctrl+K</kbd> di halaman mana pun untuk membuka navigasi pencarian cepat.
                </p>
              </div>
            </div>

            <div className="px-6 py-3.5 bg-slate-50 dark:bg-slate-950/50 border-t border-slate-100 dark:border-slate-800 flex justify-end">
              <button
                onClick={() => setShowHelpModal(false)}
                className="px-4 py-2 bg-slate-900 hover:bg-slate-800 dark:bg-blue-600 dark:hover:bg-blue-500 text-white rounded-xl text-xs font-medium transition-colors"
              >
                Tutup Panduan
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Change Password Modal */}
      {showPasswordModal && (
        <div className="fixed inset-0 z-50 bg-slate-950/50 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-white dark:bg-slate-900 rounded-2xl shadow-xl w-full max-w-md overflow-hidden border border-slate-200 dark:border-slate-800 animate-in fade-in zoom-in-95">
            <div className="p-5 border-b border-slate-100 dark:border-slate-800 flex justify-between items-center">
              <div className="flex items-center gap-2.5">
                <div className="w-8 h-8 rounded-lg bg-blue-50 dark:bg-blue-950/50 text-blue-600 dark:text-blue-400 flex items-center justify-center">
                  <KeyRound className="w-4 h-4" />
                </div>
                <div>
                  <h3 className="text-sm font-semibold text-slate-900 dark:text-slate-100">Ganti Password Saya</h3>
                  <p className="text-[11px] text-slate-500">{currentUser.email || currentUser.name}</p>
                </div>
              </div>
              <button 
                onClick={() => setShowPasswordModal(false)}
                className="text-slate-400 hover:text-slate-600 dark:hover:text-slate-300"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <form onSubmit={handleChangePassword} className="p-5 space-y-3.5 text-xs">
              {pwdError && (
                <div className="p-3 bg-red-50 dark:bg-red-950/40 text-red-600 dark:text-red-400 rounded-xl border border-red-200 dark:border-red-900">
                  {pwdError}
                </div>
              )}
              {pwdSuccess && (
                <div className="p-3 bg-emerald-50 dark:bg-emerald-950/40 text-emerald-600 dark:text-emerald-400 rounded-xl border border-emerald-200 dark:border-emerald-900 flex items-center gap-2">
                  <Check className="w-4 h-4" />
                  {pwdSuccess}
                </div>
              )}

              {currentUser.role !== 'Super Admin' && (
                <div>
                  <label className="block font-medium text-slate-700 dark:text-slate-300 mb-1">Password Saat Ini</label>
                  <input
                    required
                    type="password"
                    value={oldPassword}
                    onChange={(e) => setOldPassword(e.target.value)}
                    placeholder="Ketik password lama Anda"
                    className="w-full border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-slate-100 rounded-xl px-3 py-2 outline-none focus:border-blue-500"
                  />
                </div>
              )}

              <div>
                <label className="block font-medium text-slate-700 dark:text-slate-300 mb-1">Password Baru</label>
                <input
                  required
                  type="password"
                  minLength={6}
                  value={newPassword}
                  onChange={(e) => setNewPassword(e.target.value)}
                  placeholder="Minimal 6 karakter"
                  className="w-full border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-slate-100 rounded-xl px-3 py-2 outline-none focus:border-blue-500"
                />
              </div>

              <div>
                <label className="block font-medium text-slate-700 dark:text-slate-300 mb-1">Konfirmasi Password Baru</label>
                <input
                  required
                  type="password"
                  minLength={6}
                  value={confirmPassword}
                  onChange={(e) => setConfirmPassword(e.target.value)}
                  placeholder="Ulangi password baru"
                  className="w-full border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-slate-100 rounded-xl px-3 py-2 outline-none focus:border-blue-500"
                />
              </div>

              <div className="pt-3 flex gap-2.5">
                <button
                  type="button"
                  onClick={() => setShowPasswordModal(false)}
                  className="flex-1 py-2 border border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-300 font-medium rounded-xl hover:bg-slate-50 dark:hover:bg-slate-800 transition-colors"
                >
                  Batal
                </button>
                <button
                  type="submit"
                  disabled={pwdLoading}
                  className="flex-1 py-2 bg-blue-600 hover:bg-blue-500 text-white font-semibold rounded-xl transition-colors flex items-center justify-center gap-1.5 disabled:opacity-60"
                >
                  {pwdLoading ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : 'Simpan Password'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </header>
  );
};

export default Header;
