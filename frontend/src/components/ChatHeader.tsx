import { Minus, RotateCcw, GripHorizontal, Headphones } from 'lucide-react';

interface ChatHeaderProps {
  isRefreshing: boolean;
  onReset: () => void;
  onClose: () => void;
  botAvatar: string;
  onRequestHandoff?: () => void;
  isHandoffRequested?: boolean;
}

export const ChatHeader = ({
  isRefreshing,
  onReset,
  onClose,
  botAvatar,
  onRequestHandoff,
  isHandoffRequested,
}: ChatHeaderProps) => {
  return (
    <div className="cursor-grab active:cursor-grabbing flex items-center justify-between px-3 sm:px-5 py-3 sm:py-4 border-b border-slate-100 bg-white/80 shrink-0 z-10 relative gap-2">
      <div className="absolute top-1.5 left-1/2 -translate-x-1/2 text-slate-300 hidden sm:block">
        <GripHorizontal size={24} />
      </div>
      <div className="flex items-center gap-2 sm:gap-3 mt-1 pointer-events-none min-w-0">
        <div className="relative shrink-0">
          <img src={botAvatar} alt="Lexa Avatar" className="w-9 h-9 sm:w-11 sm:h-11 object-contain drop-shadow-sm" />
          <div className="absolute bottom-0 right-0 w-2.5 h-2.5 sm:w-3 sm:h-3 bg-green-500 border-2 border-white rounded-full"></div>
        </div>
        <div className="min-w-0">
          <h2 className="text-[13px] sm:text-[15px] font-bold text-slate-800 leading-tight truncate">Lexa Chat Widget</h2>
          <p className="text-[10px] sm:text-xs text-green-500 font-medium mt-0.5">Online</p>
        </div>
      </div>
      <div className="flex items-center gap-1 sm:gap-1.5 mt-1 z-20 shrink-0">
        {onRequestHandoff && (
          <button
            onClick={onRequestHandoff}
            className={`px-2 sm:px-2.5 py-1 text-[11px] sm:text-xs font-semibold rounded-lg flex items-center gap-1 transition-all whitespace-nowrap ${
              isHandoffRequested
                ? 'bg-amber-100 text-amber-700 border border-amber-200 cursor-default'
                : 'bg-blue-50 hover:bg-blue-100 text-blue-600 border border-blue-100'
            }`}
            title={isHandoffRequested ? "Menunggu CS Manusia" : "Bicara Langsung dengan Admin CS"}
          >
            <Headphones size={13} className={isHandoffRequested ? 'animate-pulse' : ''} />
            <span className="hidden xs:inline sm:inline">{isHandoffRequested ? 'Menunggu CS' : 'Chat CS'}</span>
          </button>
        )}
        <button
          onClick={onReset}
          className="p-1.5 text-slate-400 hover:text-blue-600 hover:bg-blue-50 rounded-lg transition-colors shrink-0"
          title="Refresh/Reset"
        >
          <RotateCcw size={16} className={isRefreshing ? 'animate-spin text-blue-600' : ''} />
        </button>
        <button
          onClick={onClose}
          className="p-1.5 text-slate-400 hover:text-red-500 hover:bg-red-50 rounded-lg transition-colors shrink-0"
          title="Tutup"
        >
          <Minus size={16} />
        </button>
      </div>
    </div>
  );
};

export default ChatHeader;
