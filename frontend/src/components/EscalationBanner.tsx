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
          className="px-3 sm:px-4 py-2.5 bg-gradient-to-r from-amber-500 to-amber-600 text-white shadow-md flex items-center justify-between gap-2 shrink-0"
        >
          <div className="flex items-center gap-2 min-w-0">
            <CheckCircle2 className="w-4 h-4 text-amber-200 animate-pulse shrink-0" />
            <div className="min-w-0">
              <p className="text-[11px] sm:text-xs font-bold leading-tight truncate">Terhubung ke CS Manusia</p>
              <p className="text-[9px] sm:text-[10px] text-amber-100 truncate">Notifikasi telah dikirim ke Admin. Mohon tunggu balasan.</p>
            </div>
          </div>
          <span className="px-2 py-0.5 bg-white/20 rounded text-[10px] font-semibold uppercase tracking-wider shrink-0">
            Aktif
          </span>
        </motion.div>
      ) : (
        <motion.div
          initial={{ opacity: 0, height: 0 }}
          animate={{ opacity: 1, height: 'auto' }}
          exit={{ opacity: 0, height: 0 }}
          className={`px-3 sm:px-4 py-2.5 flex items-center justify-between gap-2 shrink-0 border-t transition-all ${
            escalationShown
              ? 'bg-amber-50/95 border-amber-200 shadow-sm'
              : 'bg-slate-50/90 border-slate-100'
          }`}
        >
          <div className="flex items-center gap-2 min-w-0">
            <Headphones className={`w-4 h-4 shrink-0 ${escalationShown ? 'text-amber-600 animate-bounce' : 'text-slate-500'}`} />
            <span className="text-[11px] sm:text-xs font-medium text-slate-700 truncate">
              {escalationShown ? 'Ingin berbicara langsung dengan CS?' : 'Butuh bantuan staf admin?'}
            </span>
          </div>
          <button
            onClick={onRequestHandoff}
            className={`px-2.5 sm:px-3 py-1.5 text-[11px] sm:text-xs font-bold rounded-lg shadow-sm transition-all flex items-center gap-1.5 shrink-0 whitespace-nowrap ${
              escalationShown
                ? 'bg-amber-500 hover:bg-amber-600 text-white animate-pulse'
                : 'bg-blue-600 hover:bg-blue-700 text-white'
            }`}
          >
            <Headphones className="w-3.5 h-3.5" />
            <span>Hubungi CS</span>
          </button>
        </motion.div>
      )}
    </AnimatePresence>
  );
};

export default EscalationBanner;
