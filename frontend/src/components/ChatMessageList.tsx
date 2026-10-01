import { RefObject, useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import { ThumbsUp, ThumbsDown, FileText, FileType, ZoomIn, X, Download, Headphones, Sparkles } from 'lucide-react';
import type { Message } from '../types/api';

export interface ChatMessage extends Message {
  id: number;
}

interface ChatMessageListProps {
  messages: ChatMessage[];
  isStreaming: boolean;
  isWaitingForResponse: boolean;
  isAdminTyping: boolean;
  feedbackGiven: Record<number, 'thumbs_up' | 'thumbs_down'>;
  onFeedback: (idx: number, rating: 'thumbs_up' | 'thumbs_down') => void;
  botAvatar: string;
  messagesEndRef: RefObject<HTMLDivElement | null>;
}

export const ChatMessageList = ({
  messages,
  isStreaming,
  isWaitingForResponse,
  isAdminTyping,
  feedbackGiven,
  onFeedback,
  botAvatar,
  messagesEndRef,
}: ChatMessageListProps) => {
  const [previewImage, setPreviewImage] = useState<string | null>(null);
  const [previewImageName, setPreviewImageName] = useState<string | null>(null);

  return (
    <div className="flex-1 overflow-y-auto custom-scrollbar p-4 sm:p-5 space-y-5 bg-[#080E20]/95 scroll-smooth relative">
      <AnimatePresence>
        {messages.map((msg, idx) => {
          const isUser = msg.role === 'user';
          const isAdmin = msg.role === 'admin';
          const isBot = !isUser && !isAdmin;
          const feedbackStatus = feedbackGiven[idx];

          return (
            <motion.div
              key={msg.id || idx}
              initial={{ opacity: 0, y: 12 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.25, ease: [0.16, 1, 0.3, 1] }}
              className={`flex gap-3 max-w-[88%] sm:max-w-[82%] ${isUser ? 'ml-auto flex-row-reverse' : ''}`}
            >
              {!isUser && (
                <div className="w-8 h-8 rounded-xl bg-white/[0.05] border border-white/10 p-1 shrink-0 flex items-center justify-center mt-1 shadow-inner">
                  {isAdmin ? (
                    <Headphones size={15} className="text-amber-400" />
                  ) : (
                    <img
                      src={botAvatar}
                      alt="LEXA"
                      width={28}
                      height={28}
                      style={{ width: '28px', height: '28px', maxWidth: '28px', maxHeight: '28px', objectFit: 'contain' }}
                      className="filter drop-shadow-sm select-none"
                    />
                  )}
                </div>
              )}

              <div className={`flex flex-col gap-1.5 ${isUser ? 'items-end' : 'items-start'}`}>
                {/* Sender Tag */}
                {!isUser && (
                  <div className="flex items-center gap-1.5 px-1">
                    {isAdmin ? (
                      <span className="text-[10px] font-semibold text-amber-400 flex items-center gap-1">
                        <span className="w-1.5 h-1.5 rounded-full bg-amber-400"></span>
                        Staf CS Manusia
                      </span>
                    ) : (
                      <span className="text-[10px] font-semibold text-blue-400 flex items-center gap-1">
                        <Sparkles size={11} className="text-blue-400" />
                        LEXA AI
                      </span>
                    )}
                  </div>
                )}

                {/* Message Body */}
                <div
                  style={{
                    backgroundColor: isUser ? '#1D4ED8' : isAdmin ? '#241A0B' : '#0E1A33',
                    color: isUser ? '#FFFFFF' : isAdmin ? '#FEF3C7' : '#E2E8F0',
                  }}
                  className={`px-4 py-3 text-[13.5px] leading-[1.65] shadow-sm break-words whitespace-pre-wrap ${
                    isUser
                      ? 'rounded-2xl rounded-tr-xs border border-blue-400/25 shadow-[0_4px_16px_rgba(29,78,216,0.3)]'
                      : isAdmin
                        ? 'rounded-2xl rounded-tl-xs border border-amber-500/30 shadow-[0_4px_20px_rgba(0,0,0,0.3)] markdown-body'
                        : 'rounded-2xl rounded-tl-xs border border-white/[0.08] shadow-[0_4px_20px_rgba(0,0,0,0.3)] markdown-body'
                  }`}
                >
                  {isUser ? (
                    msg.content
                  ) : (
                    <ReactMarkdown remarkPlugins={[remarkGfm]}>
                      {msg.content}
                    </ReactMarkdown>
                  )}
                </div>

                {/* File Attachment Presentation */}
                {msg.file && (
                  <div className="mt-1">
                    {msg.file.type.startsWith('image/') && msg.file.url ? (
                      <div
                        className="relative group rounded-xl overflow-hidden border border-white/10 cursor-pointer shadow-lg max-w-[220px] bg-black/40"
                        onClick={() => {
                          setPreviewImage(msg.file?.url || '');
                          setPreviewImageName(msg.file?.name || 'Gambar');
                        }}
                      >
                        <img
                          src={msg.file.url}
                          alt={msg.file.name}
                          className="max-h-48 w-auto object-cover group-hover:scale-105 transition-transform duration-300"
                        />
                        <div className="absolute inset-0 bg-black/50 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center gap-1.5 text-white backdrop-blur-[2px]">
                          <ZoomIn size={15} />
                          <span className="text-[11px] font-semibold">Perbesar</span>
                        </div>
                      </div>
                    ) : (
                      <div className="flex items-center gap-2 bg-white/[0.04] border border-white/[0.08] rounded-xl px-3 py-2">
                        {msg.file.type === 'application/pdf' ? (
                          <>
                            <FileText size={15} className="text-red-400" />
                            <span className="text-xs text-slate-200 max-w-[170px] truncate">{msg.file.name}</span>
                            <span className="text-[10px] font-mono px-1 rounded bg-red-500/10 text-red-300 border border-red-500/20">PDF</span>
                          </>
                        ) : msg.file.type === 'application/vnd.openxmlformats-officedocument.wordprocessingml.document' ? (
                          <>
                            <FileText size={15} className="text-blue-400" />
                            <span className="text-xs text-slate-200 max-w-[170px] truncate">{msg.file.name}</span>
                            <span className="text-[10px] font-mono px-1 rounded bg-blue-500/10 text-blue-300 border border-blue-500/20">DOCX</span>
                          </>
                        ) : (
                          <>
                            <FileType size={15} className="text-emerald-400" />
                            <span className="text-xs text-slate-200 max-w-[170px] truncate">{msg.file.name}</span>
                            <span className="text-[10px] font-mono px-1 rounded bg-emerald-500/10 text-emerald-300 border border-emerald-500/20">TXT</span>
                          </>
                        )}
                      </div>
                    )}
                  </div>
                )}

                {/* Footer Metadata & Feedback */}
                <div className="flex items-center gap-2 px-1 text-[10px] text-slate-400 font-mono">
                  <span>
                    {new Intl.DateTimeFormat('id-ID', { hour: '2-digit', minute: '2-digit' }).format(msg.timestamp)}
                  </span>

                  {isBot && !isStreaming && idx === messages.length - 1 && !feedbackStatus && (
                    <div className="flex items-center gap-1 ml-2">
                      <button
                        onClick={() => onFeedback(idx, 'thumbs_up')}
                        className="p-1 text-slate-400 hover:text-blue-400 hover:bg-white/[0.05] transition-all rounded active:scale-[0.9]"
                        title="Jawaban relevan & membantu"
                        aria-label="Thumbs up"
                      >
                        <ThumbsUp size={12} />
                      </button>
                      <button
                        onClick={() => onFeedback(idx, 'thumbs_down')}
                        className="p-1 text-slate-400 hover:text-red-400 hover:bg-white/[0.05] transition-all rounded active:scale-[0.9]"
                        title="Jawaban kurang relevan"
                        aria-label="Thumbs down"
                      >
                        <ThumbsDown size={12} />
                      </button>
                    </div>
                  )}

                  {feedbackStatus && (
                    <div className="flex items-center gap-1 text-[10px] text-slate-400 ml-2">
                      {feedbackStatus === 'thumbs_up' ? (
                        <ThumbsUp size={11} className="text-blue-400" />
                      ) : (
                        <ThumbsDown size={11} className="text-red-400" />
                      )}
                      <span>Terima kasih atas feedback!</span>
                    </div>
                  )}
                </div>
              </div>
            </motion.div>
          );
        })}
      </AnimatePresence>

      {/* Typing Indicator with Precision Wave */}
      <AnimatePresence>
        {(isWaitingForResponse || isAdminTyping) && (
          <motion.div
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.95 }}
            transition={{ duration: 0.2 }}
            className="flex gap-3 max-w-[90%]"
          >
            <div className="w-8 h-8 rounded-xl bg-white/[0.05] border border-white/10 p-1 shrink-0 flex items-center justify-center mt-1">
              {isAdminTyping ? (
                <Headphones size={15} className="text-amber-400" />
              ) : (
                <img src={botAvatar} alt="LEXA" className="w-full h-full object-contain filter drop-shadow-sm opacity-80" />
              )}
            </div>
            <div className="flex flex-col items-start gap-1">
              <span className={`text-[10px] font-semibold flex items-center gap-1 ${isAdminTyping ? 'text-amber-400' : 'text-blue-400'}`}>
                <span className={`w-1.5 h-1.5 rounded-full animate-pulse ${isAdminTyping ? 'bg-amber-400' : 'bg-blue-400'}`}></span>
                {isAdminTyping ? 'Staf CS sedang mengetik balasan...' : 'LEXA sedang memproses jawaban...'}
              </span>

              <div className="bg-[#0E1A33]/90 border border-white/[0.08] rounded-2xl rounded-tl-xs px-4 py-2.5 shadow-sm flex items-center gap-1.5">
                <motion.span
                  animate={{ opacity: [0.3, 1, 0.3], y: [0, -2, 0] }}
                  transition={{ repeat: Infinity, duration: 0.9, delay: 0 }}
                  className="w-1.5 h-1.5 rounded-full bg-blue-400"
                />
                <motion.span
                  animate={{ opacity: [0.3, 1, 0.3], y: [0, -2, 0] }}
                  transition={{ repeat: Infinity, duration: 0.9, delay: 0.2 }}
                  className="w-1.5 h-1.5 rounded-full bg-blue-400"
                />
                <motion.span
                  animate={{ opacity: [0.3, 1, 0.3], y: [0, -2, 0] }}
                  transition={{ repeat: Infinity, duration: 0.9, delay: 0.4 }}
                  className="w-1.5 h-1.5 rounded-full bg-blue-400"
                />
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      <div ref={messagesEndRef} />

      {/* High-End Image Lightbox Modal */}
      {previewImage && (
        <div
          className="fixed inset-0 z-[100] bg-black/85 backdrop-blur-md flex flex-col items-center justify-center p-4 animate-in fade-in"
          onClick={() => setPreviewImage(null)}
        >
          <div className="relative max-w-3xl max-h-[85vh] flex flex-col items-center" onClick={(e) => e.stopPropagation()}>
            <div className="w-full flex items-center justify-between pb-3 text-white">
              <span className="text-xs font-mono text-slate-300 truncate max-w-xs">{previewImageName}</span>
              <div className="flex items-center gap-2">
                <a
                  href={previewImage}
                  download={previewImageName || 'image.jpg'}
                  className="p-1.5 rounded-lg bg-white/10 hover:bg-white/20 text-white transition-colors"
                  title="Unduh berkas"
                >
                  <Download size={15} />
                </a>
                <button
                  onClick={() => setPreviewImage(null)}
                  className="p-1.5 rounded-lg bg-white/10 hover:bg-white/20 text-white transition-colors"
                  title="Tutup preview"
                >
                  <X size={15} />
                </button>
              </div>
            </div>
            <img
              src={previewImage}
              alt={previewImageName || 'Preview'}
              className="max-h-[75vh] max-w-full rounded-2xl shadow-2xl object-contain border border-white/15"
            />
          </div>
        </div>
      )}
    </div>
  );
};

export default ChatMessageList;
