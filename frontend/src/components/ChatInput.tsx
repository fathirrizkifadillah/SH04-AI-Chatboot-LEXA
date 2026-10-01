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
    if (previewUrlRef.current) {
      URL.revokeObjectURL(previewUrlRef.current);
      previewUrlRef.current = null;
    }

    if (selectedFile && selectedFile.type.startsWith('image/')) {
      previewUrlRef.current = URL.createObjectURL(selectedFile);
    }

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
        alert('File terlalu besar (maksimal 10MB)');
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
      className="p-3 sm:p-4 bg-[#0A1224]/95 backdrop-blur-2xl border-t border-white/[0.08] shrink-0 z-10 relative"
      style={{ paddingBottom: 'calc(0.75rem + env(safe-area-inset-bottom, 0px))' }}
    >
      <input ref={fileInputRef} type="file" accept="image/*,.pdf,.txt,.docx" className="hidden" onChange={handleFileChange} />
      
      {/* Attached File Preview Chip */}
      {selectedFile && (
        <div className="flex items-center gap-2 mb-2 px-1">
          {selectedFile.type.startsWith('image/') && previewUrlRef.current ? (
            <div className="relative group">
              <img src={previewUrlRef.current} alt="preview" className="w-11 h-11 object-cover rounded-xl border border-white/20 shadow-md" />
              <button 
                onClick={() => onFileSelect(null)} 
                className="absolute -top-1.5 -right-1.5 w-4 h-4 rounded-full bg-red-500 hover:bg-red-600 text-white flex items-center justify-center transition-all shadow"
                title="Hapus gambar"
              >
                <X size={10} />
              </button>
            </div>
          ) : (
            <div className="flex items-center gap-2 bg-white/[0.06] border border-white/10 rounded-xl px-3 py-1.5">
              <FileText size={15} className="text-blue-400" />
              <span className="text-xs text-slate-200 max-w-[180px] truncate font-mono">{selectedFile.name}</span>
              <button 
                onClick={() => onFileSelect(null)} 
                className="p-0.5 text-slate-400 hover:text-red-400 transition-colors ml-1" 
                title="Hapus file"
              >
                <X size={13} />
              </button>
            </div>
          )}
        </div>
      )}

      {/* Input Action Controls */}
      <div className="flex items-end gap-2">
        <button
          type="button"
          onClick={() => fileInputRef.current?.click()}
          className="w-10 h-10 shrink-0 text-slate-400 hover:text-white hover:bg-white/[0.06] border border-transparent hover:border-white/10 rounded-xl flex items-center justify-center transition-all cursor-pointer active:scale-[0.95]"
          title="Lampirkan berkas (PDF, DOCX, TXT, Gambar)"
          aria-label="Lampirkan berkas"
        >
          <Paperclip size={17} />
        </button>

        <textarea
          ref={inputRef}
          value={input}
          onChange={(e) => setInput(e.target.value)}
          onKeyDown={handleKeyDown}
          placeholder="Ketik pertanyaan atau perintah Anda..."
          className="flex-1 max-h-[120px] min-h-[44px] bg-[#060D1E] border border-white/10 focus:border-blue-500/50 focus:ring-1 focus:ring-blue-500/20 rounded-2xl px-4 py-3 text-[14px] text-white placeholder-slate-500 outline-none resize-none transition-all shadow-inner leading-relaxed"
          rows={1}
        />

        <button
          onClick={onSend}
          disabled={disabled}
          className="w-10 h-10 shrink-0 bg-blue-600 hover:bg-blue-500 disabled:bg-white/[0.04] disabled:text-slate-600 disabled:border-transparent text-white rounded-xl flex items-center justify-center shadow-[0_0_16px_rgba(37,99,235,0.4)] disabled:shadow-none transition-all active:scale-[0.95] cursor-pointer"
          aria-label="Kirim pesan"
        >
          <Send size={15} />
        </button>
      </div>

      <div className="flex items-center justify-between mt-2.5 px-1 text-[10px] text-slate-500 font-mono">
        <span>LEXA Engine v2.4</span>
        <span className="text-[9px] uppercase tracking-wider text-slate-600">Enterprise Edition</span>
      </div>
    </div>
  );
};

export default ChatInput;
