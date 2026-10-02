import { Minus, RotateCcw, Headphones, Maximize2, Minimize2 } from 'lucide-react';

interface ChatHeaderProps {
  isRefreshing: boolean;
  onReset: () => void;
  onClose: () => void;
  botAvatar: string;
  onRequestHandoff?: () => void;
  isHandoffRequested?: boolean;
  isHandoffActive?: boolean;
  adminName?: string;
  isExpanded: boolean;
  onToggleExpanded: () => void;
  isSmallScreen: boolean;
  onDragStart?: (e: React.PointerEvent) => void;
}

export const ChatHeader = ({
  isRefreshing,
  onReset,
  onClose,
  botAvatar,
  onRequestHandoff,
  isHandoffRequested,
  isHandoffActive,
  adminName,
  isExpanded,
  onToggleExpanded,
  isSmallScreen,
  onDragStart,
}: ChatHeaderProps) => {
  return (
    <div
      onPointerDown={(e) => {
        if (!isSmallScreen && onDragStart) {
          // Hanya drag jika bukan tombol yang diklik
          if (!(e.target as HTMLElement).closest('button, a, input, textarea')) {
            onDragStart(e);
          }
        }
      }}
      className={`flex items-center justify-between px-3.5 sm:px-4 py-3 bg-[#0D182E] border-b border-white/[0.08] shrink-0 z-10 relative select-none ${
        isSmallScreen ? '' : 'cursor-grab active:cursor-grabbing'
      }`}
    >
      {/* Left: Identity & Status */}
      <div className="flex items-center gap-2.5 pointer-events-none min-w-0 flex-1">
        <div className="relative shrink-0">
          <div className="w-8 h-8 rounded-xl bg-white/[0.06] border border-white/10 p-1 flex items-center justify-center shadow-inner">
            <img src={botAvatar} alt="LEXA" className="w-full h-full object-contain filter drop-shadow-sm" />
          </div>
          <span className={`absolute -bottom-0.5 -right-0.5 w-2.5 h-2.5 rounded-full border-2 border-[#0D182E] ${
            isHandoffActive 
              ? 'bg-amber-400 shadow-[0_0_8px_rgba(245,158,11,0.6)]' 
              : 'bg-emerald-400 shadow-[0_0_8px_rgba(52,211,153,0.6)]'
          }`}></span>
        </div>
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-1.5 flex-nowrap">
            <h2 className="text-[13px] font-bold text-white tracking-tight leading-none whitespace-nowrap">
              {isHandoffActive && adminName ? adminName : 'LEXA AI'}
            </h2>
            <span className={`text-[8.5px] font-mono uppercase px-1.5 py-0.5 rounded border font-semibold tracking-wider whitespace-nowrap ${
              isHandoffActive 
                ? 'bg-amber-500/15 text-amber-300 border-amber-500/30'
                : isHandoffRequested
                ? 'bg-amber-500/10 text-amber-400 border-amber-500/20'
                : 'bg-blue-500/10 text-blue-400 border-blue-500/20'
            }`}>
              {isHandoffActive ? 'CS LIVE' : isHandoffRequested ? 'MENUNGGU CS' : 'AI BOT'}
            </span>
          </div>
          <p className="text-[10px] text-slate-400 font-medium mt-1 flex items-center gap-1.5 leading-none truncate">
            <span className={`w-1.5 h-1.5 rounded-full shrink-0 ${
              isHandoffActive ? 'bg-amber-400' : isHandoffRequested ? 'bg-amber-400 animate-pulse' : 'bg-emerald-400'
            }`}></span>
            <span className="truncate">
              {isHandoffActive 
                ? `Terhubung dengan ${adminName || 'Staf Admin'}` 
                : isHandoffRequested 
                ? 'Menghubungkan ke Tim CS...' 
                : 'Terhubung • Siap Membantu'}
            </span>
          </p>
        </div>
      </div>

      {/* Right: Action Controls */}
      <div className="flex items-center gap-1 z-20 shrink-0 ml-1">
        {onRequestHandoff && !isHandoffActive && (
          <button
            onClick={onRequestHandoff}
            className={`px-2 py-1 text-[11px] font-semibold rounded-lg flex items-center gap-1 transition-all cursor-pointer whitespace-nowrap active:scale-[0.95] ${
              isHandoffRequested
                ? 'bg-amber-500/20 text-amber-300 border border-amber-500/40 shadow-[0_0_12px_rgba(245,158,11,0.2)]'
                : 'bg-white/[0.05] hover:bg-white/[0.1] text-slate-200 border border-white/10 hover:text-white'
            }`}
            title={isHandoffRequested ? 'Menunggu respons CS' : 'Minta bantuan staf CS manusia'}
          >
            <Headphones size={12} className={isHandoffRequested ? 'animate-pulse text-amber-300' : 'text-slate-400'} />
            <span className="text-[10.5px]">{isHandoffRequested ? 'Menunggu' : 'CS'}</span>
          </button>
        )}

        {!isSmallScreen && (
          <button
            onClick={onToggleExpanded}
            className={`p-1.5 rounded-lg transition-all border cursor-pointer active:scale-[0.95] ${
              isExpanded 
                ? 'bg-blue-600/30 text-blue-300 border-blue-500/40 shadow-inner' 
                : 'text-slate-400 hover:text-white hover:bg-white/[0.06] border-transparent'
            }`}
            title={isExpanded ? 'Kecilkan jendela' : 'Perbesar jendela'}
            aria-label={isExpanded ? 'Minimize chat' : 'Maximize chat'}
          >
            {isExpanded ? <Minimize2 size={14} /> : <Maximize2 size={14} />}
          </button>
        )}

        <button
          onClick={onReset}
          className="p-1.5 text-slate-400 hover:text-white hover:bg-white/[0.06] rounded-lg transition-all border border-transparent cursor-pointer active:scale-[0.95]"
          title="Reset percakapan baru"
          aria-label="Reset chat"
        >
          <RotateCcw size={14} className={isRefreshing ? 'animate-spin text-blue-400' : ''} />
        </button>

        <button
          onClick={onClose}
          className="p-1.5 text-slate-400 hover:text-red-400 hover:bg-red-500/10 rounded-lg transition-all border border-transparent cursor-pointer active:scale-[0.95]"
          title="Tutup dialog chat"
          aria-label="Tutup"
        >
          <Minus size={14} />
        </button>
      </div>
    </div>
  );
};

export default ChatHeader;
