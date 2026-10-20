import { motion } from 'framer-motion';

interface QuickRepliesProps {
  replies: string[];
  onSelect: (reply: string) => void;
  onClose?: () => void;
}

export const QuickReplies = ({ replies, onSelect }: QuickRepliesProps) => {
  return (
    <motion.div
      initial={{ opacity: 0, y: 6 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: 6 }}
      transition={{ duration: 0.18 }}
      className="px-3.5 sm:px-4 py-2 flex flex-wrap items-center gap-1.5 bg-[#080E20]/95 border-t border-white/[0.06] shrink-0 select-none"
    >
      <span className="text-[10px] uppercase font-mono tracking-wider text-slate-500 shrink-0 font-semibold pl-0.5 mr-0.5">
        Saran:
      </span>
      {replies.map((text, i) => (
        <button
          key={i}
          onClick={() => onSelect(text)}
          className="px-2.5 py-1 bg-white/[0.05] hover:bg-blue-600/25 border border-white/10 hover:border-blue-500/40 text-slate-200 hover:text-white text-xs font-medium rounded-full shadow-xs transition-all duration-150 active:scale-[0.96] text-left cursor-pointer"
        >
          {text}
        </button>
      ))}
    </motion.div>
  );
};

export default QuickReplies;
