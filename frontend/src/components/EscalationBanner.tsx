import { motion, AnimatePresence } from 'framer-motion';
import { Headphones } from 'lucide-react';

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
          className="px-5 py-3 bg-blue-50/90 backdrop-blur-md border-t border-blue-200 flex items-center gap-3 shrink-0"
        >
          <Headphones className="w-5 h-5 text-blue-600 shrink-0" />
          <div className="flex-1">
            <p className="text-xs font-semibold text-blue-800">Menunggu CS Manusia</p>
            <p className="text-[10px] text-blue-600">Tim kami akan segera merespon.</p>
          </div>
        </motion.div>
      ) : (
        escalationShown && (
          <motion.div
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: 'auto' }}
            exit={{ opacity: 0, height: 0 }}
            className="px-5 py-3 bg-amber-50/90 backdrop-blur-md border-t border-amber-200 flex items-center justify-between shrink-0"
          >
            <span className="text-xs font-semibold text-amber-800">Butuh bantuan manusia?</span>
            <button
              onClick={onRequestHandoff}
              className="px-4 py-2 bg-amber-500 hover:bg-amber-600 text-white text-[11px] font-bold uppercase tracking-wider rounded-lg shadow-sm transition-colors flex items-center gap-1.5"
            >
              <Headphones className="w-3.5 h-3.5" />
              Chat CS
            </button>
          </motion.div>
        )
      )}
    </AnimatePresence>
  );
};

export default EscalationBanner;
