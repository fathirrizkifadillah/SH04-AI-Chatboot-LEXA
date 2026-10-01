import { RefObject, KeyboardEvent } from 'react';
import { Send } from 'lucide-react';

interface ChatInputProps {
  input: string;
  setInput: (val: string) => void;
  onSend: () => void;
  disabled: boolean;
  inputRef: RefObject<HTMLTextAreaElement | null>;
}

export const ChatInput = ({ input, setInput, onSend, disabled, inputRef }: ChatInputProps) => {
  const handleKeyDown = (e: KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      onSend();
    }
  };

  return (
    <div
      className="p-3 sm:p-4 bg-white/90 backdrop-blur-xl border-t border-slate-200/60 shrink-0 z-10 relative"
      style={{ paddingBottom: 'calc(0.75rem + env(safe-area-inset-bottom, 0px))' }}
    >
      <div className="flex items-end gap-2 sm:gap-3">
        <textarea
          ref={inputRef}
          value={input}
          onChange={(e) => setInput(e.target.value)}
          onKeyDown={handleKeyDown}
          placeholder="Ketik pertanyaan Anda..."
          className="flex-1 max-h-[120px] min-h-[48px] bg-[#F5F7FA] border border-[#C0C9D5]/60 focus:border-[#0D7AFF] focus:ring-2 focus:ring-[#0D7AFF]/10 focus:bg-white rounded-[24px] px-4 sm:px-5 py-3.5 text-[16px] sm:text-[14px] text-slate-700 outline-none resize-none transition-all"
          rows={1}
        />
        <button
          onClick={onSend}
          disabled={disabled}
          className="w-[48px] h-[48px] shrink-0 bg-[#0D7AFF] hover:bg-[#0B6FE8] disabled:bg-slate-200 disabled:text-slate-400 text-white rounded-full flex items-center justify-center shadow-md shadow-[#0D7AFF]/30 transition-all active:scale-95"
          aria-label="Kirim pesan"
        >
          <Send size={18} className="ml-1" />
        </button>
      </div>
      <div className="text-center mt-3 mb-1">
        <span
          className="text-[9px] text-slate-400 font-bold tracking-widest uppercase"
          style={{ fontSize: typeof window !== 'undefined' && window.innerWidth < 480 ? '8px' : '9px' }}
        >
          Powered by LEXA Software House
        </span>
      </div>
    </div>
  );
};

export default ChatInput;
