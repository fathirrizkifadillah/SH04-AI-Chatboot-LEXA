import { motion } from 'framer-motion';

interface QuickRepliesProps {
  replies: string[];
  onSelect: (reply: string) => void;
}

export const QuickReplies = ({ replies, onSelect }: QuickRepliesProps) => {
  return (
    <motion.div
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.2 }}
      className="px-4 sm:px-5 pb-3 pt-1 flex flex-wrap gap-2 bg-[#080E20]/95 shrink-0"
    >
      {replies.map((text, i) => (
        <button
          key={i}
          onClick={() => onSelect(text)}
          className="px-3 py-1.5 bg-white/[0.04] hover:bg-blue-600/20 border border-white/[0.08] hover:border-blue-500/40 text-slate-300 hover:text-white text-xs font-medium rounded-full shadow-sm transition-all duration-200 active:scale-[0.96] text-left cursor-pointer"
        >
          {text}
        </button>
      ))}
    </motion.div>
  );
};

export default QuickReplies;
