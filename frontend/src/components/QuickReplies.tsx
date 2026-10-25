import { motion } from 'framer-motion';

interface QuickRepliesProps {
  replies: string[];
  onSelect: (reply: string) => void;
  onClose?: () => void;
}

export const QuickReplies = ({ replies, onSelect }: QuickRepliesProps) => {
  if (!replies || replies.length === 0) return null;

  return (
    <motion.div
      initial={{ opacity: 0, y: 6 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: 6 }}
      transition={{ duration: 0.18 }}
      className="px-3 sm:px-4 py-2 flex flex-wrap items-center gap-1.5 bg-[#080E20]/95 border-t border-white/[0.06] shrink-0 select-none max-h-24 overflow-y-auto scrollbar-hidden"
    >
      <span className="text-[10px] uppercase font-mono tracking-wider text-slate-400 shrink-0 font-semibold pl-0.5 mr-0.5">
        Saran:
      </span>
      {replies.map((text, i) => (
        <button
          key={i}
          type="button"
          onClick={() => onSelect(text)}
          className="px-3 py-1 bg-white/[0.06] hover:bg-[#0066FF]/20 border border-white/10 hover:border-[#0066FF]/50 text-slate-200 hover:text-white text-xs font-medium rounded-full shadow-xs transition-all duration-150 active:scale-[0.97] focus:outline-none focus:ring-2 focus:ring-[#0066FF] text-left cursor-pointer"
        >
          {text}
        </button>
      ))}
    </motion.div>
  );
};

export default QuickReplies;
