import { useState, FormEvent } from 'react';
import { Lock, Mail, Loader2, ArrowRight, Eye, EyeOff } from 'lucide-react';
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
    <div className="min-h-screen flex items-center justify-center bg-[#080E21] relative overflow-hidden text-slate-100 antialiased selection:bg-[#0066FF] selection:text-white px-4 py-8">
      {/* Ambient background glows */}
      <div className="absolute -top-40 -left-40 w-[600px] h-[600px] bg-[#0066FF]/15 rounded-full blur-[140px] pointer-events-none"></div>
      <div className="absolute -bottom-40 -right-40 w-[600px] h-[600px] bg-[#1B3B6F]/25 rounded-full blur-[160px] pointer-events-none"></div>
      <div className="absolute inset-0 bg-[radial-gradient(#1e293b_1px,transparent_1px)] [background-size:24px_24px] opacity-25 pointer-events-none"></div>

      <div className="w-full max-w-md p-8 sm:p-10 bg-[#0D182E]/90 backdrop-blur-xl rounded-3xl shadow-2xl border border-white/10 relative z-10">
        {/* Brand Logo Presentation */}
        <div className="flex flex-col items-center mb-6">
          <div className="p-2.5 bg-white rounded-2xl shadow-xl border border-white/20 mb-4 inline-flex items-center justify-center">
            <img 
              src="/lexa_logo.jpeg" 
              alt="LEXA SOFTWARE HOUSE" 
              className="h-12 sm:h-14 w-auto object-contain" 
            />
          </div>
          <span className="text-[11px] font-semibold uppercase tracking-[0.2em] text-[#0066FF] bg-[#0066FF]/10 px-3 py-1 rounded-full border border-[#0066FF]/20">
            Enterprise Console
          </span>
        </div>
        
        <h1 className="text-2xl sm:text-3xl font-bold text-center text-white tracking-tight mb-2">Lexa Admin Portal</h1>
        <p className="text-slate-400 text-center mb-8 text-xs sm:text-sm font-normal">
          Sign in to manage AI modules, conversations & analytics
        </p>
        
        {error && (
          <div className="bg-red-500/10 text-red-300 p-3 rounded-xl mb-6 text-xs sm:text-sm font-medium border border-red-500/20 text-center">
            {error}
          </div>
        )}
        
        <form onSubmit={handleLogin} className="space-y-4">
          <div>
            <label className="block text-xs font-semibold text-slate-300 mb-1.5 ml-1">Email Address</label>
            <div className="relative">
              <Mail className="w-4 h-4 absolute left-4 top-1/2 -translate-y-1/2 text-slate-400" />
              <input 
                type="email" 
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className="w-full pl-11 pr-4 py-3 bg-[#080E21]/80 border border-slate-700/80 rounded-xl focus:outline-none focus:ring-2 focus:ring-[#0066FF]/30 focus:border-[#0066FF] transition-all text-white placeholder-slate-500 text-sm"
                placeholder="admin@lexatech.id"
                required
              />
            </div>
          </div>
          
          <div>
            <label className="block text-xs font-semibold text-slate-300 mb-1.5 ml-1">Password</label>
            <div className="relative">
              <Lock className="w-4 h-4 absolute left-4 top-1/2 -translate-y-1/2 text-slate-400" />
              <input 
                type={showPassword ? 'text' : 'password'}
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className="w-full pl-11 pr-11 py-3 bg-[#080E21]/80 border border-slate-700/80 rounded-xl focus:outline-none focus:ring-2 focus:ring-[#0066FF]/30 focus:border-[#0066FF] transition-all text-white placeholder-slate-500 text-sm"
                placeholder="••••••••"
                required
              />
              <button
                type="button"
                onClick={() => setShowPassword(!showPassword)}
                className="absolute right-3.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-200 transition-colors p-1"
                aria-label={showPassword ? 'Hide password' : 'Show password'}
              >
                {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
              </button>
            </div>
          </div>
          
          <button 
            type="submit" 
            disabled={loading}
            className="w-full py-3.5 bg-[#0066FF] hover:bg-[#0055D6] active:bg-[#0047B3] text-white font-semibold text-sm rounded-xl transition-all shadow-lg shadow-[#0066FF]/25 flex items-center justify-center gap-2 group mt-6 disabled:opacity-60 cursor-pointer"
          >
            {loading ? <Loader2 className="w-5 h-5 animate-spin" /> : (
              <>
                <span>Sign In</span>
                <ArrowRight className="w-4 h-4 group-hover:translate-x-1 transition-transform" />
              </>
            )}
          </button>
        </form>

        <div className="mt-8 pt-6 border-t border-slate-800 text-center">
          <p className="text-[11px] text-slate-500">
            © 2026 LEXA Software House • Leading eXcellence Automation
          </p>
        </div>
      </div>
    </div>
  );
};

export default Login;
