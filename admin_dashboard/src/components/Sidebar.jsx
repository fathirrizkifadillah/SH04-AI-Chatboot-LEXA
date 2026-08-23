import React from 'react';
import { LayoutDashboard, MessageSquare, BookOpen, BarChart3, Users, Settings, Bot } from 'lucide-react';
import { Link, useLocation } from 'react-router-dom';

const Sidebar = () => {
  const location = useLocation();

  const navItems = [
    { name: 'Dashboard', icon: LayoutDashboard, path: '/' },
    { name: 'Conversations', icon: MessageSquare, path: '/conversations' },
    { name: 'Knowledge Base', icon: BookOpen, path: '/kb' },
    { name: 'Analytics', icon: BarChart3, path: '/analytics' },
    { name: 'Users & Roles', icon: Users, path: '/users' },
    { name: 'Settings', icon: Settings, path: '/settings' },
  ];

  return (
    <aside className="w-64 bg-slate-900 text-white flex flex-col h-screen fixed left-0 top-0 shadow-2xl">
      <Link to="/" className="p-6 flex items-center gap-3 hover:opacity-80 transition-opacity">
        <div className="bg-white p-1.5 rounded-xl flex items-center justify-center shadow-lg">
          <img src="/lexa_chatbot_logo.png" alt="Lexa Logo" className="w-8 h-8 object-contain" />
        </div>
        <div>
          <h1 className="text-xl font-bold tracking-tight text-white">LEXA</h1>
          <p className="text-[10px] text-blue-300 font-medium tracking-widest uppercase">AI Platform</p>
        </div>
      </Link>

      <nav className="flex-1 px-4 space-y-1 overflow-y-auto mt-4">
        {navItems.map((item) => {
          const isActive = location.pathname === item.path;
          return (
            <Link
              key={item.name}
              to={item.path}
              className={`flex items-center gap-3 px-4 py-3 rounded-xl transition-all duration-200 ${
                isActive
                  ? 'bg-blue-600 text-white font-medium shadow-lg shadow-blue-600/20'
                  : 'text-slate-400 hover:bg-white/5 hover:text-white'
              }`}
            >
              <item.icon className={`w-5 h-5 ${isActive ? 'text-white' : 'text-slate-400'}`} />
              <span className="text-sm">{item.name}</span>
            </Link>
          );
        })}
      </nav>

      <div className="p-6 mt-auto">
        <div className="bg-white/5 rounded-2xl p-4 relative overflow-hidden group border border-white/10 shadow-lg">
          <div className="absolute inset-0 bg-gradient-to-br from-blue-600/30 to-purple-600/30 opacity-0 group-hover:opacity-100 transition-opacity" />
          <div className="relative z-10 flex flex-col items-center text-center gap-2">
            <div className="w-16 h-16 rounded-full flex items-center justify-center">
              <img src="/lexa_bot.png" alt="Lexa Bot" className="w-full h-full object-contain drop-shadow-xl" />
            </div>
            <h3 className="font-semibold text-sm">LEXA CS Bot</h3>
            <p className="text-[11px] text-slate-300/80 leading-tight">Smarter Answers, Better Experiences</p>
            <button className="mt-2 w-full py-2 bg-white/10 hover:bg-white/20 text-xs font-medium rounded-lg transition-colors border border-white/10">
              Documentation
            </button>
          </div>
        </div>
        <p className="text-[10px] text-slate-500 text-center mt-4">
          © 2026 LEXA Technology<br/>All rights reserved.
        </p>
      </div>
    </aside>
  );
};

export default Sidebar;
