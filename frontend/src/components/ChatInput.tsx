import { RefObject, KeyboardEvent, useRef, useEffect } from 'react';
import { Send, Paperclip, X, FileText } from 'lucide-react';

interface ChatInputProps {
  input: string;
  setInput: (val: string) => void;
  onSend: () => void;
  disabled: boolean;
  inputRef: RefObject<HTMLTextAreaElement | null>;
  selectedFile: File | null;
  onFileSelect: (file: File | null) => void;
}

export const ChatInput = ({ input, setInput, onSend, disabled, inputRef, selectedFile, onFileSelect }: ChatInputProps) => {
  const fileInputRef = useRef<HTMLInputElement>(null);
  const previewUrlRef = useRef<string | null>(null);

  // Cleanup object URL when file changes or component unmounts
  useEffect(() => {
    // Revoke previous URL if it exists
    if (previewUrlRef.current) {
      URL.revokeObjectURL(previewUrlRef.current);
      previewUrlRef.current = null;
    }

    // Create new URL if file is selected and is an image
    if (selectedFile && selectedFile.type.startsWith('image/')) {
      previewUrlRef.current = URL.createObjectURL(selectedFile);
    }

    // Cleanup on unmount
    return () => {
      if (previewUrlRef.current) {
        URL.revokeObjectURL(previewUrlRef.current);
      }
    };
  }, [selectedFile]);

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      if (file.size > 10 * 1024 * 1024) {
        alert('File terlalu besar (maks 10MB)');
        return;
      }
      onFileSelect(file);
    }
    e.target.value = '';
  };

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
      <input ref={fileInputRef} type="file" accept="image/*,.pdf,.txt,.docx" className="hidden" onChange={handleFileChange} />
      
      {selectedFile && (
        <div className="flex items-center gap-2 mb-2 px-1">
          {selectedFile.type.startsWith('image/') && previewUrlRef.current ? (
            <img src={previewUrlRef.current} alt="preview" className="w-12 h-12 object-cover rounded-lg border border-slate-200" />
          ) : (
            <div className="flex items-center gap-1.5 bg-slate-100 rounded-lg px-3 py-2">
              <FileText size={16} className="text-slate-500" />
              <span className="text-xs text-slate-600 max-w-[180px] truncate">{selectedFile.name}</span>
            </div>
          )}
          <button onClick={() => onFileSelect(null)} className="p-1 text-slate-400 hover:text-red-500 transition-colors" title="Hapus file">
            <X size={14} />
          </button>
        </div>
      )}

      <div className="flex items-end gap-2 sm:gap-3">
        <button
          type="button"
          onClick={() => fileInputRef.current?.click()}
          className="w-[40px] h-[40px] shrink-0 text-slate-400 hover:text-[#0D7AFF] hover:bg-slate-100 rounded-full flex items-center justify-center transition-colors"
          title="Lampirkan file"
          aria-label="Lampirkan file"
        >
          <Paperclip size={18} />
        </button>
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
