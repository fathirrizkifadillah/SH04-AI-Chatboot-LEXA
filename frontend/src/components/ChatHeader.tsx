import { Minus, RotateCcw, GripHorizontal } from 'lucide-react';

interface ChatHeaderProps {
  isRefreshing: boolean;
  onReset: () => void;
  onClose: () => void;
  botAvatar: string;
}

export const ChatHeader = ({ isRefreshing, onReset, onClose, botAvatar }: ChatHeaderProps) => {
  return (
    <div className="cursor-grab active:cursor-grabbing flex items-center justify-between px-5 py-4 border-b border-slate-100 bg-white/80 shrink-0 z-10 relative">
      <div className="absolute top-1.5 left-1/2 -translate-x-1/2 text-slate-300">
        <GripHorizontal size={24} />
      </div>
      <div className="flex items-center gap-3 mt-1 pointer-events-none">
        <div className="relative">
          <img src={botAvatar} alt="Lexa Avatar" className="w-11 h-11 object-contain drop-shadow-sm" />
          <div className="absolute bottom-0 right-0 w-3 h-3 bg-green-500 border-2 border-white rounded-full"></div>
        </div>
        <div>
          <h2 className="text-[15px] font-bold text-slate-800 leading-tight">Lexa Chat Widget V5</h2>
          <p className="text-xs text-green-500 font-medium mt-0.5">Online</p>
        </div>
      </div>
      <div className="flex gap-1 mt-1 z-20">
        <button
          onClick={onReset}
          className="p-2 text-slate-400 hover:text-blue-600 hover:bg-blue-50 rounded-lg transition-colors"
          title="Refresh/Reset"
        >
          <RotateCcw size={18} className={isRefreshing ? 'animate-spin text-blue-600' : ''} />
        </button>
        <button
          onClick={onClose}
          className="p-2 text-slate-400 hover:text-red-500 hover:bg-red-50 rounded-lg transition-colors"
          title="Tutup"
        >
          <Minus size={18} />
        </button>
      </div>
    </div>
  );
};

export default ChatHeader;
