import { useState, type ReactNode } from 'react';
import { LayoutDashboard, MessageSquare, BookOpen, BarChart3, Users, Settings, LogOut, ChevronsLeft, ChevronsRight, Code } from 'lucide-react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import api from '../lib/apiClient';

interface SidebarProps {
  setAuthToken: (token: string | null) => void;
  isCollapsed: boolean;
  onToggle: () => void;
  pendingHandoffCount?: number;
}

interface NavItem {
  name: string;
  icon: ReactNode;
  path: string;
  roles?: string[];
}

const Sidebar = ({ setAuthToken, isCollapsed, onToggle, pendingHandoffCount = 0 }: SidebarProps) => {
  const location = useLocation();
  const navigate = useNavigate();
  const [showLogoutConfirm, setShowLogoutConfirm] = useState(false);

  const userStr = sessionStorage.getItem('lexa_admin_user');
  let userRole = 'CS Agent';
  try {
    if (userStr) {
      const u = JSON.parse(userStr);
      if (u.role) userRole = u.role;
    }
  } catch {}

  const handleLogout = () => {
    sessionStorage.removeItem('lexa_admin_user');
    sessionStorage.removeItem('lexa_admin_token');
    localStorage.removeItem('lexa_admin_user');
    localStorage.removeItem('lexa_admin_token');
    api.post('/api/auth/logout').catch(() => {});
    setAuthToken(null);
    navigate('/login');
  };

  const allNavItems: NavItem[] = [
    { name: 'Dashboard', icon: <LayoutDashboard className="w-5 h-5" />, path: '/', roles: ['Super Admin', 'CS Agent', 'Editor (Knowledge Base)'] },
    { name: 'Conversations', icon: <MessageSquare className="w-5 h-5" />, path: '/conversations', roles: ['Super Admin', 'CS Agent'] },
    { name: 'Knowledge Base', icon: <BookOpen className="w-5 h-5" />, path: '/kb', roles: ['Super Admin', 'Editor (Knowledge Base)'] },
    { name: 'Analytics', icon: <BarChart3 className="w-5 h-5" />, path: '/analytics', roles: ['Super Admin', 'CS Agent', 'Editor (Knowledge Base)'] },
    { name: 'Users & Roles', icon: <Users className="w-5 h-5" />, path: '/users', roles: ['Super Admin'] },
    { name: 'Widget Setup', icon: <Code className="w-5 h-5" />, path: '/widget' },
    { name: 'Settings', icon: <Settings className="w-5 h-5" />, path: '/settings' },
  ];

  const navItems = allNavItems.filter(item => !item.roles || item.roles.includes(userRole));

  return (
    <aside className={`${isCollapsed ? 'w-[74px]' : 'w-64'} bg-[#080E21] border-r border-[#152238] text-white flex flex-col h-screen fixed left-0 top-0 shadow-2xl transition-all duration-300 z-50 select-none`}>
      {/* Brand Header */}
      <div className={`p-4 pb-3 flex items-center ${isCollapsed ? 'justify-center flex-col gap-2' : 'justify-between'} border-b border-[#152238]`}>
        {!isCollapsed ? (
          <Link to="/" className="flex items-center gap-3 group">
            <div className="p-1 bg-white rounded-xl shadow-md border border-white/20 shrink-0">
              <img src="/lexa_logo.jpeg" alt="LEXA" className="h-8 w-auto object-contain" />
            </div>
            <div className="min-w-0">
              <div className="flex items-center gap-1.5">
                <span className="text-xl font-bold tracking-tight text-white group-hover:text-[#0066FF] transition-colors">LEXA</span>
              </div>
              <p className="text-[10px] text-[#0066FF] font-bold tracking-[0.2em] uppercase leading-none">
                Software House
              </p>
            </div>
          </Link>
        ) : (
          <Link to="/" className="p-1 bg-white rounded-xl shadow-md border border-white/20 inline-block">
            <img src="/lexa_logo.jpeg" alt="LEXA" className="h-7 w-7 object-contain" />
          </Link>
        )}
        <button
          onClick={onToggle}
          className="p-1.5 rounded-lg text-slate-400 hover:text-white hover:bg-white/10 transition-colors shrink-0"
          title={isCollapsed ? 'Perluas Sidebar' : 'Ciutkan Sidebar'}
          aria-label={isCollapsed ? 'Expand sidebar' : 'Collapse sidebar'}
        >
          {isCollapsed ? <ChevronsRight className="w-4 h-4" /> : <ChevronsLeft className="w-4 h-4" />}
        </button>
      </div>

      {/* Nav Items */}
      <nav className="flex-1 px-3 space-y-1.5 overflow-y-auto scrollbar-hidden py-4">
        {navItems.map((item) => {
          const isActive = location.pathname === item.path;
          return (
            <Link
              key={item.name}
              to={item.path}
              title={isCollapsed ? item.name : undefined}
              className={`relative flex items-center gap-3 px-3.5 py-2.5 rounded-xl transition-all duration-150 ${
                isCollapsed ? 'justify-center' : ''
              } ${
                isActive
                  ? 'bg-[#0066FF] text-white font-semibold shadow-lg shadow-[#0066FF]/35'
                  : 'text-slate-400 hover:text-white hover:bg-white/[0.06]'
              }`}
            >
              <span className={`w-5 h-5 shrink-0 ${isActive ? 'text-white' : 'text-slate-400'}`}>{item.icon}</span>
              {!isCollapsed && <span className="text-[13px] tracking-wide">{item.name}</span>}
              {item.name === 'Conversations' && pendingHandoffCount > 0 && (
                isCollapsed ? (
                  <span className="absolute top-1.5 right-1.5 w-2.5 h-2.5 rounded-full bg-red-500 animate-pulse ring-2 ring-[#080E21]" />
                ) : (
                  <span className="ml-auto px-2 py-0.5 text-[10px] font-bold rounded-full bg-red-500 text-white animate-pulse shadow-md shadow-red-500/40">
                    {pendingHandoffCount}
                  </span>
                )
              )}
            </Link>
          );
        })}
        
        <div className="pt-2 border-t border-[#152238] mt-2">
          <button
            onClick={() => setShowLogoutConfirm(true)}
            title={isCollapsed ? 'Keluar' : undefined}
            className={`w-full flex items-center gap-3 px-3.5 py-2.5 rounded-xl transition-all duration-150 text-slate-400 hover:text-red-400 hover:bg-red-500/10 cursor-pointer ${isCollapsed ? 'justify-center' : ''}`}
          >
            <LogOut className="w-5 h-5 shrink-0" />
            {!isCollapsed && <span className="text-[13px]">Logout</span>}
          </button>
        </div>
      </nav>

      {/* Bottom Brand Card */}
      {!isCollapsed && (
        <div className="p-3.5 mt-auto border-t border-[#152238] bg-[#060B1A]/80">
          <div className="flex items-center gap-3 mb-2.5">
            <div className="w-9 h-9 rounded-xl bg-white/[0.06] border border-white/10 p-1 flex items-center justify-center shrink-0">
              <img src="/lexa_logo.jpeg" alt="LEXA" className="w-full h-full object-contain" />
            </div>
            <div className="min-w-0">
              <h3 className="font-bold text-xs text-white tracking-wide">LEXA Ops</h3>
              <p className="text-[9.5px] text-slate-400 leading-tight truncate">Leading • eXcellence • Automation</p>
            </div>
          </div>
          <Link
            to="/widget"
            className="w-full py-1.5 px-3 bg-white/[0.06] hover:bg-white/[0.12] text-[11px] font-medium text-slate-300 hover:text-white rounded-lg transition-colors border border-white/10 flex items-center justify-center gap-1.5 text-center"
          >
            <Code className="w-3.5 h-3.5 text-[#0066FF]" />
            <span>Developer Hub</span>
          </Link>
          <p className="text-[9px] text-slate-500 text-center mt-2.5 tracking-tight font-mono">
            © 2026 LEXA Software House
          </p>
        </div>
      )}

      {/* Logout Confirmation Modal */}
      {showLogoutConfirm && (
        <div className="fixed inset-0 z-[100] bg-black/60 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white dark:bg-[#152238] rounded-2xl border border-slate-200 dark:border-slate-800 p-6 max-w-sm w-full shadow-2xl text-center space-y-4 animate-in fade-in zoom-in-95">
            <div className="w-12 h-12 rounded-2xl bg-red-50 dark:bg-red-950/40 text-red-600 dark:text-red-400 flex items-center justify-center mx-auto border border-red-200 dark:border-red-900/50">
              <LogOut className="w-6 h-6" />
            </div>
            <div>
              <h3 className="text-base font-bold text-slate-900 dark:text-slate-100">Konfirmasi Keluar</h3>
              <p className="text-xs text-slate-500 dark:text-slate-400 mt-1.5 leading-relaxed">
                Apakah Anda yakin ingin keluar dari Admin Console LEXA? Sesi aktif Anda akan ditutup.
              </p>
            </div>
            <div className="flex items-center gap-3 pt-2">
              <button
                type="button"
                onClick={() => setShowLogoutConfirm(false)}
                className="flex-1 py-2 px-4 rounded-xl border border-slate-200 dark:border-slate-700 text-xs font-semibold text-slate-700 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors cursor-pointer"
              >
                Batal
              </button>
              <button
                type="button"
                onClick={() => {
                  setShowLogoutConfirm(false);
                  handleLogout();
                }}
                className="flex-1 py-2 px-4 rounded-xl bg-red-600 hover:bg-red-700 text-white text-xs font-semibold shadow-lg shadow-red-600/30 transition-colors cursor-pointer"
              >
                Ya, Keluar
              </button>
            </div>
          </div>
        </div>
      )}
    </aside>
  );
};

export default Sidebar;
