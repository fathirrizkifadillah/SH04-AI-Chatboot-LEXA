import { Minus, RotateCcw, GripHorizontal, Headphones, Maximize2, Minimize2 } from 'lucide-react';

interface ChatHeaderProps {
  isRefreshing: boolean;
  onReset: () => void;
  onClose: () => void;
  botAvatar: string;
  onRequestHandoff?: () => void;
  isHandoffRequested?: boolean;
  isExpanded: boolean;
  onToggleExpanded: () => void;
  isSmallScreen: boolean;
}

export const ChatHeader = ({
  isRefreshing,
  onReset,
  onClose,
  botAvatar,
  onRequestHandoff,
  isHandoffRequested,
  isExpanded,
  onToggleExpanded,
  isSmallScreen,
}: ChatHeaderProps) => {
  return (
    <div className="cursor-grab active:cursor-grabbing flex items-center justify-between px-3 sm:px-5 py-3 sm:py-4 bg-[#0A1F44] border-b border-[#1B3B6F]/30 shrink-0 z-10 relative gap-2">
      <div className="absolute top-1.5 left-1/2 -translate-x-1/2 text-white/40 hidden sm:block">
        <GripHorizontal size={24} />
      </div>
      <div className="flex items-center gap-2.5 sm:gap-3 mt-1 pointer-events-none min-w-0">
        <div className="relative shrink-0">
          <div className="w-9 h-9 sm:w-10 sm:h-10 rounded-xl bg-white/10 p-1 flex items-center justify-center border border-white/20">
            <img src={botAvatar} alt="LEXA" className="w-full h-full object-contain" />
          </div>
          <div className="absolute -bottom-0.5 -right-0.5 w-3 h-3 bg-emerald-500 border-2 border-[#0A1F44] rounded-full"></div>
        </div>
        <div className="min-w-0">
          <div className="flex items-center gap-1.5">
            <h2 className="text-[13px] sm:text-[14px] font-bold text-white leading-tight truncate">LEXA AI Assistant</h2>
          </div>
          <p className="text-[10px] sm:text-xs text-emerald-400 font-medium mt-0.5 flex items-center gap-1">
            <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse"></span>
            <span>Online</span>
          </p>
        </div>
      </div>
      <div className="flex items-center gap-1 sm:gap-1.5 mt-1 z-20 shrink-0">
        {onRequestHandoff && (
          <button
            onClick={onRequestHandoff}
            className={`px-2 sm:px-2.5 py-1 text-[11px] sm:text-xs font-semibold rounded-lg flex items-center gap-1 transition-all whitespace-nowrap ${
              isHandoffRequested
                ? 'bg-amber-100 text-amber-700 border border-amber-200 cursor-default'
                : 'bg-white/10 hover:bg-white/20 text-white border border-white/20'
            }`}
            title={isHandoffRequested ? "Menunggu CS Manusia" : "Bicara Langsung dengan Admin CS"}
          >
            <Headphones size={13} className={isHandoffRequested ? 'animate-pulse' : ''} />
            <span className="hidden xs:inline sm:inline">{isHandoffRequested ? 'Menunggu CS' : 'Hubungi CS'}</span>
          </button>
        )}
        {!isSmallScreen && (
          <button
            onClick={onToggleExpanded}
            className={`p-1.5 rounded-lg transition-all shrink-0 ${
              isExpanded 
                ? 'bg-[#0066FF] text-white shadow-md' 
                : 'text-white/70 hover:text-white hover:bg-white/10'
            }`}
            title={isExpanded ? 'Kembalikan ke ukuran standar' : 'Perbesar jendela chat (Leluasa)'}
            aria-label={isExpanded ? 'Minimize chat' : 'Maximize chat'}
          >
            {isExpanded ? <Minimize2 size={16} /> : <Maximize2 size={16} />}
          </button>
        )}
        <button
          onClick={onReset}
          className="p-1.5 text-white/60 hover:text-white hover:bg-white/10 rounded-lg transition-colors shrink-0"
          title="Refresh/Reset"
        >
          <RotateCcw size={16} className={isRefreshing ? 'animate-spin text-[#0D7AFF]' : ''} />
        </button>
        <button
          onClick={onClose}
          className="p-1.5 text-white/60 hover:text-white hover:bg-red-500/20 rounded-lg transition-colors shrink-0"
          title="Tutup"
        >
          <Minus size={16} />
        </button>
      </div>
    </div>
  );
};

export default ChatHeader;
