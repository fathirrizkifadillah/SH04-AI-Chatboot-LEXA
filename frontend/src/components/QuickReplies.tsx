import { motion } from 'framer-motion';

interface QuickRepliesProps {
  replies: string[];
  onSelect: (reply: string) => void;
}

export const QuickReplies = ({ replies, onSelect }: QuickRepliesProps) => {
  return (
    <motion.div
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      className="px-5 pb-4 pt-1 flex flex-wrap gap-2 bg-slate-50/50 shrink-0"
    >
      {replies.map((text, i) => (
        <button
          key={i}
          onClick={() => onSelect(text)}
          className="px-4 py-2 bg-white/80 backdrop-blur-sm border border-blue-200 text-blue-600 hover:bg-blue-600 hover:text-white text-[13px] font-medium rounded-full shadow-sm transition-all active:scale-95 text-left"
        >
          {text}
        </button>
      ))}
    </motion.div>
  );
};

export default QuickReplies;
