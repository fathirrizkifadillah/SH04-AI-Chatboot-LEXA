import { useState, FormEvent } from 'react';
import { Lock, Mail, Loader2, ArrowRight, Eye, EyeOff, ShieldCheck } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import api, { ApiError } from '../lib/apiClient';
import type { LoginRequest, LoginResponse } from '../types/api';

interface LoginProps {
  setAuthToken: (token: string) => void;
}

const Login = ({ setAuthToken }: LoginProps) => {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const navigate = useNavigate();

  const handleLogin = async (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setError('');
    setLoading(true);
    
    try {
      const data = await api.post<LoginResponse>('/api/auth/login', { email, password } satisfies LoginRequest);
      if (data.token) {
        sessionStorage.setItem('lexa_admin_token', data.token);
      }
      sessionStorage.setItem('lexa_admin_user', JSON.stringify(data.user));
      // Hapus token lama dari localStorage agar tidak bocor antar tab
      localStorage.removeItem('lexa_admin_token');
      localStorage.removeItem('lexa_admin_user');
      setAuthToken('authenticated');
      navigate('/');
    } catch (err) {
      if (err instanceof ApiError) {
        setError(err.message || 'Login failed. Please check your credentials.');
      } else {
        setError('Cannot connect to the server. Is the backend running?');
      }
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-[#060B18] relative overflow-hidden text-slate-100 antialiased selection:bg-[#2563EB] selection:text-white px-4 py-12">
      {/* Precision architectural background structure */}
      <div className="fixed inset-0 pointer-events-none overflow-hidden z-0">
        <div className="absolute inset-0 bg-[linear-gradient(to_right,rgba(255,255,255,0.02)_1px,transparent_1px),linear-gradient(to_bottom,rgba(255,255,255,0.02)_1px,transparent_1px)] bg-[size:4rem_4rem] [mask-image:radial-gradient(ellipse_60%_50%_at_50%_40%,#000_70%,transparent_100%)] opacity-70"></div>
        <div className="absolute top-1/4 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[700px] h-[300px] bg-[#1E3A8A]/12 blur-[100px] rounded-full"></div>
      </div>

      {/* Double-Bezel Architectural Container */}
      <div className="w-full max-w-md relative z-10 p-2 rounded-[2rem] bg-white/[0.03] border border-white/[0.08] shadow-[0_32px_64px_-16px_rgba(0,0,0,0.8)] backdrop-blur-xl">
        <div className="bg-[#0B1428] rounded-[calc(2rem-0.5rem)] border border-white/[0.06] p-7 sm:p-9 shadow-inner">
          
          {/* Brand Presentation */}
          <div className="flex flex-col items-center mb-6">
            <div className="p-2 bg-white rounded-2xl shadow-md border border-white/20 mb-3.5 inline-flex items-center justify-center">
              <img 
                src="/lexa_logo.jpeg" 
                alt="LEXA SOFTWARE HOUSE" 
                className="h-10 sm:h-12 w-auto object-contain" 
              />
            </div>
            
            <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-blue-500/10 border border-blue-500/20 text-blue-400 text-[10px] font-mono tracking-wider uppercase font-semibold">
              <ShieldCheck size={12} className="text-blue-400" />
              <span>LEXA ENTERPRISE PORTAL</span>
            </div>
          </div>
          
          <h1 className="text-xl sm:text-2xl font-bold text-center text-white tracking-tight mb-1.5">
            Lexa Admin Portal
          </h1>
          <p className="text-slate-400 text-center mb-7 text-xs sm:text-sm font-normal max-w-xs mx-auto">
            Masuk untuk mengelola modul AI, eskalasi percakapan, dan basis data pengetahuan.
          </p>
          
          {error && (
            <div className="bg-red-500/10 text-red-300 p-3 rounded-xl mb-6 text-xs font-medium border border-red-500/20 text-center">
              {error}
            </div>
          )}
          
          <form onSubmit={handleLogin} className="space-y-4">
            <div>
              <label className="block text-xs font-semibold text-slate-300 mb-1.5 ml-1">Email Address</label>
              <div className="relative">
                <Mail className="w-4 h-4 absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400" />
                <input 
                  type="email" 
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  className="w-full pl-10 pr-4 py-2.5 bg-[#060B18] border border-white/10 rounded-xl focus:outline-none focus:border-blue-500/60 focus:ring-1 focus:ring-blue-500/20 transition-all text-white placeholder-slate-500 text-sm shadow-inner"
                  placeholder="admin@lexatech.id"
                  required
                />
              </div>
            </div>
            
            <div>
              <label className="block text-xs font-semibold text-slate-300 mb-1.5 ml-1">Password</label>
              <div className="relative">
                <Lock className="w-4 h-4 absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400" />
                <input 
                  type={showPassword ? 'text' : 'password'}
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  className="w-full pl-10 pr-10 py-2.5 bg-[#060B18] border border-white/10 rounded-xl focus:outline-none focus:border-blue-500/60 focus:ring-1 focus:ring-blue-500/20 transition-all text-white placeholder-slate-500 text-sm shadow-inner"
                  placeholder="••••••••"
                  required
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-200 transition-colors p-1"
                  aria-label={showPassword ? 'Hide password' : 'Show password'}
                >
                  {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                </button>
              </div>
            </div>
            
            <button 
              type="submit" 
              disabled={loading}
              className="w-full py-3 bg-blue-600 hover:bg-blue-500 active:bg-blue-700 text-white font-semibold text-sm rounded-xl transition-all shadow-[0_4px_20px_rgba(37,99,235,0.4)] flex items-center justify-center gap-2 group mt-6 disabled:opacity-60 cursor-pointer active:scale-[0.98]"
            >
              {loading ? (
                <Loader2 className="w-4 h-4 animate-spin" />
              ) : (
                <>
                  <span>Sign In</span>
                  <span className="w-5 h-5 rounded-full bg-white/20 flex items-center justify-center transition-transform group-hover:translate-x-0.5">
                    <ArrowRight className="w-3 h-3" />
                  </span>
                </>
              )}
            </button>
          </form>

          <div className="mt-8 pt-5 border-t border-white/[0.06] text-center">
            <p className="text-[11px] text-slate-500 font-mono">
              © 2026 LEXA Software House • Leading eXcellence Automation
            </p>
          </div>
        </div>
      </div>
    </div>
  );
};

export default Login;
