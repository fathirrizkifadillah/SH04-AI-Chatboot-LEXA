import { Search, Bell, HelpCircle, Menu } from 'lucide-react';

const Header = () => {
  return (
    <header className="h-20 bg-white/50 backdrop-blur-md border-b border-slate-200/50 flex items-center justify-between px-8 sticky top-0 z-40">
      <div className="flex items-center gap-4">
        <button className="lg:hidden text-slate-500 hover:text-slate-800">
          <Menu className="w-6 h-6" />
        </button>
        <h2 className="text-lg font-semibold text-slate-800 hidden md:block">Dashboard</h2>
      </div>

      <div className="flex-1 max-w-xl px-8">
        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
          <input 
            type="text" 
            placeholder="Search anything..." 
            className="w-full bg-slate-100/50 border border-slate-200 text-sm rounded-full py-2.5 pl-10 pr-12 focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 transition-all"
          />
          <div className="absolute right-3 top-1/2 -translate-y-1/2 flex gap-1">
            <span className="text-[10px] font-medium text-slate-400 border border-slate-200 rounded px-1.5 py-0.5">⌘K</span>
          </div>
        </div>
      </div>

      <div className="flex items-center gap-5">
        <button className="text-slate-400 hover:text-slate-600 relative">
          <Bell className="w-5 h-5" />
          <span className="absolute 0 right-0 w-2 h-2 bg-red-500 border-2 border-white rounded-full"></span>
        </button>
        <button className="text-slate-400 hover:text-slate-600">
          <HelpCircle className="w-5 h-5" />
        </button>
        <div className="h-8 w-[1px] bg-slate-200"></div>
        <div className="flex items-center gap-3 cursor-pointer group">
          <div className="w-9 h-9 rounded-full bg-blue-600 flex items-center justify-center text-white font-medium group-hover:ring-4 ring-blue-500/20 transition-all">
            A
          </div>
          <div className="hidden md:block text-right">
            <p className="text-sm font-semibold text-slate-800 leading-tight">Admin LEXA</p>
            <p className="text-xs text-slate-500">Super Admin</p>
          </div>
        </div>
      </div>
    </header>
  );
};

export default Header;