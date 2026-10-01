import { motion, AnimatePresence } from 'framer-motion';
import { Headphones, CheckCircle2 } from 'lucide-react';

interface EscalationBannerProps {
  isHandoffRequested: boolean;
  escalationShown: boolean;
  onRequestHandoff: () => void;
}

export const EscalationBanner = ({
  isHandoffRequested,
  escalationShown,
  onRequestHandoff,
}: EscalationBannerProps) => {
  return (
    <AnimatePresence>
      {isHandoffRequested ? (
        <motion.div
          initial={{ opacity: 0, height: 0 }}
          animate={{ opacity: 1, height: 'auto' }}
          exit={{ opacity: 0, height: 0 }}
          transition={{ duration: 0.25 }}
          className="px-4 py-2.5 bg-[#1C1408]/95 border-t border-amber-500/30 text-amber-200 shadow-md flex items-center justify-between gap-3 shrink-0"
        >
          <div className="flex items-center gap-2.5 min-w-0">
            <CheckCircle2 className="w-4 h-4 text-amber-400 shrink-0" />
            <div className="min-w-0">
              <p className="text-xs font-bold leading-tight truncate text-amber-200">
                Terhubung ke Antrean CS Manusia
              </p>
              <p className="text-[10px] text-amber-300/70 truncate font-mono">
                Staf admin telah menerima notifikasi sesi Anda.
              </p>
            </div>
          </div>
          <span className="px-2 py-0.5 rounded-full bg-amber-500/20 text-amber-300 border border-amber-500/40 text-[9px] font-mono uppercase tracking-wider shrink-0 font-semibold">
            CS AKTIF
          </span>
        </motion.div>
      ) : (
        <motion.div
          initial={{ opacity: 0, height: 0 }}
          animate={{ opacity: 1, height: 'auto' }}
          exit={{ opacity: 0, height: 0 }}
          transition={{ duration: 0.25 }}
          className={`px-4 py-2.5 flex items-center justify-between gap-3 shrink-0 border-t transition-all ${
            escalationShown
              ? 'bg-[#141C30]/95 border-amber-500/30 shadow-sm'
              : 'bg-[#0B1428]/90 border-white/[0.06]'
          }`}
        >
          <div className="flex items-center gap-2.5 min-w-0">
            <div className="w-6 h-6 rounded-lg bg-amber-500/10 border border-amber-500/20 flex items-center justify-center shrink-0">
              <Headphones className="w-3.5 h-3.5 text-amber-400" />
            </div>
            <span className="text-xs font-medium text-slate-300 truncate">
              {escalationShown ? 'Perlu konfirmasi langsung dengan staf CS?' : 'Butuh bantuan staf admin?'}
            </span>
          </div>
          <button
            onClick={onRequestHandoff}
            className={`px-3 py-1.5 text-xs font-semibold rounded-lg shadow-sm transition-all flex items-center gap-1.5 shrink-0 whitespace-nowrap cursor-pointer active:scale-[0.96] ${
              escalationShown
                ? 'bg-amber-500 hover:bg-amber-400 text-slate-950 font-bold'
                : 'bg-white/[0.06] hover:bg-white/[0.12] text-slate-200 border border-white/10'
            }`}
          >
            <Headphones className="w-3 h-3" />
            <span>Panggil CS</span>
          </button>
        </motion.div>
      )}
    </AnimatePresence>
  );
};

export default EscalationBanner;
